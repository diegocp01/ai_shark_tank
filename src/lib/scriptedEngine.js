// The scripted episode engine. Given a pitch and a seed it simulates the whole
// show (cold open, pitch, Q&A, offers, negotiation, verdict) and returns a
// self-contained episode script the browser plays back. It is fully
// deterministic: no clocks, no network, no model calls.

import {
  clamp,
  formatMoneyShort,
  formatMoneySpoken,
  formatOfferFull,
  formatPercent,
  formatValuationSpoken,
  impliedValuation,
  roundHalf,
} from "../shared/format.js";
import { applyBeat, createBoard } from "../shared/board.js";
import { buildFeasibilityReport } from "./feasibility.js";
import { createIdeaPitch } from "./ideaPitch.js";
import { CATEGORY_LABELS, getPresetPitch } from "./pitchCatalog.js";
import { createRng } from "./rng.js";
import { computeFactors, grossMarginPct, scoreShark, strongestFactorFor, weakestFactorFor } from "./scoring.js";
import { SHARK_PROFILES, toPublicShark } from "./sharkProfiles.js";

export const EPISODE_SCHEMA_VERSION = 2;
export const DEFAULT_SEED = 1;
export const MAX_SEED = 999_999;

export const PHASES = [
  { id: "intro", label: "Cold open" },
  { id: "pitch", label: "Pitch" },
  { id: "grill", label: "Q&A" },
  { id: "offers", label: "Offers" },
  { id: "negotiation", label: "Negotiation" },
  { id: "verdict", label: "Verdict" },
];

const COUNT_WORDS = { 2: "two", 3: "three", 4: "four", 5: "five" };
const WALKAWAY_MULTIPLIER = { stubborn: 1.5, balanced: 1.85, eager: 2.4 };

export function normalizeSeed(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_SEED;
  }

  const seed = Number(value);

  if (!Number.isInteger(seed) || seed < 1 || seed > MAX_SEED) {
    throw new Error(`Seed must be a whole number between 1 and ${MAX_SEED}.`);
  }

  return seed;
}

export function resolvePitch({ pitchId, idea, seed = DEFAULT_SEED } = {}) {
  if (typeof idea === "string" && idea.trim()) {
    return createIdeaPitch(idea, seed);
  }

  const pitch = getPresetPitch(pitchId);

  if (!pitch) {
    throw new Error(pitchId ? `Unknown pitch "${pitchId}".` : "Pick a pitch or describe your own idea.");
  }

  return pitch;
}

function callName(profile) {
  return profile.displayName.split(" ").pop();
}

function lowerFirst(text) {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

function listNames(names) {
  if (names.length <= 1) {
    return names[0] || "";
  }

  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function formatUnitCost(value) {
  if (value < 100 && !Number.isInteger(value)) {
    return `$${value.toFixed(2)}`;
  }

  return formatMoneySpoken(value);
}

function buildContext(pitch, factors) {
  const { metrics } = pitch;
  const askValuationUsd = impliedValuation(pitch.askUsd, pitch.equityPct);
  const ratio = metrics.cacUsd ? metrics.ltvUsd / metrics.cacUsd : 0;

  return {
    startup: pitch.startupName,
    product: pitch.productName,
    founder: pitch.founder.name,
    ask: formatMoneySpoken(pitch.askUsd),
    askEq: formatPercent(pitch.equityPct),
    askVal: formatValuationSpoken(askValuationUsd),
    askValuationUsd,
    revenue: formatMoneySpoken(metrics.revenueTtmUsd),
    hasRevenue: metrics.revenueTtmUsd > 0,
    growth: `${metrics.growthMoMPct}%`,
    price: metrics.priceLabel,
    unitCost: formatUnitCost(metrics.unitCostUsd),
    margin: `${grossMarginPct(metrics)}%`,
    cac: formatMoneySpoken(metrics.cacUsd),
    ltv: formatMoneySpoken(metrics.ltvUsd),
    ratio: ratio >= 10 ? String(Math.round(ratio)) : ratio.toFixed(1),
    customers: `${metrics.customers.toLocaleString("en-US")} ${metrics.customerNoun}`,
    story: pitch.story,
    factors,
  };
}

function createScript(pitch) {
  const beats = [];
  const founderName = pitch.founder.name;

  function speakerMeta(speakerId) {
    if (speakerId === "narrator") {
      return { speakerName: "Narrator", speakerRole: "Studio" };
    }

    if (speakerId === "founder") {
      return { speakerName: founderName, speakerRole: `Founder, ${pitch.startupName}` };
    }

    const profile = SHARK_PROFILES.find((shark) => shark.id === speakerId);
    return { speakerName: profile.displayName, speakerRole: profile.persona };
  }

  return {
    beats,
    say(speakerId, kind, phase, text, { effects = [], targetId = null, tone = null } = {}) {
      beats.push({
        id: `b${String(beats.length + 1).padStart(2, "0")}`,
        index: beats.length,
        phase,
        kind,
        speakerId,
        ...speakerMeta(speakerId),
        targetId,
        tone,
        text,
        effects,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Q&A

// How much each shark wants to ask about a topic (higher = more likely). Each
// topic is asked at most once per episode so answers never repeat.
const QUESTION_TOPICS = {
  rex: (factors) => ({
    traction: 1 - factors.traction,
    defensibility: 1 - factors.defensibility,
    risk: factors.risk,
  }),
  luna: (factors) => ({
    vision: factors.novelty,
    scale: factors.scalability,
    brand: 0.3,
  }),
  max: (factors) => ({
    unitEconomics: 1 - factors.unitEconomics,
    margin: 1 - factors.margin,
    traction: 1 - factors.traction,
  }),
  vera: (factors) => ({
    brand: 0.6 + factors.brand * 0.2,
    margin: 1 - factors.margin,
  }),
};

function pickTopic(profile, factors, usedTopics, rng) {
  let best = null;
  let bestValue = -Infinity;

  for (const [topic, value] of Object.entries(QUESTION_TOPICS[profile.id](factors))) {
    const covered = usedTopics.has(topic) || (["vision", "scale"].includes(topic) && (usedTopics.has("vision") || usedTopics.has("scale")));
    const jittered = value + rng.float(0, 0.15) - (covered ? 10 : 0);

    if (jittered > bestValue) {
      best = topic;
      bestValue = jittered;
    }
  }

  return best;
}

function questionLines(profile, topic, ctx) {
  const { startup, product, askVal, revenue, hasRevenue, story } = ctx;
  const banks = {
    rex: {
      traction: hasRevenue
        ? [
            `You want ${askVal} for a company doing ${revenue} a year. Convince me that isn't a fantasy.`,
            `${revenue} in sales, and you want a ${askVal} valuation? Walk me through that math.`,
          ]
        : [`You have no sales, and you want ${askVal}? Why should I believe anyone will pay for this?`],
      defensibility: [
        "What stops a company with a hundred times your money from copying this by Christmas?",
        "Say a giant shows up tomorrow with the same thing at half the price. What happens to you?",
      ],
      risk: [`${story.weakness}. Why isn't that fatal?`, `Here's my problem: ${lowerFirst(story.weakness)}. Talk me out of it.`],
    },
    luna: {
      vision: [
        `Forget this year. What does ${startup} look like in ten years?`,
        `Paint me the future. If everything goes right, what is ${startup} in a decade?`,
      ],
      scale: [`Is ${product} a product, or the first step of a platform?`, "How big can this get? I don't invest in small dreams."],
      brand: ["Who falls in love with this first?"],
    },
    max: {
      unitEconomics: [
        "What does it cost you to acquire a customer, and what is that customer worth?",
        "Give me your acquisition cost and your lifetime value. No adjectives, just numbers.",
      ],
      margin: [
        "Walk me through the unit economics. What does it cost you, and what do you sell it for?",
        "What's your gross margin? And don't round up.",
      ],
      traction: ["What were your sales in the last twelve months, and how fast are they growing?"],
    },
    vera: {
      brand: [
        `Who is your customer, and what does owning ${product} say about them?`,
        "Tell me about your customer. Who are they, and why do they care?",
      ],
      margin: ["Premium brands need premium margins. What's yours?"],
    },
  };

  return banks[profile.id][topic];
}

function answerLine(topic, ctx, pitch) {
  const { story } = ctx;

  switch (topic) {
    case "traction":
      return ctx.hasRevenue
        ? `We did ${ctx.revenue} in the last twelve months, we're growing ${ctx.growth} month over month, and we have ${ctx.customers}.`
        : `${story.proofPoint} Revenue starts the day we ship.`;
    case "margin":
      return pitch.metrics.recurring
        ? `We charge ${ctx.price}, and it costs us about ${ctx.unitCost} to serve. That's a ${ctx.margin} gross margin.`
        : `Each one costs us ${ctx.unitCost} to make, and we sell it for ${ctx.price}. That's a ${ctx.margin} gross margin, and it improves with volume.`;
    case "unitEconomics":
      return `It costs us about ${ctx.cac} to land a customer, and they're worth ${ctx.ltv} over their lifetime. That's ${ctx.ratio} to one.`;
    case "defensibility":
      return story.moat;
    case "risk":
      return story.objection;
    case "vision":
    case "scale":
      return story.vision;
    case "brand":
    default:
      return `${story.customer}, ${story.brandStory}`;
  }
}

function wildcardExchange(ctx, rng) {
  const { startup, product, customers, ask } = ctx;

  return rng.pick([
    {
      question: `Forget the numbers. If ${startup} were a dinosaur, which dinosaur would it be?`,
      answer: `A velociraptor, Wes. Small, fast, and it hunts in packs, just like our ${customers}.`,
    },
    {
      question: `Can ${product} be made louder? Like, a lot louder?`,
      answer: "Anything can be louder, Wes. Right now it's exactly loud enough to sell out.",
    },
    {
      question: "Would you sell me the whole company right now for a jet ski and a handshake?",
      answer: `Only if it's a very nice jet ski. And the handshake comes with ${ask}.`,
    },
    {
      question: `What's the weirdest thing a customer has ever done with ${product}?`,
      answer: "Someone used it in a marriage proposal. They said yes, so I'm counting it as a five-star review.",
    },
    {
      question: "Quick, sing me your jingle.",
      answer: `${product}, ${product}, it's all you need... I'll write the second verse with whoever invests.`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Offers

const STRENGTH_PHRASES = {
  traction: "your sales",
  margin: "your margins",
  unitEconomics: "your customer math",
  defensibility: "your moat",
  novelty: "the idea",
  scalability: "the size of this market",
  brand: "the brand",
};

const TOPIC_NOUNS = {
  traction: "your sales",
  margin: "your margins",
  unitEconomics: "your customer costs",
  defensibility: "copycats",
  risk: "the risk",
};

function outReason(factor, isActuallyWeak, ctx, rng, askedTopic) {
  if (isActuallyWeak && askedTopic === factor && TOPIC_NOUNS[factor]) {
    return `I asked you about ${TOPIC_NOUNS[factor]}, and I'm still not convinced.`;
  }

  if (!isActuallyWeak) {
    return rng.pick([
      "I like you, and I like the business. I just don't love it at this price.",
      "It's close for me, but close doesn't get my money.",
    ]);
  }

  switch (factor) {
    case "traction":
      return ctx.hasRevenue
        ? `You're asking ${ctx.askVal} for a company doing ${ctx.revenue} a year.`
        : "There are no sales yet, just a good story.";
    case "margin":
      return `At a ${ctx.margin} margin, there's not enough left over for anybody.`;
    case "unitEconomics":
      return Number(ctx.ratio) < 2
        ? `You spend ${ctx.cac} to win a customer worth ${ctx.ltv}. That math eats companies alive.`
        : `${ctx.ratio} to one on every customer isn't enough for me at this valuation.`;
    case "defensibility":
      return "Nothing here stops a bigger company from copying you.";
    case "risk":
      return `${ctx.story.weakness}.`;
    case "novelty":
      return "I've seen this idea before, and I didn't buy it then either.";
    case "scalability":
      return "It's a nice business, but I don't see it ever getting big.";
    case "brand":
    default:
      return "I can't picture anyone wearing this brand proudly.";
  }
}

const OUT_SIGNOFFS = {
  rex: ["For that reason, I'm out.", "I'm out."],
  luna: ["I hope you prove me wrong, but I'm out.", "I want to believe, but I'm out."],
  max: ["The numbers don't work for me. I'm out.", "I'm out."],
  vera: ["So for me, it's a no. I'm out.", "I'm out."],
  wes: [
    "My gut says no, and my gut has never been wrong. Okay, it's been wrong a lot. Still out.",
    "I'd invest in your energy, but not in this company. I'm out.",
  ],
};

function buildKicker(profile, pitch, rng) {
  if (profile.id === "max" && rng.chance(0.65)) {
    if (pitch.metrics.recurring) {
      return {
        label: "plus a 3% revenue royalty until Max recoups",
        short: "3% royalty",
        spoken: ", plus a three percent revenue royalty until I'm paid back",
      };
    }

    const royalty = Math.max(1, Math.round(pitch.metrics.priceUsd * 0.06));
    return {
      label: `plus a $${royalty} per-unit royalty until Max recoups`,
      short: `$${royalty}/unit royalty`,
      spoken: `, plus a royalty of $${royalty} a unit until I get my money back`,
    };
  }

  if (profile.id === "wes" && rng.chance(0.35)) {
    return {
      label: "plus a cameo for Wes in the first commercial",
      short: "cameo",
      spoken: ", and I get a cameo in your first commercial",
    };
  }

  return null;
}

function offerLine(profile, offer, ctx, strongest, rng) {
  const cash = formatMoneySpoken(offer.cashUsd);
  const eq = formatPercent(offer.equityPct);
  const kicker = offer.kicker?.spoken || "";
  const strength = STRENGTH_PHRASES[strongest] || "what you've built";

  const lines = {
    rex: [`I don't like much, but I like ${strength}. I'll give you ${cash} for ${eq}.`, `Against my better judgment: ${cash} for ${eq}.`],
    luna: [
      `I can see the future of this, and I want to be in it. ${cash} for ${eq}.`,
      `This could be a whole new category. I'll offer ${cash} for ${eq}.`,
    ],
    max: [`Here's my offer: ${cash} for ${eq}${kicker}.`, `The numbers work. ${cash} for ${eq}${kicker}. That's a real offer.`],
    vera: [
      `I can make ${ctx.product} iconic. ${cash} for ${eq}, and I build the brand with you.`,
      `I see a brand people will wear like a badge. ${cash} for ${eq}.`,
    ],
    wes: [`I'm feeling dangerous. ${cash} for ${eq}${kicker}!`, `Nobody else gets it, but I do. ${cash} for ${eq}${kicker}!`],
  };

  return rng.pick(lines[profile.id]);
}

function evaluateShark(profile, pitch, factors, rng) {
  const score = scoreShark(profile, factors, rng.fork(`score:${profile.id}`));
  const interested = score >= profile.threshold;
  const enthusiasm = clamp((score - profile.threshold) / (1 - profile.threshold));

  if (!interested) {
    return { profile, score, enthusiasm: 0, offer: null, minEquityPct: null };
  }

  const askValuation = impliedValuation(pitch.askUsd, pitch.equityPct);
  const offerValuation = askValuation * (0.55 + 0.45 * enthusiasm);
  const maxEquityPct = Math.min(60, pitch.equityPct + 18);
  const equityPct = roundHalf(clamp((pitch.askUsd / offerValuation) * 100, pitch.equityPct, maxEquityPct));
  const minEquityPct = roundHalf(clamp(equityPct * (0.84 - 0.2 * enthusiasm), pitch.equityPct, equityPct));

  return {
    profile,
    score,
    enthusiasm,
    offer: {
      cashUsd: pitch.askUsd,
      equityPct,
      kicker: buildKicker(profile, pitch, rng.fork(`kicker:${profile.id}`)),
    },
    minEquityPct,
  };
}

// ---------------------------------------------------------------------------
// Negotiation lines

const ACCEPT_COUNTER_LINES = {
  rex: (eq, cash) => `Fine. You've earned it. ${cash} for ${eq}.`,
  luna: (eq) => `Yes. Let's build the future together. ${eq} it is.`,
  max: (eq) => `The math still works at ${eq}. Done.`,
  vera: (eq) => `I like your confidence. ${eq} it is.`,
  wes: (eq) => `Ha! ${eq}! Somebody get me a confetti cannon!`,
};

function withEquity(offer, equityPct) {
  return { ...offer, equityPct };
}

function runNegotiation({ script, pitch, ctx, offers, rng }) {
  const say = script.say;
  const askEq = pitch.equityPct;
  const founderStyle = pitch.founder.style;
  const walkawayEq = roundHalf(clamp(askEq * (WALKAWAY_MULTIPLIER[founderStyle] ?? 2), askEq + 3, 45));

  if (offers.length === 0) {
    say(
      "founder",
      "decline",
      "negotiation",
      rng.pick([
        `Thank you, Sharks. You haven't heard the last of ${ctx.startup}.`,
        "I appreciate your time, Sharks. Watch this space.",
      ]),
      { effects: [{ type: "no_deal" }], tone: "no-deal" },
    );
    return { outcome: "no_deal", lead: null, declinedOffer: null };
  }

  let lead;

  if (offers.length >= 2) {
    const [first, second] = [...offers].sort((a, b) => b.score - a.score);
    const teamUp = Math.abs(first.offer.equityPct - second.offer.equityPct) <= 4 && rng.chance(0.45);

    if (teamUp) {
      const names = [callName(first.profile), callName(second.profile)];
      const teamOffer = {
        cashUsd: pitch.askUsd,
        equityPct: roundHalf(Math.min(60, Math.max(first.offer.equityPct, second.offer.equityPct) + 2)),
        kicker: null,
      };

      say("founder", "ask", "negotiation", `${names[0]}, ${names[1]}: would you two go in together?`, {
        targetId: first.profile.id,
      });
      say(
        first.profile.id,
        "team",
        "negotiation",
        `If ${names[1]} is in, I'm in. Together, ${formatMoneySpoken(teamOffer.cashUsd)} for ${formatPercent(teamOffer.equityPct)}.`,
        {
          effects: [{ type: "team", sharkIds: [first.profile.id, second.profile.id], offer: teamOffer }],
          targetId: "founder",
          tone: "offer",
        },
      );
      say(second.profile.id, "team", "negotiation", rng.pick(["Let's do it. Partners.", "I'm in. The two of us will make this huge."]), {
        targetId: "founder",
      });

      lead = {
        profiles: [first.profile, second.profile],
        offer: teamOffer,
        minEquityPct: roundHalf(Math.min(teamOffer.equityPct, Math.max(first.minEquityPct, second.minEquityPct) + 1)),
      };
    } else {
      let best = [...offers].sort((a, b) => a.offer.equityPct - b.offer.equityPct || b.score - a.score)[0];

      say(
        "founder",
        "ask",
        "negotiation",
        `I've got ${COUNT_WORDS[offers.length] || offers.length} offers on the table. Before I decide: can anyone do better than ${formatPercent(best.offer.equityPct)}?`,
      );

      const rivals = offers
        .filter((entry) => entry !== best)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      for (const rival of rivals) {
        if (rival.minEquityPct < best.offer.equityPct - 0.4) {
          const step = rng.pick([0.5, 1, 1.5, 2]);
          const equityPct = roundHalf(Math.max(rival.minEquityPct, best.offer.equityPct - step));
          rival.offer = withEquity(rival.offer, equityPct);
          say(
            rival.profile.id,
            "bid",
            "negotiation",
            rng.pick([
              `I'll beat that. ${formatMoneySpoken(rival.offer.cashUsd)} for ${formatPercent(equityPct)}${rival.offer.kicker?.spoken || ""}.`,
              `Then I'll go to ${formatPercent(equityPct)}. Same money.`,
            ]),
            {
              effects: [{ type: "revise", sharkId: rival.profile.id, offer: rival.offer }],
              targetId: "founder",
              tone: "offer",
            },
          );
          best = rival;
        } else {
          say(
            rival.profile.id,
            "hold",
            "negotiation",
            rng.pick([
              `I'm not getting into a bidding war. My ${formatPercent(rival.offer.equityPct)} stands.`,
              `${formatPercent(rival.offer.equityPct)} is where I live. I'm not going lower.`,
            ]),
            { targetId: "founder" },
          );
        }
      }

      lead = { profiles: [best.profile], offer: best.offer, minEquityPct: best.minEquityPct };
    }
  } else {
    const [only] = offers;
    lead = { profiles: [only.profile], offer: only.offer, minEquityPct: only.minEquityPct };
  }

  const leadIds = lead.profiles.map((profile) => profile.id);
  const leadNames = lead.profiles.map(callName);
  const leadLabel = listNames(leadNames);
  const isTeam = lead.profiles.length > 1;
  const cash = formatMoneySpoken(lead.offer.cashUsd);
  const dealLine = (offer) =>
    say(
      "founder",
      "accept",
      "negotiation",
      isTeam ? `${leadLabel}: you've got a deal!` : rng.pick([`${leadLabel}, you've got a deal!`, `Deal! Thank you, ${leadLabel}!`]),
      {
        effects: [{ type: "deal", sharkIds: leadIds, offer }],
        targetId: leadIds[0],
        tone: "deal",
      },
    );

  if (lead.offer.equityPct <= askEq + 0.5) {
    say("founder", "accept", "negotiation", `${leadLabel}, that's basically my ask. You've got a deal!`, {
      effects: [{ type: "deal", sharkIds: leadIds, offer: lead.offer }],
      targetId: leadIds[0],
      tone: "deal",
    });
    return { outcome: "deal", lead: { ...lead, offer: lead.offer }, declinedOffer: null };
  }

  let counterEq = roundHalf(Math.max(askEq, (askEq + lead.offer.equityPct) / 2));

  if (counterEq >= lead.offer.equityPct) {
    counterEq = lead.offer.equityPct - 0.5;
  }

  const counterOffer = withEquity(lead.offer, counterEq);
  const offerVal = formatValuationSpoken(impliedValuation(lead.offer.cashUsd, lead.offer.equityPct));

  say(
    "founder",
    "counter",
    "negotiation",
    isTeam
      ? `That's a dream team. But ${formatPercent(lead.offer.equityPct)} is a lot. Would you two do ${cash} for ${formatPercent(counterEq)}?`
      : rng.pick([
          `${leadLabel}, I love it, but that values ${ctx.startup} at ${offerVal}. I came in at ${ctx.askVal}. Would you do ${cash} for ${formatPercent(counterEq)}?`,
          `I'm honored, ${leadLabel}. But ${formatPercent(lead.offer.equityPct)} is a lot of my company. Can you do ${formatPercent(counterEq)}?`,
        ]),
    {
      effects: [{ type: "counter", sharkIds: leadIds, offer: counterOffer }],
      targetId: leadIds[0],
      tone: "counter",
    },
  );

  const responder = lead.profiles[0];

  if (counterEq >= lead.minEquityPct) {
    say(responder.id, "accept-counter", "negotiation", ACCEPT_COUNTER_LINES[responder.id](formatPercent(counterEq), cash), {
      targetId: "founder",
      tone: "offer",
    });
    dealLine(counterOffer);
    return { outcome: "deal", lead: { ...lead, offer: counterOffer }, declinedOffer: null };
  }

  const midpoint = roundHalf((counterEq + lead.offer.equityPct) / 2);
  const finalEq = Math.min(lead.offer.equityPct, Math.max(midpoint, lead.minEquityPct));
  const finalOffer = withEquity(lead.offer, finalEq);

  if (finalEq < lead.offer.equityPct) {
    say(
      responder.id,
      "revise",
      "negotiation",
      rng.pick([
        `I'll meet you in the middle: ${cash} for ${formatPercent(finalEq)}. That's my final offer.`,
        `Let's split the difference. ${formatPercent(finalEq)}, and not a point lower.`,
      ]),
      {
        effects: [{ type: "revise", sharkIds: leadIds, offer: finalOffer }],
        targetId: "founder",
        tone: "offer",
      },
    );
  } else {
    say(
      responder.id,
      "hold",
      "negotiation",
      rng.pick([
        `I'm not moving. ${formatPercent(finalEq)}, or I'm out.`,
        `That's my number: ${formatPercent(finalEq)}. Take it or leave it.`,
      ]),
      { targetId: "founder" },
    );
  }

  if (finalEq <= walkawayEq) {
    dealLine(finalOffer);
    return { outcome: "deal", lead: { ...lead, offer: finalOffer }, declinedOffer: null };
  }

  say(
    "founder",
    "decline",
    "negotiation",
    rng.pick([
      `I believe in ${ctx.startup} too much to give up ${formatPercent(finalEq)}. I have to say no.`,
      `With respect, ${formatPercent(finalEq)} is too much. I'm going to walk.`,
    ]),
    { effects: [{ type: "no_deal" }], targetId: leadIds[0], tone: "no-deal" },
  );
  return { outcome: "no_deal", lead, declinedOffer: finalOffer };
}

// ---------------------------------------------------------------------------
// Episode assembly

function buildResult(pitch, negotiation, ctx) {
  const askValuationUsd = ctx.askValuationUsd;

  if (negotiation.outcome !== "deal") {
    return {
      outcome: "no_deal",
      dealType: "No Deal",
      sharkIds: [],
      investors: [],
      offer: null,
      valuationUsd: null,
      askValuationUsd,
      termsLabel: "No deal",
      headline: `${pitch.startupName} leaves without a deal`,
      declinedOffer: negotiation.declinedOffer,
      declinedFrom: negotiation.declinedOffer ? negotiation.lead.profiles.map((profile) => profile.id) : [],
    };
  }

  const { lead } = negotiation;
  const names = listNames(lead.profiles.map((profile) => profile.displayName));

  return {
    outcome: "deal",
    dealType: lead.profiles.length > 1 ? "Multi-Shark Deal" : "Deal",
    sharkIds: lead.profiles.map((profile) => profile.id),
    investors: lead.profiles.map((profile) => profile.fullName),
    offer: lead.offer,
    valuationUsd: impliedValuation(lead.offer.cashUsd, lead.offer.equityPct),
    askValuationUsd,
    termsLabel: formatOfferFull(lead.offer),
    headline: `${names} ${lead.profiles.length > 1 ? "invest" : "invests"} in ${pitch.startupName}`,
    declinedOffer: null,
    declinedFrom: [],
  };
}

function verdictLine(result, ctx, rng) {
  if (result.outcome === "deal") {
    const delta = result.valuationUsd / result.askValuationUsd - 1;
    const comparison =
      Math.abs(delta) < 0.005
        ? ", exactly what they asked for"
        : `, ${Math.round(Math.abs(delta) * 100)}% ${delta < 0 ? "under" : "over"} the ask`;
    const investorNames = listNames(result.sharkIds.map((id) => SHARK_PROFILES.find((shark) => shark.id === id).displayName));
    const kicker = result.offer.kicker ? ` Plus ${result.offer.kicker.label.replace(/^plus /, "")}.` : "";

    return `${ctx.startup} leaves the tank with ${formatMoneySpoken(result.offer.cashUsd)} for ${formatPercent(result.offer.equityPct)} from ${investorNames}. That values the company at ${formatValuationSpoken(result.valuationUsd)}${comparison}.${kicker}`;
  }

  if (result.declinedOffer) {
    return `${ctx.founder} turned down ${formatPercent(result.declinedOffer.equityPct)} and walked out without a deal. Bold move, or big mistake?`;
  }

  return `${ctx.startup} walks out of the tank without a deal. ${rng.pick([
    "Sometimes the water is just too cold.",
    "The sharks circled, but nobody bit.",
    "But something tells us they'll be back.",
  ])}`;
}

function buildSocialCaption(pitch, result) {
  const outcome =
    result.outcome === "deal"
      ? `${listNames(result.sharkIds.map((id) => SHARK_PROFILES.find((shark) => shark.id === id).displayName))} closed at ${formatMoneyShort(result.offer.cashUsd)} for ${formatPercent(result.offer.equityPct)}.`
      : "Nobody closed. The tank stayed hungry.";

  return `I recreated Shark Tank, but every founder and shark is AI. Tonight: ${pitch.startupName}, ${lowerFirst(pitch.tagline)} ${outcome}`;
}

export function createEpisode({ pitchId, idea, seed } = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const pitch = resolvePitch({ pitchId, idea, seed: normalizedSeed });
  const rng = createRng("episode", pitch.id, normalizedSeed);
  const lineRng = rng.fork("lines");
  const factors = computeFactors(pitch);
  const ctx = buildContext(pitch, factors);
  const script = createScript(pitch);
  const { say } = script;

  // 1. Cold open + entrance
  say(
    "narrator",
    "narration",
    "intro",
    lineRng.pick([
      `Tonight in the tank: ${lowerFirst(pitch.tagline)} Five AI sharks are waiting.`,
      `Coming up: an AI founder wants ${ctx.ask} for ${ctx.askEq} of ${ctx.startup}. The water is getting choppy.`,
      `Next into the tank: ${ctx.startup}. Will the sharks bite, or circle and swim away?`,
    ]),
  );
  say("founder", "entrance", "intro", `Hi, Sharks. I'm ${ctx.founder}, and I'm the founder of ${ctx.startup}.`);

  // 2. Pitch
  say("founder", "pitch", "pitch", `I'm seeking ${ctx.ask} in exchange for ${ctx.askEq} of my company. ${ctx.story.problem} ${ctx.story.howItWorks}`);
  say("founder", "pitch", "pitch", `${ctx.story.proofPoint} So, Sharks: who's ready to ${ctx.story.cta}?`);

  // 3. Q&A, in a seeded order
  const usedTopics = new Set();
  const askedTopicBy = {};

  for (const profile of rng.fork("question-order").shuffle(SHARK_PROFILES)) {
    const topicRng = rng.fork(`topic:${profile.id}`);
    let question;
    let answer;

    if (profile.id === "wes") {
      ({ question, answer } = wildcardExchange(ctx, topicRng));
    } else {
      const topic = pickTopic(profile, factors, usedTopics, topicRng);
      usedTopics.add(topic);
      askedTopicBy[profile.id] = topic;
      question = topicRng.pick(questionLines(profile, topic, ctx));
      answer = answerLine(topic, ctx, pitch);
    }

    say(profile.id, "question", "grill", question, { targetId: "founder" });
    say("founder", "answer", "grill", answer, { targetId: profile.id });
  }

  // 4. Offers: the least interested sharks go out first, building to the offers.
  const seatOrder = new Map(SHARK_PROFILES.map((profile, index) => [profile.id, index]));
  const evaluations = SHARK_PROFILES.map((profile) => evaluateShark(profile, pitch, factors, rng)).sort(
    (a, b) => a.score - b.score || seatOrder.get(a.profile.id) - seatOrder.get(b.profile.id),
  );

  for (const evaluation of evaluations) {
    const { profile } = evaluation;

    if (evaluation.offer) {
      const strongest = strongestFactorFor(profile, factors);
      say(profile.id, "offer", "offers", offerLine(profile, evaluation.offer, ctx, strongest, lineRng), {
        effects: [{ type: "offer", sharkId: profile.id, offer: evaluation.offer }],
        targetId: "founder",
        tone: "offer",
      });
    } else {
      const { factor, isActuallyWeak } = weakestFactorFor(profile, factors);
      const reason = outReason(factor, isActuallyWeak, ctx, lineRng, askedTopicBy[profile.id]);
      say(profile.id, "out", "offers", `${reason} ${lineRng.pick(OUT_SIGNOFFS[profile.id])}`, {
        effects: [{ type: "out", sharkId: profile.id }],
        targetId: "founder",
        tone: "out",
      });
    }
  }

  // 5. Negotiation
  const negotiation = runNegotiation({
    script,
    pitch,
    ctx,
    offers: evaluations.filter((evaluation) => evaluation.offer),
    rng: rng.fork("negotiation"),
  });

  // 6. Verdict
  const result = buildResult(pitch, negotiation, ctx);
  say("narrator", "verdict", "verdict", verdictLine(result, ctx, lineRng), {
    tone: result.outcome === "deal" ? "deal" : "no-deal",
  });

  const episode = {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id: `${pitch.id}-s${normalizedSeed}`,
    seed: normalizedSeed,
    provider: "scripted",
    title: pitch.title,
    phases: PHASES,
    pitch: {
      id: pitch.id,
      custom: Boolean(pitch.custom),
      idea: pitch.idea || null,
      startupName: pitch.startupName,
      productName: pitch.productName,
      tagline: pitch.tagline,
      category: pitch.category,
      categoryLabel: CATEGORY_LABELS[pitch.category],
      icon: pitch.icon,
      askUsd: pitch.askUsd,
      equityPct: pitch.equityPct,
      valuationUsd: ctx.askValuationUsd,
      metrics: { ...pitch.metrics, grossMarginPct: grossMarginPct(pitch.metrics) },
      founder: { ...pitch.founder },
    },
    sharks: SHARK_PROFILES.map(toPublicShark),
    beats: script.beats,
    result,
    report: buildFeasibilityReport(pitch),
    socialCaption: buildSocialCaption(pitch, result),
  };

  assertEpisodeConsistency(episode);
  return episode;
}

// Replays every effect through the shared board reducer and fails loudly if the
// script and the reported result ever disagree.
export function assertEpisodeConsistency(episode) {
  const board = episode.beats.reduce(applyBeat, createBoard(episode));

  if (!board.outcome || board.outcome.type !== episode.result.outcome) {
    throw new Error(`Episode ${episode.id}: board outcome does not match the result.`);
  }

  if (episode.result.outcome === "deal") {
    const sameSharks = board.outcome.sharkIds.join(",") === episode.result.sharkIds.join(",");
    const sameEquity = board.outcome.offer.equityPct === episode.result.offer.equityPct;

    if (!sameSharks || !sameEquity) {
      throw new Error(`Episode ${episode.id}: deal terms on the board do not match the result.`);
    }
  }

  return board;
}
