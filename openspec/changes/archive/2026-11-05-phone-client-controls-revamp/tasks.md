# Tasks: Phone Client Controls Revamp

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~370 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Bridge + p5 + tests (~120) → PR 2: Phone UI (~250) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Bridge protocol + p5 receiver + tests | PR 1 | Base: feature/tracker branch |
| 2 | Phone-client UI (HTML/CSS/JS) | PR 2 | Base: PR 1 branch |

## Phase 1: Bridge Protocol (TDD)

- [x] 1.1 RED: Update VALID_ACTIONS test assertions — remove old actions (reset, flipH, flipV, opacityUp, opacityDown, lock, unlock), add new ones (opacity, rotation, filter, move)
- [x] 1.2 GREEN: Update VALID_ACTIONS in message-relay.js; add FILTER_NAMES, VALID_VALUE_ACTIONS map
- [x] 1.3 RED: Write tests for `validateValueAction()` — valid payloads (opacity:75, rotation:180, filter:"sepia", move:{dx:10,dy:-5}) and invalid ones (opacity:"bad", filter:"blur", move:{x:10})
- [x] 1.4 GREEN: Implement `validateValueAction()` in message-relay.js
- [x] 1.5 RED: Write tests for `formatActionMessage(slot, action, payload)` — payload fields only present when payload arg provided
- [x] 1.6 GREEN: Update `formatActionMessage` to accept optional 3rd param; spread value/dx/dy into message
- [x] 1.7 GREEN: Update bridge/index.js line 229 — pass full msg as payload to formatActionMessage for action relay

## Phase 2: p5 Receiver (TDD)

- [x] 2.1 RED: Update device-manager.test.js — handleAction expectation includes 4th payload arg
- [x] 2.2 GREEN: device-manager.js `handleAction(slot, action, payload)` — passes payload to renderer.handleAction
- [x] 2.3 RED: Write handleAction clamping tests — opacity [0,1], rotation [0,360), move clamped to canvas bounds
- [x] 2.4 GREEN: sketch.js handleAction — add cases for opacity, rotation, filter, move with values + clamping

## Phase 3: Phone UI

- [x] 3.1 GREEN: index.html — replace actions-grid: 2 stamp buttons (wizard, shuffle), filter row, opacity slider, rotation slider, touch-pad div; remove flipH/flipV/reset/lock/unlock buttons
- [x] 3.2 GREEN: app.js — remove lock/unlock/reset/flip handlers; add slider input → sendActionWithPayload, filter cycle (sepia→grayscale→cyanotype→polaroid→vintage→none), touch pad with dead zone (3px), Y-axis natural mapping
- [x] 3.3 GREEN: style.css — actions-grid 2-col; vintage range slider (square thumb, border track, label); touch-pad (torn border, crosshair cursor, active feedback, 4×4 grid lines, following dot); filter-btn styling; remove unused nth-child(3-8) rotations

## Phase 4: Backward Compat & Verification

- [x] 4.1 GREEN: Test validateSensorMessage passes for payload-bearing action msgs `{type:"action", action:"opacity", value:50}`
- [x] 4.2 GREEN: Verify all removed actions (reset, flipH, flipV, opacityUp, opacityDown, lock, unlock) are rejected by VALID_ACTIONS after the change
