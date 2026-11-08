# Character neck and motion review — 2026-11-07

Changes:
- Procedural skulls pivot from the skull base, with a tapered neck seated into the shoulders and a slightly smaller head.
- Imported head-to-neck spacing is reduced by at most 18 mm at runtime, without scaling the face or altering the source GLBs.
- Gaze is shared between neck and head, measured relative to the current neck pose, with bounded rotation and smaller nods.
- Speech, thinking, walking and handshake transitions ease between states. Blinks, facial morphs and founder turning use elapsed time instead of a fixed per-frame blend.
- Arm swing opposes the same-side leg; knee flexion occurs during the swing phase. Walking cadence follows actual travel speed, with a steady middle pace and brief acceleration/deceleration.
- The procedural walking support ankle is corrected toward its floor target. This is a kinematic gait, not full-body motion capture or a terrain-aware IK solver.

Validation:
- 79 Node tests passed, including source GLB geometry, weights and rig tests.
- Three browser motion checks passed: bounded neck/pose transitions at multiple frame rates; four imported rigs across six poses with finite skinning and unchanged head scale; opposite arm/leg motion and support-ankle error below 5 mm after settling.
- Before/after closeups cover the founder and all five judges. Four additional frames sample walking alongside seated cast poses.
- `npm run check` and `git diff --check` passed.

The cast retains its existing assets: the founder and Max remain procedural and visibly stylized. These changes improve attachment, proportions and animation, not photographic facial realism. No external APIs or model-generation services were used.
