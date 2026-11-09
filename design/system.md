# MIDI — system tokens

The identity is MIDI: two colours, orthogonal geometry, zero radius, no elevation. The authority is the identity document **"Identidad MIDI.pdf"** (`E:\Proyectos\midiWeb\Docs\`) together with its logo pack, and the runtime authority is the stylesheets: a value not declared there is not a project token.

The repository also carries an older pack under `Logo/MIDI-Brand-Pack/` (gitignored) whose variant names do not match the current one (`simbolo`/`wordmark` versus `isotipo`/`cuadrado`) and whose palette is pure `#000000`/`#ffffff`. The identity document supersedes it; see §1 and §2.

**Synced from the current sources** (this board previously cited `p5-collage/control-panel.css`, which no longer exists):

- `shared/theme.css` — the five runtime colour tokens, the theme inversion, and `--mark-on-canvas`.
- `phone-client/style.css` — the type, spacing, motion and layer scales.
- `operator/operator.css` — the Operator surface grammar, which is where the routing console will live.

## 1. Colour

Default theme is **dark**; light is an explicit inversion, not the base.

| Token | Default (dark) | `[data-theme="light"]` | Source path |
|---|---|---|---|
| `--ink` | `#f4f4f4` | `#111111` | `shared/theme.css` |
| `--paper` | `#111111` | `#f4f4f4` | `shared/theme.css` |
| `--quiet` | `rgba(244,244,244,.60)` | `rgba(17,17,17,.58)` | `shared/theme.css` |
| `--rule-color` | `#f4f4f4` | `#111111` | `shared/theme.css` |
| `--rule-soft` | `rgba(244,244,244,.22)` | `rgba(17,17,17,.22)` | `shared/theme.css` |
| `--mark-on-canvas` | `#f4f4f4` | `#f4f4f4` | `shared/theme.css` |

`color-scheme` is `dark` by default and `light` under `[data-theme="light"]`, so native form controls follow the theme. `--mark-on-canvas` stays white in both themes because the p5 canvas shader is near-black regardless of UI theme; the watermark must survive it.

`--ink` and `--paper` are the two brand colours. `--quiet` and `--rule-soft` are the only derived neutrals: no third brand colour exists, and `#000`/`#FFF` alone leaves no hierarchy and no AA-compliant muted level. Pack rule, verbatim: "Negro #000000 sobre fondos claros; blanco #FFFFFF sobre fondos oscuros. Para fotos, usar un panel liso con contraste suficiente. No estirar, girar, aplicar sombras, contornos ni recolorear sin definir antes una paleta de marca." Source: `Logo/MIDI-Brand-Pack/05-Guia/LEEME.md`.

## 2. Typography

| Token | Value | Source path |
|---|---|---|
| `--font-display` | `ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace` | `phone-client/style.css` |
| `--font-text` | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | `phone-client/style.css` |
| `--font-size-xs` | `0.6875rem` | both |
| `--font-size-sm` | `0.75rem` | both |
| `--font-size-md` | `0.875rem` | both |
| `--font-size-lg` | `1.0625rem` | `phone-client/style.css` |
| `--font-size-xl` | `1.5rem` | `phone-client/style.css` |
| `--font-size-xxl` | `1.875rem` | `phone-client/style.css` |
| `--tracking` | `0.14em` | both |
| `--tracking-tight` | `-0.015em` | `phone-client/style.css` |

The **Operator surface uses monospace exclusively**: `font-family: ui-monospace, 'SF Mono', Consolas, monospace` declared directly on `body`, with `1rem` h1, `0.75rem` h2, and `0.75rem` for `p, label, output, button, select`. Source: `operator/operator.css`.

The identity names exactly two families, both monospaced, in Regular and Medium: **Roboto Mono** and **DM Mono**. They are **self-hosted** as woff2 (latin subset) in `shared/fonts/`, served by the bridge at `/shared/fonts/*.woff2` with `Content-Type: font/woff2`, so the show machine never depends on the network for its own typography. Licences (SIL OFL 1.1) sit beside the files as `OFL-roboto-mono.txt` and `OFL-dm-mono.txt`.

| Token | Value | Usage | Source path |
|---|---|---|---|
| `--font-display` | `'DM Mono', ui-monospace, …` | headings, section labels, uppercase tracking | `phone-client/style.css` |
| `--font-mono` | `'Roboto Mono', 'DM Mono', ui-monospace, …` | data, numbers, tables; the whole Operator surface | `shared/theme.css` |
| `--font-text` | system sans stack | long paragraphs only — a project choice, not a brand one | `phone-client/style.css` |

The earlier rule "no webfonts" is **superseded**: it was written when the families were unknown. Weights used are `400` and `500`. No external URL or CDN is referenced: the files are project assets.

## 3. Spacing and geometry

| Token | Value | Source path |
|---|---|---|
| `--hair` | `1px` | `phone-client/style.css` |
| `--rule` | `2px` | `phone-client/style.css` |
| `--space-3xs` | `0.125rem` | `phone-client/style.css` |
| `--space-2xs` | `0.25rem` | both |
| `--space-xs` | `0.375rem` | both |
| `--space-sm` | `0.5rem` | both |
| `--space-md` | `0.75rem` | both |
| `--space-lg` | `1rem` | both |
| `--space-xl` | `1.5rem` | `phone-client/style.css` |
| `--space-2xl` | `2rem` | `phone-client/style.css` |
| `--radius` | `0` | `phone-client/style.css` |

`operator/operator.css` enforces the identity globally: `* { border-radius: 0 !important; box-shadow: none !important; }`. No shadow token exists and there are no `box-shadow` declarations anywhere; elevation is not part of the identity.

Operator layout constants: `main` is `max-width: 960px`, `margin: 0 auto`, `padding: .75rem 1.5rem 3rem`; `header` uses `padding: 1rem 1.5rem` with a `2px solid var(--rule-color)` bottom edge; each `section` is separated by `1px solid var(--rule-soft)`.

## 4. Motion

| Token | Value | Source path |
|---|---|---|
| `--dur-fast` | `120ms` | `phone-client/style.css` |
| `--dur-base` | `200ms` | `phone-client/style.css` |
| Reduced motion | `prefers-reduced-motion: reduce` disables transitions, animation and smooth scrolling | both |

## 5. Layers

| Token | Value | Source path |
|---|---:|---|
| `--z-base` | `1` | `phone-client/style.css` |
| `--z-overlay` | `100` | `phone-client/style.css` |

The former `--z-panel: 1000` / `--z-toggle: 1001` ladder belonged to `p5-collage/control-panel.css` and no longer exists; the Operator page is a normal document flow. Phone literals: `#app` 1 → touch overlay 5 → rec/gesture 20 → tools 30 → photo actions 40 → header 50 → hint 60 → gallery 90 → practice 95 → overlay 100; page texture `body::after` 9999.

## 6. Components — Operator surface

These are the real selectors of the surface the routing console extends. Source: `operator/operator.css`.

| Selector | Purpose |
|---|---|
| `header`, `h1`, `header span`, `#connection` | page head; `h1` uppercase with `--tracking`; `#connection` in `--quiet`, pushed right |
| `main`, `section`, `h2` | 960px column; `h2` uppercase `.75rem` with a `--rule-color` underline and `space-between` layout for a right-side status |
| `button`, `select` | outlined control: `1px solid var(--rule-color)`, paper fill, ink text, `min-height: 2.4rem` |
| `button:hover`, `button[aria-pressed="true"]`, `[aria-current="true"]` | inverted: ink fill, paper text |
| `:focus-visible` on button/select/input/`[role="option"]` | `outline: 2px solid var(--ink)`, `outline-offset: 3px` |
| `.presets`, `.actions` | wrapped button groups, `gap: .4rem` |
| `.row`, `.range` | `grid-template-columns: 8rem 1fr` labelled rows with a soft bottom rule |
| `input[type="range"]`, `output` | full-width range with `accent-color: var(--ink)`; `output` floats right with tabular numerals |
| `#catalog`, `.catalog-row` | scrollable list (`max-height: 22rem`); rows are `3rem 1fr auto` grids, borderless with a soft rule, left-aligned |
| `#editor`, `#editor.enabled` | disabled state rendered as `opacity: .45`, enabled as `1` |
| `#theme-toggle`, `#visibility-toggle:disabled` | theme switch on the right; disabled controls at `opacity: .55` with `cursor: not-allowed` |

## 7. Components — Phone surface

| Selector | Purpose | Source path |
|---|---|---|
| `.screen`, `.splash-content`, `.permission-content` | centered screen layout | `phone-client/style.css` |
| `.ink-btn`, `.stamp-btn`, `.inline-btn` | outlined and inverted actions | `phone-client/style.css` |
| `header`, `.slot-badge`, `.connection-status` | slot and connection HUD | `phone-client/style.css` |
| `#photo-frame`, `.torn-container`, `#cell-image` | photo display | `phone-client/style.css` |
| `.tools-panel`, `.tools-handle`, `.actions-grid` | sliding tool sheet | `phone-client/style.css` |
| `.control-group`, `.slider-label`, `.slider-value` | labelled range control | `phone-client/style.css` |
| `.wizard-overlay`, `.wizard-step`, `.duration-btn` | gesture recording flow | `phone-client/style.css` |
| `.help-overlay`, `.gallery-card`, `.practice-card` | help, gallery, practice | `phone-client/style.css` |

## 8. State without colour

Connection and activity states are **filled versus outlined**, never coloured: an active indicator is a filled ink square, an inactive one is an outlined empty square, and a pressed control inverts (ink fill, paper text). Motion marks use the `--dur-fast` / `--dur-base` tokens and must stop under `prefers-reduced-motion`. Sources: `shared/theme.css`, `operator/operator.css`, `phone-client/style.css`.

## 9. Coupling contracts

Behaviour protections, not styling choices. The Operator's JavaScript queries these IDs and classes; preserve them:

`#presets`, `#scatter`, `#scatter-value`, `#noise`, `#noise-value`, `#catalog`, `#editor`, `#selected-label`, `#visibility-toggle`, `#filter`, `#rotation`, `#rotation-value`, `#scale`, `#scale-value`, `#opacity`, `#opacity-value`, `#scatter-all`, `#connection`, `#theme-toggle`; classes `.presets`, `.catalog-row`, `.row`, `.range`, `.actions`.

Source: `operator/operator.js`, `operator/index.html`.

`.tools-panel.hidden` must keep `display:flex` and hide via `translateY(100%)`, not `display:none`. `--user-bg` is set by JavaScript on the body. The torn `clip-path` geometry is generated by JavaScript; never replace it with a CSS approximation. Source: `phone-client/style.css`, `phone-client/app.js`.

## 10. Self-check

Every artboard must: use only `--ink`, `--paper`, `--quiet`, `--rule-color`, `--rule-soft` and `--mark-on-canvas`; keep `border-radius: 0`; declare no `box-shadow`; load no webfont and reference no external URL; respect `prefers-reduced-motion`; and, for Operator surfaces, use the monospace stack and the `960px` column.
