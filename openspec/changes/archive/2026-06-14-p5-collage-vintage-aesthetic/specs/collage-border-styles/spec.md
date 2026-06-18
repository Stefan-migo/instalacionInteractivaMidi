# collage-border-styles — Specification

## Purpose

Expand from a single torn-paper border to 5 renderable border styles. The existing LCG torn-border algorithm is preserved as the default. Each style is a pure render function operating on cell position and dimensions.

## Requirements

### Requirement: Border style enumeration

The system MUST support exactly 5 border styles: `torn`, `polaroid`, `stamp`, `gold`, `minimal`.

#### Scenario: All border styles render without visual artifacts

- GIVEN a cell at known position `(x, y, w, h)`
- WHEN `drawBorder(ctx, style, cell)` is called for each style
- THEN each SHALL produce visible border geometry with no gaps, overlapping, or clipping

### Requirement: Torn border (default)

The `torn` style MUST use the existing LCG `generateTornBorder()` algorithm (4 sides × 32 segments, seeded per slot).

#### Scenario: Torn border matches existing behavior

- GIVEN slot 5 at position `(100, 100, 300, 400)` with `borderSegments: 32`, `borderJitter: 6`
- WHEN `drawBorder(ctx, "torn", cell)` is called
- THEN the generated vertices SHALL match the output of the existing `generateTornBorder(100, 100, 300, 400, 32, 6, 5)`

### Requirement: Polaroid border style

The `polaroid` style MUST render a white rect (image area) with a larger white rect (bottom-heavy border) and thin gray shadow line.

#### Scenario: Polaroid border has bottom-heavy white margin

- GIVEN a cell at `(x, y, w, h)` with `polaroid` style
- WHEN rendered
- THEN the cell SHALL show a white border, with the bottom margin wider than the top/sides

### Requirement: Stamp border style

The `stamp` style MUST render a dashed/dotted rect outline with rounded corners, resembling a postage stamp.

#### Scenario: Stamp border renders dashed outline

- GIVEN a cell with `stamp` style
- WHEN rendered
- THEN the border SHALL be a dotted/dashed line around the cell perimeter

### Requirement: Gold border style

The `gold` style MUST render a thick gold rect border (fill `#C9A96E`) with an inner thin dark line.

#### Scenario: Gold border has correct fill and inner stroke

- GIVEN a cell with `gold` style
- WHEN rendered
- THEN the border SHALL show a `#C9A96E` fill area with a thin dark inner edge

### Requirement: Minimal border style

The `minimal` style MUST render a single-pixel hairline rect outline in semi-transparent white.

#### Scenario: Minimal border is thin and subtle

- GIVEN a cell with `minimal` style
- WHEN rendered
- THEN the border SHALL be a 1px stroke at alpha ≈ 0.3

### Requirement: Per-cell border configuration

Each cell SHALL store its own `borderStyle`. Default SHALL be `"torn"`.

#### Scenario: Border style default on initialization

- GIVEN a newly initialized cell state
- THEN `state.borderStyle` SHALL equal `"torn"`

### Requirement: Rendering performance

Each border style MUST render in under 2ms per cell on target hardware.

#### Scenario: Border perf under 30-cell load

- GIVEN 30 cells each with a different border style
- WHEN a full frame renders
- THEN total border rendering time SHALL NOT exceed 60ms
