# Spec: Phone UX — Functional Behavior

## Overview

Defines functional behavior extensions for the phone client beyond visual design: cell image thumbnail relay and the multi-step gesture recording wizard. These capabilities share the phone client as their target device and rely on the existing WebSocket protocol between phone, bridge, and p5 collage.

This spec complements [`openspec/specs/phone-style/spec.md`](../phone-style/spec.md) — visual design is covered there; behavior and protocol are covered here.

---

## Capability: Cell Image Thumbnail (`phone-image-display`)

### Overview

The phone MUST display the current cell image assigned to its slot as a thumbnail in the dashboard. The bridge MUST maintain a `slotImageMap` to track current image state per slot, relayed from p5 on every image change.

### Requirements

- **R-THUMB-1**: The bridge MUST maintain `slotImageMap` — a `Map<number, {imageFile, imageUrl}>` keyed by slot number, storing the current image file name and its served URL.
- **R-THUMB-2**: The p5 collage MUST send `{ type: "image-update", slot, imageFile }` to the bridge after every action that changes the displayed image: `initCell`, `cycle-next`, `cycle-prev`, and `shuffle`.
- **R-THUMB-3**: The bridge MUST relay `{ type: "cell-image", slot, imageFile, imageUrl }` to the assigned phone on every `image-update` from p5.
- **R-THUMB-4**: The bridge MUST also send `cell-image` to a phone immediately on slot assignment, if `slotImageMap` already has an entry for that slot.
- **R-THUMB-5**: The phone MUST render the received `imageUrl` as an `<img>` thumbnail in the dashboard area previously occupied by the sensor visualization bars.
- **R-THUMB-6**: The thumbnail MUST update immediately (same frame) when a `cell-image` message is received — no polling, no stale state.

### Scenarios

#### T-S1: Phone connects and receives current image
- GIVEN a phone connects to the bridge
- WHEN the bridge assigns a slot that already has an image in `slotImageMap`
- THEN the bridge sends `{ type: "cell-image", slot, imageFile, imageUrl }` to the phone
- AND the phone renders the thumbnail

#### T-S2: Image changes via cycle
- GIVEN the phone is connected and has a thumbnail
- WHEN the user triggers `cycle-next` or `cycle-prev`
- THEN p5 sends `{ type: "image-update", slot, imageFile }` to the bridge
- AND the bridge relays `cell-image` to the phone
- AND the thumbnail updates with the new image

#### T-S3: Image changes via shuffle
- GIVEN the phone is connected and has a thumbnail
- WHEN the user triggers `shuffle`
- THEN p5 sends `image-update` to the bridge
- AND the bridge relays `cell-image` to the phone
- AND the thumbnail updates with the new image

---

## Capability: Gesture Recording Wizard (`phone-gesture-wizard`)

### Overview

The phone MUST replace the single "Record" button with a multi-step guided wizard. The bridge MUST accept an optional `duration` parameter on `record-start` with a default of 3000ms, minimum 1000ms, and maximum 5000ms.

### Wizard Steps

The wizard follows five sequential steps, all cancellable:

1. **Practice** — User taps to record motion locally for ~3 seconds. The system calculates the gesture's elapsed time and proposes a rounded duration.
2. **Duration Picker** — User selects desired recording duration: 2s, 3s (default), 4s, or 5s.
3. **Countdown** — 3-2-1 countdown displayed before recording starts.
4. **Recording** — Live indicator during capture at the chosen duration.
5. **Confirm** — "Gesto grabado" message with instruction to repeat the gesture to activate it.

### Requirements

- **R-WIZ-1**: The phone MUST display a "Gestos" button that opens the gesture gallery overlay (defined in `phone-gesture-gallery`). The wizard SHALL only open via "Crear mi gesto" inside the gallery. *(Migration: button label changed from "Gesto", which previously opened the wizard directly.)*
- **R-WIZ-2**: The wizard MUST be implemented as an overlay on the phone client, showing one step at a time.
- **R-WIZ-3**: The wizard MUST support cancellation at any step — dismissing returns to the normal dashboard with no pending recording state.
- **R-WIZ-4**: The practice step MUST record motion locally (using `lastSensor` data, no bridge roundtrip) and calculate the gesture's elapsed duration.
- **R-WIZ-5**: The duration picker MUST offer 2s, 3s, 4s, and 5s options, with 3s as default.
- **R-WIZ-6**: The countdown MUST display 3, 2, 1 sequentially at 1-second intervals.
- **R-WIZ-7**: The recording step MUST send `{ type: "action", action: "record-start", duration }` to the bridge with the chosen duration in milliseconds.
- **R-WIZ-8**: The confirm step MUST display "Gesto grabado" with the instruction "Repetí el gesto para activarlo".
- **R-WIZ-9**: The bridge MUST accept an optional `duration` field on `record-start` messages, defaulting to 3000ms.
- **R-WIZ-10**: The bridge MUST validate and clamp duration: min 1000ms, max 5000ms. Values outside this range SHALL be clamped.
- **R-WIZ-11**: The bridge MUST fall back to 3000ms if duration is missing, `NaN`, `null`, not a number, or negative.
- **R-WIZ-12**: All changes MUST be backward compatible — existing phones sending `record-start` without a `duration` field continue to work with 3000ms default.

### Scenarios

#### W-S1: Full wizard flow (via gallery)
- GIVEN the phone is connected and the user taps "Gestos"
- WHEN the gallery opens
- THEN 3 gesture cards + "Crear mi gesto" are shown
- WHEN the user taps "Crear mi gesto"
- THEN the wizard practice step is shown
- WHEN the user taps to practice and records motion for ~3s
- THEN the duration picker shows with the suggested duration
- WHEN the user selects 4s
- THEN a 3-2-1 countdown plays
- WHEN the countdown finishes
- THEN recording starts for 4s with a live indicator
- WHEN recording completes
- THEN "Gesto grabado" is displayed
- AND the user is instructed to repeat the gesture to activate it

#### W-S2: Backward compatibility (legacy phone)
- GIVEN a legacy phone client that does not send `duration` on `record-start`
- WHEN the bridge processes the message
- THEN the bridge uses 3000ms as the recording duration
- AND recording proceeds normally with auto-stop at 3s

#### W-S3: Wizard dismissal
- GIVEN the wizard is open at any step (practice, duration, countdown, recording, confirm)
- WHEN the user taps dismiss/cancel
- THEN the wizard closes and returns to the normal dashboard
- AND no pending recording state remains

#### W-S4: Invalid duration handling
- GIVEN a phone sends `record-start` with `duration: "abc"` or `duration: -1000`
- WHEN the bridge processes the message
- THEN the bridge clamps to 3000ms (default)
- AND recording proceeds normally

---

## Affected Modules

| Module | Impact | Description |
|--------|--------|-------------|
| `bridge/index.js` | Modified | `slotImageMap` state, `image-update` handler, `cell-image` relay, duration-aware `record-start` |
| `bridge/message-relay.js` | Modified | `formatCellImageMessage()`, `parseRecordingDuration()` |
| `phone-client/app.js` | Modified | `cell-image` listener, wizard state machine, remove sensor bar rendering |
| `phone-client/index.html` | Modified | Thumbnail container, wizard overlay, wizard trigger button |
| `phone-client/style.css` | Modified | Thumbnail and wizard styles |
| `p5-collage/sketch.js` | Modified | `currentImageFile` tracking, `sendImageUpdate()` at initCell/cycle/shuffle |
| `tests/message-relay.test.js` | Modified | 13 new unit tests for relay and duration parsing |

## Protocol Messages

| Direction | Type | Payload | Trigger |
|-----------|------|---------|---------|
| p5 → Bridge | `image-update` | `{ type, slot, imageFile }` | After initCell / cycle / shuffle |
| Bridge → Phone | `cell-image` | `{ type, slot, imageFile, imageUrl }` | On assign + every update |
| Phone → Bridge | `action` | `{ type: "action", action: "record-start", duration? }` | Wizard countdown complete |
