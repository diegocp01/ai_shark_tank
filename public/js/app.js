import { applyBeat, createBoard } from "/shared/board.js";
import { formatMoneyShort, formatPercent } from "/shared/format.js";
import { createConfetti } from "./confetti.js";
import { createDirector } from "./director.js";
import { avatar } from "./figures.js";
import { icon } from "./icons.js";
import {
  createCaption,
  createTranscript,
  escapeHtml,
  renderBoard,
  renderPhaseRail,
  renderVerdict,
} from "./panels.js";
import { createStage } from "./stage.js";
import { createVoice } from "./voice.js";

const SPEEDS = [1, 1.5, 2, 3];
const $ = (selector) => document.querySelector(selector);

const elements = {
  body: document.body,
  frame: $("#stage-frame"),
  scene: $("#scene"),
  hero: $("#hero"),
  heroTitle: $("#hero-title"),
  heroTagline: $("#hero-tagline"),
  heroChips: $("#hero-chips"),
  hudSeed: $("#hud-seed"),
  timecode: $("#timecode"),
  phaseRail: $("#phase-rail"),
  stamp: $("#stamp"),
  stampLabel: $("#stamp-label"),
  confetti: $("#confetti"),
  caption: $("#caption"),
  transport: $("#transport"),
  progressTrack: $("#progress-track"),
  progressFill: $("#progress-fill"),
  progressLabel: $("#progress-label"),
  speed: $("#speed"),
  meetList: $("#meet-list"),
  dossier: $("#dossier"),
  pitchList: $("#pitch-list"),
  ideaInput: $("#idea-input"),
  charCount: $("#char-count"),
  seedInput: $("#seed-input"),
  seedDice: $("#seed-dice"),
  lobbyError: $("#lobby-error"),
  rollButton: $("#roll-button"),
  tabs: document.querySelectorAll(".tab"),
  boardPanel: $("#board-panel"),
  transcriptPanel: $("#transcript-panel"),
  verdict: $("#verdict"),
  toast: $("#toast"),
  announcer: $("#announcer"),
  providerLabel: $("#provider-label"),
};

const state = {
  config: null,
  view: "lobby",
  selection: { pitchId: null, idea: "", seed: 1 },
  episode: null,
  download: null,
  allTime: null,
  board: null,
  director: null,
  speed: 1,
  voiceOn: false,
  thinkingId: null,
  playedMs: 0,
  clockStartedAt: null,
  loading: false,
  autoplay: false,
};

const stage = createStage({ root: elements.scene, frame: elements.frame });
const caption = createCaption(elements.caption);
const transcript = createTranscript(elements.transcriptPanel);
const confetti = createConfetti(elements.confetti);
let voice = null;
let stampTimer = null;
let toastTimer = null;
let verdictTimer = null;

// --- Persistence (per-viewer conveniences only) ---------------------------------

function remember(key, value) {
  try {
    localStorage.setItem(`ai-shark-tank:${key}`, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the app works without it.
  }
}

function recall(key, fallback) {
  try {
    const raw = localStorage.getItem(`ai-shark-tank:${key}`);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// --- Small UI helpers ----------------------------------------------------------

function setView(view) {
  state.view = view;
  elements.body.dataset.view = view;
  stage.setMood(view === "lobby" ? "lobby" : "show");
  requestAnimationFrame(() => stage.resize());
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function announce(message) {
  elements.announcer.textContent = message;
}

function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function playedTime() {
  return state.playedMs + (state.clockStartedAt ? performance.now() - state.clockStartedAt : 0);
}

function runClock(running) {
  if (running && !state.clockStartedAt) {
    state.clockStartedAt = performance.now();
  } else if (!running && state.clockStartedAt) {
    state.playedMs += performance.now() - state.clockStartedAt;
    state.clockStartedAt = null;
  }
}

window.setInterval(() => {
  elements.timecode.textContent = formatClock(playedTime());
}, 250);

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  const speed = Number(params.get("speed"));

  return {
    pitchId: params.get("pitch"),
    idea: params.get("idea"),
    seed: Number.parseInt(params.get("seed") || "", 10),
    speed: Number.isFinite(speed) && speed >= 0.25 && speed <= 40 ? speed : null,
    autoplay: params.get("autoplay") === "1",
  };
}

function shareUrl() {
  const params = new URLSearchParams();
  const { pitch, seed } = state.episode;

  if (pitch.custom) {
    params.set("idea", pitch.idea);
  } else {
    params.set("pitch", pitch.id);
  }

  params.set("seed", String(seed));
  return `${window.location.origin}/?${params.toString()}`;
}

function syncUrl() {
  if (!state.episode) {
    window.history.replaceState(null, "", "/");
    return;
  }

  window.history.replaceState(null, "", shareUrl().replace(window.location.origin, ""));
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    showToast("Copy failed. Your browser blocked clipboard access.");
  }
}

// --- Lobby ---------------------------------------------------------------------

function selectedPitch() {
  return state.config.pitches.find((pitch) => pitch.id === state.selection.pitchId) || null;
}

function renderHero() {
  const pitch = state.selection.idea ? null : selectedPitch();

  if (pitch) {
    elements.heroTitle.textContent = pitch.startupName;
    elements.heroTagline.textContent = pitch.tagline;
    elements.heroChips.innerHTML = [
      `<span class="chip chip-gold">${formatMoneyShort(pitch.askUsd)} for ${formatPercent(pitch.equityPct)}</span>`,
      `<span class="chip">${formatMoneyShort(pitch.valuationUsd)} valuation</span>`,
      `<span class="chip">${escapeHtml(pitch.categoryLabel)}</span>`,
      `<span class="chip">Founder: ${escapeHtml(pitch.founder.name)}</span>`,
    ].join("");
  } else {
    elements.heroTitle.textContent = "Your pitch";
    const idea = state.selection.idea;
    elements.heroTagline.textContent = idea
      ? `${idea[0].toUpperCase()}${idea.slice(1)}`
      : "Describe a startup and the sharks will take it from there.";
    elements.heroChips.innerHTML = `<span class="chip chip-gold">Custom idea</span><span class="chip">Seed ${state.selection.seed}</span>`;
  }
}

function previewSelection() {
  const pitch = selectedPitch();

  if (state.selection.idea || !pitch) {
    stage.setPitch({
      productName: "Your idea",
      icon: "sparkle",
      askLabel: "Ask TBD",
      founder: { name: "You", suit: "#2a3550", accent: "#39e0c8", skin: "#c98e63", hair: "#2a1e18", hairStyle: "short" },
    });
  } else {
    stage.setPitch(pitch);
  }

  stage.placeFounder("mark");
  renderHero();
}

function renderPitchList() {
  elements.pitchList.innerHTML = state.config.pitches
    .map((pitch) => {
      const selected = !state.selection.idea && pitch.id === state.selection.pitchId;
      return `
        <li role="none">
          <button class="pitch-card" type="button" role="radio" aria-checked="${selected}" tabindex="${selected ? 0 : -1}" data-pitch="${pitch.id}" style="--accent:${pitch.founder.accent}">
            <span class="pitch-icon">${icon(pitch.icon)}</span>
            <span class="pitch-copy">
              <strong>${escapeHtml(pitch.startupName)}</strong>
              <span>${escapeHtml(pitch.tagline)}</span>
            </span>
            <span class="pitch-ask"><b>${formatMoneyShort(pitch.askUsd)}</b><small>for ${formatPercent(pitch.equityPct)}</small></span>
          </button>
        </li>`;
    })
    .join("");

  // Keep one card tabbable when a custom idea is selected.
  if (state.selection.idea) {
    elements.pitchList.querySelector(".pitch-card")?.setAttribute("tabindex", "0");
  }
}

function selectPitch(pitchId, { focus = false } = {}) {
  state.selection.pitchId = pitchId;
  state.selection.idea = "";
  elements.ideaInput.value = "";
  updateCharCount();
  renderPitchList();
  previewSelection();
  hideLobbyError();

  if (focus) {
    elements.pitchList.querySelector(`[data-pitch="${pitchId}"]`)?.focus();
  }
}

function updateCharCount() {
  elements.charCount.textContent = `${elements.ideaInput.value.length}/${state.config?.limits.ideaMaxLength ?? 140}`;
}

function readSeed() {
  const seed = Number.parseInt(elements.seedInput.value, 10);
  const maxSeed = state.config.limits.maxSeed;

  if (!Number.isInteger(seed) || seed < 1 || seed > maxSeed) {
    return null;
  }

  return seed;
}

function showLobbyError(message) {
  elements.lobbyError.textContent = message;
  elements.lobbyError.hidden = false;
}

function hideLobbyError() {
  elements.lobbyError.hidden = true;
}

function setRollLoading(loading) {
  state.loading = loading;
  elements.rollButton.disabled = loading;
  elements.rollButton.innerHTML = loading
    ? `<span class="spinner" aria-hidden="true"></span><span>Setting up the studio</span>`
    : `${icon("play")}<span>Roll the cameras</span>`;
}

function renderMeet() {
  elements.meetList.innerHTML = state.config.sharks
    .map(
      (shark) => `
        <li class="meet-card" style="--who:${shark.color}">
          ${avatar(shark, { className: "avatar-md" })}
          <div>
            <strong>${escapeHtml(shark.displayName)}</strong>
            <span class="meet-persona">${escapeHtml(shark.persona)}</span>
            <p>${escapeHtml(shark.style)}</p>
          </div>
        </li>`,
    )
    .join("");
}

// --- Show ----------------------------------------------------------------------

function renderTransport() {
  const status = state.director?.state.status || "idle";
  const toggle = elements.transport.querySelector('[data-action="toggle"]');
  const playing = status === "playing";
  toggle.innerHTML = icon(playing ? "pause" : "play");
  toggle.setAttribute("aria-label", playing ? "Pause" : status === "finished" ? "Show verdict" : "Play");
  elements.body.dataset.playback = status;

  elements.speed.innerHTML = SPEEDS.concat(SPEEDS.includes(state.speed) ? [] : [state.speed])
    .map(
      (speed) =>
        `<button type="button" class="speed-option" data-speed="${speed}" aria-pressed="${speed === state.speed}">${speed}×</button>`,
    )
    .join("");

  const voiceButton = elements.transport.querySelector('[data-action="voice"]');
  voiceButton.hidden = !voice?.supported;
  voiceButton.innerHTML = icon(state.voiceOn ? "voiceOn" : "voiceOff");
  voiceButton.setAttribute("aria-pressed", String(state.voiceOn));
  voiceButton.setAttribute("aria-label", state.voiceOn ? "Turn voices off" : "Turn voices on");
}

function renderProgress(index) {
  const total = state.episode?.beats.length || 0;
  const done = Math.max(0, Math.min(total, index + 1));
  elements.progressFill.style.width = total ? `${(done / total) * 100}%` : "0%";
  elements.progressLabel.textContent = `Line ${done} of ${total}`;
}

function renderProgressTicks() {
  const { beats, phases } = state.episode;
  const ticks = phases
    .map((phase) => {
      const first = beats.findIndex((beat) => beat.phase === phase.id);
      return first > 0 ? `<i class="progress-tick" style="left:${(first / beats.length) * 100}%" title="${escapeHtml(phase.label)}"></i>` : "";
    })
    .join("");

  elements.progressTrack.querySelectorAll(".progress-tick").forEach((tick) => tick.remove());
  elements.progressTrack.insertAdjacentHTML("beforeend", ticks);
}

function refreshBoard(previous = null) {
  renderBoard(elements.boardPanel, state.episode, state.board, { thinkingId: state.thinkingId, previous });

  for (const [sharkId, entry] of Object.entries(state.board.sharks)) {
    stage.setSharkStatus(sharkId, entry.status, entry);
  }
}

function showStamp(tone) {
  window.clearTimeout(stampTimer);
  elements.stampLabel.textContent = tone === "deal" ? "Deal!" : "No deal";
  elements.stamp.dataset.tone = tone;
  elements.stamp.classList.remove("is-visible");
  void elements.stamp.offsetWidth;
  elements.stamp.classList.add("is-visible");
  stampTimer = window.setTimeout(() => elements.stamp.classList.remove("is-visible"), 2800);
}

function celebrateDeal(effect) {
  const colors = effect.sharkIds
    .map((id) => state.episode.sharks.find((shark) => shark.id === id)?.color)
    .filter(Boolean)
    .concat(["#f6c55b", "#ffffff"]);

  showStamp("deal");
  confetti.burst({ colors, seed: state.episode.seed, originX: 0.55 });
  stage.walkTo("approach", 1400);
  stage.celebrate(true);
}

function resetShowSurface() {
  window.clearTimeout(verdictTimer);
  window.clearTimeout(stampTimer);
  elements.stamp.classList.remove("is-visible");
  confetti.stop();
  voice?.cancel();
  state.thinkingId = null;
  state.playedMs = 0;
  state.clockStartedAt = null;
  caption.reset();
  transcript.reset();
  stage.reset();
  stage.placeFounder("offstage");
  state.board = createBoard(state.episode);
  refreshBoard();
  renderPhaseRail(elements.phaseRail, state.episode.phases, null);
  renderProgress(-1);
}

function openVerdict() {
  window.clearTimeout(verdictTimer);
  renderVerdict(elements.verdict, { episode: state.episode, board: state.board, allTime: state.allTime });

  if (!elements.verdict.open) {
    elements.verdict.showModal();
  }

  elements.verdict.querySelector('[data-action="download-report"]')?.focus({ preventScroll: true });
  elements.verdict.querySelector(".verdict-card").scrollTop = 0;
}

function closeVerdict() {
  if (elements.verdict.open) {
    elements.verdict.close();
  }
}

function buildDirector() {
  state.director?.destroy();

  state.director = createDirector({
    beats: state.episode.beats,
    speed: state.speed,
    hooks: {
      onStatus(status) {
        runClock(status === "playing");
        renderTransport();
      },
      onBeatStart(beat, { index, timing, silent }) {
        renderPhaseRail(elements.phaseRail, state.episode.phases, beat.phase);
        renderProgress(index - 1);
        transcript.start(beat, state.episode);

        if (silent) {
          return;
        }

        const shot = stage.shotForBeat(beat);
        stage.setShot(shot.name, shot.focus);
        caption.setBeat(beat, state.episode);

        if (beat.kind === "entrance") {
          stage.setSpeaker(null);
          stage.walkTo("mark", timing.preMs);
        } else if (timing.thinks) {
          stage.setSpeaker(beat.speakerId, { phase: "thinking", lookAt: beat.targetId });
          caption.setThinking(beat);
          state.thinkingId = beat.speakerId;
          refreshBoard();
        } else {
          stage.setSpeaker(beat.speakerId, { phase: "speaking", lookAt: beat.targetId });
        }

        if (beat.kind === "verdict" && state.episode.result.outcome !== "deal") {
          stage.walkTo("offstage", 2600);
        }
      },
      onTypingStart(beat) {
        if (state.thinkingId) {
          state.thinkingId = null;
          refreshBoard();
        }

        stage.setSpeaker(beat.speakerId, { phase: "speaking", lookAt: beat.targetId });
        caption.setText("");
      },
      onType(beat, text) {
        caption.setText(text);
        transcript.update(text);
      },
      onLanded(beat, { silent }) {
        const previous = state.board;
        state.board = applyBeat(state.board, beat);
        state.thinkingId = null;
        refreshBoard(previous);
        caption.land(beat);
        transcript.land(beat);
        if (silent) {
          return;
        }

        announce(`${beat.speakerName}: ${beat.text}`);

        for (const effect of beat.effects) {
          if (effect.type === "deal") {
            celebrateDeal(effect);
          } else if (effect.type === "no_deal") {
            showStamp("no-deal");
          }
        }
      },
      onBeatEnd() {
        stage.setSpeaker(null);
      },
      onSpeak(beat, speed) {
        return state.voiceOn ? voice?.speak(beat.speakerId, beat.text, speed) : null;
      },
      onPause() {
        voice?.pause();
      },
      onResume() {
        voice?.resume();
      },
      onSkip() {
        voice?.cancel();
        confetti.stop();
      },
      onFinish() {
        renderProgress(state.episode.beats.length - 1);
        renderPhaseRail(elements.phaseRail, state.episode.phases, "verdict");
        stage.setSpeaker(null);
        stage.setShot("wide");
        verdictTimer = window.setTimeout(openVerdict, 900);
      },
    },
  });

  renderTransport();
}

function renderDossier() {
  const { pitch } = state.episode;
  const { metrics } = pitch;
  const stats = [
    ["Asking valuation", formatMoneyShort(pitch.valuationUsd), ""],
    ["Sales, last 12 mo", metrics.revenueTtmUsd ? formatMoneyShort(metrics.revenueTtmUsd) : "None yet", ""],
    ["Growth", `${metrics.growthMoMPct}%`, "month over month"],
    ["Gross margin", `${metrics.grossMarginPct}%`, metrics.priceLabel],
    ["Customers", metrics.customers.toLocaleString("en-US"), metrics.customerNoun],
    ["Acquire → lifetime", `${formatMoneyShort(metrics.cacUsd)} → ${formatMoneyShort(metrics.ltvUsd)}`, `${(metrics.ltvUsd / metrics.cacUsd).toFixed(1)}× return`],
  ];

  elements.dossier.style.setProperty("--accent", pitch.founder.accent);
  elements.dossier.innerHTML = `
    <header class="dossier-head">
      <span class="pitch-icon">${icon(pitch.icon)}</span>
      <div>
        <span class="kicker">Pitch dossier</span>
        <strong>${escapeHtml(pitch.productName)}</strong>
        <span class="dossier-by">${escapeHtml(pitch.startupName)} · ${escapeHtml(pitch.categoryLabel)} · Founder ${escapeHtml(pitch.founder.name)}</span>
      </div>
      <p>${escapeHtml(pitch.tagline)}</p>
    </header>
    <dl class="dossier-stats">
      ${stats.map(([label, value, note]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd>${note ? `<small>${escapeHtml(note)}</small>` : ""}</div>`).join("")}
    </dl>`;
}

function playEpisode() {
  closeVerdict();
  resetShowSurface();
  stage.setPitch(state.episode.pitch);
  stage.placeFounder("offstage");
  elements.hudSeed.textContent = `Seed ${state.episode.seed}`;
  renderDossier();
  renderProgressTicks();
  buildDirector();
  state.director.play();
}

async function rollCameras() {
  if (state.loading) {
    return;
  }

  const seed = readSeed();

  if (seed === null) {
    showLobbyError(`Seed must be a whole number between 1 and ${state.config.limits.maxSeed}.`);
    elements.seedInput.focus();
    return;
  }

  const idea = elements.ideaInput.value.trim();
  const body = idea ? { idea, seed } : { pitchId: state.selection.pitchId, seed };
  state.selection.seed = seed;
  hideLobbyError();
  setRollLoading(true);

  try {
    const response = await fetch("/api/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.episode) {
      throw new Error(payload?.detail || "The studio could not produce that episode.");
    }

    state.episode = payload.episode;
    state.download = payload.download;
    state.allTime = payload.allTime;
    setView("show");
    syncUrl();
    playEpisode();
  } catch (error) {
    showLobbyError(error instanceof Error ? error.message : "The studio could not produce that episode.");
  } finally {
    setRollLoading(false);
  }
}

function backToLobby() {
  closeVerdict();
  state.director?.destroy();
  state.director = null;
  voice?.cancel();
  confetti.stop();
  window.clearTimeout(verdictTimer);
  caption.reset();
  stage.reset();
  state.episode = null;
  state.playedMs = 0;
  state.clockStartedAt = null;
  syncUrl();
  setView("lobby");
  previewSelection();
}

function downloadReport() {
  if (!state.download) {
    return;
  }

  const blob = new Blob([state.download.content], { type: state.download.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.download.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Downloaded ${state.download.fileName}`);
}

function setTab(tabName) {
  for (const tab of elements.tabs) {
    const selected = tab.dataset.tab === tabName;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }

  elements.boardPanel.hidden = tabName !== "board";
  elements.transcriptPanel.hidden = tabName !== "transcript";
}

// --- Events --------------------------------------------------------------------

function handleTransportAction(action) {
  const director = state.director;

  switch (action) {
    case "toggle":
      if (director?.state.status === "finished") {
        openVerdict();
      } else {
        director?.toggle();
      }
      break;
    case "next":
      director?.next();
      break;
    case "finish":
      director?.finish();
      break;
    case "restart":
      playEpisode();
      break;
    case "voice":
      state.voiceOn = !state.voiceOn;
      remember("voice", state.voiceOn);

      if (!state.voiceOn) {
        voice?.cancel();
      }

      renderTransport();
      showToast(state.voiceOn ? "Voices on (uses your browser's built-in speech)" : "Voices off");
      break;
    case "exit":
      backToLobby();
      break;
    default:
      break;
  }
}

function bindEvents() {
  elements.transport.addEventListener("click", (event) => {
    const speedButton = event.target.closest("[data-speed]");

    if (speedButton) {
      state.speed = Number(speedButton.dataset.speed);
      state.director?.setSpeed(state.speed);
      renderTransport();
      return;
    }

    const actionButton = event.target.closest("[data-action]");

    if (actionButton) {
      handleTransportAction(actionButton.dataset.action);
    }
  });

  elements.pitchList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-pitch]");

    if (card) {
      selectPitch(card.dataset.pitch);
    }
  });

  elements.pitchList.addEventListener("keydown", (event) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

    if (!(event.key in keys)) {
      return;
    }

    event.preventDefault();
    const ids = state.config.pitches.map((pitch) => pitch.id);
    const current = Math.max(0, ids.indexOf(state.selection.pitchId));
    selectPitch(ids[(current + keys[event.key] + ids.length) % ids.length], { focus: true });
  });

  elements.ideaInput.addEventListener("input", () => {
    state.selection.idea = elements.ideaInput.value.trim();
    updateCharCount();
    renderPitchList();
    previewSelection();
    hideLobbyError();
  });

  elements.ideaInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void rollCameras();
    }
  });

  elements.seedInput.addEventListener("input", () => {
    const seed = readSeed();

    if (seed !== null) {
      state.selection.seed = seed;
      renderHero();
    }
  });

  elements.seedDice.addEventListener("click", () => {
    elements.seedInput.value = String(1 + Math.floor(Math.random() * 9999));
    state.selection.seed = Number(elements.seedInput.value);
    renderHero();
  });

  elements.rollButton.addEventListener("click", () => {
    void rollCameras();
  });

  for (const tab of elements.tabs) {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const next = tab.dataset.tab === "board" ? "transcript" : "board";
        setTab(next);
        document.querySelector(`[data-tab="${next}"]`).focus();
      }
    });
  }

  elements.verdict.addEventListener("click", (event) => {
    if (event.target === elements.verdict) {
      closeVerdict();
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;

    switch (action) {
      case "close-verdict":
        closeVerdict();
        break;
      case "download-report":
        downloadReport();
        break;
      case "copy-caption":
        void copyText(state.episode.socialCaption, "Caption copied");
        break;
      case "copy-link":
        void copyText(shareUrl(), "Episode link copied");
        break;
      case "replay":
        playEpisode();
        break;
      case "new-pitch":
        backToLobby();
        break;
      default:
        break;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (state.view !== "show" || elements.verdict.open) {
      return;
    }

    if (event.target.closest?.("input, textarea, select, button, [role='tab']") && event.key === " ") {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      handleTransportAction("toggle");
    } else if (event.key === "ArrowRight" && event.shiftKey) {
      handleTransportAction("finish");
    } else if (event.key === "ArrowRight" && !event.target.closest?.("[role='tab']")) {
      handleTransportAction("next");
    } else if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) {
      handleTransportAction("restart");
    }
  });
}

// --- Boot ----------------------------------------------------------------------

function renderStaticLabels() {
  const actions = {
    restart: icon("restart"),
    toggle: icon("play"),
    next: icon("next"),
    finish: icon("verdict"),
  };

  for (const [action, markup] of Object.entries(actions)) {
    elements.transport.querySelector(`[data-action="${action}"]`).innerHTML = markup;
  }

  elements.transport.querySelector('[data-action="exit"]').innerHTML = `${icon("exit")}<span>Lobby</span>`;
  elements.seedDice.innerHTML = icon("dice");
  document.querySelector("#tab-board").innerHTML = `${icon("board")}<span>Deal board</span>`;
  document.querySelector("#tab-transcript").innerHTML = `${icon("transcript")}<span>Transcript</span>`;
  setRollLoading(false);
}

async function boot() {
  renderStaticLabels();

  const response = await fetch("/api/config");

  if (!response.ok) {
    throw new Error("Could not load the studio configuration.");
  }

  state.config = await response.json();
  elements.providerLabel.textContent = `${state.config.provider.label} · no API keys`;
  voice = createVoice({ sharks: state.config.sharks });
  stage.setSharks(state.config.sharks);
  renderMeet();

  const url = readUrl();
  state.speed = url.speed ?? 1;
  state.voiceOn = Boolean(voice.supported && recall("voice", false));

  const knownPitch = state.config.pitches.some((pitch) => pitch.id === url.pitchId);
  state.selection.pitchId = knownPitch ? url.pitchId : state.config.pitches[0].id;
  state.selection.seed = Number.isInteger(url.seed) && url.seed >= 1 ? Math.min(url.seed, state.config.limits.maxSeed) : state.config.defaults.seed;
  elements.seedInput.value = String(state.selection.seed);
  elements.seedInput.max = String(state.config.limits.maxSeed);

  if (url.idea) {
    elements.ideaInput.value = url.idea.slice(0, state.config.limits.ideaMaxLength);
    state.selection.idea = elements.ideaInput.value.trim();
  }

  updateCharCount();
  renderPitchList();
  previewSelection();
  renderTransport();
  bindEvents();
  setView("lobby");
  elements.body.classList.add("is-ready");

  if (url.autoplay && (knownPitch || url.idea)) {
    await rollCameras();
  }
}

boot().catch((error) => {
  console.error(error);
  elements.body.classList.add("is-ready");
  showLobbyError("The studio is offline. Is the server running?");
});
