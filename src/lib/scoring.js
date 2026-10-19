// Turns pitch metrics into 0..1 business factors, then scores each shark's
// interest from their persona weights.

import { clamp, impliedValuation } from "../shared/format.js";

export const FACTOR_LABELS = {
  traction: "Traction",
  margin: "Gross margin",
  unitEconomics: "Customer economics",
  defensibility: "Defensibility",
  novelty: "Novelty",
  scalability: "Market size",
  brand: "Brand power",
  risk: "Execution risk",
};

export function grossMarginPct(metrics) {
  if (!metrics?.priceUsd) {
    return 0;
  }

  return Math.round(((metrics.priceUsd - metrics.unitCostUsd) / metrics.priceUsd) * 100);
}

export function computeFactors(pitch) {
  const { metrics, traits } = pitch;
  const valuation = impliedValuation(pitch.askUsd, pitch.equityPct);
  const revenue = Math.max(0, metrics.revenueTtmUsd || 0);
  const revenueScore = clamp((Math.log10(revenue + 1) - 4.3) / 2.2);
  const growthScore = clamp((metrics.growthMoMPct || 0) / 25);
  const multiple = revenue > 0 ? valuation / revenue : Infinity;
  const multipleScore = Number.isFinite(multiple) ? clamp((25 - multiple) / 22) : 0;
  const ltvToCac = metrics.cacUsd > 0 ? metrics.ltvUsd / metrics.cacUsd : 0;

  return {
    traction: round2(0.4 * revenueScore + 0.3 * growthScore + 0.3 * multipleScore),
    margin: round2(clamp((grossMarginPct(metrics) - 15) / 65)),
    unitEconomics: round2(clamp((ltvToCac - 1) / 7)),
    defensibility: traits.defensibility,
    novelty: traits.novelty,
    scalability: traits.scalability,
    brand: traits.brand,
    risk: traits.risk,
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Normalizes the weighted sum to 0..1 so a perfectly average pitch lands at 0.5.
export function scoreShark(profile, factors, rng) {
  let raw = 0;
  let maxRaw = 0;
  let minRaw = 0;

  for (const [factor, weight] of Object.entries(profile.weights)) {
    raw += weight * factors[factor];

    if (weight > 0) {
      maxRaw += weight;
    } else {
      minRaw += weight;
    }
  }

  const base = (raw - minRaw) / (maxRaw - minRaw);
  const noise = rng.float(-0.05, 0.05) + (profile.chaos ? rng.float(-profile.chaos, profile.chaos) : 0);
  return round2(clamp(base + noise));
}

// The factor that hurts this shark's score the most (relative to an average pitch).
export function weakestFactorFor(profile, factors) {
  let weakest = null;
  let worstImpact = Infinity;

  for (const [factor, weight] of Object.entries(profile.weights)) {
    const impact = weight * (factors[factor] - 0.5);

    if (impact < worstImpact) {
      worstImpact = impact;
      weakest = factor;
    }
  }

  return { factor: weakest, isActuallyWeak: worstImpact < -0.02 };
}

export function strongestFactorFor(profile, factors) {
  let strongest = null;
  let bestImpact = -Infinity;

  for (const [factor, weight] of Object.entries(profile.weights)) {
    if (weight <= 0) {
      continue;
    }

    const impact = weight * factors[factor];

    if (impact > bestImpact) {
      bestImpact = impact;
      strongest = factor;
    }
  }

  return strongest;
}
