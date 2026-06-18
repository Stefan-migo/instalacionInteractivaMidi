# Design: p5-collage-vintage-aesthetic

## Technical Approach

Replace `AdaptiveLayout` with a preset-driven engine; extend the draw pipeline to inject filters, decorative borders, and a noise background layer — all within p5's Canvas2D API. Four independent additions, no React migration, no bridge protocol change beyond additive `set-layout` / `set-filter` / `set-border` actions.

## Architecture Decisions

### Decision: Canvas2D filter strings over CSS filters

| Option | Tradeoff |
|--------|----------|
| `drawingContext.filter` strings | Available now, no CDN change, control per-cell; must reset after each draw |
| CSS `filter` via `canvas.style` | Applies to entire canvas, can't do per-image |
| p5 shaders (WEBGL) | Requires mode change, breaks existing code |
| **Decision**: `drawingContext.filter` — reset to `'none'` after each `drawImage()` |

### Decision: Presets generate pixel coords from percentage anchors

| Option | Tradeoff |
|--------|----------|
| **Pixel coords at generation time** | Single compute pass on preset switch, deterministic per slot count |
| Percentage everywhere + translate at draw | Extra calc every frame; reference uses percentage CSS |
| **Decision**: Port reference's `generateLayout` to return `{x,y,w,h,rotation,scale,zIndex}` in pixels. Compute once on preset change or slot count change. |

### Decision: Border styles as p5 draw subroutines

Each style is a switch branch in `drawBorder(slotState, p)` — keeps draw order local, no DOM/CSS leak. Torn reuses existing LCG; polaroid/stamp/gold/minimal add rects, strokes, decorative dots/corners.

### Decision: Background texture pre-rendered to offscreen graphics buffer

Noise fibers + dust particles use seeded p5 random — deterministic per seed. Render once to `createGraphics()` buffer, composite with `image()` at start of frame. Avoids 2N draw calls per frame for N fibers.

## Data Flow

```
Phone --action("set-layout":"scatter")--> Bridge --> {type:"action",slot,action:"set-layout-scatter"} --> sketch.js
                                                                                                              │
                                                                                     handleAction(slot, "set-layout-scatter")
                                                                                                              │
                                                                                        LayoutPresetEngine.recompute(slot, 'scatter')
                                                                                                              │
                                                                                        renderer.updateCellPosition(slot, newPos)
                                                                                                              │
                                                                                              draw() loop re-reads cellStates
```

Filter/border flow:
```
sketch.handleAction(slot, "filter-next") → cellStates[slot].filterType = next index → drawFrame → getCombinedFilters(filterType) → drawingContext.filter = str → drawImage → filter = 'none'
```

Background texture flow:
```
draw() → drawBackgroundTexture(p, w, h, intensity) → offscreenGfx.clear() → seeded fibers + dust → p.image(offscreenGfx,0,0) → drawGrid()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `p5-collage/layout-preset-engine.js` | Create | `LayoutPresetEngine` class — 6 preset algorithms returning pixel-position arrays |
| `p5-collage/border-renderer.js` | Create | `drawBorder(cellState, p, config)` — switch on 5 styles, each draws decorative Canvas2D primitives |
| `p5-collage/background-texture.js` | Create | `drawBackgroundTexture(p, w, h, intensity, seed)` — seeded fiber + dust particles to offscreen buffer |
| `p5-collage/cell-renderer.js` | Modify | `drawImg()` gains `filterType` param; add `getCombinedFilters(type)`; `drawCell()` calls `drawBorder()` from new module |
| `p5-collage/sketch.js` | Modify | Init `LayoutPresetEngine` instead of `AdaptiveLayout`; add background texture draw; wire `set-layout-*` actions; bring-to-front on click |
| `p5-collage/device-manager.js` | Modify | Accept `LayoutPresetEngine` in constructor; `_recalculateLayout()` delegates to engine; `handleAction()` delegates `set-layout-*` to engine |
| `p5-collage/config.js` | Modify | Add `defaultPreset`, `filterMap`, `borderStyleMap`, `noiseIntensity`, `canvasBgStyle` |
| `p5-collage/index.html` | Modify | Add script tags for `layout-preset-engine.js`, `border-renderer.js`, `background-texture.js`; remove `adaptive-layout.js` |
| `p5-collage/adaptive-layout.js` | Delete | Replaced by `layout-preset-engine.js` |

## Interfaces / Contracts

### Cell State Extension

Current `cellStates[slot]` gains:

```js
// cell-renderer.js — inside createRenderer().initCell()
state.cellStates[slot] = {
  ...existing,
  filterType: 'none',     // added
  filterStrength: 1.0,    // added
  borderStyle: 'torn',    // added
  blendMode: 'source-over', // moved from dynamic to explicit
  blendModeIndex: 0,      // moved from dynamic to explicit
};
```

### LayoutPresetEngine Output

```js
// layout-preset-engine.js
class LayoutPresetEngine {
  constructor(canvasW, canvasH) {}
  compute(slots, preset = 'scatter')  // → [{slot, x, y, w, h, rotation, scale, zIndex}]
  setPreset(preset)                   // stores for next compute()
  getPresets()                        // → ['scatter','spiral','polaroid-stack','neat-grid','vignette','random']
}
```

### Filter String Map

```js
const FILTER_MAP = {
  sepia:      'sepia(0.85) contrast(1.1)',
  grayscale:  'grayscale(1.0) contrast(1.3)',
  cyanotype:  'sepia(0.4) saturate(1.9) hue-rotate(180deg) brightness(0.85) contrast(1.2)',
  polaroid:   'contrast(1.2) saturate(0.6) brightness(1.15) sepia(0.1)',
  vintage:    'sepia(0.35) saturate(0.7) contrast(0.95) brightness(1.03)',
  none:       '',
};
```

### Action Message Extensions (additive)

```js
// New action values handled in existing switch:
'set-layout-scatter' | 'set-layout-spiral' | 'set-layout-polaroid-stack' |
'set-layout-neat-grid' | 'set-layout-vignette' | 'set-layout-random'
'filter-next' | 'filter-prev'
'border-next' | 'border-prev'
'bring-to-front'
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `LayoutPresetEngine#compute()` | 6 presets × 4 slot counts (1,5,15,30) — assert all returned coords within canvas bounds |
| Unit | `getCombinedFilters()` | All 6 filter types return non-empty string except `'none'` |
| Unit | `drawBorder()` | Each border style renders without throwing; torn uses existing LCG test |
| Unit | `drawBackgroundTexture()` | Returns offscreen graphics buffer; seeded runs produce identical pixel outputs |
| Integration | Preset switching via `handleAction()` | Simulate `set-layout-spiral` → verify `cellStates[pos]` updated |
| Integration | Filter cycling via `filter-next`/`filter-prev` | Verify `filterType` cycles through 6 values |
| Regression | All existing 130+ Jest tests | `npm test` — 0 regressions |

## Migration / Rollout

No migration required. Old protocol messages (cycle-next, shuffle, flipH, etc.) continue to work — only additive actions are added. The old `AdaptiveLayout` class is deleted but its grid math is subsumed by `neat-grid` preset.

When rolling out, the existing bridge and phone-client need no changes — all new actions flow through the existing `{type:"action", slot, action}` message.

## Open Questions

None.
