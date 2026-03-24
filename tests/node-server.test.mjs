import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import { createApp } from "../server.js";
import { createDemoEpisode } from "../src/lib/demoEpisode.js";
import { generateEpisodes } from "../src/lib/sharkTankEngine.js";

test("createApp returns an express-compatible app object", () => {
  const app = createApp();

  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
  assert.equal(typeof app.use, "function");
});

test("createApp registers the live streaming route", () => {
  const app = createApp();
  const hasLiveRoute = app.router.stack.some((layer) => layer.route?.path === "/api/live-episode");

  assert.equal(hasLiveRoute, true);
});

test("createDemoEpisode includes tool and offer payloads for the UI", () => {
  const episode = createDemoEpisode({ episodeNumber: 1, theme: "luxury pet robotics" });

  assert.equal(episode.source, "demo");
  assert.equal(Array.isArray(episode.toolLedger), true);
  assert.equal(Array.isArray(episode.offerBoard), true);
  assert.equal(episode.toolLedger.length > 0, true);
  assert.equal(episode.offerBoard.length, 5);
  assert.equal(episode.timeline.length > 5, true);
});

test("generateEpisodes falls back to demo mode without an API key", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalStatsPath = process.env.AI_SHARK_TANK_STATS_PATH;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ai-shark-tank-stats-"));
  const statsPath = path.join(tempDir, "all-time-stats.json");
  delete process.env.OPENAI_API_KEY;
  process.env.AI_SHARK_TANK_STATS_PATH = statsPath;

  try {
    const payload = await generateEpisodes({
      count: 2,
      theme: "luxury pet robotics",
    });

    assert.equal(payload.source, "demo");
    assert.equal(payload.count, 2);
    assert.equal(payload.episodes[0].sharks.length, 5);
    assert.equal(payload.episodes[0].toolLedger.length > 0, true);
    assert.equal(payload.episodes[0].offerBoard.length, 5);

    const archived = JSON.parse(await readFile(statsPath, "utf8"));
    assert.equal(archived.stats.totalRuns, 1);
    assert.equal(archived.stats.totalEpisodes, 2);
    assert.equal(archived.stats.sourceCounts.demo, 1);
    assert.equal(archived.stats.modeCounts.batch, 1);
    assert.equal(archived.stats.pricingEstimate.model, "gpt-5.4");
    assert.equal(archived.runs[0].episodes.length, 2);
    assert.match(archived.runs[0].episodes[0].founderPitch, /MoodMutt Halo/i);
    assert.equal(archived.runs[0].episodes[0].episodeTranscriptWordCount > 0, true);
    assert.equal(archived.runs[0].episodes[0].llmOutputWordCount, 0);
    assert.equal(archived.runs[0].episodes[0].estimatedCostUsd, 0);
  } finally {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalStatsPath) {
      process.env.AI_SHARK_TANK_STATS_PATH = originalStatsPath;
    } else {
      delete process.env.AI_SHARK_TANK_STATS_PATH;
    }

    await rm(tempDir, { recursive: true, force: true });
  }
});

test("/api/speech returns 503 when no OpenAI API key is configured", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const speechRoute = app.router.stack.find((layer) => layer.route?.path === "/api/speech");
    const handler = speechRoute?.route?.stack?.[0]?.handle;
    const req = {
      body: {
        speakerId: "entrepreneur",
        text: "We are pitching live.",
      },
    };
    const res = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };

    assert.equal(typeof handler, "function");
    await handler(req, res);

    assert.equal(res.statusCode, 503);
    assert.match(res.payload.detail, /Text-to-speech is unavailable/i);
  } finally {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }
});

test("/api/feasibility-report returns a download-ready fallback report without an API key", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const route = app.router.stack.find((layer) => layer.route?.path === "/api/feasibility-report");
    const handler = route?.route?.stack?.[0]?.handle;
    const req = {
      body: {
        startupName: "Barklight Labs",
        founderPitch:
          "MoodMutt Halo is a smart pet collar that projects emotional lighting scenes based on dog behavior.",
      },
    };
    const res = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };

    assert.equal(typeof handler, "function");
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.source, "heuristic");
    assert.equal(typeof res.payload.report.feasibilityPercent, "number");
    assert.match(res.payload.report.isGoodBusiness, /^(yes|no)$/);
    assert.equal(typeof res.payload.report.minimumInitialInvestmentUsd, "number");
    assert.match(res.payload.report.difficulty, /^(easy|medium|hard)$/);
    assert.match(res.payload.report.timeToFirstRevenue, /^(2 weeks|1 month|more than 1 month)$/);
    assert.match(res.payload.download.fileName, /feasibility-report\.txt$/);
    assert.match(res.payload.download.content, /AI Shark Tank Feasibility Report/i);
    assert.match(res.payload.download.content, /Time to first money if done right:/i);
    assert.match(res.payload.download.content, /All-Time Shark Tank Stats/i);
  } finally {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }
});
