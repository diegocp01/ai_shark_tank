# Kevin likeness study, iteration 2

A reference-guided Blender likeness study of Kevin O’Leary, using a connected CC0 anatomical base with edited proportions, localized facial morphology, individual brow/temple fibers and a tailored black suit. This is not photogrammetry, an endorsement, or a finished photorealistic likeness. The user-provided photograph is not redistributed.

## Review

Run `npm install && npm start`, then open `/kevin.html`. The five existing fictional episode characters are unchanged. The isolated page permits review before deciding on cast mapping and animation integration.

- `kevin.blend`: editable, named anatomy/clothing objects, quad head with subdivision, studio lights and review camera.
- `anatomical-head.npz`: bundled anatomical mesh derivative, UVs and eye centers for reproducible offline builds.
- `../../public/models/kevin/kevin.glb`: web runtime asset, metres, Y-up, facing +Z.
- `../../scripts/build_kevin.py`: deterministic Blender 4.3+ entry point; anatomy/detail/body modules are alongside it.
- `../../docs/kevin/portrait.png` and `full-body.png`: actual Blender Cycles renders.
- `../../docs/kevin/iteration-1.png`: superseded first study for visual comparison, not the current asset.
- `PROVENANCE.md` and `LICENSE-MAKEHUMAN-CC0.md`: precise anatomical asset origin and redistribution license.

Rebuild from repository root:

`blender -b --python scripts/build_kevin.py -- --render`

The checked-in anatomical data makes the build independent of a MakeHuman installation or network access. Blender includes the required NumPy module.

## Changes from the rejected first study

The disconnected primitive face is replaced by connected anatomical quad topology: true eyelid openings, nostrils/alar wings, lips, ears, cheek/jowl contours and a continuous neck. The crown, nose, mouth and cheek proportions were revised against the newer reference; skin has localized pigment variation, subdued age creases and pore-scale shading. Brows and cropped gray temple hair are separate editable strands. The body is rebuilt with continuous sloped shoulders, more organic sleeves, anatomical hands and finer tailoring rather than stacked cylinders.

## Scope and remaining work

Likeness still needs artistic review and refinement. Hidden anatomy and the standing pose are approximations from a seated three-quarter reference. This draft is a materially revised study, not a claim that the close-to-real goal is complete.

The figure is **not rigged**. No facial blendshapes, lip-sync or animation clips are included. The existing procedural studio rig is not automatically compatible. Integration should follow likeness approval, an explicit cast mapping and a dedicated rigging step.

The GLB carries geometry, vertex complexion colors and standard PBR material channels. Blender’s procedural pore/fabric bump and subsurface appearance are not baked into the GLB, so web shading differs from Cycles. No production cast replacement, merge or deployment is included.

## Separate rigged variant

The original standing study above remains unchanged. `kevin-rigged.blend` and `../../public/models/kevin/kevin-rigged.glb` add the requested 18-bone skin and four facial morphs without replacing the original runtime asset. See [RIGGING.md](RIGGING.md) for bone hierarchy, coordinate/rest-axis notes, controls, reproducible build and seated validation.
