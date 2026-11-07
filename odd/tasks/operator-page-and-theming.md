# Operator page and system theming

Feature branch: `feat/operator-page`. Goal: move every projector control out of the collage into its own `/operator/` page on the same machine, and give the whole interface a dark/light theme with dark as the default.

## Specs

S1 — Invert the palette: "podriamos cambiar el orden de los colores. me gustaria que sea blanco sobre negro. no negro sobre blanco. puede ser? o quizas agregarle la opcion de light mode y dark mode."

S2 — Separate the controls from the artwork: "me gustaria agregar un nuevo path. para mover los projector controls asi no estan en el collage."

S3 — The theme control lives with the controls: "ahi tambien debe estar el toggle button para cambiar el color theme entre light y dark mode."

S4 — Location decision: "Misma máquina, otra ventana". The operator page runs in the same browser as the collage, so windows synchronise through the browser. No bridge protocol change, no new WebSocket message types, no cross-device control.

S5 — Sidebar decision: "Eliminarla del collage". `#control-panel` and `#panel-toggle` leave the collage page. The projector window shows the collage and nothing else. The collage's `#floating-bar` also leaves, because its four actions (rotate left/right, bring to front, hide) are controls drawn on the artwork; they move to the operator page so nothing is lost.

S6 — Default theme: "Oscuro por defecto". White ink on a black field. This matches `Logo/MIDI-Brand-Pack/03-Web/site.webmanifest`, which already declares `theme_color` and `background_color` as `#000000`.

S7 — Theme scope: "Todo el sistema", one preference. Within one browser the choice applies to the collage and operator windows live. The visitor phone client defaults to dark and applies a stored preference if one exists; it carries no toggle, because S3 puts the toggle on the operator page. Honest limit, stated to the user and not silently ignored: phones are separate devices, so the operator's switch does not flip 30 visitors' screens. Doing that needs a bridge broadcast with role gating, which S4 explicitly rules out of this card.

S8 — Nothing regresses: `npm test` stays green, the bridge keeps serving `/health`, `/api/layout`, `/api/manifest`, `/images/content/*`, `/phone-client/` and `/p5-collage/`, and the phone client's 46 JS id targets keep resolving. The protocol between phones, bridge and collage is unchanged.

## Contracts (fixed here so implementation cannot drift)

### Tokens — `shared/theme.css`
One file, linked by all three pages, declaring the same semantic names in both directions:

| Token | Dark (default) | Light |
|---|---|---|
| `--ink` | `#ffffff` | `#000000` |
| `--paper` | `#000000` | `#ffffff` |
| `--quiet` | `rgba(255,255,255,.60)` | `rgba(0,0,0,.58)` |
| `--rule-color` | `#ffffff` | `#000000` |
| `--rule-soft` | `rgba(255,255,255,.22)` | `rgba(0,0,0,.22)` |

`--ink` is always the foreground and `--paper` always the surface, so inverting is swapping values, never renaming. Dark is declared on `:root`; light is declared on `:root[data-theme="light"]`. No other colour may appear anywhere.

### Theme runtime — `shared/theme.js`
Plain script with the repository's CommonJS shim. Applies `document.documentElement.dataset.theme`, reads and writes `localStorage['midi-theme']`, defaults to `dark`, and publishes changes on a `BroadcastChannel` named `midi-theme` as `{ theme: 'dark' | 'light' }`. Exposes `getTheme`, `setTheme`, `toggleTheme`, `onThemeChange`. Storage and channel are injectable so it is testable without a DOM.

### Control channel — `midi-operator-cmd` and `midi-operator-state`
The operator page cannot call the collage's lexicals, so both sides speak a flat message contract on `BroadcastChannel`.

Operator → collage, `midi-operator-cmd`:
`setPreset{preset}` · `setScatterScale{value}` · `setNoiseIntensity{value 0..100}` · `selectCell{slot|null}` · `setFilter{slot,value}` · `setBorder{slot,value}` · `setRotation{slot,value}` · `setScale{slot,value}` · `setOpacity{slot,value}` · `toggleVisibility{slot}` · `rotateSelected{delta}` · `bringToFront{slot}` · `hideCell{slot}` · `esparcirTodo` · `requestState`

Collage → operator, `midi-operator-state`:
`{ state, preset, scatterScale, noiseIntensity, selectedSlot, connected, total, cells:[{slot, imageFile, filterType, borderStyle, rotation, scale, opacity}] }`

The collage publishes state after every applied command, on `requestState`, and on a 1 s heartbeat while any operator window is present.

### Routes
`/operator/` → `operator/`, `/shared/` → `shared/`, both copying the existing `/p5-collage/` route shape in `bridge/index.js` and its 404 behaviour.

## Tasks

| ID | Task | Specs | Route | Commit |
|----|------|-------|-------|--------|
| T1 | Feature document, Engram mirror, visible todo | S1-S8 | inline | (folded into U1) |
| T2 | `shared/theme.css` + `shared/theme.js` with tests; link from the phone client | S1, S6, S7 | writer | U1 |
| T3 | Phone client: drop its local `:root`, consume the shared tokens, verify dark renders | S1, S6, S7 | writer | U2 |
| T4 | `/operator/` page: theme toggle, presets, scatter, noise, catalog, per-cell editor, esparcir, floating-bar actions, connection state | S2, S3, S5 | writer | U3 |
| T5 | Bridge: `/operator/` and `/shared/` routes, with a test that fails before they exist | S2, S8 | writer | U4 |
| T6 | Collage: `operator-link.js`, apply commands to the live globals, publish state; remove `control-panel.*` and `#floating-bar`; theme its inline chrome | S2, S5, S7 | writer | U5 |
| T7 | Verify: suite green, all routes 200, both windows sync, dark is the default | S8 | verify | (folded into U5) |

## Log

L1 — User request, verbatim: "ok ahora si esta funcionando. tengo una pregunta. podriamos cambiar el orden de los colores. me gustaria que sea blanco sobre negro. no negro sobre blanco. puede ser? o quizas agregarle la opcion de light mode y dark mode. tambien me gustaria agregar un nuevo path. para mover los projector controls asi no estan en el collage. ahi tambien debe estar el toggle button para cambiar el color theme entre light y dark mode."

L2 — Four decisions, chosen by the user: location "Misma máquina, otra ventana"; sidebar "Eliminarla del collage"; default "Oscuro por defecto"; scope "Todo el sistema". Basis for S4-S7.

L3 — Evidence, integration map: the panel reaches the sketch by mutating lexical globals and calling p5's `redraw()` (`control-panel.js:413-442`), never by events or messaging. Those bindings (`CONFIG` at `config.js:1`, `redraw`, `selectedSlot` at `sketch.js:4`) are script-scope of the collage document and are unreachable from another page. This is why S2 needs a channel at all, and why a plain "move the file" is impossible.

L4 — Evidence, theming: both stylesheets keep every colour literal inside `:root` (`phone-client/style.css:1-35`, `p5-collage/control-panel.css:1-8`), so inversion is a value swap. The exception is `p5-collage/index.html:16-58`, whose inline `<style>` hardcodes the surface, and which must be tokenised for S7.

L5 — Evidence, testability: no file uses `localStorage`, `sessionStorage` or `BroadcastChannel`, and no test stubs them (tests `require()` modules and stub p5 globals; no jsdom). New runtime code therefore ships as plain scripts with the CommonJS shim and injectable dependencies, so it stays testable in the existing pattern.

L6 — Scope boundary recorded: S5 also removes `#floating-bar` from the collage. It draws four controls over the artwork, which contradicts "el proyector solo muestra el collage"; its actions move to the operator page, so no capability is lost. If the user wants it back on the canvas, it returns as its own card.

L7 — Native review disposition, explicit: the user answered "b." to the choice between enabling the symlink capability and leaving the candidate unreviewed, then asked for "push, pr, merge y limpieza". The candidate is therefore left unreviewed by explicit decision, not by omission. Cause of the block, for the record: `candidate-view-preflight-blocked` / `symlink-materialization-failed` on three successive candidates (the session is not elevated and Windows Developer Mode is off), so no native lineage could be created in any of them. Evidence standing in its place: 25 suites / 343 tests, routes verified live with correct content types, 15/15 commands on both ends of the channel, contracts grepped, and a regression test pinning the mark wiring that shipped broken once.
