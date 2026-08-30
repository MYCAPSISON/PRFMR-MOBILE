import { Router } from "express";
import { speechToText } from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

router.post("/transcribe", async (req, res) => {
  const { audio, format = "m4a" } = req.body as { audio?: string; format?: string };

  if (!audio || typeof audio !== "string") {
    res.status(400).json({ error: "audio (base64 string) is required" });
    return;
  }

  try {
    const buffer = Buffer.from(audio, "base64");
    const ext = format.replace(/[^a-z0-9]/gi, "").toLowerCase() || "m4a";
    const safeFormat = (["wav", "mp3", "webm", "m4a", "mp4", "ogg", "flac"].includes(ext)
      ? ext
      : "m4a") as "wav" | "mp3" | "webm" | "m4a" | "mp4" | "ogg" | "flac";

    const text = await speechToText(buffer, safeFormat);
    res.json({ text: text ?? "" });
  } catch (e: any) {
    req.log.error({ err: e }, "Transcription failed");
    res.status(500).json({ error: e?.message ?? "Transcription failed" });
  }
});

export default router;
