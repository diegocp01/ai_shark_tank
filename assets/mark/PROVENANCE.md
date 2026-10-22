# Mark Cuban likeness study: provenance

The connected head and facial-expression data are a new edited derivative of MakeHuman Community's anatomical base and morph targets at revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`:

https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data

Inputs: `3dobjs/base.obj`, `targets/macrodetails`, `head`, `chin`, `nose`, `mouth`, `cheek`, `eyes`, `ears`, and `expression/units/caucasian`. Individual source assets declare their September 2020 CC0 release and acknowledge Data Collection AB, Joel Palmius, Jonas Hauquier, and Manuel Bastioni. See the full license in `../kevin/LICENSE-MAKEHUMAN-CC0.md`. This build does not redistribute MakeHuman application code.

`anatomical-head.npz` contains the edited male anatomical cage, UVs, eye centers, semantic lip weights, and four expression displacements. `scripts/build_mark_anatomy.py` rebuilds it from that external MakeHuman data checkout. Ordinary Blender builds require no network or MakeHuman installation.

The photograph below was visually inspected for facial proportions, hair direction, coloring, and wardrobe. It is not redistributed or embedded in any model:

- ABC / Christopher Willard via Good Morning America, November 28, 2023: https://www.goodmorningamerica.com/culture/story/mark-cuban-leaving-shark-tank-after-season-16-105205016
- Inspected image: https://s.abcnews.com/images/GMA/cuban-file-gty-ml-231128_1701182523972_hpMain_1x1_608.jpg

The sculpture emphasizes the reference's rectangular adult face, broad lower jaw, deep-set eyes, strong comparatively straight brows, substantial nose, thin lips, and short swept dark-brown hair with restrained silver at the temples. It is an interpretive likeness-development study, not a scan, photoreal replica, or endorsement. CC0 licensing of the anatomical inputs does not imply rights to publicity, personality, photographs, or trademarks.

Hair is newly authored geometry following the actual subdivided scalp. A continuous solidified scalp patch underlies directional short fibres, preventing visible holes between strands.

The tailored body is adapted from the repository's authored Kevin clothing source, with Mark-specific wardrobe changes. Hands reuse `assets/kevin/source/anatomical_hands_cc0.npz`, a CC0 MakeHuman anatomical derivative. A complete copy of the CC0 asset license is included in this directory too.

Second inspected primary reference: Mark Cuban Cost Plus Drug Company's portrait at https://www.markcubancostplusdrugcompany.com/ (image: https://cdn.prod.website-files.com/6230ef1068dd2ecbd9faea96/6230f2a90a43976432c50c53_6230ef3e1f6edcc65a54f43c_MarkCuban-1-e1589823008367.png). Used to compare full cheek contours, nasal shape, mature eyes and friendly expression. Not redistributed.
