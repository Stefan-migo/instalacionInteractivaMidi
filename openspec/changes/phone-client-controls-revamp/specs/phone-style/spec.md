# Delta for Phone Style — Visual Design System

## MODIFIED Requirements

### 5. Action Buttons

(Previously: 3-column grid of flipH, flipV, opacityUp/Down, lock, unlock, reset, wizard, shuffle. Included Locked and Recording interaction states.)

- **Purpose**: Row of primary action buttons: wizard trigger ("Gesto"), shuffle, and filter cycle. Lock/unlock, flip, and increment buttons are removed.
- **Visual**: Ink-stamp on paper. `box-shadow: 1px 1px 0 var(--color-border)`, slight rotation (-1 to 1deg per button), `--color-surface` bg, `--color-border` 1px solid. Active: `--color-accent` border replaces default. Recording (wizard active): `--color-error` pulsing border (opacity oscillation 0.4→1 over 1.5s — vintage pulse, not modern glow+scale).
- **Touch**: `:active` only — no `:hover`. No scale transform on active (period stamps don't shrink).
- **Layout**: Horizontal row. Filter button may sit below wizard and shuffle for visual separation.

### Interaction States

(Previously included Locked column with crosshatch overlay and muted border. Locked state removed.)

| Component | Default | Active | Disconnected | Recording |
|-----------|---------|--------|-------------|----------|
| Action button (wizard/shuffle) | Ink-stamp paper | Accent border | Muted border | Pulsing error border |
| Filter button | Ink-stamp paper | Accent border | Muted border | N/A |
| Permission btn | Ink-stamp | Accent border | N/A | N/A |
| Slot badge | Ink-stamp | N/A | Dashed border | N/A |
| Recording indicator | Hidden | Pulsing opacity | N/A | N/A |

## ADDED Requirements

### 9. Range Slider (Opacity, Rotation)

- **Purpose**: Direct-value input for opacity (0–100) and rotation (0–360).
- **Visual**: Vintage horizontal track — no rounded corners. Track: `--color-surface` with `--color-border` 1px solid top/bottom borders (no fill). Thumb: small ink-stamp circle (`--color-accent` fill, `--color-border` 1px solid, `border-radius: 0` — intentionally not circular). Track height: 8px. Thumb size: 20×20px.
- **Label**: `--font-body` 0.75rem above track, showing current value (e.g., "75%" / "90°").
- **Range styling**: `input[type=range]` with appearance reset (`-webkit-appearance: none`, `appearance: none`). Thumb via `::-webkit-slider-thumb` / `::-moz-range-thumb`.

### 10. Touch Pad

- **Purpose**: Capture drag deltas for cell position.
- **Visual**: Proportional square (1:1 aspect ratio). Background: `--color-surface` with `--color-bg` inset. Border: `--color-border` 2px solid, `clip-path: polygon(...)` with 12 vertices (torn edge, same algorithm as p5 collage). Internal grid lines (4×4 faint `--color-muted` lines at 25% intervals) for spatial reference.
- **Size**: 100% width of the dashboard container, constrained to square via `aspect-ratio: 1 / 1`.
- **Interaction**: No visible thumb/cursor. On touch/mouse drag, a small dot (`--color-accent`, 12px) follows the finger position within the pad.

### 11. Filter Button

- **Purpose**: Cycle through image filters, showing current selection.
- **Visual**: Ink-stamp button (same spec as Action Buttons) with dynamic label text in `--font-body` 0.75rem. Label updates on each cycle — MUST use static text replacement, not CSS content trick.
- **Active state**: Same as Action Buttons active (`--color-accent` border).

## ADDED Scenarios

#### S6: Slider renders with vintage appearance
- GIVEN the phone client loads
- WHEN inspecting the opacity and rotation sliders
- THEN the track has 1px solid top/bottom borders
- AND the thumb is a square ink-stamp circle (`border-radius: 0`)
- AND the value label displays in Courier Prime 0.75rem above the track

#### S7: Touch pad renders as torn-edge square
- GIVEN the phone client loads
- WHEN inspecting the touch pad container
- THEN it has `aspect-ratio: 1 / 1` and 100% width
- AND its border uses `clip-path` with torn-edge polygon
- AND faint 4×4 grid lines are visible internally

#### S8: Filter button shows current name
- GIVEN the filter is currently "grayscale"
- WHEN inspecting the filter button
- THEN the button label reads "Grayscale" (capitalized, in Spanish)
- WHEN tapped
- THEN the label updates to "Cyanotype" on the next frame
