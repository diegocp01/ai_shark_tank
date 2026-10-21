// Plays an episode script beat by beat: an optional "thinking" pause, a
// typewriter line, the beat's effects landing, then a hold before the next beat.
// It owns no DOM. Time only moves through step(), so tests can drive it exactly.

export const CHARS_PER_SECOND = 44;

const THINKING_KINDS = new Set(["offer", "out", "bid", "hold", "revise", "accept-counter", "team"]);

export function beatTiming(beat) {
  const length = beat.text?.length || 0;
  let preMs = 260;

  if (beat.kind === "entrance") {
    preMs = 3400;
  } else if (THINKING_KINDS.has(beat.kind)) {
    preMs = beat.kind === "offer" || beat.kind === "out" ? 1100 : 700;
  } else if (beat.kind === "verdict") {
    preMs = 600;
  }

  const typeMs = (length / CHARS_PER_SECOND) * 1000;
  let holdMs = Math.min(2600, Math.max(900, 650 + length * 7));

  if (beat.tone === "deal" || beat.tone === "no-deal") {
    holdMs += 1200;
  }

  if (beat.kind === "verdict") {
    holdMs = 2400;
  }

  return { preMs, typeMs, holdMs, thinks: THINKING_KINDS.has(beat.kind) };
}

export function createDirector({ beats, speed = 1, hooks = {}, clock = null, autoRun = true } = {}) {
  const state = {
    index: -1,
    status: "idle", // idle | playing | paused | finished
    stage: "pre", // pre | typing | holding
    elapsed: 0,
    speed,
    landed: false,
    speechDone: true,
  };
  const scheduler = clock || defaultClock();
  let timer = null;
  let lastNow = null;

  function call(name, ...args) {
    return hooks[name]?.(...args);
  }

  function setStatus(status) {
    if (state.status !== status) {
      state.status = status;
      call("onStatus", status);
    }
  }

  function currentBeat() {
    return beats[state.index] || null;
  }

  function beginBeat(index) {
    state.index = index;
    state.stage = "pre";
    state.elapsed = 0;
    state.landed = false;
    state.speechDone = true;
    const beat = currentBeat();
    const timing = beatTiming(beat);
    call("onBeatStart", beat, { index, total: beats.length, timing });

    if (timing.thinks) {
      call("onThinking", beat);
    }
  }

  function land({ silent = false } = {}) {
    if (state.landed) {
      return;
    }

    const beat = currentBeat();
    state.landed = true;
    call("onType", beat, beat.text || "");
    call("onLanded", beat, { silent });
  }

  function endBeat() {
    const beat = currentBeat();
    call("onBeatEnd", beat);

    if (state.index + 1 >= beats.length) {
      finishShow();
      return;
    }

    beginBeat(state.index + 1);
  }

  function finishShow() {
    stopLoop();
    state.stage = "holding";
    setStatus("finished");
    call("onFinish");
  }

  function startSpeech() {
    const beat = currentBeat();
    const result = call("onSpeak", beat, state.speed);

    if (result && typeof result.then === "function") {
      state.speechDone = false;
      const token = state.index;
      result.then(
        () => {
          if (state.index === token) {
            state.speechDone = true;
          }
        },
        () => {
          if (state.index === token) {
            state.speechDone = true;
          }
        },
      );
    }
  }

  // Advance the show by dtMs of wall-clock time (scaled by speed).
  function step(dtMs) {
    if (state.status !== "playing") {
      return;
    }

    let budget = dtMs * state.speed;

    // Loop so a large dt (tests, background tabs) can cross several stages.
    for (let guard = 0; guard < 1000 && state.status === "playing"; guard += 1) {
      const beat = currentBeat();
      const timing = beatTiming(beat);

      if (state.stage === "pre") {
        const remaining = timing.preMs - state.elapsed;

        if (budget < remaining) {
          state.elapsed += budget;
          return;
        }

        budget -= remaining;
        state.stage = "typing";
        state.elapsed = 0;
        call("onTypingStart", beat);
        startSpeech();
        continue;
      }

      if (state.stage === "typing") {
        const remaining = timing.typeMs - state.elapsed;

        if (budget < remaining) {
          state.elapsed += budget;
          const visible = Math.floor((state.elapsed / 1000) * CHARS_PER_SECOND);
          call("onType", beat, (beat.text || "").slice(0, visible));
          return;
        }

        budget -= Math.max(0, remaining);
        land();
        state.stage = "holding";
        state.elapsed = 0;
        continue;
      }

      const remaining = timing.holdMs - state.elapsed;

      if (budget < remaining || !state.speechDone) {
        state.elapsed = Math.min(timing.holdMs, state.elapsed + budget);
        return;
      }

      budget -= remaining;
      endBeat();
    }
  }

  function loop() {
    const now = scheduler.now();
    const dt = lastNow === null ? 0 : Math.min(250, now - lastNow);
    lastNow = now;
    step(dt);

    if (state.status === "playing") {
      timer = scheduler.setTimeout(loop, 33);
    }
  }

  function startLoop() {
    if (!autoRun) {
      return;
    }

    stopLoop();
    lastNow = scheduler.now();
    timer = scheduler.setTimeout(loop, 33);
  }

  function stopLoop() {
    if (timer !== null) {
      scheduler.clearTimeout(timer);
      timer = null;
    }

    lastNow = null;
  }

  return {
    get state() {
      return { ...state, beat: currentBeat() };
    },
    step,
    play() {
      if (state.status === "finished") {
        return;
      }

      if (state.index < 0) {
        setStatus("playing");
        beginBeat(0);
      } else {
        setStatus("playing");
        call("onResume");
      }

      startLoop();
    },
    pause() {
      if (state.status !== "playing") {
        return;
      }

      stopLoop();
      setStatus("paused");
      call("onPause");
    },
    toggle() {
      if (state.status === "playing") {
        this.pause();
      } else {
        this.play();
      }
    },
    // Complete the current line (text + effects) and move to the next one.
    next() {
      if (state.status === "finished" || state.index < 0) {
        return;
      }

      call("onSkip", currentBeat());
      land();
      state.speechDone = true;
      endBeat();
    },
    // Jump straight to the end, landing every remaining beat's effects in order.
    finish() {
      if (state.status === "finished") {
        return;
      }

      if (state.index < 0) {
        beginBeat(0);
      }

      call("onSkip", currentBeat());

      while (state.status !== "finished") {
        land({ silent: true });
        state.speechDone = true;
        call("onBeatEnd", currentBeat());

        if (state.index + 1 >= beats.length) {
          finishShow();
          break;
        }

        state.index += 1;
        state.landed = false;
        call("onBeatStart", currentBeat(), { index: state.index, total: beats.length, timing: beatTiming(currentBeat()), silent: true });
      }
    },
    setSpeed(nextSpeed) {
      state.speed = nextSpeed;
    },
    destroy() {
      stopLoop();
      setStatus("idle");
    },
  };
}

function defaultClock() {
  return {
    now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
}
