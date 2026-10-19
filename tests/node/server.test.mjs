import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../../server.js";

let tempDir;
let statsPath;
let app;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ai-shark-tank-"));
  statsPath = path.join(tempDir, "all-time-stats.json");
  process.env.AI_SHARK_TANK_STATS_PATH = statsPath;
  app = createApp();
});

after(async () => {
  delete process.env.AI_SHARK_TANK_STATS_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("GET /api/health and /api/config", () => {
  it("reports the scripted provider", async () => {
    const response = await request(app).get("/api/health").expect(200);
    assert.deepEqual(response.body, { status: "ok", provider: "scripted" });
  });

  it("returns sharks, pitches, and phases without leaking scoring weights", async () => {
    const { body } = await request(app).get("/api/config").expect(200);

    assert.deepEqual(body.provider, { id: "scripted", label: "Scripted engine", live: false });
    assert.equal(body.sharks.length, 5);
    assert.equal(body.pitches.length, 6);
    assert.equal(body.phases.length, 6);
    assert.equal(body.pitches[0].id, "barklight");
    assert.equal(body.pitches[0].valuationUsd, 6_250_000);

    for (const shark of body.sharks) {
      assert.equal(shark.weights, undefined);
      assert.equal(shark.threshold, undefined);
      assert.ok(shark.look && shark.color);
    }
  });
});

describe("POST /api/episodes", () => {
  it("produces the same episode script for the same pitch and seed", async () => {
    const first = await request(app).post("/api/episodes").send({ pitchId: "barklight", seed: 1 }).expect(200);
    const second = await request(app).post("/api/episodes").send({ pitchId: "barklight", seed: 1 }).expect(200);

    assert.deepEqual(first.body.episode, second.body.episode);
    assert.equal(first.body.episode.result.headline, "Wild Wes invests in Barklight Labs");
    assert.equal(first.body.episode.provider, "scripted");
  });

  it("ships a markdown report with the transcript and archive stats", async () => {
    const { body } = await request(app).post("/api/episodes").send({ pitchId: "sproutsy", seed: 1 }).expect(200);

    assert.equal(body.download.fileName, "sproutsy-feasibility-report.md");
    assert.match(body.download.mimeType, /^text\/markdown/);
    assert.match(body.download.content, /^# Sproutsy: AI Shark Tank Feasibility Report/);
    assert.match(body.download.content, /Time to first money if done right \| more than 1 month/);
    assert.match(body.download.content, /\*\*Outcome:\*\* Sproutsy leaves without a deal/);
    assert.match(body.download.content, /## All-Time Shark Tank Stats/);
    assert.match(body.download.content, /No model calls were made/);
  });

  it("records every episode in the all-time archive", async () => {
    const { body } = await request(app).post("/api/episodes").send({ pitchId: "odd-sox", seed: 1 }).expect(200);
    const archive = JSON.parse(await readFile(statsPath, "utf8"));
    const last = archive.runs.at(-1).episodes[0];

    assert.equal(body.allTime.totalEpisodes, archive.stats.totalEpisodes);
    assert.equal(last.episodeId, "odd-sox-s1");
    assert.equal(last.outcome, "Deal");
    assert.deepEqual(last.investors, ["Vera The Brand Guru"]);
    assert.equal(archive.stats.sourceCounts.scripted >= 1, true);
  });

  it("builds an episode from a custom idea", async () => {
    const { body } = await request(app)
      .post("/api/episodes")
      .send({ idea: "a marketplace for renting wedding dresses", seed: 1 })
      .expect(200);

    assert.equal(body.episode.pitch.custom, true);
    assert.equal(body.episode.pitch.startupName, "WeddingDress Works");
  });

  it("rejects bad requests with 400s", async () => {
    const cases = [
      [{}, /pitchId or an idea/],
      [{ pitchId: "nope" }, /Unknown pitch/],
      [{ pitchId: "barklight", seed: 0 }, /Seed must be/],
      [{ pitchId: "barklight", seed: "abc" }, /Seed must be/],
      [{ idea: "x".repeat(400) }, /under 140 characters/],
    ];

    for (const [payload, message] of cases) {
      const response = await request(app).post("/api/episodes").send(payload).expect(400);
      assert.match(response.body.detail, message);
    }
  });
});

describe("POST /api/feasibility-report", () => {
  it("scores free-text pitches deterministically", async () => {
    const payload = {
      startupName: "Barklight Labs",
      founderPitch: "MoodMutt Halo is a smart pet collar that projects emotional lighting scenes based on dog behavior.",
    };
    const first = await request(app).post("/api/feasibility-report").send(payload).expect(200);
    const second = await request(app).post("/api/feasibility-report").send(payload).expect(200);
    const { report, download } = first.body;

    assert.deepEqual(first.body.report, second.body.report);
    assert.equal(first.body.source, "heuristic");
    assert.equal(first.body.startupName, "Barklight Labs");
    assert.equal(typeof report.feasibilityPercent, "number");
    assert.match(report.isGoodBusiness, /^(yes|no)$/);
    assert.match(report.difficulty, /^(easy|medium|hard)$/);
    assert.match(report.timeToFirstRevenue, /^(2 weeks|1 month|more than 1 month)$/);
    assert.equal(download.fileName, "barklight-labs-feasibility-report.md");
    assert.match(download.content, /Barklight Labs: AI Shark Tank Feasibility Report/);
  });

  it("requires pitch text", async () => {
    const response = await request(app).post("/api/feasibility-report").send({ startupName: "Empty" }).expect(400);
    assert.match(response.body.detail, /founderPitch, pitchText, or concept/);
  });
});

describe("static routes", () => {
  it("serves the app shell, shared modules, and JSON 404s for unknown API routes", async () => {
    const page = await request(app).get("/some/deep/link").expect(200);
    assert.match(page.text, /<title>AI Shark Tank<\/title>/);

    const shared = await request(app).get("/shared/board.js").expect(200);
    assert.match(shared.headers["content-type"], /javascript/);

    const missing = await request(app).get("/api/live-episode").expect(404);
    assert.equal(missing.body.detail, "Not found.");
  });
});
