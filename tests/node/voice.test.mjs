import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoice } from '../../public/js/voice.js';

function device(voices) {
  const spoken = [];
  let changed;
  globalThis.window = {
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: {
      getVoices: () => voices,
      addEventListener: (_name, fn) => { changed = fn; },
      speak: utterance => { spoken.push(utterance); utterance.onend(); },
      pause() {}, resume() {}, cancel() {},
    },
  };
  return { spoken, changed: () => changed() };
}

test('offline speech never falls back to a remote or unspecified voice', async () => {
  const mock = device([{ name: 'Cloud', lang: 'en-US', localService: false }, { name: 'Unknown', lang: 'en-US' }]);
  const voice = createVoice();
  assert.equal(voice.available, false);
  await voice.speak('founder', 'A local pitch.');
  assert.equal(mock.spoken.length, 0);
  delete globalThis.window;
});

test('offline speech explicitly selects a local voice from mixed services', async () => {
  const local = { name: 'Device', lang: 'en-US', localService: true };
  const mock = device([{ name: 'Remote', lang: 'en-US', localService: false }, local]);
  const voice = createVoice();
  await voice.speak('founder', 'A local pitch.');
  assert.equal(mock.spoken[0].voice, local);
  assert.equal(mock.spoken[0].text, 'A local pitch.');
  delete globalThis.window;
});

test('device voices arriving asynchronously become available without a remote fallback', async () => {
  const voices = []; const mock = device(voices); const voice = createVoice();
  await voice.speak('founder', 'Not yet.');
  assert.equal(mock.spoken.length, 0);
  voices.push({ name: 'Device', lang: 'en-US', localService: true }); mock.changed();
  assert.equal(voice.available, true);
  await voice.speak('founder', 'Ready.');
  assert.equal(mock.spoken.length, 1);
  delete globalThis.window;
});
