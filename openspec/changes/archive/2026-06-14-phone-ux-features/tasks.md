# Tasks: phone-ux-features

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280-560 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1: Phases 1-2 (bars+thumbnail) ~150-200 lines | PR2: Phases 3-5 (wizard+tests) ~130-360 lines |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: Sensor Bar Removal + Thumbnail Base

- [x] 1.1 Delete `.sensors` div from `phone-client/index.html`, replace with `<div id="thumbnail"><img id="cell-image">`
- [x] 1.2 Delete sensor CSS (`.sensors`, `.sensor-row`, `.sensor-bar`, `.sensor-fill`, `.disconnected .sensor-fill`) from `phone-client/style.css`
- [x] 1.3 Add `#thumbnail` and `#cell-image` CSS (responsive, max-height fitting freed space)
- [x] 1.4 Remove accelBar/gyroBar/orientBar DOM refs and their transform updates from `phone-client/app.js` — keep devicemotion/deviceorientation listeners and gestureDetector

## Phase 2: Image Relay Infrastructure

- [x] 2.1 Add `slotImageMap` to `bridge/index.js`, init as `{}`
- [x] 2.2 Handle `type: "image-update"` from p5: store in slotImageMap, relay to phone as cell-image
- [x] 2.3 On phone assign, send cell-image from slotImageMap if entry exists
- [x] 2.4 Add `formatCellImageMessage(slot, imageFile, imageUrl)` to `bridge/message-relay.js`
- [x] 2.5 Track `currentImageFile` in p5 cell state; send `image-update` after initCell, cycle-next, cycle-prev, shuffle in `p5-collage/sketch.js`
- [x] 2.6 Add cell-image listener in `phone-client/app.js`: update `#cell-image` src on message

## Phase 3: Gesture Recording Duration

- [x] 3.1 Add `parseRecordingDuration()` to message-relay.js — validates/clamps duration param
- [x] 3.2 Use `parseRecordingDuration(msg)` for dynamic auto-stop setTimeout in bridge/index.js

## Phase 4: Gesture Wizard UI

- [x] 4.1 Add wizard overlay HTML to `phone-client/index.html` (5 steps + cancel)
- [x] 4.2 Add wizard CSS to `phone-client/style.css` (overlay, step transitions, countdown animation, duration picker)
- [x] 4.3 Implement wizard state machine in `phone-client/app.js`: idle→practice→duration→countdown→recording→confirm→idle, cancellable at any step
- [x] 4.4 Practice: records locally via lastSensor, calculates gesture duration elapsed time
- [x] 4.5 Duration picker: 2s/3s/4s/5s, sends record-start with chosen duration on countdown finish
- [x] 4.6 Replace single "Record" button with wizard trigger ("Gesto")

## Phase 5: Testing

- [x] 5.1 RED: Write failing test for `formatCellImageMessage()` — correct shape with type, slot, imageFile, imageUrl
- [x] 5.2 GREEN: Implement `formatCellImageMessage()` in message-relay.js
- [x] 5.3 RED: Write failing tests for duration — default 3000, custom 4000, cap 5000, floor 1000, legacy compat, NaN, null, string, negative, boundary 1000/5000
- [x] 5.4 GREEN: Implement `parseRecordingDuration()` with proper type checking and clamping
- [x] 5.5 REFACTOR: Extract pure function, fix NaN handling, clean bridge index.js imports
- [x] 5.6 Run `npm test` — all 146 tests pass (135 baseline + 11 new)

## Risk Notes

- 1.4: CRITICAL — keep devicemotion/deviceorientation listeners, only delete visualization code
- Phase 2: Audit ALL image-changing paths in sketch.js (initCell, cycle-next, cycle-prev, shuffle)
- Phase 3 must precede Phase 4 — wizard depends on duration-aware bridge
- >400 lines → PR1 (Phases 1-2) + PR2 (Phases 3-5) to keep reviews manageable
