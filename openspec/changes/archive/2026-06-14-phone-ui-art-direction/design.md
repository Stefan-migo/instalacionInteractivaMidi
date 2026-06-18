# Design: Phone UI Art Direction

## Technical Approach

Pure CSS art direction overhaul of `phone-client/`. An inline SVG `feTurbulence` filter applies a static paper-grain overlay via `body::after` at composited-layer cost only. A JS helper mirrors the p5 `generateTornBorder()` LCG algorithm to produce CSS `clip-path: polygon()` strings at load time (one call per container, not per frame). Design tokens on `:root` keep every visual value in one place. No new JS behavior, no build step, no framework.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Paper texture delivery | Inline SVG `<filter id="paper-texture">` via `body::after` | CSS `background-image` (extra request), JS canvas (perf overhead) | GPU-accelerated, zero network, applied once, no per-element cost |
| Torn edge generation | JS LCG function `tornClipPath()` at load time | Hardcoded CSS polygons (no variation), CSS Houdini (no Safari support) | Mirrors p5's seeded-random algorithm exactly; 24 vertices per polygon; one call per container |
| Sensor bar animation | `transform: scaleX()` + `will-change: transform` | `style.width` (triggers layout every frame) | Composited-only path; no layout or paint triggers during 30fps updates |
| Button ink stamp | `box-shadow` inset layers + `transform: rotate(var(--rotation))` | Pseudo-element overlays (more DOM) | Pure CSS, no extra elements; `:active` adds 1deg rotation for press |
| Font loading | `<link>` with `display=swap` + `<link rel=preconnect>` | `@import` in CSS (blocking), self-hosted (extra build step) | Swap display prevents blocking; preconnect reduces DNS latency |
| User texture assets | Opt-in `assets/` directory, absent = no-op | Base64-embedded (bloats HTML), required assets (fails without them) | Design works with zero custom assets; assets layer on via `mix-blend-mode: multiply` if present |

## CSS Architecture

### Design Token System

```css
:root {
  /* Colors */
  --color-bg: #f5e6c8;
  --color-text: #1a1a1a;
  --color-accent: #8b2c24;
  --color-accent-hover: #6e201a;
  --color-surface: rgba(245, 230, 200, 0.9);
  --color-muted: #8b7d6b;
  --color-border: #3a2a1a;
  --color-success: #2d6a4f;
  --color-error: #8b2c24;

  /* Typography */
  --font-heading: 'Playfair Display', Georgia, serif;
  --font-body: 'Courier Prime', 'Courier New', monospace;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* Borders — intentionally no border-radius */
  --border-ink: 1px solid var(--color-border);
  --border-ink-thick: 2px solid var(--color-border);
}
```

### File Structure

```
phone-client/
├── index.html       # Modified — Fonts, SVG filter, slot display label
├── style.css        # Rewritten — tokens, paper bg, torn containers, ink buttons
├── app.js           # Minor — tornClipPath() helper, slot label text
└── assets/          # New (optional)
    ├── background.jpg
    └── ink-splatter.svg
```

## SVG Filter Design

Inline in `index.html` body, hidden via `display: none`:

```html
<svg style="display:none; position:absolute; width:0; height:0;" aria-hidden="true">
  <filter id="paper-texture" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise"/>
    <feColorMatrix type="matrix" values="
      0 0 0 0 0.96
      0 0 0 0 0.90
      0 0 0 0 0.78
      0 0 0 0.12 0
    " in="noise" result="coloredNoise"/>
    <feBlend mode="multiply" in="SourceGraphic" in2="coloredNoise"/>
  </filter>
</svg>
```

Applied once in CSS — no per-element filter cost:

```css
body::after {
  content: '';
  position: fixed; inset: 0;
  filter: url(#paper-texture);
  mix-blend-mode: multiply;
  pointer-events: none;
  z-index: 9999;
  /* Optional user texture overlay */
  background: var(--user-bg, none);
}
```

## HTML Structure Changes

```diff
 <head>
+  <link rel="preconnect" href="https://fonts.googleapis.com">
+  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
+  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
   <link rel="stylesheet" href="/phone-client/style.css">
 </head>
 <body>
+  <!-- SVG filter hidden -->
+  <svg style="display:none;position:absolute;width:0;height:0;" aria-hidden="true">…</svg>
   <div id="app">
     <header>
       <div class="status-row">
         <span class="slot-badge" id="slot-badge">—</span>
+        <span class="slot-label">SLOT</span>
         <span class="connection-status" id="status-dot">●</span>
         <span class="connection-text" id="status-text">Desconectado</span>
       </div>
     </header>
     <div id="permission-screen" class="screen torn-container">
-      <button id="permission-btn" class="btn-primary">Activar sensores</button>
+      <button id="permission-btn" class="ink-btn">Activar sensores</button>
     </div>
     <div id="dashboard" class="screen hidden">
       <div class="actions-grid">
-        <button class="action-btn" data-action="record">🎙 Grabar gesto</button>
+        <button class="action-btn stamp-btn" data-action="record"><span class="stamp-icon">🎙</span> Grabar gesto</button>
         … (same pattern for all buttons)
       </div>
       <div class="sensors torn-container">
```

Key structural changes:
1. **Preconnect + Google Fonts** in `<head>`
2. **Inline SVG filter** as first child of `<body>`
3. **`.torn-container` class** on permission screen and sensors container (JS applies clip-path)
4. **`.ink-btn`** replaces `.btn-primary`
5. **`.stamp-btn`** replaces `.action-btn` (icons wrapped in `<span class="stamp-icon">`)
6. **Slot label** added next to badge
7. **Emoji icons** stay in HTML but get decorative stamp styling

## Component Layout Design

| Component | CSS Approach | Key Properties |
|---|---|---|
| **Body background** | `background: var(--color-bg)` + `body::after` with SVG filter + `mix-blend-mode: multiply` | Fixed overlay, z-index 9999, pointer-events none |
| **Header / Slot badge** | Flex row; badge uses `box-shadow` stamp with slight rotation; `--font-heading` for slot number | `box-shadow: 1px 1px 0 var(--color-border), 2px 2px 0 rgba(0,0,0,0.1)` |
| **Permission screen** | Centered flex column; card uses `clip-path` via `torn-container`; ink-stamp button | `gap: var(--space-lg); padding: var(--space-xl)` |
| **Action buttons** | CSS grid `1fr 1fr 1fr` (unchanged); each button gets ink-stamp treatment: `box-shadow` inset, rotated `-1deg` to `1deg`, `mix-blend-mode: multiply` on icon | `box-shadow: inset 0 0 0 1px var(--color-border); rotate: var(--stamp-rotation, 0deg)` |
| **Lock button** | Same grid cell; locked state toggles `border-color` to amber, adds ink overlay | `border-color: #a16207; box-shadow: inset 0 0 0 2px #a16207` |
| **Sensor bars** | Analog gauge: thin frame (`border-ink`), fill uses `transform: scaleX(var(--fill))` with `transform-origin: left`; no `border-radius` anywhere | `transform: scaleX(0.5); will-change: transform; transition: transform 0.05s linear` |
| **Connection dot** | `color: var(--color-success)` when connected, `var(--color-error)` when disconnected; no glow/pulse — period-appropriate static ink indicator | `font-size: 1.5rem` |

### Sensor Bar Detail

The current `style.width` approach triggers forced layout every frame. Replace with composited transform:

```css
.sensor-fill {
  transform-origin: left;
  will-change: transform;
  transition: transform 0.05s linear;
  height: 100%;
  background: var(--color-accent);
}

/* JS sets this: */
/* sensorFill.style.transform = 'scaleX(' + ratio + ')'; */
```

In `app.js`, update the sensor handlers:
```js
accelBar.style.transform = `scaleX(${total})`;
```

No `width` calculations, no layout thrashing.

## Torn Edge Strategy

A JS function in `app.js` mirrors the p5 `generateTornBorder()` LCG algorithm to produce CSS `clip-path: polygon()` strings:

```js
function tornClipPath(segments, jitter, seed) {
  const rng = ((s) => () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff))(seed);
  const pts = [];
  // Top edge (left→right)
  for (let i = 0; i < segments; i++)
    pts.push(`${((i / segments) * 100 + (rng() - 0.5) * jitter).toFixed(1)}% ${((rng() - 0.5) * jitter / 2).toFixed(1)}%`);
  // Right edge (top→bottom)
  for (let i = 0; i < segments; i++)
    pts.push(`${(100 + (rng() - 0.5) * jitter / 2).toFixed(1)}% ${((i / segments) * 100 + (rng() - 0.5) * jitter).toFixed(1)}%`);
  // Bottom edge (right→left)
  for (let i = 0; i < segments; i++)
    pts.push(`${((1 - i / segments) * 100 + (rng() - 0.5) * jitter).toFixed(1)}% ${(100 + (rng() - 0.5) * jitter / 2).toFixed(1)}%`);
  // Left edge (bottom→top)
  for (let i = 0; i < segments; i++)
    pts.push(`${((rng() - 0.5) * jitter / 2).toFixed(1)}% ${((1 - i / segments) * 100 + (rng() - 0.5) * jitter).toFixed(1)}%`);
  return `polygon(${pts.join(', ')})`;
}
```

Applied at DOM ready:
```js
// 6 vertices/side × 4 sides = 24 vertices total
document.querySelectorAll('.torn-container').forEach((el, i) => {
  el.style.clipPath = tornClipPath(6, 3, 1918 + i);
});
```

- **Segments**: 6 per side (24 total vertices) — lighter than p5's 32/side for mobile perf
- **Jitter**: 3% — subtle irregularity, keeps containers readable
- **Seed**: `1918 + index` — deterministic but varied per container
- **Containers**: `.torn-container` class on permission screen + sensors `div` (max 2-3 elements)

No `overflow: hidden` needed — clip-path clips naturally.

## Responsive / Mobile Considerations

| Concern | Solution |
|---|---|
| Viewport | Already set: `width=device-width, initial-scale=1, user-scalable=no` |
| Font sizes | `rem` throughout; `body { font-size: 16px }` for base |
| Touch targets | All buttons ≥44px (action buttons are ~100×44px with padding) |
| Safe areas | `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)` on `body` |
| No hover | All interactive states use `:active` only; `:hover` is explicitly NOT styled |
| Max width | `#app { max-width: 420px }` unchanged — comfortable one-handed reach |
| Readability | Body text at `var(--font-size-sm)` (14px) with `line-height: 1.5`; contrast ≥4.5:1 on all text |

## Performance Strategy

| Concern | Strategy |
|---|---|
| SVG filter | Single static `body::after` overlay — GPU-composited, no repaints. NOT applied per-element |
| clip-path | 2-3 elements × 24 vertices, set once on load. Never animated. `will-change: transform` on containers |
| Sensor bars | `transform: scaleX()` only — composited path, no layout or paint. `will-change: transform` set on `.sensor-fill` |
| Fonts | `display=swap` with `preconnect` — FOUT is acceptable (fallback serif/monospace fits the aesthetic) |
| User assets | Loaded as `background-image` on `body::after` only if file exists; CSS variable `var(--user-bg, none)` makes it absent-safe |
| JS cost | `tornClipPath()` called 2-3 times on DOMContentLoaded only; no interval, no animation |
| Layout thrash | Zero writes to `width`, `height`, `padding`, `margin`, `top`, `left` during sensor updates |

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Visual | Paper texture renders on iOS Safari 15+, Android Chrome 90+ | Manual — open phone-client on real devices, verify `body::after` filter |
| Visual | Torn clip-path on permission screen and sensors container | Manual — inspect computed `clip-path` in devtools |
| Visual | Ink-stamp button states (`:active`, `.locked`) | Manual — tap each button, verify visual feedback |
| Visual | Font loading with fallback visible during load | Manual — throttled network tab, verify FOUT looks intentional |
| Performance | Sensor bar updates at 30fps | DevTools Performance tab — no forced layout/reflow entries |
| Accessibility | Contrast ratio ≥4.5:1 for all text | Manual — Lighthouse audit or contrast checker |
| Regression | All buttons functional after CSS rewrite | Manual — tap every action button, verify WebSocket messages |
| Regression | Permission flow unaffected | Manual — reload, grant sensors, verify dashboard appears |

## Open Questions

None — all technical decisions resolved in exploration and confirmed here.
