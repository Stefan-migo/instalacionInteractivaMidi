# Tasks: p5-collage-vintage-aesthetic

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550-700 add + ~210 del = ~760-910 total |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1: LayoutPresetEngine (~280 add, ~208 del) | PR2: Visual render (~410 add) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | LayoutPresetEngine replaces AdaptiveLayout | PR 1 | Base: main. No visual changes. Tests. |
| 2 | Filters, borders, background, wiring | PR 2 | Base: main (after PR1). Visual enhancements. |

## Backward Compatibility

All new actions additive. Existing actions (cycle-next/prev, shuffle, flipH/V, opacityUp/Down, lock/unlock, blend-mode) unaffected. Bridge and phone-client unchanged.

## Phase 1: Foundation — LayoutPresetEngine

- [x] 1.1 Config: add `defaultPreset`, `presetList` to `config.js`
- [x] 1.2 Module: create `layout-preset-engine.js` — `LayoutPresetEngine` class with 6 presets (scatter, spiral, polaroid-stack, neat-grid, vignette, random); returns `[{slot,x,y,w,h,rotation,scale,zIndex}]`
- [x] 1.3 DeviceManager: constructor accepts `LayoutPresetEngine`; `_recalculateLayout()` delegates to engine
- [x] 1.4 Sketch: init `LayoutPresetEngine` instead of `AdaptiveLayout`
- [x] 1.5 HTML: replace `adaptive-layout.js` script ref with `layout-preset-engine.js`
- [x] 1.6 Delete `adaptive-layout.js` and its test file

## Phase 2: Visual Rendering — Filters + Borders + Background

- [x] 2.1 Config: add `filterMap`, `borderStyleMap`, `noiseIntensity`, `canvasBgStyle` to `config.js`
- [x] 2.2 Module: create `border-renderer.js` — `drawBorder(state, p, style)` with 5 styles (torn, polaroid, stamp, gold, minimal)
- [x] 2.3 Module: create `background-texture.js` — seeded p5 noise fibers + dust particles, pre-rendered to offscreen `createGraphics()` buffer
- [x] 2.4 Cell-renderer: add `getCombinedFilters(type)` returning filter string; `drawImg()` accepts `filterType`, sets `drawingContext.filter` before `drawImage()`, resets to `'none'` after
- [x] 2.5 Cell-renderer: `drawCell()` calls `drawBorder()` from new module before final `pop()`
- [x] 2.6 HTML: add script tags for `border-renderer.js`, `background-texture.js`

## Phase 3: Wiring — sketch.js actions + bring-to-front

- [x] 3.1 Sketch: draw background texture at start of `draw()` (behind all cells) via offscreen buffer `image()`
- [x] 3.2 Sketch: `mousePressed()`/`touchStarted()` bring-to-front — set `zIndex = maxZ + 1`, re-sort `activeSlots`
- [x] 3.3 Sketch: wire 6 `set-layout-*` actions → `LayoutPresetEngine.recompute()`
- [x] 3.4 Sketch: wire `"filter-next"`/`"filter-prev"` actions → cycle `cellStates[slot].filterType`
- [x] 3.5 Sketch: wire `"border-next"`/`"border-prev"` actions → cycle `cellStates[slot].borderStyle`

## Phase 4: Tests — RED → GREEN → REFACTOR

- [x] 4.1 Unit: `LayoutPresetEngine#compute()` — 6 presets × 4 slot counts (1,5,15,30); all positions within [0,0,1920,1080]; empty slots → []
- [x] 4.2 Unit: `getCombinedFilters()` — all 6 types return expected filter strings; `'none'` returns `''`
- [x] 4.3 Unit: `drawBorder()` — 5 styles render without throwing; torn matches existing LCG output
- [x] 4.4 Unit: `drawBackgroundTexture()` — seeded runs deterministic; zero intensity hides layer
- [x] 4.5 Integration: preset switch via `DeviceManager` — `cellStates[slot].pos` updates, per-cell state preserved
- [x] 4.6 Regression: `npm test` — all tests pass, 0 failures
