# Delta for Phone UX — Functional Behavior

## ADDED Requirements

### Capability: Direct Cell Controls (`phone-direct-controls`)

The phone MUST replace the previous increment/decrement and toggle action buttons with direct-value controls: an opacity slider, a rotation slider, a filter cycle button, and a touch pad for position.

### Requirements

- **R-DC-1**: The phone MUST provide an opacity range slider (0–100) that sends `{ type: "action", action: "opacity", value: <int> }` on input change — no debounce, every `input` event.
- **R-DC-2**: The phone MUST provide a rotation range slider (0–360) that sends `{ type: "action", action: "rotation", value: <float> }` on input change.
- **R-DC-3**: The phone MUST provide a filter button that cycles through six states in order: sepia → grayscale → cyanotype → polaroid → vintage → none, wrapping to sepia after none. Each tap sends `{ type: "action", action: "filter", value: "<name>" }`.
- **R-DC-4**: The filter button MUST display the current filter name (capitalized, Spanish) as its visible label.
- **R-DC-5**: The phone MUST provide a touch pad that captures single-finger drag and sends `{ type: "action", action: "move", dx: <float>, dy: <float> }` where dx and dy are normalized to canvas-proportional units (percentage of canvas width/height scaled by 10).
- **R-DC-6**: The touch pad MUST apply a 3px dead zone: deltas below 3px SHALL NOT trigger a `move` action.
- **R-DC-7**: The touch pad MUST support both touch events (touchstart/touchmove/touchend) and mouse fallback (mousedown/mousemove/mouseup).
- **R-DC-8**: Removed action buttons SHALL NOT appear in the DOM: `flipH`, `flipV`, `lock`, `unlock`, `reset`. Their associated HTML elements, event listeners, and CSS rules MUST be deleted.
- **R-DC-9**: The existing "Gesto" wizard button and the "Shuffle" button MUST remain functional and unchanged.
- **R-DC-10**: All new controls MUST use the same WebSocket connection — action type remains `"action"` for all new actions. No new message types.

### Scenarios

#### DC-S1: Opacity slider adjusts cell opacity
- GIVEN the phone is connected and has an assigned slot
- WHEN the user drags the opacity slider to 75
- THEN the phone sends `{ type: "action", action: "opacity", value: 75 }`
- AND the bridge relays the message to p5
- AND the cell's opacity updates to 75%

#### DC-S2: Rotation slider sets exact angle
- GIVEN the phone is connected
- WHEN the user drags the rotation slider to 90
- THEN the phone sends `{ type: "action", action: "rotation", value: 90 }`
- AND the cell rotates to exactly 90°

#### DC-S3: Filter button cycles through filters
- GIVEN the phone is connected and the current filter is "none"
- WHEN the user taps the filter button
- THEN the phone sends `{ type: "action", action: "filter", value: "sepia" }`
- AND the button label updates to "Sepia"
- WHEN the user taps 5 more times
- THEN the filter wraps back to "none" and the label shows "Ninguno"

#### DC-S4: Touch pad moves cell
- GIVEN the phone is connected and a cell is visible on canvas
- WHEN the user drags 50px right and 30px down on the touch pad
- THEN the phone sends `{ type: "action", action: "move", dx: <normalized>, dy: <normalized> }`
- AND the cell's position shifts proportionally on the canvas

#### DC-S5: Dead zone suppresses jitter
- GIVEN the phone touch pad is active
- WHEN the user touches and holds without moving (< 3px delta)
- THEN no `move` action is sent

#### DC-S6: Removed buttons are absent
- GIVEN the phone client loads
- WHEN inspecting the DOM
- THEN there are no elements with IDs `btn-fliph`, `btn-flipv`, `btn-lock`, `btn-unlock`, `btn-reset`
- AND the wizard and shuffle buttons are still present and functional

## MODIFIED Requirements

### Protocol Messages

(Previously: table listed p5→Bridge `image-update`, Bridge→Phone `cell-image`, Phone→Bridge `record-start` only)

| Direction | Type | Payload | Trigger |
|-----------|------|---------|---------|
| p5 → Bridge | `image-update` | `{ type, slot, imageFile }` | After initCell / cycle / shuffle |
| Bridge → Phone | `cell-image` | `{ type, slot, imageFile, imageUrl }` | On assign + every update |
| Phone → Bridge | `action` | `{ type: "action", action: "record-start", duration? }` | Wizard countdown complete |
| Phone → Bridge | `action` | `{ type: "action", action: "opacity", value: <0-100> }` | Opacity slider input |
| Phone → Bridge | `action` | `{ type: "action", action: "rotation", value: <0-360> }` | Rotation slider input |
| Phone → Bridge | `action` | `{ type: "action", action: "filter", value: "<name>" }` | Filter button tap |
| Phone → Bridge | `action` | `{ type: "action", action: "move", dx: <float>, dy: <float> }` | Touch pad drag |
