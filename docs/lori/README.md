# Lori Greiner: isolated anatomical study

This change adds an editable, reference-guided female character asset without replacing or integrating any existing cast member. The source portrait is private and is not redistributed. Blonde side-parted waves, a tapered smiling face, and a black asymmetric one-shoulder top follow that portrait. Fitted trousers and pointed pumps are an authored interpretation of the unseen lower body.

## Deliverables

- `assets/lori/lori.blend`: editable meshes, facial keys, standing rest skeleton and studio.
- `assets/lori/lori-seated-validation.blend`: explicit 90-degree knee and horizontal forearm pose in an armchair.
- `public/models/lori/lori-rigged.glb`: self-contained runtime export, under 12 MB.
- `docs/lori/portrait.png`, `standing.png`, `seated.png`: Cycles review views.
- `assets/lori/anatomical-head.npz`: editable CC0 female head derivative with source-indexed expression deltas.

## Rebuild

With Blender 4.3+:

```sh
blender -b --python scripts/build_lori.py -- --render
npm run check
npm run test:node
```

The ordinary Blender build is offline and uses the bundled anatomy data. `scripts/build_lori_anatomy.py /path/to/makehuman/data` optionally regenerates the derivative from the pinned upstream CC0 assets. No MakeHuman application code is executed by the build.

## Runtime contract

Metres. Blender Z up / -Y forward; exported glTF Y up / +Z forward. Anatomical left is +X, matching Kevin. Exactly 18 deform bones with pelvis as the sole root:

- pelvis → spine → chest → neck → head → jaw
- chest → upperarm.L/R → forearm.L/R → hand.L/R
- pelvis → thigh.L/R → shin.L/R → foot.L/R

Facial morphs: `mouthOpen`, `blink`, `smile`, `frown`. Keep jaw bone neutral when using `mouthOpen` to avoid double motion. The GLB has a standing bind pose and no baked seated animation. The seated validation is a separate authored test scene, not a second runtime asset. Skin influences are normalized and limited to four. Crown and eyes track the head; chest-length hair tips blend toward the chest to avoid a rigid helmet. Garment skin weights are explicitly localized to avoid sleeve influences pulling the torso.

## Limits

This is a stylized likeness-development model, not photogrammetry or a final photoreal cinematic digital double. Hair is layered solid geometry rather than a groom; face controls are four basic shapes rather than a full FACS rig. Hands have anatomical geometry but no separate finger bones under the shared 18-bone contract. Cloth and hair use skin deformation, not physics. The unseen outfit, body proportions and hidden rear hairstyle are necessarily interpretations. Inspect extreme poses before production integration. No application integration, merge or deployment is included.

See `assets/lori/PROVENANCE.md` for source rights.

## Verification scope

`blender -b --python scripts/verify_lori.py -- --render` re-imports the shipped GLB, verifies its skeleton and facial-key names, exercises a 30-degree head turn and writes `runtime-portrait.png` using the imported runtime meshes. The runtime face is the lower-resolution editable cage, while the source portrait uses non-destructive facial subdivision. Both are retained for honest review.

Browser E2E could not run in the build sandbox: the pinned Playwright browser was unavailable, and the installed Chromium failed to create its required local socket. This is a verification blocker, not a passed browser test. The application is intentionally unchanged.

The Blender studio uses procedural skin/fabric micro-bump. Those procedural nodes are not baked into external textures; the GLB retains portable base colors, facial vertex pigment and PBR roughness. The re-imported runtime portrait is the appropriate check for the shipped appearance.
