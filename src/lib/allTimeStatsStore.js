// All-time archive of every episode the studio has aired. Stats are always
// recomputed from the run list, so older archive files stay readable.

import crypto from "crypto";
import path from "path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATS_PATH = path.join(__dirname, "..", "..", "data", "all-time-stats.json");
const DEAL_OUTCOMES = new Set(["Deal", "Multi-Shark Deal"]);

let writeQueue = Promise.resolve();

function getStatsFilePath() {
  return process.env.AI_SHARK_TANK_STATS_PATH?.trim() || DEFAULT_STATS_PATH;
}

function createEmptyArchive(now = new Date().toISOString()) {
  return {
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    stats: calculateStats([]),
    runs: [],
  };
}

async function readArchiveFromDisk() {
  try {
    const parsed = JSON.parse(await readFile(getStatsFilePath(), "utf8"));
    const runs = Array.isArray(parsed?.runs) ? parsed.runs : [];

    return {
      ...createEmptyArchive(),
      ...parsed,
      schemaVersion: 2,
      runs,
      stats: calculateStats(runs),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createEmptyArchive();
    }

    throw error;
  }
}

function calculateStats(runs) {
  const startupNames = new Set();
  const stats = {
    totalRuns: runs.length,
    totalEpisodes: 0,
    totalDeals: 0,
    dealRatePercent: 0,
    sourceCounts: {},
    outcomeCounts: { Deal: 0, "Multi-Shark Deal": 0, "No Deal": 0 },
    sharkDealCounts: {},
    totalDealDollarsUsd: 0,
    uniqueStartupCount: 0,
  };

  for (const run of runs) {
    const source = run?.source || "scripted";
    stats.sourceCounts[source] = (stats.sourceCounts[source] || 0) + 1;

    for (const episode of Array.isArray(run?.episodes) ? run.episodes : []) {
      const outcome = episode?.outcome || "No Deal";
      stats.totalEpisodes += 1;
      stats.outcomeCounts[outcome] = (stats.outcomeCounts[outcome] || 0) + 1;

      if (DEAL_OUTCOMES.has(outcome)) {
        stats.totalDeals += 1;
        stats.totalDealDollarsUsd += Number(episode?.dealCashUsd) || 0;
      }

      if (episode?.startupName) {
        startupNames.add(String(episode.startupName).toLowerCase());
      }

      for (const investor of Array.isArray(episode?.investors) ? episode.investors : []) {
        stats.sharkDealCounts[investor] = (stats.sharkDealCounts[investor] || 0) + 1;
      }
    }
  }

  stats.uniqueStartupCount = startupNames.size;
  stats.dealRatePercent = stats.totalEpisodes ? Math.round((stats.totalDeals / stats.totalEpisodes) * 100) : 0;
  return stats;
}

export function buildArchiveEpisode(episode, { mode = "live" } = {}) {
  return {
    archiveEpisodeId: crypto.randomUUID(),
    episodeId: episode.id,
    seed: episode.seed,
    generatedAt: new Date().toISOString(),
    source: episode.provider,
    mode,
    pitchId: episode.pitch.id,
    startupName: episode.pitch.startupName,
    productName: episode.pitch.productName,
    askAmountUsd: episode.pitch.askUsd,
    equityPercent: episode.pitch.equityPct,
    outcome: episode.result.dealType,
    finalTerms: episode.result.termsLabel,
    dealCashUsd: episode.result.offer?.cashUsd ?? 0,
    investors: episode.result.investors,
  };
}

export async function readAllTimeStats() {
  return readArchiveFromDisk();
}

export function summarizeAllTimeStats(archive) {
  const stats = archive?.stats || calculateStats([]);
  const [topShark] = Object.entries(stats.sharkDealCounts).sort((a, b) => b[1] - a[1]);

  return {
    totalEpisodes: stats.totalEpisodes,
    totalDeals: stats.totalDeals,
    dealRatePercent: stats.dealRatePercent,
    totalDealDollarsUsd: stats.totalDealDollarsUsd,
    topShark: topShark ? { name: topShark[0], deals: topShark[1] } : null,
  };
}

export function formatAllTimeStatsForReport(archive) {
  const summary = summarizeAllTimeStats(archive);

  return [
    "## All-Time Shark Tank Stats",
    "",
    `- Episodes aired: ${summary.totalEpisodes}`,
    `- Deals closed: ${summary.totalDeals} (${summary.dealRatePercent}% of episodes)`,
    `- Money committed: $${summary.totalDealDollarsUsd.toLocaleString("en-US")}`,
    `- Most active shark: ${summary.topShark ? `${summary.topShark.name} (${summary.topShark.deals} deals)` : "nobody yet"}`,
  ].join("\n");
}

export async function recordEpisodeRun({ source = "scripted", mode = "live", theme = null, episodes = [] } = {}) {
  const operation = writeQueue.then(async () => {
    const archive = await readArchiveFromDisk();
    const now = new Date().toISOString();
    const normalizedEpisodes = episodes.filter(Boolean);

    archive.runs.push({
      runId: crypto.randomUUID(),
      recordedAt: now,
      source,
      mode,
      theme,
      episodeCount: normalizedEpisodes.length,
      episodes: normalizedEpisodes,
    });

    archive.updatedAt = now;
    archive.stats = calculateStats(archive.runs);

    const filePath = getStatsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
    return archive;
  });

  writeQueue = operation.catch(() => {});
  return operation;
}
