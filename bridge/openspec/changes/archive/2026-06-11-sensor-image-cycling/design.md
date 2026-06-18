# Design: Sensor-Driven Image Cycling + Gesture Recognition

## Architecture Overview

Three capabilities layered on the existing phone → bridge → p5 pipeline:

1. **Image cycling**: SensorMapper computes movement energy → direction (next/prev) → ImageCycler advances per-cell random pool → TransitionRenderer handles crossfade
2. **Gesture recording**: Phone toggles record-start/stop → bridge GestureStore captures accel+gyro samples per slot
3. **Gesture matching**: DTWMatcher compares live downsample window against stored gesture → fires action on sub-threshold match

```
Phone ──WS──→ Bridge (index.js)
                ├── GestureStore  (recording per slot)
                ├── DTWMatcher    (matching per slot)
                └── MessageRelay  (validate + format + route)
                      │
                      ↓  WS broadcast
                p5 DeviceManager
                  ├── SensorMapper → ImageCycler → TransitionRenderer
                  └── CellRenderer (renders transition state)
```

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| DTW location | Bridge, not p5 | Client-side | Single store, avoids broadcasting raw sensor to all players |
| Crossfade implementation | p5 state machine | CSS transitions | Full control over FPS gating, blend mode fallback |
| Gesture storage | In-memory, per slot | File/DB | Ephemeral matches spec; no persistence required |
| Image pool | Random 10 per cell | Fixed assignment | Works with arbitrary dataset size; wrap at pool boundary |

## Component Design

### New — `bridge/gesture-store.js`
```js
class GestureStore {
  constructor() { this.gestures = {}; this.recording = {}; this.timers = {}; }
  startRecording(slot) { /* init recording[slot] = [], set 2s auto-stop */ }
  addSample(slot, {accel, gyro}) { /* push, cap at 20Hz */ }
  stopRecording(slot) { /* store gesture, return gestureId */ }
  getGesture(slot) { /* return stored gesture or null */ }
  discardRecording(slot) { /* on disconnect */ }
}
```

### New — `bridge/dtw-matcher.js`
```js
class DTWMatcher {
  constructor(config) { this.windows = {}; this.cooldowns = {}; }
  addSample(slot, {accel, gyro}) { /* downsample to 10Hz, buffer in window */ }
  _dtw(a, b) { /* O(n*m), 20x20 matrix max */ }
  _match(slot) { /* returns { matched, gestureId, action } or null */ }
}
```

### Modified — `bridge/message-relay.js`
- `VALID_ACTIONS` gains `record-start`, `record-stop`; removes `focus`
- New method `formatGestureEventMessage(slot, event, gestureId?, action?)`

### Modified — `bridge/index.js`
- Imports `GestureStore`, `DTWMatcher`
- On `sensor` msg: relay to p5 + feed `DTWMatcher.addSample()` if slot has gesture
- On `record-start`/`record-stop`: calls `GestureStore.start/stopRecording`
- On `WS close`: calls `GestureStore.discardRecording()` for recording slots

### Rewritten — `p5-collage/sensor-mapper.js`
Output shape: `{ direction: "next"|"prev"|null, energy: number }`. Removes `scale`, `drift`, `rotation`, `wobble`. Uses frame-to-frame accel+gyro delta energy with debounce.

### New — `p5-collage/image-cycler.js`
Per-cell pool management: `initPool(slot, allImages, poolSize)`, `cycle(slot, direction)` returns new img + old img for transition. Pool wraps at boundaries.

### New — `p5-collage/transition-renderer.js`
State machine: `IDLE → FADING_IN → FADING_OUT → IDLE`. Duration: 300ms. Checks `frameCount` deltas. If < 30fps for 3 consecutive frames, falls back to instant swap.

### Modified — `p5-collage/device-manager.js`
- `updateSensor()`: calls new SensorMapper output, feeds ImageCycler on non-null direction
- `handleAction()` new cases: `record-start`, `record-stop`, `cycle-next`, `cycle-prev`, `blend-mode-next`, `blend-mode-prev`
- Removes `focusedSlot` and all focus branching

### Modified — `p5-collage/sketch.js`
- Remove `drawFocusedView()`, `focusedSlot`, focus references in `draw()`
- Remove `scale` from `drawCell()` transform

### Modified — `p5-collage/config.js`
Add: `movementThreshold: 0.5`, `transitionDuration: 300`, `dtwThreshold: 0.3`, `dtwDownsampleHz: 10`, `gestureDebounceMs: 1000`, `imagePoolSize: 10`. Remove `sensorMap.driftRange`, `sensorMap.scaleRange`, `sensorMap.rotationRange`, `sensorMap.wobbleRange`, `focusZoom`, `focusDuration`.

### Modified — `phone-client/app.js`
- Remove focus button handler
- Add record toggle `record-start`/`record-stop` with visual feedback (CSS pulsing class)
- Handle `gesture-status` messages for recording indicator

### Modified — `phone-client/index.html`
- Replace focus button with record button
- Add status indicator for recording state

## Data Flow

### Image Cycling
```
sensor msg → DeviceManager.updateSensor()
  → SensorMapper.map() → { direction: "next", energy: 0.7 }
  → threshold check → ImageCycler.cycle(slot, "next")
    → TransitionRenderer.startTransition(oldImg, newImg)
      → draw loop renders fade frames for 300ms
```

### Gesture Recording
```
phone button press → { type:"action", action:"record-start" }
  → index.js → GestureStore.startRecording(slot)
  → subsequent sensor msgs → GestureStore.addSample(slot, data)
  → phone button press → { type:"action", action:"record-stop" }
  → GestureStore.stopRecording(slot) → gestureId
  → broadcast { type:"gesture-event", slot, event:"recorded", gestureId }
```

### Gesture Matching
```
sensor msg arrives → DTWMatcher.addSample(slot, {accel, gyro})
  → window has 10 samples (1s at 10Hz)
  → DTW against stored gesture
  → distance < threshold AND cooldown expired?
    → broadcast { type:"action", slot, action: stored.action }
    → set 1s cooldown
```

## Protocol Changes

| Direction | New Message | Purpose |
|-----------|-------------|---------|
| Phone → Bridge | `{ type:"action", action:"record-start" }` | Begin capture |
| Phone → Bridge | `{ type:"action", action:"record-stop" }` | End capture |
| Bridge → p5 | `{ type:"gesture-event", slot, event:"recorded"|"matched", gestureId, action }` | Gesture lifecycle |
| Bridge → Phone | `{ type:"gesture-status", recording: true|false }` | Recording state |

Removed: `action: "focus"` from valid actions.

## Performance Budget

| Computation | Budget | Actual | Notes |
|-------------|--------|--------|-------|
| DTW per slot | 16ms | ~0.5ms | 20×20 matrix, O(n*m) |
| All 30 slots DTW | 33ms | ~15ms | Within budget |
| Transition render | 33ms | 33ms | Gated by FPS check |
| Crossfade duration | 300ms | 300ms | Configurable |

Fallback: DTW skips every other frame if 30-slot pass exceeds 33ms.

## Test Strategy

| File | What to Test | Approach |
|------|-------------|----------|
| `tests/gesture-store.test.js` | New | Start/stop recording, auto-stop, sample capping, overwrite, disconnect discard |
| `tests/dtw-matcher.test.js` | New | Match success, no-match, downsample, debounce, empty-gesture skip |
| `tests/image-cycler.test.js` | New | Pool init, wrap, empty pool |
| `tests/transition-renderer.test.js` | New | Fade state machine, FPS fallback, instant swap |
| `tests/sensor-mapper.test.js` | Rewrite | Energy output, direction, no scale, debounce |
| `tests/message-relay.test.js` | Update | New actions valid, focus rejected, gesture event format |
| `tests/device-manager.test.js` | Update | Remove focus, add cycle/record actions |

No migration required. This is a feature addition with removal of dead code.
