import { applyBeat, createBoard } from "/shared/board.js";
import { formatMoneyFull, formatMoneyShort, formatOfferFull, formatPercent } from "/shared/format.js";
import { createConfetti } from "./confetti.js";
import { createDirector } from "./director.js";
import { icon } from "./icons.js";
import { createStudio } from "./studio/studio.js";
import { createVoice } from "./voice.js";

const SPEEDS = [1, 1.5, 2, 3];
const CUSTOM_FOUNDER = { name: "You", suit: "#2a3550", accent: "#39e0c8", skin: "#c98e63", hair: "#2a1e18", hairStyle: "short" };
const $ = (selector) => document.querySelector(selector);

const elements = {
  body: document.body,
  stage: $("#stage"),
  timecode: $("#timecode"),
  pitchList: $("#pitch-list"),
  tonightTitle: $("#tonight-title"),
  tonightDetail: $("#tonight-detail"),
  ownIdea: $("#own-idea"),
  ideaInput: $("#idea-input"),
  charCount: $("#char-count"),
  seedInput: $("#seed-input"),
  seedDice: $("#seed-dice"),
  rollButton: $("#roll-button"),
  lobbyError: $("#lobby-error"),
  lowerThird: $("#lower-third"),
  ltKicker: $("#lt-kicker"),
  ltTitle: $("#lt-title"),
  caption: $("#caption"),
  subName: $("#sub-name"),
  subText: $("#sub-text"),
  stamp: $("#stamp"),
  stampLabel: $("#stamp-label"),
  confetti: $("#confetti"),
  transport: $("#transport"),
  progress: $("#progress"),
  progressFill: $("#progress-fill"),
  speed: $("#speed"),
  verdict: $("#verdict"),
  toast: $("#toast"),
  announcer: $("#announcer"),
  transcript: $("#transcript"),
};

const state = {
  config: null,
  view: "lobby",
  selection: { pitchId: null, idea: "", seed: 1 },
  episode: null,
  download: null,
  board: null,
  director: null,
  speed: 1,
  voiceOn: false,
  playedMs: 0,
  clockStartedAt: null,
  loading: false,
};

const confetti = createConfetti(elements.confetti);
let studio = null;
let voice = null;
const timers = { stamp: null, toast: null, verdict: null, lowerThird: null, controls: null };
// Like a TV graphic, a lower-third goes out with the cut: it is cleared when
// this test passes for the next beat (null = stays up).
let lowerThirdUntil = null;

// --- Small helpers -----------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function showToast(message) {
  window.clearTimeout(timers.toast);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  timers.toast = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function sharkById(id) {
  return state.config.sharks.find((shark) => shark.id === id);
}

function colorFor(speakerId) {
  if (speakerId === "founder") {
    return state.episode?.pitch.founder.accent || "#39e0c8";
  }

  return sharkById(speakerId)?.color || "#f6c55b";
}

function stagePitch(pitch) {
  return { ...pitch, askLabel: `Seeking ${formatMoneyShort(pitch.askUsd)} for ${formatPercent(pitch.equityPct)}` };
}

function setView(view) {
  state.view = view;
  elements.body.dataset.view = view;
  studio?.setMood(view === "lobby" ? "lobby" : "show");
}

// --- Clock -------------------------------------------------------------------

function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((part) => String(part).padStart(2, "0")).join(":");
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
  const played = state.playedMs + (state.clockStartedAt ? performance.now() - state.clockStartedAt : 0);
  elements.timecode.textContent = formatClock(played);
}, 250);

// --- URL -------------------------------------------------------------------------

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
  params.set(pitch.custom ? "idea" : "pitch", pitch.custom ? pitch.idea : pitch.id);
  params.set("seed", String(seed));
  return `${window.location.origin}/?${params.toString()}`;
}

function syncUrl() {
  const quality = new URLSearchParams(window.location.search).get("quality");
  const keep = quality ? `quality=${quality}` : "";

  if (!state.episode) {
    window.history.replaceState(null, "", keep ? `/?${keep}` : "/");
    return;
  }

  const url = shareUrl().replace(window.location.origin, "");
  window.history.replaceState(null, "", keep ? `${url}&${keep}` : url);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast("Copy failed. Your browser blocked clipboard access.");
  }
}

// --- Lobby -----------------------------------------------------------------------

function selectedPitch() {
  return state.config.pitches.find((pitch) => pitch.id === state.selection.pitchId) || null;
}

function renderTonight() {
  const pitch = state.selection.idea ? null : selectedPitch();

  if (pitch) {
    elements.tonightTitle.textContent = `${pitch.startupName} · seeking ${formatMoneyShort(pitch.askUsd)} for ${formatPercent(pitch.equityPct)}`;
    elements.tonightDetail.textContent = pitch.tagline;
  } else {
    const idea = state.selection.idea;
    elements.tonightTitle.textContent = "Your pitch";
    elements.tonightDetail.textContent = idea ? `${idea[0].toUpperCase()}${idea.slice(1)}` : "Describe a startup and the sharks take it from there.";
  }
}

function previewSelection() {
  const pitch = selectedPitch();

  if (state.selection.idea || !pitch) {
    studio.setPitch({
      id: "custom",
      productName: "Your idea",
      tagline: state.selection.idea || "",
      startupName: "Custom pitch",
      icon: "sparkle",
      askLabel: "Ask TBD",
      founder: CUSTOM_FOUNDER,
    });
  } else {
    studio.setPitch(stagePitch(pitch));
  }

  studio.placeFounder("mark");
  renderTonight();
}

function renderLineup() {
  elements.pitchList.innerHTML = state.config.pitches
    .map((pitch) => {
      const selected = !state.selection.idea && pitch.id === state.selection.pitchId;
      return `
        <button class="lineup-card" type="button" role="radio" aria-checked="${selected}" tabindex="${selected ? 0 : -1}" data-pitch="${pitch.id}" style="--accent:${pitch.founder.accent}">
          <span class="lineup-icon">${icon(pitch.icon)}</span>
          <span><strong>${escapeHtml(pitch.startupName)}</strong><small>${formatMoneyShort(pitch.askUsd)} for ${formatPercent(pitch.equityPct)}</small></span>
        </button>`;
    })
    .join("");

  if (state.selection.idea) {
    elements.pitchList.querySelector(".lineup-card")?.setAttribute("tabindex", "0");
  }
}

function selectPitch(pitchId, { focus = false } = {}) {
  state.selection.pitchId = pitchId;
  state.selection.idea = "";
  elements.ideaInput.value = "";
  updateCharCount();
  renderLineup();
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
  return Number.isInteger(seed) && seed >= 1 && seed <= state.config.limits.maxSeed ? seed : null;
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
  elements.rollButton.innerHTML = loading ? `<span class="spinner" aria-hidden="true"></span>Rolling` : `${icon("play")}Enter the tank`;
}

// --- Broadcast graphics -------------------------------------------------------------

function showLowerThird({ kicker, title, color = "#f6c55b", duration = 4200, until = null }) {
  window.clearTimeout(timers.lowerThird);
  lowerThirdUntil = until;
  elements.ltKicker.textContent = kicker;
  elements.ltTitle.textContent = title;
  elements.lowerThird.style.setProperty("--lt-color", color);
  elements.lowerThird.classList.add("is-visible");

  if (duration > 0) {
    timers.lowerThird = window.setTimeout(() => elements.lowerThird.classList.remove("is-visible"), duration);
  }
}

function hideLowerThird() {
  window.clearTimeout(timers.lowerThird);
  lowerThirdUntil = null;
  elements.lowerThird.classList.remove("is-visible");
}

function termsFor(offer) {
  const kicker = offer.kicker?.short ? ` + ${offer.kicker.short}` : "";
  return `${formatMoneyFull(offer.cashUsd)} for ${formatPercent(offer.equityPct)}${kicker}`;
}

function namesFor(ids) {
  return ids.map((id) => sharkById(id)?.displayName || id).join(" + ");
}

function graphicForEffect(effect) {
  const ids = effect.sharkIds || (effect.sharkId ? [effect.sharkId] : []);

  switch (effect.type) {
    case "offer":
      return { kicker: `${namesFor(ids)} · Offer`, title: termsFor(effect.offer), color: colorFor(ids[0]) };
    case "revise":
      return { kicker: `${namesFor(ids)} · New offer`, title: termsFor(effect.offer), color: colorFor(ids[0]) };
    case "team":
      return { kicker: `${namesFor(ids)} · Team offer`, title: termsFor(effect.offer), color: colorFor(ids[0]) };
    case "counter":
      return { kicker: `${state.episode.pitch.founder.name} · Counter-offer`, title: termsFor(effect.offer), color: state.episode.pitch.founder.accent };
    case "out":
      return { kicker: namesFor(ids), title: "I'm out", color: "#ff6b6b", duration: 2600 };
    case "deal":
      return { kicker: `Deal · ${namesFor(ids)}`, title: termsFor(effect.offer), color: "#f6c55b", duration: 0 };
    case "no_deal":
      return { kicker: "No deal", title: state.episode.pitch.startupName, color: "#ff6b6b", duration: 0 };
    default:
      return null;
  }
}

function setCaption(beat) {
  const role = beat.speakerId === "founder" ? "Founder" : beat.speakerRole;
  elements.subName.textContent = beat.speakerId === "narrator" ? "Narrator" : `${beat.speakerName} · ${role}`;
  elements.caption.style.setProperty("--who", beat.speakerId === "narrator" ? "#f6c55b" : colorFor(beat.speakerId));
  elements.subText.textContent = "";
  elements.caption.classList.add("is-visible");
  elements.caption.classList.remove("is-thinking");
}

// Reveal whole words only, like live captions.
function setCaptionText(text, full) {
  elements.caption.classList.remove("is-thinking");

  if (text.length >= full.length) {
    elements.subText.textContent = full;
    return;
  }

  const cut = text.lastIndexOf(" ");
  elements.subText.textContent = cut > 0 ? text.slice(0, cut) : "";
}

function showStamp(tone) {
  window.clearTimeout(timers.stamp);
  elements.stampLabel.textContent = tone === "deal" ? "Deal!" : "No deal";
  elements.stamp.dataset.tone = tone;
  elements.stamp.classList.remove("is-visible");
  void elements.stamp.offsetWidth;
  elements.stamp.classList.add("is-visible");
  timers.stamp = window.setTimeout(() => elements.stamp.classList.remove("is-visible"), 2800);
}

function renderProgress(index) {
  const total = state.episode?.beats.length || 0;
  const done = Math.max(0, Math.min(total, index + 1));
  elements.progress.setAttribute("aria-valuemax", String(total));
  elements.progress.setAttribute("aria-valuenow", String(done));
  elements.progress.setAttribute("aria-valuetext", `Line ${done} of ${total}`);
  elements.progressFill.style.width = total ? `${(done / total) * 100}%` : "0%";
}

function renderTransport() {
  const status = state.director?.state.status || "idle";
  const toggle = elements.transport.querySelector('[data-action="toggle"]');
  const playing = status === "playing";
  toggle.innerHTML = icon(playing ? "pause" : "play");
  toggle.setAttribute("aria-label", playing ? "Pause" : status === "finished" ? "Show verdict" : "Play");
  elements.body.dataset.playback = status;
  elements.speed.innerHTML = SPEEDS.concat(SPEEDS.includes(state.speed) ? [] : [state.speed])
    .map((speed) => `<button type="button" data-speed="${speed}" aria-pressed="${speed === state.speed}">${speed}×</button>`)
    .join("");
  const voiceButton = elements.transport.querySelector('[data-action="voice"]');
  voiceButton.hidden = !voice?.supported;
  voiceButton.innerHTML = icon(state.voiceOn ? "voiceOn" : "voiceOff");
  voiceButton.setAttribute("aria-pressed", String(state.voiceOn));
  voiceButton.setAttribute("aria-label", state.voiceOn ? "Turn voices off" : "Turn voices on");
}

function revealControls() {
  elements.body.classList.add("controls-visible");
  window.clearTimeout(timers.controls);
  timers.controls = window.setTimeout(() => elements.body.classList.remove("controls-visible"), 2600);
}

// --- End slate ---------------------------------------------------------------------

const DIFFICULTY = { easy: "Easy", medium: "Medium", hard: "Hard" };

function renderVerdict() {
  const { result, report, pitch } = state.episode;
  const isDeal = result.outcome === "deal";
  const delta = isDeal ? Math.round((result.valuationUsd / result.askValuationUsd - 1) * 100) : 0;
  let note = "Every shark went out.";

  if (isDeal) {
    note =
      delta === 0
        ? "Closed exactly at the asking valuation."
        : `${Math.abs(delta)}% ${delta < 0 ? "below" : "above"} the asking valuation of ${formatMoneyShort(result.askValuationUsd)}.`;
  } else if (result.declinedOffer) {
    note = `${pitch.founder.name} turned down ${formatOfferFull(result.declinedOffer)}.`;
  }

  elements.verdict.innerHTML = `
    <div class="slate" data-outcome="${result.outcome}">
      <button class="slate-close" type="button" data-action="close-verdict" aria-label="Close verdict">${icon("close")}</button>
      <span class="slate-stamp">${isDeal ? (result.dealType === "Multi-Shark Deal" ? "Multi-shark deal" : "Deal") : "No deal"}</span>
      <h2 id="verdict-title">${escapeHtml(result.headline)}</h2>
      <p class="slate-terms">${isDeal ? escapeHtml(formatOfferFull(result.offer)) : "No deal"}</p>
      <p class="slate-note">${escapeHtml(note)}</p>
      <ul class="slate-facts">
        <li>Feasibility <b>${report.feasibilityPercent}%</b></li>
        <li>Good business? <b>${report.isGoodBusiness === "yes" ? "Yes" : "No"}</b></li>
        <li>Difficulty <b>${DIFFICULTY[report.difficulty]}</b></li>
        <li>To start <b>${formatMoneyShort(report.minimumInitialInvestmentUsd)}</b></li>
      </ul>
      <div class="slate-actions">
        <button class="primary" type="button" data-action="replay">${icon("restart")}Watch again</button>
        <button type="button" data-action="new-pitch">${icon("next")}Next pitch</button>
        <button type="button" data-action="download-report">${icon("download")}Download report</button>
      </div>
      <div class="slate-links">
        <button type="button" data-action="copy-link">Copy link</button>
        <button type="button" data-action="copy-caption">Copy caption</button>
      </div>
    </div>`;
}

function openVerdict() {
  window.clearTimeout(timers.verdict);
  renderVerdict();

  if (!elements.verdict.open) {
    elements.verdict.showModal();
  }

  elements.verdict.querySelector('[data-action="replay"]')?.focus({ preventScroll: true });
}

function closeVerdict() {
  if (elements.verdict.open) {
    elements.verdict.close();
  }
}

// --- Show --------------------------------------------------------------------------

function resetShow() {
  for (const key of ["verdict", "stamp", "lowerThird"]) {
    window.clearTimeout(timers[key]);
  }

  elements.stamp.classList.remove("is-visible");
  hideLowerThird();
  confetti.stop();
  voice?.cancel();
  state.playedMs = 0;
  state.clockStartedAt = null;
  elements.caption.classList.remove("is-visible", "is-thinking");
  elements.transcript.innerHTML = "";
  studio.reset();
  studio.setPitch(stagePitch(state.episode.pitch));
  studio.placeFounder("offstage");
  state.board = createBoard(state.episode);
  renderProgress(-1);
}

function applyStatuses(previous) {
  for (const [sharkId, entry] of Object.entries(state.board.sharks)) {
    if (!previous || previous.sharks[sharkId].status !== entry.status) {
      studio.setSharkStatus(sharkId, entry.status, entry);
    }
  }
}

function buildDirector() {
  state.director?.destroy();
  let pitchIntroShown = false;

  state.director = createDirector({
    beats: state.episode.beats,
    speed: state.speed,
    hooks: {
      onStatus(status) {
        runClock(status === "playing");
        renderTransport();
      },
      onBeatStart(beat, { index, timing, silent }) {
        renderProgress(index - 1);

        if (silent) {
          return;
        }

        if (lowerThirdUntil?.(beat)) {
          hideLowerThird();
        }

        const shot = studio.shotForBeat(beat);
        studio.setShot(shot.name, shot.focus, shot.variant);
        setCaption(beat);

        if (beat.kind === "entrance") {
          studio.setSpeaker(null);
          studio.walkTo("mark", timing.preMs);
        } else if (timing.thinks) {
          studio.setSpeaker(beat.speakerId, { phase: "thinking", lookAt: beat.targetId });
          elements.caption.classList.add("is-thinking");
          elements.subText.textContent = "…";
        } else {
          studio.setSpeaker(beat.speakerId, { phase: "speaking", lookAt: beat.targetId });
        }

        if (beat.kind === "pitch" && !pitchIntroShown) {
          pitchIntroShown = true;
          const { pitch } = state.episode;
          showLowerThird({
            kicker: `${pitch.startupName} · ${pitch.founder.name}, founder`,
            title: `Seeking ${formatMoneyFull(pitch.askUsd)} for ${formatPercent(pitch.equityPct)}`,
            color: pitch.founder.accent,
            duration: 0,
            until: (next) => next.kind !== "pitch",
          });
        }

        if (beat.kind === "verdict" && state.episode.result.outcome !== "deal") {
          studio.walkTo("offstage", 2600);
        }
      },
      onTypingStart(beat) {
        studio.setSpeaker(beat.speakerId, { phase: "speaking", lookAt: beat.targetId });
      },
      onType(beat, text) {
        setCaptionText(text, beat.text || "");
      },
      onLanded(beat, { silent }) {
        const previous = state.board;
        state.board = applyBeat(state.board, beat);
        applyStatuses(previous);
        const item = document.createElement("li");
        item.textContent = `${beat.speakerName}: ${beat.text}`;
        elements.transcript.append(item);

        if (silent) {
          return;
        }

        elements.subText.textContent = beat.text;
        elements.announcer.textContent = `${beat.speakerName}: ${beat.text}`;

        for (const effect of beat.effects) {
          const graphic = graphicForEffect(effect);

          if (graphic) {
            const isFinal = effect.type === "deal" || effect.type === "no_deal";
            showLowerThird({ ...graphic, duration: isFinal ? 0 : 6000, until: isFinal ? null : () => true });
          }

          if (effect.type === "deal") {
            showStamp("deal");
            const colors = effect.sharkIds.map(colorFor).concat(["#f6c55b", "#ffffff"]);
            confetti.burst({ colors, seed: state.episode.seed, originX: 0.5 });
            studio.handshake(effect.sharkIds[0]);
          } else if (effect.type === "no_deal") {
            showStamp("no-deal");
          }
        }
      },
      onBeatEnd() {
        studio.setSpeaker(null);
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
        studio.setSpeaker(null);
        timers.verdict = window.setTimeout(openVerdict, 1400);
      },
    },
  });

  renderTransport();
}

function playEpisode() {
  closeVerdict();
  resetShow();
  buildDirector();
  state.director.play();
  revealControls();
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
  hideLowerThird();
  window.clearTimeout(timers.verdict);
  elements.caption.classList.remove("is-visible");
  studio.reset();
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

// --- Events ------------------------------------------------------------------------

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
      showToast(state.voiceOn ? "Voices on (your browser's built-in speech)" : "Voices off");
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

  for (const type of ["pointermove", "pointerdown", "touchstart"]) {
    window.addEventListener(type, () => state.view === "show" && revealControls(), { passive: true });
  }

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
    renderLineup();
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
    }
  });

  elements.seedDice.addEventListener("click", () => {
    elements.seedInput.value = String(1 + Math.floor(Math.random() * 9999));
    state.selection.seed = Number(elements.seedInput.value);
  });

  elements.rollButton.addEventListener("click", () => {
    void rollCameras();
  });

  elements.verdict.addEventListener("click", (event) => {
    if (event.target === elements.verdict) {
      closeVerdict();
      return;
    }

    switch (event.target.closest("[data-action]")?.dataset.action) {
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

    if (event.key === " " && event.target.closest?.("button, input, textarea")) {
      return;
    }

    revealControls();

    if (event.key === " ") {
      event.preventDefault();
      handleTransportAction("toggle");
    } else if (event.key === "ArrowRight" && event.shiftKey) {
      handleTransportAction("finish");
    } else if (event.key === "ArrowRight") {
      handleTransportAction("next");
    } else if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) {
      handleTransportAction("restart");
    }
  });
}

// --- Boot --------------------------------------------------------------------------

function renderStaticLabels() {
  for (const [action, name] of Object.entries({ restart: "restart", toggle: "play", next: "next", finish: "verdict", exit: "exit" })) {
    elements.transport.querySelector(`[data-action="${action}"]`).innerHTML = icon(name);
  }

  elements.seedDice.innerHTML = icon("dice");
  setRollLoading(false);
}

async function boot() {
  renderStaticLabels();
  const response = await fetch("/api/config");

  if (!response.ok) {
    throw new Error("Could not load the studio configuration.");
  }

  state.config = await response.json();
  // Canvas textures (the sign and product board) need the display font.
  await Promise.race([document.fonts?.ready, new Promise((resolve) => window.setTimeout(resolve, 1500))]);
  studio = createStudio({ mount: elements.stage });
  studio.setSharks(state.config.sharks);
  voice = createVoice({ sharks: state.config.sharks });

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
    elements.ownIdea.open = true;
  }

  updateCharCount();
  renderLineup();
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
  showLobbyError("The studio is offline. Is the server running?");
});
