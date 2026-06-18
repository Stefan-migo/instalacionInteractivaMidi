# Projector Controls Specification

## Purpose

Control panel sidebar, drag-and-drop cell repositioning, and cell selection with floating controls for the projector operator in the 1920×1080 p5.js collage installation.

## Requirements

### R-CPS-1: Layout Presets

Sidebar MUST display 6 preset buttons (scatter, spiral, polaroid-stack, neat-grid, vignette, random). The active preset MUST be visually distinguished.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Preset applies | Sidebar is open | Operator clicks "spiral" | All cells reposition; "spiral" highlighted as active |
| Re-apply same | "neat-grid" is active | Operator clicks "neat-grid" again | Layout recalculates with new random offsets |
| Unknown preset ignored | N/A | Any action not in preset list | No behavior change |

### R-CPS-2: Scatter Scale Slider

Sidebar MUST provide a slider controlling scatter scale from 0.4 to 1.6, step 0.05.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Slider adjusts spread | Sidebar is open | Operator sets scatter scale to 0.5 | Cells use tighter clustering in applicable presets; slider label shows "50%" |

### R-CPS-3: Canvas Background Selector

Sidebar MUST show 4 canvas background options: aged-paper, canvas, wood, dark-wool.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Background changes | Sidebar is open | Operator selects "wood" | Canvas background changes to wood color; noise texture regenerates |
| Background persists on redraw | Background set to "dark-wool" | Window resize triggers redraw | Canvas background remains dark-wool |

### R-CPS-4: Noise Intensity Slider

Sidebar MUST provide a noise intensity slider (0–100, step 5) that SHALL scale element opacity and vignette darkness proportionally. At 0, noise SHALL be invisible.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Noise at 60% | Sidebar is open | Operator sets noise to 60 | Grain at 60% opacity; vignette at 60% |
| Zero disables | Noise at 60 | Operator sets noise to 0 | No overlay or vignette |
| Max intensity | Noise at 0 | Operator sets noise to 100 | Elements at full alpha; vignette fully dark |

### R-CPS-5: Cell Catalog

Sidebar MUST show a catalog of all 30 cells with thumbnail, title, and hide/show toggle.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Toggle hides cell | Catalog shows all 30 | Operator clicks eye icon on cell #5 | Cell #5 hidden; icon changes to eye-off |
| Toggle shows cell | Cell #5 hidden | Operator clicks eye-off icon | Cell #5 visible again |
| Click selects from catalog | Catalog is visible | Operator clicks visible cell entry | Cell selected on canvas; per-cell editor opens |
| Click hidden cell | Cell #5 hidden | Operator clicks its catalog entry | Per-cell editor opens; cell stays hidden |

### R-CPS-6: Per-Cell Editor

When a cell is selected, the sidebar MUST show per-cell controls: filter selector, border selector, rotation slider (−180° to +180°, step 1, with 0° at center upright), scale slider (0.4–1.8, step 0.05), opacity slider (0.30–1.0, step 0.05).

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Filter applies | Cell #3 selected | Operator selects "sepia" filter | Sepia filter applied to cell #3 immediately |
| Border applies | Cell #3 selected | Operator selects "gold" | Gold museum border renders on cell #3 |
| Positive rotation | Cell #3 selected | Operator drags rotation to 45° | Cell rotates to 45° |
| Negative rotation | Cell #3 selected | Operator drags rotation to −90° | Cell rotates to −90° |
| Zero centered | Cell at 45° | Operator sets rotation to 0° | Cell returns to upright |
| Scale updates | Cell #3 selected | Operator sets scale to 1.5 | Cell #3 renders at 150% size |
| Opacity updates | Cell #3 selected | Operator sets opacity to 0.5 | Cell #3 renders at 50% opacity |

### R-CPS-7: Esparcir Todo

Sidebar MUST have an "Esparcir Todo" button that re-randomizes all 30 cell positions using the current preset.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Reset all positions | Cells have been manually repositioned | Operator clicks "Esparcir Todo" | All 30 cells get fresh positions per current preset |

### R-CPS-8: Sidebar Toggle

Sidebar MUST toggle open/closed via a toggle button.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Close sidebar | Sidebar is open | Operator clicks toggle | Sidebar slides out of view; canvas uses full 1920 px width |
| Open sidebar | Sidebar is closed | Operator clicks toggle | Sidebar slides into view; canvas layout adjusts |

### R-DND-1: Drag and Drop

Click + drag on a cell MUST move it in real time. A 5 px threshold MUST prevent drag activation on click.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Drag moves cell | A cell is visible on canvas | Operator presses and drags > 5 px | Cell follows cursor in real time; z-index brought to front |
| Drag threshold prevents move | Operator clicks cell | Mouse moves < 5 px before release | Cell stays at original position; cell is selected (not dragged) |
| Cell stays after release | Cell has been dragged | Operator releases mouse | Cell remains at the new position |
| Drag exclusively on canvas | Cell visible | Operator starts drag on sidebar | Canvas cell does not move |

### R-DND-2: Touch Events

Touch events (touchstart, touchmove, touchend) MUST work identically to mouse drag.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Touch drag | Cell visible on touch device | Operator touches and drags cell | Cell moves with touch point |

### R-DND-3: Position Clamping

Cell positions MUST be clamped to [0, canvasW − cellW] × [0, canvasH − cellH].

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Clamp left edge | Cell near left edge | Operator drags past left boundary | Cell x clamped to 0 |
| Clamp right edge | Cell near right edge | Operator drags past right boundary | Cell x clamped to canvasW − cellW |
| Clamp top edge | Cell near top edge | Operator drags past top boundary | Cell y clamped to 0 |
| Clamp bottom edge | Cell near bottom edge | Operator drags past bottom boundary | Cell y clamped to canvasH − cellH |

### R-SEL-1: Cell Selection

Single click on a cell (no drag) MUST select it with a visual highlight (dashed border).

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Select cell | Cell is visible | Operator clicks (no drag movement) | Dashed highlight border appears; cell brought to front |

### R-SEL-2: Floating Control Buttons

Selected cell MUST show floating control buttons above it: rotate left (−15°), rotate right (+15°), bring to front, delete/hide.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Rotate left | Cell #3 selected; floating controls visible | Operator clicks rotate left | Cell #3 rotates −15° |
| Rotate right | Cell #3 selected | Operator clicks rotate right | Cell #3 rotates +15° |
| Bring to front | Cell #3 is behind cell #5 | Operator clicks bring to front | Cell #3 z-index exceeds all others |
| Delete/hide | Cell #3 selected | Operator clicks delete | Cell #3 hidden (scale 0 or equivalent) |

### R-SEL-3: Deselect on Empty Canvas Click

Clicking empty canvas area MUST deselect the current selection.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Deselect | Cell #3 is selected | Operator clicks empty canvas area | No cell selected; floating controls disappear |

### R-SEL-4: Single Selection

Only one cell MUST be selected at a time.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Switch selection | Cell #3 is selected | Operator clicks cell #7 | Cell #3 deselected; cell #7 selected with highlight and floating controls |
