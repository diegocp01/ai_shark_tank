// The deal board: a pure reducer over beat effects. The browser uses it to render
// live negotiation state, and tests use it to prove an episode's effects add up
// to the outcome the engine reports.

export const SHARK_STATUSES = ["waiting", "out", "offer", "team", "countered", "deal", "declined"];

const OPEN_STATUSES = new Set(["offer", "team", "countered"]);

export function createBoard(episode) {
  return {
    ask: {
      cashUsd: episode.pitch.askUsd,
      equityPct: episode.pitch.equityPct,
    },
    sharks: Object.fromEntries(
      episode.sharks.map((shark) => [
        shark.id,
        { status: "waiting", offer: null, counter: null, partners: [] },
      ]),
    ),
    outcome: null,
  };
}

function cloneBoard(board) {
  return {
    ask: { ...board.ask },
    sharks: Object.fromEntries(
      Object.entries(board.sharks).map(([id, entry]) => [
        id,
        { ...entry, partners: [...entry.partners] },
      ]),
    ),
    outcome: board.outcome ? { ...board.outcome, sharkIds: [...board.outcome.sharkIds] } : null,
  };
}

function idsOf(effect) {
  if (Array.isArray(effect.sharkIds)) {
    return effect.sharkIds;
  }

  return effect.sharkId ? [effect.sharkId] : [];
}

export function applyEffect(board, effect) {
  const next = cloneBoard(board);
  const ids = idsOf(effect);

  switch (effect.type) {
    case "offer":
    case "revise":
      for (const id of ids) {
        const entry = next.sharks[id];
        entry.status = entry.partners.length > 0 ? "team" : "offer";
        entry.offer = { ...effect.offer };
        entry.counter = null;
      }
      break;
    case "out":
      for (const id of ids) {
        Object.assign(next.sharks[id], { status: "out", offer: null, counter: null, partners: [] });
      }
      break;
    case "team":
      for (const id of ids) {
        Object.assign(next.sharks[id], {
          status: "team",
          offer: { ...effect.offer },
          counter: null,
          partners: ids.filter((other) => other !== id),
        });
      }
      break;
    case "counter":
      for (const id of ids) {
        next.sharks[id].status = "countered";
        next.sharks[id].counter = { ...effect.offer };
      }
      break;
    case "deal":
      for (const [id, entry] of Object.entries(next.sharks)) {
        if (ids.includes(id)) {
          Object.assign(entry, { status: "deal", offer: { ...effect.offer }, counter: null });
        } else if (OPEN_STATUSES.has(entry.status)) {
          entry.status = "declined";
        }
      }
      next.outcome = { type: "deal", sharkIds: [...ids], offer: { ...effect.offer } };
      break;
    case "no_deal":
      for (const entry of Object.values(next.sharks)) {
        if (OPEN_STATUSES.has(entry.status)) {
          entry.status = "declined";
        }
      }
      next.outcome = { type: "no_deal", sharkIds: [], offer: null };
      break;
    default:
      throw new Error(`Unknown board effect: ${effect.type}`);
  }

  return next;
}

export function applyBeat(board, beat) {
  return (beat.effects || []).reduce(applyEffect, board);
}

// Board state after the beat at `index` has landed (index -1 = before the show).
export function boardAt(episode, index) {
  return episode.beats.slice(0, index + 1).reduce(applyBeat, createBoard(episode));
}
