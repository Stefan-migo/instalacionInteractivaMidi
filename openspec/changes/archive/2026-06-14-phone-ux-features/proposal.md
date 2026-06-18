# Proposal: Phone UX Features

## Intent
Three UX improvements for the phone client: show the user's cell image as a thumbnail, replace the single-button gesture recorder with a guided wizard, and remove the sensor visualization bars (now unnecessary).

## Scope

### In Scope
- Remove sensor bars from dashboard UI
- Show current cell image as thumbnail (replaces sensor bar area)
- New p5→bridge→phone relay for image state
- Configurable recording duration in bridge
- Multi-step gesture wizard UI on phone client
- Backward compatible: existing phones still work

### Out of Scope
- New button interactions (deferred)
- Sensor listener removal (still needed for gesture detection)
- p5 collage rendering changes

## Capabilities

### New Capabilities
- `phone-image-display`: Show current cell image on phone interface
- `phone-gesture-wizard`: Guided multi-step gesture recording flow

### Modified Capabilities
- `phone-style`: Dashboard layout changes — remove sensor bars, add thumbnail + wizard overlay

## Approach

Three independent features, delivered sequentially:

**Thumbnail** (~100-160 lines): Bridge stores `slotImageMap`. p5 sends `image-update` after every image change (cycle-next, cycle-prev, shuffle). Bridge relays `cell-image` with URL to phone. Phone renders image in sensor bar area.

**Wizard** (~160-320 lines): Client-side JS overlay — Practice (records via existing sensor infra) → Duration picker (2s/3s/4s/5s, max 5s) → Countdown (3-2-1) → Record → Confirm. Bridge only change: accept optional `duration` ms on `record-start` (default 3000ms).

**Remove bars** (~45-80 lines): Delete HTML/CSS/JS for sensor visualizations. Keep `devicemotion`/`deviceorientation` listeners — still feed gesture detection.

All changes are backward compatible: duration defaults to 3000ms, old phones bypass wizard.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| bridge/index.js | Modified | slotImageMap, image-update handler, cell-image relay; duration param on record-start |
| bridge/message-relay.js | Modified | New formatCellImageMessage() |
| phone-client/index.html | Modified | Remove sensors div, add thumbnail + wizard overlay |
| phone-client/style.css | Modified | Remove sensor bar styles, add thumbnail + wizard styles |
| phone-client/app.js | Modified | Thumbnail display, wizard state machine, remove sensor bar code |
| p5-collage/sketch.js | Modified | Send image-update after cycle/shuffle actions |
| tests/ | Modified | Tests for cell-image relay, duration-aware recording |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Image sync gap | Medium | Audit all image-changing paths in sketch.js; test shuffle + cycle |
| Duration param breaks old phones | Low | Default to 3000ms if absent |
| Line budget ~380-560 | Medium | May need chained PRs |
| Sensor listener removed by accident | Low | Keep listeners; only delete visualization code |

## Rollback Plan
Revert files from git. Features are independent — roll back individually: thumbnail (bridge + p5 + phone), wizard (phone overlay), bars (restore deleted CSS/HTML).

## Dependencies
None external.

## Success Criteria
- [ ] Sensor bars removed, thumbnail visible in their place
- [ ] Thumbnail updates when image changes (shuffle, cycle)
- [ ] Gesture wizard: practice → choose duration → countdown → record → repeat
- [ ] Duration parameter accepted by bridge (default 3000ms)
- [ ] All existing tests pass
- [ ] Existing phones without wizard still work
