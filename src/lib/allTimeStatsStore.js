import crypto from "crypto";
import path from "path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_STATS_PATH = path.join(__dirname, "..", "..", "data", "all-time-stats.json");
const WORD_TO_TOKEN_ESTIMATE = 1.33;
const PRICING_ESTIMATE = {
  model: "gpt-5.4",
  pricingMode: "standard-short-context",
  inputUsdPer1MTokens: 2.5,
  outputUsdPer1MTokens: 15,
  estimatedTokensPerWord: WORD_TO_TOKEN_ESTIMATE,
  sourceUrl: "https://developers.openai.com/api/docs/pricing",
  sourceNote:
    "OpenAI GPT-5.4 standard short-context pricing verified from official docs on 2026-03-21.",
};

let writeQueue = Promise.resolve();

function getStatsFilePath() {
  return process.env.AI_SHARK_TANK_STATS_PATH?.trim() || DEFAULT_STATS_PATH;
}

function createEmptyArchive(now = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    stats: {
      totalRuns: 0,
      totalEpisodes: 0,
      sourceCounts: {
        demo: 0,
        agents: 0,
      },
      modeCounts: {
        batch: 0,
        live: 0,
      },
      outcomeCounts: {
        Deal: 0,
        "No Deal": 0,
        "Multi-Shark Deal": 0,
        Unknown: 0,
      },
      totalEpisodeTranscriptWords: 0,
      totalLlmInputWords: 0,
      totalLlmOutputWords: 0,
      estimatedTotalInputTokens: 0,
      estimatedTotalOutputTokens: 0,
      estimatedTotalCostUsd: 0,
      sharkDealCounts: {},
      uniqueStartupCount: 0,
      pricingEstimate: PRICING_ESTIMATE,
    },
    runs: [],
  };
}

async function readArchiveFromDisk() {
  const filePath = getStatsFilePath();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const emptyArchive = createEmptyArchive();

    return {
      ...emptyArchive,
      ...parsed,
      stats: {
        ...emptyArchive.stats,
        ...(parsed?.stats || {}),
        pricingEstimate: {
          ...emptyArchive.stats.pricingEstimate,
          ...(parsed?.stats?.pricingEstimate || {}),
        },
      },
      runs: Array.isArray(parsed?.runs) ? parsed.runs : [],
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createEmptyArchive();
    }

    throw error;
  }
}

function safeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function countWordsInString(text) {
  if (typeof text !== "string" || !text.trim()) {
    return 0;
  }

  const matches = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

function inferStartupName(pitchText) {
  const text = safeText(pitchText);

  if (!text) {
    return null;
  }

  const namedPattern = text.match(
    /\b(?:called|named|is)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3})\b/,
  );

  if (namedPattern?.[1]) {
    return namedPattern[1].trim();
  }

  const fallbackPattern = text.match(/\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})\b/);
  return fallbackPattern?.[1]?.trim() || null;
}

function inferProductName(pitchText) {
  const text = safeText(pitchText);

  if (!text) {
    return null;
  }

  const productPattern = text.match(
    /\b(?:product|device|platform|company|startup)\s+(?:called|named|is)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3})\b/i,
  );

  return productPattern?.[1]?.trim() || null;
}

function parseMoneyToken(token) {
  const match = typeof token === "string" ? token.trim().match(/^([\d,.]+)\s*([kKmM])?$/) : null;

  if (!match) {
    return null;
  }

  const numeric = Number.parseFloat(match[1].replace(/,/g, ""));

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const suffix = match[2]?.toLowerCase();

  if (suffix === "m") {
    return Math.round(numeric * 1_000_000);
  }

  if (suffix === "k") {
    return Math.round(numeric * 1_000);
  }

  return Math.round(numeric);
}

function extractAskAmountUsd(pitchText) {
  const text = safeText(pitchText);

  if (!text) {
    return null;
  }

  const match = text.match(/\$([\d,.]+(?:\s?[kKmM])?)/);
  return match ? parseMoneyToken(match[1]) : null;
}

function extractEquityPercent(pitchText) {
  const text = safeText(pitchText);

  if (!text) {
    return null;
  }

  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSharkSummary(shark) {
  return {
    id: safeText(shark?.id),
    displayName: safeText(shark?.displayName),
    fullName: safeText(shark?.fullName) || safeText(shark?.sharkName),
    persona: safeText(shark?.persona),
    question: safeText(shark?.question),
    openingDecision: safeText(shark?.openingDecision),
    openingLine: safeText(shark?.openingLine) || safeText(shark?.questionLine),
    founderResponse: safeText(shark?.founderResponse),
    finalDecision: safeText(shark?.finalDecision),
    finalLine: safeText(shark?.finalLine),
    finalTerms: safeText(shark?.finalTerms),
    founderMove: safeText(shark?.founderMove),
  };
}

function estimateEpisodeUsage({
  model = null,
  episodeTranscriptWordCount = 0,
  llmInputWordCount = 0,
  llmOutputWordCount = 0,
  reasoningEffort = null,
} = {}) {
  const pricingModel = safeText(model) || PRICING_ESTIMATE.model;
  const estimatedInputTokens = Math.round(Math.max(0, llmInputWordCount) * WORD_TO_TOKEN_ESTIMATE);
  const estimatedOutputTokens = Math.round(Math.max(0, llmOutputWordCount) * WORD_TO_TOKEN_ESTIMATE);
  const estimatedCostUsd =
    roundCurrency(
      (estimatedInputTokens / 1_000_000) * PRICING_ESTIMATE.inputUsdPer1MTokens +
        (estimatedOutputTokens / 1_000_000) * PRICING_ESTIMATE.outputUsdPer1MTokens,
    );

  return {
    pricingModel,
    reasoningEffort: safeText(reasoningEffort),
    episodeTranscriptWordCount: Math.max(0, episodeTranscriptWordCount),
    llmInputWordCount: Math.max(0, llmInputWordCount),
    llmOutputWordCount: Math.max(0, llmOutputWordCount),
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd,
  };
}

function deriveTranscriptWordCount(founderPitch, sharks) {
  let total = countWordsInString(founderPitch);

  for (const shark of sharks) {
    total += countWordsInString(shark?.question);
    total += countWordsInString(shark?.openingLine);
    total += countWordsInString(shark?.founderResponse);
    total += countWordsInString(shark?.finalLine);
  }

  return total;
}

export function buildArchiveEpisodeFromEpisode(
  episode,
  { mode = "batch", usage = null, model = null, reasoningEffort = null } = {},
) {
  const founder = episode?.founder || {};
  const founderPitch = safeText(founder.founderPitch);
  const sharks = Array.isArray(episode?.sharks) ? episode.sharks.map(normalizeSharkSummary) : [];
  const usageSummary = estimateEpisodeUsage({
    model,
    reasoningEffort,
    episodeTranscriptWordCount:
      safeNumber(usage?.episodeTranscriptWordCount) ?? deriveTranscriptWordCount(founderPitch, sharks),
    llmInputWordCount: safeNumber(usage?.llmInputWordCount) ?? 0,
    llmOutputWordCount: safeNumber(usage?.llmOutputWordCount) ?? 0,
  });

  return {
    archiveEpisodeId: crypto.randomUUID(),
    episodeNumber: safeNumber(episode?.episodeNumber),
    generatedAt: safeText(episode?.generatedAt) || new Date().toISOString(),
    source: safeText(episode?.source),
    mode,
    theme: safeText(episode?.theme),
    startupName: safeText(founder.startupName) || inferStartupName(founderPitch),
    productName: safeText(founder.productName) || inferProductName(founderPitch),
    concept: safeText(founder.concept),
    founderPitch,
    askAmountUsd: safeNumber(founder.askAmountUsd) ?? extractAskAmountUsd(founderPitch),
    equityPercent: safeNumber(founder.equityPercent) ?? extractEquityPercent(founderPitch),
    outcome: safeText(episode?.dealSummary?.outcome) || "Unknown",
    finalTerms: safeText(episode?.dealSummary?.finalTerms),
    investors: Array.isArray(episode?.dealSummary?.investors)
      ? episode.dealSummary.investors.map((investor) => safeText(investor)).filter(Boolean)
      : [],
    rationale: safeText(episode?.dealSummary?.rationale),
    sharks,
    ...usageSummary,
  };
}

export function buildArchiveEpisodeFromLiveRun({
  source,
  theme = null,
  founder = null,
  founderPitch = null,
  sharks = [],
  dealSummary = null,
  usage = null,
  model = null,
  reasoningEffort = null,
} = {}) {
  const founderPitchText = safeText(founder?.founderPitch) || safeText(founderPitch);
  const normalizedSharks = Array.isArray(sharks) ? sharks.map(normalizeSharkSummary) : [];
  const usageSummary = estimateEpisodeUsage({
    model,
    reasoningEffort,
    episodeTranscriptWordCount:
      safeNumber(usage?.episodeTranscriptWordCount) ??
      deriveTranscriptWordCount(founderPitchText, normalizedSharks),
    llmInputWordCount: safeNumber(usage?.llmInputWordCount) ?? 0,
    llmOutputWordCount: safeNumber(usage?.llmOutputWordCount) ?? 0,
  });

  return {
    archiveEpisodeId: crypto.randomUUID(),
    episodeNumber: 1,
    generatedAt: new Date().toISOString(),
    source: safeText(source),
    mode: "live",
    theme: safeText(theme),
    startupName: safeText(founder?.startupName) || inferStartupName(founderPitchText),
    productName: safeText(founder?.productName) || inferProductName(founderPitchText),
    concept: safeText(founder?.concept),
    founderPitch: founderPitchText,
    askAmountUsd: safeNumber(founder?.askAmountUsd) ?? extractAskAmountUsd(founderPitchText),
    equityPercent: safeNumber(founder?.equityPercent) ?? extractEquityPercent(founderPitchText),
    outcome: safeText(dealSummary?.outcome) || "Unknown",
    finalTerms: safeText(dealSummary?.finalTerms),
    investors: Array.isArray(dealSummary?.investors)
      ? dealSummary.investors.map((investor) => safeText(investor)).filter(Boolean)
      : [],
    rationale: safeText(dealSummary?.rationale),
    sharks: normalizedSharks,
    ...usageSummary,
  };
}

function calculateStats(runs) {
  const startupNames = new Set();
  const stats = createEmptyArchive().stats;

  stats.totalRuns = runs.length;

  for (const run of runs) {
    const source = safeText(run?.source) || "demo";
    const mode = safeText(run?.mode) || "batch";

    stats.sourceCounts[source] = (stats.sourceCounts[source] || 0) + 1;
    stats.modeCounts[mode] = (stats.modeCounts[mode] || 0) + 1;

    const episodes = Array.isArray(run?.episodes) ? run.episodes : [];
    stats.totalEpisodes += episodes.length;

    for (const episode of episodes) {
      const outcome = safeText(episode?.outcome) || "Unknown";
      const startupName = safeText(episode?.startupName);
      stats.totalEpisodeTranscriptWords += safeNumber(episode?.episodeTranscriptWordCount) ?? 0;
      stats.totalLlmInputWords += safeNumber(episode?.llmInputWordCount) ?? 0;
      stats.totalLlmOutputWords += safeNumber(episode?.llmOutputWordCount) ?? 0;
      stats.estimatedTotalInputTokens += safeNumber(episode?.estimatedInputTokens) ?? 0;
      stats.estimatedTotalOutputTokens += safeNumber(episode?.estimatedOutputTokens) ?? 0;
      stats.estimatedTotalCostUsd = roundCurrency(
        stats.estimatedTotalCostUsd + (safeNumber(episode?.estimatedCostUsd) ?? 0),
      );

      stats.outcomeCounts[outcome] = (stats.outcomeCounts[outcome] || 0) + 1;

      if (startupName) {
        startupNames.add(startupName.toLowerCase());
      }

      const investors = Array.isArray(episode?.investors) ? episode.investors : [];

      for (const investor of investors) {
        const name = safeText(investor);

        if (!name) {
          continue;
        }

        stats.sharkDealCounts[name] = (stats.sharkDealCounts[name] || 0) + 1;
      }
    }
  }

  stats.uniqueStartupCount = startupNames.size;
  return stats;
}

export async function readAllTimeStats() {
  return readArchiveFromDisk();
}

export function formatAllTimeStatsForReport(archive) {
  const stats = archive?.stats || createEmptyArchive().stats;

  return [
    "All-Time Shark Tank Stats",
    "=========================",
    `Total runs: ${stats.totalRuns}`,
    `Total episodes: ${stats.totalEpisodes}`,
    `Total episode words: ${stats.totalEpisodeTranscriptWords}`,
    `Total LLM input words: ${stats.totalLlmInputWords}`,
    `Total LLM output words: ${stats.totalLlmOutputWords}`,
    `Estimated total input tokens: ${stats.estimatedTotalInputTokens}`,
    `Estimated total output tokens: ${stats.estimatedTotalOutputTokens}`,
    `Estimated total cost (USD): ${stats.estimatedTotalCostUsd}`,
    `Pricing model: ${stats.pricingEstimate?.model || PRICING_ESTIMATE.model}`,
    `Pricing basis: ${stats.pricingEstimate?.pricingMode || PRICING_ESTIMATE.pricingMode}`,
    `Input price per 1M tokens (USD): ${
      stats.pricingEstimate?.inputUsdPer1MTokens ?? PRICING_ESTIMATE.inputUsdPer1MTokens
    }`,
    `Output price per 1M tokens (USD): ${
      stats.pricingEstimate?.outputUsdPer1MTokens ?? PRICING_ESTIMATE.outputUsdPer1MTokens
    }`,
    `Token estimate per word: ${
      stats.pricingEstimate?.estimatedTokensPerWord ?? PRICING_ESTIMATE.estimatedTokensPerWord
    }`,
    `Pricing source: ${stats.pricingEstimate?.sourceUrl || PRICING_ESTIMATE.sourceUrl}`,
  ].join("\n");
}

export async function recordEpisodeRun({
  source,
  mode,
  theme = null,
  episodes = [],
} = {}) {
  const operation = writeQueue.then(async () => {
    const archive = await readArchiveFromDisk();
    const now = new Date().toISOString();
    const normalizedEpisodes = Array.isArray(episodes) ? episodes.filter(Boolean) : [];

    archive.runs.push({
      runId: crypto.randomUUID(),
      recordedAt: now,
      source: safeText(source) || "demo",
      mode: safeText(mode) || "batch",
      theme: safeText(theme),
      episodeCount: normalizedEpisodes.length,
      episodes: normalizedEpisodes,
    });

    archive.updatedAt = now;
    archive.stats = calculateStats(archive.runs);

    const filePath = getStatsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
  });

  writeQueue = operation.catch(() => {});
  return operation;
}
