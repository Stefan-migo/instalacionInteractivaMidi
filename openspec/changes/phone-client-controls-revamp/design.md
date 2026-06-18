# Design: Phone Client Controls Revamp

## Technical Approach

Three-layer change (bridge → phone-client → p5-collage) that replaces incremental buttons with direct-value controls. The bridge protocol extends `formatActionMessage` to carry optional payloads. Phone-client UI swaps 6 removed stamp buttons for 2 sliders, a filter cycle button, and a touch pad. p5-collage `handleAction` gets 4 new cases that accept direct values instead of increments.

All layers maintained backward-compatible: old p5 code ignores payload-only fields; old phones still send `{ type: "action", action }` without payloads.

## Architecture Decisions

### Decision: Payload in action messages, not separate message type

**Choice**: Extend existing `type: "action"` messages with optional `value`, `dx`, `dy` fields. Bridge validates payload per action type, then relays the full message shape.

**Alternatives considered**: New message types (`type: "opacity"`, `type: "move"`, etc.) — more validation code, more relay branches, harder to backward-compat.

**Rationale**: The existing `type: "action"` dispatch path already works. Adding optional fields keeps the relay generic (`broadcastToPlayers(msg)`) and lets p5 `handleAction` parse payload when present. One switch to rule them all.

### Decision: Touch pad uses relative delta, not absolute position

**Choice**: Touch pad tracks `touchstart` → `touchmove` deltas, scales them from pad pixels to canvas pixels, sends relative `dx`/`dy` values.

**Alternatives considered**: Absolute mapping (tap position on pad → cell position on canvas) — requires knowing cell's current position on the phone side, adds complexity.

**Rationale**: Relative deltas match the existing `cellStates[slot].pos.x += dx` pattern in p5. Phone doesn't need to know canvas state. Dead zone of 2px prevents micro-jitter.

### Decision: Sliders send on `input` event (real-time), not `change`

**Choice**: Every slider `input` event fires `sendActionWithPayload`. Thumbnail updates from bridge confirmation; no local preview.

**Alternatives considered**: Throttled send (every 50ms) — adds complexity for marginal bandwidth saving. `change` event (on release) — feels laggy.

**Rationale**: 33ms sensor loop already saturates — one extra message per slider tick is negligible. Real-time feedback is critical for fine manipulation.

## Data Flow

```
Phone                    Bridge                        p5-collage
 │                        │                              │
 ├─ slider input ────────→│                              │
 │  {type:"action",       │  validateValueAction()        │
 │   action:"opacity",    │  → broadcastToPlayers() ─────→│
 │   value:75}            │                              │  handleAction(slot, 
 │                        │                              │    "opacity", imgLoader,
 │                        │                              │    {value:75})
 │                        │                              │  → s.opacity = 0.75
 │                        │                              │
 ├─ touch pad drag ──────→│                              │
 │  touchstart: origin     │  validateMovePayload()       │
 │  touchmove: delta       │  → broadcastToPlayers() ─────→│
 │  {type:"action",       │                              │  handleAction(slot,
 │   action:"move",       │                              │    "move", imgLoader,
 │   dx:96, dy:54}        │                              │    {dx:96, dy:54})
 │                        │                              │  → s.pos.x += 96
 │   touchend: stop        │                              │
 │                        │                              │
 ├─ filter tap ──────────→│                              │
 │  {type:"action",       │  validateFilterValue()       │
 │   action:"filter",     │  → broadcastToPlayers() ─────→│
 │   value:"sepia"}       │                              │  s.filterType = "sepia"
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `bridge/message-relay.js` | Modify | Expand VALID_ACTIONS, add VALID_VALUE_ACTIONS map, add validateValueAction(), add formatActionMessage(slot, action, payload) with optional payload |
| `bridge/index.js` | Modify | Use `relay.formatActionMessage(slot, msg.action, msg)` for all action broadcasts; record-start/record-stop still handled specially |
| `phone-client/index.html` | Modify | Remove 6 buttons; add opacity slider, rotation slider, filter button, touch pad div |
| `phone-client/app.js` | Modify | Remove locked/legacy click handlers; add slider input handlers, filter cycle state machine, touch pad touch/mouse handlers |
| `phone-client/style.css` | Modify | Grid 3-col→2-col; add input[type=range] vintage styling; add touch-pad, filter-btn, slider-row styles |
| `p5-collage/sketch.js` | Modify | handleAction refactored: signature becomes (slot, action, imgLoader, payload?), 4 new cases for opacity/rotation/filter/move, clamp position to canvas |
| `p5-collage/device-manager.js` | Modify | handleAction signature accepts 4th arg (payload), passes through to renderer.handleAction |
| `tests/message-relay.test.js` | Modify | VALID_ACTIONS assertions for removed/added actions; new tests for validateValueAction with valid/invalid payloads |

## Interfaces / Contracts

### Bridge Protocol — Action Messages with Payload

```js
// Simple action (no payload) — UNCHANGED
{ type: "action", action: "shuffle" }

// Value action — NEW PATTERN
{ type: "action", action: "opacity", value: 75 }         // 0–100 integer
{ type: "action", action: "rotation", value: 180 }        // 0–360 float
{ type: "action", action: "filter", value: "sepia" }     // one of FILTER_NAMES
{ type: "action", action: "move", dx: 96, dy: -54 }       // canvas px deltas
```

### VALID_VALUE_ACTIONS schema (new constant in message-relay.js)

```js
const VALID_VALUE_ACTIONS = {
  opacity:   { validator: v => typeof v === 'number' && v >= 0 && v <= 100 && Number.isInteger(v) },
  rotation:  { validator: v => typeof v === 'number' && isFinite(v) },
  filter:    { validator: v => FILTER_NAMES.includes(v) },
  move:      { validator: v => typeof v.dx === 'number' && typeof v.dy === 'number' && isFinite(v.dx) && isFinite(v.dy) },
};

const FILTER_NAMES = ['sepia', 'grayscale', 'cyanotype', 'polaroid', 'vintage', 'none'];
```

### formatActionMessage signature

```js
formatActionMessage(slot, action, payload = null) {
  const msg = { type: 'action', slot, action, ts: Date.now() };
  if (payload) {
    if (payload.value !== undefined) msg.value = payload.value;
    if (payload.dx !== undefined) { msg.dx = payload.dx; msg.dy = payload.dy; }
  }
  return msg;
}
```

### handleAction refactored signature (device-manager.js → sketch.js)

```js
// device-manager.js
handleAction(slot, action, payload = null) {
  if (!this.phoneSlots.has(slot)) return;
  this.renderer.handleAction(slot, action, this.imageLoader, payload);
}

// sketch.js — createRenderer()
handleAction(slot, action, imgLoader, payload = null) {
  const s = state.cellStates[slot];
  if (!s) return;
  switch (action) {
    case 'opacity':
      s.opacity = Math.max(0, Math.min(1, payload.value / 100));
      break;
    case 'rotation':
      s.pos.rotation = ((payload.value % 360) + 360) % 360;
      break;
    case 'filter':
      s.filterType = payload.value;
      break;
    case 'move':
      s.pos.x += payload.dx;
      s.pos.y += payload.dy;
      s.pos.x = Math.max(0, Math.min(1920 - s.pos.w, s.pos.x));
      s.pos.y = Math.max(0, Math.min(1080 - s.pos.h, s.pos.y));
      break;
    // ... existing cases unchanged ...
  }
}
```

### Touch Pad Math

```
scaleX = canvasWidth  / padElement.offsetWidth   // 1920 / padW
scaleY = canvasHeight / padElement.offsetHeight   // 1080 / padH

touchstart: record clientX, clientY as origin
touchmove:  deltaX = (clientX - originX) * scaleX
            deltaY = (clientY - originY) * scaleY
            if |deltaX| < deadZone(2*scaleX) → 0
            if |deltaY| < deadZone(2*scaleY) → 0
            send { action: "move", dx: deltaX, dy: deltaY }
            reset origin to current clientX, clientY (continuous tracking)
touchend:   reset origin, no message sent
```

Dead zone of 2px in pad space prevents micro-jitter. Origin resets each `touchmove` so deltas are incremental, not cumulative.

### Phone-client UI Component Tree

```
#app
├── header (.status-row)
│   ├── .slot-badge
│   ├── .slot-label
│   ├── .connection-status
│   └── .connection-text
├── #dashboard (.screen)
│   ├── .actions-grid (2-col)
│   │   ├── .action-btn[data-action=wizard]  — "Gesto"
│   │   └── .action-btn[data-action=shuffle] — "Cambiar foto"
│   ├── .filter-row
│   │   └── .filter-btn                      — cycles filter, shows name
│   ├── .slider-row (opacity)
│   │   ├── .slider-label                    — "Opacidad: 75%"
│   │   └── input[type=range]#opacity-slider (0-100)
│   ├── .slider-row (rotation)
│   │   ├── .slider-label                    — "Rotación: 45°"
│   │   └── input[type=range]#rotation-slider (0-360)
│   ├── .touch-pad-area
│   │   ├── .touch-pad-label                 — "Mover imagen"
│   │   └── #touch-pad (.touch-pad)          — ~200x200px square
│   ├── #thumbnail (.torn-container)
│   │   ├── img#cell-image
│   │   └── .thumbnail-placeholder
│   ├── #rec-indicator
│   ├── #gesture-status
│   └── #wizard-overlay (unchanged)
└── (permission screen, unchanged)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `message-relay.js` — VALID_ACTIONS now excludes removed actions | Assert `['shuffle','record-start','record-stop','opacity','rotation','filter','move']` |
| Unit | `message-relay.js` — `validateValueAction` for each new action with valid/invalid payloads | Valid: opacity(50), rotation(180), filter("sepia"), move({dx:10,dy:-5}); Invalid: opacity("bad"), filter("blur"), move({x:10}) |
| Unit | `message-relay.js` — `formatActionMessage` with and without payload | Ensure payload fields only appear when payload arg is provided |
| Unit | `message-relay.js` — `validateSensorMessage` passes action messages with extra payload fields | Backward compat: `{type:"action", action:"opacity", value:50}` passes validation |
| Unit | `device-manager.js` — handleAction passes payload to renderer | Mock renderer, verify `handleAction(slot, "opacity", mockLoader, {value:50})` calls renderer with value |
| Unit | `sketch.js` — handleAction cases for opacity/rotation/filter/move | Test set values, min/max clamping, cycle wrap |

## Migration / Rollout

No migration required. Bridge protocol is backward compatible:
- Old phones sending `{ type: "action", action: "shuffle" }` → still works, p5 handles it normally.
- New phones sending `{ type: "action", action: "opacity", value: 50 }` → old p5 receives it, falls through switch, no-op.
- Deploy bridge first (it validates new payloads), then phone-client + p5 together.

## Open Questions

- [ ] Touch pad orientation: should Y-axis deltas be inverted (finger down = cell down, or finger down = canvas up)? Proposal doesn't specify. Default: finger down = cell down (natural mapping).
- [ ] Phone rotation slider: should it snap or free-form? Proposal says slider 0-360°. Default: continuous, no snap.
