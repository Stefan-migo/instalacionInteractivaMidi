# Tasks: p5-collage-visual-enhancements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–420 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Rotation + Image Framing | PR 1 | ~120 lines; tests included; independent |
| 2 | Intensity + Borders + Background | PR 2 | ~280 lines; depends on PR 1 |

## Phase 1: Rotation & Controls

- [x] 1.1 control-panel.js — Set rotation slider `min="-180"` `max="180"`; signed value in `handlePanelInput()`
- [x] 1.2 sketch.js — Remove 0-360 normalization in `handleAction('rotation')` (store payload.value verbatim)
- [x] 1.3 sketch.js — State migration in `showPerCellEditor()`: normalize stored rotation > 180 to −180..+180
- [x] 1.4 Test: rotation slider accepts signed range; stored values normalize to −180..+180 boundary

## Phase 2: Image Framing

- [x] 2.1 cell-renderer.js — `drawImg()`: compute object-fit cover source rect via `Math.max(w/iw, h/ih)` + centered offset
- [x] 2.2 cell-renderer.js — Swap single-arg `drawImage` for 9-arg crop variant `(img, sx, sy, sw, sh, −w/2, −h/2, w, h)`
- [x] 2.3 Test: extreme aspect ratios (655×1024 portrait, 3915×2455 wide) render without stretch

## Phase 3: Intensity Slider

- [x] 3.1 background-texture.js — Scale element alpha × intensity (0.0–1.0): fibers, grain, spots, dust ranges
- [x] 3.2 background-texture.js — Scale vignette darkness: `t * t * 18 * intensity`
- [x] 3.3 control-panel.js — Add 80ms debounce timer to noise-intensity handler (clearTimeout + setTimeout)
- [x] 3.4 config.js — Adjust `backgroundIntensity` defaults if needed for backward compat
- [x] 3.5 Test: texture at intensity 0.0 (invisible), 0.5 (half-alpha), 1.0 (full alpha + vignette)

## Phase 4: New Border Styles

- [x] 4.1 border-renderer.js — `deckled-edge`: LCG jitter 3–8px on inner edge; outer edge straight
- [x] 4.2 border-renderer.js — `double-line`: two concentric rects (outer 2px, inner 1px), 6px gap, α=0.4
- [x] 4.3 border-renderer.js — `shadow-box`: 8px fill `#2a1f14` + 4px drop shadow bottom-right
- [x] 4.4 border-renderer.js — `film-sprocket`: black bars top/bottom (12% h) + 4px holes every 20px
- [x] 4.5 border-renderer.js — Register all 4 new styles in `borderStyleMap`
- [x] 4.6 config.js — Expand `borderStyleMap` defaults to include all 9 styles
- [x] 4.7 Test: each new style renders cleanly for known cell dimensions (no gaps, no throw)

## Phase 5: Background Enhancement

- [x] 5.1 background-texture.js — `scanlines` layer: alternating 1px horizontal lines, 4px spacing, α=0.02–0.05
- [x] 5.2 background-texture.js — `watercolor` layer: noise-placed blurred circles r=40–120, warm sepia tones, α=0.01–0.03
- [x] 5.3 background-texture.js — `halftone` layer: dot grid 1–4px dia at 45°, spacing proportional to density, α=0.05–0.15
- [x] 5.4 background-texture.js — Compose new layers over base texture in render pipeline
- [x] 5.5 config.js — Add `scanlines`, `watercolor`, `halftone` to `canvasBgStyle` options
- [x] 5.6 index.html — Add CSS body classes for new `canvasBgStyle` options
- [x] 5.7 Test: each layer renders composited; unknown style falls back to default with no extra layer
