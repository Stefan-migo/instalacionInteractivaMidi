# Delta for collage-border-styles

## MODIFIED Requirements

### Requirement: Border style enumeration

System MUST support exactly 9 border styles: `torn`, `polaroid`, `stamp`, `gold`, `minimal`, `deckled-edge`, `double-line`, `shadow-box`, `film-sprocket`.
(Previously: 5 styles)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| All render cleanly | Cell at known (x,y,w,h) | `drawBorder()` for each of 9 styles | Each produces visible border; no gaps or clipping |

## ADDED Requirements

### Requirement: New border styles

Four new p5.js border styles SHALL be supported:

| Style | Visual spec |
|-------|------------|
| `deckled-edge` | LCG jitter (3–8px) on inner edge only; outer straight |
| `double-line` | Two concentric rects: outer 2px, inner 1px, 6px gap, alpha 0.4 |
| `shadow-box` | 8px fill (`#2a1f14`) + 4px drop shadow bottom-right |
| `film-sprocket` | Black bars top/bottom (12% h) + 4px holes every 20px |

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Deckled jitter | `deckled-edge` cell | Rendered | Inner edge irregular; outer straight |
| Double-line spacing | `double-line` cell | Rendered | Two outlines 6px apart |
| Shadow-box shadow | `shadow-box` cell | Rendered | 4px shadow bottom-right |
| Film sprocket holes | `film-sprocket` cell | Rendered | Bars with evenly spaced holes |
