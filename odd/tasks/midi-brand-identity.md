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

S8 — Behavior is not part of this change: the 319 tests in 20 suites stay green, the bridge keeps answering `/health`, `/api/manifest`, `/api/layout`, `/p5-collage/` and `/phone-client/`, and the splash → permission → dashboard flow, the gesture wizard, the six layout presets, the eight border styles and the six filters all keep working. This is a reskin with no protocol, no bridge and no behavior change. Exception, granted by S11: the phone client's tools surface changes shape (drawer → fixed collapsible sheet) while every action it carries keeps firing.

S11 — Ficha grammar in the phone client (reopened T5, see L17). `design/midi-brand/02-ficha.html` is the visual authority for `phone-client/`: numbered section labels ("02 / 03 — Sensores", "Campo 01", "Requerido"), tabular rows with a 1 px underline, a bottom sheet fixed to the screen with the tabs Forma / Gestos / Guía, three action buttons in one row-action grid, control rows with a 1 px rail and a square thumb, and state communicated by filled/empty squares, never by colour. Tokens come from `design/system.md`; the artboard's artboard-only pixel sizes are not minted as new tokens. Decisions of record for what the artboard leaves open: the sheet starts open and collapses to its tab strip (L19); Látigo keeps its name and its `shuffle` binding (L19); fragment prev/next and Rec live in the sheet with the other actions (L19); the phone client adopts the light surface `data-theme="light"` — ink #111111 on paper #f4f4f4 — because the direction's stated strategy is "campo blanco, tinta negra" (L20).

S9 — Sensors still require a secure context, so the phone client is verified in a browser at `localhost` and, for real devices, only through HTTPS. A plain LAN IP remains untestable, unchanged from before this phase.

S10 — The projector canvas field is black with monochrome noise, not the warm cream paper. User request: "ok perfecto se ve bien. me falta el fondo del p5-collage actualmente sigue con el background antiguo". Chosen field: "Negro con ruido monocromo". The shader keeps its grain and its API; only the base colour and the noise mapping change, so the texture that is a signature of the project survives while the sepia disappears. Known follow-up, not part of this card: the eight torn border styles are drawn in warm brown and gold tones (`border-renderer.js`) and were designed against cream paper; on black they may read as loose cut-outs and will need review later.

## Tasks

| ID | Task | Specs | Route | Commit |
|----|------|-------|-------|--------|
| T1 | Create feature document, Engram mirror and visible todo | S1-S9 | inline | (tracking, folded into U1) |
| T2 | Design system sync: capture the current tokens into `design/system.md` + `design/system.html` as the replacement baseline | S4, S6 | inline | U1 `docs: capture the current design tokens as the reskin baseline` |
| T3 | Three design directions in `design/midi-brand/`, each a self-contained artboard set, plus `design.json` and the canvas | S4, S5, S6 | inline | U2 `docs: add three MIDI brand design directions` |
| T4 | User picks the direction to implement | S3, S5 | inline (decision) | — |
| T5 | Apply the chosen direction to `phone-client/` (screens, wizard, help overlay) — **reopened: not implemented in `main`**, see L17. Superseded by T5.1-T5.5 | S3, S8, S11 | — | U3 (reverted; see L17) |
| T5.1 | Ficha primitives in `phone-client/style.css` (`.display`, `.num`, `.data`, `.btn`, `.state-sq`, `.sheet-tabs`, `.row-actions`, `.rows`, `.range`) and the light surface; splash + permission rebuilt as a printed form | S3, S8, S11 | inline | U7 |
| T5.2 | Dashboard head and HUD: `dash-head` cells (fragment number, filled connection square, help), status chips, torn photo frame with caption | S8, S11 | inline | U8 |
| T5.3 | Fixed collapsible sheet: tab strip always visible, `row-actions` (‹ › Rec Látigo Al frente Filtro), control rows with rail + square thumb, Tránsito rows | S8, S11 | inline | U9 |
| T5.4 | Overlays in the grammar: help card, gesture gallery, practice, hint; wizard steps | S8, S11 | inline | U10 |
| T5.5 | Dead-CSS sweep, `design/system.md` sync, verification (suite green, endpoints alive, artboard compared screen by screen) | S8, S11 | inline | U11 |
| T6 | Apply the chosen direction to the operator panel in `p5-collage/` | S3, S8 | writer | U4 |
| T7 | Shells + web brand assets (favicon, Apple Touch, maskable, `site.webmanifest`) | S3, S7 | writer | U5 |
| T8 | Verify: suite green, endpoints alive, artboards match the implementation | S8, S9 | verify | (folded into U5) |
| T9 | Projector canvas field: black base with monochrome noise in the shader, black fallback fill, black `fullscreenBg`; update any test that pins the old cream value | S10 | writer | U6 |

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

L15 — User, verbatim: "ok perfecto se ve bien. me falta el fondo del p5-collage actualmente sigue con el background antiguo". Correct observation and a gap in this feature's original scope: S3 reskinned chrome only, and the projected field is drawn by the WebGL shader in `p5-collage/background-texture.js` (`gfx.fill(235, 217, 179)` at :20 and :33, warm shader base), not by CSS. Removing the paper `body` colour did not touch it. Basis for S10 and T9.

L16 — Field decision: the user chose "Negro con ruido monocromo" over pure black and over white paper. Rationale of record: a full 1920×1080 white field is a wall of light in a dark room and lowers photo contrast; pure black loses the paper grain that is a signature of the project; black with monochrome noise keeps the tactility and lets the fragments be the only lit thing on screen. The warm-toned border styles are acknowledged as a possible follow-up rather than silently restyled here.

L17 — Handoff re-opened with evidence. `gentle_design implement` targeted `midi-brand/02-ficha.html` and the canvas reported it as already implemented, but the phone client on `main` does not carry the Ficha grammar. `phone-client/index.html` still ships `status-row`, `tools-panel`, `actions-grid`, `stamp-btn`, `vintage-slider` and `control-group`, and nothing implements the artboard's numbered fields ("02 / 03 — Sensores", "Campo 01", "Requerido"), its tabular data rows (Fragmentos / Lienzo / Sesión), `sheet-tabs`, `row-actions`, or the filled-versus-empty `state-sq` vocabulary. A grep for those markers across `index.html`, `style.css` and `app.js` returns only four unrelated `tabular` hits. So T5 is not done and the canvas label was wrong.

Size and risk, recorded before anyone starts: T5 is a structural rewrite of the phone client's markup plus its stylesheet, not a token change. `phone-client/app.js` queries many of those IDs and classes (the coupling contracts in `design/system.md` §9), the suite has 440 tests across 40 suites, and this is the surface every visitor holds in their hand. It must not ride inside the identity PR #17, which is deliberately token-only and already green.

Status: the handoff stays `in_progress`; it is not claimed as implemented. This log entry is left uncommitted because the handoff commits nothing, and the target branch has not been chosen yet.

L18 — PR #17 merged. The user's handoff (Engram 2672) opened with "mergear PR #17"; `gh pr checks 17` was green (Jest + GitGuardian), `gh pr merge 17 --merge` landed it as `ec72e3b`, and `main` local re-installed and re-tested at 40 suites / 440 tests. `main` had already advanced past the handoff's `dd8ad9e` to `17a252e` (PR #16); `feat/phone-ficha` was merged with `origin/main` at `4a49b7c` before any ficha work started, so the ficha builds on the identity instead of beside it.

L19 — User decisions for the reopened ficha, each asked as one question with ordered options: (a) the tools sheet is "Fija pero colapsable a pestañas" — it opens like the artboard and collapses to the tab strip, which removes the floating `+`; (b) "Mantener la palabra Látigo" over renaming it to the artboard's "Esparcir", because `shuffle` is the existing binding and that vocabulary already lives in the gestures, the tests and `VALID_ACTIONS`; (c) fragment prev/next and Rec live "En la hoja, junto a las acciones" rather than floating over the photo. These three answers close the open conflicts the coupling map raised.

L20 — `--rule` and the theme, resolved without new tokens or new colours: the artboard uses `--rule` as the rule colour while `phone-client/style.css` already uses `--rule` as the 2 px width, so the implementation keeps `--rule` as width and takes rule colour from the shared `--rule-color` / `--rule-soft` / `--ink`. The phone client is dark only because it never declared a theme; the direction's strategy is "campo blanco, tinta negra", so `phone-client/index.html` declares `data-theme="light"` and inherits #111111 on #f4f4f4 from `shared/theme.css`. No token is minted for the artboard's raw pixel sizes: the existing type and space scale covers them, and minting one would need the user's decision.
