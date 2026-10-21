# Kevin rigging contract

The separate `kevin-rigged.blend` and `../../public/models/kevin/kevin-rigged.glb` contain the standing Kevin mesh, 18-bone armature, normalized skin weights and four facial morphs. The original `kevin.blend` and `kevin.glb` are not replaced. Existing characters and the default review page are unchanged.

## Build

`blender -b --python scripts/build_kevin.py -- --rig --render`

Equivalent: `blender -b --python scripts/rig_kevin.py -- --render`.

The rig-only route opens the checked-in standing Blender source, uses bundled anatomical/morph data, writes only the new rigged assets and QA outputs, and asserts the original GLB hash is unchanged. No external software/data download is required. Generated `kevin-seated-validation.blend` is a local QA scene; the checked-in rigged Blender source opens in standing rest pose.

## Exact hierarchy

- pelvis
  - spine → chest → neck → head → jaw
  - thigh.L → shin.L → foot.L
  - thigh.R → shin.R → foot.R
- chest additionally parents upperarm.L → forearm.L → hand.L and upperarm.R → forearm.R → hand.R.

There are no extra control, IK or helper bones. The armature object itself is not an additional joint.

## Coordinates and rest orientation

Metres. Blender source uses Z up and −Y forward. Exported glTF uses Y up and +Z forward. Kevin's left is +X, so `.L` bones are on +X and `.R` bones are on −X.

Every bone's **local +Y points from its head to its tail**. Roll is aligned toward Blender world −Y. This means local +Y is roughly world +Z for the spine/head, roughly world −Z for the hanging arms/legs, and forward/down for jaw/feet. Do not assume that a single Euler axis is the same world rotation for all bones.

`../../docs/kevin/rig-rest-orientations.json` records every parent, rest head/tail and full armature-space `matrix_local` in Blender coordinates. Matrix columns 0, 1 and 2 are the bone's local X, Y and Z axes. Use this matrix or the exported inverse bind transforms for retargeting. The validation pose computes desired directions in armature space and compensates for the rest basis, rather than guessing Euler signs.

## Controls

Morph values are 0–1 and start at zero:

- `mouthOpen`: lower-jaw/chin drop and a real lip/oral opening.
- `blink`: both upper/lower eyelids close around unchanged eyeballs.
- `smile`: lip corners and associated cheek motion.
- `frown`: downward lip-corner motion.

The `jaw` bone supports independent jaw articulation. Keep it neutral when using `mouthOpen` alone; rotating it and applying `mouthOpen` combines two deformations intentionally. Eyes, irises, pupils, brows and temple hair have exactly 100% head-bone attachment.

## Skinning and seated QA

Weights are normalized with at most four influences. Sleeves use spatially bounded arm masks so forearm motion cannot pull central jacket/chest vertices. The front lower jacket hem follows thighs while the back remains with the pelvis. Trousers blend through hips and knees; shoes are rigid to feet and hands rigid to hand bones. Source detail is reduced only for the new runtime rig mesh.

`../../docs/kevin/seated-rig.png` is an actual Cycles render of the rig in an armchair. Both thighs and forearms are horizontal, knees are numerically verified at 90°, and the head is turned 30°. Pose landmarks and localized weight checks are recorded in `rig-seated-validation.json` and `rig-weight-validation.json`. Morph render proofs and numerical transfer validation accompany the render.

## Verification and limitations

The Node rig tests load the actual GLB, validate hierarchy/orientation, raw and runtime weights, inverse binds, morph deltas, bounds, size and the original file hash. The asset remains a stylized likeness study. There are no finger bones, IK controls, animation clips, cloth simulation or corrective pose morphs; extreme poses beyond the checked seated configuration may need additional weight/corrective work. The GLB contains standard PBR/vertex-color appearance, not Blender-only procedural pore/fabric shading.

Original GLB SHA-256: `dbea5f16f48a24347ac5a8f120a1ed15a950dbdffdd6ac899f47d756139f5638`.
