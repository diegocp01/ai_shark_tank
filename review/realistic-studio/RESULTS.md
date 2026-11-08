# TV-style studio review — November 7, 2026

The studio uses warm timber, burgundy leather chairs with walnut frames and brass trim, physical presentation props, patterned carpet, stone bays, glass pendants, softbox lighting and subtle floor reflections. Camera framing favors the seated panel and over-the-shoulder pitch views. Surface textures are generated locally.

Playback defaults to no visible HUD. Captions and offer graphics are opt-in; the transport fades after 2.6 seconds, including on mobile and while paused, and remains accessible through keyboard focus. No Live badge, timecode, deal stamp, confetti or automatic results popup is shown. The results and report remain available on demand. Voices use installed local speech voices only; when none are available, playback stays silent.

## Verification

- `npm run check`: passed. Syntax checks also covered changed studio modules and the capture script.
- `npm run test:node`: 74/74 passed, including remote-voice rejection, explicit local-voice selection and asynchronously installed device voices.
- All 16 browser cases passed across focused installed-Chrome GPU runs: 10 initial cases, 5 remaining interaction/mobile cases, and the final voice case. This is not a claim that one uninterrupted 16-case invocation completed.
- The original software-rendered run was slow and stopped. The pinned Playwright browser was not installed; Chrome was selected through `PLAYWRIGHT_CHANNEL`. An attempted test port was browser-blocked and another was already occupied, so final checks reused this task's working preview on port 5056, with stats stored in `/tmp/shark-studio-preview-stats.json`.
- The voice test was updated to activate hidden controls by keyboard; an earlier pointer-only version waited for the hidden transport. The final voice check passed in 13.1 seconds.
- `capture.mjs`: actual desktop high-quality and mobile low-quality renders, no page errors, zero external HTTP(S) requests, no idle HUD, and no horizontal mobile overflow. See `capture.json`.
- `git diff --check`: passed. Existing model binaries and the deterministic episode engine are unchanged.

## Preview

Run `npm start` and open the printed local address. The active review server is at `http://127.0.0.1:5056/`.

The saved captures are `lobby.png`, `pitch.png`, and `mobile.png`. Reproduce them while serving on port 5056 with:

```sh
node review/realistic-studio/capture.mjs
```

For installed Chrome with GPU rendering:

```sh
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_GPU=1 npm run test:e2e -- --workers=1
```

To reuse a development server, set `E2E_PORT` and `E2E_REUSE_SERVER=1`; point that server's stats at a disposable file before testing.

## Limits

The existing character models remain stylized anatomical studies, and the founder and Max retain procedural bodies. This is a more realistic set and cleaner TV presentation, not a photoreal scan of the cast or set. High quality uses an additional reflection render; low quality skips reflections, glass transmission and area-light highlights. No frame-rate benchmark is claimed. Local Express endpoints still provide scripts and reports; no external or model API is called.
