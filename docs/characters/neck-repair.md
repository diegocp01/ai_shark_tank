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
- Smooth the lower-neck contour on Lori and Barbara into their authored torso join, removing the abrupt shelf below the jaw. Preserve the anterior chin, all vertices above the repair band, original facial normals outside the band and expression deltas.
- Clone affected geometry per actor. The source GLBs, cached geometry, bone lengths, clothes, hair and facial features are preserved.

## Review

`review/neck-repair/inspect.mjs` captures a six-person close-up comparison plus seated/standing motion samples against a mock server on localhost:5059. It refuses a live server. `before-*.png` records the previous behavior; `after-*.png` records the repaired result.

The browser regression checks imported neck bind lengths, finite skinned vertices across poses, weight normalization, preservation of face/chin vertices, untouched cached models and paired neck-surface distances during seated and standing head turns with speech. These checks exercise the rendered skin rather than only the bone hierarchy. This remains stylized procedural animation, not a scan-based cast or motion capture replacement.
