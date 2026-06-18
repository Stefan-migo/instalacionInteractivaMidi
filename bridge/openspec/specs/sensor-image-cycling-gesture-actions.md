# Gesture-Actions Specification

## Purpose

Match real-time sensor input against recorded gestures using Dynamic Time Warping (DTW). On match, bridge fires a configured action to the p5 collage.

## Requirements

### Requirement: DTW Matching

Bridge MUST implement DTW to compare incoming sensor frames (downsampled to ~10Hz) against stored gesture samples. Match fires when DTW distance is below a configurable threshold.

#### Scenario: Gesture recognized

- GIVEN slot 3 has a recorded gesture `{ samples: [...], action: "cycle-next" }`
- WHEN real-time sensor input matches within threshold
- THEN bridge sends `{ type: "action", slot: 3, action: "cycle-next" }` to all p5 clients

#### Scenario: No match (distance too high)

- GIVEN slot 3 has a recorded gesture
- WHEN DTW distance >= threshold
- THEN no action is sent for slot 3

### Requirement: Input Downsampling

Sensor input for DTW MUST be downsampled to ~10Hz (every 100ms) regardless of sensor input rate. This keeps match computation bounded.

#### Scenario: Downsampled match

- GIVEN sensor data arrives at 60Hz
- WHEN bridge processes for DTW
- THEN bridge picks every 6th frame (~10Hz) for comparison

### Requirement: Match Debounce

Gesture match SHALL fire at most once per 1000ms per slot to prevent double-triggering.

#### Scenario: Cooldown suppresses rapid matches

- GIVEN a gesture match fired at T=0 for slot 3
- WHEN another match occurs at T=200ms
- THEN action is suppressed
- WHEN another match occurs at T=1100ms
- THEN action fires normally

### Requirement: No Gesture = Skip

If a slot has no recorded gesture, DTW matching MUST be skipped entirely for that slot.

#### Scenario: No gesture stored

- GIVEN slot 3 has no recorded gesture
- WHEN real-time sensor data arrives for slot 3
- THEN bridge skips DTW processing for slot 3 (no-op)

### Requirement: Supported Actions

Gestures SHALL support these action targets: `"cycle-next"`, `"cycle-prev"`, `"blend-mode-next"`, `"blend-mode-prev"`, `"transition-toggle"`, or any user-defined string.

#### Scenario: Valid action dispatched

- GIVEN matched gesture stores `action: "transition-toggle"`
- WHEN match fires
- THEN bridge sends that exact action string in the message

### Requirement: Performance Budget

DTW comparison for all active slots MUST complete within 33ms total. If exceeded, bridge SHOULD reduce matching frequency (e.g., every 2nd sensor frame).

#### Scenario: 30-slot matching

- GIVEN 30 active slots, each with a recorded gesture (~40 samples @ 20Hz)
- WHEN DTW runs for all slots in one cycle
- THEN total wall-clock time for all comparisons stays under 33ms

#### Scenario: Budget overflow fallback

- GIVEN 30-slot DTW takes 50ms
- WHEN bridge detects overshoot
- THEN bridge matches every 2nd sensor frame (skipping every other frame)
