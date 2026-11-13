# Deck curation grid — exclude images and apply size classes in bulk

Feature: `deck-curation-grid`. Branch: `feat/deck-curation-grid`, stacked on `feat/fragment-size-authoring` (which must merge first). Extends `odd/tasks/fragment-size-authoring.md`.

## Specs

S1 (verbatim, user): "ok funciona bien. necesito que 2 cosas mas. la posibilidad de sacar imagenes del deck. y tambien podria un bulk action y mostrar la imagenes en un grid con las imagenes en thumbnail para seleccionar y poder realizar la seleccion del tama;o en bulk."

S2 (verbatim, user, answering what removing means): "Excluirla del mazo hasta que la reactive"

S3 (verbatim, user, answering where it lives): "Archivo propio para el mazo"

S4 (verbatim, user, answering thumbnails): "Generar miniaturas de verdad"

S5 (verbatim, user, answering grid scope): "La grilla hace las dos cosas"

S6 (constraint, must be surfaced in the UI): the deck guarantees one distinct image per visible cell and **never repeats**. Below 30 available images, the remaining cells render **nothing**. The grid must say so before the owner excludes their way into a half-empty canvas.

S7 (decision, derived): exclusion is **curation**, not sizing, so it lives in its own file `images/deck.json` (`version` plus an `excluded` list of manifest keys), never mixed into `images/sizes.json`. Excluding an image removes it from dealing; re-including restores it. This is a committed project decision, not a session toggle.

S8 (decision, derived): thumbnails are generated once, offline, into `images/thumbs/<key>.webp` (~200 px longest edge, quality ~70, roughly 1 MB for 130 files) and committed, so the grid never loads 17 MB of originals. The generator is idempotent and its reader is injected so the suite needs no ffmpeg.

S9 (decision, derived): one write guard covers all authoring writes. Rename `SIZE_WRITES_ENABLED` to **`AUTHORING_WRITES_ENABLED`** and use it for both `POST /api/sizes` and the new `POST /api/deck`. Nothing outside this branch depends on the old name yet (the branch is unpushed), so this is the moment to fix the name rather than ship two flags that mean the same thing.

S10 (constraint, safety): both write endpoints stay **disabled by default**, validate against the manifest, cap their payload, and write atomically (temp file plus rename). The same bridge is publicly reachable in production.

S11 (out of scope, stated): deleting images from the project is explicitly **not** part of this. Nothing removes files from `images/content/`.

S12 (verbatim, user): "olvide decir que tambien necesito un toast para confirmar la acciones del operator"

## Tasks

| ID | Specs | Route | Task | Commit |
|----|-------|-------|------|--------|
| T1 | S7, S10 | worker | `images/deck.json` (shipped with an empty `excluded` list) plus a shared deck-list module: validate against the manifest, resolve the usable pool. Pure logic, tested in Node. | pending |
| T2 | S10, S9 | worker | Bridge: `GET /api/deck` (empty defaults when missing or corrupt) and `POST /api/deck` (guarded, validated, atomic). Rename the guard to `AUTHORING_WRITES_ENABLED` and apply it to both write routes, updating the sizes route and its tests. | pending |
| T3 | S8 | worker | `scripts/build-thumbnails.js`: generate `images/thumbs/<key>.webp` at ~200 px for every image, idempotent, ffmpeg behind an injected reader, tested without ffmpeg. Runs once to produce the 130 committed thumbnails. | pending |
| T4 | S1, S6, S7 | worker | Deck integration: `image-deck.js` deals only from the usable pool, preserving one-distinct-per-cell and no-repeat; excluded images never appear; below 30 available the surplus cells render nothing, as today. | pending |
| T5 | S1, S5, S6, S12 | worker | Operator grid view: thumbnails in a grid, multi-select (checkbox, shift-range, select-all), bulk apply S/M/L/XL, bulk exclude/include, save through T2, and a live warning of how many cells would be left empty. Every operator action that reaches the bridge — in the grid and in the existing Dimensiones mode — confirms itself with a toast stating what was done and to how many images; a failure shows a toast naming the error, never a silent no-op. | pending |
| T6 | S1 | inline | Docs: `AGENTS.md` (deck.json, thumbs, the renamed flag, the grid route) and this document's close-out. | pending |

## Log

L1 (verbatim, user): "ok funciona bien. necesito que 2 cosas mas. la posibilidad de sacar imagenes del deck. y tambien podria un bulk action y mostrar la imagenes en un grid con las imagenes en thumbnail para seleccionar y poder realizar la seleccion del tama;o en bulk."

L2 (verbatim, user, four answers): "Excluirla del mazo hasta que la reactive" · "Archivo propio para el mazo" · "Generar miniaturas de verdad" · "La grilla hace las dos cosas"

L3 (parent, confirmation): the size-authoring mode works for the human ("funciona bien"), including the guarded save, so this slice extends a validated base rather than a guess.

L4 (parent, risk note): T2 and T5 introduce a second write path and a second thing the owner can destroy by accident — a deck below 30 images leaves empty cells. S6 makes that a visible warning in the UI, not a silent consequence. Risk items 1 and 2 apply again.

L5 (parent, decision): the flag rename in S9 is deliberate and belongs in this slice, because shipping `SIZE_WRITES_ENABLED` and a second flag for deck writes would leave two names for one concept, and the branch is still unpushed.

L6 (verbatim, user): "olvide decir que tambien necesito un toast para confirmar la acciones del operator"

L7 (parent, note on the working tree): `images/sizes.json` shows as modified on this branch because the human **used** the Dimensiones mode and saved assignments through the bridge. That is live authored data, not a stray edit: it must be preserved and committed with the feature, never reverted. Any worker that sees it modified should treat it as protected content, not as a blocking anomaly.
