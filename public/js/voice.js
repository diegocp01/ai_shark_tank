// Optional voices via the browser's built-in speech synthesis. No network calls:
// each character just gets a different system voice, pitch, and rate.

const SPEAKER_STYLE = {
  narrator: { pitch: 0.85, rate: 0.96 },
  founder: { pitch: 1.05, rate: 1.05 },
};

export function createVoice({ sharks = [] } = {}) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const supported = Boolean(synth && typeof window.SpeechSynthesisUtterance === "function");
  const styles = { ...SPEAKER_STYLE };
  let voices = [];

  for (const shark of sharks) {
    styles[shark.id] = shark.voice || { pitch: 1, rate: 1 };
  }

  function loadVoices() {
    if (!supported) {
      return;
    }

    const english = synth.getVoices().filter((voice) => /^en(-|_|$)/i.test(voice.lang));
    voices = english.length ? english : synth.getVoices();
  }

  if (supported) {
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
  }

  function voiceFor(speakerId) {
    if (!voices.length) {
      return null;
    }

    const order = ["narrator", "founder", ...sharks.map((shark) => shark.id)];
    const index = Math.max(0, order.indexOf(speakerId));
    return voices[index % voices.length];
  }

  return {
    supported,
    speak(speakerId, text, speed = 1) {
      if (!supported || !text) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const utterance = new window.SpeechSynthesisUtterance(text);
        const style = styles[speakerId] || { pitch: 1, rate: 1 };
        const voice = voiceFor(speakerId);

        if (voice) {
          utterance.voice = voice;
        }

        utterance.pitch = style.pitch;
        utterance.rate = Math.min(2, Math.max(0.6, style.rate * Math.min(speed, 2)));
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synth.speak(utterance);
      });
    },
    pause() {
      if (supported) {
        synth.pause();
      }
    },
    resume() {
      if (supported) {
        synth.resume();
      }
    },
    cancel() {
      if (supported) {
        synth.cancel();
      }
    },
  };
}
