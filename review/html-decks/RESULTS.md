# HTML deck validation — 2026-11-07

- `npm run test:node`: 79 passed, including deterministic mock decks, preset/custom data, injected model adapter, unsafe markup removal, invalid output rejection, cue timing, server integration and existing episode golden tests.
- `npm run check` and `git diff --check`: passed.
- `tests/e2e/pitch-deck.spec.mjs` in local Chrome: passed. Exercises generated slides, distinct rendered HTML pixels, beat changes, skip, replay, download contents, new pitch cleanup, hidden HUD, no page errors and no external requests.
- Three focused browser regressions passed: complete Barklight episode, custom idea episode, and minimal TV mode with no external requests.
- `node review/html-decks/capture.mjs`: passed. Captured high-quality desktop (1440×900) and portrait (390×844) views. All 28 slide layouts (six presets plus one custom idea) stay inside the 1280×720 source frame. See `validation.json`.
- Screenshots: `studio.png` and `mobile.png`. Mobile pitch shots widen to include the physical display.

Generation is mocked; no LLM/API is configured or called. The server-side adapter accepts an injected model callback and sanitizes its returned HTML. Founder and shark dialogue still uses the deterministic episode engine. HTML-to-texture rendering has been verified in installed Chrome, not Safari/Firefox. The pre-existing stylized character assets remain in use.
