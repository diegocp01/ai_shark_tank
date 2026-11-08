import { createHash, randomUUID } from "node:crypto";
import { AIError } from "./client.js";

export const CAST_VOICES = {
  narrator: { voice: "cedar", direction: "Warm, cinematic television narrator. Measured and clear." },
  founder: { voice: "coral", direction: "Confident, enthusiastic startup founder pitching investors. Conversational and sincere." },
  rex: { voice: "onyx", direction: "A seasoned, analytical investor. Low, measured, direct delivery; dry humor." },
  luna: { voice: "marin", direction: "An encouraging product investor. Bright, perceptive and conversational." },
  max: { voice: "ash", direction: "A pragmatic brand investor. Calm, grounded confidence, deliberate questions." },
  vera: { voice: "sage", direction: "A candid, experienced investor. Warm but firm, with crisp emphasis." },
  wes: { voice: "echo", direction: "An energetic technology investor. Curious, spontaneous and direct." },
};

export function createSpeechService(client, { now = Date.now } = {}) {
  const episodes = new Map(), cache = new Map(), pending = new Map();
  let cacheBytes = 0;
  const ttl = 2 * 60 * 60 * 1000;
  return {
    describe: () => ({ provider: "openai", model: "gpt-4o-mini-tts", voices: Object.fromEntries(Object.entries(CAST_VOICES).map(([id, style]) => [id, style.voice])) }),
    register(episode) {
      const token = randomUUID();
      episodes.set(token, { expires: now() + ttl, beats: episode.beats });
      for (const [id, entry] of episodes) if (entry.expires < now()) episodes.delete(id);
      while (episodes.size > 24) episodes.delete(episodes.keys().next().value);
      return { token };
    },
    async audio(token, beatId) {
      const entry = episodes.get(token);
      if (!entry || entry.expires < now()) throw new AIError("This show's audio session expired. Generate a new episode.", 410);
      const beat = entry.beats.find(beat => beat.id === beatId);
      const style = beat && CAST_VOICES[beat.speakerId];
      if (!style || !beat.text || beat.text.length > 4096) throw new AIError("Unknown or invalid speech line.", 400);
      const key = createHash("sha256").update(JSON.stringify([style, beat.text])).digest("hex");
      if (cache.has(key)) { const value = cache.get(key); cache.delete(key); cache.set(key, value); return value; }
      if (pending.has(key)) return pending.get(key);
      if (pending.size >= 3) throw new AIError("The voice studio is busy. Please try again.", 429);
      const job = client.speech({ text: beat.text, voice: style.voice, instructions: `${style.direction} Speak naturally, with restrained emotion. This is an AI dramatization using an original synthetic voice. Do not imitate the voice of any real person.` }).then(buffer => {
        cache.set(key, buffer); cacheBytes += buffer.length;
        while (cache.size > 128 || cacheBytes > 32 * 1024 * 1024) { const first = cache.keys().next().value; cacheBytes -= cache.get(first).length; cache.delete(first); }
        return buffer;
      }).finally(() => pending.delete(key));
      pending.set(key, job); return job;
    },
  };
}
