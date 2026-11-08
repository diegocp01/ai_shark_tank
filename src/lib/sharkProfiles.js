// Five AI portrayals. Weights and thresholds are used only in scripted mode.
// Live decisions come from the assigned model; look is purely visual.
export const SHARK_PROFILES = [
  {
    id: "rex",
    displayName: "Kevin O’Leary",
    fullName: "Kevin O’Leary",
    persona: "Cash Flow & Returns",
    style:
      "Pokes holes in every assumption, pressures the founder on execution risk, and speaks like a brutal operator.",
    color: "#ff6b57",
    accent: "#ffd6cf",
    icon: "KO",
    // Looks nod to the real panel (signature hair, glasses, outfits); names identify AI dramatizations, not real statements or endorsements.
    look: { top: "suit", suit: "#15171c", tie: "#1d1f24", skin: "#dca587", hair: "#b9b6ae", hairStyle: "bald", brows: "flat", mouth: "neutral", glasses: "round", model: "kevin" },
    voice: { pitch: 0.7, rate: 0.98 },
    weights: { traction: 0.36, defensibility: 0.26, risk: -0.3, unitEconomics: 0.2, novelty: -0.04 },
    threshold: 0.66,
  },
  {
    id: "luna",
    displayName: "Lori Greiner",
    fullName: "Lori Greiner",
    persona: "Consumer Products",
    style: "Examines product usefulness, demonstration, patents, retail demand and distribution.",
    color: "#7ce8c8",
    accent: "#dffff6",
    icon: "LG",
    look: { top: "dress", suit: "#1b1a1e", skin: "#e6b08f", hair: "#d4b889", hairStyle: "long-straight", brows: "soft", mouth: "lipstick", lipstick: "#d2546b", lashes: true, model: "lori" },
    voice: { pitch: 1.2, rate: 1.02 },
    weights: { novelty: 0.34, scalability: 0.34, brand: 0.12, traction: 0.12, risk: -0.08 },
    threshold: 0.66,
  },
  {
    id: "max",
    displayName: "Daymond John",
    fullName: "Daymond John",
    persona: "Brand & Distribution",
    style: "Examines brand identity, licensing, manufacturing margins and customer acquisition.",
    color: "#f5c453",
    accent: "#fff0bf",
    icon: "DJ",
    look: { top: "suit", suit: "#1f2a44", skin: "#5e3b28", hair: "#141012", hairStyle: "shaved", brows: "flat", mouth: "neutral", beard: "full" },
    voice: { pitch: 0.9, rate: 1.08 },
    weights: { unitEconomics: 0.36, margin: 0.3, traction: 0.26, risk: -0.12 },
    threshold: 0.68,
  },
  {
    id: "vera",
    displayName: "Barbara Corcoran",
    fullName: "Barbara Corcoran",
    persona: "Founder & Sales",
    style: "Thinks in story, taste, social proof, and whether a brand can become iconic.",
    color: "#ff8bc2",
    accent: "#ffe0f0",
    icon: "BC",
    look: { top: "blazer", suit: "#c42a1a", skin: "#e8b597", hair: "#d1b88b", hairStyle: "feathered", brows: "arched", mouth: "lipstick", lipstick: "#c23d5c", earrings: "pearl", lashes: true, model: "barbara" },
    voice: { pitch: 1.1, rate: 0.96 },
    weights: { brand: 0.46, novelty: 0.16, margin: 0.16, traction: 0.12, risk: -0.1 },
    threshold: 0.67,
  },
  {
    id: "wes",
    displayName: "Mark Cuban",
    fullName: "Mark Cuban",
    persona: "Technology & Scale",
    style:
      "Examines technology, scalability, customer demand and the founder’s ability to execute.",
    color: "#86a5ff",
    accent: "#dde6ff",
    icon: "MC",
    look: { top: "open-collar", suit: "#1d2c45", trousers: "#192635", skin: "#dea686", hair: "#3b2a20", hairStyle: "short", brows: "raised", mouth: "grin", model: "mark" },
    voice: { pitch: 1.35, rate: 1.14 },
    weights: { novelty: 0.4, brand: 0.14, scalability: 0.1, risk: 0.06 },
    threshold: 0.7,
    chaos: 0.18,
  },
];

export function getSharkProfileById(id) {
  return SHARK_PROFILES.find((profile) => profile.id === id);
}

// Fields the browser needs. Scoring weights stay on the server.
export function toPublicShark(profile) {
  const { weights, threshold, chaos, ...publicFields } = profile;
  return publicFields;
}
