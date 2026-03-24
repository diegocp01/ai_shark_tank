import { SHARK_PROFILES } from "./sharkProfiles.js";

function stageEvent({
  id,
  type,
  speaker,
  role,
  eyebrow,
  headline,
  body,
  color,
  badge,
}) {
  return {
    id,
    type,
    speaker,
    role,
    eyebrow,
    headline,
    body,
    color,
    badge,
  };
}

export function createDemoEpisode({ episodeNumber = 1, theme = "" } = {}) {
  const promptFlavor = theme?.trim() || "luxury pet robotics";
  const [rex, luna, max, vera, wes] = SHARK_PROFILES;

  const founder = {
    startupName: "Barklight Labs",
    productName: "MoodMutt Halo",
    concept:
      "A premium collar projector that turns your dog's emotional state into cinematic ambient lighting for your whole living room.",
    askAmountUsd: 500000,
    equityPercent: 8,
    founderPitch:
      "I'm asking for $500,000 for 8% of Barklight Labs. MoodMutt Halo reads tail speed, bark frequency, and movement patterns to project a real-time emotional light show across the room. In our pilot, anxious dogs triggered calming scenes, excited dogs launched party mode, and pet parents posted it so often we sold out the first 3,000 units in nine days.",
    themePrompt: promptFlavor,
  };

  const sharks = [
    {
      ...rex,
      question:
        "You're selling a vibe machine for dogs. What happens when the novelty wears off and returns spike?",
      openingDecision: "OUT",
      openingLine:
        "I love the theater, but this feels one TikTok trend away from a warehouse problem.",
      founderResponse: null,
      finalDecision: "OUT",
      finalLine: "I'm out. Cool demo, shaky business.",
      finalTerms: null,
    },
    {
      ...luna,
      question:
        "If this becomes the emotional operating system for pets in the home, what does the world look like in five years?",
      openingDecision: "INVEST",
      openingLine:
        "I think this could become a cultural object, not just a collar. I'm in for $500,000 at 12%.",
      founderResponse:
        "I love the ambition, Luna, but if we're building the future of pet emotion, I need you at 10%.",
      finalDecision: "DEAL",
      finalLine:
        "Done. I'll meet you at $500,000 for 10%, and I want to help turn this into a premium consumer movement.",
      finalTerms: "$500,000 for 10%",
    },
    {
      ...max,
      question:
        "How much margin survives after hardware support, returns, and whatever happens when a dog chews the projector module?",
      openingDecision: "OUT",
      openingLine:
        "The customer story is fun. The economics are not. I'm out.",
      founderResponse: null,
      finalDecision: "OUT",
      finalLine: "The unit math still doesn't clear my bar.",
      finalTerms: null,
    },
    {
      ...vera,
      question:
        "Is this a gadget, or is it a status symbol that says something about the owner?",
      openingDecision: "INVEST",
      openingLine:
        "I see a real premium brand here. I'll do $500,000 for 11% if we build the whole lifestyle around it.",
      founderResponse:
        "Vera, I want the branding power, but I can only do 9%.",
      finalDecision: "OUT",
      finalLine:
        "At 9% I can't justify the risk, so I'm out, but the brand direction is strong.",
      finalTerms: null,
    },
    {
      ...wes,
      question:
        "Can I make this project sharks instead of feelings? Because if yes, I suddenly care a lot.",
      openingDecision: "OUT",
      openingLine:
        "My heart says yes, my chaos budget says no. I'm out.",
      founderResponse: null,
      finalDecision: "OUT",
      finalLine: "If you ever build a nightclub version for pets, call me first.",
      finalTerms: null,
    },
  ];

  const activeDeals = sharks.filter((shark) => shark.finalDecision === "DEAL");
  const featuredDeal = activeDeals[0] || null;
  const toolLedger = [
    {
      id: "make-offer-1",
      at: new Date().toISOString(),
      type: "cancel_offer",
      actor: rex.fullName,
      role: rex.persona,
      sharkId: rex.id,
      toolName: "cancel_offer",
      badge: "PASS",
      summary: "Rex passes after challenging the durability of the business.",
      detail: "He thinks the product could become a returns problem once the novelty fades.",
      color: rex.color,
    },
    {
      id: "make-offer-2",
      at: new Date().toISOString(),
      type: "offer",
      actor: luna.fullName,
      role: luna.persona,
      sharkId: luna.id,
      toolName: "make_offer",
      badge: "MAKE OFFER",
      summary: "Luna offers $500,000 for 12%.",
      detail: "She wants to help turn the product into a premium cultural brand.",
      color: luna.color,
    },
    {
      id: "counter-offer-1",
      at: new Date().toISOString(),
      type: "counter",
      actor: "Entrepreneur",
      role: "Founder Agent",
      sharkId: luna.id,
      toolName: "counter_offer",
      badge: "COUNTER",
      summary: "Founder counters Luna at $500,000 for 10%.",
      detail: "The founder wants capital plus vision without giving up too much equity.",
      color: "#7ce8c8",
    },
    {
      id: "make-offer-3",
      at: new Date().toISOString(),
      type: "offer",
      actor: luna.fullName,
      role: luna.persona,
      sharkId: luna.id,
      toolName: "make_offer",
      badge: "MAKE OFFER",
      summary: "Luna revises and closes at $500,000 for 10%.",
      detail: "She decides the branding upside is worth meeting the founder.",
      color: luna.color,
    },
    {
      id: "cancel-offer-2",
      at: new Date().toISOString(),
      type: "cancel_offer",
      actor: max.fullName,
      role: max.persona,
      sharkId: max.id,
      toolName: "cancel_offer",
      badge: "PASS",
      summary: "Max passes on the economics.",
      detail: "He does not believe the margin profile survives support and returns.",
      color: max.color,
    },
    {
      id: "make-offer-4",
      at: new Date().toISOString(),
      type: "offer",
      actor: vera.fullName,
      role: vera.persona,
      sharkId: vera.id,
      toolName: "make_offer",
      badge: "MAKE OFFER",
      summary: "Vera offers $500,000 for 11%.",
      detail: "She sees a premium lifestyle brand if the story is built correctly.",
      color: vera.color,
    },
    {
      id: "counter-offer-2",
      at: new Date().toISOString(),
      type: "counter",
      actor: "Entrepreneur",
      role: "Founder Agent",
      sharkId: vera.id,
      toolName: "counter_offer",
      badge: "COUNTER",
      summary: "Founder counters Vera at 9%.",
      detail: "The founder wants Vera for branding power, but pushes back on dilution.",
      color: "#7ce8c8",
    },
    {
      id: "cancel-offer-3",
      at: new Date().toISOString(),
      type: "cancel_offer",
      actor: vera.fullName,
      role: vera.persona,
      sharkId: vera.id,
      toolName: "cancel_offer",
      badge: "PULL OFFER",
      summary: "Vera pulls the offer after the counter.",
      detail: "She likes the concept but not enough at 9%.",
      color: vera.color,
    },
    {
      id: "cancel-offer-4",
      at: new Date().toISOString(),
      type: "cancel_offer",
      actor: wes.fullName,
      role: wes.persona,
      sharkId: wes.id,
      toolName: "cancel_offer",
      badge: "PASS",
      summary: "Wild Wes passes and asks for a nightclub version later.",
      detail: "The chaos budget does not cover dog-projector hardware tonight.",
      color: wes.color,
    },
  ];
  const offerBoard = [
    {
      sharkId: rex.id,
      sharkName: rex.fullName,
      color: rex.color,
      status: "canceled",
      headline: null,
      cashAmountUsd: null,
      equityPercent: null,
      terms: null,
      canceledReason: "He thinks the novelty risk is too high.",
      founderMove: null,
      founderTerms: null,
    },
    {
      sharkId: luna.id,
      sharkName: luna.fullName,
      color: luna.color,
      status: "active",
      headline: "Premium pet emotion platform",
      cashAmountUsd: 500000,
      equityPercent: 10,
      terms: "Luna brings capital plus brand-building help for a premium AI pet category.",
      canceledReason: null,
      founderMove: "COUNTER",
      founderTerms: "Founder pushes from 12% down to 10%.",
    },
    {
      sharkId: max.id,
      sharkName: max.fullName,
      color: max.color,
      status: "canceled",
      headline: null,
      cashAmountUsd: null,
      equityPercent: null,
      terms: null,
      canceledReason: "The unit economics do not clear his bar.",
      founderMove: null,
      founderTerms: null,
    },
    {
      sharkId: vera.id,
      sharkName: vera.fullName,
      color: vera.color,
      status: "canceled",
      headline: "Luxury pet lifestyle brand",
      cashAmountUsd: 500000,
      equityPercent: 11,
      terms: "Vera would build the whole emotional-luxury brand around the product.",
      canceledReason: "She could not justify the risk at 9%.",
      founderMove: "COUNTER",
      founderTerms: "Founder countered down to 9%.",
    },
    {
      sharkId: wes.id,
      sharkName: wes.fullName,
      color: wes.color,
      status: "canceled",
      headline: null,
      cashAmountUsd: null,
      equityPercent: null,
      terms: null,
      canceledReason: "He wants a nightclub version for pets instead.",
      founderMove: null,
      founderTerms: null,
    },
  ];

  const packaging = {
    episodeTitle: "The Dog Collar That Turns Feelings Into Lighting Cues",
    posterSlugline: "I recreated Shark Tank, but every founder and shark is AI.",
    openingVoiceover:
      "An AI founder walks into the tank with a premium pet gadget so absurd it somehow feels inevitable.",
    closingVoiceover:
      "The room laughs, argues, and almost passes entirely, until one shark decides the spectacle might actually be the business.",
    socialCaption:
      "I recreated Shark Tank, but every founder, judge, offer, and counter is powered by AI agents. This episode: a dog-emotion collar turns living rooms into mood-lit theaters, Luna bites, Vera flirts with a deal, and the rest of the panel calls it beautifully unhinged.",
    lowerThird: "ALL-AI PITCH SIMULATION",
  };

  const timeline = [
    stageEvent({
      id: "cold-open",
      type: "cold_open",
      speaker: "Studio",
      role: "Showrunner Agent",
      eyebrow: "Opening shot",
      headline: packaging.posterSlugline,
      body: packaging.openingVoiceover,
      color: "#ffd166",
      badge: "LIVE",
    }),
    stageEvent({
      id: "pitch",
      type: "pitch",
      speaker: "Entrepreneur",
      role: "Founder Agent",
      eyebrow: founder.startupName,
      headline: `${founder.productName} enters the tank`,
      body: founder.founderPitch,
      color: "#7ce8c8",
      badge: "ASK",
    }),
    ...sharks.flatMap((shark) => {
      const events = [
        stageEvent({
          id: `${shark.id}-question`,
          type: "question",
          speaker: shark.fullName,
          role: shark.persona,
          eyebrow: "Pressure test",
          headline: shark.question,
          body: shark.openingLine,
          color: shark.color,
          badge: shark.openingDecision,
        }),
      ];

      if (shark.founderResponse) {
        events.push(
          stageEvent({
            id: `${shark.id}-counter`,
            type: "counter",
            speaker: "Entrepreneur",
            role: "Founder Agent",
            eyebrow: `Counter to ${shark.displayName}`,
            headline: "The founder pushes back",
            body: shark.founderResponse,
            color: "#7ce8c8",
            badge: "COUNTER",
          }),
        );
      }

      events.push(
        stageEvent({
          id: `${shark.id}-final`,
          type: shark.finalDecision === "DEAL" ? "deal" : "walk",
          speaker: shark.fullName,
          role: shark.persona,
          eyebrow: "Final call",
          headline: shark.finalDecision === "DEAL" ? "A shark bites" : "No deal from this chair",
          body: shark.finalLine,
          color: shark.color,
          badge: shark.finalDecision,
        }),
      );

      return events;
    }),
    stageEvent({
      id: "finale",
      type: "finale",
      speaker: "Studio",
      role: "Showrunner Agent",
      eyebrow: "Closing shot",
      headline: featuredDeal
        ? `${featuredDeal.displayName} closes the episode`
        : "The sharks walk away",
      body: packaging.closingVoiceover,
      color: "#ffd166",
      badge: featuredDeal ? "DEAL" : "NO DEAL",
    }),
  ];

  return {
    episodeNumber,
    generatedAt: new Date().toISOString(),
    source: "demo",
    theme: promptFlavor,
    packaging,
    founder,
    sharks,
    dealSummary: {
      headline: featuredDeal
        ? `${featuredDeal.displayName} takes the deal`
        : "No shark closes the round",
      investors: activeDeals.map((deal) => deal.fullName),
      finalTerms: featuredDeal ? featuredDeal.finalTerms : "No Deal",
      outcome: featuredDeal ? "Deal" : "No Deal",
      rationale: featuredDeal
        ? "Luna believed the product could become a premium cultural brand."
        : "The sharks liked the showmanship more than the economics.",
    },
    offerBoard,
    toolLedger,
    timeline,
  };
}
