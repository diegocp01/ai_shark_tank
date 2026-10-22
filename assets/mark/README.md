# Mark Cuban character study

Asset-only reference-guided likeness for the Wildcard chair. No application, cast, viewer, routing, or deployment changes.

- Runtime: `public/models/mark/mark-rigged.glb`.
- Editable standing source: `assets/mark/mark.blend`.
- Actual skeleton seated validation: `assets/mark/mark-seated-validation.blend`.
- Review renders: `docs/mark/portrait.png`, `standing.png`, `seated.png`, and `crown.png`.
- Wardrobe: navy blazer, light blue open-collar shirt (no tie), dark indigo jeans, dark loafers.

## Rebuild

Blender 4.3.2, bundled NumPy and local source assets. No downloads required for the normal build:

```sh
blender -b -t 8 --python scripts/build_mark.py -- --render
blender -b -t 8 --python scripts/verify_mark.py
npm ci
node --test tests/node/mark-asset.test.mjs
```

The source is a reference-guided anatomical study, not photogrammetry, a scan, or an endorsement. Geometry, clothing, fibres and expressions remain editable. The look is evaluated against a publicly available ABC reference, not an incorporated photograph or face texture.

## Runtime contract

Metres, glTF Y up, faces +Z, anatomical left +X. A standing relaxed bind pose is exported without the validation chair, lights, cameras or QA animations. Exactly 18 deform bones:

- pelvis → spine → chest → neck → head → jaw
- chest → upperarm.L → forearm.L → hand.L (and .R)
- pelvis → thigh.L → shin.L → foot.L (and .R)

Facial keys: `mouthOpen`, `blink`, `smile`, `frown`; defaults zero. Apply matching keys to every mesh carrying the named key. Keep the jaw neutral when using mouthOpen to avoid double deformation. Four or fewer normalized skin influences. Runtime GLB budget below 12 MB.

Procedural material microdetail is visible in Cycles but not baked into runtime textures. Runtime keeps material colors, roughness and facial vertex pigment. The dedicated continuous scalp backing avoids exposed crown gaps between short hair fibres.

## Authorship and source layout

`build_mark.py` creates the studio, skeleton, normalized skin, GLB and validation scene. `mark_body.py` adapts the project's Kevin tailored-body topology and CC0 anatomical hands for Mark's wardrobe. `mark_face.py`, `mark_hair.py` and `build_mark_anatomy.py` provide a distinct male face, expressions and short hair. See PROVENANCE.md and the included CC0 license.
