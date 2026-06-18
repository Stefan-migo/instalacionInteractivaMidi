# Design: p5-collage-ui-controls

## Technical Approach

Vanilla JS modules layered on existing p5 collage — no framework. Two new modules (`control-panel.js`, `drag-manager.js`) plus CSS, wired via globals to CONFIG and `cellStates`. Selection state lives in `sketch.js` scope. The sidebar is a fixed `<aside>` overlay, drag is a p5 event state machine, and per-cell controls read/write `selectedSlot` directly.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| React overlay vs vanilla DOM | React brings build step, 50KB+ bundle, and framework mismatch with p5 globals | **Vanilla DOM** — smaller, matches existing codebase |
| Inline CSS vs separate file | Inline in index.html adds bloat; separate file keeps concerns split | **`control-panel.css`** — loaded via `<link>` in index.html |
| `drag-manager.js` as class vs function module | Class adds `this` complexity; plain functions with closure state are simpler | **Plain functions** — `_dragState` closure, exposed via setup/teardown hooks |
| `selectedSlot` as global vs module-level | Module-level avoids pollution but needs import wiring | **Global `selectedSlot`** in sketch.js scope — matches existing pattern (`activeSlots`, `ws`) |
| Preset = recalculateLayout (overwrite) vs merge positions | Overwrite is simpler and matches phone action behavior; merge adds complexity to detect which cells user moved | **Overwrite** — one-step: `layoutEngine.setPreset()` + `_recalculateLayout()`. Status toast warns user. |

## Data Flow

```
Sidebar input ─→ control-panel.js ──→ CONFIG (scatterScale, canvasBg, noise)
                                    ──→ deviceManager.renderer.cellStates[slot] (filter, border, opacity)
                                    ──→ deviceManager.layoutEngine + _recalculateLayout() (preset)
                                    
p5 mouse/touch ─→ drag-manager.js ──→ cellStates[slot].pos (x, y, zIndex)
                                      ──→ selectedSlot (on click)
                                      
draw() ─→ sketch.js ──→ reads cellStates, CONFIG, selectedSlot
                        ──→ draws selection highlight on selectedSlot
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `p5-collage/control-panel.js` | Create | Sidebar DOM construction, event binding, state sync read/write |
| `p5-collage/control-panel.css` | Create | Fixed right panel (320px), scrollable, z-index 100, aged-paper styling |
| `p5-collage/drag-manager.js` | Create | Drag state machine: press/track/release, threshold, position commit |
| `p5-collage/sketch.js` | Modify | `selectedSlot` global, rewrite mousePressed/touchStarted → route through drag-manager, draw selection highlight in drawCell |
| `p5-collage/cell-renderer.js` | Modify | `drawCell()` renders dashed selection border when cell matches selectedSlot |
| `p5-collage/index.html` | Modify | Add `<aside id="control-panel">` skeleton, `<link>` CSS, `<script>` includes for new JS modules |

## Interfaces / Contracts

### Global State (sketch.js scope)

```js
let selectedSlot = null;  // null | number
```

### DragManager API

```js
// drag-manager.js — registers p5 event handlers internally
// Requires: deviceManager, collageLayout, getSortedSlots exist in scope
// Events captured: mousePressed, mouseDragged, mouseReleased
//               + touchStarted, touchMoved, touchEnded
// On click (no drag): calls bringToFront(px, py), sets selectedSlot
// On drag: updates cellStates[slot].pos.x/y, clamped to [0, 1920-w]
```

### ControlPanel API

```js
// control-panel.js — builds DOM, binds listeners
// Requires: CONFIG, deviceManager, selectedSlot, getSortedSlots
// Exports: buildControlPanel() → appends <aside> to body
//          syncPanelFromState() → reads CONFIG/cellStates → updates DOM
//          syncStateFromPanel() → reads DOM → writes CONFIG/cellStates → redraw
```

### CellState additions (no new fields — existing model reused)

The current `cellStates[slot]` model fully covers what the panel needs:
`{pos, opacity, filterType, borderStyle, flipH, flipV, locked, phoneConnected, blendMode}`
No schema migration required.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `drag-manager.js` hit-test logic | Isolate hit detection: given cellState pos + click coords, return hit/miss |
| Unit | Preset button → `_recalculateLayout()` call | Mock LayoutPresetEngine, verify compute is called with correct preset name |
| Visual | Selection highlight renders on selected cell | Manual — open collage, click cell, verify golden dashed border |
| Visual | Drag moves cell, position persists after release | Manual — drag cell, verify position is updated and clamped |

## Migration / Rollout

No migration required. Add files, modify existing, reload. At startup, sidebar is collapsed by default (`CONFIG.panelCollapsed: true`) — operator opens when needed.

## Open Questions

- None at this phase. Spec covers all requirements.
