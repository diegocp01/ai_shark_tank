import dotenv from "dotenv";
import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { formatAllTimeStatsForReport, readAllTimeStats } from "./src/lib/allTimeStatsStore.js";
import {
  generateEpisodes,
  generateFeasibilityReport,
  streamLiveEpisode,
} from "./src/lib/sharkTankEngine.js";
import { getSharkProfileById, SHARK_PROFILES } from "./src/lib/sharkProfiles.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SPEECH_CACHE = new Map();
const DEFAULT_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const FOUNDER_VOICE = {
  voice: "coral",
  instructions:
    "Speak like an ambitious startup founder pitching investors on live television. Energetic, persuasive, confident, and clear.",
};

function buildSpeechCacheKey(payload) {
  return crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

function rememberSpeech(key, value) {
  SPEECH_CACHE.set(key, value);

  if (SPEECH_CACHE.size > 100) {
    const oldestKey = SPEECH_CACHE.keys().next().value;
    SPEECH_CACHE.delete(oldestKey);
  }
}

function getSpeechProfile(speakerId) {
  if (speakerId === "entrepreneur") {
    return FOUNDER_VOICE;
  }

  const shark = getSharkProfileById(speakerId);

  if (!shark) {
    return null;
  }

  return {
    voice: shark.voice,
    instructions: shark.speechInstructions,
  };
}

function sendSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      runtime: process.env.OPENAI_API_KEY ? "agents" : "demo",
    });
  });

  app.get("/api/config", (_req, res) => {
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());

    res.json({
      runtime: hasOpenAIKey ? "agents" : "demo",
      ttsEnabled: hasOpenAIKey,
      sharks: SHARK_PROFILES,
      maxEpisodeCount: 3,
    });
  });

  app.post("/api/generate-episodes", async (req, res) => {
    try {
      const { count = 1, theme = "" } = req.body || {};
      const payload = await generateEpisodes({ count, theme });
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        detail:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating the AI Shark Tank episode.",
      });
    }
  });

  app.post("/api/feasibility-report", async (req, res) => {
    try {
      const payload = await generateFeasibilityReport(req.body || {});
      const archive = await readAllTimeStats();
      const reportFooter = formatAllTimeStatsForReport(archive);

      payload.download.content = `${payload.download.content}\n\n${reportFooter}`;
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(400).json({
        detail:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating the feasibility report.",
      });
    }
  });

  app.get("/api/live-episode", async (req, res) => {
    const controller = new AbortController();

    req.on("close", () => {
      controller.abort();
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      sendSseEvent(res, "ready", {
        ok: true,
      });

      await streamLiveEpisode({
        signal: controller.signal,
        send: async (payload) => {
          sendSseEvent(res, payload.type, payload);
        },
      });

      sendSseEvent(res, "done", {
        ok: true,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        res.end();
        return;
      }

      console.error(error);
      sendSseEvent(res, "stream_error", {
        detail:
          error instanceof Error
            ? error.message
            : "Something went wrong while streaming the live episode.",
      });
    } finally {
      res.end();
    }
  });

  app.post("/api/speech", async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({
          detail: "Text-to-speech is unavailable until OPENAI_API_KEY is configured.",
        });
      }

      const { speakerId, text } = req.body || {};
      const cleanedText = typeof text === "string" ? text.trim() : "";
      const profile = getSpeechProfile(speakerId);

      if (!profile) {
        return res.status(400).json({
          detail: "Unknown speaker for text-to-speech.",
        });
      }

      if (!cleanedText) {
        return res.status(400).json({
          detail: "Speech text is required.",
        });
      }

      const payload = {
        model: DEFAULT_TTS_MODEL,
        voice: profile.voice,
        input: cleanedText,
        instructions: profile.instructions,
        format: "wav",
      };
      const cacheKey = buildSpeechCacheKey(payload);
      const cachedAudio = SPEECH_CACHE.get(cacheKey);

      if (cachedAudio) {
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.send(cachedAudio);
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: payload.model,
          voice: payload.voice,
          input: payload.input,
          instructions: payload.instructions,
          response_format: payload.format,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI TTS failed: ${response.status} ${errorText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      rememberSpeech(cacheKey, audioBuffer);

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(audioBuffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        detail:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating speech audio.",
      });
    }
  });

  app.use((_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.PORT || "5050", 10);
  const app = createApp();

  app.listen(port, () => {
    console.log(`AI Shark Tank server running at http://127.0.0.1:${port}`);
  });
}
