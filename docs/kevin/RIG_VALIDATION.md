# Kevin rig validation

- Original GLB is byte-identical: SHA-256 `dbea5f16f48a24347ac5a8f120a1ed15a950dbdffdd6ac899f47d756139f5638`.
- Rigged GLB is 10,689,536 bytes, below the requested 12,000,000-byte limit.
- Exactly 18 deform joints, required names/hierarchy, standing rest pose, metre scale, exported Y-up/+Z-front and .L on +X.
- Four zero-default morph targets: mouthOpen, blink, smile, frown. Basis is not exported.
- Anatomical morph transfer matches direct Blender target evaluation within 0.000000477 m; 18,049-vertex head. Numerical details in `morph-transfer-validation.json`.
- 49,484 eye/iris/pupil/brow/hair/crease vertices are rigid to head. Local weight checks verify 4,759 sleeve vertices, 4,093 stable central-chest vertices and 1,127 thigh-following front-hem vertices. At most four normalized influences.
- Actual Cycles seated armchair render inspected. Both knees measure 90.00005°, thighs and forearms are horizontal, head yaw is numerically checked at 30°. Rest transforms and pose measurements are included as JSON.
- `npm run check`: pass.
- `npm run test:node`: all 60 tests pass, including nine rig-specific contracts. Tests inspect raw glTF weights before loader normalization and load the real file with THREE GLTFLoader.
- Dynamic runtime regression rotates forearm.L by 45°: fully weighted sleeve vertices follow the exact joint transform; torso vertices with zero arm influence remain fixed. Rigid facial-feature meshes follow a 30° head rotation exactly. Tests restore neutral pose.

The original five cast members, default viewer and original assets are unchanged. No production mapping, animation playback integration, merge or deployment is included. This is a deformable stylized study, not a photorealistic-likeness claim. Finger articulation, IK, cloth simulation and extreme-pose corrective morphs are outside this rig's scope.

Browser e2e was attempted: all 12 cases stopped before launch because the expected Playwright Chromium headless executable is absent. No browser interaction pass is claimed. This PR changes the separate rig asset/build/tests, not the existing viewer or episode UI. Runtime skin/morph validation above uses the actual Three.js loader and CPU skin deformation, plus Blender/Cycles visual QA.
