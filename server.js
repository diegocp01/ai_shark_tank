import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import {
  buildArchiveEpisode,
  formatAllTimeStatsForReport,
  readAllTimeStats,
  recordEpisodeRun,
  summarizeAllTimeStats,
} from "./src/lib/allTimeStatsStore.js";
import { buildFeasibilityMarkdown, buildFeasibilityReport, buildReportFileName } from "./src/lib/feasibility.js";
import { createIdeaPitch, IDEA_MAX_LENGTH } from "./src/lib/ideaPitch.js";
import { CATEGORY_LABELS, PRESET_PITCHES } from "./src/lib/pitchCatalog.js";
import { describeProvider, getEpisodeProvider } from "./src/lib/providers/index.js";
import { DEFAULT_SEED, MAX_SEED, normalizeSeed, PHASES } from "./src/lib/scriptedEngine.js";
import { SHARK_PROFILES, toPublicShark } from "./src/lib/sharkProfiles.js";
import { impliedValuation } from "./src/shared/format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKDOWN_MIME = "text/markdown; charset=utf-8";

class RequestError extends Error {}

function readEpisodeRequest(body = {}) {
  const pitchId = typeof body.pitchId === "string" ? body.pitchId.trim() : "";
  const idea = typeof body.idea === "string" ? body.idea.trim() : "";

  if (!pitchId && !idea) {
    throw new RequestError("Send a pitchId or an idea.");
  }

  if (idea.length > IDEA_MAX_LENGTH * 2) {
    throw new RequestError(`Keep the idea under ${IDEA_MAX_LENGTH} characters.`);
  }

  try {
    return { pitchId, idea, seed: normalizeSeed(body.seed) };
  } catch (error) {
    throw new RequestError(error.message);
  }
}

function summarizePitch(pitch) {
  return {
    id: pitch.id,
    startupName: pitch.startupName,
    productName: pitch.productName,
    tagline: pitch.tagline,
    category: pitch.category,
    categoryLabel: CATEGORY_LABELS[pitch.category],
    icon: pitch.icon,
    askUsd: pitch.askUsd,
    equityPct: pitch.equityPct,
    valuationUsd: impliedValuation(pitch.askUsd, pitch.equityPct),
    founder: { ...pitch.founder },
  };
}

async function recordEpisode(episode) {
  try {
    return await recordEpisodeRun({
      source: episode.provider,
      mode: "live",
      theme: episode.pitch.custom ? episode.pitch.idea : episode.pitch.id,
      episodes: [buildArchiveEpisode(episode)],
    });
  } catch (error) {
    console.error("Failed to record episode stats.", error);
    return null;
  }
}

function sendError(res, error, fallbackMessage) {
  if (error instanceof RequestError) {
    return res.status(400).json({ detail: error.message });
  }

  if (error instanceof Error && /^(Unknown pitch|Describe a startup idea|Pick a pitch)/.test(error.message)) {
    return res.status(400).json({ detail: error.message });
  }

  console.error(error);
  return res.status(500).json({ detail: fallbackMessage });
}

export function createApp() {
  const app = express();
  const provider = getEpisodeProvider();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/shared", express.static(path.join(__dirname, "src", "shared")));
  app.use("/vendor/three/build", express.static(path.join(__dirname, "node_modules", "three", "build")));
  app.use("/vendor/three/examples/jsm", express.static(path.join(__dirname, "node_modules", "three", "examples", "jsm")));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", provider: provider.id });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      provider: describeProvider(provider),
      sharks: SHARK_PROFILES.map(toPublicShark),
      pitches: PRESET_PITCHES.map(summarizePitch),
      phases: PHASES,
      defaults: { seed: DEFAULT_SEED },
      limits: { ideaMaxLength: IDEA_MAX_LENGTH, maxSeed: MAX_SEED },
    });
  });

  app.post("/api/episodes", async (req, res) => {
    try {
      const request = readEpisodeRequest(req.body);
      const episode = await provider.createEpisode(request);
      const archive = await recordEpisode(episode);
      const footer = archive ? formatAllTimeStatsForReport(archive) : "";

      res.json({
        episode,
        allTime: archive ? summarizeAllTimeStats(archive) : null,
        download: {
          fileName: buildReportFileName(episode.pitch.startupName),
          mimeType: MARKDOWN_MIME,
          content: buildFeasibilityMarkdown(episode.pitch, episode.report, { episode, footer }),
        },
      });
    } catch (error) {
      sendError(res, error, "Something went wrong while producing the episode.");
    }
  });

  // Standalone report for any pitch text, kept for API clients. Uses the same
  // deterministic scoring as the episode engine.
  app.post("/api/feasibility-report", async (req, res) => {
    try {
      const body = req.body || {};
      const text = [body.founderPitch, body.pitchText, body.concept].find(
        (value) => typeof value === "string" && value.trim(),
      );

      if (!text) {
        throw new RequestError("A founderPitch, pitchText, or concept is required to generate a report.");
      }

      const pitch = createIdeaPitch(text, normalizeSeed(body.seed));

      if (typeof body.startupName === "string" && body.startupName.trim()) {
        pitch.startupName = body.startupName.trim().slice(0, 80);
      }

      if (typeof body.productName === "string" && body.productName.trim()) {
        pitch.productName = body.productName.trim().slice(0, 80);
      }

      const report = buildFeasibilityReport(pitch);
      const archive = await readAllTimeStats().catch(() => null);

      res.json({
        source: "heuristic",
        startupName: pitch.startupName,
        report,
        download: {
          fileName: buildReportFileName(pitch.startupName),
          mimeType: MARKDOWN_MIME,
          content: buildFeasibilityMarkdown(pitch, report, {
            footer: archive ? formatAllTimeStatsForReport(archive) : "",
          }),
        },
      });
    } catch (error) {
      sendError(res, error, "Something went wrong while generating the feasibility report.");
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ detail: "Not found." });
  });

  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.PORT || "5050", 10);

  createApp().listen(port, () => {
    console.log(`AI Shark Tank studio running at http://127.0.0.1:${port}`);
  });
}
