# Mark asset validation

## Automated checks

- `npm run check`: passed.
- `npm run test:node`: all 71 tests passed (includes four Mark contract tests).
- `blender -b --python scripts/verify_mark.py`: reimports the exported GLB, verifies the exact skeleton, meaningful deltas for all four facial controls, neutral jaw, and 30-degree head rotation. See `runtime-validation.json` for measured counts and displacement magnitudes.
- `build_mark.py`: checks maximum four normalized influences, stable chest weights, under-12-MB GLB, and 90-degree knees in the seated validation pose.

## Visual review

Cycles portrait, standing, seated, and elevated crown views are generated from the editable source. The seated view deforms the actual skeleton; it is not a separately sculpted seated figure. The continuous scalp backing is inspected for crown coverage. The reference photograph is not distributed.

## Verification limit

The full browser suite could not launch in this execution environment. The expected Playwright browser binary was unavailable. A second attempt using installed Chromium was blocked before page execution by `socket() failed: Operation not permitted` (and crashpad-home errors). No browser tests are claimed as passed. No application integration was changed in this asset-only PR.
