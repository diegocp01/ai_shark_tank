# Lori body and wardrobe sources

The body and wardrobe are original procedural meshes authored in `scripts/lori_body.py`. The visible black asymmetric top follows the supplied portrait reference. The black tapered trousers and pointed pumps are inferred styling because the portrait does not show the lower body. The reference photograph is not included in this asset.

`anatomical_hands_cc0.npz` contains left and right anatomical hand topology extracted from the official MakeHuman hm08 base mesh (`makehuman/data/3dobjs/base.obj`). The upstream mesh header explicitly releases it under CC0 in September 2020, crediting Data Collection AB, Joel Palmius and Jonas Hauquier. These subset meshes are transformed into the figure's coordinate system and gently posed at build time. No photograph, texture or proprietary scan is embedded.

Upstream project: https://github.com/makehumancommunity/makehuman
CC0: https://creativecommons.org/publicdomain/zero/1.0/

The script preserves separately editable wardrobe, skin, hands and shoe components. It does not create a rig. Coordinates are metres, +Z up, -Y forward and +X character-left. The source builder returns all created objects for rigging by the enclosing asset pipeline.
