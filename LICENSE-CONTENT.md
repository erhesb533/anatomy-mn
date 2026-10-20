# Content license / Агуулгын лиценз

The content in `data/`, `media/`, `schema/` and `tools/sources/` is licensed under the
**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)**:
https://creativecommons.org/licenses/by-nc-sa/4.0/

`data/`, `media/`, `schema/`, `tools/sources/` доторх агуулга **CC BY-NC-SA 4.0** лицензтэй:
арилжааны бус зорилгоор, эх сурвалжийг дурдаж, ижил лицензээр түгээнэ.

## Attribution / Эх сурвалж

This work is derived from:

1. **OpenStax, *Anatomy and Physiology 2e*** — J. Gordon Betts et al., Rice University (2022).
   https://openstax.org/details/books/anatomy-and-physiology-2e — CC BY-NC-SA 4.0.
   Text translated and adapted into Mongolian; figures (`media/`) resized, otherwise unchanged.
2. **Terminologia Anatomica, 2nd edition (TA2)** — FIPAT, 2019; data file `TA2.csv` from
   Z-Anatomy (https://github.com/Z-Anatomy/The-blend) — CC BY-SA 4.0. Latin names and TA2 IDs.
3. **English Wikipedia** muscle article infoboxes (retrieved 2026-10-19) — CC BY-SA 4.0.
   Article title and URL are recorded per field in each record's `sources` list and in
   `tools/wikipedia_patches.json`. Values translated into Mongolian.

## 3D models (`models/`)

`models/*.glb` are derived from **Z-Anatomy** (https://www.z-anatomy.com/, CC BY-SA 4.0), itself derived from
**BodyParts3D © The Database Center for Life Science** (CC BY-SA 2.1 Japan). Converted to glTF, right side extracted,
simplified and compressed. These models are licensed **CC BY-SA 4.0** (not NC) — see `models/LICENSE-Z-Anatomy.txt`.

Changes: translated into Mongolian, restructured into JSON records, quiz questions written from the source text.
Not reviewed by an anatomy teacher yet (`verified: false`).
