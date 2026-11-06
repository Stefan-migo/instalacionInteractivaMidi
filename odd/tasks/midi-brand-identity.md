# MIDI brand identity applied to the app

Feature branch: `design/midi-brand`. Goal: replace the current visual language of both clients and the operator panel with the aesthetics of the MIDI brand pack, keeping every behavior and the 319-test suite intact.

## Specs

S1 — Mandate: "ok lo primero que tenemos que hacer es cambiar el estilo/dise;o de la aplicacion. E:\Proyectos\InstalacionInteractivaMidi\Logo necesitamos seguir la estetica del logo".

S2 — Delivery flow: "ok tengo el proyecto levantado en render. por tanto. lo vamos a ir trabajando local y cuando hagamos merges al github se ira a produccion automaticamente". Consequence: `main` is production. All work lands through a feature branch and a pull request, never by direct commits to `main`.

S3 — Scope of this stage, chosen by the user: "Todo, incluidos assets web" — `phone-client/`, the operator panel in `p5-collage/`, both HTML shells, and the web brand assets from `Logo/MIDI-Brand-Pack/03-Web/`. The collage content itself (photos, torn borders, paper texture, filters) is NOT restyled; only the interface chrome around it.

S4 — The brand pack is the visual authority, quoted from `Logo/MIDI-Brand-Pack/05-Guia/LEEME.md`: "Negro #000000 sobre fondos claros; blanco #FFFFFF sobre fondos oscuros. Para fotos, usar un panel liso con contraste suficiente. No estirar, girar, aplicar sombras, contornos ni recolorear sin definir antes una paleta de marca." And the clearance rule: "Mantener un espacio libre minimo equivalente a 1/4 del ancho del bloque superior derecho del simbolo."

S5 — Monochrome is the default and colour is a decision, not a default: the pack declares no palette beyond `#000000` and `#FFFFFF` (S4). Introducing any accent colour requires an explicit user decision recorded in this Log before it is implemented.

S6 — Typography must be declared: the pack states "No se identifico ni sustituyo la tipografia." The project therefore names its own typefaces in `design/system.md`, using system font stacks only, since artboards may not reference external URLs, CDNs or remote fonts.

S7 — The brand pack stays out of version control: the user added `Logo/` to `.gitignore`. No file under `Logo/` is committed; artboards reference the mark by inline SVG geometry, and runtime assets are regenerated from the pack rather than vendored.

S8 — Behavior is not part of this change: the 319 tests in 20 suites stay green, the bridge keeps answering `/health`, `/api/manifest`, `/api/layout`, `/p5-collage/` and `/phone-client/`, and the splash → permission → dashboard flow, the gesture wizard, the six layout presets, the eight border styles and the six filters all keep working. This is a reskin with no protocol, no bridge and no behavior change.

S9 — Sensors still require a secure context, so the phone client is verified in a browser at `localhost` and, for real devices, only through HTTPS. A plain LAN IP remains untestable, unchanged from before this phase.

## Tasks

| ID | Task | Specs | Route | Commit |
|----|------|-------|-------|--------|
| T1 | Create feature document, Engram mirror and visible todo | S1-S9 | inline | (tracking, folded into U1) |
| T2 | Design system sync: capture the current tokens into `design/system.md` + `design/system.html` as the replacement baseline | S4, S6 | inline | U1 `docs: capture the current design tokens as the reskin baseline` |
| T3 | Three design directions in `design/midi-brand/`, each a self-contained artboard set, plus `design.json` and the canvas | S4, S5, S6 | inline | U2 `docs: add three MIDI brand design directions` |
| T4 | User picks the direction to implement | S3, S5 | inline (decision) | — |
| T5 | Apply the chosen direction to `phone-client/` (screens, wizard, help overlay) | S3, S8 | writer | U3 |
| T6 | Apply the chosen direction to the operator panel in `p5-collage/` | S3, S8 | writer | U4 |
| T7 | Shells + web brand assets (favicon, Apple Touch, maskable, `site.webmanifest`) | S3, S7 | writer | U5 |
| T8 | Verify: suite green, endpoints alive, artboards match the implementation | S8, S9 | verify | (folded into U5) |

## Log

L1 — User request, verbatim: "ok lo primero que tenemos que hacer es cambiar el estilo/dise;o de la aplicacion. E:\Proyectos\InstalacionInteractivaMidi\Logo necesitamos seguir la estetica del logo".

L2 — User, earlier, verbatim: "ok tengo el proyecto levantado en render. por tanto. lo vamos a ir trabajando local y cuando hagamos merges al github se ira a produccion automaticamente".

L3 — Scope decision: the user selected "Todo, incluidos assets web" over the narrower options (phone client only, phone client plus operator panel). Basis for S3.

L4 — Evidence, brand pack read: `05-Guia/LEEME.md` declares a two-colour identity (#000000 / #FFFFFF), states the typeface was neither identified nor substituted, requires a minimum clearance of 1/4 of the upper-right block width, and forbids recolouring before a palette is defined. The `02-PNG` and `01-Vector` marks were inspected: orthogonal blocks with straight white channels, pixel-stepped silhouette, stencil slab wordmark. Basis for S4, S5, S6.

L5 — Evidence, prior phase: `odd/tasks/repo-neutralization.md` S3 deferred exactly this work — "luego en un paso posterior nos enfocaremos en darle una nueva identidad" — and S4 removed the previous MIDI logo files. This phase is that deferred step, and it reintroduces the mark deliberately.

L6 — Evidence, design sources: `gentle_design` list reports one source, `phone-client/style.css` (1081 lines), no `design/system.md`, and no existing designs. The sync in T2 is therefore the baseline we replace, not a system we preserve.

L7 — Baseline observed at branch time: `npm test` → 20 suites, 319 tests passed. `main` at `b42c16c`.

L8 — Design directions written: `design/midi-brand/` holds three artboards (`01-bloques.html`, `02-ficha.html`, `03-registro.html`), each 1660×1070 showing the splash, permission and dashboard screens at 375×812 plus the operator panel at 360px and a system-fiche strip. They differ in structure, not colour: separation by 12px channels, by 1px rules with tabular alignment, and by edge-anchored bands with 19-unit offsets. Only `01-bloques` carries the wordmark; all three carry the symbol's real geometry inlined. All three are self-contained (verified: no external `src` or `href`, balanced tags). Behaviour preserved by design: the torn `clip-path` frame, the REC/gesture chips, the six layout presets, the six filters and the eight borders all keep their places.

L9 — Colour source decided from evidence, not taste: `Logo/MIDI-Brand-Pack/03-Web/site.webmanifest` declares `theme_color` and `background_color` as `#000000`, and the pack's icons are black fields with white symbols (LEEME: "Los iconos tienen fondo negro y simbolo blanco para conservar contraste"). The phone client therefore opens black-on-white rather than on paper. Basis for T3.

L10 — Derived neutral, declared explicitly: a single channel tone (`rgba(255,255,255,.6)` on black, `rgba(0,0,0,.58)` on white) carries secondary text hierarchy. It is derived from the two brand colours, not a third brand colour, and exists because pure-white-on-pure-black leaves no hierarchy and no AA-compliant muted level. Recorded here because S5 requires an explicit decision before any tone beyond #000/#FFF is used.

L11 — Direction selected by the user: **02 · Ficha**. Handoff started (`gentle_design implement`, target `midi-brand/02-ficha.html`), status `in_progress`. Implementation is partitioned into four disjoint surfaces so no two writers touch the same file: `phone-client/style.css`; `p5-collage/control-panel.css` + `control-panel.js`; `phone-client/index.html` + `p5-collage/index.html` + `phone-client/app.js`; `bridge/index.js` MIME map (parent).

L12 — Conflict resolved: the handoff text instructs implementers to "take colors, typography, spacing, radius and shadows from `design/system.md`, the project's token source", but at that moment `design/system.md` still described the legacy system being replaced. The document is therefore re-synced to the new tokens (T10) instead of being followed as-is; following it literally would have re-introduced the paper palette and the Google Fonts dependency. Recorded so the contradiction is not mistaken for a later regression.

L13 — Test-first for the brand assets: `tests/brand-assets.test.js` was written before the assets existed and observed RED with four `404`s, then GREEN after copying the icon set into `phone-client/icons/` and adding `.svg`, `.ico` and `.webmanifest` to `MIME_TYPES` in `bridge/index.js`. That MIME change is a real behaviour change: a favicon served as `application/octet-stream` is ignored by browsers, and a manifest served as `text/plain` is never read as a manifest. Baseline after the reskin: 21 suites, 323 tests.

L14 — Transient RED window, recorded so it is not mistaken for a worker defect: the phone-client worker reported 3 brand-asset failures because it ran `npm test` between the icon copy and the MIME change. The final suite is green; the failure was a coordination artefact of overlapping work, not a stylesheet defect.
