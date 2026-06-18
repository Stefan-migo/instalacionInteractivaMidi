# Tasks: p5-collage-ui-controls

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 850–950 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Control Panel + Selection Foundation | PR 1 (~545 lines) | Sidebar, catalog, per-cell editor, selectedSlot, highlight |
| 2 | Drag & Drop + Floating Controls | PR 2 (~320 lines) | drag-manager, event routing, floating controls, touch |

PR 1 can ship standalone (sidebar + catalog + per-cell editing via catalog click). PR 2 adds canvas-based selection and drag. Both target main; PR 2 rebases after PR 1 merges.

## Phase 1: Control Panel + Selection Foundation

- [ ] 1.1 Create `control-panel.css` — aged-paper fixed right panel (320px, z-index 1000), toggle button at left edge, scrollable sections, floating bar styling
- [ ] 1.2 Add sidebar skeleton to `index.html` — toggle button, 6 preset buttons, scatter/background/noise controls, catalog, per-cell editor; link CSS + new JS scripts
- [ ] 1.3 Create `control-panel.js` — `buildControlPanel()` appends aside, toggle collapse, 6 presets → `deviceManager.handleAction`, scatter/background/noise sliders/selectors → CONFIG + redraw
- [ ] 1.4 Catalog: populate 30 entries from cellStates, thumbnail + title + eye toggle (opacity=0 to hide)
- [ ] 1.5 Per-cell editor: filter/border/rotation/scale/opacity controls read/write `cellStates[selectedSlot]`
- [ ] 1.6 Add `selectedSlot` global to `sketch.js`; "Esparcir Todo" button → `deviceManager._recalculateLayout()`
- [ ] 1.7 Modify `cell-renderer.js` — `drawCell()` draws golden dashed border stroke when slot === selectedSlot
- [ ] 1.8 Tests: preset dispatch mocks `LayoutPresetEngine.compute`, verifies correct preset name
- [ ] 1.9 Tests: catalog renders 30 entries, eye toggle toggles opacity

## Phase 2: Drag & Drop + Floating Controls

- [ ] 2.1 Create `drag-manager.js` — drag state machine (pressed → dragged → released), 5px threshold to distinguish click from drag, position clamped to canvas bounds
- [ ] 2.2 Rewrite `mousePressed/mouseDragged/mouseReleased` in `sketch.js` → delegate to drag-manager; click (no drag) → select + bringToFront; drag → update cell position live
- [ ] 2.3 Touch events (`touchStarted/touchMoved/touchEnded`) — same logic as mouse
- [ ] 2.4 Floating control bar: HTML overlay positioned above selected cell; buttons for rotate −15°, rotate +15°, bring to front, hide. CSS in control-panel.css.
- [ ] 2.5 Click empty canvas → deselect (`selectedSlot = null`)
- [ ] 2.6 Tests: drag-manager hit-test logic (hit/miss per cell rect), position clamping boundary cases
- [ ] 2.7 Regression: `npm test` passes all existing + new tests
