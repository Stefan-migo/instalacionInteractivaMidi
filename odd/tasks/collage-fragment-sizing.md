# Fragment sizing — aspect-aware dealing plus an ink-based coverage floor

Feature: `collage-fragment-sizing`. Branch: `feat/collage-fragment-sizing`. **Scope: slice 1 only** (how big a fragment is drawn). Slice 2 (alpha-contour hit-testing / selection) is explicitly out of scope and stays queued.

## Specs

S1 (verbatim, user): "lo que necesito ver es una vez mas las imagenes. con el ultimo procesamiento de las imagenes se hizo todo un bardo. por que hay algunas imagenes muy pequea;s otras muy grandes. entonces no tiene sentido la union de unas imanges con otras. como podriamos hacerlo para mejorar la logica de los tama;os de las imagenes dentro del collage.?"

S2 (verbatim, user): "ok B+A que hay de la posibilidad de que se seleccione el contorno de la imagen (de la imagen png como objet selected) no el cuadro completo de la imagen?"

S3 (verbatim, user): "si arranca con slice 1"

S4 (verbatim, decision accepted): "B = el mazo reparte por aspecto compatible, A = piso de cobertura medido en tinta. Nada se recorta, la estetica queda intacta." B kills the contain mismatch at its origin; A covers the cells for which no compatible candidate exists.

S5 (evidence, measured by the parent before writing the task): the incoherence has **three multiplicative sources**. Base cell geometry from `images/layout.json` spans aspect 0.40-2.50 and area 18,490-233,016 px2 (**12.6x**). The per-preset random `scale` in `layout-preset-engine.js` spans 0.5-1.4, i.e. up to **7.8x** in area. `contain` in `cell-renderer.js` (`fitScale = Math.min(w/iw, h/ih)`) leaves coverage median 61%, min 13%, with **29% of the 3,900 cell/image combinations covering under half the cell**. Worst case a fragment carries ~757x the drawn ink of another. `contain` never crops, so the mismatch is paid as empty space: the fragment shrinks, it does not grow.

S6 (evidence, measured by the parent): the alpha contour exists — **126 of 130** files carry an alpha channel; the four without it are `105`, `107`, `108`, `109`. But the silhouette already fills its own frame (`inkBox` is 80-100% of the frame), so trimming to the contour buys almost nothing. What does vary, and varies **2x**, is the painted mass: 30-60% of the frame is ink (001: 44%, 038: 60%, 075: 59%, 112: 30%). The floor must therefore be measured on ink, not on the bounding rectangle.

S7 (verbatim, decision accepted): silhouette metrics are computed **once, offline**, and stored in the manifest. Runtime only reads numbers: no per-frame cost, deterministic, and testable in Node like the rest of the repo. No `getImageData` in the browser path.

S8 (verbatim, decision accepted): "Las 4 sin alpha se marcan `inkRatio: 1` explícito, para no fingir un contorno que no existe."

S9 (out of scope, stated): no cropping (`cover`) is introduced, and `images/raw/` is not re-processed. The dataset is not touched; the logic is fixed.

S10 (out of scope, stated): rotating around `inkCenter` instead of the frame centre was noted as a near-free improvement during design; it is **not** part of this slice and must not be slipped in.

## Tasks

| ID | Specs | Route | Task | Commit |
|----|-------|-------|------|--------|
| T1 | S6, S7, S8 | worker | Tracked script `scripts/build-ink-metadata.js` that measures `inkBox`, `inkRatio`, `inkCenter` per image via ffmpeg and writes them into `images/manifest.json`, preserving every existing field. Idempotent: a second run adds nothing and changes no number. The four alpha-less images get `inkRatio: 1`. Tested in Node with the reader injected (no ffmpeg needed by the suite). | 0912fad |
| T2 | S1, S4 | worker | Aspect-aware dealing in `p5-collage/image-deck.js`: prefer an image whose `inkBox` aspect is within tolerance of the target cell's aspect. Must preserve the existing guarantees (one distinct image per visible cell, cycling returns the released file to the bottom, no repeat while alternatives exist). Tolerance is a named constant, not a literal. | 7301e0b |
| T3 | S1, S4, S6 | worker | Ink coverage floor in `p5-collage/cell-renderer.js`: after the contain fit, if `inkRatio * drawnArea < CONFIG.minInkCoverage * cellArea`, scale up (allowing bounded overflow of the cell) until the floor is met. Named constants in `p5-collage/config.js`. No cropping. | 7301e0b |
| T4 | S1 | inline | Docs: `AGENTS.md` module table and Content section describe the ink metadata and the two sizing rules. Suite green. | 218d5f1 |

## Log

L1 (verbatim, user): "lo que necesito ver es una vez mas las imagenes. con el ultimo procesamiento de las imagenes se hizo todo un bardo. por que hay algunas imagenes muy pequea;s otras muy grandes. entonces no tiene sentido la union de unas imanges con otras. como podriamos hacerlo para mejorar la logica de los tama;os de las imagenes dentro del collage.?"

L2 (verbatim, user): "ok B+A que hay de la posibilidad de que se seleccione el contorno de la imagen (de la imagen png como objet selected) no el cuadro completo de la imagen?"

L3 (verbatim, user): "si arranca con slice 1"

L4 (parent, evidence): the diagnosis behind S5/S6 was measured in this session, not assumed. Coverage was computed over all 3,900 cell/image pairs; ink was sampled across the library with ffmpeg `alphaextract` at 160px width. The parent's first read of the problem (blaming the last normalization pass) was wrong: the dataset's aspect spread (0.40-3.00) is real but the geometry and the preset scale are equally responsible, and neither was touched by that pass.

L5 (parent, decision): slice 2 (alpha-contour hit-testing in `drag-manager.js`) is deferred. The human asked about it in the same breath as B+A; the answer was that the contour is the right *metric* for the floor but not a fix for sizing, and that hit-testing is a separate cause that must be validated on its own.

L6 (parent, close-out evidence): suite 53 suites / 561 tests green (baseline 52 / 557). The worker stopped once to ask for `p5-collage/sketch.js` and `p5-collage/image-loader.js`, because the manifest metadata and the cell geometry had no path into the deck and the renderer; the parent approved exactly those two paths and nothing more. Independent end-to-end measurement by the parent over the 30 cells, simulating sequential dealing versus aspect-matched dealing plus the floor: ink coverage min **3.0% -> 35.0%**, median 24.6% -> 40.8%, max **98.6% -> 69.1%**, so the spread narrows from 33x to 2x. Only 3 of 30 cells needed to grow, by at most 1.08x, which means the aspect rule does nearly all the work and the floor is a safety net. **Known limit, not fixed in this slice**: coverage is now uniform *relative to each cell*, but absolute fragment size still varies with the base cell area (12.6x in `layout.json`) and the per-preset random scale (up to 7.8x). Normalising absolute size would be option D (target area per fragment, cell as anchor only), which was not authorized.

L7 (parent, correction): a first measurement pass reported the spread as 12.6x and the fix as complete; that was wrong twice over. The baseline claim in S5 conflated the three sources as if only one mattered, and the parent's own simulation initially clamped coverage to the floor, which made every cell look identical at 35%. Both were caught before reporting. The honest headline is the L6 spread, and the honest limit is the absolute-size caveat.

L8 (parent, review blocker): `gentle_review assess` on this candidate returns `risk: medium`, `nativeRisk: high`, `reviewDue: true` because `scripts/build-ink-metadata.js` crosses a process boundary. Native START is then blocked at the provider with `candidate-view-invalid` / "candidate view symlink target is unsafe". Cause: the harness session scratch lives on **E:** (`E:\gentle-tmp`, visible in every background-job log path and in `/tmp`) while the repository now lives on **C:**, so the candidate view's symlink crosses volumes. This is the same failure recorded in memory #2691, mirrored: there the repo was on E: and the scratch on C:. `lineage_created: false` and `mutation_performed: false`, so nothing was burned and no consent was ever requested. Consequence: **the earlier conclusion that moving the repo to C: fixed native review was premature** — `inspect` passes, the materialisation at START does not. The remedy is human-side: point the harness temp root back to C: and start a new session.
