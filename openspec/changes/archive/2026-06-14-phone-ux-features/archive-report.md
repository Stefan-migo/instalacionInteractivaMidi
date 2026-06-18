# Archive: phone-ux-features

## Summary

Three phone-client UX improvements implemented and verified: (1) sensor visualization bars removed from the dashboard — listeners kept for gesture detection; (2) current cell image thumbnail relayed from p5 through bridge to phone, updating on every image change (initCell, cycle-next, cycle-prev, shuffle); (3) single "Record" button replaced with a 5-step wizard (practice → duration picker → countdown → record → confirm) with configurable recording duration. Bridge adapted to accept optional `duration` parameter on `record-start` (default 3000ms, max 5000ms). All 146 tests pass (135 baseline + 11 new).

## Artifacts

| File | Source |
|------|--------|
| proposal.md | openspec/changes/phone-ux-features/ |
| spec.md | openspec/changes/phone-ux-features/ |
| design.md | openspec/changes/phone-ux-features/ |
| tasks.md | openspec/changes/phone-ux-features/ |
| verify.md | openspec/changes/phone-ux-features/ |
| verify-pr1.md | openspec/changes/phone-ux-features/ |
| exploration.md | openspec/changes/phone-ux-features/ |
| [archive-report.md] | generated at archive time |

## Delta Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| phone-ux | Created | `openspec/specs/phone-ux/spec.md` — new spec for functional behavior (cell image thumbnail + gesture wizard) |
| phone-style | Updated | `openspec/specs/phone-style/spec.md` — removed Component 6 (Sensor Bars), updated Torn Edges reference, updated Interaction States table and Scenario 2 |

## Changed Files

| File | Impact |
|------|--------|
| bridge/index.js | slotImageMap, image-update handler, cell-image relay, duration param |
| bridge/message-relay.js | formatCellImageMessage(), parseRecordingDuration() |
| phone-client/app.js | Remove sensor bars, thumbnail display, wizard state machine |
| phone-client/index.html | Thumbnail container, wizard overlay, wizard trigger button |
| phone-client/style.css | Remove sensor bar CSS, add thumbnail + wizard styles |
| p5-collage/sketch.js | image-update on cycle/shuffle/initCell |
| tests/message-relay.test.js | Cell-image + duration parsing tests (11 new) |

## Test Count

146 tests passing (135 baseline + 11 new)

## Changes to Main Specs

### `openspec/specs/phone-ux/spec.md` (CREATED)
- Cell Image Thumbnail: 6 requirements (R-THUMB-1 through R-THUMB-6), 3 scenarios
- Gesture Recording Wizard: 12 requirements (R-WIZ-1 through R-WIZ-12), 4 scenarios
- Protocol message table, affected modules table

### `openspec/specs/phone-style/spec.md` (UPDATED)
- **REMOVED**: Component 6 — Sensor Bars (visualization bars removed from dashboard)
- **UPDATED**: Component 9→8 — Torn Edges reference changed from "sensor container" to "thumbnail container"
- **REMOVED**: "Sensor bars" row from Interaction States table
- **REMOVED**: CSS transition mentioning "sensor bar width"
- **UPDATED**: Scenario 2 — replaced sensor bars animation with thumbnail update

## Known Risks

- Race condition: blank thumbnail until p5 initCell completes on first connect
- Wizard UI not covered by automated tests — needs real-device manual verification
- No integration tests for WebSocket relay paths (image-update → cell-image → phone)
- Missing apply-progress artifact for PR2 TDD compliance (noted in verify report)

## Intentional Archive Notes

No stale unchecked tasks in tasks.md (22/22 complete). Verify report verdict: PASS WITH WARNINGS (CRITICAL flag for missing apply-progress artifact — process compliance only, no functional issues).
