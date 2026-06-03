/**
 * Toonflow AI供应商模板 - 通义千问(Qwen)
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

interface ImageConfig {
  prompt: string;
  imageBase64: string[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  imageBase64?: string[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
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
  name: "通义千问(Qwen)",
  description:
    "阿里云百炼平台通义千问接口适配，支持 Qwen3、QwQ 系列模型与思考模式。\n\n[前往平台](https://bailian.console.aliyun.com/)",
  icon: "",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true, placeholder: "百炼平台 DashScope API Key" },
    { key: "baseUrl", label: "请求地址", type: "url", required: true, placeholder: "示例：https://dashscope.aliyuncs.com/compatible-mode/v1" },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  models: [
    // ===================== 推理模型 =====================
    { name: "QwQ-Max", modelName: "qwq-max", type: "text", think: true },
    { name: "QwQ-Plus", modelName: "qwq-plus", type: "text", think: true },
    { name: "QwQ-32B", modelName: "qwq-32b", type: "text", think: true },
    // ===================== Qwen3 系列 =====================
    { name: "Qwen3-235B-A22B", modelName: "qwen3-235b-a22b", type: "text", think: true },
    { name: "Qwen3-30B-A3B", modelName: "qwen3-30b-a3b", type: "text", think: true },
    { name: "Qwen3-32B", modelName: "qwen3-32b", type: "text", think: true },
    { name: "Qwen3-14B", modelName: "qwen3-14b", type: "text", think: false },
    { name: "Qwen3-8B", modelName: "qwen3-8b", type: "text", think: false },
    { name: "Qwen3-4B", modelName: "qwen3-4b", type: "text", think: false },
    // ===================== 动态别名（自动指向最新版本） =====================
    { name: "Qwen-Max", modelName: "qwen-max", type: "text", think: false },
    { name: "Qwen-Plus", modelName: "qwen-plus", type: "text", think: false },
    { name: "Qwen-Turbo", modelName: "qwen-turbo", type: "text", think: false },
    // ===================== Qwen2.5 系列 =====================
    { name: "Qwen2.5-72B", modelName: "qwen2.5-72b-instruct", type: "text", think: false },
    { name: "Qwen2.5-32B", modelName: "qwen2.5-32b-instruct", type: "text", think: false },
    { name: "Qwen2.5-14B", modelName: "qwen2.5-14b-instruct", type: "text", think: false },
    { name: "Qwen2.5-7B", modelName: "qwen2.5-7b-instruct", type: "text", think: false },
    // ===================== 长文本 =====================
    { name: "Qwen-Long", modelName: "qwen-long", type: "text", think: false },
  ],
};

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");

  const enableThinking = model.think && think;

  // Qwen3 系列通过 enable_thinking 控制思考模式
  const extraBody: Record<string, any> = {
    enable_thinking: enableThinking,
  };

  // QwQ 系列始终启用思考，通过 thinking_budget 控制深度
  if (enableThinking && model.modelName.startsWith("qwq")) {
    const budgetMap: Record<0 | 1 | 2 | 3, number> = {
      0: 2048,
      1: 8192,
      2: 32768,
      3: 65536,
    };
    extraBody.thinking_budget = budgetMap[thinkLevel];
  }

  return createQwen({
    baseURL: vendor.inputValues.baseUrl,
    apiKey,
    extraBody,
  }).chat(model.modelName);
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  return "";
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  return "";
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  return "";
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
