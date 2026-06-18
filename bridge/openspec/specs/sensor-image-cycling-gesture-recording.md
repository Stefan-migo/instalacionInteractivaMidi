# Gesture-Recording Specification

## Purpose

Allow a phone to record short (~1–2s) accel + gyro sequences and store them on the bridge per slot. Recorded gestures feed into the DTW matcher for action recognition.

## Requirements

### Requirement: Record-Mode Toggle

Phone SHALL start recording via `{ type: "action", action: "record-start" }` and stop via `{ type: "action", action: "record-stop" }`. Bridge enters/leaves capture mode for that slot.

#### Scenario: Happy path record

- GIVEN phone is assigned slot 5
- WHEN phone sends `record-start`, moves for 1s, then sends `record-stop`
- THEN bridge stores all accel+gyro samples received between the two messages at `bridge.gestures[5]`

#### Scenario: Auto-stop at 2 seconds

- GIVEN phone sent `record-start` for slot 5
- WHEN 2 seconds pass without `record-stop`
- THEN bridge auto-stops and stores captured samples up to the 2s mark

#### Scenario: Stop without start is ignored

- GIVEN phone sends `record-stop` but was not recording
- THEN bridge ignores the message (no-op, warning log)

### Requirement: Sample Capping

Bridge MUST cap captured samples at 20Hz (50ms intervals). This caps max storage at ~40 samples per 2s recording.

#### Scenario: Sample deduplication

- GIVEN sensor data arrives at 60Hz
- WHEN bridge captures during recording
- THEN only every 3rd frame is stored (~20Hz effective rate)

### Requirement: Per-Slot In-Memory Storage

Recorded gesture is stored as `{ samples: [{ accel, gyro, ts }], action: string }` keyed by slot number. Max one gesture per slot. No file persistence.

#### Scenario: Overwrite previous

- GIVEN slot 5 has a recorded gesture
- WHEN user records a new gesture
- THEN old gesture data is replaced

#### Scenario: No persistence

- GIVEN bridge has recorded gestures in memory
- WHEN bridge process exits and restarts
- THEN gesture store is empty

### Requirement: Dashboard Visual Feedback

Phone client dashboard MUST show recording status: idle (no indicator), recording (pulsing red dot + "Recording..." label).

#### Scenario: Status indicator

- GIVEN phone is not recording
- WHEN bridge sends status message indicating recording state
- THEN dashboard shows no recording indicator or shows "Idle"

- GIVEN phone enters record mode
- WHEN bridge confirms recording state
- THEN dashboard shows pulsing red dot

#### Scenario: Disconnect during recording

- GIVEN phone disconnects while recording
- WHEN bridge detects disconnect
- THEN bridge discards the partial recording for that slot
