# Spec: Phone UX Features

## Context

This spec defines three delta features extending the existing `phone-style` capability (`openspec/specs/phone-style/spec.md`). It does NOT modify the existing visual design spec — it adds new behavior and removes sensor bars from the dashboard.

## Requirements

### R1: Cell Image Thumbnail

The phone MUST display the current cell image assigned to its slot as a thumbnail in the dashboard's sensor bar area. The bridge MUST maintain a `slotImageMap: Map<number, {imageFile, imageUrl}>` to track current image state per slot.

- [ ] R1.1: Phone displays current assigned cell image as thumbnail in sensor bar area
- [ ] R1.2: Bridge maintains `slotImageMap` — keyed by slot number, stores `imageFile` and `imageUrl`
- [ ] R1.3: Bridge sends `{type: "cell-image", slot, imageFile, imageUrl}` to phone on assign and on every update
- [ ] R1.4: p5 sends `{type: "image-update", slot, imageFile}` to bridge after cycle-next, cycle-prev, and shuffle
- [ ] R1.5: Thumbnail updates immediately when image changes — no stale state

### R2: Gesture Recording Wizard

The phone MUST replace the single "Record" button with a multi-step guided wizard. The bridge MUST accept an optional `duration` parameter on `record-start` with a default of 3000ms and maximum of 5000ms.

- [ ] R2.1: Phone shows practice/record wizard replacing the single Record button
- [ ] R2.2: Practice step: user taps to record motion for ~3s → system calculates gesture duration
- [ ] R2.3: Duration picker: user selects from 2s/3s/4s/5s (max 5s)
- [ ] R2.4: Countdown: 3-2-1 displayed before recording starts
- [ ] R2.5: Recording: live indicator during capture
- [ ] R2.6: Bridge accepts `duration` param (ms) on `record-start` — default 3000ms, max 5000ms
- [ ] R2.7: Bridge falls back to 3000ms if duration is missing, invalid, or exceeds 5000ms
- [ ] R2.8: Confirm step shows "Gesto grabado" with instruction to repeat to activate
- [ ] R2.9: Wizard can be dismissed at any step → returns to normal dashboard

### R3: Remove Sensor Visualization Bars

The phone MUST remove accelerometer, gyroscope, and orientation visualization bars from the dashboard. Sensor listeners and data transmission MUST remain active.

- [ ] R3.1: Accelerometer, gyroscope, orientation bars removed from dashboard DOM and styles
- [ ] R3.2: `devicemotion` and `deviceorientation` listeners remain active
- [ ] R3.3: Sensor data continues to be sent to bridge for gesture detection
- [ ] R3.4: Sensor bar area replaced with thumbnail container (R1)

## Scenarios

### S1: Phone connects and sees thumbnail
- GIVEN a phone connects to the bridge
- WHEN the bridge assigns a slot
- THEN the bridge sends `cell-image` with the current image file and URL
- AND the phone renders the thumbnail in the dashboard
- WHEN the user cycles the image (cycle-next)
- THEN p5 sends `image-update` → bridge relays `cell-image` → thumbnail updates

### S2: Full gesture wizard flow
- GIVEN the phone is connected
- WHEN the user taps "Practice" and records motion for ~3s
- THEN the system calculates the gesture's duration
- WHEN the user selects 4s from the duration picker (2s/3s/4s/5s)
- THEN a 3-2-1 countdown plays
- WHEN recording completes after 4s
- THEN "Gesto grabado" is displayed with instruction to repeat to activate
- AND when the user repeats the gesture, DTW matches and the action triggers

### S3: Wizard flow with default duration (backward compatibility)
- GIVEN a legacy phone client sends `record-start` without a `duration` field
- WHEN the bridge processes the message
- THEN it uses the default 3000ms for the recording timer
- AND recording proceeds normally with auto-stop at 3s

### S4: Wizard dismissal
- GIVEN the wizard is open at any step
- WHEN the user taps dismiss/back
- THEN the wizard closes and returns to the normal dashboard
- AND no pending recording state remains

### S5: Sensor bar removal — no regression
- GIVEN the phone is connected and streaming sensor data
- WHEN the dashboard renders
- THEN no sensor visualization bars are visible
- WHEN `devicemotion` fires
- THEN sensor data is still sent to the bridge
- AND gesture recording via the wizard works normally

## Acceptance Criteria

- All unit tests pass (`npm test`)
- Manual verification:
  - [ ] Thumbnail appears on connect with correct image
  - [ ] Thumbnail updates on cycle-next, cycle-prev, and shuffle
  - [ ] Wizard: practice → duration picker → countdown → record → confirm
  - [ ] Legacy `record-start` without duration still works
  - [ ] No sensor bars visible on dashboard
  - [ ] Gesture detection still functions after bar removal
