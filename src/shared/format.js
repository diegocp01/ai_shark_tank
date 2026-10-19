// Formatting helpers shared by the server engine and the browser (served at /shared/).

export function roundHalf(value) {
  return Math.round(value * 2) / 2;
}

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function trimNumber(value, digits) {
  return Number(value.toFixed(digits)).toString();
}

// Spoken style for dialogue: "$500,000", "$1.25 million".
export function formatMoneySpoken(value) {
  const amount = Math.round(Number(value) || 0);

  if (amount >= 1_000_000) {
    return `$${trimNumber(amount / 1_000_000, 2)} million`;
  }

  return `$${amount.toLocaleString("en-US")}`;
}

// Valuations come out of division, so round them to three significant figures
// before saying them out loud: $344,828 -> "$345,000".
export function formatValuationSpoken(value) {
  const amount = Math.round(Number(value) || 0);

  if (amount <= 0) {
    return "$0";
  }

  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(amount)) - 2);
  return formatMoneySpoken(Math.round(amount / magnitude) * magnitude);
}

// Compact style for UI chips: "$500K", "$1.25M".
export function formatMoneyShort(value) {
  const amount = Math.round(Number(value) || 0);

  if (amount >= 1_000_000) {
    return `$${trimNumber(amount / 1_000_000, 2)}M`;
  }

  if (amount >= 10_000) {
    return `$${trimNumber(amount / 1_000, 0)}K`;
  }

  if (amount >= 1_000) {
    return `$${trimNumber(amount / 1_000, 1)}K`;
  }

  return `$${amount.toLocaleString("en-US")}`;
}

export function formatMoneyFull(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString("en-US")}`;
}

export function formatPercent(value) {
  return `${trimNumber(Number(value) || 0, 1)}%`;
}

export function impliedValuation(cashUsd, equityPct) {
  if (!cashUsd || !equityPct) {
    return 0;
  }

  return Math.round(cashUsd / (equityPct / 100));
}

export function formatOfferShort(offer) {
  if (!offer) {
    return "";
  }

  const extras = offer.kicker?.short ? ` + ${offer.kicker.short}` : "";
  return `${formatMoneyShort(offer.cashUsd)} for ${formatPercent(offer.equityPct)}${extras}`;
}

export function formatOfferFull(offer) {
  if (!offer) {
    return "";
  }

  const extras = offer.kicker?.label ? `, ${offer.kicker.label}` : "";
  return `${formatMoneyFull(offer.cashUsd)} for ${formatPercent(offer.equityPct)}${extras}`;
}
