# Exploration: gesture-gallery

## 1. Current "Gesto" Button Location & Behavior

- **Location**: `phone-client/index.html` line 78 — inside the bottom sheet (`#tools-panel`), in the `.actions-grid` row, directly before "Cambiar foto".
  ```html
  <button class="action-btn stamp-btn" data-action="wizard" id="wizard-trigger">Gesto</button>
  ```
- **CSS class**: `action-btn stamp-btn` — styled like other action buttons in the grid.
- **Behavior** (`phone-client/app.js` lines 718-724):
  - If **recording** is active → sends `record-stop` action to stop recording.
  - If **not recording** → calls `wizOpen()` which launches the gesture wizard overlay.
  - Also gets a `.recording` CSS class added/removed based on `gesture-status` messages from the bridge.

## 2. Gesture Wizard Structure (5 Steps)

All wizard HTML lives in `phone-client/index.html` lines 138-174 inside `<div id="wizard-overlay">`. The state machine is in `phone-client/app.js` lines 241-328.

| Step | ID | Trigger | Behavior |
|------|----|---------|----------|
| **1. practice** | `wizard-step-practice` | `wizOpen()` default | Shows "Practicá tu gesto" + button. User taps → samples timer for 3s, counts samples. Then goes to **duration**. |
| **2. duration** | `wizard-step-duration` | After practice timer | Shows measured duration (`wizard-practice-duration`). User picks 2s/3s/4s/5s button → saves `wiz.chosenDuration`, goes to **countdown**. |
| **3. countdown** | `wizard-step-countdown` | After duration pick | Shows countdown number 3→2→1→go. On zero, goes to **recording** and sends `record-start` with `{ duration: wiz.chosenDuration }`. |
| **4. recording** | `wizard-step-recording` | After countdown | Shows "Grabando — mové el teléfono". Waits for `gesture-status` with `recording: false + gestureId` from bridge → goes to **confirmed**. |
| **5. confirmed** | `wizard-step-confirmed` | Auto from bridge msg | Shows "Gesto grabado — repetí el gesto para activarlo". Sets 4s auto-return timer → `wizClose()`. |

**Key functions**:
- `wizOpen()` — resets state, shows step-practice
- `wizClose()` — sends `record-stop` if currently recording, clears all timers, hides overlay
- `wizGoTo(step)` — hides all steps, shows named step
- `wizClearTimers()` — clears practice/countdown/autoReturn timers

**State object** (`wiz`): `{ step, chosenDuration, practiceStartTs, practiceSamples, practiceTimer, countdownTimer, countdownValue, autoReturnTimer }`

## 3. Client-Side Gesture Detection (Flick)

**`gestureDetector`** — defined inside the `devicemotion` listener at `phone-client/app.js` lines 378-420.

**How flick detection works**:
- Maintains `prevAccel` (last sample's accel x,y,z).
- On each `processMotion(accel)` call:
  1. Computes **jerk** (derivative of acceleration): `jerkX = ax - prevAccel.x`, etc.
  2. Computes `jerkMag = sqrt(jerkX² + jerkY² + jerkZ²)` — magnitude of the jerk vector.
  3. If `jerkMag > 15` AND not already triggered → sets `flickTriggered = true`.
  4. Once triggered, waits until `jerkMag < 10` (movement settled). On settle:
     - If `lastFlickTs` was >750ms ago → sends `sendGesture('flick')`.
     - Resets `flickTriggered`.
  5. If triggered but `elapsed > 200ms` without settling → resets anyway (timeout).

**processOrientation()** — empty, no tilt detection implemented yet.

**Data used**: Only `accelerationIncludingGravity` (x,y,z). Gyro and orientation are sent to bridge but not used client-side.

## 4. Bridge Gesture Recording Flow

### record-start
- Phone sends `sendActionWithPayload('record-start', { duration: wiz.chosenDuration })`.
- Bridge (`bridge/index.js` lines 204-216):
  - Calls `gestureStore.startRecording(slot)`.
  - Sends `{ type: 'gesture-status', recording: true }` back to phone.
  - Sets a `setTimeout` for the chosen duration → auto-calls `stopRecording`.
- GestureStore (`bridge/gesture-store.js`):
  - `startRecording(slot)`: creates `{ samples: [], startTs, lastTs: 0 }` for that slot.
  - `addSample(slot, data)`: called from `bridge/index.js` line 189 on every sensor message. Caps at 20Hz (50ms interval). Stores `{ accel, gyro, ts }`.
  - `stopRecording(slot)`: generates `gestureId = gesture_{slot}_{timestamp}`, stores samples under `this.gestures[slot]`, deletes recording buffer.

### record-stop
- Phone sends `sendAction('record-stop')` (e.g., when wizard is canceled while recording).
- Bridge (`bridge/index.js` lines 217-227):
  - Clears auto-stop timer.
  - Calls `gestureStore.stopRecording(slot)`.
  - Sends `{ type: 'gesture-status', recording: false, gestureId }` back to phone.
  - Broadcasts `gesture-event` with event `recorded` to all p5 players.

### Gesture matching (server-side)
- On every sensor message (`bridge/index.js` line 191): `dtwMatcher.addSample(slot, msg)`.
- If matched → broadcasts `gesture-event` with event `matched` and `action: 'cycle-next'`.

**Important**: Stored gesture is per-slot (`this.gestures[slot]`). Only ONE gesture per slot at a time. Discard happens on disconnect or new recording.

## 5. Actions Available

From `bridge/message-relay.js` lines 1-8 (`VALID_ACTIONS`):

| Action | Payload | Description |
|--------|---------|-------------|
| `shuffle` | none | Randomize cell image |
| `record-start` | `{ duration }` | Start gesture recording |
| `record-stop` | none | Stop gesture recording |
| `opacity` | `{ value }` 0-100 | Set cell opacity |
| `rotation` | `{ value }` -180 to 180 | Set cell rotation |
| `filter` | `{ value }` (name string) | Apply filter: sepia, grayscale, cyanotype, polaroid, vintage, none |
| `move` | `{ dx, dy }` | Move cell position |
| `scale` | `{ value }` 40-180 | Set cell scale % |
| `border-next` | none | Cycle border style |
| `cell-next` | none | Switch to next fragment |
| `cell-prev` | none | Switch to previous fragment |
| `bring-front` | none | Bring cell to front layer |

The DTW matcher's `defaultAction` is `cycle-next` (a p5-side action, not in VALID_ACTIONS — meaning matching fires a `gesture-event` with `action: 'cycle-next'` that p5 handles directly).

## 6. DTW Matcher — Can It Run Client-Side?

**Yes, absolutely.** Here's why:

- **Pure math**: `DTWMatcher` uses only basic arithmetic (sqrt, addition, array operations). No Node.js APIs, no dependencies, no file I/O.
- **Vector format**: 6D vectors `[accel.x, accel.y, accel.z, gyro.a, gyro.b, gyro.g]` — same data already available on the client (`lastSensor.accel` and `lastSensor.gyro`).
- **Algorithm**:
  - `_dtw(a, b)`: Classic O(n×m) DTW with euclidean distance, normalized by path length.
  - `_toVectors(samples)`: Maps `{ accel: {x,y,z}, gyro: {a,b,g} }` → `[x, y, z, a, b, g]` array.
  - `_euclideanDistance(a, b)`: Standard euclidean distance.
- **Config**: `threshold` (0.5), `downsampleHz` (10 → 100ms interval), `debounceMs` (1000), `defaultAction`.
- **What would need adapting**:
  - Replace `gestureStore.getGesture(slot)` with a local stored gesture reference.
  - Remove `slot` parameter — client only manages itself.
  - The sliding window, cooldown, and matching logic are all portable as-is.

**Data format for stored samples**:
```js
{ samples: [{ accel: {x,y,z}, gyro: {a,b,g}, ts: timestamp }] }
```

**Data format for live window**: same structure, but without `ts` (only accel + gyro).

**Key constraint**: The matcher expects samples at a controlled rate (downsampled to 10Hz via 100ms interval). The phone's sensor fires at ~30Hz (33ms sendInterval), so you'd need to add the same 100ms downsampling on the client side.

## 7. Bottom Sheet Structure

From `phone-client/index.html` lines 73-117 (`#tools-panel`):

```
#tools-panel.tools-panel.hidden
├── .tools-handle          (visual drag handle)
├── .actions-grid
│   ├── #wizard-trigger.action-btn.stamp-btn   → "Gesto"
│   └── [data-action="shuffle"].action-btn.stamp-btn → "Cambiar foto"
├── #bring-front-btn.stamp-btn.inline-btn      → "Ascender"
├── .button-pair
│   ├── #filter-btn.stamp-btn.inline-btn       → "Filtro"
│   └── #border-btn.stamp-btn.inline-btn       → "Borde"
├── .control-group (opacity)
├── .control-group (rotation)
├── .control-group (scale)
└── .control-group (tránsito)
    └── .button-pair
        ├── #cell-prev-btn → "← Anterior"
        └── #cell-next-btn → "Siguiente →"
```

Toggle: FAB button `#fab-btn` (shows `+` / `−`), `toggleTools()` at lines 113-126.

## 8. Existing `sendActionWithPayload` Patterns

**Definition** (`phone-client/app.js` lines 235-239):
```js
function sendActionWithPayload(action, payload) {
  ws.send(JSON.stringify({ type: 'action', action, ...payload }));
}
```
**Note**: It spreads `payload` at the top level of the message, NOT under a `value` key. The bridge's `formatActionMessage` checks for `payload.value` and `payload.dx/dy` explicitly.

**Known usages**:
| Line | Call | Payload |
|------|------|---------|
| 324 | `sendActionWithPayload('record-start', { duration: wiz.chosenDuration })` | `{ duration }` — read by bridge `parseRecordingDuration(msg)` |
| 445 | `sendActionWithPayload('filter', { value: name })` | `{ value: string }` |
| 448-459 | `sendActionWithPayload('border-next', {})` | Empty object — no value needed |
| 471 | `sendActionWithPayload('opacity', { value: val })` | `{ value: number }` |
| 485 | `sendActionWithPayload('rotation', { value: val })` | `{ value: number }` |
| 499 | `sendActionWithPayload('scale', { value: val })` | `{ value: number }` |
| 553 | `sendActionWithPayload('move', { dx: dx, dy: dy })` | `{ dx, dy }` |

**Bridge interpretation** (`message-relay.js` line 83-90): `formatActionMessage` cherry-picks known keys from the payload (`value`, `dx`, `dy`) and places them on the relayed message. Unknown keys are silently dropped.

---

## Ready for Proposal

Yes. The codebase has a clear, self-contained gesture pipeline with well-defined boundaries. Moving DTW matching to the client side is straightforward since it's pure math with no Node dependencies.
