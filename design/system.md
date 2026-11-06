# MIDI Ficha — system tokens

The current identity is MIDI Ficha: two colours, orthogonal geometry, zero radius and no elevation. The authority is `Logo/MIDI-Brand-Pack/` (especially `Logo/MIDI-Brand-Pack/05-Guia/LEEME.md`). Sources below are the runtime stylesheets; values not declared there are not project tokens.

## 1. Colour

| Token | Value | Source path |
|---|---|---|
| `--ink` | `#000000` | `phone-client/style.css`, `p5-collage/control-panel.css` |
| `--paper` | `#ffffff` | `phone-client/style.css`, `p5-collage/control-panel.css` |
| `--quiet` | `rgba(0, 0, 0, 0.58)` | `phone-client/style.css`, `p5-collage/control-panel.css` |
| `--rule-color` | `#000000` | `phone-client/style.css`, `p5-collage/control-panel.css` |
| `--rule-soft` | `rgba(0, 0, 0, 0.22)` | `phone-client/style.css`, `p5-collage/control-panel.css` |

`--ink` and `--paper` are the two brand colours. `--quiet` and `--rule-soft` are the ONLY derived neutrals: no third brand colour exists, and pure `#000`/`#FFF` alone leaves no hierarchy or AA-compliant muted level. The basis is the pack rule, quoted: “Negro #000000 sobre fondos claros; blanco #FFFFFF sobre fondos oscuros. Para fotos, usar un panel liso con contraste suficiente. No estirar, girar, aplicar sombras, contornos ni recolorear sin definir antes una paleta de marca.” Source path: `Logo/MIDI-Brand-Pack/05-Guia/LEEME.md`.

## 2. Typography

| Token | Value | Source path |
|---|---|---|
| `--font-display` | `ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace` | `phone-client/style.css`, `p5-collage/control-panel.css` |
| `--font-text` | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | `phone-client/style.css`, `p5-collage/control-panel.css` |
| `--font-size-xs` | `0.6875rem` | both stylesheets |
| `--font-size-sm` | `0.75rem` | both stylesheets |
| `--font-size-md` | `0.875rem` | both stylesheets |
| `--font-size-lg` | `1.0625rem` | `phone-client/style.css` only |
| `--font-size-xl` | `1.5rem` | `phone-client/style.css` only |
| `--font-size-xxl` | `1.875rem` | `phone-client/style.css` only |
| `--tracking` | `0.14em` | both stylesheets |
| `--tracking-tight` | `-0.015em` | `phone-client/style.css` only |

Weights used: `400` (normal/default) and `700` (explicit bold). There are NO webfonts and NO external URLs in either stylesheet; the system uses local/system stacks. This replaces the former Google Fonts dependency. The pack says, verbatim, “No se identifico ni sustituyo la tipografia.” Source path: `Logo/MIDI-Brand-Pack/05-Guia/LEEME.md`.

## 3. Spacing / geometry

| Token | Value | Source path |
|---|---|---|
| `--hair` | `1px` | both stylesheets |
| `--rule` | `2px` | both stylesheets |
| `--space-3xs` | `0.125rem` | `phone-client/style.css` only |
| `--space-2xs` | `0.25rem` | both stylesheets |
| `--space-xs` | `0.375rem` | both stylesheets |
| `--space-sm` | `0.5rem` | both stylesheets |
| `--space-md` | `0.75rem` | both stylesheets |
| `--space-lg` | `1rem` | both stylesheets |
| `--space-xl` | `1.5rem` | `phone-client/style.css` only |
| `--space-2xl` | `2rem` | `phone-client/style.css` only |
| `--radius` | `0` | both stylesheets |

No shadow token exists, and there are no box-shadow declarations: elevation is not part of the identity. The legacy system's five shadow literals are gone. Source paths: `phone-client/style.css`, `p5-collage/control-panel.css`.

## 4. Motion

| Token/rule | Value | Source path |
|---|---|---|
| `--dur-fast` | `120ms` | both stylesheets |
| `--dur-base` | `200ms` | `phone-client/style.css` only |
| Reduced motion | `@media (prefers-reduced-motion: reduce)`: animations, transitions and smooth scrolling disabled | both stylesheets; phone also sets `scroll-behavior: auto` |

## 5. Layers

| Token | Value | Source path |
|---|---:|---|
| `--z-base` | `1` | `phone-client/style.css` |
| `--z-overlay` | `100` | `phone-client/style.css` |
| `--z-panel` | `1000` | `p5-collage/control-panel.css` |
| `--z-toggle` | `1001` | `p5-collage/control-panel.css` |

Actual declared ladder and literal layers: phone `#app` 1 → touch overlay 5 → rec/gesture 20 → tools 30 → photo actions 40 → header 50 → hint 60 → gallery 90 → practice 95 → overlay 100; page texture `body::after` 9999. Operator: floating bar 999 → panel 1000 → toggle 1001. Source paths: `phone-client/style.css`, `p5-collage/control-panel.css`; floating bar is `p5-collage/control-panel.css`.

## 6. Components

| Selector | Purpose | Where it appears | Source path |
|---|---|---|---|
| `.screen`, `.splash-content`, `.permission-content` | centered screen and content layout | splash, permission | `phone-client/style.css` |
| `.ink-btn`, `.stamp-btn`, `.inline-btn` | outlined/inverted actions and tool buttons | splash, permission, help, gesture tools | `phone-client/style.css` |
| `.permission-error`, `.error-text` | permission failure block | permission | `phone-client/style.css` |
| `header`, `.slot-badge`, `.connection-status` | slot and connection HUD | dashboard | `phone-client/style.css` |
| `#photo-frame`, `.torn-container`, `#cell-image` | photo display/frame | dashboard | `phone-client/style.css` |
| `#photo-actions`, `.photo-action-btn`, `#touch-overlay` | photo action and touch input | dashboard | `phone-client/style.css` |
| `.tools-panel`, `.tools-handle`, `.actions-grid`, `.button-pair` | sliding tool sheet and action layout | dashboard | `phone-client/style.css` |
| `.control-group`, `.slider-label`, `.slider-value`, `.vintage-slider` | labelled range control | tools | `phone-client/style.css` |
| `.rec-indicator`, `.gesture-status` | recording/gesture status chips | dashboard | `phone-client/style.css` |
| `.wizard-overlay`, `.wizard-step`, `.duration-btn`, `.wizard-countdown-number` | gesture recording flow | gesture wizard | `phone-client/style.css` |
| `.help-overlay`, `.help-card`, `.gesture-gallery`, `.gallery-card`, `.practice-overlay`, `.practice-card` | help, gallery and practice overlays/cards | dashboard overlays | `phone-client/style.css` |
| `.hint-engine`, `.hint-text` | contextual hint | dashboard | `phone-client/style.css` |
| `#control-panel`, `#panel-toggle` | operator sidebar and toggle | projector canvas | `p5-collage/control-panel.css` |
| `#panel-header`, `#panel-body`, `.panel-section`, `.panel-section-title` | panel framing and numbered sections | operator panel | `p5-collage/control-panel.css` |
| `.preset-grid`, `.preset-btn` | layout presets | operator panel | `p5-collage/control-panel.css` |
| `.slider-row`, `.editor-row` | labelled slider/editor rows | operator panel | `p5-collage/control-panel.css` |
| `.bg-selector`, `.bg-btn` | background selection | operator panel | `p5-collage/control-panel.css` |
| `#catalog-list`, `.catalog-entry`, `.catalog-thumb`, `.catalog-title`, `.catalog-eye` | cell catalog | operator panel | `p5-collage/control-panel.css` |
| `#per-cell-editor` | selected-cell controls | operator panel | `p5-collage/control-panel.css` |
| `#esparcir-todo` | bulk scatter action | operator panel | `p5-collage/control-panel.css` |
| `#floating-bar`, `.float-btn` | canvas quick actions | projector canvas | `p5-collage/control-panel.css` |

## 7. State without colour

Connected/active states are filled squares or inverted (ink-filled, paper-text) blocks; disconnected/inactive states are outlined/empty squares. Recording is an inverted solid chip with a pulsing mark; granted/denied status uses filled versus outlined marks and explicit labels. Rule weight and fill distinguish states without introducing colour. Source paths: `phone-client/style.css`, `p5-collage/control-panel.css`.

## 8. Coupling contracts

These are behavior protections, not styling choices. Preserve queried class names (`.torn-container`, `.wizard-step`, `.duration-btn`, `.gallery-card`, `.practice-btn`, `.catalog-entry`, `.preset-btn`, `.bg-btn`, `.float-btn`) and JS-coupled IDs including `#catalog-list`, `#per-cell-editor`, `#preset-grid`, `#bg-selector`, `#editor-filter`, `#editor-border`, and related editor value IDs. Sources: `phone-client/app.js`, `p5-collage/control-panel.js`, `p5-collage/sketch.js`.

`.tools-panel.hidden` must keep `display:flex` and hide via `translateY(100%)`, not `display:none`. `--user-bg` is set by JavaScript on the body. The torn `clip-path` geometry is generated by JavaScript; do not replace it with a CSS approximation. Source paths: `phone-client/style.css`, `phone-client/app.js`.

## 9. Self-check

Every new artboard must use only `#000`/`#FFF` plus the declared neutrals; keep radius `0`; use no shadow; load no webfont; and contain no external URL. Sources: `phone-client/style.css`, `p5-collage/control-panel.css`, `Logo/MIDI-Brand-Pack/05-Guia/LEEME.md`.
