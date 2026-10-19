// Turns a free-text startup idea into a structured pitch, deterministically.
// The same idea text + seed always yields the same company, metrics, and story.

import { clamp } from "../shared/format.js";
import { createRng, hashString } from "./rng.js";

export const IDEA_MAX_LENGTH = 140;

const CATEGORY_KEYWORDS = {
  climate: ["climate", "solar", "carbon", "recycle", "recycling", "recycled", "plastic", "ocean", "energy", "compost", "battery", "sustainable", "emissions", "wind"],
  health: ["health", "fitness", "sleep", "therapy", "medical", "wellness", "mental", "workout", "gym", "diet", "skin", "skincare", "supplement", "yoga", "meditation", "doctor"],
  food: ["food", "snack", "drink", "coffee", "tea", "beer", "wine", "sauce", "kitchen", "restaurant", "bakery", "pizza", "dumpling", "meal", "recipe", "cookie", "candy", "chocolate", "taco", "burger", "smoothie", "soda", "vegan"],
  hardware: ["robot", "device", "hardware", "drone", "gadget", "wearable", "sensor", "machine", "printer", "collar", "glasses", "headset", "charger", "lamp", "camera", "speaker", "mirror", "helmet"],
  marketplace: ["marketplace", "rent", "rental", "rentals", "renting", "booking", "gig", "freelance", "delivery", "sharing", "peer", "swap", "resale", "rideshare", "tutors", "sitters", "walkers"],
  software: ["app", "saas", "software", "platform", "api", "ai", "chatbot", "automation", "dashboard", "crm", "plugin", "extension", "analytics", "cloud", "agent", "website"],
  consumer: ["clothing", "fashion", "sock", "socks", "shoes", "toy", "toys", "game", "pet", "dog", "cat", "candle", "furniture", "jewelry", "subscription", "beauty", "apparel", "luxury"],
};

// Ties go to the earlier category.
const CATEGORY_PRIORITY = ["climate", "health", "food", "hardware", "marketplace", "software", "consumer"];

const CATEGORY_ICONS = {
  climate: "wave",
  health: "heart",
  food: "bowl",
  hardware: "chip",
  marketplace: "store",
  software: "chart",
  consumer: "spark",
};

// [min, max] ranges per category; traits are 0..1.
const CATEGORY_PROFILES = {
  hardware: {
    price: [79, 349], marginPct: [30, 52], recurring: false, revenue: [40_000, 900_000], growth: [3, 15],
    cac: [30, 90], ltvMultiple: [1.6, 4.2], customerNoun: "customers",
    traits: { novelty: [0.55, 0.85], brand: [0.4, 0.7], risk: [0.58, 0.8], defensibility: [0.35, 0.6], scalability: [0.45, 0.7] },
    ask: [250_000, 400_000, 500_000, 750_000], equity: [8, 10, 12, 15],
  },
  software: {
    price: [19, 99], marginPct: [72, 88], recurring: true, revenue: [20_000, 1_200_000], growth: [5, 22],
    cac: [80, 400], ltvMultiple: [2.5, 9], customerNoun: "paying customers",
    traits: { novelty: [0.35, 0.7], brand: [0.25, 0.5], risk: [0.28, 0.5], defensibility: [0.3, 0.62], scalability: [0.68, 0.9] },
    ask: [150_000, 250_000, 300_000, 500_000], equity: [5, 8, 10, 12],
  },
  food: {
    price: [6, 15], marginPct: [28, 46], recurring: false, revenue: [80_000, 1_500_000], growth: [2, 10],
    cac: [8, 25], ltvMultiple: [2.5, 6], customerNoun: "stores",
    traits: { novelty: [0.35, 0.65], brand: [0.55, 0.85], risk: [0.38, 0.6], defensibility: [0.18, 0.4], scalability: [0.4, 0.6] },
    ask: [100_000, 200_000, 250_000, 350_000], equity: [10, 15, 20, 25],
  },
  consumer: {
    price: [18, 80], marginPct: [45, 70], recurring: false, revenue: [30_000, 800_000], growth: [3, 14],
    cac: [14, 45], ltvMultiple: [2, 5.5], customerNoun: "customers",
    traits: { novelty: [0.45, 0.8], brand: [0.55, 0.88], risk: [0.35, 0.58], defensibility: [0.18, 0.4], scalability: [0.4, 0.68] },
    ask: [75_000, 100_000, 150_000, 250_000], equity: [10, 15, 20, 25],
  },
  marketplace: {
    price: [12, 60], marginPct: [62, 82], recurring: false, revenue: [15_000, 600_000], growth: [6, 25],
    cac: [20, 60], ltvMultiple: [2.2, 7], customerNoun: "active users",
    traits: { novelty: [0.4, 0.75], brand: [0.35, 0.65], risk: [0.45, 0.66], defensibility: [0.4, 0.66], scalability: [0.65, 0.88] },
    ask: [150_000, 250_000, 400_000, 500_000], equity: [8, 10, 12, 15],
  },
  health: {
    price: [25, 120], marginPct: [50, 75], recurring: true, revenue: [25_000, 700_000], growth: [4, 16],
    cac: [35, 120], ltvMultiple: [2, 6], customerNoun: "members",
    traits: { novelty: [0.45, 0.78], brand: [0.45, 0.78], risk: [0.52, 0.75], defensibility: [0.42, 0.7], scalability: [0.5, 0.78] },
    ask: [200_000, 300_000, 500_000, 600_000], equity: [8, 10, 12, 15],
  },
  climate: {
    price: [5_000, 45_000], marginPct: [35, 55], recurring: true, revenue: [0, 300_000], growth: [6, 18],
    cac: [6_000, 25_000], ltvMultiple: [3, 8], customerNoun: "customers",
    traits: { novelty: [0.62, 0.9], brand: [0.5, 0.75], risk: [0.62, 0.85], defensibility: [0.5, 0.78], scalability: [0.6, 0.86] },
    ask: [500_000, 750_000, 1_000_000, 1_500_000], equity: [8, 10, 12, 15],
  },
};

const STOP_WORDS = new Set(
  "a an the and or for of to in on with that this which who your my our their its it is are be by from as at into using use uses like way ways new very just more most really".split(" "),
);

// Words that describe the business shape rather than the product itself.
const GENERIC_WORDS = new Set(
  "ai app apps powered based smart online digital service services platform marketplace subscription company startup business tool tools system systems solution solutions device devices product products thing things people everyone anyone".split(" "),
);

const NAME_SUFFIXES = ["ly", "ify", "io", "hub", "bot", "wise"];
const COMPANY_SUFFIXES = [" Labs", " Studio", " Works", " Technologies", ""];
const FALLBACK_NAMES = ["Moonshot", "Brightside", "Northstar", "Wildcard", "Bluefin", "Riptide"];
const FOUNDER_NAMES = ["Avery", "Jordan", "Sam", "Riley", "Morgan", "Quinn", "Rowan", "Sasha", "Devon", "Ari"];
const FOUNDER_STYLES = ["stubborn", "balanced", "eager"];
const FOUNDER_SUITS = ["#24324f", "#31564c", "#6b2c39", "#444a57", "#674366", "#2f4f86", "#56705a", "#5a4636"];
const FOUNDER_ACCENTS = ["#7ce8c8", "#f5c453", "#ff8bc2", "#86a5ff", "#ff6b57"];

export function normalizeIdea(idea) {
  return String(idea ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?;,:]+$/, "")
    .slice(0, IDEA_MAX_LENGTH)
    .trim();
}

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9']+/g) || [];
}

export function detectCategory(text) {
  const tokens = new Set(tokenize(text));
  let best = "consumer";
  let bestCount = 0;

  for (const category of CATEGORY_PRIORITY) {
    // "AI" shows up in almost every idea, so it only half counts.
    const count = CATEGORY_KEYWORDS[category]
      .filter((keyword) => tokens.has(keyword))
      .reduce((total, keyword) => total + (keyword === "ai" ? 0.5 : 1), 0);

    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }

  return best;
}

function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : "";
}

// Singularizes plurals only ("dresses" -> "dress", "socks" -> "sock"); other words stay whole.
function stem(word) {
  let stemmed = word;

  if (/(ss|sh|ch|x|z)es$/.test(word)) {
    stemmed = word.slice(0, -2);
  } else if (/[^aeiou]ies$/.test(word)) {
    stemmed = `${word.slice(0, -3)}y`;
  } else if (/[^su]s$/.test(word)) {
    stemmed = word.slice(0, -1);
  }

  return stemmed.length >= 3 ? stemmed : word;
}

function buildProductName(idea, rng) {
  const coreWords = tokenize(idea)
    .map((word) => word.replace(/'/g, ""))
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !GENERIC_WORDS.has(word) && !/^\d+$/.test(word));

  // English noun phrases end with the head noun, so the last two words name the product best.
  if (coreWords.length >= 2) {
    const [first, second] = coreWords.slice(-2);
    return capitalize(stem(first)) + capitalize(stem(second));
  }

  if (coreWords.length === 1) {
    return capitalize(stem(coreWords[0])) + rng.pick(NAME_SUFFIXES);
  }

  return rng.pick(FALLBACK_NAMES);
}

function withArticle(phrase) {
  if (/^(a|an|the)\s/i.test(phrase)) {
    return phrase[0].toLowerCase() + phrase.slice(1);
  }

  const first = phrase[0] || "";
  const startsWithAcronym = /^[A-Z]{2,}/.test(phrase);
  const article = /[aeiou]/i.test(first) && !startsWithAcronym ? "an" : "a";
  const body = startsWithAcronym ? phrase : phrase[0].toLowerCase() + phrase.slice(1);
  return `${article} ${body}`;
}

function sentenceCase(phrase) {
  return phrase ? phrase[0].toUpperCase() + phrase.slice(1) : phrase;
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

function between(rng, [min, max]) {
  return rng.float(min, max);
}

function boostTraits(traits, tokens) {
  const boosted = { ...traits };

  if (["ai", "robot", "quantum", "smart", "agent"].some((word) => tokens.has(word))) {
    boosted.novelty = clamp(boosted.novelty + 0.08);
  }

  if (["luxury", "premium", "fashion", "apparel", "designer"].some((word) => tokens.has(word))) {
    boosted.brand = clamp(boosted.brand + 0.1);
  }

  if (["subscription", "monthly", "recurring"].some((word) => tokens.has(word))) {
    boosted.scalability = clamp(boosted.scalability + 0.05);
  }

  return boosted;
}

export function createIdeaPitch(rawIdea, seed = 1) {
  const idea = normalizeIdea(rawIdea);

  if (!idea) {
    throw new Error("Describe a startup idea before rolling the cameras.");
  }

  const rng = createRng("idea", idea.toLowerCase(), seed);
  const category = detectCategory(idea);
  const profile = CATEGORY_PROFILES[category];
  const tokens = new Set(tokenize(idea));
  const productName = buildProductName(idea, rng);
  const startupName = `${productName}${rng.pick(COMPANY_SUFFIXES)}`;
  const concept = withArticle(idea);

  const priceUsd = profile.price[1] > 1000 ? roundTo(between(rng, profile.price), 500) : Math.round(between(rng, profile.price));
  const marginPct = between(rng, profile.marginPct);
  const unitCostUsd = Math.round(priceUsd * (1 - marginPct / 100) * 100) / 100;
  const revenueTtmUsd = roundTo(between(rng, profile.revenue), 1_000);
  const growthMoMPct = Math.round(between(rng, profile.growth));
  const cacUsd = Math.round(between(rng, profile.cac));
  const ltvUsd = Math.round(cacUsd * between(rng, profile.ltvMultiple));
  const averageRevenuePerCustomer = profile.recurring ? priceUsd * 12 : priceUsd * 1.6;
  const customers = Math.max(3, roundTo(revenueTtmUsd / Math.max(averageRevenuePerCustomer, 1), 10));
  const priceLabel = profile.recurring
    ? priceUsd >= 1000
      ? `$${priceUsd.toLocaleString("en-US")} a year`
      : `$${priceUsd} a month`
    : `$${priceUsd}`;

  const traits = boostTraits(
    Object.fromEntries(Object.entries(profile.traits).map(([key, range]) => [key, Number(between(rng, range).toFixed(2))])),
    tokens,
  );

  const customerNoun = profile.customerNoun;
  const customersLabel = customers.toLocaleString("en-US");
  const proofPoint =
    revenueTtmUsd > 0
      ? rng.pick([
          `We already have ${customersLabel} ${customerNoun}, and most of them found us by word of mouth.`,
          `${customersLabel} ${customerNoun} are using it today, and they keep telling their friends.`,
        ])
      : "We're pre-revenue, but our waitlist filled up in a week.";

  return {
    id: `idea-${hashString(idea.toLowerCase()).toString(36).slice(0, 8)}`,
    custom: true,
    idea,
    startupName,
    productName,
    tagline: `${sentenceCase(idea)}.`,
    title: rng.pick([
      `Can ${productName} Survive the Tank?`,
      `${productName} Swims With the Sharks`,
      `The ${productName} Gamble`,
    ]),
    category,
    icon: CATEGORY_ICONS[category],
    askUsd: rng.pick(profile.ask),
    equityPct: rng.pick(profile.equity),
    metrics: {
      revenueTtmUsd,
      growthMoMPct,
      priceUsd,
      priceLabel,
      unitCostUsd,
      recurring: profile.recurring,
      customers,
      customerNoun,
      cacUsd,
      ltvUsd,
    },
    traits,
    story: {
      problem: rng.pick([
        `Everyone we talked to wanted ${concept}. Nobody had built one they actually liked.`,
        `Right now, nobody has nailed ${concept}. What's out there is clunky, expensive, or both.`,
      ]),
      howItWorks: `${productName} is ${concept}, built so simply that customers get it in seconds.`,
      proofPoint,
      moat: rng.pick([
        `We've spent two years learning what customers actually want from ${concept}, and that know-how is hard to copy.`,
        `We're first to market, and every new customer makes ${productName} better for the next one.`,
      ]),
      objection: rng.pick([
        `We've kept costs lean from day one, and every dollar you invest goes into growth, not overhead.`,
        `We started small on purpose, so every problem we hit, we've already solved.`,
      ]),
      vision: `${productName} starts as ${concept}. In five years, it's the name everyone thinks of in this space.`,
      customer: `Our customer is anyone who has wished for ${concept}`,
      brandStory: "and once they try it, they become our best salespeople.",
      weakness: `Nobody has proven that people will pay for ${concept} at scale`,
      cta: `bet on ${productName}`,
    },
    founder: {
      name: rng.pick(FOUNDER_NAMES),
      style: rng.pick(FOUNDER_STYLES),
      suit: rng.pick(FOUNDER_SUITS),
      accent: rng.pick(FOUNDER_ACCENTS),
    },
  };
}
