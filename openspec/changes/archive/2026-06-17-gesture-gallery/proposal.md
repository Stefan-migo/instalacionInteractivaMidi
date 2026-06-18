# Proposal: Gesture Gallery

## Intent

Users don't understand what gestures are — the single "Gesto" button jumps straight into recording without context, causing confusion and abandonment. This change teaches users through interactive examples before offering to create their own.

## Scope

### In Scope
- Gallery overlay: 3 example gesture cards + "Crear mi gesto" button
- Practice flow: user picks a card, performs the gesture, sees the effect + feedback
- Client-side heuristic detection for Girar, Sacudir, Elevar
- Button rename "Gesto" → "Gestos", gallery replaces direct wizard entry
- Haptic + visual feedback on successful detection
- Existing 5-step recording wizard unchanged behind "Crear mi gesto"

### Out of Scope
- DTW or server-side matching for example gestures (pure heuristics)
- Bridge-side changes — all detection stays in phone-client
- Adding/deleting example gestures (fixed at 3)
- Gesture recording, gesture store, or DTW matching changes

## Capabilities

### New Capabilities
- `phone-gesture-gallery`: Overlay that teaches gestures via interactive practice. User taps a card, performs the movement, sees the real collage effect, gets feedback. Bridge-agnostic — all detection is client-side.

### Modified Capabilities
- `phone-gesture-wizard`: Entry point changes — button text "Gestos" (plural), tap opens gallery instead of wizard. Wizard only opens via "Crear mi gesto" inside gallery.

## Approach

1. Add gallery overlay DOM in `index.html` (3 cards + Crear mi gesto + back)
2. Add practice overlay DOM (instruction, waiting state, success feedback)
3. Extend `gestureDetector` with 3 new heuristic methods alongside existing flick:
   - **Girar**: `rotationRate.gamma > 30°`
   - **Sacudir**: `jerkMag > 15` (reuses existing flick infrastructure)
   - **Elevar**: `accel.y < -12` (sharp upward motion)
4. Wire gallery state machine: card tap → practice → detect → `sendAction()` → vibrate + green check
5. "Crear mi gesto" calls existing `wizOpen()` unchanged
6. Rename button: `wizard-trigger` text to "Gestos", wire click to gallery overlay

## Detection Details

| Gesture | Sensor | Condition | Action |
|---------|--------|-----------|--------|
| ⟳ Girar | `rotationRate.gamma` | absolute value > 30° | `border-next` |
| 𝄐 Sacudir | `accel` jerk magnitude | `jerkMag > 15` (flick reuse) | `shuffle` |
| ↕ Elevar | `accel.y` | sharp drop < -12 | `filter` (cycle) |

All 3 use per-gesture cooldowns (~1s) to prevent repeat-trigger spam.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `phone-client/index.html` | New DOM | Gallery overlay + practice overlay |
| `phone-client/app.js` | New state | Gallery flow, practice detection, feedback |
| `phone-client/app.js` | Modified | `gestureDetector` expanded, button wiring |
| `phone-client/style.css` | New styles | Gallery cards, practice overlays, success check |

Bridge files (`bridge/*`) are unaffected.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Heuristic false positives (walking = Sacudir) | Med | Dead-zone thresholds, per-gesture cooldowns |
| Sensor calibration varies across devices | Med | Thresholds tunable via URL params for testing |
| Gallery adds friction to power users | Low | Dismissible overlay, no mandatory flow |

## Rollback Plan

Revert button text and click handler in `app.js`. Remove gallery/practice overlay DOM from `index.html` and styles from `style.css`. Restore direct `wizOpen()` call. No bridge or p5 revert needed.

## Dependencies

None — all changes in `phone-client/`.

## Success Criteria

- [ ] "Gestos" button opens gallery showing 3 cards + "Crear mi gesto"
- [ ] Each example gesture fires its collage action when detected correctly
- [ ] Phone vibrates + shows green check on successful gesture execution
- [ ] "Crear mi gesto" opens existing 5-step recording wizard unchanged
- [ ] All existing tests pass (`npm test`)
- [ ] Gestures only trigger when user is in practice flow (no false positives on dashboard)
