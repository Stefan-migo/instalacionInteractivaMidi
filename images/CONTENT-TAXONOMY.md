# Content taxonomy

How the image library is organized for an interactive collage whose theme is
Borges' *coincidencia de los opuestos*.

`images/manifest.json` is the source of truth for per-image metadata. This
document holds the rules and the audit; it does not repeat the 130 rows.

The metadata is still data-only: the deck deals every file in the manifest at
random, and `images/layout.json` carries geometry only. Nothing reads `role`,
`axis` or `pole` yet, so the balance below describes the pool, not the screen.

## The one invariant

A participant composes freely: they own position, scale, rotation, opacity,
filter and which cell advances. So **every image must combine with every other
image**. Nothing may depend on its thematic partner being on screen at the same
time, or the participant can break the composition.

That is why this structure constrains **palette and role**, not meaning. The
opposition lives in the metadata and, later, in a mechanic — never in a
requirement that two specific images appear together.

The palette is fixed by the material and by the visual reference:

- one hue: burnt orange (torn paper)
- one texture: hand-torn paper
- figures: black-and-white halftone cutouts
- one accent: high-contrast small details

Any new asset that leaves this palette damages the collage regardless of how
good it looks on its own.

## Axis A — role

What the image does in the composition.

| `role` | What it is | Placement |
| --- | --- | --- |
| `papel` | torn orange shapes, washes, patterns, textures | large, low z, background |
| `figura` | halftone cutouts with a readable silhouette | medium, protagonist |
| `acento` | small fragments and details | small, high z, reads at distance |
| `texto` | typographic fragments and quotes | medium, reads as a caption |

## Axis B — pole

Which side of an opposition the image carries. The four axes come from
`Borges_y_los_opuestos.md`; `neutro` is generic collage material with no pole.

| `axis` | `pole` values |
| --- | --- |
| `fe_herejia` | `fe`, `herejia` |
| `civilizacion_barbarie` | `civilizacion`, `barbarie` |
| `original_copia` | `original`, `copia` |
| `infinito_limite` | `infinito`, `limite` |
| `neutro` | `neutro` |

`axis` names the pair so a future rule can require **both poles of the same axis**
to be present on screen. `pole` names the side.

## Normalization contract

Every file in `images/content/` obeys one rule, applied once and documented in
`curation/normalize-once.js`:

- longest edge capped at **1600 px**, never upscaled
- **WebP**, quality 90, compression level 6, alpha preserved
- flat sequential names `001.webp` … `130.webp`, no subdirectories
- byte-identical duplicates dropped (one was: two copies of the same eye)
- originals preserved in `images/raw/<pool>/`; provenance in
  `curation/rename-map.json`

The library went from 131 files / 99.7 MB to 130 files / 17.1 MB (5.8× smaller).
Cells render at most ~400×650 px, so 1600 px is generous headroom.

`.webp` is served as `image/webp` by the bridge; the MIME table is pinned by a
test in `tests/bridge-http.test.js`.

## Manifest contract

```json
"048": {
  "file": "048.webp",
  "w": 1312,
  "h": 1199,
  "role": "figura",
  "axis": "infinito_limite",
  "pole": "infinito"
}
```

`file`, `w` and `h` are required. `role`, `axis` and `pole` are additive and
optional: `ImageLoader.filesFrom()` reads only `entry.file`, so older consumers
keep working unchanged.

## Balance audit

One screenful is 30 cells, each holding a distinct image, dealt uniformly at
random from the library. Target quota per screenful: **8 `papel` / 14 `figura` /
5 `acento` / 3 `texto`**.

| role | current | share | expected per 30 | target | delta |
| --- | --- | --- | --- | --- | --- |
| papel | 12 | 9% | ~3 | 8 | **−5** |
| figura | 67 | 52% | ~16 | 14 | +2 |
| acento | 25 | 19% | ~6 | 5 | +1 |
| texto | 26 | 20% | ~6 | 3 | **+3** |

| pole | current | | pole | current |
| --- | --- | --- | --- | --- |
| neutro | 59 | | copia | 15 |
| barbarie | 15 | | infinito | 8 |
| herejia | 13 | | limite | 7 |
| civilizacion | 9 | | fe | 4 |
| | | | **original** | **0** |

Three findings:

1. **`original` is empty — 0 of 130.** The `original_copia` axis now has fifteen
   images arguing the copy and none arguing the original. A one-sided opposition
   reads as a single theme, not as a tension. Either produce that pole or drop
   the axis.
2. **`papel` is badly short.** At 9% of the library a random screenful gets ~3
   papers instead of 8, so figures pile on top of figures with nothing to sit
   on. This is the largest single defect in the pool and the cheapest to fix:
   torn orange shapes are quick to produce and the six originals prove the
   treatment works.
3. **`texto` is too dense.** At 20% a random screenful carries ~6 full quote
   fragments. A quote-heavy screen stops reading as collage and starts reading
   as a poster. Keep the text pieces, but grow `papel` before anything else.

## Known exceptions

Four images have no alpha channel, so they render as solid rectangles that cover
their neighbours instead of compositing:

| id | source | note |
| --- | --- | --- |
| 105 | `New Project122.png` | opaque PNG |
| 107 | `download (10).jpg` | JPEG, typographic poster |
| 108 | `download (12).jpg` | JPEG, typographic poster |
| 109 | `download (16).jpg` | JPEG, typographic poster |

Either cut them out or accept them as `texto` — a poster covering a cell is a
legitimate collage move, a halftone figure doing it is not.

## Rules for adding content

1. Stay inside the palette: burnt orange, torn paper, B&W halftone, one accent.
2. One image per cell, readable silhouette, transparent WebP. `object-fit`
   contains it, so nothing gets cropped.
3. No image may need a partner to make sense. If it does, it is an illustration,
   not collage material.
4. Normalize to ≤1600 px longest edge and WebP q90 before adding.
5. Add the entry to `images/manifest.json` with `file`, `w`, `h`, `role`,
   `axis`, `pole`, and record the original filename in `curation/rename-map.json`.
6. Re-run the balance audit before assuming the library grew in a useful way.
   Adding a 68th `figura` does not improve the collage.
