// Episode providers. Each provider turns a pitch request into a complete episode
// script with the same shape (see README "Episode format"), so the browser never
// needs to know where an episode came from.
//
// The default is always offline. server.js explicitly injects the multi-provider
// live implementation only when configured for live mode.

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
