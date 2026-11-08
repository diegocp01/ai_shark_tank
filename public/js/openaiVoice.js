// Server-owned speech text and voices. Only opaque show tokens and beat IDs
// cross this boundary; the API key never reaches the browser.
export function createOpenAIVoice({ onError = () => {}, onActivity = () => {} } = {}) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let context, session, source, active, paused = false, serial = 0;
  const cache = new Map(), pending = new Map();
  function audioContext() { return context ||= new AudioContext(); }
  async function unlock() { if (AudioContext) await audioContext().resume(); }
  function stopSource() {
    if (source) { source.onended = null; source.stop(); source.disconnect(); source = null; }
    onActivity(false);
  }
  function complete() { stopSource(); const previous = active; active = null; previous?.resolve(); }
  function cancel() {
    serial++; complete(); paused = false;
    for (const entry of pending.values()) entry.controller.abort();
    pending.clear();
  }
  async function load(beatId) {
    if (cache.has(beatId)) return cache.get(beatId);
    if (pending.has(beatId)) return pending.get(beatId).promise;
    if (!session) throw new Error("This show has no voice session.");
    const token = session.token;
    const controller = new AbortController();
    const entry = { controller, promise: null };
    entry.promise = (async () => {
      const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, beatId }), signal: controller.signal });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.detail || "OpenAI voices are unavailable."); }
      const buffer = await audioContext().decodeAudioData(await response.arrayBuffer());
      if (session?.token === token && !controller.signal.aborted) cache.set(beatId, buffer);
      return buffer;
    })().finally(() => { if (pending.get(beatId) === entry) pending.delete(beatId); });
    pending.set(beatId, entry);
    return entry.promise;
  }
  function play() {
    if (!active?.buffer || paused) return;
    stopSource();
    const task = active;
    if (task.offset >= task.buffer.duration) { complete(); return; }
    source = audioContext().createBufferSource(); source.buffer = task.buffer;
    source.playbackRate.value = task.speed; source.connect(context.destination);
    task.startedAt = context.currentTime;
    source.onended = () => { if (active === task) complete(); };
    source.start(0, task.offset); onActivity(true, task.speakerId);
  }
  return {
    supported: Boolean(AudioContext), available: Boolean(AudioContext), live: true,
    unlock,
    prepare(episode, speech) {
      if (session?.token !== speech?.token) { cancel(); cache.clear(); }
      session = speech;
    },
    prefetch(beat) { if (session && beat && !paused) void load(beat.id).catch(() => {}); },
    speak(speakerId, text, speed = 1, beatId) {
      complete(); const turn = ++serial;
      return new Promise(resolve => {
        active = { resolve, speakerId, speed: Math.min(2, Math.max(.6, speed)), offset: 0, buffer: null };
        const task = active;
        void (async () => {
          try {
            if (!paused) await unlock();
            const buffer = await load(beatId);
            if (turn !== serial || active !== task) return;
            task.buffer = buffer; play();
          } catch (error) {
            if (turn !== serial || active !== task) return;
            complete(); if (error.name !== "AbortError") onError(error.message);
          }
        })();
      });
    },
    pause() {
      paused = true;
      if (source && active) active.offset += (context.currentTime - active.startedAt) * active.speed;
      stopSource();
    },
    resume() { paused = false; void unlock().then(play).catch(() => { complete(); onError("Click the voice control to enable audio."); }); },
    cancel,
  };
}
