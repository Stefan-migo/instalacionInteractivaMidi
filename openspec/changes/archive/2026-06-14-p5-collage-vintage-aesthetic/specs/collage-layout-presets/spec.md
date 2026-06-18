# collage-layout-presets — Specification

## Purpose

Replace the rigid bento grid (AdaptiveLayout) with 6 slot-aware preset layout generators. Each preset maps active slots to percentage-based positions with rotation and zIndex. Presets switch dynamically via phone action `set-layout`.

## Requirements

### Requirement: Preset enumeration

The system MUST provide exactly 6 layout presets: `scatter`, `spiral`, `polaroid-stack`, `neat-grid`, `vignette`, `random`.

#### Scenario: All presets enumerate without error

- GIVEN a fresh `LayoutPresetEngine`
- WHEN accessing the preset registry
- THEN all 6 presets SHALL be available by name

### Requirement: Position generation

Each preset MUST return an array of `{slot, x, y, w, h, rotation, zIndex}` for the given active slot set. Positions SHALL be percentage-based (relative to 1920×1080 canvas).

#### Scenario: Positions generated for active slots

- GIVEN 8 active slots `[1, 2, 4, 5, 10, 12, 20, 28]`
- WHEN `engine.compute('scatter', slots)` is called
- THEN the result SHALL have exactly 8 entries, each with valid numeric fields, and no two entries SHALL share the same slot

#### Scenario: Zero active slots handled gracefully

- GIVEN an empty slot array
- WHEN `engine.compute(any_preset, [])` is called
- THEN the result SHALL be an empty array

#### Scenario: Single slot presets never overflow canvas

- GIVEN 1 active slot
- WHEN `engine.compute(any_preset, [slot])` is called
- THEN the single position SHALL be fully inside `[0, 0, 1920, 1080]`

### Requirement: Dynamic preset switching

The system MUST accept `{type: "action", action: "set-layout", value: "<preset-name>"}` from the bridge and recompute all active slot positions within 100ms.

#### Scenario: Preset switch recalculates positions

- GIVEN 5 active slots with `neat-grid` preset active
- WHEN a `set-layout: "spiral"` action arrives
- THEN all 5 slot positions SHALL update to the `spiral` preset within 100ms, preserving each cell's image, filter, border style, and opacity

#### Scenario: Invalid preset name ignored

- GIVEN active slots using `scatter` preset
- WHEN a `set-layout: "nonexistent"` action arrives
- THEN the system SHALL NOT change the current preset and SHALL NOT error

### Requirement: State preservation on recalc

When position recalculation occurs (connect, disconnect, preset switch) the system MUST preserve per-cell state: image, opacity, flip, lock, filter style, border style, blend mode.

#### Scenario: Cell state survives slot recalc

- GIVEN a cell with `locked: true`, `opacity: 0.7`, `filterType: "sepia"`, `blendMode: "multiply"`
- WHEN a sibling phone connects (triggering position recalc)
- THEN the cell SHALL retain all its property values
