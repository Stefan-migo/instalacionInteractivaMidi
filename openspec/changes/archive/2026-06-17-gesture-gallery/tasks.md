# Tasks: Gesture Gallery

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 200–300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Gallery Overlay DOM

- [x] T-1: Add gallery overlay DOM (`#gesture-gallery`) to `index.html` — 3 gesture cards (icon, name, desc, [Practicar]) + × close button + "Crear mi gesto" button
- [x] T-2: Add practice overlay DOM (`#practice-overlay`) — instruction text, feedback area with checkmark + "¡Bien! Eso fue un gesto.", [Volver] button
- [x] T-3: Rename `wizard-trigger` button text from "Gesto" to "Gestos" in `index.html`

## Phase 2: Gallery State Machine

- [x] T-4: Implement `openGallery()`, `closeGallery()`, `startPractice(gesture)`, `endPractice()`, `onGestureDetected()` functions in `app.js` with `galleryState` var (`null`/`'gallery'`/`'practice'`/`'practice-done'`)
- [x] T-5: Wire `wizard-trigger` click to `openGallery()`; wire × button and tap-outside on overlay background to `closeGallery()`

## Phase 3: Practice Flow

- [x] T-6: Implement practice overlay logic — set instruction text per gesture, listen to detector, show green check + "¡Bien!" for 2s on match, allow re-practice
- [x] T-7: Add `navigator.vibrate(200)` on successful gesture detection with try/catch guard

## Phase 4: Detection Heuristics

- [x] T-8: Add `gestureDetectors.girar` — `check(orientation)` returns `abs(orientation.g) > 30`, cooldown 1s
- [x] T-9: Add `gestureDetectors.sacudir` — `check(jerkMag)` returns `jerkMag > 15`, bypasses flick stabilization, cooldown 1s
- [x] T-10: Add `gestureDetectors.elevar` — `check(accel)` returns `accel.y < -12`, cooldown 1s
- [x] T-11: Wire `activate()`/`deactivate()` per detector — called from `startPractice`/`endPractice`, only checks when `active === true`
- [x] T-12: Wire `onGestureDetected()` to `sendAction()` with correct action per gesture (`girar` → `border-next`, `sacudir` → `shuffle`, `elevar` → `filter`)

## Phase 5: "Crear mi gesto" Integration

- [x] T-13: Wire `#gesture-gallery-create` button click to existing `wizOpen()`
- [x] T-14: Ensure wizard close (`wizClose`) returns to gallery overlay (not dashboard) when opened from gallery

## Phase 6: CSS

- [x] T-15: Add `style.css` rules for `#gesture-gallery` overlay (z-index 90, dark backdrop, card grid, icon/text layout, × close button, "Crear mi gesto" button)
- [x] T-16: Add CSS for `#practice-overlay` (z-index 95, instruction, feedback checkmark with success animation, [Volver] button, 2s fade)

## Phase 7: Tests

- [x] T-17: Write unit tests for `gestureDetectors.*.check()` — boundary values (29°, 30°, 31°; jerk 14, 15, 16; accel.y -11, -12, -13), cooldown timing, false positives when inactive
- [x] T-18: Write unit test for gallery state machine transitions: `null→gallery→practice→practice-done→practice→gallery→null`

## Implementation Order

Phase 1 → Phase 6 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 7. CSS can be done early (Phase 6 after Phase 1) since it has no runtime dependencies. Detection heuristics (Phase 4) should precede practice flow (Phase 3) since practice depends on detectors existing.
