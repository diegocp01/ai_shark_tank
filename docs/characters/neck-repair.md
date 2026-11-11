# Neck continuity repair

The judges retain their existing likenesses, clothing and facial morphs. This is a targeted repair to the existing character system, not a replacement with scanned stock faces.

## Reference inspection

The user supplied `renderpeople_free_animated_people_FBX.zip`. Its nested FBXs were inspected in a separate background Blender process:

| Model | Clip | Skeleton | Facial morphs |
| --- | --- | --- | --- |
| Sophia | Idle, frames 1–613 | 88 bones | None |
| Nathan | Walk, frames 1–69 | 88 bones | None |
| Manuel | Dance, frames 1–1342 | 88 bones | None |

Each model includes diffuse, normal, gloss and mask textures. Their body proportions and skeletal structure were examined as references. These rigs are not a direct replacement for our 18-bone procedural animation contract, and they do not supply the judges’ faces or talking morphs.

No Renderpeople mesh, texture, animation or derived stock asset is included in the application or repository. The original download is retained locally. Renderpeople’s [terms](https://renderpeople.com/general-terms-and-conditions/) apply to free models too and restrict redistribution of downloadable asset files (§§2.5, 4.2–4.3); local reference inspection does not require publishing those files.

## Changes

- Preserve the original imported neck/head bind translations. The previous runtime shortening shifted the skull without updating its bind geometry.
- Assign one continuous chest → neck → head skin-weight blend across the overlapping skin surfaces. Previously, torso and facial neck sections used different blends at the same height, allowing their surfaces to separate during head turns.
- Taper Kevin and Mark’s lower necks into their collars and smooth Lori and Barbara’s neck joins. Match shading across overlapping neck surfaces and tuck the hidden torso tip inside the face surface to remove the bright seam. Preserve the anterior chin and vertices above the repair band.
- Keep fallback procedural mouth meshes hidden once a rigged skin is attached, including during speech. Previously the animation loop re-enabled a second mouth at the procedural chin height, visibly floating across Mark’s neck.
- Bake the authored facial subdivision into every expression for Mark and Lori before GLB export. Their updated exports retain the 18-bone rig and all four expression controls. Lori’s asset budget increases from 12 MB to 13 MB for the added surface detail.
- Clone affected geometry per actor. Runtime neck repair leaves cached geometry, normals, colors, bone lengths, clothes and hair untouched. The exported GLBs change only to retain authored surface subdivision.

## Review

`review/neck-repair/inspect.mjs` captures a six-person close-up comparison plus seated/standing motion samples against a mock server on localhost:5059. It refuses a live server. `before-*.png` records the previous behavior; `after-*.png` records the current repair. The `after` run also captures front, quarter and profile views of every imported character under `closeups/`.

The browser regression checks imported neck bind lengths, finite skinned vertices across poses, weight normalization, preservation of face/chin vertices, untouched cached models and paired neck-surface distances during seated and standing head turns with speech. These checks exercise the rendered skin rather than only the bone hierarchy. This remains stylized procedural animation, not a scan-based cast or motion capture replacement.

## Visual limits

These repairs do not make the cast photorealistic. The founder and Daymond still use procedural placeholder characters; the other four retain stylized likeness studies, with simplified hair, materials and tailoring. Passing rig tests is not visual acceptance of those assets.

## Speech

API mode exclusively uses OpenAI TTS with distinct cast voices. Test mode is silent; it never uses browser speech or a TTS API. Failed live speech is reported and muted without falling back to device voices. Audio tests use locally mocked responses.
