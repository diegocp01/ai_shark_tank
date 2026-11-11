# Neck repair validation

Validated on 2026-11-11 using scripted responses only. No model or TTS API calls were made.

- `npm run test:node`: passed with the offline network guard.
- `E2E_PORT=5058 PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_GPU=1 npm run test:e2e -- --workers=1 --trace=off`: all 25 tests passed.
- Reviewed neutral, speaking/head-turn and four walking/seated frame captures for all six characters.

The seam regression samples overlapping neck surfaces while standing, sitting and leaning, looking left and right with speech enabled:

| Character | Paired samples | Maximum separation | Maximum drift from rest | Face/chin position changes | Cached source changes |
| --- | ---: | ---: | ---: | ---: | --- |
| Lori | 14 | 2.09 mm | 0.15 mm | 0 | None |
| Barbara | 180 | 2.57 mm | 0.26 mm | 0 | None |

All sampled weights were finite, nonnegative and normalized. These are sampled geometric checks, not a guarantee for every possible pose. The existing cast remains stylized; the stock scan pack was used only for reference inspection.

## Visual comparison

Before: ![Before head turn](before-turn.png)

After: ![After head turn](after-turn.png)

For recapture instructions and reference provenance, see [the repair notes](../../docs/characters/neck-repair.md).
