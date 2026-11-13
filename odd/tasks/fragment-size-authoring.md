# Fragment size authoring — per-image size classes set by the owner

Feature: `fragment-size-authoring`. Branch: `feat/fragment-size-authoring`. Builds on `odd/tasks/collage-fragment-sizing.md` (slice 1, shipped in `89ecec9`).

## Specs

S1 (verbatim, user): "ok y si quisiera yo determinar los tama;os de cada imagen por default. luego son modificables verdad. con scale, opacidad y rotacion. pero el default me gustaria a mi determinar tama;os. podriamos levantar una instancia tests donde aparezca cada imagen dentro del canvas y asi yo puedo determinar su tama;o default en el proyecto?"

S2 (verbatim, user, answering how the default is expressed): "Clase de tamaño (S/M/L/XL) que se traduce a área"

S3 (verbatim, user, answering precedence): "El default manda; el preset solo desordena"

S4 (verbatim, user, answering persistence): "images/sizes.json, escrito por el bridge"

S5 (verbatim, user, answering the editor view): "Una por vez, con referencia al lado"

S6 (verbatim, user, restating the existing contract that must survive): "luego son modificables verdad. con scale, opacidad y rotacion." The runtime modifiers stay exactly as they are: `setScale`, `setRotation`, `setOpacity` from the operator page and the phone actions. The authored default is the starting point, never a lock.

S7 (decision, derived): the size class maps to a **target ink area as a fraction of the canvas**, not to a cell-relative scale. Because the ink metadata from slice 1 exists, `drawnArea = targetInk / inkRatio`, so two images of the same class carry the same painted mass even though one is a panorama at 30% ink and the other 60%. This is what makes a class meaningful across cells.

S8 (decision, derived): the mapping from class to area lives **in the data file**, not in code, so tuning the four numbers needs no commit to a module.

S9 (decision, derived): with a default present, the per-preset random `scale` no longer decides size — it degrades to a small jitter (position and rotation keep their existing scatter). The ink floor from slice 1 stops correcting size when a default exists; it is reported as a console warning instead, because the owner's authored size now outranks it.

S10 (constraint, safety): the write endpoint must be **disabled by default** and enabled only by an explicit environment flag, because the same bridge runs in production on Render. An unguarded write endpoint on a public deployment lets anyone rewrite the size file.

S11 (out of scope, stated): slice 2 of the previous feature (alpha-contour hit-testing in `drag-manager.js`) is still not part of this work.

S12 (decision, derived — no regression): an image with **no** authored class keeps the slice-1 behaviour exactly (aspect-compatible dealing plus the ink floor). Only images the owner actually classifies switch to target-ink-area sizing. The shipped `images/sizes.json` therefore starts with every image unassigned, so merging this feature changes nothing on screen until the owner authors classes. A blanket "everything is M" default is explicitly rejected: it would flatten the collage into uniform fragments the moment this lands.

## Tasks

| ID | Specs | Route | Task | Commit |
|----|-------|-------|------|--------|
| T1 | S2, S7, S8, S12 | worker | `images/sizes.json` (schema + `version` + `classes` map class→canvas-fraction + per-image class, shipped with no image assigned) with a loader/validator module. An unassigned image resolves to "no authored size". Pure logic, tested in Node. | pending |
| T2 | S4, S10 | worker | `POST /api/sizes` on the bridge: disabled unless an explicit env flag is set; validates JSON shape, known image keys only, class in the allowed set, payload size cap; writes atomically; rejects everything else with a clear error. Tested including the disabled path and every rejection. | pending |
| T3 | S1, S5 | worker | Operator page "Dimensiones" mode: one image at a time on the canvas, a fixed reference beside it, S/M/L/XL controls with keyboard shortcuts, prev/next navigation, assignment progress, and save through T2. Draws with the same sizing rule as the collage so what is authored is what ships. | pending |
| T4 | S3, S7, S9 | worker | Collage integration: `cell-renderer.js`/`image-deck.js` honour the authored class; preset scale degrades to jitter; ink floor becomes a warning when a default exists; missing `sizes.json` falls back to the slice-1 behaviour unchanged. | pending |
| T5 | S1 | inline | Docs: **fix the stale module table in `AGENTS.md`** (it lists `p5-collage/control-panel.js`, which does not exist, and omits `operator/`, `operator-link.js`, `collage-layout.js`, `transition-renderer.js`), then document `sizes.json`, the precedence rules, the env flag and the editor route. | pending |

## Log

L1 (verbatim, user): "ok y si quisiera yo determinar los tama;os de cada imagen por default. luego son modificables verdad. con scale, opacidad y rotacion. pero el default me gustaria a mi determinar tama;os. podriamos levantar una instancia tests donde aparezca cada imagen dentro del canvas y asi yo puedo determinar su tama;o default en el proyecto?"

L2 (verbatim, user, the four answers): "Clase de tamaño (S/M/L/XL) que se traduce a área" · "El default manda; el preset solo desordena" · "images/sizes.json, escrito por el bridge" · "Una por vez, con referencia al lado"

L3 (parent, discovery): the operator page already exists — `operator/operator.js` + `operator/operator.css`, wired to the collage through `p5-collage/operator-link.js`, already able to send `setScale`, `setRotation`, `setOpacity`, `setFilter`, `toggleVisibility`, `selectCell`, `setPreset` and `setScatterScale` per cell. So the modifiers in S6 are pre-existing and must not be rebuilt. What does not exist is any persistence: `cell._editorScale` lives in memory and dies with the page, so there is no default to author yet. The decision was therefore to add a mode to the operator rather than stand up a second app.

L4 (parent, discovery): `AGENTS.md` is wrong about `p5-collage/`. It lists `control-panel.js`, which does not exist, and omits `collage-layout.js`, `transition-renderer.js`, `operator-link.js` and the whole `operator/` directory, all of which exist and all of which have tests (`control-panel.test.js`, `operator-link.test.js`, `operator-routes.test.js`, `operator-routing.test.js`). Recorded as T5 so the doc stops lying.

L5 (parent, risk note): this feature introduces a **write path** (`POST /api/sizes`) that mutates a tracked file, and the same bridge runs in production. That is Task Size item 1 (writing data) and item 2 (an endpoint reachable from the internet). S10's default-off switch is the mitigation, and this candidate will need independent verification and, if the environment allows it, a native review.

L6 (parent, decision): S12 exists because the first draft of T1 defaulted every image to `M`, which would have flattened all 130 fragments into one uniform size the moment the feature merged — a regression dressed as a default. Shipping the file with nothing assigned makes the feature opt-in per image and keeps `main` visually unchanged until the owner starts authoring.
