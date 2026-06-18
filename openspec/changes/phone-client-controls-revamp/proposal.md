# Proposal: Phone Client Controls Revamp

## Intent

Replace the current phone-client's coarse increment/decrement buttons with direct-value controls (sliders, touch pad, filter selector). The phone should offer fine-grained manipulation of the cell image — opacity, rotation, filter, and position — not just toggles.

## Scope

### In Scope
- Replace `opacityUp`/`opacityDown` with a native range slider (0–100)
- Add rotation slider (0–360°)
- Add filter button cycling: sepia → grayscale → cyanotype → polaroid → vintage → none
- Add touch pad for X/Y position control (canvas-proportional mapping)
- Remove buttons: `flipH`, `flipV`, `lock`, `unlock`, `reset`; keep only `wizard` and `shuffle`
- Extend bridge protocol for value-payload actions (`opacity`, `rotation`, `filter`, `move`)
- Update p5 `handleAction` to accept direct values instead of increments
- Maintain existing Papel y Tinta aesthetic for all new controls
- Update tests in `tests/message-relay.test.js`

### Out of Scope
- Adding new filters beyond the list (sepia, grayscale, cyanotype, polaroid, vintage, none)
- Touch pad gestures (pinch, multi-touch) — single-finger drag only
- Phone-side sensor visualization (already removed in phone-ux spec)
- Any change to the gesture wizard or recording flow

## Capabilities

### New Capabilities
- None — all additions extend existing capabilities

### Modified Capabilities
- `phone-ux`: New action types with value payloads (`opacity`, `rotation`, `filter`, `move`). Touch pad interaction model. Protocol extensions for value-bearing actions.
- `phone-style`: Styling for range sliders, touch pad (canvas-proportional square), filter button with live label.

## Approach

Three-layer change:

1. **Bridge** — Extend `VALID_ACTIONS` in `message-relay.js` with the new value-bearing action types. Add validation for their payloads (`opacity`: 0–100 int, `rotation`: 0–360 float, `filter`: one of the allowed names, `move`: {dx, dy} floats). `formatActionMessage` becomes `formatActionPayloadMessage(slot, action, payload)`. `relay.formatActionMessage` calls stay unchanged for legacy actions.

2. **Phone-client** — Restructure dashboard layout: 2-column grid (wizard, shuffle) + filter button below, then opacity slider + rotation slider, then touch pad. Remove all removed buttons from HTML. Wire slider `input` events to `sendActionWithPayload`. Touch pad tracks `touchstart`/`touchmove`/`touchend` (and mouse fallback), normalizes deltas to canvas space, sends `move` with dx/dy. Filter button cycles and shows current name.

3. **p5-collage** — `sketch.js` `handleAction` adds cases for direct-value actions: `opacity` (set `s.opacity = msg.value / 100`), `rotation` (set `s.rotation = msg.value`), `filter` (set `s.filterType = msg.value`), `move` (add `dx`, `dy` to `s.pos.x`, `s.pos.y` + clamp). `device-manager.js` `handleAction` passes full message instead of just action string.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `phone-client/index.html` | Modified | Remove 6 buttons, add sliders, touch pad, filter btn |
| `phone-client/app.js` | Modified | Slider/touchpad/filter event wiring, new message types |
| `phone-client/style.css` | Modified | Slider, touch pad, filter button styles (vintage) |
| `bridge/message-relay.js` | Modified | New VALID_ACTIONS, payload validation, format helpers |
| `bridge/index.js` | Modified | Pass full action payload to broadcast |
| `p5-collage/sketch.js` | Modified | handleAction cases for direct-value actions |
| `p5-collage/device-manager.js` | Modified | Pass full msg object to renderer.handleAction |
| `tests/message-relay.test.js` | Modified | Tests for new action types and payload validation |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Touch pad precision feels off on small screens | Med | Normalize touch deltas to percentage of pad size; add dead zone |
| Slider range (0–360 rotation) conflicts with sensor mapping | Med | SensorMapper rotates relative; slider sets absolute — document as distinct modes |
| Existing tests break from removed actions | Low | Update test fixtures in same PR; CI will catch |

## Rollback Plan

Revert all files in the PR. Bridge protocol is backward compatible — old phones still send `type: "action"` with just `action`. If the phone-client HTML/CSS/JS is reverted, the bridge and p5 changes can be reverted independently without breaking old clients.

## Dependencies

None.

## Success Criteria

- [ ] Phone sends `{ type: "action", action: "opacity", value: 75 }`; p5 cell opacity sets to 75%
- [ ] Phone sends rotation value; p5 cell rotation sets to that exact angle
- [ ] Phone filter button cycles through all 6 filters; p5 matches
- [ ] Touch drag on pad moves cell proportionally on canvas; position clamped to canvas bounds
- [ ] All removed buttons are gone; wizard and shuffle still work
- [ ] Sliders, touch pad, and filter button render with vintage visual style (no rounded corners, ink-stamp borders, paper colors)
- [ ] Existing message-relay tests pass + new tests for value-payload validation
