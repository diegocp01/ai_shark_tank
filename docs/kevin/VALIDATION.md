# Kevin iteration-2 validation

- Blender 4.3.2 produces editable source and glTF 2.0 runtime asset from bundled, offline anatomical inputs.
- Cycles portrait and full-body previews are actual renders, not generated concept images. The rejected first render is preserved separately as `iteration-1.png` for comparison.
- Runtime asset: 418,784 triangles, 25 mesh/material groups, 10,828,840 bytes. Facial/hand subdivision and jacket decimation are applied only to export copies; editable source retains higher-resolution modifiers and named parts.
- `npm run check`: passed.
- `node --check public/js/kevin-viewer.js`: passed.
- `npm run test:node`: 51 tests passed, including GLTFLoader parsing, finite geometry and complexion colors, human-scale bounds, the <500,000-triangle budget, HTTP delivery and unchanged original cast.
- Initial iteration-2 export exceeded the geometry budget. Reduced runtime-only subdivision and jacket geometry; reran the suite successfully. Source mesh detail is preserved.
- Browser e2e remains unverified: the expected Playwright Chromium package is absent. The installed-Chromium attempt failed creating a sandbox socket; its approved escalation then failed during environment setup with a read-only mount error. Interaction tests are included, but no browser visual/interaction pass is claimed.
- Blender has no OpenImageDenoise support. Previews use 96 samples without denoising.
- Anatomical source mesh and morph assets have explicit CC0 headers; full asset license and provenance are included. The private reference photograph is not redistributed.

The likeness is a revised work in progress, not certified photorealism. No rigging, facial animation, production cast replacement, merge or deployment is included.
