# Anatomical mesh provenance

The connected head and hand topology derives from MakeHuman Community's anatomical base and morph-target data, not from its program code.

Source: https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482

- `makehuman/data/3dobjs/base.obj`
- `makehuman/data/targets/macrodetails/`, `head/`, `nose/`, `chin/`, `mouth/`, `cheek/`, `ears/`, `eyes/`

These individual assets explicitly declare a September 2020 release under CC0. The source headers name Data Collection AB, Joel Palmius and Jonas Hauquier; targets also acknowledge original work by Manuel Bastioni. See the included complete `LICENSE-MAKEHUMAN-CC0.md`, copied from the source repository's `LICENSE.ASSETS.md`.

`anatomical-head.npz` is the edited, coordinate-converted head/neck derivative, with quad topology, UVs and eye centers. It is an input to the offline Blender build, not a downloaded photograph or scan of Kevin O'Leary. The facial proportions and localized morphology were adjusted against the user's private reference. Clothing and strand details are separate procedural geometry.

The reference photograph is not redistributed. CC0 covers the anatomical source assets, not personality, endorsement, publicity, trademark or photograph rights. This is a likeness-development study, not an endorsement claim.

## Rigging expression derivatives

`scripts/kevin_face_morphs.py` embeds readable, sparse expression displacement data derived from the same CC0 source revision's `makehuman/data/targets/expression/units/caucasian/` assets. It transfers source-indexed expression displacements through the corresponding subdivision topology, with a verified bijective remap rather than guessing eyelid/lip regions. The source header in the helper identifies the exact origin and copyright credits. The bundled CC0 license also applies to these expression assets. No MakeHuman program installation or network download is required to rebuild the rig.
