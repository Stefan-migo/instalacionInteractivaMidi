# Design: p5-collage-visual-enhancements

## Technical Approach

Five independent rendering changes in the p5-collage module. No data flow changes, no layout recalculation, no protocol updates. Each enhancement is a pure draw-time modification following the module's existing patterns (p5.js procedural, Canvas2D API).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Image framing | Object-fit cover in `drawImg()` | Cell-resize on cycle | Zero layout impact; image cycling stays free; ≤5 lines changed |
| Intensity scaling | Element alpha × intensity | Count-only scaling | Makes slider visually responsive at all values; keeps draw calls bounded |
| Rotation range | -180 to +180, signed throughout | 0-360 internal with conversion | No conversion overhead; `radians()` handles negatives natively |
| Border styles | 4 new p5.js functions | Path2D/SVG | Follows existing pattern exactly; no new dependencies; trivially testable |
| Background layers | p5.Graphics layers + CSS overlay | WEBGL shader | Zero architectural risk; matches existing caching pattern; composable |

## Data Flow

No data flow changes for any of the 5 enhancements. All changes are local rendering logic:

```
drawImg() ──→ aspect-ratio crop source rect (cell-renderer.js)
background-texture.js ──→ alpha multiplied by intensity, +3 new layers
border-renderer.js ──→ 4 new dispatch targets in drawBorder()
control-panel.js ──→ slider min/max attr change, no handler logic change
sketch.js ──→ rotation normalization removed, texture rebuild debounced
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `p5-collage/cell-renderer.js` | Modify | `drawImg()`: add source-crop computation for object-fit cover |
| `p5-collage/background-texture.js` | Modify | Scale element alpha and vignette by intensity; add 3 new layers |
| `p5-collage/border-renderer.js` | Modify | Add `deckled`, `double-line`, `shadow-box`, `sprocket` styles |
| `p5-collage/control-panel.js` | Modify | Rotation slider: min -180, max 180; state migration in showPerCellEditor |
| `p5-collage/sketch.js` | Modify | Remove 0-360 normalization in `handleAction('rotation')`; add texture rebuild debounce |
| `p5-collage/config.js` | Modify | Expand `borderStyleMap`, `canvasBgStyle` options |
| `p5-collage/index.html` | Modify | Add CSS background classes for new `canvasBgStyle` options |

## Implementation Details

### 1. Object-Fit Cover in `drawImg()`

Replace single-argument `drawImage` with 9-argument crop variant:

```js
const iw = img.width, ih = img.height;
const scale = Math.max(w / iw, h / ih);
const sw = w / scale, sh = h / scale;
const sx = (iw - sw) / 2, sy = (ih - sh) / 2;
drawingContext.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
```

### 2. Intensity → Alpha Mapping

Each element alpha range multiplies by `intensity` parameter (0.0–1.0):
- Fibers: `randBetween(5, 15) * intensity`
- Grain, spots: `randBetween(3, 10) * intensity`
- Dust: `randBetween(8, 30) * intensity`
- Vignette: `t * t * 18 * intensity`

Count scaling (80/600/15/150 × intensity) remains as secondary effect.

**Debounce** — in `control-panel.js` `handlePanelInput` for noise-intensity, replace synchronous invalidation:

```js
clearTimeout(_bgRebuildTimer);
_bgTexture = null;
_bgRebuildTimer = setTimeout(() => { if (typeof redraw === 'function') redraw(); }, 80);
```

### 3. Rotation — Normalization Removal

In `sketch.js` `handleAction('rotation')`:

```js
// Before:
s.pos.rotation = ((payload.value % 360) + 360) % 360;
// After:
s.pos.rotation = payload.value;
```

State migration in `showPerCellEditor()`:

```js
let rot = state.pos.rotation || 0;
if (rot > 180) rot -= 360;   // normalize legacy 0-360 to -180..+180
```

### 4. New Border Styles

| Style | Technique | Lines |
|-------|-----------|-------|
| `deckled` | Sine-wave modulated jitter on existing torn vertices | 8 |
| `double-line` | Two concentric `rect()` calls, outer at +5px with 0.3 alpha | 6 |
| `shadow-box` | Offset `rect()` fill at rgba(0,0,0,0.15) + blurred, then white fill | 8 |
| `sprocket` | `rect()` outline + 4 tick marks per edge at quarter points | 10 |

All follow existing function signature `(w, h, p)` and register in `borderStyleMap`.

### 5. New Background Layers

| Layer | Implementation |
|-------|---------------|
| Scanlines | Alternating 1px horizontal lines at 3px spacing, alpha × intensity |
| Watercolor bleed | Large soft ellipses (r=40–120) with very low alpha near edges |
| Halftone dots | Grid of varying-radius dots at 45° angle, alpha × intensity |

New `canvasBgStyle` values in config: `'scanlines'`, `'watercolor'`, `'halftone'`. Each maps to a new CSS body class in `index.html`.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | drawImg cover crop | Mock img with known dims (portrait/landscape/square), verify source rect doesn't distort |
| Unit | Intensity alpha | Render texture at 0.0, 0.5, 1.0; sample pixel luminance to confirm scaling |
| Unit | Rotation normalization | Apply rotation > 180, verify normalized to -180..+180 range |
| Unit | New border styles | Each renders without throwing; pixel-inspect known coordinates |
| Unit | Debounce latency | Timer is cleared on rapid calls, fires only 80ms after last change |

## Migration / Rollout

No schema or data migration. The rotation normalization handler converts existing 0-360 stored values to -180..+180 on next editor open. Texture invalidates on next slider change automatically.

## Open Questions

None.
