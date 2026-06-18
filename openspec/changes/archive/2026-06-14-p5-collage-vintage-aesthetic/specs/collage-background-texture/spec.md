# collage-background-texture — Specification

## Purpose

Add a vintage paper background layer using p5 noise fibers and semi-transparent dust particles, composited behind all collage cells. Creates the tactile feel of aged paper consistent with the 1918 Reforma period.

## Requirements

### Requirement: Layer composition

The system MUST render a background layer composed of two sub-layers: noise fibers (organic wispy lines) and dust particles (random dots). The layer SHALL render behind all cells.

#### Scenario: Background renders as bottommost layer

- GIVEN 5 active cells rendering on canvas
- WHEN a frame draws
- THEN the background SHALL draw first (behind all cells, not over them)

#### Scenario: Both sub-layers visible

- GIVEN `backgroundIntensity: 1.0`
- WHEN the background renders
- THEN both fiber wisps AND dust particles SHALL be visible when inspected

### Requirement: Noise fibers

Fiber pattern MUST use p5 `noise()` with a seeded seed (deterministic per session) to produce organic wispy lines. Fibers SHALL be thin (1-2px), semi-transparent (alpha 0.03–0.08), and distributed across the full 1920×1080 canvas.

#### Scenario: Fibers are deterministic per session

- GIVEN a fixed seed
- WHEN two consecutive frames render
- THEN the fiber positions SHALL be identical (no movement between frames)

#### Scenario: Fibers cover full canvas

- GIVEN the background renders
- THEN fibers SHALL span the full 1920×1080 area with no uncovered gaps larger than 200px

### Requirement: Dust particles

Dust particles MUST be randomly positioned dots (1–3px diameter), semi-transparent (alpha 0.02–0.15), distributed across the canvas. Particle positions MAY vary per session.

#### Scenario: Dust particles are present

- GIVEN the background renders with `dustIntensity: 1.0`
- WHEN inspecting pixel data
- THEN at least 100 non-zero-alpha pixels SHALL correspond to dust particles

### Requirement: Performance

The background layer SHOULD be pre-rendered to an offscreen `p5.Graphics` buffer once per preset switch (or once on init if `static`). Per-frame compositing of the buffer MUST complete in under 2ms.

#### Scenario: Background pre-rendered, not per-frame

- GIVEN a background layer initialized
- WHEN the first frame renders
- THEN the offscreen buffer SHALL be created and populated
- AND subsequent frames SHALL composite the cached buffer (no fiber/dust regeneration)

#### Scenario: Background renders under 2ms

- GIVEN 30 active cells with background enabled
- WHEN a frame renders at 30fps
- THEN the background composite step SHALL complete in under 2ms

### Requirement: Configurable intensity

The `backgroundIntensity` config value (0.0–1.0) SHALL control overall opacity of the background layer. At 0.0 the background SHALL be invisible.

#### Scenario: Zero intensity hides background

- GIVEN `backgroundIntensity: 0.0`
- WHEN the background renders
- THEN the canvas behind cells SHALL show only the solid background color (`#0a0a0a`)
