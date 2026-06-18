# Tasks: Phone UI Art Direction

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 130–190 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation

- [x] 1.1 Add `:root` CSS custom properties to `phone-client/style.css` — all design tokens (colors, typography, spacing, borders per spec)
- [x] 1.2 Add Google Fonts `<link>` preconnect + stylesheet with `display=swap` to `<head>` in `phone-client/index.html`
- [x] 1.3 Add inline SVG `<filter id="paper-texture">` (feTurbulence + feColorMatrix + feBlend) as first child of `<body>` in `phone-client/index.html`

## Phase 2: Core CSS — style.css rewrite

- [x] 2.1 Body background + `body::after` overlay: `--color-bg`, `mix-blend-mode: multiply`, `filter: url(#paper-texture)`, `pointer-events: none`
- [x] 2.2 Typography: `--font-heading` on headings, `--font-body` on body/elements; `rem` scale with `line-height: 1.5`, safe-area padding
- [x] 2.3 Header / slot badge: flex row, ink-stamp `box-shadow`, `--font-heading` bold, slight `rotate()`, `--color-accent` text
- [x] 2.4 Permission screen: centered flex column, `.ink-btn` ink-stamp style (`--color-accent` inset border, rotation), `.torn-container` class applied
- [x] 2.5 Action buttons (`stamp-btn`): 3-col CSS grid, `box-shadow: inset 0 0 0 1px var(--color-border)`, rotate -1 to 1deg, `:active` swaps to accent border, `.locked` crosshatch overlay
- [x] 2.6 Sensor bars: analog period gauge — `--color-border` 2px track, `transform-origin: left` fill via `scaleX`, `will-change: transform`, no border-radius, 8px height
- [x] 2.7 Connection status: `--color-success`/`--color-error` dot in `--font-body`, label "Conectado"/"Desconectado"
- [x] 2.8 Recording indicator: "●● Grabando" in `--font-body` `--color-error`, opacity pulse 0.4→1 over 1.5s without scale
- [x] 2.9 Gesture status: `--font-body` 0.75rem, fade-out animation (opacity 1→0 at 3s)
- [x] 2.10 Torn edge container CSS: `clip-path: polygon(...)` applied to `.torn-container` elements (header, permission card, sensors)

## Phase 3: app.js modifications

- [x] 3.1 Add `tornClipPath()` LCG function — mirrors p5 `generateTornBorder()`, 6 segments/side × 4 sides, returns `polygon(...)` string
- [x] 3.2 On DOMContentLoaded, query `.torn-container` elements and apply `tornClipPath(6, 3, 1918 + index)` to each
- [x] 3.3 Update slot badge: change `innerHTML` or structure to display slot label + number following design spec
- [x] 3.4 Replace `style.width` assignments in sensor handlers with `transform = 'scaleX(...)'` on `#accel-bar`, `#gyro-bar`, `#orient-bar`
- [x] 3.5 Remove `transition: width 0.1s` inline dependency — CSS handles transitions via `.sensor-fill`

## Phase 4: Verification

- [x] 4.1 Manual: open phone-client on iOS Safari 15+ / Android Chrome 90+, verify paper texture + grain overlay renders (Scenario 1)
- [x] 4.2 Manual: grant sensors, verify dashboard appears with ink-stamp buttons and analog sensor bars (Scenario 2)
- [x] 4.3 Manual: tap record, verify pulsing indicator + "●● Grabando" text (Scenario 3)
- [x] 4.4 Manual: disconnect WebSocket, verify dot turns `--color-error`, buttons show muted borders (Scenario 4)
- [x] 4.5 Manual: drop optional texture into `phone-client/assets/`, verify `mix-blend-mode: multiply` layering (Scenario 5)
- [x] 4.6 Manual: DevTools Performance tab — confirm no forced layout/reflow during sensor updates at 30fps
- [x] 4.7 Manual: contrast check — all text against `--color-bg` meets WCAG AA ≥4.5:1
