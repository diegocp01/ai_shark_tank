import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyEffect, boardAt, createBoard } from "../../src/shared/board.js";
import {
  formatMoneyShort,
  formatMoneySpoken,
  formatOfferFull,
  formatOfferShort,
  formatPercent,
  formatValuationSpoken,
  impliedValuation,
  roundHalf,
} from "../../src/shared/format.js";
import { createEpisode } from "../../src/lib/scriptedEngine.js";

const OFFER = (equityPct) => ({ cashUsd: 500_000, equityPct, kicker: null });

function boardFor() {
  return createBoard({
    pitch: { askUsd: 500_000, equityPct: 8 },
    sharks: ["rex", "luna", "max", "vera", "wes"].map((id) => ({ id })),
  });
}

describe("format", () => {
  it("formats money for speech and for chips", () => {
    assert.equal(formatMoneySpoken(500_000), "$500,000");
    assert.equal(formatMoneySpoken(1_250_000), "$1.25 million");
    assert.equal(formatMoneyShort(500_000), "$500K");
    assert.equal(formatMoneyShort(1_250_000), "$1.25M");
    assert.equal(formatMoneyShort(2_600), "$2.6K");
    assert.equal(formatMoneyShort(46), "$46");
  });

  it("rounds valuations to three significant figures when spoken", () => {
    assert.equal(formatValuationSpoken(344_828), "$345,000");
    assert.equal(formatValuationSpoken(5_263_158), "$5.26 million");
  });

  it("handles percents, halves, and offers", () => {
    assert.equal(formatPercent(9.5), "9.5%");
    assert.equal(formatPercent(10), "10%");
    assert.equal(roundHalf(12.26), 12.5);
    assert.equal(roundHalf(12.24), 12);
    assert.equal(impliedValuation(500_000, 8), 6_250_000);
    assert.equal(impliedValuation(0, 8), 0);

    const offer = { cashUsd: 300_000, equityPct: 12, kicker: { label: "plus a royalty", short: "royalty" } };
    assert.equal(formatOfferShort(offer), "$300K for 12% + royalty");
    assert.equal(formatOfferFull(offer), "$300,000 for 12%, plus a royalty");
  });
});

describe("deal board reducer", () => {
  it("tracks offers, counters, and a deal, declining the losing offer", () => {
    let board = boardFor();
    board = applyEffect(board, { type: "out", sharkId: "rex" });
    board = applyEffect(board, { type: "offer", sharkId: "luna", offer: OFFER(13.5) });
    board = applyEffect(board, { type: "offer", sharkId: "wes", offer: OFFER(11) });
    board = applyEffect(board, { type: "counter", sharkIds: ["wes"], offer: OFFER(9.5) });

    assert.equal(board.sharks.wes.status, "countered");
    assert.equal(board.sharks.wes.counter.equityPct, 9.5);

    board = applyEffect(board, { type: "deal", sharkIds: ["wes"], offer: OFFER(9.5) });

    assert.equal(board.sharks.rex.status, "out");
    assert.equal(board.sharks.luna.status, "declined");
    assert.equal(board.sharks.max.status, "waiting");
    assert.equal(board.sharks.wes.status, "deal");
    assert.deepEqual(board.outcome, { type: "deal", sharkIds: ["wes"], offer: OFFER(9.5) });
  });

  it("links team offers and keeps them linked through revisions", () => {
    let board = applyEffect(boardFor(), { type: "team", sharkIds: ["max", "rex"], offer: OFFER(18) });
    board = applyEffect(board, { type: "revise", sharkIds: ["max", "rex"], offer: OFFER(16) });

    assert.equal(board.sharks.max.status, "team");
    assert.deepEqual(board.sharks.max.partners, ["rex"]);
    assert.equal(board.sharks.rex.offer.equityPct, 16);
  });

  it("declines open offers on no deal and never mutates the input", () => {
    const start = applyEffect(boardFor(), { type: "offer", sharkId: "vera", offer: OFFER(20) });
    const end = applyEffect(start, { type: "no_deal" });

    assert.equal(start.sharks.vera.status, "offer");
    assert.equal(end.sharks.vera.status, "declined");
    assert.equal(end.outcome.type, "no_deal");
    assert.throws(() => applyEffect(end, { type: "mystery" }), /Unknown board effect/);
  });

  it("replays a real episode to its result", () => {
    const episode = createEpisode({ pitchId: "ledgerloop", seed: 7 });
    const before = boardAt(episode, -1);
    const after = boardAt(episode, episode.beats.length - 1);

    assert.equal(before.outcome, null);
    assert.deepEqual(after.outcome.sharkIds, ["max", "rex"]);
    assert.equal(after.outcome.offer.equityPct, 13.5);
  });
});
