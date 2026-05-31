/**
 * Toonflow AI供应商模板 - 通义千问（阿里云百炼）
 * @version 2.0
 */

// ============================================================
// 类型定义
// ============================================================

type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

// ============================================================
// 全局声明
// ============================================================

declare const axios: any;
declare const logger: (msg: string) => void;
declare const jsonwebtoken: any;
declare const zipImage: (base64: string, size: number) => Promise<string>;
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>;
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>;
declare const urlToBase64: (url: string) => Promise<string>;
declare const base64ToUrl: (base64: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const createZhipu: any;
declare const createQwen: any;
declare const createAnthropic: any;
declare const createOpenAICompatible: any;
declare const createXai: any;
declare const createMinimax: any;
declare const createGoogleGenerativeAI: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "qwen",
  version: "2.0",
  author: "Toonflow",
  name: "通义千问",
  description:
    "阿里云百炼官方接口，支持 Qwen3 文本模型（思考模式）、万相图像/视频生成、HappyHorse 视频生成。\n\n[前往平台获取API Key](https://dashscope.aliyun.com/)",
  icon: "",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true, placeholder: "sk-xxx" },
    {
      key: "baseUrl",
      label: "请求地址",
      type: "url",
      required: true,
      placeholder: "示例：https://dashscope.aliyuncs.com",
    },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com",
  },
  models: [
    // ===================== 文本模型 =====================
    { name: "Qwen3 235B A22B", modelName: "qwen3-235b-a22b", type: "text", think: true },
    { name: "Qwen3 72B", modelName: "qwen3-72b", type: "text", think: true },
    { name: "Qwen3 32B", modelName: "qwen3-32b", type: "text", think: true },
    { name: "Qwen3 14B", modelName: "qwen3-14b", type: "text", think: true },
    { name: "Qwen3 8B", modelName: "qwen3-8b", type: "text", think: true },
    { name: "Qwen-Max", modelName: "qwen-max", type: "text", think: false },
    { name: "Qwen-Plus", modelName: "qwen-plus", type: "text", think: false },
    { name: "Qwen-Turbo", modelName: "qwen-turbo", type: "text", think: false },
    { name: "Qwen-Long", modelName: "qwen-long", type: "text", think: false },
    // ===================== 图像模型 =====================
    {
      name: "万相2.7 图像Pro",
      modelName: "wan2.7-image-pro",
      type: "image",
      mode: ["text"],
    },
    {
      name: "千问图像2.0 Pro",
      modelName: "qwen-image-2.0-pro",
      type: "image",
      mode: ["text"],
    },
    // ===================== 视频模型 =====================
    {
      name: "万相2.1 文生视频 Turbo",
      modelName: "wanx2.1-t2v-turbo",
      type: "video",
      mode: ["text"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
    {
      name: "万相2.1 文生视频 Plus",
      modelName: "wanx2.1-t2v-plus",
      type: "video",
      mode: ["text"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
    {
      name: "万相2.1 图生视频 Turbo",
      modelName: "wanx2.1-i2v-turbo",
      type: "video",
      mode: ["singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
    {
      name: "万相2.1 图生视频 Plus",
      modelName: "wanx2.1-i2v-plus",
      type: "video",
      mode: ["singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
    {
      name: "万相2.1 首尾帧生视频 Plus",
      modelName: "wanx2.1-kf2v-plus",
      type: "video",
      mode: ["startEndRequired"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
    // ===================== HappyHorse 视频模型 =====================
    {
      name: "HappyHorse 1.0 文生视频",
      modelName: "happyhorse-1.0-t2v",
      type: "video",
      mode: ["text"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
    {
      name: "HappyHorse 1.0 图生视频",
      modelName: "happyhorse-1.0-i2v",
      type: "video",
      mode: ["singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
    {
      name: "HappyHorse 1.0 参考生视频",
      modelName: "happyhorse-1.0-r2v",
      type: "video",
      mode: [["imageReference:3"]],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
    {
      name: "HappyHorse 1.0 视频编辑",
      modelName: "happyhorse-1.0-video-edit",
      type: "video",
      mode: [["videoReference:1"]],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

const getHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
});

// 根据尺寸级别和宽高比，计算万相图像 API 的像素尺寸（来自官方推荐尺寸表）
const getWanImageSize = (size: "1K" | "2K" | "4K", aspectRatio: string): string => {
  const map: Record<string, Record<string, string>> = {
    "1K": { "1:1": "1280*1280", "16:9": "1696*960", "9:16": "960*1696", "4:3": "1472*1104", "3:4": "1104*1472" },
    "2K": { "1:1": "2048*2048", "16:9": "2688*1536", "9:16": "1536*2688", "4:3": "2368*1728", "3:4": "1728*2368" },
    "4K": { "1:1": "4096*4096", "16:9": "4096*2304", "9:16": "2304*4096", "4:3": "4096*3072", "3:4": "3072*4096" },
  };
  return map[size]?.[aspectRatio] ?? map[size]["1:1"];
};

// 千问图像模型最大支持 2048×2048
const getQwenImageSize = (size: "1K" | "2K" | "4K", aspectRatio: string): string => {
  const map: Record<string, Record<string, string>> = {
    "1K": { "1:1": "1024*1024", "16:9": "1280*720", "9:16": "720*1280", "4:3": "1024*768", "3:4": "768*1024" },
    "2K": { "1:1": "2048*2048", "16:9": "2048*1152", "9:16": "1152*2048", "4:3": "2048*1536", "3:4": "1536*2048" },
    "4K": { "1:1": "2048*2048", "16:9": "2048*1152", "9:16": "1152*2048", "4:3": "2048*1536", "3:4": "1536*2048" },
  };
  return map[size]?.[aspectRatio] ?? "2048*2048";
};

const getVideoSize = (resolution: string, aspectRatio: string): string => {
  if (aspectRatio === "9:16") return resolution === "1080p" ? "1080*1920" : "720*1280";
  return resolution === "1080p" ? "1920*1080" : "1280*720";
};

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  const enableThinking = model.think && think;

  return createOpenAICompatible({
    name: "qwen",
    baseURL: `${vendor.inputValues.baseUrl}/compatible-mode/v1`,
    apiKey,
    fetch: async (url: string, options?: RequestInit) => {
      if (enableThinking) {
        const rawBody = JSON.parse((options?.body as string) ?? "{}");
        options = { ...options, body: JSON.stringify({ ...rawBody, enable_thinking: true }) };
      }
      return fetch(url, options);
    },
  }).chatModel(model.modelName);
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  const base = vendor.inputValues.baseUrl;
  const headers = getHeaders(apiKey);

  // 千问图像：同步调用
  if (model.modelName.startsWith("qwen-image")) {
    const size = getQwenImageSize(config.size, config.aspectRatio);
    const body = {
      model: model.modelName,
      input: { messages: [{ role: "user", content: [{ text: config.prompt }] }] },
      parameters: { size, watermark: false, prompt_extend: true },
    };
    const resp = await axios.post(
      `${base}/api/v1/services/aigc/multimodal-generation/generation`,
      body,
      { headers },
    );
    const imgUrl = resp.data?.output?.choices?.[0]?.message?.content?.[0]?.image;
    if (!imgUrl) throw new Error(`千问图像生成失败：${JSON.stringify(resp.data?.output)}`);
    logger(`千问图像生成完成，开始下载`);
    return await urlToBase64(imgUrl);
  }

  // 万相图像：异步任务
  const size = getWanImageSize(config.size, config.aspectRatio);
  const content: any[] = [{ text: config.prompt }];
  if (config.referenceList && config.referenceList.length > 0) {
    content.push({ image: config.referenceList[0].base64 });
  }
  const body = {
    model: model.modelName,
    input: { messages: [{ role: "user", content }] },
    parameters: { size, n: 1, watermark: false },
  };

  logger(`提交万相图像任务，模型：${model.modelName}`);
  const submitResp = await axios.post(
    `${base}/api/v1/services/aigc/image-generation/generation`,
    body,
    { headers: { ...headers, "X-DashScope-Async": "enable" } },
  );
  const taskId = submitResp.data?.output?.task_id;
  if (!taskId) throw new Error(`万相图像任务提交失败：${JSON.stringify(submitResp.data)}`);
  logger(`万相图像任务ID：${taskId}`);

  const pollResult = await pollTask(
    async () => {
      const r = await axios.get(`${base}/api/v1/tasks/${taskId}`, { headers });
      const status = r.data?.output?.task_status;
      if (status === "SUCCEEDED") {
        const url = r.data?.output?.choices?.[0]?.message?.content?.[0]?.image;
        if (!url) return { completed: true, error: "未获取到图片URL" };
        return { completed: true, data: url };
      }
      if (status === "FAILED") {
        return { completed: true, error: r.data?.output?.message || "生成失败" };
      }
      logger(`万相图像生成中...状态：${status}`);
      return { completed: false };
    },
    5000,
    300000,
  );

  if (pollResult.error) throw new Error(pollResult.error);
  logger(`万相图像生成完成，开始下载`);
  return await urlToBase64(pollResult.data!);
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  const base = vendor.inputValues.baseUrl;
  const headers = getHeaders(apiKey);

  const size = getVideoSize(config.resolution, config.aspectRatio);
  const input: any = { prompt: config.prompt };

  // 图生视频（首帧）
  if (config.mode.includes("singleImage") && config.referenceList?.length) {
    const img = config.referenceList.find((r) => r.type === "image");
    if (img) input.img_url = await base64ToUrl(img.base64);
  }

  // 首尾帧生视频
  if (config.mode.includes("startEndRequired") && config.referenceList?.length) {
    const imgs = config.referenceList.filter((r) => r.type === "image");
    if (imgs.length >= 2) {
      input.first_frame_url = await base64ToUrl(imgs[0].base64);
      input.last_frame_url = await base64ToUrl(imgs[1].base64);
    } else {
      throw new Error("首尾帧生视频需要提供两张图片");
    }
  }

  // 多参考图生视频 (r2v)
  const hasImageRefMode = config.mode.some((m) => Array.isArray(m) && m.some((s: string) => s.startsWith("imageReference")));
  if (hasImageRefMode && config.referenceList?.length) {
    const imgs = config.referenceList.filter((r) => r.type === "image");
    if (imgs.length > 0) {
      input.ref_image_urls = await Promise.all(imgs.map((img) => base64ToUrl(img.base64)));
    }
  }

  // 视频编辑 (video-edit)
  const hasVideoRefMode = config.mode.some((m) => Array.isArray(m) && m.some((s: string) => s.startsWith("videoReference")));
  if (hasVideoRefMode && config.referenceList?.length) {
    const video = config.referenceList.find((r) => r.type === "video");
    if (video) input.video_url = await base64ToUrl(video.base64);
  }

  const body = {
    model: model.modelName,
    input,
    parameters: { size, duration: config.duration },
  };

  logger(`提交视频生成任务，模型：${model.modelName}`);
  const submitResp = await axios.post(
    `${base}/api/v1/services/aigc/video-generation/generation`,
    body,
    { headers: { ...headers, "X-DashScope-Async": "enable" } },
  );
  const taskId = submitResp.data?.output?.task_id;
  if (!taskId) throw new Error(`视频任务提交失败：${JSON.stringify(submitResp.data)}`);
  logger(`视频任务ID：${taskId}`);

  const pollResult = await pollTask(
    async () => {
      const r = await axios.get(`${base}/api/v1/tasks/${taskId}`, { headers });
      const output = r.data?.output;
      const status = output?.task_status;
      if (status === "SUCCEEDED") {
        const url = output?.video_url || output?.results?.[0]?.url;
        if (!url) return { completed: true, error: "未获取到视频URL" };
        return { completed: true, data: url };
      }
      if (status === "FAILED") {
        return { completed: true, error: output?.message || "视频生成失败" };
      }
      logger(`视频生成中...状态：${status}`);
      return { completed: false };
    },
    10000,
    600000,
  );

  if (pollResult.error) throw new Error(pollResult.error);
  logger(`视频生成完成，开始下载`);
  return await urlToBase64(pollResult.data!);
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  const base = vendor.inputValues.baseUrl;

  const resp = await axios.post(
    `${base}/compatible-mode/v1/audio/speech`,
    {
      model: model.modelName,
      input: config.text,
      voice: config.voice,
      format: "mp3",
      speech_rate: config.speechRate ?? 1.0,
      pitch_rate: config.pitchRate ?? 1.0,
      volume: config.volume ?? 50,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      responseType: "arraybuffer",
    },
  );

  return `data:audio/mp3;base64,${resp.data.toString("base64")}`;
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.0", notice: "" };
};

const updateVendor = async (): Promise<string> => {
  return "";
};

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

export {};
