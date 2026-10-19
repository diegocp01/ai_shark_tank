import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createIdeaPitch, detectCategory, normalizeIdea } from "../../src/lib/ideaPitch.js";
import { PRESET_PITCHES } from "../../src/lib/pitchCatalog.js";
import { createRng, hashString } from "../../src/lib/rng.js";
import { assertEpisodeConsistency, createEpisode, normalizeSeed, PHASES } from "../../src/lib/scriptedEngine.js";

// Golden episodes: the exact outcome every preset produces for a given seed.
// If one of these changes, the engine's behavior changed. Update deliberately.
const GOLDEN = [
  { pitchId: "barklight", seed: 1, dealType: "Deal", sharkIds: ["wes"], terms: "$500,000 for 9.5%", beats: 25 },
  { pitchId: "barklight", seed: 7, dealType: "Deal", sharkIds: ["luna"], terms: "$500,000 for 10%", beats: 25 },
  {
    pitchId: "ledgerloop",
    seed: 1,
    dealType: "Deal",
    sharkIds: ["max"],
    terms: "$300,000 for 11.5%, plus a 3% revenue royalty until Max recoups",
    beats: 25,
  },
  { pitchId: "ledgerloop", seed: 7, dealType: "Multi-Shark Deal", sharkIds: ["max", "rex"], terms: "$300,000 for 13.5%", beats: 26 },
  { pitchId: "dumpling-dynasty", seed: 1, dealType: "No Deal", sharkIds: [], terms: "No deal", beats: 21 },
  { pitchId: "dumpling-dynasty", seed: 2, dealType: "Multi-Shark Deal", sharkIds: ["wes", "vera"], terms: "$250,000 for 33.5%", beats: 26 },
  { pitchId: "sproutsy", seed: 1, dealType: "No Deal", sharkIds: [], terms: "No deal", beats: 21 },
  { pitchId: "tidetrack", seed: 1, dealType: "Deal", sharkIds: ["luna"], terms: "$1,000,000 for 16%", beats: 23 },
  { pitchId: "odd-sox", seed: 1, dealType: "Deal", sharkIds: ["vera"], terms: "$100,000 for 29%", beats: 26 },
  {
    pitchId: "odd-sox",
    seed: 2,
    dealType: "Deal",
    sharkIds: ["max"],
    terms: "$100,000 for 35.5%, plus a 3% revenue royalty until Max recoups",
    beats: 25,
  },
];

const SPEAKERS = new Set(["narrator", "founder", "rex", "luna", "max", "vera", "wes"]);
const PHASE_ORDER = PHASES.map((phase) => phase.id);

function everyEpisode(seeds = 25) {
  const episodes = [];

  for (const pitch of PRESET_PITCHES) {
    for (let seed = 1; seed <= seeds; seed += 1) {
      episodes.push(createEpisode({ pitchId: pitch.id, seed }));
    }
  }

  return episodes;
}

describe("rng", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = createRng("x", 1);
    const b = createRng("x", 1);
    const c = createRng("x", 2);
    const seqA = Array.from({ length: 5 }, () => a.next());

    assert.deepEqual(seqA, Array.from({ length: 5 }, () => b.next()));
    assert.notDeepEqual(seqA, Array.from({ length: 5 }, () => c.next()));
    assert.equal(hashString("shark"), hashString("shark"));
  });

  it("forks are independent of the parent's consumption", () => {
    const parent = createRng("episode", 3);
    const before = parent.fork("score").next();
    parent.next();
    parent.next();
    assert.equal(parent.fork("score").next(), before);
  });
});

describe("scripted engine: golden episodes", () => {
  for (const golden of GOLDEN) {
    it(`${golden.pitchId} seed ${golden.seed} -> ${golden.dealType}`, () => {
      const episode = createEpisode({ pitchId: golden.pitchId, seed: golden.seed });

      assert.equal(episode.id, `${golden.pitchId}-s${golden.seed}`);
      assert.equal(episode.result.dealType, golden.dealType);
      assert.deepEqual(episode.result.sharkIds, golden.sharkIds);
      assert.equal(episode.result.termsLabel, golden.terms);
      assert.equal(episode.beats.length, golden.beats);
    });
  }

  it("reads the Barklight seed 1 negotiation exactly", () => {
    const episode = createEpisode({ pitchId: "barklight", seed: 1 });
    const lines = episode.beats.map((beat) => `${beat.speakerId}:${beat.kind}`);

    assert.deepEqual(lines.slice(0, 4), ["narrator:narration", "founder:entrance", "founder:pitch", "founder:pitch"]);
    assert.equal(episode.beats.at(-1).text, "Barklight Labs leaves the tank with $500,000 for 9.5% from Wild Wes. That values the company at $5.26 million, 16% under the ask.");
    assert.equal(episode.beats.find((beat) => beat.kind === "counter").text.includes("Would you do $500,000 for 9.5%?"), true);
  });
});

describe("scripted engine: determinism", () => {
  it("returns identical episodes for the same pitch and seed", () => {
    for (const pitch of PRESET_PITCHES) {
      assert.deepEqual(createEpisode({ pitchId: pitch.id, seed: 42 }), createEpisode({ pitchId: pitch.id, seed: 42 }));
    }
  });

  it("produces alternate takes across seeds", () => {
    for (const pitch of PRESET_PITCHES.filter((entry) => entry.id !== "sproutsy")) {
      const outcomes = new Set(
        Array.from({ length: 12 }, (_, index) => createEpisode({ pitchId: pitch.id, seed: index + 1 }).result.termsLabel),
      );
      assert.ok(outcomes.size >= 2, `${pitch.id} should vary across seeds`);
    }
  });

  it("covers every outcome type across the catalog", () => {
    const dealTypes = new Set(everyEpisode(10).map((episode) => episode.result.dealType));
    assert.deepEqual([...dealTypes].sort(), ["Deal", "Multi-Shark Deal", "No Deal"]);
  });
});

describe("scripted engine: invariants", () => {
  const episodes = everyEpisode();

  it("keeps the deal board consistent with the reported result", () => {
    for (const episode of episodes) {
      assert.doesNotThrow(() => assertEpisodeConsistency(episode), episode.id);
    }
  });

  it("uses known speakers, non-empty lines, and phases in order", () => {
    for (const episode of episodes) {
      let phaseIndex = 0;

      episode.beats.forEach((beat, index) => {
        assert.ok(SPEAKERS.has(beat.speakerId), `${episode.id} beat ${index} speaker`);
        assert.ok(beat.text.trim().length > 0, `${episode.id} beat ${index} text`);
        assert.ok(!/(?<!\.)\.\.(?!\.)|undefined|NaN|\[object/.test(beat.text), `${episode.id} beat ${index}: ${beat.text}`);
        assert.equal(beat.index, index);
        const next = PHASE_ORDER.indexOf(beat.phase);
        assert.ok(next >= phaseIndex, `${episode.id} phases go backwards at ${index}`);
        phaseIndex = next;
      });

      assert.equal(episode.beats[0].speakerId, "narrator");
      assert.equal(episode.beats.at(-1).kind, "verdict");
    }
  });

  it("asks five questions with five distinct answers", () => {
    for (const episode of episodes) {
      const questions = episode.beats.filter((beat) => beat.kind === "question");
      const answers = episode.beats.filter((beat) => beat.kind === "answer").map((beat) => beat.text);

      assert.equal(questions.length, 5, episode.id);
      assert.equal(new Set(questions.map((beat) => beat.speakerId)).size, 5, episode.id);
      assert.equal(new Set(answers).size, 5, `${episode.id} repeats an answer`);
    }
  });

  it("gives every shark exactly one opening decision", () => {
    for (const episode of episodes) {
      const decisions = episode.beats.filter((beat) => beat.kind === "offer" || beat.kind === "out");
      assert.deepEqual(decisions.map((beat) => beat.speakerId).sort(), ["luna", "max", "rex", "vera", "wes"], episode.id);
    }
  });

  it("never offers better than the ask or more than 60%", () => {
    for (const episode of episodes) {
      for (const beat of episode.beats) {
        for (const effect of beat.effects) {
          if (effect.offer) {
            assert.ok(effect.offer.equityPct >= episode.pitch.equityPct, `${episode.id} ${effect.type}`);
            assert.ok(effect.offer.equityPct <= 60, `${episode.id} ${effect.type}`);
            assert.equal(effect.offer.cashUsd, episode.pitch.askUsd);
          }
        }
      }
    }
  });

  it("only celebrates deals that a shark actually offered", () => {
    for (const episode of episodes.filter((entry) => entry.result.outcome === "deal")) {
      const offeredBy = new Set(
        episode.beats.flatMap((beat) => beat.effects.filter((effect) => effect.type === "offer").map((effect) => effect.sharkId)),
      );

      for (const sharkId of episode.result.sharkIds) {
        assert.ok(offeredBy.has(sharkId), `${episode.id}: ${sharkId} closed without offering`);
      }
    }
  });
});

describe("custom ideas", () => {
  it("normalizes and names ideas deterministically", () => {
    const pitch = createIdeaPitch("  a marketplace for renting wedding dresses!! ", 1);

    assert.equal(normalizeIdea("  a <b>bold</b>\n idea. "), "a bbold/b idea");
    assert.equal(pitch.productName, "WeddingDress");
    assert.equal(pitch.startupName, "WeddingDress Works");
    assert.equal(pitch.category, "marketplace");
    assert.deepEqual(pitch, createIdeaPitch("a marketplace for renting wedding dresses", 1));
  });

  it("detects categories from keywords", () => {
    assert.equal(detectCategory("solar powered compost bins"), "climate");
    assert.equal(detectCategory("AI-powered sock matching service"), "consumer");
    assert.equal(detectCategory("an AI app for sock matching"), "software");
    assert.equal(detectCategory("a robot that folds laundry"), "hardware");
    assert.equal(detectCategory("sleep coaching for night-shift nurses"), "health");
    assert.equal(detectCategory("something nobody has words for"), "consumer");
  });

  it("builds a full, consistent episode from an idea", () => {
    const episode = createEpisode({ idea: "a marketplace for renting wedding dresses", seed: 1 });

    assert.equal(episode.pitch.custom, true);
    assert.equal(episode.id.startsWith("idea-"), true);
    assert.equal(episode.result.headline, "WeddingDress Works leaves without a deal");
    assert.doesNotThrow(() => assertEpisodeConsistency(episode));
  });

  it("rejects empty ideas and bad seeds", () => {
    assert.throws(() => createIdeaPitch("   ", 1), /Describe a startup idea/);
    assert.throws(() => createEpisode({ pitchId: "nope" }), /Unknown pitch/);
    assert.throws(() => createEpisode({}), /Pick a pitch/);
    assert.equal(normalizeSeed(undefined), 1);
    assert.equal(normalizeSeed("12"), 12);
    assert.throws(() => normalizeSeed(0), /Seed must be/);
    assert.throws(() => normalizeSeed(1.5), /Seed must be/);
    assert.throws(() => normalizeSeed(1_000_000), /Seed must be/);
  });
});
