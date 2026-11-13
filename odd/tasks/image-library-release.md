# Image library release — the final selection, plus an operator marker

Feature: `image-library-release`. Branch: `feat/image-library-release`. Two halves: a reproducible release pipeline for the image library (T1-T2), and a visible marker for images that already have a saved size in the operator (T3).

## Specs

S1 (verbatim, user): "ok perfecto esta todo funcionando solo falt hacer un nuevo release con la seleccion final del imagenes. todas estan aca: \"C:\\Proyectos\\InstalacionInteractivaMidi\\images\\raw\\raw library definitivo\" necesito que adaptemos las imagenes para mejorarlas y despues seleccionaremos sus tama;os con el operator."

S2 (verbatim, user): "para el operator. puedes tambien agregar una forma para que se distinga las imagenes que ya han sido guardadas con su tama;o. asi es mas facil la edicion"

S3 (verbatim, user, answering what "improve" means): "Mismo pipeline que hoy" — longest edge ≤ 1600 px, WebP quality 90, alpha preserved. No upscaling.

S4 (verbatim, user, answering how many): "Las 210 (todas las distintas)"

S5 (verbatim, user, answering the marker): "Marca + filtro \"sin asignar\""

S6 (evidence, measured before writing this): the source folder holds **211 files, 136 MB**, 207 PNG (rgba) and 4 JPG (yuvj420p, no alpha), with names like `download (34).jpg` and `005 (1).png`. Exact-duplicate analysis by hash gives **210 distinct images**; the only exact pair is `005.png == 022.png`. Those suffixes are *not* duplicates, they are different images. Pixel area ranges from 95,744 to 1,573,242 px² (16x).

S7 (constraint): `role`, `axis` and `pole` in the current manifest are **not consumed by any code** — the only `role` in the codebase is the WebSocket client role and the only `axis` is a gesture axis. The new manifest therefore ships without them. The taxonomy they came from stays documented in `images/CONTENT-TAXONOMY.md` as history of the previous library; re-tagging 210 new images is out of scope.

S8 (constraint): keys are renumbered `001…210` in a deterministic order, so **every authored size in `images/sizes.json` and every exclusion in `images/deck.json` loses its meaning** and both files are reset by the release. The user accepted this: they will re-author sizes with the operator, which is exactly what T3 makes easier.

S9 (constraint): the four JPGs without alpha stay as they are and get `inkRatio: 1` from the existing ink pass. No background removal: `scripts/remove-bg.py` needs per-image review and could eat text or torn edges.

S10 (constraint): the release is **reproducible and testable**. One entry point, a `--dry-run` that lists the plan without writing, ffmpeg behind an injected converter so the suite never needs it, and idempotency: a second run over the same source produces the same keys and the same bytes.

S11 (constraint): `images/raw/` is read-only for this work. Nothing deletes or re-encodes an original.

## Tasks

| ID | Specs | Route | Task | Commit |
|----|-------|-------|------|--------|
| T1 | S3, S6, S10, S11 | worker | `scripts/import-library.js`: enumerate the source deterministically, drop exact duplicates by hash, normalize each survivor to WebP (longest edge ≤ 1600, q90, alpha preserved, never upscale) into `images/content/NNN.webp` with stable zero-padded keys, and write `images/manifest.json` with `file`, `w`, `h` only. `--dry-run` prints the plan. Injected converter, tested in Node without ffmpeg. | pending |
| T2 | S7, S8, S10 | worker | Orchestrate and run the release on this branch: `import-library` → `build-ink-metadata` → `generate-layout` → `build-thumbnails`, then reset `images/sizes.json` assignments and `images/deck.json` excluded. Report the before/after counts, the repo size delta, and the ink-coverage distribution of the new library. | pending |
| T3 | S2, S5 | worker | Operator: mark every image that has a saved size (visible badge showing its class, in the Dimensiones mode and in the grid) plus a "solo sin asignar" filter to jump straight to what is left. Logic in `operator/deck-curation.js`; no DOM test dependency. | pending |
| T4 | S1 | inline | Docs: `AGENTS.md` (release command, manifest without taxonomy, reset consequence) and this document's close-out. | pending |

## Log

L1 (verbatim, user): "ok perfecto esta todo funcionando solo falt hacer un nuevo release con la seleccion final del imagenes. todas estan aca: \"C:\\Proyectos\\InstalacionInteractivaMidi\\images\\raw\\raw library definitivo\" necesito que adaptemos las imagenes para mejorarlas y despues seleccionaremos sus tama;os con el operator."

L2 (verbatim, user): "para el operator. puedes tambien agregar una forma para que se distinga las imagenes que ya han sido guardadas con su tama;o. asi es mas facil la edicion"

L3 (verbatim, user, three answers): "Mismo pipeline que hoy" · "Las 210 (todas las distintas)" · "Marca + filtro \"sin asignar\""

L4 (parent, evidence): the previous library's "bardo" was not the images but the sizing logic, which is now fixed and authored per image. This release is the moment to re-do the dataset on top of the fixed logic, and the reason S10 insists on a reproducible pipeline: the user says "un nuevo release", implying more than one.

L5 (parent, decision): dropping `role`/`axis`/`pole` is safe only because it was verified that no code reads them. That verification is the whole justification — if a later slice starts consuming them, the manifest needs them back and the 210 images need tagging.
