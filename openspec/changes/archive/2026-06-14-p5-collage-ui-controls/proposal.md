# Proposal: p5-collage-ui-controls

## Intent

The p5 collage runs fullscreen at 1920×1080 with no projector-side controls. The operator has no way to change layouts, adjust parameters, or interact with cells directly — all control is delegated to phones. The tempExample reference proves an interactive control panel + drag & drop dramatically improves the installation experience. This gives the operator direct manipulation of the collage without leaving the projector view.

## Scope

### In Scope
1. HTML/CSS sidebar overlay: layout presets (6), scatter scale slider, canvas background selector, noise intensity slider, per-cell editor (filter, border, opacity, flip), catalog image picker, collapsible toggle
2. Drag & drop cell repositioning: click-to-select + bring-to-front, threshold-based drag
3. Selection model: `selectedSlot` global, visual highlight ring on selected cell
4. Preset buttons: overwrite all cell positions (simpler UX, user re-drags after)
5. Works fully offline — no phone-client dependency

### Out of Scope
- React migration or JS framework
- Phone-client changes
- Multi-window/canvas mode
- Keyboard shortcuts
- Persistent state across page reloads
- Touch gestures beyond basic click/drag

## Capabilities

### New Capabilities
- `projector-controls`: Control panel sidebar + canvas drag & drop for the collage projector operator

### Modified Capabilities
None

## Approach

**Sidebar**: Fixed-position `<div>` overlay in `index.html`, right-aligned, 320px wide, collapsible via toggle button. Styled with `control-panel.css`. Logic in `control-panel.js` — reads/writes `CONFIG` globals and `cellStates` directly. Event handlers dispatch through existing `deviceManager.handleAction()` where possible; CONFIG changes (scatter scale, noise, bg) trigger immediate redraw.

**Drag & drop**: New `drag-manager.js` module. `mousePressed` records start position. `mouseDragged` checks delta against threshold (5px) — if exceeded, enters drag mode and updates cell position live. `mouseReleased` finalizes position (updates z-index) if dragged, or treats as click → select + `bringToFront()`.

**Selection**: `selectedSlot` variable in `sketch.js`. `draw()` renders selection highlight (glowing border ring) on the selected cell. Clicking empty space or another cell updates selection.

**Presets**: Same path as WebSocket actions — `deviceManager.layoutEngine.setPreset()` + `_recalculateLayout()`. Overwrites all positions; user repositions via drag after.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `p5-collage/sketch.js` | Modified | Click/drag disambiguation, `selectedSlot` global, draw highlight, sidebar bridge |
| `p5-collage/config.js` | Modified | Maybe add panel defaults (collapsed state, default control values) |
| `p5-collage/control-panel.js` | New | Sidebar component: DOM creation, event binding, state sync |
| `p5-collage/control-panel.css` | New | Sidebar styles — fixed overlay, z-index above canvas |
| `p5-collage/drag-manager.js` | New | Drag state machine: press/track/release, threshold, position commit |
| `p5-collage/index.html` | Modified | Sidebar HTML skeleton, script/css includes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Click vs drag ambiguity on slow presses | Medium | 5px threshold with visual cursor feedback; tune during testing |
| HTML sidebar z-index conflicts with canvas | Low | Sidebar uses `position: fixed; z-index: 1000`; canvas has no z-index interaction |
| Preset overwrites custom drag positions | Medium | Documented behavior — status message on preset click explains positions will reset |
| p5 mouse events fire on sidebar area | Low | Sidebar uses `pointer-events: auto`; canvas events only fire on canvas element |

## Rollback Plan

Revert `index.html`, `sketch.js`, `config.js` changes. Delete `control-panel.js`, `control-panel.css`, `drag-manager.js`. No schema changes, no database — clean file-level revert.

## Dependencies

None — pure vanilla JS/CSS additions to existing p5 collage.

## Success Criteria

- [ ] Sidebar renders as fixed overlay, does not block canvas click/drag on non-sidebar area
- [ ] Each preset button triggers layout recalculation and all 30 cells reposition
- [ ] Drag moves a single cell; no visual glitching (flashing, snapping back)
- [ ] Click (no drag) selects cell, brings it to front, shows highlight ring
- [ ] Per-cell controls (filter, border, opacity, flip) update the selected cell
- [ ] CONFIG controls (scatter scale, canvas bg, noise intensity) update canvas in real time
- [ ] Collapse toggle hides/shows sidebar without affecting layout
