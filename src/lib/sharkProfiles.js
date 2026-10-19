// The five AI sharks. `weights` drive how each shark scores a pitch, `threshold`
// is the score they need before they make an offer, and `look` is purely visual.
export const SHARK_PROFILES = [
  {
    id: "rex",
    displayName: "Rex",
    fullName: "Rex The Skeptic",
    persona: "The Skeptic",
    style:
      "Pokes holes in every assumption, pressures the founder on execution risk, and speaks like a brutal operator.",
    color: "#ff6b57",
    accent: "#ffd6cf",
    icon: "RX",
    look: { suit: "#3a1b22", shell: "#5d6472", eyes: "skeptic" },
    voice: { pitch: 0.7, rate: 0.98 },
    weights: { traction: 0.36, defensibility: 0.26, risk: -0.3, unitEconomics: 0.2, novelty: -0.04 },
    threshold: 0.66,
  },
  {
    id: "luna",
    displayName: "Luna",
    fullName: "Luna The Visionary",
    persona: "The Visionary",
    style: "Obsessed with category creation, future culture shifts, and bold moonshot potential.",
    color: "#7ce8c8",
    accent: "#dffff6",
    icon: "LU",
    look: { suit: "#1d3b35", shell: "#e4edf0", eyes: "visionary" },
    voice: { pitch: 1.2, rate: 1.02 },
    weights: { novelty: 0.34, scalability: 0.34, brand: 0.12, traction: 0.12, risk: -0.08 },
    threshold: 0.66,
  },
  {
    id: "max",
    displayName: "Max",
    fullName: "Max The Numbers Shark",
    persona: "The Numbers Shark",
    style: "Lives inside margins, CAC, LTV, payback periods, and ruthless revenue logic.",
    color: "#f5c453",
    accent: "#fff0bf",
    icon: "MX",
    look: { suit: "#2b2f3a", shell: "#d8cba6", eyes: "numbers" },
    voice: { pitch: 0.9, rate: 1.08 },
    weights: { unitEconomics: 0.36, margin: 0.3, traction: 0.26, risk: -0.12 },
    threshold: 0.68,
  },
  {
    id: "vera",
    displayName: "Vera",
    fullName: "Vera The Brand Guru",
    persona: "The Brand Guru",
    style: "Thinks in story, taste, social proof, and whether a brand can become iconic.",
    color: "#ff8bc2",
    accent: "#ffe0f0",
    icon: "VR",
    look: { suit: "#3d2340", shell: "#ecc2ba", eyes: "brand" },
    voice: { pitch: 1.1, rate: 0.96 },
    weights: { brand: 0.46, novelty: 0.16, margin: 0.16, traction: 0.12, risk: -0.1 },
    threshold: 0.67,
  },
  {
    id: "wes",
    displayName: "Wild Wes",
    fullName: "Wild Wes The Wildcard",
    persona: "The Wildcard",
    style:
      "Chaotic energy, weird instincts, and the ability to either lowball hard or go all-in for spectacle.",
    color: "#86a5ff",
    accent: "#dde6ff",
    icon: "WW",
    look: { suit: "#1f2e5c", shell: "#a9b9e6", eyes: "wildcard" },
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
