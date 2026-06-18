# collage-image-filters — Specification

## Purpose

Add per-image CSS filter application via `drawingContext.filter` to the p5 collage draw pipeline. Filters transform image appearance to match the 1918 period aesthetic.

## Requirements

### Requirement: Filter enumeration

The system MUST support exactly 6 filter types: `sepia`, `vintage`, `cyanotype`, `grayscale`, `polaroid`, `none`.

#### Scenario: All filters produce visible change

- GIVEN an image cell with `drawingContext.filter` accessible
- WHEN each filter type is applied sequentially
- THEN `sepia`, `vintage`, `cyanotype`, `grayscale`, and `polaroid` each SHALL produce a visually distinct effect from `none`

### Requirement: Filter application lifecycle

The filter MUST be set on `drawingContext.filter` before `drawImage()` and reset to `"none"` immediately after each cell draw.

#### Scenario: Filter applied per cell, no cross-cell bleed

- GIVEN two adjacent cells: cell A with `filterType: "sepia"`, cell B with `filterType: "none"`
- WHEN both cells are drawn in sequence
- THEN cell A SHALL render in sepia, cell B SHALL render unmodified, and cell B SHALL NOT inherit sepia from cell A

#### Scenario: Filter reset on missing image

- GIVEN a cell with `filterType: "grayscale"` and a null/undefined image
- WHEN the cell is drawn
- THEN `drawingContext.filter` SHALL be reset to `"none"` even if no `drawImage()` call occurred

### Requirement: Per-cell filter configuration

Each cell's `filterType` MAY be configured independently. Default SHALL be `"none"`.

#### Scenario: Filter type stored per cell state

- GIVEN a newly initialized cell state
- WHEN the cell is created
- THEN `state.filterType` SHALL equal `"none"` by default

### Requirement: Performance

Applying filters to 30 cells MUST NOT drop frame rate below 25fps on target hardware (standard desktop GPU).

#### Scenario: Filter performance under load

- GIVEN 30 active cells each with a distinct filter type
- WHEN the collage renders at 30fps
- THEN the filter+draw time per frame SHALL NOT exceed 30ms total
