import {
  Agent,
  ModelBehaviorError,
  OutputGuardrailTripwireTriggered,
  ToolGuardrailFunctionOutputFactory,
  defineToolInputGuardrail,
  run,
  setDefaultOpenAIKey,
  tool,
} from "@openai/agents";
import { z } from "zod";

import {
  buildArchiveEpisodeFromEpisode,
  buildArchiveEpisodeFromLiveRun,
  recordEpisodeRun,
} from "./allTimeStatsStore.js";
import { createDemoEpisode } from "./demoEpisode.js";
import { SHARK_PROFILES } from "./sharkProfiles.js";

const DEFAULT_EPISODE_COUNT = 1;
const MAX_EPISODE_COUNT = 3;
const AGENT_REASONING_EFFORT = {
  entrepreneur: "low",
  sharkOpening: "low",
  founderCounter: "medium",
  sharkResolution: "medium",
  showrunner: "low",
  founderWardrobe: "low",
  businessFeasibility: "medium",
};

const FOUNDER_TOP_TYPES = ["blazer", "hoodie", "turtleneck", "bomber", "knit_polo"];
const FOUNDER_BOTTOM_TYPES = ["tailored_trousers", "jeans", "wide_leg_trousers", "chinos"];
const FOUNDER_COLOR_PALETTE = {
  midnight_navy: "#24324f",
  soft_ivory: "#ebe3d5",
  charcoal: "#444a57",
  oxblood: "#6b2c39",
  forest_green: "#31564c",
  sand: "#bca486",
  camel: "#9d7650",
  plum: "#674366",
  electric_blue: "#4167b5",
  sage: "#8aa088",
  warm_taupe: "#8f7a6a",
  jet_black: "#191b20",
  clay_red: "#91534b",
};
const FOUNDER_COLOR_NAMES = Object.keys(FOUNDER_COLOR_PALETTE);

const PitchSchema = z.object({
  startupName: z.string().min(2).max(80),
  productName: z.string().min(2).max(80),
  concept: z.string().min(30).max(320),
  askAmountUsd: z.number().int().positive(),
  equityPercent: z.number().positive().max(100),
  founderPitch: z.string().min(80).max(900),
});

const SharkRoundSchema = z.object({
  questionTitle: z.string().min(6).max(90),
  questionLine: z.string().min(20).max(260),
  decision: z.enum(["INVEST", "OUT"]),
  decisionLine: z.string().min(20).max(260),
  rationale: z.string().min(16).max(220),
  offerSummary: z.string().min(10).max(220).nullable(),
});

const FounderCounterSchema = z.object({
  move: z.enum(["ACCEPT", "COUNTER", "DECLINE"]),
  responseLine: z.string().min(20).max(260),
  revisedTermsSummary: z.string().min(8).max(220),
  strategy: z.string().min(12).max(180),
});

const SharkResolutionSchema = z.object({
  finalDecision: z.enum(["DEAL", "OUT"]),
  finalLine: z.string().min(20).max(260),
  finalTermsSummary: z.string().min(8).max(220).nullable(),
  walkAwayReason: z.string().min(12).max(220),
});

const PackagingSchema = z.object({
  episodeTitle: z.string().min(12).max(120),
  posterSlugline: z.string().min(16).max(140),
  openingVoiceover: z.string().min(30).max(280),
  closingVoiceover: z.string().min(30).max(280),
  socialCaption: z.string().min(40).max(800),
  lowerThird: z.string().min(8).max(80),
});

const FounderLookSchema = z.object({
  top: z.object({
    type: z.enum(FOUNDER_TOP_TYPES),
    color: z.enum(FOUNDER_COLOR_NAMES),
  }),
  bottom: z.object({
    type: z.enum(FOUNDER_BOTTOM_TYPES),
    color: z.enum(FOUNDER_COLOR_NAMES),
  }),
});

const BusinessFeasibilitySchema = z.object({
  feasibilityPercent: z.number().int().min(0).max(100),
  isGoodBusiness: z.enum(["yes", "no"]),
  minimumInitialInvestmentUsd: z.number().int().min(0),
  difficulty: z.enum(["easy", "medium", "hard"]),
  timeToFirstRevenue: z.enum(["2 weeks", "1 month", "more than 1 month"]),
  summary: z.string().min(24).max(260),
  biggestRisk: z.string().min(20).max(220),
});

const packagingGuardrail = {
  name: "ai_shark_tank_poster_guardrail",
  async execute({ agentOutput }) {
    const errors = [];

    if (!/\bai\b/i.test(agentOutput.posterSlugline) && !/\bai\b/i.test(agentOutput.socialCaption)) {
      errors.push("The copy must make it obvious that the show is AI-driven.");
    }

    if (!/shark/i.test(agentOutput.posterSlugline) && !/shark/i.test(agentOutput.socialCaption)) {
      errors.push("The copy must clearly read as Shark Tank-inspired.");
    }

    return {
      tripwireTriggered: errors.length > 0,
      outputInfo: { errors },
    };
  },
};

const founderLookGuardrail = {
  name: "founder_look_guardrail",
  async execute({ agentOutput }) {
    const errors = [];

    if (agentOutput.top.color === agentOutput.bottom.color) {
      errors.push("Top and bottom colors should contrast on camera.");
    }

    return buildGuardrailResult(errors);
  },
};

const businessFeasibilityGuardrail = {
  name: "business_feasibility_guardrail",
  async execute({ agentOutput }) {
    const errors = [];

    if (agentOutput.isGoodBusiness === "yes" && agentOutput.feasibilityPercent < 50) {
      errors.push("A 'yes' business should not have a feasibilityPercent below 50.");
    }

    if (agentOutput.isGoodBusiness === "no" && agentOutput.feasibilityPercent > 60) {
      errors.push("A 'no' business should not have a feasibilityPercent above 60.");
    }

    if (
      agentOutput.timeToFirstRevenue === "2 weeks" &&
      (agentOutput.difficulty === "hard" || agentOutput.minimumInitialInvestmentUsd >= 180000)
    ) {
      errors.push("A hard or capital-heavy business should not claim revenue in 2 weeks.");
    }

    return buildGuardrailResult(errors);
  },
};

function getConfiguredModel() {
  return process.env.OPENAI_DEFAULT_MODEL || process.env.SHARK_TANK_OPENAI_MODEL || undefined;
}

function getConfiguredReasoningEffort(defaultEffort) {
  const override = process.env.SHARK_TANK_REASONING_EFFORT?.trim().toLowerCase();

  if (override && ["minimal", "low", "medium", "high"].includes(override)) {
    return override;
  }

  return defaultEffort;
}

function isGpt5Model(modelName) {
  return typeof modelName === "string" && /^gpt-5(?:[.-]|$)/i.test(modelName);
}

function buildModelSettings({
  reasoningEffort,
  temperature,
  toolChoice,
  verbosity = "medium",
}) {
  const modelName = getConfiguredModel();
  const effectiveReasoningEffort = getConfiguredReasoningEffort(reasoningEffort);
  const settings = {
    reasoning: { effort: effectiveReasoningEffort },
    text: { verbosity },
  };

  if (toolChoice) {
    settings.toolChoice = toolChoice;
  }

  if (temperature != null && !isGpt5Model(modelName)) {
    settings.temperature = temperature;
  }

  return settings;
}

function ensureOpenAIKey() {
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }

  setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
  return true;
}

function clampEpisodeCount(value) {
  const parsed = Number.parseInt(value ?? DEFAULT_EPISODE_COUNT, 10);

  if (Number.isNaN(parsed)) {
    return DEFAULT_EPISODE_COUNT;
  }

  return Math.max(1, Math.min(parsed, MAX_EPISODE_COUNT));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function countWordsInString(text) {
  if (typeof text !== "string" || !text.trim()) {
    return 0;
  }

  const matches = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

function countWordsDeep(value) {
  if (typeof value === "string") {
    return countWordsInString(value);
  }

  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countWordsDeep(item), 0);
  }

  if (value && typeof value === "object") {
    return Object.values(value).reduce((total, item) => total + countWordsDeep(item), 0);
  }

  return 0;
}

function createEpisodeUsageTracker() {
  return {
    model: getConfiguredModel() || "gpt-5.4",
    reasoningEffort: getConfiguredReasoningEffort(null),
    episodeTranscriptWordCount: 0,
    llmInputWordCount: 0,
    llmOutputWordCount: 0,
  };
}

function noteTranscriptWords(usageTracker, text) {
  if (!usageTracker) {
    return;
  }

  usageTracker.episodeTranscriptWordCount += countWordsInString(text);
}

function noteModelInputWords(usageTracker, input) {
  if (!usageTracker) {
    return;
  }

  usageTracker.llmInputWordCount += countWordsDeep(input);
}

function noteModelOutputWords(usageTracker, output) {
  if (!usageTracker) {
    return;
  }

  usageTracker.llmOutputWordCount += countWordsDeep(output);
}

function buildEpisodeUsageSummary(usageTracker) {
  if (!usageTracker) {
    return null;
  }

  return {
    model: usageTracker.model,
    reasoningEffort: usageTracker.reasoningEffort,
    episodeTranscriptWordCount: usageTracker.episodeTranscriptWordCount,
    llmInputWordCount: usageTracker.llmInputWordCount,
    llmOutputWordCount: usageTracker.llmOutputWordCount,
  };
}

async function runTracked(agent, input, options, usageTracker) {
  noteModelInputWords(usageTracker, input);
  const result = await run(agent, input, options);
  noteModelOutputWords(usageTracker, result.finalOutput);
  return result;
}

function createRuntimeContext({ theme, episodeNumber }) {
  return {
    theme,
    episodeNumber,
    sharks: SHARK_PROFILES,
    offers: {},
    counters: {},
    auditTrail: [],
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getOffer(context, sharkId) {
  return context.offers[sharkId] ?? null;
}

function getActiveOffer(context, sharkId) {
  const currentOffer = getOffer(context, sharkId);
  return currentOffer?.status === "active" ? currentOffer : null;
}

function safeParseToolArguments(toolCall) {
  try {
    return JSON.parse(toolCall.arguments || "{}");
  } catch {
    return null;
  }
}

function buildGuardrailResult(errors) {
  return {
    tripwireTriggered: errors.length > 0,
    outputInfo: { errors },
  };
}

function buildRepairPrompt(basePrompt, repairInfo) {
  return [
    basePrompt,
    "",
    "Guardrail repair notes:",
    JSON.stringify(repairInfo ?? { errors: ["No guardrail details were provided."] }, null, 2),
    "",
    "Return corrected structured output that matches the live tool state exactly.",
  ].join("\n");
}

function recordAuditEvent(context, event) {
  context.auditTrail.push({
    id: `${event.toolName}-${context.auditTrail.length + 1}`,
    at: new Date().toISOString(),
    ...event,
  });
}

function createCancelOfferInputGuardrail(profile) {
  return defineToolInputGuardrail({
    name: `${profile.id}_cancel_offer_mode_guardrail`,
    async run({ context, toolCall }) {
      const input = safeParseToolArguments(toolCall);

      if (!input) {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          "Tool arguments must be valid JSON.",
        );
      }

      const activeOffer = getActiveOffer(context.context, profile.id);

      if (input.mode === "withdraw" && !activeOffer) {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          "There is no active offer to withdraw. Use mode 'decline' when the shark is simply passing.",
        );
      }

      if (input.mode === "decline" && activeOffer) {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          "There is already an active offer on the board. Use mode 'withdraw' if the shark is pulling that offer.",
        );
      }

      return ToolGuardrailFunctionOutputFactory.allow({
        hasActiveOffer: Boolean(activeOffer),
      });
    },
  });
}

function createCounterOfferInputGuardrail(profile) {
  return defineToolInputGuardrail({
    name: `${profile.id}_counter_offer_consistency_guardrail`,
    async run({ context, toolCall }) {
      const input = safeParseToolArguments(toolCall);

      if (!input) {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          "Tool arguments must be valid JSON.",
        );
      }

      const activeOffer = getActiveOffer(context.context, profile.id);

      if (!activeOffer) {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          "There is no active shark offer to answer. The founder can only use counter_offer when a live offer exists.",
        );
      }

      if (
        input.move === "COUNTER" &&
        (input.cashAmountUsd == null || input.equityPercent == null)
      ) {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          "A COUNTER move must include revised cashAmountUsd and equityPercent terms.",
        );
      }

      if (
        input.move !== "COUNTER" &&
        (input.cashAmountUsd != null || input.equityPercent != null)
      ) {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          "Only a COUNTER move should include revised cashAmountUsd or equityPercent values.",
        );
      }

      return ToolGuardrailFunctionOutputFactory.allow({
        move: input.move,
        sharkId: profile.id,
      });
    },
  });
}

function createSharkRoundGuardrail(profile) {
  return {
    name: `${profile.id}_opening_round_guardrail`,
    async execute({ agentOutput, context }) {
      const errors = [];
      const currentOffer = getOffer(context.context, profile.id);

      if (agentOutput.decision === "INVEST") {
        if (!currentOffer || currentOffer.status !== "active") {
          errors.push("INVEST requires a live make_offer tool call to leave an active offer.");
        }

        if (!agentOutput.offerSummary) {
          errors.push("INVEST requires offerSummary to summarize the live offer.");
        }
      }

      if (agentOutput.decision === "OUT") {
        if (!currentOffer || currentOffer.status !== "canceled") {
          errors.push("OUT requires cancel_offer so the shark is explicitly marked out.");
        }

        if (agentOutput.offerSummary !== null) {
          errors.push("OUT responses must leave offerSummary as null.");
        }
      }

      return buildGuardrailResult(errors);
    },
  };
}

function createFounderCounterGuardrail(profile) {
  return {
    name: `${profile.id}_founder_counter_guardrail`,
    async execute({ agentOutput, context }) {
      const errors = [];
      const currentCounter = context.context.counters[profile.id] ?? null;

      if (!currentCounter) {
        errors.push("The founder must use counter_offer exactly once before returning output.");
      } else if (currentCounter.move !== agentOutput.move) {
        errors.push("Founder output must match the move recorded through counter_offer.");
      }

      if (
        agentOutput.move === "COUNTER" &&
        (currentCounter?.cashAmountUsd == null || currentCounter?.equityPercent == null)
      ) {
        errors.push("COUNTER responses must keep revised cash and equity terms in tool state.");
      }

      if (
        agentOutput.move !== "COUNTER" &&
        (currentCounter?.cashAmountUsd != null || currentCounter?.equityPercent != null)
      ) {
        errors.push("ACCEPT and DECLINE responses must not carry revised numeric terms.");
      }

      return buildGuardrailResult(errors);
    },
  };
}

function createSharkResolutionGuardrail(profile) {
  return {
    name: `${profile.id}_resolution_guardrail`,
    async execute({ agentOutput, context }) {
      const errors = [];
      const activeOffer = getActiveOffer(context.context, profile.id);

      if (agentOutput.finalDecision === "DEAL") {
        if (!activeOffer) {
          errors.push("DEAL requires a live active offer on the board.");
        }

        if (!agentOutput.finalTermsSummary) {
          errors.push("DEAL requires finalTermsSummary to describe the active terms.");
        }
      }

      if (agentOutput.finalDecision === "OUT") {
        if (activeOffer) {
          errors.push("OUT cannot leave an active offer on the board. Use cancel_offer first.");
        }

        if (agentOutput.finalTermsSummary !== null) {
          errors.push("OUT responses must leave finalTermsSummary as null.");
        }
      }

      return buildGuardrailResult(errors);
    },
  };
}

function createOfferTools(profile) {
  const cancelOfferInputGuardrail = createCancelOfferInputGuardrail(profile);

  const makeOffer = tool({
    name: "make_offer",
    description:
      "Put a real offer on the table for this shark. Use it when the shark wants to invest or revise an existing offer.",
    parameters: z.object({
      cashAmountUsd: z.number().int().positive(),
      equityPercent: z.number().positive().max(100),
      headline: z.string().min(10).max(120),
      terms: z.string().min(12).max(220),
    }),
    async execute(input, runContext) {
      const offer = {
        sharkId: profile.id,
        sharkName: profile.fullName,
        cashAmountUsd: input.cashAmountUsd,
        equityPercent: input.equityPercent,
        headline: input.headline,
        terms: input.terms,
        status: "active",
        updatedAt: new Date().toISOString(),
      };

      runContext.context.offers[profile.id] = offer;
      recordAuditEvent(runContext.context, {
        type: "offer",
        actor: profile.fullName,
        role: profile.persona,
        sharkId: profile.id,
        toolName: "make_offer",
        badge: "MAKE OFFER",
        summary: `${profile.fullName} offers ${formatMoney(input.cashAmountUsd)} for ${input.equityPercent}%`,
        detail: input.terms,
        color: profile.color,
      });

      return `${profile.fullName} now has an active offer of ${formatMoney(input.cashAmountUsd)} for ${input.equityPercent}%. ${input.terms}`;
    },
  });

  const cancelOffer = tool({
    name: "cancel_offer",
    description:
      "Use this when the shark refuses to make an offer or decides to pull one off the table.",
    parameters: z.object({
      reason: z.string().min(12).max(220),
      mode: z.enum(["decline", "withdraw"]),
    }),
    inputGuardrails: [cancelOfferInputGuardrail],
    async execute(input, runContext) {
      const currentOffer = runContext.context.offers[profile.id];

      if (currentOffer) {
        runContext.context.offers[profile.id] = {
          ...currentOffer,
          status: "canceled",
          canceledReason: input.reason,
          updatedAt: new Date().toISOString(),
        };
      } else {
        runContext.context.offers[profile.id] = {
          sharkId: profile.id,
          sharkName: profile.fullName,
          status: "canceled",
          canceledReason: input.reason,
          updatedAt: new Date().toISOString(),
        };
      }

      recordAuditEvent(runContext.context, {
        type: "cancel_offer",
        actor: profile.fullName,
        role: profile.persona,
        sharkId: profile.id,
        toolName: "cancel_offer",
        badge: input.mode === "decline" ? "PASS" : "PULL OFFER",
        summary: `${profile.fullName} ${input.mode === "decline" ? "passes" : "pulls the offer"}: ${input.reason}`,
        detail: input.reason,
        color: profile.color,
      });

      return `${profile.fullName} is out for now. Reason: ${input.reason}`;
    },
  });

  return { makeOffer, cancelOffer };
}

function createCounterTool(profile) {
  const counterOfferInputGuardrail = createCounterOfferInputGuardrail(profile);

  return tool({
    name: "counter_offer",
    description:
      "Record the founder's response to the shark's terms. Use it to accept, counter, or decline the offer.",
    parameters: z.object({
      move: z.enum(["ACCEPT", "COUNTER", "DECLINE"]),
      cashAmountUsd: z.number().int().positive().nullable(),
      equityPercent: z.number().positive().max(100).nullable(),
      terms: z.string().min(8).max(220),
      rationale: z.string().min(12).max(220),
    }),
    inputGuardrails: [counterOfferInputGuardrail],
    async execute(input, runContext) {
      const currentOffer = runContext.context.offers[profile.id] || null;
      const counter = {
        sharkId: profile.id,
        sharkName: profile.fullName,
        move: input.move,
        cashAmountUsd: input.cashAmountUsd,
        equityPercent: input.equityPercent,
        terms: input.terms,
        rationale: input.rationale,
        basedOn: currentOffer,
        updatedAt: new Date().toISOString(),
      };

      runContext.context.counters[profile.id] = counter;
      recordAuditEvent(runContext.context, {
        type: "counter",
        actor: "Entrepreneur",
        role: "Founder Agent",
        sharkId: profile.id,
        toolName: "counter_offer",
        badge: input.move,
        summary: `Founder response to ${profile.fullName}: ${input.move} - ${input.terms}`,
        detail: input.rationale,
        color: "#7ce8c8",
      });

      return `Founder move recorded: ${input.move}. ${input.terms}`;
    },
  });
}

function createPitchAgent() {
  return new Agent({
    name: "Entrepreneur",
    model: getConfiguredModel(),
    instructions:
      "You are an unforgettable startup founder pitching on AI Shark Tank. Invent an outrageous but still plausible startup. Be vivid, sharp, numeric, and TV-ready. Return only structured output.",
    outputType: PitchSchema,
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.entrepreneur,
      temperature: 1,
      verbosity: "medium",
    }),
  });
}

function createSharkRoundAgent(profile) {
  const { makeOffer, cancelOffer } = createOfferTools(profile);
  const sharkRoundGuardrail = createSharkRoundGuardrail(profile);

  return new Agent({
    name: `${profile.fullName} Opening Round`,
    model: getConfiguredModel(),
    instructions: `
You are ${profile.fullName} on AI Shark Tank.
Persona: ${profile.persona}.
Style: ${profile.style}

You are responding live to a founder pitch.
You must do two things:
1. Ask one sharp, on-brand question or challenge.
2. Use exactly one tool before you finish:
   - use make_offer if you want in
   - use cancel_offer if you are out

Rules:
- If you use make_offer, your final decision must be INVEST and offerSummary must summarize the live offer.
- If you use cancel_offer, your final decision must be OUT and offerSummary must be null.
- Keep the energy dramatic and TV-ready.
- Return only structured output.
    `.trim(),
    tools: [makeOffer, cancelOffer],
    outputType: SharkRoundSchema,
    outputGuardrails: [sharkRoundGuardrail],
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.sharkOpening,
      temperature: 0.8,
      toolChoice: "required",
      verbosity: "medium",
    }),
  });
}

function createFounderCounterAgent(profile) {
  const counterOffer = createCounterTool(profile);
  const founderCounterGuardrail = createFounderCounterGuardrail(profile);

  return new Agent({
    name: `Founder Counter to ${profile.fullName}`,
    model: getConfiguredModel(),
    instructions: `
You are the entrepreneur on AI Shark Tank responding to ${profile.fullName}'s live offer.
Use the counter_offer tool exactly once to record your move.

Rules:
- ACCEPT means you agree to the active offer as-is.
- COUNTER means you propose revised terms.
- DECLINE means you walk away from that shark.
- revisedTermsSummary must match the move you just recorded with the tool.
- Return only structured output.
    `.trim(),
    tools: [counterOffer],
    outputType: FounderCounterSchema,
    outputGuardrails: [founderCounterGuardrail],
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.founderCounter,
      temperature: 0.7,
      toolChoice: "required",
      verbosity: "medium",
    }),
  });
}

function createSharkResolutionAgent(profile) {
  const { makeOffer, cancelOffer } = createOfferTools(profile);
  const sharkResolutionGuardrail = createSharkResolutionGuardrail(profile);

  return new Agent({
    name: `${profile.fullName} Resolution`,
    model: getConfiguredModel(),
    instructions: `
You are ${profile.fullName} responding to the founder's latest move.
Use exactly one tool:
- make_offer to keep or revise a final offer on the table
- cancel_offer to walk away

Rules:
- If you keep a deal alive, finalDecision must be DEAL and finalTermsSummary must describe the active terms.
- If you walk, finalDecision must be OUT and finalTermsSummary must be null.
- Return only structured output.
    `.trim(),
    tools: [makeOffer, cancelOffer],
    outputType: SharkResolutionSchema,
    outputGuardrails: [sharkResolutionGuardrail],
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.sharkResolution,
      temperature: 0.7,
      toolChoice: "required",
      verbosity: "medium",
    }),
  });
}

function createPackagingAgent() {
  return new Agent({
    name: "Showrunner",
    model: getConfiguredModel(),
    instructions:
      "You are the producer packaging an AI Shark Tank episode for a social post. Make the copy instantly recognizable as Shark Tank-inspired, cinematic, and obviously AI-generated. Keep socialCaption punchy and tweet-ready, ideally under 240 characters. Return only structured output.",
    outputType: PackagingSchema,
    outputGuardrails: [packagingGuardrail],
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.showrunner,
      temperature: 0.9,
      verbosity: "high",
    }),
  });
}

function pickRandomFounderLook() {
  const topType = FOUNDER_TOP_TYPES[Math.floor(Math.random() * FOUNDER_TOP_TYPES.length)];
  const bottomType =
    FOUNDER_BOTTOM_TYPES[Math.floor(Math.random() * FOUNDER_BOTTOM_TYPES.length)];
  const topColor = FOUNDER_COLOR_NAMES[Math.floor(Math.random() * FOUNDER_COLOR_NAMES.length)];
  const remainingColors = FOUNDER_COLOR_NAMES.filter((color) => color !== topColor);
  const bottomColor =
    remainingColors[Math.floor(Math.random() * remainingColors.length)] ?? "charcoal";

  return materializeFounderLook({
    top: { type: topType, color: topColor },
    bottom: { type: bottomType, color: bottomColor },
  });
}

function materializeFounderLook(look) {
  return {
    top: {
      type: look.top.type,
      color: look.top.color,
      hex: FOUNDER_COLOR_PALETTE[look.top.color],
    },
    bottom: {
      type: look.bottom.type,
      color: look.bottom.color,
      hex: FOUNDER_COLOR_PALETTE[look.bottom.color],
    },
  };
}

function createFounderLookAgent() {
  return new Agent({
    name: "Founder Wardrobe",
    model: getConfiguredModel(),
    instructions: `
You are styling the AI entrepreneur for a Shark Tank-inspired premium TV set.
Choose one top and one bottom that look sharp on camera and clearly contrast.

Rules:
- The founder should look like a real entrepreneur, not a costume character.
- Prefer polished, high-contrast combinations that read clearly under warm studio lighting.
- Return only structured output.
    `.trim(),
    outputType: FounderLookSchema,
    outputGuardrails: [founderLookGuardrail],
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.founderWardrobe,
      temperature: 0.7,
      verbosity: "low",
    }),
  });
}

function buildFounderLookPrompt(theme) {
  const cleanTheme = theme?.trim();

  if (!cleanTheme) {
    return "Create a founder outfit for an entrepreneur about to walk into the AI Shark Tank studio.";
  }

  return `Create a founder outfit for an entrepreneur about to walk into the AI Shark Tank studio. The startup vibe is: ${cleanTheme}.`;
}

async function generateFounderLook({ theme, usageTracker = null } = {}) {
  if (!ensureOpenAIKey()) {
    return pickRandomFounderLook();
  }

  const lookAgent = createFounderLookAgent();
  const prompt = buildFounderLookPrompt(theme);

  try {
    const result = await runWithRepair(
      lookAgent,
      prompt,
      {
        maxTurns: 1,
      },
      (repairInfo) => buildRepairPrompt(prompt, repairInfo),
      usageTracker,
    );

    return materializeFounderLook(result.finalOutput);
  } catch {
    return pickRandomFounderLook();
  }
}

function slugifyFilenamePart(input) {
  return (input || "ai-shark-tank-report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeFeasibilityInput(input = {}) {
  const startupName =
    typeof input.startupName === "string" && input.startupName.trim()
      ? input.startupName.trim()
      : "Untitled startup";
  const founderPitch =
    typeof input.founderPitch === "string" && input.founderPitch.trim()
      ? input.founderPitch.trim()
      : typeof input.pitchText === "string" && input.pitchText.trim()
        ? input.pitchText.trim()
        : "";
  const concept =
    typeof input.concept === "string" && input.concept.trim() ? input.concept.trim() : "";
  const productName =
    typeof input.productName === "string" && input.productName.trim()
      ? input.productName.trim()
      : "";

  return {
    startupName,
    founderPitch,
    concept,
    productName,
  };
}

function createBusinessFeasibilityAgent() {
  return new Agent({
    name: "Business Feasibility Analyst",
    model: getConfiguredModel(),
    instructions: `
You are a practical startup analyst evaluating whether a pitch is actually a viable business.

Rules:
- Ignore entertainment value and evaluate only business feasibility.
- feasibilityPercent must reflect realistic execution and market viability from 0 to 100.
- isGoodBusiness must be "yes" or "no".
- minimumInitialInvestmentUsd must be the minimum realistic amount to start this business at a credible level.
- difficulty must be easy, medium, or hard.
- timeToFirstRevenue must be exactly one of: "2 weeks", "1 month", or "more than 1 month".
- Keep summary and biggestRisk concise and concrete.
- Return only structured output.
    `.trim(),
    outputType: BusinessFeasibilitySchema,
    outputGuardrails: [businessFeasibilityGuardrail],
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.businessFeasibility,
      temperature: 0.4,
      verbosity: "low",
    }),
  });
}

function buildBusinessFeasibilityPrompt(input) {
  return [
    "Evaluate this AI Shark Tank business pitch.",
    'Estimate how fast the business could realistically make its first money if executed well. Use exactly one of: "2 weeks", "1 month", or "more than 1 month".',
    "",
    `Startup name: ${input.startupName}`,
    `Product name: ${input.productName || "Not provided"}`,
    `Concept: ${input.concept || "Not provided"}`,
    "",
    "Founder pitch:",
    input.founderPitch || "Not provided",
  ].join("\n");
}

function createHeuristicFeasibilityReport(input) {
  const sourceText = `${input.productName} ${input.concept} ${input.founderPitch}`.toLowerCase();
  const highComplexityKeywords = [
    "robot",
    "hardware",
    "device",
    "factory",
    "drone",
    "biotech",
    "medical",
    "pharma",
    "space",
    "battery",
  ];
  const mediumComplexityKeywords = [
    "marketplace",
    "consumer",
    "retail",
    "physical",
    "logistics",
    "delivery",
    "food",
  ];
  const lowerComplexityKeywords = [
    "software",
    "saas",
    "app",
    "subscription",
    "platform",
    "api",
    "digital",
  ];

  let feasibilityPercent = 56;
  let minimumInitialInvestmentUsd = 40000;
  let difficulty = "medium";
  let timeToFirstRevenue = "1 month";

  for (const keyword of highComplexityKeywords) {
    if (sourceText.includes(keyword)) {
      feasibilityPercent -= 7;
      minimumInitialInvestmentUsd += 120000;
      difficulty = "hard";
    }
  }

  for (const keyword of mediumComplexityKeywords) {
    if (sourceText.includes(keyword)) {
      feasibilityPercent -= 2;
      minimumInitialInvestmentUsd += 35000;
    }
  }

  for (const keyword of lowerComplexityKeywords) {
    if (sourceText.includes(keyword)) {
      feasibilityPercent += 4;
      minimumInitialInvestmentUsd += 15000;
    }
  }

  if (sourceText.includes("ai")) {
    minimumInitialInvestmentUsd += 20000;
  }

  if (sourceText.includes("luxury") || sourceText.includes("viral")) {
    feasibilityPercent -= 5;
  }

  feasibilityPercent = clamp(Math.round(feasibilityPercent), 12, 88);

  if (difficulty === "medium" && minimumInitialInvestmentUsd >= 180000) {
    difficulty = "hard";
  }

  if (difficulty === "medium" && feasibilityPercent >= 68) {
    difficulty = "easy";
  }

  if (
    difficulty === "hard" ||
    minimumInitialInvestmentUsd >= 180000 ||
    highComplexityKeywords.some((keyword) => sourceText.includes(keyword))
  ) {
    timeToFirstRevenue = "more than 1 month";
  } else if (
    difficulty === "easy" &&
    minimumInitialInvestmentUsd <= 90000 &&
    lowerComplexityKeywords.some((keyword) => sourceText.includes(keyword))
  ) {
    timeToFirstRevenue = "2 weeks";
  }

  return {
    feasibilityPercent,
    isGoodBusiness: feasibilityPercent >= 60 ? "yes" : "no",
    minimumInitialInvestmentUsd,
    difficulty,
    timeToFirstRevenue,
    summary:
      feasibilityPercent >= 60
        ? "This pitch has a plausible business path, but it still needs disciplined execution and clear customer demand."
        : "This pitch reads as difficult to execute profitably without stronger proof of demand and tighter operating assumptions.",
    biggestRisk:
      difficulty === "hard"
        ? "The operational complexity and capital requirements are likely much higher than a founder pitch would imply."
        : "The biggest risk is weak customer demand once the novelty wears off.",
  };
}

function buildDownloadReportPayload(input, report, source) {
  const fileName = `${slugifyFilenamePart(input.startupName)}-feasibility-report.txt`;
  const content = [
    "AI Shark Tank Feasibility Report",
    "================================",
    "",
    `Startup: ${input.startupName}`,
    `Product: ${input.productName || "Not provided"}`,
    `Concept: ${input.concept || "Not provided"}`,
    `Source: ${source}`,
    "",
    `Feasibility %: ${report.feasibilityPercent}`,
    `Good business idea: ${report.isGoodBusiness}`,
    `Minimum initial investment (USD): ${report.minimumInitialInvestmentUsd}`,
    `Difficulty: ${report.difficulty}`,
    `Time to first money if done right: ${report.timeToFirstRevenue}`,
    "",
    `Summary: ${report.summary}`,
    `Biggest risk: ${report.biggestRisk}`,
    "",
    "Founder pitch:",
    input.founderPitch || "Not provided",
    "",
    `Generated at: ${new Date().toISOString()}`,
  ].join("\n");

  return {
    fileName,
    mimeType: "text/plain; charset=utf-8",
    content,
  };
}

export async function generateFeasibilityReport(input = {}) {
  const normalizedInput = normalizeFeasibilityInput(input);

  if (!normalizedInput.founderPitch && !normalizedInput.concept) {
    throw new Error("A founderPitch, pitchText, or concept is required to generate a report.");
  }

  if (!ensureOpenAIKey()) {
    const report = createHeuristicFeasibilityReport(normalizedInput);
    return {
      source: "heuristic",
      startupName: normalizedInput.startupName,
      report,
      download: buildDownloadReportPayload(normalizedInput, report, "heuristic"),
    };
  }

  const feasibilityAgent = createBusinessFeasibilityAgent();
  const prompt = buildBusinessFeasibilityPrompt(normalizedInput);
  const result = await runWithRepair(
    feasibilityAgent,
    prompt,
    {
      maxTurns: 1,
    },
    (repairInfo) => buildRepairPrompt(prompt, repairInfo),
  );
  const report = result.finalOutput;

  return {
    source: "agent",
    startupName: normalizedInput.startupName,
    report,
    download: buildDownloadReportPayload(normalizedInput, report, "agent"),
  };
}

async function runWithRepair(agent, input, options, repairBuilder, usageTracker = null) {
  try {
    noteModelInputWords(usageTracker, input);
    const result = await run(agent, input, options);
    noteModelOutputWords(usageTracker, result.finalOutput);
    return result;
  } catch (error) {
    if (error instanceof ModelBehaviorError && repairBuilder) {
      const repairedInput = repairBuilder({ errors: [error.message] });
      noteModelInputWords(usageTracker, repairedInput);
      const repairedResult = await run(agent, repairedInput, options);
      noteModelOutputWords(usageTracker, repairedResult.finalOutput);
      return repairedResult;
    }

    if (!(error instanceof OutputGuardrailTripwireTriggered) || !repairBuilder) {
      throw error;
    }

    const repairedInput = repairBuilder(error.result.output.outputInfo);
    noteModelInputWords(usageTracker, repairedInput);
    const repairedResult = await run(agent, repairedInput, options);
    noteModelOutputWords(usageTracker, repairedResult.finalOutput);
    return repairedResult;
  }
}

function buildPitchPrompt(theme) {
  const cleanTheme = theme?.trim();

  if (!cleanTheme) {
    return "Create a brand-new startup pitch for AI Shark Tank. Avoid generic software and make it visual, memorable, and social-first.";
  }

  return `Create a brand-new startup pitch for AI Shark Tank inspired by this theme: ${cleanTheme}. Avoid generic software and make it visual, memorable, and social-first.`;
}

function buildSharkRoundPrompt(profile, pitch) {
  return [
    `Founder pitch for ${profile.fullName}:`,
    JSON.stringify(pitch, null, 2),
    "",
    "Give the founder one hard question, then make your investment call live.",
  ].join("\n");
}

function buildFounderCounterPrompt(profile, pitch, round, currentOffer) {
  return [
    `Founder pitch:`,
    JSON.stringify(pitch, null, 2),
    "",
    `${profile.fullName}'s live round:`,
    JSON.stringify(round, null, 2),
    "",
    "Active offer on the table:",
    JSON.stringify(currentOffer, null, 2),
    "",
    "Respond like a founder who still wants the best possible deal.",
  ].join("\n");
}

function buildSharkResolutionPrompt(profile, pitch, round, founderCounter, currentOffer) {
  return [
    `Founder pitch:`,
    JSON.stringify(pitch, null, 2),
    "",
    `${profile.fullName}'s initial round:`,
    JSON.stringify(round, null, 2),
    "",
    "Founder response:",
    JSON.stringify(founderCounter, null, 2),
    "",
    "Current offer ledger for this shark:",
    JSON.stringify(currentOffer, null, 2),
    "",
    "Decide whether to lock the deal or walk away.",
  ].join("\n");
}

function buildLiveFounderCounterPrompt(profile, founderPitch, sharkReaction, currentOffer) {
  return [
    "Founder pitch:",
    founderPitch,
    "",
    `${profile.fullName}'s live reaction:`,
    sharkReaction,
    "",
    "Active offer on the table:",
    JSON.stringify(currentOffer, null, 2),
    "",
    "Respond like a founder who wants the strongest realistic deal.",
  ].join("\n");
}

function buildLiveSharkResolutionPrompt(profile, founderPitch, sharkReaction, founderCounter, currentOffer) {
  return [
    "Founder pitch:",
    founderPitch,
    "",
    `${profile.fullName}'s initial live reaction:`,
    sharkReaction,
    "",
    "Founder response:",
    JSON.stringify(founderCounter, null, 2),
    "",
    "Current offer ledger for this shark:",
    JSON.stringify(currentOffer, null, 2),
    "",
    "Decide whether to lock the deal or walk away.",
  ].join("\n");
}

function pickLeadNegotiationOffer(activeOffers) {
  return [...activeOffers].sort((left, right) => {
    if (right.cashAmountUsd !== left.cashAmountUsd) {
      return right.cashAmountUsd - left.cashAmountUsd;
    }

    return left.equityPercent - right.equityPercent;
  })[0] ?? null;
}

function summarizeDeal(activeOffers) {
  if (activeOffers.length === 0) {
    return {
      headline: "No shark closes the deal",
      investors: [],
      finalTerms: "No Deal",
      outcome: "No Deal",
      rationale:
        "The panel liked the theater, but the final terms never aligned strongly enough to close.",
    };
  }

  if (activeOffers.length === 1) {
    const [offer] = activeOffers;
    return {
      headline: `${offer.sharkName} lands the deal`,
      investors: [offer.sharkName],
      finalTerms: `${formatMoney(offer.cashAmountUsd)} for ${offer.equityPercent}%`,
      outcome: "Deal",
      rationale: offer.terms,
    };
  }

  return {
    headline: "Multiple AI sharks stay in the deal",
    investors: activeOffers.map((offer) => offer.sharkName),
    finalTerms: activeOffers
      .map((offer) => `${offer.sharkName}: ${formatMoney(offer.cashAmountUsd)} for ${offer.equityPercent}%`)
      .join(" • "),
    outcome: "Multi-Shark Deal",
    rationale:
      "More than one shark stayed active, turning the tank into a live bidding board.",
  };
}

function buildOfferBoard(context) {
  return SHARK_PROFILES.map((profile) => {
    const offer = context.offers[profile.id] ?? null;
    const counter = context.counters[profile.id] ?? null;

    return {
      sharkId: profile.id,
      sharkName: profile.fullName,
      color: profile.color,
      status: offer?.status ?? "no_offer",
      headline: offer?.headline ?? null,
      cashAmountUsd: offer?.cashAmountUsd ?? null,
      equityPercent: offer?.equityPercent ?? null,
      terms: offer?.terms ?? null,
      canceledReason: offer?.canceledReason ?? null,
      founderMove: counter?.move ?? null,
      founderTerms: counter?.terms ?? null,
    };
  });
}

function buildPackagingPrompt({ theme, pitch, sharks, dealSummary, timelineDraft }) {
  return [
    "Package this AI Shark Tank episode for a social-ready front end.",
    theme ? `Theme: ${theme}` : "Theme: none provided",
    "",
    "Founder:",
    JSON.stringify(pitch, null, 2),
    "",
    "Shark outcomes:",
    JSON.stringify(sharks, null, 2),
    "",
    "Deal summary:",
    JSON.stringify(dealSummary, null, 2),
    "",
    "Timeline draft:",
    JSON.stringify(timelineDraft, null, 2),
    "",
    "Make it feel like a premium TV screenshot and a strong Twitter post.",
  ].join("\n");
}

function buildTimeline({ packaging, founder, sharks }) {
  const timeline = [
    {
      id: "cold-open",
      type: "cold_open",
      speaker: "Studio",
      role: "Showrunner Agent",
      eyebrow: "Opening shot",
      headline: packaging.posterSlugline,
      body: packaging.openingVoiceover,
      color: "#ffd166",
      badge: "LIVE",
    },
    {
      id: "pitch",
      type: "pitch",
      speaker: "Entrepreneur",
      role: "Founder Agent",
      eyebrow: founder.startupName,
      headline: `${founder.productName} enters the tank`,
      body: founder.founderPitch,
      color: "#7ce8c8",
      badge: "ASK",
    },
  ];

  for (const shark of sharks) {
    timeline.push({
      id: `${shark.id}-question`,
      type: "question",
      speaker: shark.fullName,
      role: shark.persona,
      eyebrow: shark.round.questionTitle,
      headline: shark.round.questionLine,
      body: shark.round.decisionLine,
      color: shark.color,
      badge: shark.round.decision,
    });

    if (shark.founderCounter) {
      timeline.push({
        id: `${shark.id}-counter`,
        type: "counter",
        speaker: "Entrepreneur",
        role: "Founder Agent",
        eyebrow: `${shark.displayName} gets a response`,
        headline: shark.founderCounter.move === "COUNTER"
          ? "The founder counters live"
          : shark.founderCounter.move === "ACCEPT"
            ? "The founder leans in"
            : "The founder walks back",
        body: shark.founderCounter.responseLine,
        color: "#7ce8c8",
        badge: shark.founderCounter.move,
      });

      timeline.push({
        id: `${shark.id}-resolution`,
        type: shark.finalDecision.finalDecision === "DEAL" ? "deal" : "walk",
        speaker: shark.fullName,
        role: shark.persona,
        eyebrow: "Final call",
        headline:
          shark.finalDecision.finalDecision === "DEAL"
            ? "A shark bites"
            : "This shark walks",
        body: shark.finalDecision.finalLine,
        color: shark.color,
        badge: shark.finalDecision.finalDecision,
      });
    }
  }

  timeline.push({
    id: "finale",
    type: "finale",
    speaker: "Studio",
    role: "Showrunner Agent",
    eyebrow: "Closing shot",
    headline: packaging.episodeTitle,
    body: packaging.closingVoiceover,
    color: "#ffd166",
    badge: "WRAP",
  });

  return timeline;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new Error("Streaming run aborted."));
    }

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new Error("Streaming run aborted."));
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function createLivePitchAgent() {
  return new Agent({
    name: "Live Entrepreneur",
    model: getConfiguredModel(),
    instructions: `
You are the founder on an all-AI version of Shark Tank.
Speak naturally to the sharks in 4 to 6 short spoken sentences.

Rules:
- This is spoken dialogue, not JSON.
- Say the startup name, the product, what it does, how much money you want, and what equity you are offering.
- Sound confident, ambitious, fast, and television-ready.
- Keep every sentence punchy and easy to say out loud.
    `.trim(),
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.entrepreneur,
      temperature: 0.9,
      verbosity: "low",
    }),
  });
}

function createLiveSharkAgent(profile) {
  const { makeOffer, cancelOffer } = createOfferTools(profile);

  return new Agent({
    name: `${profile.fullName} Live`,
    model: getConfiguredModel(),
    instructions: `
You are ${profile.fullName} on an all-AI version of Shark Tank.
Persona: ${profile.persona}.
Style: ${profile.style}

You are speaking live on camera.
You must do two things:
1. Give one sharp reaction, opinion, or question.
2. Use exactly one tool before you finish:
   - use make_offer if you want to invest
   - use cancel_offer if you are out

Rules:
- Speak in 2 to 4 short spoken sentences.
- No bullet points, no JSON, no stage directions.
- If you invest, say the terms out loud clearly.
- If you are out, say "I'm out" or make the pass unmistakably clear.
- Sound like a human judge speaking on television.
    `.trim(),
    tools: [makeOffer, cancelOffer],
    modelSettings: buildModelSettings({
      reasoningEffort: AGENT_REASONING_EFFORT.sharkOpening,
      temperature: 0.8,
      toolChoice: "required",
      verbosity: "low",
    }),
  });
}

function buildLivePitchPrompt() {
  return "Walk into the tank and start your pitch immediately.";
}

function buildLiveSharkPrompt(profile, founderPitch) {
  return [
    `Founder pitch for ${profile.fullName}:`,
    founderPitch,
    "",
    "React live. Give your opinion, then either make an offer or say you are out.",
  ].join("\n");
}

function getLiveSharkOutcome(context, profile) {
  const offer = getOffer(context, profile.id);

  if (offer?.status === "active") {
    return {
      decision: "INVEST",
      offer,
      summary: `${formatMoney(offer.cashAmountUsd)} for ${offer.equityPercent}%`,
    };
  }

  return {
    decision: "OUT",
    offer,
    summary: offer?.canceledReason ?? "No offer made.",
  };
}

async function streamAgentSpeech({
  agent,
  input,
  context,
  maxTurns,
  signal,
  onText,
  usageTracker = null,
}) {
  noteModelInputWords(usageTracker, input);
  const stream = await run(agent, input, {
    context,
    maxTurns,
    signal,
    stream: true,
  });
  const textStream = stream.toTextStream({
    compatibleWithNodeStreams: true,
  });
  let fullText = "";

  const splitDelta = (text) => text.match(/\s+|[^\s]+\s*/g) || [text];

  for await (const chunk of textStream) {
    const text = typeof chunk === "string" ? chunk : chunk.toString();

    if (!text) {
      continue;
    }

    for (const unit of splitDelta(text)) {
      fullText += unit;
      await onText(unit);
    }
  }

  await stream.completed;
  const finalOutput = typeof stream.finalOutput === "string" ? stream.finalOutput.trim() : fullText.trim();
  noteModelOutputWords(usageTracker, finalOutput);
  return finalOutput;
}

function chunkDemoLine(text) {
  return text.match(/\s+|[^\s]+\s*/g) || [text];
}

async function streamDemoSpeechLine({ text, onText, signal }) {
  for (const chunk of chunkDemoLine(text)) {
    if (signal?.aborted) {
      throw new Error("Streaming run aborted.");
    }

    await onText(chunk);
    await sleep(26 + chunk.length * 4, signal);
  }

  return text;
}

async function streamDemoLiveEpisode({ send, signal }) {
  const episode = createDemoEpisode({
    episodeNumber: 1,
    theme: "shark tank live stage",
  });
  const founderLook = pickRandomFounderLook();
  const featuredNegotiation =
    episode.sharks.find((shark) => shark.finalDecision === "DEAL") ||
    episode.sharks.find((shark) => Boolean(shark.founderResponse)) ||
    null;

  await send({
    type: "stage",
    runtime: "demo",
    entranceDurationMs: 1800,
    founderLook,
    sharks: episode.sharks.map((shark) => ({
      id: shark.id,
      displayName: shark.displayName,
      fullName: shark.fullName,
      persona: shark.persona,
      color: shark.color,
    })),
  });
  await sleep(1800, signal);

  const founderEvent = episode.timeline.find((event) => event.type === "pitch");

  if (founderEvent) {
    await send({
      type: "speaker_start",
      speakerId: "entrepreneur",
      displayName: "Entrepreneur",
      role: "Founder",
      badge: "PITCH",
    });
    const founderText = await streamDemoSpeechLine({
      text: founderEvent.body,
      signal,
      onText: (text) =>
        send({
          type: "speaker_delta",
          speakerId: "entrepreneur",
          text,
        }),
    });
    await send({
      type: "speaker_end",
      speakerId: "entrepreneur",
      displayName: "Entrepreneur",
      role: "Founder",
      badge: "PITCH",
      text: founderText,
    });
    await sleep(220, signal);
  }

  for (const shark of episode.sharks) {
    const sharkEvent = episode.timeline.find((event) => event.id === `${shark.id}-question`);

    if (!sharkEvent) {
      continue;
    }

    await send({
      type: "speaker_start",
      speakerId: shark.id,
      displayName: shark.displayName,
      role: shark.persona,
      badge: shark.openingDecision,
    });
    const sharkText = await streamDemoSpeechLine({
      text: `${shark.question} ${shark.openingLine}`,
      signal,
      onText: (text) =>
        send({
          type: "speaker_delta",
          speakerId: shark.id,
          text,
        }),
    });
    await send({
      type: "speaker_end",
      speakerId: shark.id,
      displayName: shark.displayName,
      role: shark.persona,
      badge: shark.openingDecision,
      decision: shark.openingDecision,
      offerSummary: shark.openingOfferSummary,
      text: sharkText,
    });
    await sleep(180, signal);
  }

  if (featuredNegotiation?.founderResponse) {
    await send({
      type: "speaker_start",
      speakerId: "entrepreneur",
      displayName: "Entrepreneur",
      role: "Founder",
      badge: "COUNTER",
    });
    const founderResponseText = await streamDemoSpeechLine({
      text: featuredNegotiation.founderResponse,
      signal,
      onText: (text) =>
        send({
          type: "speaker_delta",
          speakerId: "entrepreneur",
          text,
        }),
    });
    await send({
      type: "speaker_end",
      speakerId: "entrepreneur",
      displayName: "Entrepreneur",
      role: "Founder",
      badge: "COUNTER",
      decision: "COUNTER",
      offerSummary: featuredNegotiation.finalTerms || featuredNegotiation.openingLine,
      sharkId: featuredNegotiation.id,
      text: founderResponseText,
    });
    await sleep(180, signal);

    await send({
      type: "speaker_start",
      speakerId: featuredNegotiation.id,
      displayName: featuredNegotiation.displayName,
      role: featuredNegotiation.persona,
      badge: featuredNegotiation.finalDecision,
    });
    const finalSharkText = await streamDemoSpeechLine({
      text: featuredNegotiation.finalLine,
      signal,
      onText: (text) =>
        send({
          type: "speaker_delta",
          speakerId: featuredNegotiation.id,
          text,
        }),
    });
    await send({
      type: "speaker_end",
      speakerId: featuredNegotiation.id,
      displayName: featuredNegotiation.displayName,
      role: featuredNegotiation.persona,
      badge: featuredNegotiation.finalDecision,
      decision: featuredNegotiation.finalDecision === "DEAL" ? "INVEST" : "OUT",
      offerSummary: featuredNegotiation.finalTerms,
      sharkId: featuredNegotiation.id,
      text: finalSharkText,
    });
    await sleep(180, signal);
  }

  await send({
    type: "deal_outcome",
    sharkId: featuredNegotiation?.id ?? null,
    sharkName: featuredNegotiation?.fullName ?? null,
    founderMove: featuredNegotiation?.founderResponse ? "COUNTER" : null,
    founderTermsSummary: featuredNegotiation?.founderResponse ?? null,
    finalDecision: featuredNegotiation?.finalDecision ?? "NO_DEAL",
    finalTermsSummary: featuredNegotiation?.finalTerms ?? null,
    handshakeReady: featuredNegotiation?.finalDecision === "DEAL",
  });

  await send({
    type: "episode_end",
    runtime: "demo",
    handshakeReady: featuredNegotiation?.finalDecision === "DEAL",
    dealSummary: episode.dealSummary,
  });

  try {
    await recordEpisodeRun({
      source: episode.source,
      mode: "live",
      theme: episode.theme,
      episodes: [buildArchiveEpisodeFromEpisode(episode, { mode: "live" })],
    });
  } catch (error) {
    console.error("Failed to record live demo episode stats.", error);
  }
}

export async function streamLiveEpisode({ send, signal } = {}) {
  if (!ensureOpenAIKey()) {
    return streamDemoLiveEpisode({ send, signal });
  }

  const context = createRuntimeContext({
    theme: "live stage",
    episodeNumber: 1,
  });
  const usageTracker = createEpisodeUsageTracker();
  const founderLook = await generateFounderLook({ theme: context.theme, usageTracker });

  await send({
    type: "stage",
    runtime: "agents",
    entranceDurationMs: 1800,
    founderLook,
    sharks: SHARK_PROFILES.map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      fullName: profile.fullName,
      persona: profile.persona,
      color: profile.color,
    })),
  });
  await sleep(1800, signal);

  const founderAgent = createLivePitchAgent();
  const liveSharkRounds = [];
  await send({
    type: "speaker_start",
    speakerId: "entrepreneur",
    displayName: "Entrepreneur",
    role: "Founder",
    badge: "PITCH",
  });
  const founderPitch = await streamAgentSpeech({
    agent: founderAgent,
    input: buildLivePitchPrompt(),
    context,
    maxTurns: 1,
    signal,
    usageTracker,
    onText: (text) =>
      send({
        type: "speaker_delta",
        speakerId: "entrepreneur",
        text,
      }),
  });
  noteTranscriptWords(usageTracker, founderPitch);
  await send({
    type: "speaker_end",
    speakerId: "entrepreneur",
    displayName: "Entrepreneur",
    role: "Founder",
    badge: "PITCH",
    text: founderPitch,
  });
  await sleep(220, signal);

  for (const profile of SHARK_PROFILES) {
    const sharkAgent = createLiveSharkAgent(profile);

    await send({
      type: "speaker_start",
      speakerId: profile.id,
      displayName: profile.displayName,
      role: profile.persona,
      badge: "LIVE",
    });
    const sharkText = await streamAgentSpeech({
      agent: sharkAgent,
      input: buildLiveSharkPrompt(profile, founderPitch),
      context,
      maxTurns: 4,
      signal,
      usageTracker,
      onText: (text) =>
        send({
          type: "speaker_delta",
          speakerId: profile.id,
          text,
        }),
    });
    noteTranscriptWords(usageTracker, sharkText);
    const outcome = getLiveSharkOutcome(context, profile);

    await send({
      type: "speaker_end",
      speakerId: profile.id,
      displayName: profile.displayName,
      role: profile.persona,
      badge: outcome.decision,
      decision: outcome.decision,
      offerSummary: outcome.summary,
      offerAmountUsd: outcome.offer?.cashAmountUsd ?? null,
      offerEquityPercent: outcome.offer?.equityPercent ?? null,
      text: sharkText,
    });
    liveSharkRounds.push({
      profile,
      sharkText,
      outcome,
    });
    await sleep(180, signal);
  }

  let activeOffers = Object.values(context.offers).filter(
    (offer) => offer && offer.status === "active",
  );
  let handshakeReady = false;

  if (activeOffers.length > 0) {
    const leadOffer = pickLeadNegotiationOffer(activeOffers);
    const leadRound = liveSharkRounds.find((round) => round.profile.id === leadOffer?.sharkId);

    if (leadOffer && leadRound) {
      const founderCounterAgent = createFounderCounterAgent(leadRound.profile);
      const founderCounterPrompt = buildLiveFounderCounterPrompt(
        leadRound.profile,
        founderPitch,
        leadRound.sharkText,
        getOffer(context, leadRound.profile.id),
      );
      await send({
        type: "speaker_start",
        speakerId: "entrepreneur",
        displayName: "Entrepreneur",
        role: "Founder",
        badge: "COUNTER",
      });
      const founderCounterResult = await runWithRepair(
        founderCounterAgent,
        founderCounterPrompt,
        {
          context,
          maxTurns: 4,
        },
        (repairInfo) => buildRepairPrompt(founderCounterPrompt, repairInfo),
        usageTracker,
      );
      const founderCounter = founderCounterResult.finalOutput;
      noteTranscriptWords(usageTracker, founderCounter.responseLine);

      const founderCounterText = await streamDemoSpeechLine({
        text: founderCounter.responseLine,
        signal,
        onText: (text) =>
          send({
            type: "speaker_delta",
            speakerId: "entrepreneur",
            text,
          }),
      });
      await send({
        type: "speaker_end",
        speakerId: "entrepreneur",
        displayName: "Entrepreneur",
        role: "Founder",
        badge: founderCounter.move,
        decision: founderCounter.move,
        offerSummary: founderCounter.revisedTermsSummary,
        sharkId: leadRound.profile.id,
        text: founderCounterText,
      });
      await sleep(180, signal);

      const resolutionAgent = createSharkResolutionAgent(leadRound.profile);
      const resolutionPrompt = buildLiveSharkResolutionPrompt(
        leadRound.profile,
        founderPitch,
        leadRound.sharkText,
        founderCounter,
        getOffer(context, leadRound.profile.id),
      );
      await send({
        type: "speaker_start",
        speakerId: leadRound.profile.id,
        displayName: leadRound.profile.displayName,
        role: leadRound.profile.persona,
        badge: "DECISION",
      });
      const resolutionResult = await runWithRepair(
        resolutionAgent,
        resolutionPrompt,
        {
          context,
          maxTurns: 4,
        },
        (repairInfo) => buildRepairPrompt(resolutionPrompt, repairInfo),
        usageTracker,
      );
      const finalDecision = resolutionResult.finalOutput;
      noteTranscriptWords(usageTracker, finalDecision.finalLine);

      const resolutionText = await streamDemoSpeechLine({
        text: finalDecision.finalLine,
        signal,
        onText: (text) =>
          send({
            type: "speaker_delta",
            speakerId: leadRound.profile.id,
            text,
          }),
      });
      await send({
        type: "speaker_end",
        speakerId: leadRound.profile.id,
        displayName: leadRound.profile.displayName,
        role: leadRound.profile.persona,
        badge: finalDecision.finalDecision,
        decision: finalDecision.finalDecision === "DEAL" ? "INVEST" : "OUT",
        offerSummary: finalDecision.finalTermsSummary,
        sharkId: leadRound.profile.id,
        text: resolutionText,
      });
      await sleep(180, signal);

      activeOffers = Object.values(context.offers).filter(
        (offer) => offer && offer.status === "active",
      );
      handshakeReady = finalDecision.finalDecision === "DEAL";

      await send({
        type: "deal_outcome",
        sharkId: leadRound.profile.id,
        sharkName: leadRound.profile.fullName,
        founderMove: founderCounter.move,
        founderTermsSummary: founderCounter.revisedTermsSummary,
        finalDecision: finalDecision.finalDecision,
        finalTermsSummary: finalDecision.finalTermsSummary,
        handshakeReady,
      });
    } else {
      await send({
        type: "deal_outcome",
        sharkId: null,
        sharkName: null,
        founderMove: null,
        founderTermsSummary: null,
        finalDecision: "NO_DEAL",
        finalTermsSummary: null,
        handshakeReady: false,
      });
    }
  } else {
    await send({
      type: "deal_outcome",
      sharkId: null,
      sharkName: null,
      founderMove: null,
      founderTermsSummary: null,
      finalDecision: "NO_DEAL",
      finalTermsSummary: null,
      handshakeReady: false,
    });
  }

  await send({
    type: "episode_end",
    runtime: "agents",
    handshakeReady,
    dealSummary: summarizeDeal(activeOffers),
  });

  const finalDealSummary = summarizeDeal(activeOffers);
  const finalOfferBoard = buildOfferBoard(context);
  const liveSharkArchive = SHARK_PROFILES.map((profile) => {
    const openingRound = liveSharkRounds.find((round) => round.profile.id === profile.id) || null;
    const boardEntry = finalOfferBoard.find((offer) => offer.sharkId === profile.id) || null;
    const hasClosedDeal =
      boardEntry?.status === "active" &&
      (finalDealSummary.outcome === "Deal" || finalDealSummary.outcome === "Multi-Shark Deal");
    const finalTerms =
      boardEntry?.cashAmountUsd != null && boardEntry?.equityPercent != null
        ? `${formatMoney(boardEntry.cashAmountUsd)} for ${boardEntry.equityPercent}%`
        : null;

    return {
      id: profile.id,
      displayName: profile.displayName,
      fullName: profile.fullName,
      persona: profile.persona,
      openingDecision: openingRound?.outcome?.decision || "OUT",
      finalDecision: hasClosedDeal ? "DEAL" : openingRound?.outcome?.decision || "OUT",
      finalTerms,
      founderMove: boardEntry?.founderMove || null,
    };
  });

  try {
    await recordEpisodeRun({
      source: "agents",
      mode: "live",
      theme: context.theme,
      episodes: [
        buildArchiveEpisodeFromLiveRun({
          source: "agents",
          theme: context.theme,
          founderPitch,
          sharks: liveSharkArchive,
          dealSummary: finalDealSummary,
          usage: buildEpisodeUsageSummary(usageTracker),
          model: usageTracker.model,
          reasoningEffort: usageTracker.reasoningEffort,
        }),
      ],
    });
  } catch (error) {
    console.error("Failed to record live episode stats.", error);
  }
}

async function generateEpisode({ episodeNumber, theme }) {
  if (!ensureOpenAIKey()) {
    return {
      episode: createDemoEpisode({ episodeNumber, theme }),
      archiveUsage: null,
    };
  }

  const usageTracker = createEpisodeUsageTracker();
  const context = createRuntimeContext({ theme, episodeNumber });
  const pitchAgent = createPitchAgent();
  const pitchPrompt = buildPitchPrompt(theme);
  const pitchResult = await runTracked(pitchAgent, pitchPrompt, {
    context,
    maxTurns: 1,
  }, usageTracker);
  const founder = pitchResult.finalOutput;
  noteTranscriptWords(usageTracker, founder.founderPitch);

  const sharks = [];

  for (const profile of SHARK_PROFILES) {
    const roundAgent = createSharkRoundAgent(profile);
    const roundPrompt = buildSharkRoundPrompt(profile, founder);
      const roundResult = await runWithRepair(
        roundAgent,
        roundPrompt,
        {
          context,
          maxTurns: 4,
        },
        (repairInfo) => buildRepairPrompt(roundPrompt, repairInfo),
        usageTracker,
      );
      const round = roundResult.finalOutput;
      noteTranscriptWords(usageTracker, round.questionLine);
      noteTranscriptWords(usageTracker, round.decisionLine);

      let founderCounter = null;
    let finalDecision = {
      finalDecision: "OUT",
      finalLine: round.decisionLine,
      finalTermsSummary: null,
      walkAwayReason: round.rationale,
    };

    if (round.decision === "INVEST") {
      const founderCounterAgent = createFounderCounterAgent(profile);
      const founderCounterPrompt = buildFounderCounterPrompt(
        profile,
        founder,
        round,
        getOffer(context, profile.id),
      );
      const founderCounterResult = await runWithRepair(
        founderCounterAgent,
        founderCounterPrompt,
        {
          context,
          maxTurns: 4,
        },
        (repairInfo) => buildRepairPrompt(founderCounterPrompt, repairInfo),
        usageTracker,
      );
      founderCounter = founderCounterResult.finalOutput;
      noteTranscriptWords(usageTracker, founderCounter.responseLine);

      const resolutionAgent = createSharkResolutionAgent(profile);
      const resolutionPrompt = buildSharkResolutionPrompt(
        profile,
        founder,
        round,
        founderCounter,
        getOffer(context, profile.id),
      );
      const resolutionResult = await runWithRepair(
        resolutionAgent,
        resolutionPrompt,
        {
          context,
          maxTurns: 4,
        },
        (repairInfo) => buildRepairPrompt(resolutionPrompt, repairInfo),
        usageTracker,
      );
      finalDecision = resolutionResult.finalOutput;
      noteTranscriptWords(usageTracker, finalDecision.finalLine);
    }

    sharks.push({
      ...profile,
      round,
      founderCounter,
      finalDecision,
      liveOffer: getOffer(context, profile.id),
    });
  }

  const activeOffers = Object.values(context.offers).filter(
    (offer) => offer && offer.status === "active",
  );
  const dealSummary = summarizeDeal(activeOffers);
  const offerBoard = buildOfferBoard(context);

  const sharkOutcomes = sharks.map((shark) => ({
    shark: shark.fullName,
    question: shark.round.questionLine,
    openingDecision: shark.round.decision,
    counter: shark.founderCounter?.move || null,
    finalDecision: shark.finalDecision.finalDecision,
    finalTerms: shark.finalDecision.finalTermsSummary,
  }));

  const packagingAgent = createPackagingAgent();
  const packagingPrompt = buildPackagingPrompt({
    theme,
    pitch: founder,
    sharks: sharkOutcomes,
    dealSummary,
    timelineDraft: sharkOutcomes,
  });
  const packagingResult = await runWithRepair(
    packagingAgent,
    packagingPrompt,
    {
      context,
      maxTurns: 1,
    },
    (repairInfo) => buildRepairPrompt(packagingPrompt, repairInfo),
    usageTracker,
  );
  const packaging = packagingResult.finalOutput;
  const timeline = buildTimeline({ packaging, founder, sharks });

  return {
    episode: {
      episodeNumber,
      generatedAt: new Date().toISOString(),
      source: "agents",
      theme: theme?.trim() || null,
      packaging,
      founder,
      sharks: sharks.map((shark) => ({
        id: shark.id,
        displayName: shark.displayName,
        fullName: shark.fullName,
        persona: shark.persona,
        style: shark.style,
        color: shark.color,
        accent: shark.accent,
        icon: shark.icon,
        question: shark.round.questionLine,
        questionTitle: shark.round.questionTitle,
        openingDecision: shark.round.decision,
        openingLine: shark.round.decisionLine,
        openingOfferSummary: shark.round.offerSummary,
        founderResponse: shark.founderCounter?.responseLine || null,
        founderMove: shark.founderCounter?.move || null,
        finalDecision: shark.finalDecision.finalDecision,
        finalLine: shark.finalDecision.finalLine,
        finalTerms: shark.finalDecision.finalTermsSummary,
        walkAwayReason: shark.finalDecision.walkAwayReason,
      })),
      dealSummary,
      offerBoard,
      toolLedger: context.auditTrail,
      timeline,
    },
    archiveUsage: buildEpisodeUsageSummary(usageTracker),
  };
}

export async function generateEpisodes({ count, theme } = {}) {
  const episodeCount = clampEpisodeCount(count);
  const episodes = [];
  const archiveEpisodes = [];

  for (let index = 0; index < episodeCount; index += 1) {
    const result = await generateEpisode({
      episodeNumber: index + 1,
      theme,
    });

    episodes.push(result.episode);
    archiveEpisodes.push(
      buildArchiveEpisodeFromEpisode(result.episode, {
        mode: "batch",
        usage: result.archiveUsage,
        model: result.archiveUsage?.model || null,
        reasoningEffort: result.archiveUsage?.reasoningEffort || null,
      }),
    );
  }

  const payload = {
    source: process.env.OPENAI_API_KEY ? "agents" : "demo",
    count: episodes.length,
    episodes,
  };

  try {
    await recordEpisodeRun({
      source: payload.source,
      mode: "batch",
      theme: theme?.trim() || null,
      episodes: archiveEpisodes,
    });
  } catch (error) {
    console.error("Failed to record generated episode stats.", error);
  }

  return payload;
}
