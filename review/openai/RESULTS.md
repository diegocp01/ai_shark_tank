> Historical results from before the scripted-only testing policy. No live checks were rerun for the multi-provider cast change.

# OpenAI integration verification — 2026-11-07

- Secure setup saved `OPENAI_API_KEY` to ignored `.env.local` with owner-only permissions. No key values are included in source, fixtures, captures or reports. The selected key has a 30-day lifetime.
- Live idea generation succeeded with GPT-6.1 Sol, medium reasoning and confirmed `service_tier: ultrafast`.
- Live custom-business generation and four-slide HTML deck generation succeeded with those same settings. See `live-check.json` for returned model/tier metadata.
- Seven separate GPT-4o mini TTS voice requests succeeded: cedar, coral, onyx, marin, ash, sage, echo. Browser decoding verified all seven MP3s (4.4–5.4 seconds each).
- The actual generated deck was visually inspected in the studio. All four source layouts fit 1280×720 with no overflowing elements. See `studio.png`, `slide-*.png`, and `browser-check.json`.
- 87 Node tests passed, including exact model/effort/tier parameters, output validation, provider errors, audio session expiry, deduplication, cross-site request rejection, pause offsets, cancellation and stale-response handling.
- Two browser checks passed using local stubs and explicit mock mode: OpenAI idea/audio UI and HTML deck playback/replay/download. These tests incur no API usage.
- A real browser-to-live-server check also passed: fresh GPT-generated deck, two successful speech responses, decoded audio playback, pause and mute, with no browser errors. See `live-browser-check.json`.
- Syntax and whitespace checks passed.

`live-check.mjs` and `live-browser-check.mjs` are now disabled. `capture.mjs` uses the saved live result and clips without calling OpenAI again.

The live server on loopback port 5056 uses OpenAI for ideas, custom business details, HTML decks and TTS. Investor questioning, offers, negotiation and feasibility scoring remain simulated. Speech is generated on demand and cached in memory; restarting the server or a two-hour session expiry requires generating a new episode. Character animation follows speech activity but does not provide phoneme-level lip synchronization.
