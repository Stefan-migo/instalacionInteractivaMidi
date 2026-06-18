# Proposal: p5-collage-vintage-aesthetic

## Intent

The current p5-collage renders a rigid 5×6 bento grid with uniform cells. The installation feels mechanical, not atmospheric. We need overlapping, rotated images with vintage textures, historical filters (sepia, cyanotype), and varied border styles — turning the collage into an immersive period artifact that matches the 1918 Reforma theme. The reference project (`tempExample/p5-vintage-collage-studio/`) proves the visual direction works.

## Scope

### In Scope
- 6 layout presets (scatter, spiral, polaroid-stack, neat-grid, vignette, random) slot-aware — positions are percentage-based, computed per active slot set
- Per-image CSS filter system via `drawingContext.filter`: sepia, vintage, cyanotype, grayscale, polaroid, none
- 5 border styles: torn (keep existing LCG + extend to new geometry), polaroid, stamp, gold, minimal — rendered in p5 draw calls
- Background texture: p5 noise fibers + dust particles (from reference `VintageCanvas.tsx`)
- Per-image blend mode (multiply, screen, overlay, difference) preserved from existing code
- Config-driven preset switching (exposed as a new action type `set-layout` from phone)
- Bring-to-front via zIndex manipulation on click/tap

### Out of Scope
- No React migration (pure p5.js stays)
- No drag-and-drop repositioning on projector (positions are layout-driven)
- No new phone-client UI controls for border/filter selection (future change)
- No image caption/title overlay rendering (reference's `CollageItem` title bar)
- No drawing tools (brush, charcoal, stamps — those are ref app-specific)

## Capabilities

### New Capabilities
- `collage-layout-presets`: 6 preset generators producing percentage-based positions for active slots, including zIndex sorting and rotation
- `collage-image-filters`: per-image CSS filter strings applied via `drawingContext.filter` during draw
- `collage-border-styles`: 5 border rendering functions in p5 (torn extended, polaroid, stamp, gold, minimal)
- `collage-background-texture`: p5 noise fiber + dust particle layer drawn behind all cells

### Modified Capabilities
- None — the three existing specs (`phone-style`, `phone-ux`) are phone-client only and unaffected

## Approach

Replace `AdaptiveLayout` with a `LayoutPresetEngine` that generates per-slot positions for active slots. Each preset (scatter, spiral, etc.) maps slot count to percentage-based (x, y, w, h, rotation, scale, zIndex). Cell position updates fire through the same `renderer.updateCellPosition()` interface.

Filters: extend `drawImg()` to accept a `filterType` param, set `drawingContext.filter` before `drawImage()`, reset after. Border styles: add `drawBorder()` function per style in a new module `border-renderer.js`. Torn border reuses the LCG algorithm; others use p5 primitives (rects, strokes, fills, decorative elements). Background texture: p5 `noLoop()` canvas layer with seeded `random()` for fibers and dust, composited before cell draws.

Config: add `preset`, `filterMap`, `borderStyleMap` to `CONFIG`. Add a `set-layout` action to bridge protocol for preset switching.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `p5-collage/config.js` | Modified | Add `preset`, `filterMap`, `borderStyleMap` defaults |
| `p5-collage/adaptive-layout.js` | Replaced | Remove bento grid logic, replaced by `layout-preset-engine.js` |
| `p5-collage/layout-preset-engine.js` | New | 6 preset generators, slot-aware position computation |
| `p5-collage/cell-renderer.js` | Modified | `drawImg()` accepts `filterType` param; add `getCombinedFilters()` |
| `p5-collage/border-renderer.js` | New | 5 render functions: torn, polaroid, stamp, gold, minimal |
| `p5-collage/background-texture.js` | New | p5 noise fiber + dust layer generator |
| `p5-collage/sketch.js` | Modified | Add background layer draw, preset switching, bring-to-front |
| `p5-collage/index.html` | Modified | Add script tags for new modules |
| `tests/` | Modified | 4-6 new test files for presets, filters, borders, background |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `drawingContext.filter` performance falloff with 30+ cells | Medium | Cache filter strings, batch reset; consider offscreen canvas if needed |
| Layout jumps when phone connects/disconnects (presets recalc all positions) | Medium | Smooth transitions via existing crossfade system; recalc only positions, keep image/state |
| Backward compat — old phones sending existing actions still work | Low | Preserve all existing action handlers; `set-layout` is additive |
| Background texture impact on 30fps render loop | Low | Pre-render to offscreen graphics buffer, composite once per frame |

## Rollback Plan

Revert the single `p5-collage/` commit: `git revert <commit-hash>`. The bridge, phone-client, and images are untouched. If partial revert needed: keep `border-renderer.js` and `layout-preset-engine.js` (additive), revert `sketch.js` and `config.js` to restore old layout path.

## Dependencies

- Existing p5.js CDN (1.9.0) — no upgrade needed; `drawingContext.filter` available since Canvas2D API
- No npm changes required

## Success Criteria

- [ ] All 6 presets render correctly with 1, 5, 15, and 30 active slots
- [ ] Each filter type (sepia, vintage, cyanotype, grayscale, polaroid, none) visibly changes image appearance
- [ ] All 5 border styles render without visual artifacts at any slot count
- [ ] Background texture layer renders behind all cells at ~0.5ms per frame
- [ ] All existing Jest tests pass (no regressions)
- [ ] `set-layout` action switches presets in <100ms
- [ ] Phone connect/disconnect triggers smooth position recalculation (no visible jumps)
