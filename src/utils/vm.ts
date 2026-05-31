import { VM } from "vm2";
import sharp from "sharp";
import axios from "axios";
import crypto from "crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createZhipu } from "zhipu-ai-provider";
import { createQwen } from "qwen-ai-provider-v5";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { createMinimax } from "vercel-minimax-ai-provider";
import FormData from "form-data";
import jsonwebtoken from "jsonwebtoken";
import u from "@/utils";
export default function runCode(code: string, vendor?: Record<string, any>) {
  code = code.replace(/export\s*\{\s*\};?/g, ""); // 去掉 export {} 以免沙盒环境报错
  // 创建一个沙盒
  const exports = {};
  const sandbox: Record<string, any> = {
    createOpenAI,
    createDeepSeek,
    createZhipu,
    createQwen,
    createAnthropic,
    createOpenAICompatible,
    createXai,
    createMinimax,
    createGoogleGenerativeAI,
    zipImage,
    zipImageResolution,
    urlToBase64,
    base64ToUrl,
    mergeImages,
    pollTask,
    fetch: fetch,
    exports,
    axios,
    FormData,
    logger,
    jsonwebtoken,
  };
  if (vendor !== undefined) {
    sandbox.vendor = vendor;
  }
  const vm = new VM({
    timeout: 0,
    sandbox,
    compiler: "javascript",
    eval: false,
    wasm: false,
  });

  vm.run(code);

  return exports as Record<string, any>;
}
export function logger(logstring: any) {
  console.log("【VM】" + JSON.stringify(logstring));
}
/**
 * 压缩图片，目标字节数不高于 size
 */
export async function zipImage(completeBase64: string, size: number): Promise<string> {
  let quality = 80;
  let buffer = Buffer.from(completeBase64.split(",")[1], "base64");
  let output = await sharp(buffer).jpeg({ quality }).toBuffer();
  while (output.length > size && quality > 10) {
    quality -= 10;
    output = await sharp(buffer).jpeg({ quality }).toBuffer();
  }
  return "data:image/jpeg;base64," + output.toString("base64");
}

export async function zipImageResolution(completeBase64: string, width: number, height: number): Promise<string> {
  const buffer = Buffer.from(completeBase64.split(",")[1], "base64");
  const out = await sharp(buffer).resize(width, height).toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

//url转Base64
export async function urlToBase64(url: string): Promise<string> {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  const mime = res.headers["content-type"] || "image/jpeg";
  const b64 = Buffer.from(res.data).toString("base64");
  return `data:${mime};base64,${b64}`;
}

// base64 data URI → 优先上传七牛云，fallback 本地 OSS URL
export async function base64ToUrl(completeBase64: string): Promise<string> {
  const match = completeBase64.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("base64ToUrl: 无效的 base64 格式");
  const mimeType = match[1];
  const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";
  const buffer = Buffer.from(match[2], "base64");

  // 读取七牛云配置（优先环境变量，其次数据库）
  const getQiniuConfig = async () => {
    const ak = process.env.QINIU_ACCESS_KEY;
    const sk = process.env.QINIU_SECRET_KEY;
    const bucket = process.env.QINIU_BUCKET;
    const domain = process.env.QINIU_DOMAIN;
    if (ak && sk && bucket && domain) return { ak, sk, bucket, domain };
    try {
      const rows = await u.db("o_setting").whereIn("key", ["qiniuAK", "qiniuSK", "qiniuBucket", "qiniuDomain"]).select("key", "value");
      const cfg: Record<string, string> = {};
      rows.forEach((r: any) => (cfg[r.key] = r.value));
      if (cfg.qiniuAK && cfg.qiniuSK && cfg.qiniuBucket && cfg.qiniuDomain)
        return { ak: cfg.qiniuAK, sk: cfg.qiniuSK, bucket: cfg.qiniuBucket, domain: cfg.qiniuDomain };
    } catch {}
    return null;
  };

  const qiniu = await getQiniuConfig();
  if (qiniu) {
    const key = `toonflow/temp/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const putPolicy = Buffer.from(JSON.stringify({ scope: `${qiniu.bucket}:${key}`, deadline: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    const sign = crypto.createHmac("sha1", qiniu.sk).update(putPolicy).digest("base64url");
    const token = `${qiniu.ak}:${sign}:${putPolicy}`;

    const form = new FormData();
    form.append("token", token);
    form.append("key", key);
    form.append("file", buffer, { filename: `image.${ext}`, contentType: mimeType });

    const uploadUrl = process.env.QINIU_UPLOAD_URL || "https://up.qiniup.com";
    await axios.post(uploadUrl, form, { headers: form.getHeaders() });

    const domain = qiniu.domain.replace(/\/$/, "");
    return `${domain}/${key}`;
  }

  // fallback：本地 OSS
  const filename = `temp/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  await u.oss.writeFile(filename, completeBase64);
  return await u.oss.getFileUrl(filename);
}

export async function pollTask(
  fn: () => Promise<{ completed: boolean; data?: string; error?: string }>,
  interval = 3000,
  timeout = 3000000,
): Promise<{ completed: boolean; data?: string; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await fn();
      if (result.completed) return result;
      if (result?.error) return result;
    } catch (e: any) {
      return { completed: false, error: u.error(e).message || "poll error" };
    }
    await new Promise((res) => setTimeout(res, interval));
  }
  return { completed: false, error: "timeout" };
}

/**
 * 将多张图片横向拼接为一张，并确保输出大小不超过指定限制
 * @param imageBase64List - base64编码的图片数组
 * @param maxSize - 最大输出大小，支持格式如 "10mb", "5MB", "1024kb" 等
 * @returns 拼接后的图片base64字符串
 */
export async function mergeImages(imageBase64List: string[], maxSize = "10mb"): Promise<string> {
  if (imageBase64List.length === 0) {
    throw new Error("图片列表不能为空");
  }

  const maxBytes = parseSize(maxSize);
  const imageBuffers = imageBase64List.map(base64ToBuffer);
  const imageMetadatas = await Promise.all(imageBuffers.map((buffer) => sharp(buffer).metadata()));
  const maxHeight = Math.max(...imageMetadatas.map((m) => m.height || 0));

  // 计算各图片调整后的宽度
  const imageWidths = imageMetadatas.map((metadata) => {
    const aspectRatio = (metadata.width || 1) / (metadata.height || 1);
    return Math.round(maxHeight * aspectRatio);
  });
  const totalWidth = imageWidths.reduce((sum, w) => sum + w, 0);

  // 拼接图片
  const resizedImages = await Promise.all(
    imageBuffers.map(async (buffer, index) => {
      return sharp(buffer).resize(imageWidths[index], maxHeight, { fit: "cover" }).toBuffer();
    }),
  );

  let currentX = 0;
  const compositeInputs = resizedImages.map((buffer, index) => {
    const input = { input: buffer, left: currentX, top: 0 };
    currentX += imageWidths[index];
    return input;
  });

  const mergedBuffer = await sharp({
    create: {
      width: totalWidth,
      height: maxHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(compositeInputs)
    .jpeg({ quality: 90 })
    .toBuffer();

  // 复用压缩逻辑
  const resultBuffer = await compressToSize(mergedBuffer, maxBytes, totalWidth, maxHeight);
  return resultBuffer.toString("base64");
}

/**
 * 解析大小字符串为字节数
 */
function parseSize(size: string): number {
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb|b)?$/);
  if (!match) {
    throw new Error(`无效的大小格式: ${size}`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2] || "b";
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  return Math.floor(value * multipliers[unit]);
}

/**
 * 将base64字符串转换为Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

/**
 * 压缩Buffer到指定大小以内
 */
async function compressToSize(imageBuffer: Buffer, maxBytes: number, originalWidth: number, originalHeight: number): Promise<Buffer> {
  let quality = 90;
  let scale = 1;

  while (true) {
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    const resultBuffer = await sharp(imageBuffer).resize(targetWidth, targetHeight, { fit: "fill" }).jpeg({ quality }).toBuffer();

    if (resultBuffer.length <= maxBytes) {
      return resultBuffer;
    }

    if (quality > 10) {
      quality -= 10;
    } else {
      quality = 90;
      scale *= 0.8;
    }
  }
}
