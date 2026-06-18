# Delta for collage-background-texture

## MODIFIED Requirements

### Requirement: Configurable intensity

`backgroundIntensity` (0.0–1.0) SHALL scale element alpha and vignette darkness linearly. Element count SHALL stay constant across intensities. At 0.0 the background SHALL be invisible.
(Previously: controlled opacity via element count/density)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Zero hides | intensity: 0.0 | Background renders | Only solid bg color visible |
| Half intensity | intensity: 0.5 | Background renders | Element count = max; each alpha proportionally lower |
| Vignette follows | intensity: 1.0 | Background renders | Radial vignette at max darkness |

## ADDED Requirements

### Requirement: Additional pattern layers

System SHOULD support 3 new `canvasBgStyle` layers composited over base texture: `scanlines`, `watercolor`, `halftone`.

| Style | Appearance | Alpha |
|-------|-----------|-------|
| `scanlines` | Horizontal 1px lines, 4px spacing | 0.02–0.05 |
| `watercolor` | Noise-placed blurred circles, warm sepia/brown tones | 0.01–0.03 |
| `halftone` | Dot grid (1–4px dia), spacing proportional to cell density | 0.05–0.15 |

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Each layer renders | `canvasBgStyle` set to any of the three | Background renders | Corresponding pattern visible over base texture |
| Unknown falls back | `canvasBgStyle: "unknown"` | Background renders | Default texture only; no extra layer |
