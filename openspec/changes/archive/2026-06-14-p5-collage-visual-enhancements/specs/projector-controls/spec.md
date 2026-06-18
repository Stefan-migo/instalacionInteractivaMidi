# Delta for projector-controls

## MODIFIED Requirements

### R-CPS-4: Noise Intensity Slider

Sidebar MUST provide a noise intensity slider (0–100, step 5) that SHALL scale element opacity and vignette darkness proportionally. At 0, noise SHALL be invisible.
(Previously: scaled element count/density)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Noise at 60% | Sidebar open | Set noise to 60 | Grain at 60% opacity; vignette at 60% |
| Zero disables | Noise at 60 | Set noise to 0 | No overlay or vignette |
| Max intensity | Noise at 0 | Set noise to 100 | Elements at full alpha; vignette fully dark |

### R-CPS-6: Per-Cell Editor

Rotation slider MUST be −180° to +180°, step 1, with 0° at center (upright).
(Previously: rotation slider 0–359°)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Positive rotation | Cell #3 selected | Drag rotation to 45° | Cell rotates to 45° |
| Negative rotation | Cell #3 selected | Drag rotation to −90° | Cell rotates to −90° |
| Zero centered | Cell at 45° | Set rotation to 0 | Cell returns to upright |
