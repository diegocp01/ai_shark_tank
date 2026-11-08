# API / Test start screen

- The only start controls are API and Test. There are no idea, preset or seed inputs. A read-only roster shows all five judges and the founder, with their API provider/model.
- API sends only `{ "mode": "api" }`; the server checks configuration, invents an idea and then produces the show. Test explicitly selects scripted episodes, mock HTML decks and device voices regardless of configured live services.
- 102 Node tests passed, including a live-configured server whose paid services throw if touched by Test, server-side automatic idea generation, and unavailable API behavior.
- 24 distinct browser tests passed across the full run and the focused lobby-return rerun. One assertion still expected the removed preset selector during the first run; it was updated to check the two buttons and passed on rerun. Coverage includes desktop/mobile layout, model roster, automatic API payload, device-only Test audio, playback, decks, rigs and no paid autoplay from URL parameters.
- No inference or TTS API calls were made. Browser/API contract tests use scripted fixtures; external requests are blocked. `capture.mjs` only reads the configured preview UI and blocks every POST and non-local request. It captured desktop/mobile layouts with both start buttons enabled.
- The running preview was restarted and its existing in-app browser tab refreshed. Live API generation remains untested, as requested.
