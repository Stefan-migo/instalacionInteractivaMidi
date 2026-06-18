# Image-Cycling Specification

## Purpose

Replace the unused sensor-to-scale mapping with movement-driven image cycling. Phone motion (accel + gyro energy) advances each cell through a random image pool with visual transitions. Removes focus mode and scale output entirely.

## Requirements

### Requirement: Movement-Energy Detection

SensorMapper MUST compute movement energy from combined accel + gyro frame-to-frame deltas. Output: `{ direction: "next" | "prev" | null, energy: number }`.

#### Scenario: Forward movement triggers next

- GIVEN phone is assigned to a slot AND movement energy exceeds `cycleThreshold`
- WHEN the user shakes the phone forward
- THEN `SensorMapper.map()` returns `{ direction: "next", energy: N }`

#### Scenario: Backward movement triggers prev

- GIVEN phone is assigned to a slot AND negative-gyro energy exceeds threshold
- WHEN the user tilts phone backward
- THEN `SensorMapper.map()` returns `{ direction: "prev", energy: N }`

#### Scenario: Sub-threshold movement is ignored

- GIVEN movement energy is below `cycleThreshold`
- WHEN sensor data arrives
- THEN `SensorMapper.map()` returns `{ direction: null, energy: 0 }`

### Requirement: Configurable Sensitivity

Cycle threshold and debounce interval MUST be configurable in `config.js`. Default threshold: `0.5`, default debounce: `200ms`.

#### Scenario: Threshold override

- GIVEN `config.cycleThreshold = 0.3`
- WHEN movement energy 0.4 arrives
- THEN direction is `"next"` (threshold exceeded)

### Requirement: No Scale Output

`SensorMapper.map()` MUST NOT return a `scale` key. All scale/size logic is removed.

#### Scenario: Scale absent

- GIVEN a sensor frame
- WHEN `SensorMapper.map()` is called
- THEN the returned object has `{ direction, energy }` and no `scale` property

### Requirement: No Focus Mode

The system MUST NOT handle `focus`, `drawFocusedView`, `focusedSlot`, or any focus-related action. Focus action is removed from the protocol.

#### Scenario: Focus action is rejected

- GIVEN a phone sends `{ type: "action", action: "focus" }`
- WHEN `message-relay.js` validates the action
- THEN the message is discarded (no-op) with a warning log

### Requirement: Image Pool per Cell

Each cell SHALL be assigned a random subset (default: 10 images) from the dataset. Cycling advances within this pool.

#### Scenario: Cycle through pool

- GIVEN cell has 10 images assigned
- WHEN direction `"next"` fires 11 times
- THEN the cell wraps to pool index 0

#### Scenario: Empty pool

- GIVEN cell pool is empty (0 images available)
- WHEN cycle triggers
- THEN no visual change occurs (no-op)

### Requirement: Crossfade Transition

CellRenderer MUST show a 300ms crossfade on cycle. If framerate drops below 30fps, fall back to instant swap.

#### Scenario: Crossfade plays

- GIVEN FPS >= 30 AND image cycles
- WHEN frame renders
- THEN old image fades out over 300ms as new image fades in

#### Scenario: Low-fps fallback

- GIVEN FPS < 30
- WHEN image cycles
- THEN image swaps instantly (no crossfade)
