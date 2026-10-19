import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { beatTiming, CHARS_PER_SECOND, createDirector } from "../../public/js/director.js";

const BEATS = [
  { id: "b1", kind: "narration", speakerId: "narrator", text: "Tonight in the tank.", effects: [] },
  { id: "b2", kind: "offer", speakerId: "luna", text: "I'll offer $500,000 for 12%.", effects: [{ type: "offer" }] },
  { id: "b3", kind: "accept", speakerId: "founder", text: "Deal!", tone: "deal", effects: [{ type: "deal" }] },
];

function record() {
  const events = [];
  const hooks = new Proxy(
    {},
    {
      get(_target, name) {
        return (...args) => {
          events.push([name, ...args.map((arg) => (arg && arg.id ? arg.id : arg))]);
        };
      },
    },
  );

  return { events, hooks };
}

function totalMs(beat) {
  const timing = beatTiming(beat);
  return timing.preMs + timing.typeMs + timing.holdMs;
}

describe("director", () => {
  it("types each line, lands its effects once, then finishes", () => {
    const { events, hooks } = record();
    const director = createDirector({ beats: BEATS, hooks, autoRun: false });

    director.play();
    assert.equal(director.state.index, 0);

    director.step(beatTiming(BEATS[0]).preMs + 250);
    const partial = events.filter(([name]) => name === "onType").at(-1);
    assert.equal(partial[2], BEATS[0].text.slice(0, Math.floor(0.25 * CHARS_PER_SECOND)));

    for (const beat of BEATS) {
      director.step(totalMs(beat));
    }

    const landed = events.filter(([name]) => name === "onLanded").map(([, id]) => id);
    assert.deepEqual(landed, ["b1", "b2", "b3"]);
    assert.equal(director.state.status, "finished");
    assert.equal(events.filter(([name]) => name === "onFinish").length, 1);
    assert.ok(events.some(([name, id]) => name === "onThinking" && id === "b2"));
  });

  it("does not advance while paused", () => {
    const { hooks } = record();
    const director = createDirector({ beats: BEATS, hooks, autoRun: false });

    director.play();
    director.pause();
    director.step(60_000);
    assert.equal(director.state.index, 0);
    assert.equal(director.state.status, "paused");

    director.play();
    director.step(totalMs(BEATS[0]) + 1);
    assert.equal(director.state.index, 1);
  });

  it("scales time with speed", () => {
    const { hooks } = record();
    const director = createDirector({ beats: BEATS, hooks, autoRun: false, speed: 4 });

    director.play();
    director.step(totalMs(BEATS[0]) / 4 + 1);
    assert.equal(director.state.index, 1);
  });

  it("next() completes the current line and moves on", () => {
    const { events, hooks } = record();
    const director = createDirector({ beats: BEATS, hooks, autoRun: false });

    director.play();
    director.next();

    assert.equal(director.state.index, 1);
    assert.deepEqual(events.filter(([name]) => name === "onLanded").map(([, id]) => id), ["b1"]);
    const typed = events.filter(([name, id]) => name === "onType" && id === "b1").at(-1);
    assert.equal(typed[2], BEATS[0].text);
  });

  it("finish() lands every remaining beat silently, in order", () => {
    const { events, hooks } = record();
    const director = createDirector({ beats: BEATS, hooks, autoRun: false });

    director.play();
    director.finish();

    const landed = events.filter(([name]) => name === "onLanded");
    assert.deepEqual(landed.map(([, id]) => id), ["b1", "b2", "b3"]);
    assert.ok(landed.every(([, , options]) => options.silent === true));
    assert.equal(director.state.status, "finished");
  });

  it("holds a line until its voice finishes speaking", async () => {
    let finishSpeaking;
    const speech = new Promise((resolve) => {
      finishSpeaking = resolve;
    });
    const director = createDirector({
      beats: BEATS,
      autoRun: false,
      hooks: { onSpeak: (beat) => (beat.id === "b1" ? speech : null) },
    });

    director.play();
    director.step(totalMs(BEATS[0]) * 3);
    assert.equal(director.state.index, 0, "still waiting on speech");

    finishSpeaking();
    await speech;
    director.step(1);
    assert.equal(director.state.index, 1);
  });
});
