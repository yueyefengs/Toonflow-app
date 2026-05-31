import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

router.get("/", async (_req, res) => {
  const keys = ["qiniuAK", "qiniuSK", "qiniuBucket", "qiniuDomain", "qiniuUploadUrl"];
  const rows = await u.db("o_setting").whereIn("key", keys).select("key", "value");
  const cfg: Record<string, string> = {};
  rows.forEach((r: any) => (cfg[r.key] = r.value));
  // 隐藏 SK 显示
  if (cfg.qiniuSK) cfg.qiniuSK = cfg.qiniuSK.replace(/./g, "*").slice(0, 8) + "****";
  res.status(200).send(success(cfg));
});

router.post(
  "/",
  validateFields({
    qiniuAK: z.string(),
    qiniuSK: z.string(),
    qiniuBucket: z.string(),
    qiniuDomain: z.string().url(),
    qiniuUploadUrl: z.string().optional(),
  }),
  async (req, res) => {
    const { qiniuAK, qiniuSK, qiniuBucket, qiniuDomain, qiniuUploadUrl } = req.body;
    const upsertSetting = async (key: string, value: string) => {
      const exists = await u.db("o_setting").where("key", key).first();
      if (exists) await u.db("o_setting").where("key", key).update({ value });
      else await u.db("o_setting").insert({ key, value });
    };
    await Promise.all([
      upsertSetting("qiniuAK", qiniuAK),
      upsertSetting("qiniuSK", qiniuSK),
      upsertSetting("qiniuBucket", qiniuBucket),
      upsertSetting("qiniuDomain", qiniuDomain),
      upsertSetting("qiniuUploadUrl", qiniuUploadUrl || "https://up.qiniup.com"),
    ]);
    res.status(200).send(success(null));
  },
);

export default router;
