# Delta for Projector Controls — Cell Manipulation Actions

## ADDED Requirements

### R-WA-1: Opacity Action (WebSocket)

The p5 collage MUST handle `{ type: "action", action: "opacity", value: N }` by setting the target cell's opacity to `value / 100`. The `value` field MUST be an integer 0–100. Values outside this range SHALL be clamped.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Opacity set | Phone sends `opacity` with value 75 | p5 processes it | Cell opacity = 0.75 |
| Clamp below range | Phone sends value -10 | p5 clamps | Cell opacity = 0 |
| Clamp above range | Phone sends value 150 | p5 clamps | Cell opacity = 1.0 |

### R-WA-2: Rotation Action (WebSocket)

The p5 collage MUST handle `{ type: "action", action: "rotation", value: degrees }` by setting the target cell's rotation to `degrees` (absolute, not incremental). The `value` field MUST be a number 0–360 and SHALL be clamped to [0, 360].

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Rotation set | Phone sends `rotation` with value 90 | p5 processes it | Cell rotation = 90° |
| Clamp above | Phone sends value 450 | p5 clamps | Cell rotation = 360° |
| Clamp below | Phone sends value -45 | p5 clamps | Cell rotation = 0° |

### R-WA-3: Filter Action (WebSocket)

The p5 collage MUST handle `{ type: "action", action: "filter", value: filterName }` by setting the target cell's active filter to `filterName`. Allowed values: `sepia`, `grayscale`, `cyanotype`, `polaroid`, `vintage`, `none`. Unknown filter names SHALL be ignored (no-op).

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Apply filter | Phone sends `filter` with value "sepia" | p5 processes it | Cell filter = sepia |
| Reset to none | Phone sends `filter` with value "none" | p5 processes it | Cell filter disabled |
| Unknown ignored | Phone sends `filter` with value "blur" | p5 processes it | No change to cell filter |

### R-WA-4: Move Action (WebSocket)

The p5 collage MUST handle `{ type: "action", action: "move", dx, dy }` by adding dx and dy to the target cell's `pos.x` and `pos.y`. Resulting position SHALL be clamped to the canvas bounds: x in [0, canvasW − cellW], y in [0, canvasH − cellH]. Both dx and dy MUST be finite numbers; non-finite values SHALL be treated as 0.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Move right-down | Cell at (400, 300) | Phone sends dx:10, dy:-5 | Cell moves to (410, 295) |
| Clamp right edge | Cell near right edge | Phone sends large positive dx | Cell x clamped to canvasW − cellW |
| Clamp top edge | Cell near top | Phone sends large negative dy | Cell y clamped to 0 |
| NaN treated as 0 | Cell at (400, 300) | Phone sends dx:NaN, dy:5 | Cell moves to (400, 305) |
