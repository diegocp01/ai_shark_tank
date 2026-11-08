import assert from "node:assert/strict";
import { test } from "node:test";
import { createPitchDeck, createModelDeckProvider, sanitizeSlide } from "../../src/lib/pitchDeck.js";
import { createEpisode } from "../../src/lib/scriptedEngine.js";
import { PRESET_PITCHES } from "../../src/lib/pitchCatalog.js";
import { deckSlideAtBeat } from "../../src/shared/deckTimeline.js";

const episode = createEpisode({ pitchId: "barklight", seed: 1 });
test("mock HTML decks are deterministic, personalized and scheduled to real beats", async () => {
  for (const pitch of [...PRESET_PITCHES.map(p => ({ pitchId: p.id })), { idea: "A reusable lunchbox for office workers" }]) {
    const run = createEpisode({ ...pitch, seed: 1 });
    const deck = await createPitchDeck(run);
    assert.deepEqual(deck, await createPitchDeck(run));
    assert.equal(deck.provider.live, false);
    assert.equal(deck.slides.length, 4);
    assert.ok(deck.slides[0].html.includes(run.pitch.startupName));
    assert.equal(run.beats[deck.slides[1].beatIndex].kind, "pitch");
    assert.match(deck.download.content, /Content-Security-Policy/);
    assert.match(deck.download.fileName, /\.html$/);
    assert.equal(deckSlideAtBeat(deck, 0), 0);
    assert.equal(deckSlideAtBeat(deck, 2), 1);
    assert.equal(deckSlideAtBeat(deck, 3), 2);
    assert.equal(deckSlideAtBeat(deck, run.beats.length - 1), 3);
    assert.equal(deckSlideAtBeat(deck, 0), 0);
  }
});
test("model adapter accepts an injected generator and sanitizes its output", async () => {
  let input;
  const provider = createModelDeckProvider({ generate: async (request) => {
    input = request;
    return { title: "Generated deck", slides: [{ title: "Start", beatId: episode.beats[0].id, html: '<h1 onclick="alert(1)" style="color:#fff;background-image:url(https://example.com/x)">New idea</h1><script>alert(1)</script><img src="https://example.com/x">' }] };
  } });
  const deck = await createPitchDeck(episode, provider);
  assert.equal(input.episode, episode);
  assert.match(input.system, /1280x720/);
  assert.equal(deck.provider.live, true);
  assert.match(deck.slides[0].html, /New idea/);
  assert.doesNotMatch(deck.slides[0].html, /script|onclick|https|alert|img/);
});
test("HTML cannot embed remote content, active markup or escaping styles", () => {
  const clean = sanitizeSlide('<style>@import "https://evil.test";</style><iframe src="https://evil.test">bad</iframe><svg onload="alert(1)"><image href="x"/></svg><form action="x"><input/></form><div style="background-color:var(--remote);width:expression(alert(1));position:fixed;color:red">Safe &amp; sound</div>');
  assert.equal(clean, '<div style="color:red">Safe &amp; sound</div>');
});
test("rejects malformed, empty, oversized and unscheduled model output", async () => {
  const slide = { title: "Start", beatId: episode.beats[0].id, html: "<p>Start</p>" };
  for (const raw of [null, { title: "x", slides: [] }, { title: "x", slides: Array(9).fill(slide) }, { title: "x", slides: [slide, slide] }, { title: "x", slides: [{ ...slide, beatId: "missing" }] }, { title: "x", slides: [{ ...slide, beatId: episode.beats[1].id }] }, { title: "x", slides: [{ ...slide, html: "a".repeat(40001) }] }, { title: "x", slides: [{ ...slide, html: "<script>unsafe()</script>" }] }]) {
    await assert.rejects(createPitchDeck(episode, { generateDeck: async () => raw }));
  }
});
