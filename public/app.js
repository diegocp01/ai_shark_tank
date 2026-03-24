import { SharkTankStage } from "./stageScene.js";

const state = {
  config: null,
  stage: null,
  sharkRoster: [],
  currentEpisode: {
    founderPitch: "",
    startupName: "Untitled startup",
    productName: "",
    dealOutcome: null,
  },
  actorNodes: new Map(),
  actorStreams: new Map(),
  currentSource: null,
  isGenerating: false,
  runToken: 0,
  userTtsEnabled: false,
  audioContext: null,
  audioCache: new Map(),
  audioQueue: [],
  isPlayingAudio: false,
  currentAudioSource: null,
  momentTimer: null,
  liveClockTimer: null,
  liveClockStartedAt: null,
  generatePhraseTimer: null,
  generatePhraseIndex: 0,
  currentGeneratingSpeakerId: null,
  currentGeneratingSpeakerPhase: "idle",
  directorModeTimer: null,
};

const elements = {
  sceneRoot: document.querySelector("#scene-root"),
  bubbleLayer: document.querySelector("#bubble-layer"),
  tagLayer: document.querySelector("#tag-layer"),
  generateButton: document.querySelector("#generate-button"),
  statusCopy: document.querySelector("#status-copy"),
  disclosureCopy: document.querySelector("#disclosure-copy"),
  hudTimecode: document.querySelector("#hud-timecode"),
  ttsToggle: document.querySelector("#tts-toggle"),
  ttsToggleCopy: document.querySelector("#tts-toggle-copy"),
  reportButton: document.querySelector("#report-button"),
  founderBubble: document.querySelector("#founder-bubble"),
  founderMeta: document.querySelector("#founder-meta"),
  founderText: document.querySelector("#founder-text"),
  founderTag: document.querySelector("#founder-tag"),
  founderName: document.querySelector("#founder-name"),
  founderTagStatus: document.querySelector("#founder-tag-status"),
  momentBanner: document.querySelector("#moment-banner"),
  momentKicker: document.querySelector("#moment-kicker"),
  momentTitle: document.querySelector("#moment-title"),
  momentDetail: document.querySelector("#moment-detail"),
  controlBar: document.querySelector(".control-bar"),
  dealStamp: document.querySelector("#deal-stamp"),
  dealStampCheck: document.querySelector(".deal-stamp-check"),
  dealStampKicker: document.querySelector("#deal-stamp-kicker"),
  dealStampAmount: document.querySelector("#deal-stamp-amount"),
  dealStampCompany: document.querySelector("#deal-stamp-company"),
  dealStampShark: document.querySelector("#deal-stamp-shark"),
  actorBubbleTemplate: document.querySelector("#actor-bubble-template"),
  actorTagTemplate: document.querySelector("#actor-tag-template"),
};

const DEFAULT_BUTTON_LABEL = elements.generateButton.textContent;
const GENERATING_COPY = {
  generic: [
    "Cue the founder...",
    "Loading the tank...",
    "Warming up the studio...",
    "Rolling the cameras...",
  ],
  founderThinking: [
    "Founder is thinking...",
    "Reworking the cap table...",
    "Defending the equity...",
    "Sharpening the counter...",
  ],
  sharkThinking: [
    "Crunching the numbers...",
    "Evaluating the valuation...",
    "Consulting AI lawyers...",
    "Smelling blood in the water...",
  ],
  founderSpeaking: [
    "Founder is live...",
    "Pitch in progress...",
    "Holding the room...",
    "Making the case...",
  ],
  sharkSpeaking: [
    "Shark is live...",
    "Offer in motion...",
    "Pressure is building...",
    "The tank is circling...",
  ],
};

state.actorNodes.set("entrepreneur", {
  id: "entrepreneur",
  root: null,
  bubble: elements.founderBubble,
  meta: elements.founderMeta,
  text: elements.founderText,
  tag: elements.founderTag,
  tagName: elements.founderName,
  tagStatus: elements.founderTagStatus,
  displayName: "Entrepreneur",
});

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function stopDirectorMode() {
  if (state.directorModeTimer) {
    window.clearTimeout(state.directorModeTimer);
    state.directorModeTimer = null;
  }

  document.body.classList.remove("director-mode");
}

function startDirectorMode() {
  stopDirectorMode();
  state.directorModeTimer = window.setTimeout(() => {
    document.body.classList.add("director-mode");
    state.directorModeTimer = null;
  }, 2600);
}

function getGeneratingPhrases() {
  const actorId = state.currentGeneratingSpeakerId;
  const phase = state.currentGeneratingSpeakerPhase;

  if (actorId === "entrepreneur") {
    return phase === "speaking" ? GENERATING_COPY.founderSpeaking : GENERATING_COPY.founderThinking;
  }

  if (actorId) {
    return phase === "speaking" ? GENERATING_COPY.sharkSpeaking : GENERATING_COPY.sharkThinking;
  }

  return GENERATING_COPY.generic;
}

function refreshGenerateButtonLabel() {
  if (!state.isGenerating) {
    elements.generateButton.textContent = DEFAULT_BUTTON_LABEL;
    return;
  }

  const phrases = getGeneratingPhrases();
  elements.generateButton.textContent = phrases[state.generatePhraseIndex % phrases.length];
}

function stopGeneratePhraseCycle() {
  if (state.generatePhraseTimer) {
    window.clearInterval(state.generatePhraseTimer);
    state.generatePhraseTimer = null;
  }
}

function startGeneratePhraseCycle() {
  stopGeneratePhraseCycle();
  state.generatePhraseIndex = 0;
  refreshGenerateButtonLabel();
  state.generatePhraseTimer = window.setInterval(() => {
    const phrases = getGeneratingPhrases();
    state.generatePhraseIndex = (state.generatePhraseIndex + 1) % phrases.length;
    refreshGenerateButtonLabel();
  }, 2400);
}

function setGeneratingSpeaker(actorId, phase = "thinking") {
  state.currentGeneratingSpeakerId = actorId || null;
  state.currentGeneratingSpeakerPhase = actorId ? phase : "idle";

  if (state.isGenerating) {
    state.generatePhraseIndex = 0;
    refreshGenerateButtonLabel();
  }
}

function formatTimecode(totalMs) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function stopLiveClock({ reset = false } = {}) {
  if (state.liveClockTimer) {
    window.clearInterval(state.liveClockTimer);
    state.liveClockTimer = null;
  }

  if (reset) {
    state.liveClockStartedAt = null;
    elements.hudTimecode.textContent = "00:00:00";
  }
}

function startLiveClock() {
  stopLiveClock();
  state.liveClockStartedAt = Date.now();
  elements.hudTimecode.textContent = "00:00:00";
  state.liveClockTimer = window.setInterval(() => {
    if (!state.liveClockStartedAt) {
      return;
    }

    elements.hudTimecode.textContent = formatTimecode(Date.now() - state.liveClockStartedAt);
  }, 250);
}

function setStatus(copy) {
  elements.statusCopy.textContent = copy || "";
}

function getIdleStatusCopy() {
  if (!state.config?.ttsEnabled) {
    return "Ready when you are. Add an OpenAI API key for live voices.";
  }

  return state.userTtsEnabled ? "Ready when you are. Voice is enabled." : "";
}

function inferStartupName(pitchText) {
  if (!pitchText) {
    return "Untitled startup";
  }

  const namedPattern = pitchText.match(
    /\b(?:called|named|is)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3})\b/,
  );

  if (namedPattern?.[1]) {
    return namedPattern[1].trim();
  }

  const fallbackPattern = pitchText.match(/\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})\b/);
  return fallbackPattern?.[1]?.trim() || "Untitled startup";
}

function inferProductName(pitchText) {
  if (!pitchText) {
    return "";
  }

  const productPattern = pitchText.match(
    /\b(?:product|device|platform|company|startup)\s+(?:called|named|is)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3})\b/i,
  );

  return productPattern?.[1]?.trim() || "";
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/[_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimSentenceWords(text, maxWords = 24) {
  const words = stripMarkdown(text).split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return stripMarkdown(text).replace(/[.!?]*$/, ".");
  }

  return `${words.slice(0, maxWords).join(" ").replace(/[.!?]*$/, "")}...`;
}

function summarizeFounderBubbleText(text) {
  const clean = stripMarkdown(text);

  if (!clean) {
    return "";
  }

  const sentenceCount = clean.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;

  if (clean.length <= 170 && sentenceCount <= 1) {
    return clean;
  }

  const startupName = inferStartupName(clean);
  const amount = extractDealAmount(clean);
  const equityMatch =
    clean.match(/(\d+(?:\.\d+)?)\s*%\s*equity/i) ||
    clean.match(/for\s+(\d+(?:\.\d+)?)\s*%/i);
  const equity = equityMatch ? `${equityMatch[1]}% equity` : "";

  const businessClauseMatch =
    clean.match(/\b(?:we|it)\s+(?:automate|automates|help|helps|let|lets|turn|turns|make|makes|build|builds|power|powers|run|runs|give|gives|streamline|streamlines)\b[^.?!,;]*/i) ||
    clean.match(/\b(?:the|an?|our)\s+([^.?!,;]{18,110})/i);

  let businessClause = businessClauseMatch?.[0] || "";
  businessClause = businessClause
    .replace(/^we\s+/i, "")
    .replace(/^it\s+/i, "is ")
    .replace(/\bsharks\b[:,]?/gi, "")
    .trim();

  if (businessClause && startupName && !businessClause.toLowerCase().startsWith(startupName.toLowerCase())) {
    businessClause = `${startupName} ${businessClause}`;
  }

  let summary = businessClause;

  if (amount || equity) {
    const ask = [amount, equity ? `for ${equity}` : ""].filter(Boolean).join(" ");
    summary = summary
      ? `${summary.replace(/[.!?]*$/, "")} and is asking for ${ask}.`
      : `${startupName || "The founder"} is asking for ${ask}.`;
  }

  if (!summary) {
    const firstSentence = clean.match(/.+?[.!?](?:\s|$)/)?.[0]?.trim() || clean;
    return trimSentenceWords(firstSentence, 22);
  }

  return trimSentenceWords(summary, 24);
}

function getBubbleDisplayText(actorId, text) {
  if (actorId !== "entrepreneur") {
    return text;
  }

  return summarizeFounderBubbleText(text);
}

function updateReportButtonState({ loading = false } = {}) {
  const hasPitch = Boolean(state.currentEpisode.founderPitch.trim());
  elements.reportButton.disabled = loading || state.isGenerating || !hasPitch;
  elements.reportButton.textContent = loading ? "Building report..." : "Download report";
}

function isTtsEnabled() {
  return Boolean(state.config?.ttsEnabled && state.userTtsEnabled);
}

function updateTtsUi() {
  const available = Boolean(state.config?.ttsEnabled);

  elements.ttsToggle.disabled = !available || state.isGenerating;
  elements.ttsToggle.checked = available && state.userTtsEnabled;

  if (!available) {
    elements.ttsToggleCopy.textContent = "Voice unavailable";
    elements.disclosureCopy.textContent = "";
    return;
  }

  elements.ttsToggleCopy.textContent = state.userTtsEnabled ? "Voice on" : "Voice off";
  elements.disclosureCopy.textContent = "";
}

function setGenerating(isGenerating) {
  state.isGenerating = isGenerating;
  elements.generateButton.disabled = isGenerating;
  document.body.classList.toggle("is-live", isGenerating);

  if (isGenerating) {
    startGeneratePhraseCycle();
    startDirectorMode();
  } else {
    stopGeneratePhraseCycle();
    stopDirectorMode();
    setGeneratingSpeaker(null);
    refreshGenerateButtonLabel();
  }

  updateTtsUi();
  updateReportButtonState();
}

function createActorState() {
  return {
    fullText: "",
    visibleText: "",
    prefetchedCursor: 0,
    spokenCursor: 0,
    thinking: false,
  };
}

function getActorState(actorId) {
  if (!state.actorStreams.has(actorId)) {
    state.actorStreams.set(actorId, createActorState());
  }

  return state.actorStreams.get(actorId);
}

function getActorNode(actorId) {
  return state.actorNodes.get(actorId) || null;
}

function updateFounderStatus(name, status) {
  elements.founderName.textContent = name;
  elements.founderTagStatus.textContent = status;
}

function clearActorVisualState(actorNode) {
  if (!actorNode) {
    return;
  }

  actorNode.bubble.classList.remove("is-active", "is-pinned", "is-offer", "is-out", "is-thinking");
  actorNode.tag.classList.remove("is-active", "is-offer", "is-out", "is-thinking");
}

function setActorThinking(actorId, isThinking) {
  const actorNode = getActorNode(actorId);

  if (!actorNode) {
    return;
  }

  actorNode.bubble.classList.toggle("is-thinking", isThinking);
  actorNode.tag.classList.toggle("is-thinking", isThinking);
}

function setActorDecisionTone(actorId, decision) {
  const actorNode = getActorNode(actorId);

  if (!actorNode) {
    return;
  }

  actorNode.bubble.classList.remove("is-offer", "is-out");
  actorNode.tag.classList.remove("is-offer", "is-out");

  if (decision === "INVEST") {
    actorNode.bubble.classList.add("is-offer");
    actorNode.tag.classList.add("is-offer");
  } else if (decision === "OUT") {
    actorNode.bubble.classList.add("is-out");
    actorNode.tag.classList.add("is-out");
  }
}

function clearMomentBanner() {
  if (state.momentTimer) {
    window.clearTimeout(state.momentTimer);
    state.momentTimer = null;
  }

  elements.momentBanner.className = "moment-banner";
}

function showMomentBanner({ kicker, title, detail, tone = "neutral", duration = 2600 }) {
  clearMomentBanner();
  elements.momentKicker.textContent = kicker;
  elements.momentTitle.textContent = title;
  elements.momentDetail.textContent = detail;
  elements.momentBanner.className = `moment-banner visible ${tone}`;

  if (duration > 0) {
    state.momentTimer = window.setTimeout(() => {
      elements.momentBanner.className = "moment-banner";
      state.momentTimer = null;
    }, duration);
  }
}

function clearDealStamp() {
  elements.dealStamp.className = "deal-stamp";
}

function extractDealAmount(text) {
  if (typeof text !== "string") {
    return null;
  }

  const match = text.match(/\$[\d,.]+(?:\s?[kKmM])?/);
  return match ? match[0].replace(/\s+/g, "") : null;
}

function normalizeSharkName(name) {
  if (typeof name !== "string" || !name.trim()) {
    return "a shark";
  }

  const trimmed = name.trim();
  return trimmed.split(" The ")[0] || trimmed;
}

function showDealStamp({ amount, company, sharkName, tone = "deal" }) {
  const isNoDeal = tone === "no-deal";
  elements.dealStampCheck.textContent = isNoDeal ? "✕" : "✓";
  elements.dealStampKicker.textContent = isNoDeal ? "No deal" : "Deal locked";
  elements.dealStampAmount.textContent = amount || (isNoDeal ? "NO DEAL" : "Deal");
  elements.dealStampCompany.textContent = company || "Untitled startup";
  elements.dealStampShark.textContent = isNoDeal
    ? `with ${normalizeSharkName(sharkName || "the tank")}`
    : `with ${normalizeSharkName(sharkName)}`;
  elements.dealStamp.className = `deal-stamp ${tone} visible`;
}

function setActorTagVisible(actorId, isVisible) {
  const actorNode = getActorNode(actorId);

  if (!actorNode?.tag) {
    return;
  }

  actorNode.tag.classList.toggle("visible", isVisible);
}

function resolvePrimaryInvestorId(investorNames = []) {
  const [firstInvestor] = investorNames;

  if (!firstInvestor) {
    return null;
  }

  const match = state.sharkRoster.find((shark) => {
    const displayName = shark.displayName || "";
    const fullName = shark.fullName || "";
    return firstInvestor === displayName || firstInvestor === fullName || firstInvestor.includes(displayName);
  });

  return match?.id || null;
}

function deriveFounderMoment(dealSummary) {
  if (!dealSummary) {
    return {
      kicker: "Tank verdict",
      title: "Episode complete",
      detail: "The round is over.",
      tone: "neutral",
    };
  }

  if (dealSummary.outcome === "Deal") {
    return {
      kicker: "Founder move",
      title: "Founder accepts",
      detail: dealSummary.finalTerms,
      tone: "deal",
    };
  }

  if (dealSummary.outcome === "Multi-Shark Deal") {
    return {
      kicker: "Founder move",
      title: "Founder counters",
      detail: dealSummary.finalTerms,
      tone: "counter",
    };
  }

  return {
    kicker: "Tank verdict",
    title: "No deal",
    detail: dealSummary.rationale || "The founder leaves without a deal.",
    tone: "out",
  };
}

function hideSharkBubbles() {
  for (const [actorId, actorNode] of state.actorNodes) {
    if (actorId === "entrepreneur") {
      continue;
    }

    actorNode.bubble.classList.remove("visible");
    actorNode.bubble.classList.remove("is-active", "is-thinking");
    actorNode.tag.classList.remove("is-active", "is-thinking");
  }
}

function hideAllBubbles() {
  elements.founderBubble.classList.remove("visible");
  elements.founderBubble.classList.remove("is-active", "is-pinned", "is-thinking");
  elements.founderTag.classList.remove("is-active", "is-thinking");
  hideSharkBubbles();
}

function setActiveSpeaker(actorId, phase = "speaking") {
  for (const actorNode of state.actorNodes.values()) {
    actorNode.bubble.classList.remove("is-active", "is-pinned", "is-thinking");
    actorNode.tag.classList.remove("is-active", "is-thinking");
  }

  hideSharkBubbles();

  if (actorId !== "entrepreneur" && getActorState("entrepreneur").visibleText.trim()) {
    elements.founderBubble.classList.add("visible", "is-pinned");
  } else if (actorId === "entrepreneur") {
    elements.founderBubble.classList.add("visible", "is-active");
    elements.founderTag.classList.add("is-active");
  }

  const actorNode = getActorNode(actorId);

  if (actorNode?.bubble) {
    actorNode.bubble.classList.add("visible", "is-active");
  }

  if (actorNode?.tag) {
    actorNode.tag.classList.add("is-active");
  }

  setActorThinking(actorId, phase === "thinking");
  setGeneratingSpeaker(actorId, phase);
  state.stage?.setActiveSpeaker(actorId, phase);
}

function extractReadySentences(text, startIndex) {
  const availableText = text.slice(startIndex);
  const sentencePattern = /.+?[.!?]+(?:["')\]]*)\s*/gs;
  const sentences = [];
  let consumed = 0;
  let match;

  while ((match = sentencePattern.exec(availableText))) {
    const sentence = match[0].trim();

    if (sentence) {
      sentences.push(sentence);
    }

    consumed = sentencePattern.lastIndex;
  }

  return { sentences, consumed };
}

async function ensureAudioReady() {
  if (!isTtsEnabled()) {
    return null;
  }

  if (!("AudioContext" in window || "webkitAudioContext" in window)) {
    return null;
  }

  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
  }

  if (state.audioContext.state === "suspended") {
    await state.audioContext.resume();
  }

  return state.audioContext;
}

function cancelAudioPlayback() {
  state.audioQueue = [];
  state.isPlayingAudio = false;

  if (state.currentAudioSource) {
    try {
      state.currentAudioSource.stop();
    } catch {
      // noop
    }

    state.currentAudioSource = null;
  }
}

async function fetchSpeechBuffer(speakerId, text) {
  if (!isTtsEnabled()) {
    return null;
  }

  const audioContext = await ensureAudioReady();

  if (!audioContext) {
    return null;
  }

  const cacheKey = `${speakerId}:${text}`;

  if (state.audioCache.has(cacheKey)) {
    return state.audioCache.get(cacheKey);
  }

  const promise = (async () => {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speakerId,
        text,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.detail || "Speech generation failed.");
    }

    const arrayBuffer = await response.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer.slice(0));
  })().catch((error) => {
    state.audioCache.delete(cacheKey);
    throw error;
  });

  state.audioCache.set(cacheKey, promise);
  return promise;
}

async function playAudioBuffer(audioBuffer, token) {
  if (!audioBuffer || !state.audioContext || token !== state.runToken) {
    return;
  }

  await new Promise((resolve) => {
    const source = state.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(state.audioContext.destination);
    state.currentAudioSource = source;
    source.onended = () => {
      if (state.currentAudioSource === source) {
        state.currentAudioSource = null;
      }

      resolve();
    };
    source.start();
  });
}

function enqueueSpeech(speakerId, text, token) {
  if (!isTtsEnabled() || !text.trim() || token !== state.runToken) {
    return;
  }

  state.audioQueue.push({ speakerId, text, token });
  void processSpeechQueue();
}

function prefetchSpeechSentences(actorId, token) {
  if (!isTtsEnabled() || token !== state.runToken) {
    return;
  }

  const actorState = getActorState(actorId);
  const { sentences, consumed } = extractReadySentences(
    actorState.fullText,
    actorState.prefetchedCursor,
  );

  sentences.forEach((sentence) => {
    void fetchSpeechBuffer(actorId, sentence).catch(() => {
      // Ignore prefetch failures. Playback will fall back to runtime fetch or silent text.
    });
  });

  actorState.prefetchedCursor += consumed;
}

function prefetchSpeechRemainder(actorId, token) {
  if (!isTtsEnabled() || token !== state.runToken) {
    return;
  }

  const actorState = getActorState(actorId);
  const remainder = actorState.fullText.slice(actorState.prefetchedCursor).trim();

  if (!remainder) {
    return;
  }

  actorState.prefetchedCursor = actorState.fullText.length;
  void fetchSpeechBuffer(actorId, remainder).catch(() => {
    // Ignore prefetch failures. Playback will fall back to runtime fetch or silent text.
  });
}

async function processSpeechQueue() {
  if (state.isPlayingAudio) {
    return;
  }

  state.isPlayingAudio = true;

  while (state.audioQueue.length > 0) {
    const item = state.audioQueue.shift();

    if (!item || item.token !== state.runToken) {
      continue;
    }

    try {
      const audioBuffer = await fetchSpeechBuffer(item.speakerId, item.text);
      await playAudioBuffer(audioBuffer, item.token);
    } catch {
      setStatus("Voice playback unavailable. Streaming text only.");
      break;
    }
  }

  state.isPlayingAudio = false;
}

function syncSpeechSentences(actorId, token) {
  const actorState = getActorState(actorId);
  const { sentences, consumed } = extractReadySentences(
    actorState.visibleText,
    actorState.spokenCursor,
  );

  sentences.forEach((sentence) => {
    enqueueSpeech(actorId, sentence, token);
  });

  actorState.spokenCursor += consumed;
}

function flushSpeechRemainder(actorId, token) {
  const actorState = getActorState(actorId);
  const remainder = actorState.visibleText.slice(actorState.spokenCursor).trim();

  if (!remainder) {
    return;
  }

  actorState.spokenCursor = actorState.visibleText.length;
  enqueueSpeech(actorId, remainder, token);
}

function resetFounderState() {
  elements.founderMeta.textContent = "Founder";
  elements.founderText.textContent =
    "Press Generate. The founder enters from the hallway and starts pitching.";
  updateFounderStatus("Waiting backstage", "Founder");
}

function resetActorNode(actorNode) {
  actorNode.meta.textContent = actorNode.displayName;
  actorNode.text.textContent = "";
  actorNode.tagStatus.textContent = "Ready";
  clearActorVisualState(actorNode);
}

function clearStage() {
  hideAllBubbles();
  state.actorStreams.clear();
  stopLiveClock({ reset: true });
  clearMomentBanner();
  clearDealStamp();
  state.currentEpisode = {
    founderPitch: "",
    startupName: "Untitled startup",
    productName: "",
    dealOutcome: null,
  };
  resetFounderState();
  elements.founderTag.classList.add("visible");
  state.stage?.resetPerformance();
  updateReportButtonState();

  for (const [actorId, actorNode] of state.actorNodes) {
    if (actorId === "entrepreneur") {
      continue;
    }

    resetActorNode(actorNode);
    actorNode.tag.classList.remove("visible");
  }

  clearActorVisualState(getActorNode("entrepreneur"));
}

function positionOverlay(element, point, anchor) {
  if (!element || !point) {
    return;
  }

  element.style.visibility = point.visible ? "visible" : "hidden";

  if (!point.visible) {
    return;
  }

  const rect = element.getBoundingClientRect();
  const width = rect.width || element.offsetWidth || 0;
  const height = rect.height || element.offsetHeight || 0;
  const top = anchor === "bubble" ? point.y - height - 18 : point.y + 18;
  const left = point.x - width / 2;
  element.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
}

function overlaysOverlap(a, b, padding = 12) {
  return !(
    a.left + a.width + padding <= b.left
    || b.left + b.width + padding <= a.left
    || a.top + a.height + padding <= b.top
    || b.top + b.height + padding <= a.top
  );
}

function clampOverlay(entry, viewport, anchor) {
  const marginX = 12;
  const minTop = anchor === "bubble" ? 82 : 24;
  const controlBarHeight = elements.controlBar?.offsetHeight || 120;
  const maxTop = anchor === "tag"
    ? viewport.height - controlBarHeight - entry.height - 22
    : viewport.height - entry.height - 20;

  entry.left = Math.min(
    Math.max(entry.left, marginX),
    Math.max(marginX, viewport.width - entry.width - marginX),
  );
  entry.top = Math.min(
    Math.max(entry.top, minTop),
    Math.max(minTop, maxTop),
  );
}

function buildOverlayEntry(actorId, element, point, anchor) {
  const rect = element.getBoundingClientRect();
  const width = rect.width || element.offsetWidth || 0;
  const height = rect.height || element.offsetHeight || 0;
  const top = anchor === "bubble" ? point.y - height - 18 : point.y + 18;
  const left = point.x - width / 2;

  return {
    actorId,
    anchor,
    element,
    point,
    width,
    height,
    left,
    top,
  };
}

function resolveOverlayCollisions(entries, viewport, anchor) {
  const sortedEntries = [...entries].sort((a, b) => a.top - b.top || a.left - b.left);
  const accepted = [];

  sortedEntries.forEach((entry) => {
    clampOverlay(entry, viewport, anchor);

    for (let pass = 0; pass < 8; pass += 1) {
      let moved = false;

      for (const other of accepted) {
        if (!overlaysOverlap(entry, other, anchor === "bubble" ? 16 : 12)) {
          continue;
        }

        const overlapX = Math.min(entry.left + entry.width, other.left + other.width)
          - Math.max(entry.left, other.left);
        const entryCenter = entry.left + entry.width / 2;
        const otherCenter = other.left + other.width / 2;
        const horizontalDirection = entryCenter >= otherCenter ? 1 : -1;

        entry.left += horizontalDirection * (overlapX + (anchor === "bubble" ? 18 : 14));
        clampOverlay(entry, viewport, anchor);

        if (overlaysOverlap(entry, other, anchor === "bubble" ? 16 : 12)) {
          if (anchor === "bubble") {
            const aboveTop = other.top - entry.height - 18;
            const belowTop = other.top + other.height + 16;
            entry.top = aboveTop >= 82 ? aboveTop : belowTop;
          } else {
            entry.top = other.top + other.height + 14;
          }
          clampOverlay(entry, viewport, anchor);
        }

        moved = true;
      }

      if (!moved) {
        break;
      }
    }

    accepted.push(entry);
  });

  return accepted;
}

function syncOverlayLayout(layout) {
  const viewport = {
    width: elements.sceneRoot.clientWidth || window.innerWidth,
    height: elements.sceneRoot.clientHeight || window.innerHeight,
  };
  const bubbleEntries = [];
  const tagEntries = [];

  for (const [actorId, actorNode] of state.actorNodes) {
    const actorLayout = layout?.[actorId];

    if (!actorLayout) {
      continue;
    }

    const bubbleVisible = Boolean(actorLayout.bubble?.visible && actorNode.bubble.classList.contains("visible"));
    const tagVisible = Boolean(actorLayout.tag?.visible && actorNode.tag.classList.contains("visible"));

    actorNode.bubble.style.visibility = bubbleVisible ? "visible" : "hidden";
    actorNode.tag.style.visibility = tagVisible ? "visible" : "hidden";

    if (bubbleVisible) {
      bubbleEntries.push(buildOverlayEntry(actorId, actorNode.bubble, actorLayout.bubble, "bubble"));
    }

    if (tagVisible) {
      tagEntries.push(buildOverlayEntry(actorId, actorNode.tag, actorLayout.tag, "tag"));
    }
  }

  resolveOverlayCollisions(bubbleEntries, viewport, "bubble").forEach((entry, index) => {
    entry.element.style.transform = `translate3d(${Math.round(entry.left)}px, ${Math.round(entry.top)}px, 0)`;
    entry.element.style.zIndex = String(40 + index);
  });

  resolveOverlayCollisions(tagEntries, viewport, "tag").forEach((entry, index) => {
    entry.element.style.transform = `translate3d(${Math.round(entry.left)}px, ${Math.round(entry.top)}px, 0)`;
    entry.element.style.zIndex = String(20 + index);
  });
}

function createFallbackStage({ mount, onLayout }) {
  const canvas = document.createElement("canvas");
  canvas.className = "studio-canvas studio-canvas-fallback";
  mount.replaceChildren(canvas);

  const fallbackState = {
    sharks: [],
    activeSpeakerId: null,
    decisions: new Map(),
  };

  function getLayout(width, height) {
    const layout = {
      entrepreneur: {
        bubble: { x: width * 0.66, y: height * 0.33, visible: true },
        tag: { x: width * 0.63, y: height * 0.77, visible: true },
      },
    };
    const sharkXs = [0.17, 0.25, 0.34, 0.44, 0.55];

    fallbackState.sharks.forEach((shark, index) => {
      layout[shark.id] = {
        bubble: { x: width * sharkXs[index], y: height * (0.36 + Math.abs(index - 2) * 0.018), visible: true },
        tag: { x: width * sharkXs[index], y: height * 0.78, visible: true },
      };
    });

    return layout;
  }

  function drawFallbackStage(width, height) {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);

    const backdrop = context.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, "#12070b");
    backdrop.addColorStop(0.46, "#261117");
    backdrop.addColorStop(1, "#06080d");
    context.fillStyle = backdrop;
    context.fillRect(0, 0, width, height);

    const cityGlow = context.createRadialGradient(width * 0.2, height * 0.18, 10, width * 0.2, height * 0.18, width * 0.32);
    cityGlow.addColorStop(0, "rgba(92, 136, 255, 0.28)");
    cityGlow.addColorStop(1, "rgba(92, 136, 255, 0)");
    context.fillStyle = cityGlow;
    context.fillRect(0, 0, width, height * 0.5);

    const floorGradient = context.createLinearGradient(0, height * 0.58, width, height);
    floorGradient.addColorStop(0, "#4a2e21");
    floorGradient.addColorStop(0.52, "#74472f");
    floorGradient.addColorStop(1, "#382216");
    context.fillStyle = floorGradient;
    context.fillRect(0, height * 0.58, width, height * 0.42);

    context.fillStyle = "#1b1210";
    context.beginPath();
    context.moveTo(0, height * 0.54);
    context.lineTo(width * 0.56, height * 0.48);
    context.quadraticCurveTo(width * 0.72, height * 0.47, width * 0.82, height * 0.53);
    context.lineTo(width, height * 0.57);
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
    context.fill();

    context.strokeStyle = "rgba(199, 138, 88, 0.5)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(width * 0.34, height * 0.63, Math.min(width, height) * 0.24, Math.PI * 1.05, Math.PI * 1.93);
    context.stroke();

    const sharks = fallbackState.sharks;
    const sharkXs = [0.17, 0.25, 0.34, 0.44, 0.55];

    sharks.forEach((shark, index) => {
      const x = width * sharkXs[index];
      const y = height * (0.63 + Math.abs(index - 2) * 0.014);
      const isActive = fallbackState.activeSpeakerId === shark.id;
      const accent = isActive ? shark.color || "#f0cb98" : "#0c0e13";

      context.fillStyle = "rgba(0, 0, 0, 0.34)";
      context.fillRect(x - width * 0.052, y + height * 0.078, width * 0.104, height * 0.018);

      context.fillStyle = "#3c261d";
      context.fillRect(x - width * 0.06, y + height * 0.03, width * 0.12, height * 0.03);

      context.fillStyle = accent;
      context.beginPath();
      context.roundRect(x - width * 0.028, y - height * 0.008, width * 0.056, height * 0.1, width * 0.018);
      context.fill();

      context.beginPath();
      context.arc(x, y - height * 0.036, width * 0.016, 0, Math.PI * 2);
      context.fill();

      const decision = fallbackState.decisions.get(shark.id);
      if (decision && decision !== "READY") {
        context.fillStyle = decision === "INVEST" || decision === "DEAL" ? "rgba(98, 191, 137, 0.92)" : "rgba(196, 92, 92, 0.92)";
        context.beginPath();
        context.roundRect(x - width * 0.035, y - height * 0.12, width * 0.07, height * 0.03, 10);
        context.fill();
      }
    });

    const founderActive = fallbackState.activeSpeakerId === "entrepreneur";
    const founderX = width * 0.72;
    const founderY = height * 0.63;
    context.fillStyle = founderActive ? "#f0cb98" : "#15181f";
    context.beginPath();
    context.roundRect(founderX - width * 0.03, founderY + height * 0.005, width * 0.06, height * 0.13, width * 0.018);
    context.fill();
    context.beginPath();
    context.arc(founderX, founderY - height * 0.036, width * 0.017, 0, Math.PI * 2);
    context.fill();
  }

  function sync() {
    const bounds = mount.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    drawFallbackStage(width, height);
    onLayout(getLayout(width, height));
  }

  const handleResize = () => {
    sync();
  };

  window.addEventListener("resize", handleResize);
  window.requestAnimationFrame(sync);

  return {
    setSharks(sharks) {
      fallbackState.sharks = Array.isArray(sharks) ? sharks : [];
      sync();
    },
    setFounderLook() {},
    cueFounderEntrance() {
      fallbackState.activeSpeakerId = "entrepreneur";
      sync();
    },
    setActiveSpeaker(actorId) {
      fallbackState.activeSpeakerId = actorId || null;
      sync();
    },
    setDecision(actorId, decision) {
      fallbackState.decisions.set(actorId, decision || "READY");
      sync();
    },
    resetPerformance() {
      fallbackState.activeSpeakerId = null;
      fallbackState.decisions.clear();
      sync();
    },
    playHandshake(sharkId) {
      fallbackState.activeSpeakerId = sharkId || "entrepreneur";
      sync();
    },
    destroy() {
      window.removeEventListener("resize", handleResize);
    },
  };
}

function ensureStage() {
  if (state.stage) {
    return;
  }

  try {
    state.stage = new SharkTankStage({
      mount: elements.sceneRoot,
      onLayout: syncOverlayLayout,
    });
  } catch (error) {
    console.warn("Falling back to 2D studio canvas.", error);
    state.stage = createFallbackStage({
      mount: elements.sceneRoot,
      onLayout: syncOverlayLayout,
    });
  }
}

function renderSharks(sharks) {
  for (const [actorId, actorNode] of Array.from(state.actorNodes.entries())) {
    if (actorId === "entrepreneur") {
      continue;
    }

    actorNode.bubble.remove();
    actorNode.tag.remove();
    state.actorNodes.delete(actorId);
  }

  sharks.forEach((shark) => {
    const bubbleFragment = elements.actorBubbleTemplate.content.cloneNode(true);
    const tagFragment = elements.actorTagTemplate.content.cloneNode(true);
    const bubble = bubbleFragment.querySelector(".actor-bubble");
    const meta = bubbleFragment.querySelector(".bubble-meta");
    const text = bubbleFragment.querySelector(".bubble-text");
    const tag = tagFragment.querySelector(".actor-tag");
    const tagName = tagFragment.querySelector(".actor-tag-name");
    const tagStatus = tagFragment.querySelector(".actor-tag-status");

    meta.textContent = shark.displayName || shark.fullName;
    text.textContent = "";
    tagName.textContent = shark.displayName || shark.fullName;
    tagStatus.textContent = "Ready";

    elements.bubbleLayer.append(bubble);
    elements.tagLayer.append(tag);

    state.actorNodes.set(shark.id, {
      id: shark.id,
      root: null,
      bubble,
      meta,
      text,
      tag,
      tagName,
      tagStatus,
      displayName: shark.displayName || shark.fullName,
    });
  });

  ensureStage();
  state.stage.setSharks(sharks);
}

function resetRun() {
  state.runToken += 1;
  cancelAudioPlayback();
  setGeneratingSpeaker(null);

  if (state.currentSource) {
    state.currentSource.close();
    state.currentSource = null;
  }

  clearStage();
}

function mergeFinalText(actorState, finalText) {
  if (!finalText) {
    return "";
  }

  if (finalText.startsWith(actorState.fullText)) {
    return finalText.slice(actorState.fullText.length);
  }

  if (actorState.fullText.startsWith(finalText)) {
    return "";
  }

  return finalText;
}

function handleSpeakerStart(payload, token) {
  if (token !== state.runToken) {
    return;
  }

  const actorState = getActorState(payload.speakerId);
  Object.assign(actorState, createActorState());

  const actorNode = getActorNode(payload.speakerId);

  if (!actorNode) {
    return;
  }

  actorState.thinking = true;
  actorNode.meta.textContent = payload.displayName;
  actorNode.text.textContent = "";
  setActiveSpeaker(payload.speakerId, "thinking");

  if (payload.speakerId === "entrepreneur") {
    updateFounderStatus("Entrepreneur", "Thinking");
    setActorTagVisible("entrepreneur", true);
  } else {
    actorNode.tagStatus.textContent = "Thinking";
    setActorTagVisible(payload.speakerId, true);
  }

  setStatus(`${payload.displayName} is thinking...`);
}

function handleSpeakerDelta(payload, token) {
  if (token !== state.runToken) {
    return;
  }

  const actorState = getActorState(payload.speakerId);
  const actorNode = getActorNode(payload.speakerId);

  if (actorState.thinking) {
    actorState.thinking = false;
    setActorThinking(payload.speakerId, false);
    setActiveSpeaker(payload.speakerId, "speaking");

    if (payload.speakerId === "entrepreneur") {
      updateFounderStatus("Entrepreneur", "Pitching live");
    } else if (actorNode) {
      actorNode.tagStatus.textContent = "Speaking";
    }

    setStatus(`${actorNode?.displayName || payload.speakerId} is speaking...`);
  }

  actorState.fullText += payload.text;
  actorState.visibleText += payload.text;

  if (actorNode) {
    actorNode.text.textContent = getBubbleDisplayText(payload.speakerId, actorState.visibleText);
  }

  prefetchSpeechSentences(payload.speakerId, token);
  syncSpeechSentences(payload.speakerId, token);
}

function handleSpeakerEnd(payload, token) {
  if (token !== state.runToken) {
    return;
  }

  const actorState = getActorState(payload.speakerId);
  const extraText = mergeFinalText(actorState, payload.text);

  if (extraText) {
    actorState.fullText += extraText;
    actorState.visibleText += extraText;
  }

  if (actorState.thinking && actorState.visibleText.trim()) {
    setActiveSpeaker(payload.speakerId, "speaking");
  }

  actorState.thinking = false;
  setActorThinking(payload.speakerId, false);
  prefetchSpeechSentences(payload.speakerId, token);
  prefetchSpeechRemainder(payload.speakerId, token);

  const actorNode = getActorNode(payload.speakerId);

  if (actorNode) {
    actorNode.text.textContent = getBubbleDisplayText(payload.speakerId, actorState.visibleText);
    actorNode.meta.textContent = payload.badge
      ? `${payload.displayName} • ${payload.badge}`
      : payload.displayName;
  }

  if (payload.speakerId !== "entrepreneur") {
    const sharkNode = getActorNode(payload.speakerId);

    if (sharkNode) {
      sharkNode.tagStatus.textContent =
        payload.decision === "INVEST"
          ? "Offer live"
          : payload.decision === "OUT"
            ? "I'm out"
            : "Done";
      setActorTagVisible(payload.speakerId, true);
    }

    state.stage?.setDecision(payload.speakerId, payload.decision);
  } else {
    updateFounderStatus("Entrepreneur", "Founder");

    if (payload.badge === "PITCH") {
      state.currentEpisode.founderPitch = payload.text || "";
      state.currentEpisode.startupName = inferStartupName(payload.text || "");
      state.currentEpisode.productName = inferProductName(payload.text || "");
      updateReportButtonState();
    }

    if (payload.decision === "ACCEPT" || payload.decision === "COUNTER" || payload.decision === "DECLINE") {
      showMomentBanner({
        kicker: "Founder move",
        title:
          payload.decision === "ACCEPT"
            ? "Founder accepts"
            : payload.decision === "COUNTER"
              ? "Founder counters"
              : "Founder walks",
        detail: payload.offerSummary || payload.text || "The entrepreneur makes the call.",
        tone:
          payload.decision === "ACCEPT"
            ? "deal"
            : payload.decision === "COUNTER"
              ? "counter"
              : "out",
        duration: 3000,
      });
    }
  }

  if (payload.decision === "INVEST") {
    showMomentBanner({
      kicker: payload.displayName,
      title: "Offer on the table",
      detail: payload.offerSummary || "A shark wants in.",
      tone: "offer",
      duration: 2200,
    });
    setStatus(`${payload.displayName} is in: ${payload.offerSummary || "offer on the table"}`);
  } else if (payload.decision === "OUT") {
    setStatus(`${payload.displayName} is out.`);
  }
  flushSpeechRemainder(payload.speakerId, token);
}

function handleDealOutcome(payload, token) {
  if (token !== state.runToken) {
    return;
  }

  state.currentEpisode.dealOutcome = payload;

  const title =
    payload.founderMove === "ACCEPT"
      ? "Founder accepts"
      : payload.founderMove === "COUNTER"
        ? "Founder counters"
        : payload.finalDecision === "DEAL"
          ? "Deal locked"
          : "No deal";

  showMomentBanner({
    kicker: payload.sharkName || "Tank verdict",
    title,
    detail:
      payload.finalTermsSummary ||
      payload.founderTermsSummary ||
      (payload.finalDecision === "DEAL" ? "A shark closes the deal." : "The negotiation falls apart."),
    tone:
      payload.finalDecision === "DEAL"
        ? "deal"
        : payload.founderMove === "COUNTER"
          ? "counter"
          : "out",
    duration: 4200,
  });

  if (payload.handshakeReady && payload.sharkId) {
    state.stage?.playHandshake(payload.sharkId);
  }
}

function handleEpisodeEnd(payload, token) {
  if (token !== state.runToken) {
    return;
  }

  hideSharkBubbles();
  setGeneratingSpeaker(null);
  state.stage?.setActiveSpeaker(null);
  elements.founderBubble.classList.toggle(
    "visible",
    Boolean(getActorState("entrepreneur").visibleText.trim()),
  );

  if (!state.currentEpisode.dealOutcome) {
    const founderMoment = deriveFounderMoment(payload.dealSummary);
    showMomentBanner({
      ...founderMoment,
      duration: 3600,
    });
  }

  if (
    !state.currentEpisode.dealOutcome &&
    payload.handshakeReady &&
    (payload.dealSummary?.outcome === "Deal" || payload.dealSummary?.outcome === "Multi-Shark Deal")
  ) {
    const primaryInvestorId = resolvePrimaryInvestorId(payload.dealSummary.investors);
    state.stage?.playHandshake(primaryInvestorId);
  }

  const finalDeal =
    state.currentEpisode.dealOutcome?.finalDecision === "DEAL" ||
    payload.dealSummary?.outcome === "Deal" ||
    payload.dealSummary?.outcome === "Multi-Shark Deal";

  if (finalDeal) {
    showDealStamp({
      amount:
        extractDealAmount(state.currentEpisode.dealOutcome?.finalTermsSummary) ||
        extractDealAmount(payload.dealSummary?.finalTerms),
      company: state.currentEpisode.startupName,
      sharkName:
        state.currentEpisode.dealOutcome?.sharkName ||
        payload.dealSummary?.investors?.[0] ||
        "a shark",
      tone: "deal",
    });
  } else {
    showDealStamp({
      amount: "NO DEAL",
      company: state.currentEpisode.startupName,
      sharkName: "the tank",
      tone: "no-deal",
    });
  }

  setStatus("");
}

async function startLiveEpisode() {
  resetRun();
  const token = state.runToken;
  state.audioCache.clear();

  if (isTtsEnabled()) {
    try {
      await ensureAudioReady();
    } catch {
      // Browser autoplay restrictions are handled by the click gesture.
    }
  }

  setGenerating(true);
  updateFounderStatus("Entering the tank", "Founder");
  setStatus(
    isTtsEnabled()
      ? "Stand by. Founder entering from the hallway..."
      : "Stand by. Founder entering from the hallway. Voice is off.",
  );

  const source = new EventSource("/api/live-episode");
  state.currentSource = source;

  source.addEventListener("stage", (event) => {
    if (token !== state.runToken) {
      return;
    }

    const payload = JSON.parse(event.data);

    if (Array.isArray(payload.sharks)) {
      state.sharkRoster = payload.sharks;
      renderSharks(payload.sharks);
      clearStage();
    }

    if (payload.founderLook) {
      state.stage?.setFounderLook(payload.founderLook);
    }

    state.stage?.cueFounderEntrance(payload.entranceDurationMs || 1800);

    setStatus(
      payload.runtime === "agents"
        ? isTtsEnabled()
          ? "Live agents and voices are on air."
          : "Live agents are on air. Text-only mode."
        : "Demo feed is on air. Add an API key for live agents and voices.",
    );
  });

  source.addEventListener("speaker_start", (event) => {
    handleSpeakerStart(JSON.parse(event.data), token);
  });

  source.addEventListener("speaker_delta", (event) => {
    handleSpeakerDelta(JSON.parse(event.data), token);
  });

  source.addEventListener("speaker_end", (event) => {
    handleSpeakerEnd(JSON.parse(event.data), token);
  });

  source.addEventListener("deal_outcome", (event) => {
    handleDealOutcome(JSON.parse(event.data), token);
  });

  source.addEventListener("episode_end", (event) => {
    handleEpisodeEnd(JSON.parse(event.data), token);
  });

  source.addEventListener("done", () => {
    if (token !== state.runToken) {
      return;
    }

    setGenerating(false);
    source.close();
    state.currentSource = null;
  });

  source.addEventListener("stream_error", (event) => {
    if (token !== state.runToken) {
      return;
    }

    const payload = JSON.parse(event.data);
    setGenerating(false);
    setStatus(payload.detail || "The studio feed dropped.");
    source.close();
    state.currentSource = null;
  });

  source.onerror = () => {
    if (token !== state.runToken) {
      return;
    }

    if (source.readyState === EventSource.CLOSED && state.isGenerating) {
      setGenerating(false);
    }
  };
}

async function fetchConfig() {
  const response = await fetch("/api/config");
  const data = await response.json();

  state.config = data;
  state.sharkRoster = data.sharks;
  state.userTtsEnabled = false;
  ensureStage();
  renderSharks(data.sharks);
  clearStage();
  updateTtsUi();
  updateReportButtonState();
  setStatus(getIdleStatusCopy());
}

elements.ttsToggle.addEventListener("change", () => {
  const enabled = Boolean(state.config?.ttsEnabled) && elements.ttsToggle.checked;
  state.userTtsEnabled = enabled;

  if (!enabled) {
    cancelAudioPlayback();
  }

  updateTtsUi();

  if (!state.isGenerating) {
    setStatus(getIdleStatusCopy());
  }
});

elements.reportButton.addEventListener("click", async () => {
  const founderPitch = state.currentEpisode.founderPitch.trim();

  if (!founderPitch) {
    return;
  }

  updateReportButtonState({ loading: true });
  setStatus("Building feasibility report...");

  try {
    const response = await fetch("/api/feasibility-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startupName: state.currentEpisode.startupName,
        productName: state.currentEpisode.productName,
        founderPitch,
        concept: founderPitch,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.detail || "Feasibility report generation failed.");
    }

    const payload = await response.json();
    const blob = new Blob([payload.download.content], { type: payload.download.mimeType });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = payload.download.fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    setStatus(`Feasibility report downloaded for ${payload.startupName}.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Feasibility report generation failed.");
  } finally {
    updateReportButtonState();
  }
});

elements.generateButton.addEventListener("click", () => {
  void startLiveEpisode();
});

await fetchConfig();
