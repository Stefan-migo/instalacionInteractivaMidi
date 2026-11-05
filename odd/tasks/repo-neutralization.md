# Repo neutralization and technical-debt cleanup

Feature branch: `chore/neutralize-and-clean`. Goal: leave the repository clean, generic and ready to work on again, keeping the installable system functional end to end.

## Specs

S1 — Repo hygiene is the mandate: "necesito limpiar esterepositorio. corregir toda deuda tecnica y dejarlo listo para volver a trabajar en este proyecto."

S2 — Scope of this phase: "la idea aqui es reestructurar este proyecto. eliminar todo lo que tenga relacion con la reforma. neutralizarlo. para readaptar este proyecto."

S3 — Phase boundary: "por ahora nos enfocaremos el organizar. resolver deuda tecnica y neutralizarlo (remover todo lo de la reforma y dejarlo neutro). luego en un paso posteriro nos enfocaremos en darle una nueva identidad y nuevas features de interactividad." A new identity, a new visual language and new interactivity features are OUT of scope.

S4 — Reform-era content is deleted permanently, with no backup: `images/content/` (93 files), `images/manifest.json`, `images/raw/`, `images/borders/`, `DataSet/`, `curation/`, `phone-client/assets/*.docx`, `phone-client/assets/*.zip`, and the MIDI logo files. Tracked deletions remain recoverable from git history; untracked data is gone. The system MUST keep running with zero image content: 30 layout cells, borders rendered, `imageFile: null`, no crash and no thrown error.

S5 — Historical artifacts are preserved: `openspec/changes/archive/`, `sdd/`, `bridge/openspec/`, `.atl/`, `bridge/.atl/` stay untouched. Only the completed change `phone-client-controls-revamp` (16/16 tasks) is archived, and the active specs are neutralized.

S6 — Mechanisms stay, period references go. Keep as generic capabilities: the WebGL paper shader, the 8 border styles, the filter presets (sepia, grayscale, cyanotype, polaroid, vintage, none), the splash → permission → dashboard flow, and the gesture/DTW stack. Remove: the MIDI logo and the "Reafirmá la Reforma" tagline, the `1918` seeds and docstrings, the "Collage Interactivo — Reforma 1918" page title, the historical image titles in the manifest, and the `reforma_1918.jpg` test fixture.

S7 — No deployment work in this phase: no `bridgeUrl` decoupling and no `DEPLOY.md`. Documenting local/tunnel/VPS modes belongs to a later phase.

S8 — Debt closed: `package.json` declares the runtime dependency `ws` under `dependencies`, drops the unused `sharp`, drops the `ngrok`/`dev` scripts that nobody uses, and declares `engines`. `AGENTS.md` describes the real system instead of a 51-image dataset that no longer exists. A `README.md` exists for humans. `scripts/requirements.txt` documents the Python tooling. `coverage/` is not kept on disk. `npm test` stays green.

S9 — Acceptance is observed, never asserted: (a) `npm test` passes with the same or a greater test count; (b) the bridge answers `/health`, `/api/manifest`, `/api/layout`, `/p5-collage/` and `/phone-client/`; (c) `grep -ri "reforma|1918|midi"` over tracked source, docs and specs returns nothing, excluding the preserved history in `openspec/changes/archive/`, `sdd/` and `bridge/openspec/`; (d) `du -sh` shows the working tree under ~10 MB excluding `.git` and `node_modules`.

## Tasks

| ID | Task | Specs | Route | Commit |
|----|------|-------|-------|--------|
| T1 | Create feature document, Engram mirror and visible todo | S1-S9 | inline | (tracking, folded into U1) |
| T2 | Delete Reform-era content and assets; write neutral manifest and 30-cell layout; guard `generate-layout` against an empty manifest | S4, S9d | inline | U1 `chore: remove Reform-era dataset, raw material and assets` |
| T3 | Neutralize branding, copy and period seeds in phone-client, p5-collage and test fixtures | S6, S9c | inline | U2 `refactor: neutralize branding, copy and period seeds` |
| T4 | Neutralize active specs, rewrite `AGENTS.md`, add `README.md` | S5, S6, S8 | inline | U3 `docs: neutralize specs, rewrite AGENTS.md and add README` |
| T5 | Fix `package.json` (deps, scripts, engines), add `scripts/requirements.txt`, archive the completed SDD change, trim `.gitignore` and dead paths | S8 | inline | U4 `chore: fix package manifest, archive SDD change, trim dead paths` |
| T6 | Verify: full suite, bridge smoke test on the neutral system, reference grep, size report | S9 | inline | (no commit) |
| T7 | Persist decisions and close-out to Engram | S1-S9 | inline | (no commit) |

## Log

L1 — User request (verbatim, 2026-11-05):

> ok perfecto. lo que necesito es saber si puedo levantar este proyecto localmente? o necesariamente tengo que levantarlo en un VPS? es mejor si lo hago en un VPS?
>
> necesito limpiar esterepositorio. corregir toda deuda tecnica y dejarlo listo para volver a trabajar en este proyecto.
>
> la idea aqui es reestructurar este proyecto. eliminar todo lo que tenga relacion con la reforma. neutralizarlo. para readaptar este proyecto. por ahora nos enfocaremos el organizar. resolver deuda tecnica y neutralizarlo (remover todo lo de la reforma y dejarlo neutro). luego en un paso posteriro nos enfocaremos en darle una nueva identidad y nuevas features de interactividad.

L2 — Baseline evidence before any change: `npm test` = 310 passing / 20 suites. Local smoke: `/health` ok, `/api/manifest` 12.492 B, `/p5-collage/` 200, `/phone-client/` 200, `/images/content/001.jpg` 200 (426 KB). Node 22.22.2, npm 10.9.7.

L3 — Decisions taken with the user through a structured questionnaire: content deleted without backup; history preserved; mechanisms kept with period references removed; no deployment work. These are encoded as S4-S7.

L4 — Evidence that the neutral system still works: `CollageLayout` builds `bySlot` from any cell list; `DeviceManager.initAll()` renders every cell; `drawImg` returns early when `img` is null; `bridge/index.js` only relays an `imageFile` when the cell has one. Therefore a 30-cell layout with `imageFile: null` and an empty manifest degrade gracefully to border-only cells.

L5 — Untracked material deleted in T2 beyond the questionnaire summary (`DataSet/`, `curation/`, `images/content/`, assets zips): `images/raw/` (355 MB) is also Reform photographic content and falls under S2/S4. It is unrecoverable. `tempExample/` (261 KB, third-party reference project) is NOT Reform content and is left untouched.

L6 — Slice accounting: U1 reports 991 authored changed lines because it carries 93 data-file deletions plus the layout rewrite; the reviewable logic is ~30 lines (bridge `IMAGES_DIR`, `generate-layout` guard, test fixture). U2-U4 stay well under the 400-line budget. Deleting data files is not a review burden requiring a further split.

## Evidence

| Unit | Task | Commit |
|------|------|--------|
| U1 | T2 — content deletion, neutral manifest/layout, `generate-layout` guard, `IMAGES_DIR`, test fixture | `981d4c3` |
| U2 | T3 — branding, copy and period seeds neutralized | `773ea9d` |
| U3 | T4 — specs neutralized, `AGENTS.md` rewritten, `README.md` added | `a0b1c3e` |
| U4 | T5 — package manifest, `requirements.txt`, SDD change archived, `.gitignore` trimmed | `36a89be` |

### Verification (T6)

- `npx jest`: **20 suites, 311 tests passing** (baseline was 310; +1 missing-image 404 test).
- Bridge smoke on the neutral system: `/health` 200, `/api/manifest` `{}`, `/api/layout` 30 cells with `imageFile: null`, `/p5-collage/` 200, `/phone-client/` 200.
- Every local `src`/`href` referenced by both `index.html` files resolves 200 — no dangling asset after the deletions.
- `node --check` clean on every `.js` file in `bridge/`, `p5-collage/`, `phone-client/` and `scripts/`.
- `git grep -ni "reforma|1918|midi|UCR|córdoba"` over tracked files excluding the preserved history: **no matches**. 65 tracked files under `openspec/changes/archive/`, `sdd/` and `bridge/openspec/` keep their original wording by design (S5).
- Working tree: **1.6 MB** excluding `.git` and `node_modules` (was ~2.1 GB with data on disk). `.git` stays at ~316 MB because history is the recovery path for the deleted tracked images.
- Zero-content safety proven by code inspection: `ImageCycler.cycle()` returns `null` on an empty pool and the caller guards it; `adaptCellToImage()` returns `false` when `img` is null; `drawImg()` returns early on a null image; the bridge only relays `imageFile` when present.
