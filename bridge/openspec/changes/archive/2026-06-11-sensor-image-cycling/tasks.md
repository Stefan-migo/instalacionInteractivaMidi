# Tasks: Sensor-Driven Image Cycling + Gesture Recognition

## Review Workload Forecast

Decision needed before apply: **Yes**
Chained PRs recommended: **Yes**
Chain strategy: **pending** (ask on apply)
400-line budget risk: **High**

| Field | Value |
|-------|-------|
| Estimated changed lines | ~825 (new: ~550, modified: ~275) |
| New files | 8 (4 modules + 4 test files) |
| Modified files | 12 (7 source + 3 tests + 2 client) |
| Total files touched | 20 |
| 400-line budget risk | High — exceeds 2x budget |
| Chained PRs recommended | Yes |

### Suggested Work Units

| Unit | Goal | Likely PR | Base |
|------|------|-----------|------|
| 1 | **Bridge Foundation** (T1-T4) | PR 1 | main |
| 2 | **p5 Collage Core** (T5-T7) | PR 2 | main or PR 1 |
| 3 | **p5 Collage Integration** (T8-T11) | PR 3 | PR 2 |
| 4 | **Phone Client** (T12-T13) | PR 4 | main |
| 5 | **Cleanup + Verify** (T14-T15) | PR 5 | after all PRs merged |

PRs 2 and 3 can be stacked. PR 4 is independent (phone client).

---

## Layer 1: Bridge Foundation

### T1 — GestureStore class (bridge/) ✅

| Field | Detail |
|-------|--------|
| **Description** | Create `bridge/gesture-store.js` with per-slot recording: `startRecording()`, `addSample()` (20Hz cap), `stopRecording()`, `getGesture()`, `discardRecording()`, auto-stop at 2s via timer |
| **Files** | CREATE: `bridge/gesture-store.js`, `tests/gesture-store.test.js` |
| **Deps** | None |
| **Test** | TDD: start→samples→stop, auto-stop timeout, stop-without-start ignored, sample capping, overwrite, discard on disconnect |
| **Accept** | All scenarios pass. GestureStore exported via `module.exports` |
| **Size** | ~60 + ~80 test lines — **Medium** |

### T2 — DTWMatcher class (bridge/) ✅

| Field | Detail |
|-------|--------|
| **Description** | Create `bridge/dtw-matcher.js` with `addSample()` (10Hz downsample), `_dtw()` O(n*m) with 20x20 matrix max, `_match()` returning `{matched, gestureId, action}` or null; match debounce 1s per slot |
| **Files** | CREATE: `bridge/dtw-matcher.js`, `tests/dtw-matcher.test.js` |
| **Deps** | T1 (DTW reads GestureStore) |
| **Test** | TDD: match success, distance too high, downsample from 60Hz to 10Hz, debounce suppresses, empty-gesture skip, performance budget <33ms at 30 slots |
| **Accept** | All scenarios pass. DTW skips slots without gestures. Cooldown respected |
| **Size** | ~80 + ~80 test lines — **Medium** |

### T3 — Update message-relay.js ✅

| Field | Detail |
|-------|--------|
| **Description** | Add `record-start`, `record-stop` to VALID_ACTIONS; remove `focus`. Add `formatGestureEventMessage(slot, event, gestureId?, action?)` returning `{ type: "gesture-event", slot, event, gestureId, action, ts }` |
| **Files** | MODIFY: `bridge/message-relay.js`, `tests/message-relay.test.js` |
| **Deps** | None |
| **Test** | Update: VALID_ACTIONS no longer contains 'focus', contains 'record-start'/'record-stop'; gesture-event message format; focus action rejected |
| **Accept** | All existing + new tests pass |
| **Size** | ~15 lines changed — **Small** |

### T4 — Wire GestureStore + DTWMatcher in index.js ✅

| Field | Detail |
|-------|--------|
| **Description** | Import GestureStore, DTWMatcher. On sensor msg: relay to p5 + feed DTWMatcher.addSample(). On record-start/stop: call GestureStore. On WS close: discardRecording(). Broadcast gesture-event to p5 on matched gesture. Send gesture-status to phone on record state change |
| **Files** | MODIFY: `bridge/index.js` |
| **Deps** | T1, T2, T3 |
| **Test** | Manual (integration). Unit: module resolution verification |
| **Accept** | Gesture lifecycle wired: start→sample→stop→match→broadcast. Disconnect discards partial. Focus no longer handled |
| **Size** | ~25 lines changed — **Small** |

---

## Layer 2: p5-collage Core

### T5 — Rewrite sensor-mapper.js ✅

| Field | Detail |
|-------|--------|
| **Description** | Replace drift/scale output with movement-energy detection: compute frame-to-frame accel+gyro magnitude delta, compare against config threshold, debounce at 200ms. Output `{ direction: "next"|"prev"|null, energy: number }`. Remove scale, drift, rotation, wobble from output. Keep `resetSlot()`, `removeSlot()` |
| **Files** | REWRITE: `p5-collage/sensor-mapper.js`, `tests/sensor-mapper.test.js` |
| **Deps** | None |
| **Test** | Full TDD rewrite: forward/backward energy exceeds threshold → direction; sub-threshold → null; no scale key; debounce interval respected; slot lifecycle |
| **Accept** | Output shape is `{ direction, energy }` only. Scale/drift/rotation/wobble absent. Threshold and debounce configurable |
| **Size** | ~40 rewrite + ~50 test rewrite — **Medium** |

### T6 — ImageCycler class (p5-collage/) ✅

| Field | Detail |
|-------|--------|
| **Description** | Create `p5-collage/image-cycler.js`. Per-cell pool management: `initPool(slot, allImageFiles, poolSize)` selects random subset. `cycle(slot, direction)` returns `{ current, previous }` image references. Pool wraps at boundaries. Empty pool → no-op |
| **Files** | CREATE: `p5-collage/image-cycler.js`, `tests/image-cycler.test.js` |
| **Deps** | None |
| **Test** | TDD: pool init with 10 images, cycle wraps at boundary, empty pool returns no-op, independent per-slot pools |
| **Accept** | Pool random per slot, deterministic (seed not needed), wraps correctly. Handles N < poolSize edge case |
| **Size** | ~50 + ~60 test lines — **Small** |

### T7 — TransitionRenderer class (p5-collage/) ✅

| Field | Detail |
|-------|--------|
| **Description** | Create `p5-collage/transition-renderer.js`. State machine: IDLE → FADING_IN → FADING_OUT → IDLE. `startTransition(oldImg, newImg)` begins 300ms crossfade. `update(dt)` returns current alpha. FPS gate: if 3 consecutive frames < 30fps, fall back to instant swap. Blend mode fallback for crossfade (use `BLEND` mode) |
| **Files** | CREATE: `p5-collage/transition-renderer.js`, `tests/transition-renderer.test.js` |
| **Deps** | None |
| **Test** | TDD: state transitions, alpha ramps over duration, instant swap on low FPS, completes and returns to IDLE |
| **Accept** | Crossfade renders smoothly. FPS fallback activates correctly. State machine doesn't leak transitions |
| **Size** | ~70 + ~70 test lines — **Medium** |

---

## Layer 3: p5-collage Integration

### T8 — Integrate ImageCycler + TransitionRenderer into cell-renderer.js ✅

| Field | Detail |
|-------|--------|
| **Description** | CellRenderer gains ImageCycler + TransitionRenderer instances. `handleAction(slot, "cycle-next"|"cycle-prev")` cycles the cell's image through its pool with a transition. Remove focus handling from renderer. Remove scale from draw transform. The existing `generateTornBorder` and `drawTornBorder` stay unchanged |
| **Files** | MODIFY: `p5-collage/cell-renderer.js` |
| **Deps** | T6, T7 |
| **Test** | Cycle action triggers transition. Scale removed from draw. Focus removed |
| **Accept** | CellRenderer cycles images with crossfade. GenerateTornBorder unchanged |
| **Size** | ~40 lines changed — **Medium** |

### T9 — Update device-manager.js ✅

| Field | Detail |
|-------|--------|
| **Description** | `updateSensor()`: call new SensorMapper, if direction non-null feed ImageCycler. `handleAction()`: new cases for `record-start`, `record-stop`, `cycle-next`, `cycle-prev`, `blend-mode-next`, `blend-mode-prev`. Remove `focusedSlot` field and focus branching from `handleAction()` and `disconnect()`. Remove focus from tests |
| **Files** | MODIFY: `p5-collage/device-manager.js`, `tests/device-manager.test.js` |
| **Deps** | T5, T6, T7, T4 (for protocol shape) |
| **Test** | updateSensor feeds ImageCycler on direction match. New handleAction cases dispatch. Focus removed from test expectations |
| **Accept** | DeviceManager has no focus references. New actions dispatched. Sensor pipeline complete |
| **Size** | ~20 source + ~10 test changes — **Small** |

### T10 — Update sketch.js ✅

| Field | Detail |
|-------|--------|
| **Description** | Remove `drawFocusedView()`, `focusedSlot` global, focus references in `draw()` conditional. Remove `scale` from `drawCell()` transform. Wire TransitionRenderer into draw loop (call `update()` per frame). Remove focus from `createRenderer()`'s cell state init |
| **Files** | MODIFY: `p5-collage/sketch.js` |
| **Deps** | T8, T9 |
| **Test** | Manual visual: no focus view appears, cycling works, no scale artifacts, draw loop stable |
| **Accept** | sketch.js has zero focus references. draw() renders grid only. TransitionRenderer called per frame |
| **Size** | ~30 lines changed — **Small** |

### T11 — Update config.js ✅

| Field | Detail |
|-------|--------|
| **Description** | Add: `movementThreshold: 0.5`, `transitionDuration: 300`, `dtwThreshold: 0.3`, `dtwDownsampleHz: 10`, `gestureDebounceMs: 1000`, `imagePoolSize: 10`. Remove: `sensorMap.driftRange`, `sensorMap.rotationRange`, `sensorMap.scaleRange`, `sensorMap.wobbleRange`, `focusZoom`, `focusDuration` |
| **Files** | MODIFY: `p5-collage/config.js` |
| **Deps** | None (can be done any time before Layer 3 test) |
| **Test** | Visual inspection + dependents compile |
| **Accept** | New config keys present. Old sensorMap keys absent. Focus keys absent |
| **Size** | ~10 lines — **Small** |

---

## Layer 4: Phone Client

### T12 — Update phone-client/index.html ✅

| Field | Detail |
|-------|--------|
| **Description** | Replace "👁 Enfocar" button with record toggle button with `data-action="record"` and `<span id="rec-indicator">` for recording status. Add status indicator element for recording state |
| **Files** | MODIFY: `phone-client/index.html` |
| **Deps** | None |
| **Test** | Visual: focus button gone, record toggle present, indicator element exists in DOM |
| **Accept** | No focus button. Record toggle + status indicator in DOM |
| **Size** | ~5 lines changed — **Small** |

### T13 — Update phone-client/app.js ✅

| Field | Detail |
|-------|--------|
| **Description** | Remove focus button handler. Add record toggle: send `record-start` on first press, `record-stop` on second press, toggle visual feedback (pulsing red dot CSS class). Handle `gesture-status` message to show/hide recording indicator |
| **Files** | MODIFY: `phone-client/app.js` |
| **Deps** | T12 (button element must exist) |
| **Test** | Manual: record toggle sends correct actions, indicator shows/hides, focus no longer sent |
| **Accept** | Record lifecycle functional. No focus action sent. Recording feedback shown |
| **Size** | ~25 lines changed — **Small** |

---

## Layer 5: Cleanup

### T14 — Remove dead code (all files) ✅

| Field | Detail |
|-------|--------|
| **Description** | Sweep all files for focus remnants: `focusedSlot`, `drawFocusedView`, `isFocused`, `focus` action string, `focusZoom`, `focusDuration` config refs. Remove any `scale` remnants in sketch draw pipeline. Verify no dead sensorMapper keys referenced |
| **Files** | ALL modified files |
| **Deps** | T1–T13 complete |
| **Test** | `grep -r "focusedSlot\|drawFocusedView\|focusZoom\|focusDuration" .` returns nothing in source. Tests still pass |
| **Accept** | Zero focus or dead-scale references remain. Code compiles/lints clean |
| **Size** | ~5–10 lines removal across files — **Small** |

### T15 — Verify all tests pass ✅

| Field | Detail |
|-------|--------|
| **Description** | Run `npm test`. All new tests (gesture-store, dtw-matcher, image-cycler, transition-renderer) + updated tests (sensor-mapper, message-relay, device-manager) + existing unchanged tests pass. Fix any failures |
| **Files** | All test files |
| **Deps** | T1–T14 complete |
| **Test** | Green suite |
| **Accept** | `npm test` exits 0. All 8 test files report passing |
| **Size** | Fix-up only — **Small** |

---

## Dependencies Graph

```
Layer 1                  Layer 2                Layer 3              Layer 4           Layer 5
┌──────┐               ┌────────────┐         ┌────────────┐       ┌─────────┐      ┌─────────┐
│  T1  │──┐            │  T5 (rew)  │         │  T8 (cell) │       │ T12(html)│      │ T14(cln)│
│  T2  │──┤──→ T4      │  T6 (cycl) │──→ T8──→│  T9 (dev)  │──→ T10│   ↓     │──→ T13│   ↓     │
│  T3  │──┘            │  T7 (trans)│──→ T8   │ T11 (cfg)  │──→ T9 │ T13(app)│      │ T15(ver)│
└──────┘               └────────────┘         └────────────┘       └─────────┘      └─────────┘
```

- T1/T2/T3/T5/T6/T7/T11/T12: Independent roots (can start in parallel)
- T4 depends on T1+T2+T3
- T8 depends on T6+T7
- T9 depends on T5+T6+T7+T11
- T10 depends on T8+T9
- T13 depends on T12
- T14/T15 depend on everything

## Batch Grouping for Apply

**Batch 1** (Bridge — PR 1): T1 → T2 → T3 → T4
**Batch 2** (p5 Core — PR 2): T5 → T6 → T7
**Batch 3** (p5 Integration — PR 3): T8 → T9 → T10 → T11
**Batch 4** (Phone — PR 4, independent): T12 → T13
**Batch 5** (Cleanup — PR 5, final): T14 → T15

Chain strategy: PRs 1→2→3 stacked; PR 4 independent to main; PR 5 final sweep.

## Risk Summary

| Risk | Impact | Mitigation |
|------|--------|------------|
| DTW too slow at 30 slots | Medium | Downsamples to 10Hz; can skip every other frame |
| Transition drops FPS | Medium | FPS gate falls back to instant swap |
| Gesture false positives | High | Min distance threshold + 1s cooldown per slot |
| Test mock complexity for p5 | Medium | Extract logic from p5-global; test pure functions |
