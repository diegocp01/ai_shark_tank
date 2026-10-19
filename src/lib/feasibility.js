// Deterministic business feasibility report, built from the same factors the
// sharks use. No model calls: the same pitch always gets the same report.

import { clamp, formatMoneyFull, formatPercent, impliedValuation } from "../shared/format.js";
import { CATEGORY_LABELS } from "./pitchCatalog.js";
import { computeFactors, FACTOR_LABELS, grossMarginPct } from "./scoring.js";

const MINIMUM_INVESTMENT_BASE = {
  hardware: 180_000,
  software: 45_000,
  food: 85_000,
  consumer: 35_000,
  marketplace: 70_000,
  health: 120_000,
  climate: 650_000,
};

const FEASIBILITY_WEIGHTS = {
  traction: 0.24,
  unitEconomics: 0.2,
  margin: 0.14,
  scalability: 0.14,
  defensibility: 0.1,
  brand: 0.06,
};

const STRENGTH_PHRASES = {
  traction: "real traction",
  margin: "healthy margins",
  unitEconomics: "strong customer economics",
  defensibility: "a real moat",
  novelty: "a genuinely new idea",
  scalability: "a big market",
  brand: "a memorable brand",
  risk: "low execution risk",
};

const WEAKNESS_PHRASES = {
  traction: "traction is thin",
  margin: "margins are thin",
  unitEconomics: "customer economics are weak",
  defensibility: "it's easy to copy",
  novelty: "the idea isn't new",
  scalability: "the market looks small",
  brand: "the brand is forgettable",
  risk: "execution risk is high",
};

export function buildFeasibilityReport(pitch) {
  const factors = computeFactors(pitch);
  let weighted = 0;

  for (const [factor, weight] of Object.entries(FEASIBILITY_WEIGHTS)) {
    weighted += weight * factors[factor];
  }

  weighted += 0.12 * (1 - factors.risk);
  const feasibilityPercent = Math.round(clamp(weighted, 0.08, 0.94) * 100);

  const riskAdjustment = 1 + factors.risk * 0.8;
  const minimumInitialInvestmentUsd =
    Math.round(((MINIMUM_INVESTMENT_BASE[pitch.category] ?? 60_000) * riskAdjustment) / 5_000) * 5_000;

  let difficulty = "medium";

  if (factors.risk >= 0.66 || pitch.category === "climate") {
    difficulty = "hard";
  } else if (feasibilityPercent >= 66 && factors.risk < 0.45) {
    difficulty = "easy";
  }

  let timeToFirstRevenue = "1 month";

  if (difficulty === "hard" || ["hardware", "climate", "health"].includes(pitch.category)) {
    timeToFirstRevenue = "more than 1 month";
  } else if (difficulty === "easy" || ["software", "consumer"].includes(pitch.category)) {
    timeToFirstRevenue = "2 weeks";
  }

  const ranked = Object.keys(FACTOR_LABELS)
    .map((id) => ({
      id,
      label: id === "risk" ? "Low execution risk" : FACTOR_LABELS[id],
      score: id === "risk" ? Math.round((1 - factors.risk) * 100) / 100 : factors[id],
    }))
    .sort((a, b) => b.score - a.score);
  const strengths = ranked.slice(0, 2);
  const weaknesses = ranked.slice(-2).reverse();
  const isGoodBusiness = feasibilityPercent >= 58 ? "yes" : "no";

  return {
    feasibilityPercent,
    isGoodBusiness,
    minimumInitialInvestmentUsd,
    difficulty,
    timeToFirstRevenue,
    summary:
      isGoodBusiness === "yes"
        ? `${pitch.startupName} has a credible path, led by ${STRENGTH_PHRASES[strengths[0].id]} and ${STRENGTH_PHRASES[strengths[1].id]}. ${capitalize(WEAKNESS_PHRASES[weaknesses[0].id])}, and that will decide how big it gets.`
        : `${pitch.startupName} is a tough business as pitched: ${WEAKNESS_PHRASES[weaknesses[0].id]} and ${WEAKNESS_PHRASES[weaknesses[1].id]}.`,
    biggestRisk: `${pitch.story.weakness}.`,
    strengths,
    weaknesses,
    factors: ranked,
    keyNumbers: {
      askValuationUsd: impliedValuation(pitch.askUsd, pitch.equityPct),
      revenueTtmUsd: pitch.metrics.revenueTtmUsd,
      grossMarginPct: grossMarginPct(pitch.metrics),
      ltvToCac: pitch.metrics.cacUsd ? Math.round((pitch.metrics.ltvUsd / pitch.metrics.cacUsd) * 10) / 10 : 0,
    },
  };
}

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function slugify(input) {
  return (
    String(input || "ai-shark-tank")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "ai-shark-tank"
  );
}

export function buildReportFileName(startupName) {
  return `${slugify(startupName)}-feasibility-report.md`;
}

export function buildFeasibilityMarkdown(pitch, report, { episode = null, footer = "" } = {}) {
  const lines = [
    `# ${pitch.startupName}: AI Shark Tank Feasibility Report`,
    "",
    `**Product:** ${pitch.productName}  `,
    `**Category:** ${CATEGORY_LABELS[pitch.category] || pitch.category}  `,
    `**The ask:** ${formatMoneyFull(pitch.askUsd)} for ${formatPercent(pitch.equityPct)} (${formatMoneyFull(report.keyNumbers.askValuationUsd)} valuation)`,
    "",
    `> ${pitch.tagline}`,
    "",
    "## Verdict",
    "",
    `| Metric | Result |`,
    `| --- | --- |`,
    `| Feasibility | ${report.feasibilityPercent}% |`,
    `| Good business idea | ${report.isGoodBusiness} |`,
    `| Minimum initial investment | ${formatMoneyFull(report.minimumInitialInvestmentUsd)} |`,
    `| Difficulty | ${report.difficulty} |`,
    `| Time to first money if done right | ${report.timeToFirstRevenue} |`,
    "",
    `**Summary:** ${report.summary}`,
    "",
    `**Biggest risk:** ${report.biggestRisk}`,
    "",
    "## Factor breakdown",
    "",
    ...report.factors.map((factor) => `- ${factor.label}: ${Math.round(factor.score * 100)}/100`),
  ];

  if (episode) {
    lines.push(
      "",
      "## What happened in the tank",
      "",
      `**Outcome:** ${episode.result.headline}  `,
      `**Final terms:** ${episode.result.termsLabel}  `,
      `**Episode:** ${episode.title} (seed ${episode.seed})`,
      "",
      "### Transcript",
      "",
      ...episode.beats
        .filter((beat) => beat.text)
        .map((beat) => `- **${beat.speakerName}:** ${beat.text}`),
    );
  }

  if (footer) {
    lines.push("", footer);
  }

  lines.push("", "---", "", "_Generated by the deterministic AI Shark Tank scripted engine. No model calls were made._");
  return lines.join("\n");
}
