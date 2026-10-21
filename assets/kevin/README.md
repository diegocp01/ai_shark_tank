# Kevin likeness study, iteration 1

Handcrafted Blender geometry inspired by the user-provided Kevin O’Leary TV reference. This is an independent stylized likeness study, not a photogrammetry scan or a claim of endorsement. The source photograph is not redistributed.

## Review

Run `npm install && npm start`, then open `/kevin.html`. The existing five fictional episode characters are unchanged. The isolated review page allows likeness approval before deciding which character/slot to replace.

- `kevin.blend`: editable source, named facial/clothing components, studio lighting and review camera.
- `../../public/models/kevin/kevin.glb`: web runtime asset, metres, Y-up, facing +Z.
- `../../scripts/build_kevin.py`: deterministic Blender 4.3+ build script.
- `../../docs/kevin/portrait.png` and `full-body.png`: actual Blender renders, not generated concept images.

Rebuild from repository root: `blender -b --python scripts/build_kevin.py -- --render`.

## Scope and limitations

The asset targets a broad bald cranium, gray temple hair, mature eye folds, fuller cheeks, a charcoal notched-lapel suit, white shirt, black tie and red pocket square. Geometry, materials and clothing are authored from scratch. It remains stylized and is intended for further likeness iteration, not marketed as photorealistic.

The neutral standing figure is **not rigged**. There are no facial blendshapes, lip-sync or animation clips. The existing procedural studio rig is not compatible automatically. Integration should follow likeness approval, with a deliberate cast mapping and rigging step, not a silent replacement of Rex or another shark.

Blender’s micro-bump/subsurface skin appearance is not fully portable to the standard GLB material. The GLB carries the authored PBR base colors/roughness/metalness, not a baked pore texture. Viewer lighting will differ from Cycles renders.

The referenced television image provides a seated three-quarter face view; hidden anatomy and the standing pose are artistic approximations.
