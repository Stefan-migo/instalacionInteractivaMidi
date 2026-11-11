# Normalize the image library

Consolidate the three image pools into one flat, normalized, functional library
under `images/content/`, and rebuild the metadata that depends on it.

## Specs

- **S1** — User, verbatim: "Necesito eso sí que lo normalices, los tamaños y el peso de cada imagen".
  Every image gets one deterministic geometry rule and one encoding rule:
  longest edge capped at 1600 px, never upscaled, re-encoded to WebP at quality
  90 with alpha preserved. The library must drop from ~100 MB to a size the
  installation can decode on demand.
- **S2** — User, verbatim: "que quede todo funcional".
  Everything the system serves and renders must work: `.webp` has a correct MIME
  type, `images/manifest.json` describes only files that exist on disk,
  `images/layout.json` points at current filenames, `npm test` is green, the p5
  collage and the phone client both render images.
- **S3** — User, verbatim: "y ordenado en la carpeta principal".
  All images live flat in `images/content/`, sequentially numbered, no
  subfolders, byte-identical duplicates removed, and every rename's provenance
  recorded in `curation/rename-map.json`.

## Tasks

| ID | Task | Specs | Route | Commit |
| --- | --- | --- | --- | --- |
| T1 | Flatten both pools into `images/content/`, drop byte duplicates | S3 | inline | — |
| T2 | Re-encode to WebP, longest edge ≤ 1600 px, q90, alpha kept | S1 | inline | — |
| T3 | Renumber `001..130` and record provenance | S3 | inline | — |
| T4 | Rebuild `manifest.json` (file, w, h, role, axis, pole) | S2, S3 | inline | — |
| T5 | Serve `.webp` from the bridge with a correct MIME type | S2 | inline, test-first | yes |
| T6 | Regenerate `images/layout.json` | S2 | inline | — |
| T7 | Update `images/CONTENT-TAXONOMY.md` from the real library | S3 | inline | yes |
| T8 | Verify: HTTP per file, tests, visual sheet, running stack | S1, S2, S3 | inline | — |

Image data is local-only (`images/content/` is gitignored and
`images/manifest.json` / `images/layout.json` carry skip-worktree), so only T5
and T7 can produce a committable diff.

## Log

- **L1** — User, verbatim: "E:\Proyectos\InstalacionInteractivaMidi\images\content Te pasé esta carpeta para que revises las imágenes que subí. Subí un montón de imágenes en PNG listas para ser utilizadas en el collage. Necesito eso sí que lo normalices, los tamaños y el peso de cada imagen y que quede todo funcional y ordenado en la carpeta principal."
- **L2** — Inventory evidence: 131 files / 100.0 MB across `images/content/`,
  `images/content/sin fondo ready2/` and `images/content/sn fondo ready/`;
  130 unique by content (`005.png` == `022.png`); 127 with alpha; max edge
  median 1080, p90 1536, max 2172; 13 files over 1600 px.
- **L3** — Broken-state evidence: `images/manifest.json` lists 35 entries but
  7 files are gone from disk (001, 003, 008, 016, 017, 024, 025), so the deck
  deals 404s; `images/layout.json` still references pre-consolidation names.
- **L4** — Encoding evidence: WebP at longest edge 1600 measured on six
  representative files q80/q88/q94; q90 chosen because halftone gradients band
  at q80 while q94 doubles weight for no visible gain at cell scale (cells render
  at most ~400x650 px).
- **L6** — Production evidence (supersedes S4 of `repo-neutralization.md`).
  User chose to ship the library so the Render deploy renders a collage instead
  of empty cells. PR #24 (`fix(bridge): serve webp with the image/webp MIME
  type`) and PR #25 (`feat(images): ship the normalized image library`, 137
  files: 130 webp + manifest + layout + corrected docs) merged to `main`, which
  deploys to Render on merge. Production host: `collageinteractivomidi.onrender.com`
  (from the local, gitignored `.env`). Verified live: `/health` 200;
  `/api/manifest` 130 entries; `/api/layout` 30/30 cells with `imageFile`;
  `/p5-collage/`, `/phone-client/` and `/operator/` all 200;
  `/images/content/048.webp` 200 with `Content-Type: image/webp` and a valid
  1312x1199 alpha WebP out of the wire. `images/raw/` (101 MB) and `curation/`
  stayed local.
  Known production caveat: a free Render instance sleeps when idle, and the
  bridge keeps slots, deck, gestures and groups in memory, so an idle period
  loses that state and the next request pays a cold start.

  `130.webp`, 17.1 MB (from 131 files / 99.7 MB); originals kept in
  `images/raw/` (101 MB) with provenance in `curation/rename-map.json`.
  `images/manifest.json` has 130 entries with role/axis/pole; `images/layout.json`
  regenerated to 30 cells, all `.webp`, 30 distinct. Bridge serves `image/webp`
  (test added to `tests/bridge-http.test.js`, RED `application/octet-stream` →
  GREEN). Every one of the 130 manifest files returns 200 through the bridge.
  Full suite 44 suites / 463 tests green. No commits: the image data is
  local-only (gitignored, skip-worktree) and the committable diff was left
  uncommitted because the user did not ask for a commit.
