# Image deck — no repeated images on screen

Replace the per-slot random image pools with a single global deck: every cell holds a distinct image, and cycling takes the next unused one so no two fragments ever show the same photo at the same time. Images load on demand instead of being preloaded, which is what makes a 300-image library viable.

## Specs

**S1 — No simultaneous duplicates.** While the library has at least as many files as cells, no two cells show the same image at any time. At startup the 30 cells receive 30 distinct images.

**S2 — Cycling returns the image to the deck.** When a cell cycles, it releases its image to the bottom of the deck and takes one that is not currently on screen. `cycle-prev` walks the same deck; the deck is unordered, so "prev" means "another unused image", not "the one I had before".

**S3 — Látigo swaps between cells.** The látigo gesture exchanges the images of two cells and never passes them through the deck, so both stay in use. No cell loses its image and no duplicate is created.

**S4 — The deck is the only authority for what a cell shows.** `images/layout.json` keeps deciding geometry only; its `imageFile` no longer decides what is rendered. After the initial deal the collage publishes the assignment to the bridge (one `image-update` per cell) so a phone connecting later receives the image its cell actually shows.

**S5 — Degrades instead of breaking.** With fewer images than cells, the deck empties; further claims reuse a file and log one console warning. With zero images the collage still runs: cells render empty, nothing throws.

**S6 — Bounded memory.** Images load on demand with an LRU cache. An image that is not decoded yet must never break the draw loop: the cell keeps its previous image (or stays empty) until the new one is ready, and the crossfade starts only when both are available. Images currently on screen are pinned and never evicted.

**S7 — Deterministic for tests.** The deck accepts an injected `rng` so ordering is reproducible; the loader accepts an injected image factory so tests need no network.

**S8 — Library target: 300 images** (~10 per cell for 30 cells). Manifest and layout formats do not change.

## Tasks

| ID | Spec | Route | Commit |
|----|------|-------|--------|
| T1 | S1, S2, S3, S5, S7 | writer: `p5-collage/image-deck.js` + `tests/image-deck.test.js` | deck module |
| T2 | S6, S7 | writer: `p5-collage/image-loader.js` + `tests/image-loader.test.js` | lazy loader |
| T3 | S4, S5, S8 | inline: `p5-collage/sketch.js`, `p5-collage/config.js`, retire `p5-collage/image-cycler.js` | wiring |
| T4 | S2, S3 | inline: `p5-collage/cell-actions.js` + `tests/renderer-handle-action.test.js` | actions |
| T5 | S1–S8 | inline: `AGENTS.md`, `README.md`, `openspec/specs/collage-image-deck/spec.md` | docs |
| T6 | all | verify: full suite + deck report on a 40-image fixture | verification |

## Log

**L1 —** "necesito que mejoremos la logica de las imagenes por que recuerdo que se repetian mucho las imagenes. la idea ahora es tener un pool grande de imagenes y que no se reptian. La idea aqui es que las imagenes sean variadas y no se repitan."

**L2 —** "que cada telefono tenga un array o algo asi de imagenes de las cuales se puede seleccionar."

**L3 —** "cuantas imagenes deberia tener en la libreria para algo asi?"

**L4 (decisiones) —** repetición: **mazo global** (ninguna imagen se repite en pantalla; la que sale vuelve al mazo y la puede tomar otro teléfono). Látigo: **intercambiar con otra celda**. Librería: **300 imágenes**.

**L5 (diagnóstico) —** la repetición venía de `ImageCycler.initPool` (`p5-collage/image-cycler.js:29-38`): cada celda muestreaba su propio pool de 10 sin coordinación. Y `loadAllImages` (`p5-collage/image-loader.js:41-52`) precarga todos los bitmaps decodificados, así que 300 imágenes ≈ 1,8 GB de RAM; por eso la carga bajo demanda es obligatoria, no opcional.
