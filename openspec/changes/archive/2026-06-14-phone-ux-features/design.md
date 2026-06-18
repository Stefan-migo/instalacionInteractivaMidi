# Design: Phone UX Features

## Technical Approach

Three independent features, ordered to minimize rework: remove sensor bars (clears space in HTML/CSS/JS) → cell image thumbnail (reuses the freed DOM area) → gesture wizard (standalone UI overlay). Bridge becomes state-aware of per-slot image ownership. Phone client adds a multi-step state machine for gesture recording. All changes backward-compatible — existing phones without the wizard or duration field continue to work.

## Architecture Decisions

### Decision: slotImageMap in bridge index.js, not message-relay.js

**Choice**: Plain `Record<number, {imageFile, imageUrl}>` stored in `bridge/index.js`.
**Alternatives**: Store in `MessageRelay` class; store in a new `ImageState` module.
**Rationale**: The map is connection-level state, not message formatting logic. `MessageRelay` handles stateless message shaping. Storing elsewhere would cross module boundaries unnecessarily. Index.js already owns `phoneConnections` and `p5Players` — this state lives alongside them.

### Decision: Track `currentImageFile` in p5 cell state

**Choice**: Add `s.currentImageFile` to cell state, updated on `initCell`, `cycle`, and `shuffle`.
**Alternatives**: Extract filename from `s.cell.imageFile` (breaks on cycle, since cycler picks from a pool outside the assigned cell); parse the image object (tight coupling, fragile).
**Rationale**: The filename must survive image object lookups. Cycled images come from a shared pool, not the slot's original cell. A dedicated property is explicit and testable.

### Decision: Wizard as in-app overlay (app.js), not separate file

**Choice**: Wizard state machine lives in `phone-client/app.js`.
**Alternatives**: Extract to `phone-client/wizard.js`; third script tag.
**Rationale**: The wizard shares closure state (`ws`, `slot`, `recording`, `sendAction()`). Extracting would require passing these or making them module-scoped. For ~100 lines of state machine, inline is simpler and keeps the script count at 2 (torn-clip-path.js + app.js).

## Data Flow

```
Phone connects:
  phone ──register──→ bridge ────assign msg────→ p5
                         │                          │
                         │  (check slotImageMap)     │ initCell sets s.img
                         │                          │
                         └──cell-image──→ phone      │
                                                     │
                          p5 ──image-update──→ bridge
                                                  │
                                                  └──cell-image──→ phone

Gesture recording:
  phone ──record-start{duration}──→ bridge
                                       │
                                       ├── gestureStore.startRecording(slot)
                                       └── setTimeout(stop, duration)
```

## File Changes

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `bridge/index.js` | Modify | ~+25 | slotImageMap; image-update handler (player msgs); duration param on record-start; cell-image relay to phone on assign |
| `bridge/message-relay.js` | Modify | ~+5 | New `formatCellImageMessage()` method |
| `phone-client/index.html` | Modify | ~-8/+20 | Remove `.sensors` div; add `#thumbnail` container; add wizard overlay HTML |
| `phone-client/style.css` | Modify | ~-30/+40 | Remove `.sensors` / `.sensor-row` / `.sensor-bar` / `.sensor-fill` / `.disconnected .sensor-fill`; add `#thumbnail`, `.wizard-overlay`, `.wizard-step` styles |
| `phone-client/app.js` | Modify | ~-10/+130 | Remove sensor bar DOM refs and update code; add `#cell-image` ref + `cell-image` message handler; add wizard state machine (5 steps + transitions) |
| `p5-collage/sketch.js` | Modify | ~+15 | Track `currentImageFile` in cell state; send `image-update` via `ws` after initCell, cycle, shuffle |

## Interfaces / Contracts

### New WebSocket messages

| Direction | Type | Payload | Trigger |
|-----------|------|---------|---------|
| p5 → Bridge | `image-update` | `{ type, slot, imageFile }` | After initCell / cycle / shuffle |
| Bridge → Phone | `cell-image` | `{ type, slot, imageFile, imageUrl }` | On phone assign + on every update |

### Modified WebSocket messages

| Direction | Type | Field Change | Default | Validation |
|-----------|------|-------------|---------|------------|
| Phone → Bridge | `action` (record-start) | Added optional `duration` (ms) | 3000 | Min 1000, Max 5000 |

### Bridge: slotImageMap

```
// bridge/index.js
const slotImageMap = {};

// On image-update:
slotImageMap[msg.slot] = {
  imageFile: msg.imageFile,
  imageUrl: `/images/content/${msg.imageFile}`
};

// On phone assign:
if (slotImageMap[slot]) {
  ws.send(JSON.stringify(relay.formatCellImageMessage(slot,
    slotImageMap[slot].imageFile, slotImageMap[slot].imageUrl));
}
```

### Bridge: duration handling

```javascript
// record-start handler, replacing hardcoded 3000:
const duration = Math.min(Math.max(msg.duration || 3000, 1000), 5000);
// use `duration` in setTimeout
```

### p5: image tracking in cell state

```javascript
// In initCell:
state.cellStates[slot].currentImageFile = cell.imageFile;

// In cycle handler (after imageCycler.cycle):
s.currentImageFile = result.current;

// In shuffle:
s.currentImageFile = newCell.imageFile;

// After any image change (at end of initCell / cycle / shuffle):
if (typeof ws !== 'undefined' && ws?.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify({ type: 'image-update', slot, imageFile: s.currentImageFile }));
}
```

### Phone: wizard state machine

```
                 ┌─────────────────────────────────────┐
                 │  Steps: idle → practice → duration  │
                 │  → countdown → recording → confirm  │
                 │  (cancel at any step → idle)         │
                 └─────────────────────────────────────┘
```

States defined in app.js as a `wizardState` object:
- `step`: `null` (idle) | `'practice'` | `'duration'` | `'countdown'` | `'recording'` | `'confirm'`
- Practice: taps `setTimeout`-based local recording (sensor data from `lastSensor`), calculates elapsed time → suggests rounded duration
- Duration picker: 2s / 3s / 4s / 5s buttons → sets wizard duration
- Countdown: 3-2-1 with `setInterval` → calls `sendAction('record-start')` with `duration` payload
- Confirm: shows "Gesto grabado" message for 3s → back to idle

### Phone: sensor bar removal (keep listeners)

```
KEEP:                                           REMOVE:
  devicemotion listener                           accelBar.style.transform update
  deviceorientation listener                      gyroBar.style.transform update
  gestureDetector.processMotion()                 orientBar.style.transform update
  lastSensor updates                              $('accel-bar'), $('gyro-bar'), $('orient-bar') refs
  sendSensor() interval                           sensor DOM from index.html
                                                  sensor CSS from style.css
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `MessageRelay.formatCellImageMessage()` | New test in `message-relay.test.js` — verify type, slot, imageFile, imageUrl fields |
| Unit | Bridge `record-start` duration parsing | New test or add to bridge tests — verify default 3000, override to 4000, cap at 5000, floor at 1000 |
| Integration | p5 → Bridge → Phone image relay | Manual (automated integration requires WebSocket test infra) |
| Visual | Wizard steps display, thumbnail rendering | Manual on device |
| Regression | All existing message-relay, gesture-store, bridge tests | `npm test` — should pass with no changes |

## Migration / Rollout

No migration required. Duration param defaults to 3000ms for legacy phones. Wizard is client-side only — old phone clients see no change. Sensor bar removal affects only the visual layer.

## Implementation Order

### Batch 1: Clear space + thumbnail base
1. Delete sensor bar HTML/CSS/JS from phone-client
2. Add thumbnail HTML element + CSS
3. Bridge slotImageMap + image-update handler + cell-image relay
4. p5 image tracking + image-update on initCell
5. Phone renders thumbnail on connect and updates

### Batch 2: Gesture wizard
1. Bridge duration param on record-start
2. p5 image-update on cycle and shuffle (if not in batch 1)
3. Wizard overlay HTML/CSS
4. Wizard state machine in app.js
5. Duration picker and countdown logic

### Batch 3: Verify
1. `npm test` all pass
2. Manual: thumbnail on connect, thumbnail update, wizard full flow, legacy backward compat
3. Edge cases: record-start without duration, phone disconnects mid-wizard, shuffle + cycle image sync

## Open Questions

- [ ] Should the practice step actually record to bridge or compute locally? (Spec implies local — compute from `lastSensor` without bridge roundtrip)
- [ ] Wizard UI: cancel button always visible, or hidden during countdown?
- [ ] Thumbnail aspect ratio: crop to square, or letterbox in the thumbnail container?
