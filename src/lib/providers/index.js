// Episode providers. Each provider turns a pitch request into a complete episode
// script with the same shape (see README "Episode format"), so the browser never
// needs to know where an episode came from.
//
// Only the deterministic scripted provider exists today. A live model-backed
// provider can be added later by implementing the same interface:
//
//   {
//     id: "live",
//     label: "Live agents",
//     live: true,
//     async createEpisode({ pitchId, idea, seed }) { return episode; },
//   }
//
// and selecting it in getEpisodeProvider().

import { createEpisode } from "../scriptedEngine.js";

export const scriptedProvider = {
  id: "scripted",
  label: "Scripted engine",
  live: false,
  async createEpisode(request) {
    return createEpisode(request);
  },
};

export function getEpisodeProvider() {
  return scriptedProvider;
}

export function describeProvider(provider = getEpisodeProvider()) {
  return { id: provider.id, label: provider.label, live: provider.live };
}
