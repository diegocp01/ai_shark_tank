import { createAnthropicClient } from "./src/lib/anthropic/client.js";
import { describeCast } from "./src/lib/liveEpisode.js";
import express from "express";
import dotenv from "dotenv";
import { AIError, createOpenAIClient } from "./src/lib/openai/client.js";
import { createLiveProviders } from "./src/lib/openai/providers.js";
import { createSpeechService } from "./src/lib/openai/speech.js";
import { createPitchDeck, mockDeckProvider } from "./src/lib/pitchDeck.js";
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
  if (error instanceof AIError) return res.status(error.status).json({ detail: error.message });
  if (error instanceof RequestError) {
    return res.status(400).json({ detail: error.message });
  }

  if (error instanceof Error && /^(Unknown pitch|Describe a startup idea|Pick a pitch)/.test(error.message)) {
    return res.status(400).json({ detail: error.message });
  }

  console.error(error);
  return res.status(500).json({ detail: fallbackMessage });
}

export function createApp({ deckProvider = mockDeckProvider, episodeProvider = getEpisodeProvider(), speechService = null, generateIdea = null, aiSettings = null } = {}) {
  const app = express();
  const provider = episodeProvider;
  let generating = 0;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use("/api", (req, res, next) => {
    if (req.method === "POST" && (req.get("sec-fetch-site") === "cross-site" || (req.get("origin") && req.get("origin") !== `${req.protocol}://${req.get("host")}`))) {
      return res.status(403).json({ detail: "Requests must come from this studio." });
    }
    next();
  });
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/shared", express.static(path.join(__dirname, "src", "shared")));
  app.use("/vendor/three/build", express.static(path.join(__dirname, "node_modules", "three", "build")));
  app.use("/vendor/three/examples/jsm", express.static(path.join(__dirname, "node_modules", "three", "examples", "jsm")));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", provider: provider.id });
  });

  function apiAvailability() {
    if (!provider.live || !generateIdea) return { available: false, reason: "API mode is not configured on this server." };
    try { provider.assertConfigured?.(); return { available: true, reason: null }; }
    catch (error) { return { available: false, reason: error instanceof AIError ? error.message : "API mode is not configured." }; }
  }

  app.get("/api/config", (_req, res) => {
    res.json({
      provider: describeProvider(provider),
      deckProvider: describeProvider(deckProvider),
      speech: speechService?.describe() || { provider: "none" },
      generation: aiSettings,
      cast: aiSettings?.cast || describeCast(),
      modes: { api: apiAvailability(), test: { available: true } },
      sharks: SHARK_PROFILES.map(toPublicShark),
      pitches: PRESET_PITCHES.map(summarizePitch),
      phases: PHASES,
      defaults: { seed: DEFAULT_SEED },
      limits: { ideaMaxLength: IDEA_MAX_LENGTH, maxSeed: MAX_SEED },
    });
  });

  app.post("/api/ideas", async (req, res) => {
    if (!generateIdea) return res.status(503).json({ detail: "Idea generation needs OpenAI mode." });
    if (generating >= 2) return res.status(429).json({ detail: "The studio is already preparing a show. Please wait." });
    generating++;
    try { res.json(await generateIdea(typeof req.body?.theme === "string" ? req.body.theme.slice(0, 140) : "")); }
    catch (error) { sendError(res, error, "Could not generate an idea. Please try again."); }
    finally { generating--; }
  });

  app.post("/api/speech", async (req, res) => {
    if (!speechService) return res.status(503).json({ detail: "OpenAI voices are not enabled." });
    try {
      if (typeof req.body?.token !== "string" || typeof req.body?.beatId !== "string") throw new RequestError("Send an audio session token and beatId.");
      const audio = await speechService.audio(req.body.token, req.body.beatId);
      res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" }).send(audio);
    } catch (error) { sendError(res, error, "Could not generate this voice line."); }
  });

  app.post("/api/episodes", async (req, res) => {
    if (generating >= 2) return res.status(429).json({ detail: "The studio is already preparing a show. Please wait." });
    generating++;
    try {
      const mode = req.body?.mode;
      if (mode !== undefined && !["api", "test"].includes(mode)) throw new RequestError("Choose API or Test.");
      let request;
      if (mode === "api") {
        const availability = apiAvailability();
        if (!availability.available) throw new AIError(availability.reason, 503);
        // The model invents the idea inside the production request. The browser
        // supplies no theme, idea, preset or seed for an API show.
        const generated = await generateIdea();
        request = readEpisodeRequest({ idea: generated.idea, seed: DEFAULT_SEED });
      } else if (mode === "test") {
        request = readEpisodeRequest({ pitchId: req.body.pitchId || PRESET_PITCHES[0].id, seed: req.body.seed ?? DEFAULT_SEED });
      } else request = readEpisodeRequest(req.body); // Older programmatic clients.
      const testMode = mode === "test";
      const episode = await (testMode ? getEpisodeProvider() : provider).createEpisode(request);
      const deck = await createPitchDeck(episode, testMode ? mockDeckProvider : deckProvider);
      const archive = await recordEpisode(episode);
      const footer = archive ? formatAllTimeStatsForReport(archive) : "";

      res.json({
        episode,
        deck,
        speech: !testMode ? speechService?.register(episode) || null : null,
        allTime: archive ? summarizeAllTimeStats(archive) : null,
        download: {
          fileName: buildReportFileName(episode.pitch.startupName),
          mimeType: MARKDOWN_MIME,
          content: buildFeasibilityMarkdown(episode.pitch, episode.report, { episode, footer }),
        },
      });
    } catch (error) {
      sendError(res, error, "Something went wrong while producing the episode.");
    } finally { generating--; }
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
  dotenv.config({ path: [path.join(__dirname, ".env.local"), path.join(__dirname, ".env")], quiet: true });
  const port = Number.parseInt(process.env.PORT || "5050", 10);
  const mode = process.env.AI_SHARK_TANK_MODE || (process.env.OPENAI_API_KEY ? "openai" : "mock");
  if (!["live", "openai", "mock"].includes(mode)) throw new Error("AI_SHARK_TANK_MODE must be live or mock (openai is a live alias).");
  let options = {};
  if (process.env.AI_SHARK_TANK_TESTING === "1" && mode !== "mock") throw new Error("Tests must run in mock mode.");
  if (mode !== "mock") {
    const client = createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
    const anthropic = createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });
    options = { ...createLiveProviders(client, anthropic), speechService: createSpeechService(client), aiSettings: { ...client.settings, cast: describeCast({ openai: client, anthropic }) } };
  }
  createApp(options).listen(port, "127.0.0.1", () => {
    console.log(`AI Shark Tank studio running at http://127.0.0.1:${port}`);
  });
}
