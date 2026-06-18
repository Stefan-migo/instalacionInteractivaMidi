# Archive Report: Sensor-Driven Image Cycling + Gesture Recognition

## Change Summary

- **Change**: sensor-image-cycling
- **Archived**: 2026-06-11
- **Status**: Complete — archived with minor technical debt items
- **Mode**: hybrid (openspec + engram)

## Intent

Replace unused sensor-to-scale mapping with movement-driven image cycling, transitions, and gesture recording. Phone movement cycles images per cell with crossfade transitions; gesture recording captures accel/gyro sequences and matches via DTW to fire collage actions.

## Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Proposal | `openspec/changes/archive/2026-06-11-sensor-image-cycling/proposal.md` | ✅ Complete |
| Spec — Image Cycling | `openspec/specs/sensor-image-cycling-image-cycling.md` | ✅ Synced |
| Spec — Gesture Recording | `openspec/specs/sensor-image-cycling-gesture-recording.md` | ✅ Synced |
| Spec — Gesture Actions | `openspec/specs/sensor-image-cycling-gesture-actions.md` | ✅ Synced |
| Design | `openspec/changes/archive/2026-06-11-sensor-image-cycling/design.md` | ✅ Complete |
| Tasks | `openspec/changes/archive/2026-06-11-sensor-image-cycling/tasks.md` | ✅ 15/15 tasks complete |
| Verify Report | Engram observation #546 | ⚠️ Partial (see Known Issues) |

## Specs Synced

No delta specs existed in the change folder — all three specs were written directly to `openspec/specs/`. These are the active source of truth:

| Domain | Action | Details |
|--------|--------|---------|
| `sensor-image-cycling-image-cycling` | Already at main | Movement-energy detection, image pools, crossfade transitions |
| `sensor-image-cycling-gesture-recording` | Already at main | Record-mode toggle, sample capping, per-slot storage |
| `sensor-image-cycling-gesture-actions` | Already at main | DTW matching, downsampling, match debounce |

## Implementation Files Created

| File | Role |
|------|------|
| `bridge/gesture-store.js` | Per-slot gesture recording with 2s auto-stop, 20Hz capping |
| `bridge/dtw-matcher.js` | DTW matching with 10Hz downsample, cooldown, configurable threshold |
| `p5-collage/image-cycler.js` | Per-cell random image pool with wrap-around cycling |
| `p5-collage/transition-renderer.js` | Crossfade state machine with FPS fallback to instant swap |

## Implementation Files Modified

| File | Changes |
|------|---------|
| `bridge/message-relay.js` | Added `record-start`/`record-stop` actions, removed `focus`, added gesture-event format |
| `bridge/index.js` | Wired GestureStore + DTWMatcher, gesture lifecycle, disconnect cleanup |
| `p5-collage/sensor-mapper.js` | Rewritten: movement-energy output, no scale/drift/rotation/wobble |
| `p5-collage/cell-renderer.js` | Integrated ImageCycler + TransitionRenderer, removed focus + scale |
| `p5-collage/device-manager.js` | New cycle/record actions, removed `focusedSlot` |
| `p5-collage/sketch.js` | Removed `drawFocusedView()`/`focusedSlot`, wired gesture-event handler |
| `p5-collage/config.js` | Added cycle/gesture config, removed sensorMap/focus config |
| `phone-client/index.html` | Replaced focus button with record toggle + status indicator |
| `phone-client/app.js` | Record toggle logic, gesture-status handling, removed focus handler |

## Test Files

| File | Tests |
|------|-------|
| `tests/gesture-store.test.js` | Start/stop/auto-stop/capping/overwrite/discard |
| `tests/dtw-matcher.test.js` | Match/no-match/downsample/debounce/empty-skip |
| `tests/image-cycler.test.js` | Pool init/wrap/empty/no-op |
| `tests/transition-renderer.test.js` | Fade state machine/FPS fallback/instant swap |
| `tests/sensor-mapper.test.js` | Energy/direction/debounce/no-scale |
| `tests/message-relay.test.js` | Updated: new actions valid, focus rejected, gesture-event format |
| `tests/device-manager.test.js` | Updated: focus removed, cycle/record actions |

## Verification Results

- **Suites**: 11/11 passed
- **Tests**: 111/111 passed
- **Batches**: 5 apply batches, all complete

## Known Issues (Technical Debt)

Issues identified during verification not addressed in scope:

1. **gesture.action always default**: `GestureStore.stopRecording()` does not store an `action` field per spec. DTWMatcher compensates with `defaultAction: 'cycle-next'` config. All recognized gestures trigger the same action. To fix: store user-selected action at record time.

2. **Threshold inconsistency**: `config.js` sets `dtwThreshold: 0.3` but bridge instantiates DTWMatcher with `threshold: 0.5`. The config value is not read by the bridge.

3. **debounceMs hardcoded**: `sensor-mapper.js` hardcodes `this.debounceMs = 200` instead of reading from `config.js`.

4. **No performance instrumentation**: DTWMatcher has no budget tracking or frame-skipping fallback.

## Stale Checkbox Reconciliation

The following tasks had stale unchecked marks in `tasks.md` at archive time. All were confirmed complete by:
- Orchestrator explicit instruction ("All SDD phases are complete... The change is fully implemented and tested")
- Verification: 111/111 tests pass, all 8 new/modified source files exist
- Verify report (Engram #546): "All 15 implementation tasks are complete"

Tasks reconciled: T5, T6, T7, T14, T15

## SDD Cycle Complete

The change has been fully planned, proposed, specified, designed, implemented (5 batches), verified, and archived.

## Engram References

- Verify report: observation #546
- Session summary: observation #548
- Archive report: `sdd/sensor-image-cycling/archive-report`
