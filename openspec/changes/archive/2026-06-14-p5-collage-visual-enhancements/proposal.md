# Proposal: p5-collage-visual-enhancements

## Intent

The collage renders 52 historical images across 30 cells but suffers from visual quality issues: images are stretched (no aspect-ratio preservation), the noise intensity slider is barely perceptible, the rotation range (0–360°) is unintuitive, and the existing 5 border styles feel limited. These degrade the tactile, aged-paper aesthetic the installation needs.

## Scope

### In Scope
1. Dynamic image framing — aspect-ratio-aware object-fit cover in `drawImg()`
2. Noise intensity slider fix — scale element opacity + vignette darkness, not just count
3. Rotation slider — change from 0–360° to −180–+180°
4. New border styles — 3–4 additional p5.js procedural styles (deckled, double-line, shadow-box, film-sprocket)
5. Additional canvas background options — expand background-texture.js with new procedural layers

### Out of Scope
- Fragment shader / WEBGL background rendering
- SVG-based borders
- Layout preset changes or new presets
- Image filter changes
- Phone client changes

## Capabilities

### New Capabilities
None — all changes modify existing capability specs.

### Modified Capabilities
- `projector-controls`: R-CPS-6 rotation slider range changes from 0–359° to −180–+180°. R-CPS-4 noise intensity slider semantics change — maps to opacity + vignette darkness (not just element count).
- `collage-background-texture`: Intensity parameter now scales element opacity (not just density). New background pattern layers added (scanlines, watercolor bleed, halftone dots).
- `collage-border-styles`: Expand from 5 to 8–9 styles. Add deckled-edge, double-line, shadow-box, film-sprocket.

## Approach

All changes are p5.js procedural — no SVG, no shaders.

- **cell-renderer.js** — object-fit cover in `drawImg()`: compute scale via `Math.max(w/imgW, h/imgH)`, centered crop offset
- **background-texture.js** — intensity affects element alpha proportionally and vignette darkness; add new pattern layers
- **border-renderer.js** — add 3–4 new style functions following existing pattern
- **control-panel.js** — rotation slider min="-180" max="180", handlePanelInput signed assignment; remove 0–360 normalization in phone action path
- **config.js** — expand `canvasBgStyle` options, expand `borderStyleMap` defaults

No layout, protocol, or phone-client changes needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `p5-collage/cell-renderer.js` | Modified | Object-fit cover in `drawImg()` |
| `p5-collage/background-texture.js` | Modified | Intensity semantics + new layers |
| `p5-collage/border-renderer.js` | Modified | 3–4 new border styles |
| `p5-collage/control-panel.js` | Modified | Rotation range −180/+180 |
| `p5-collage/config.js` | Modified | Expanded background/border config |
| `tests/` | Modified | Updated test expectations |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Object-fit cover clips unexpected image content | Low | Test extreme aspect ratios (655×1024 portrait → 3915×2455 wide) |
| Intensity 0% breaks from existing behavior | Low | 0 → 0 opacity = invisible, same as zero-count today |
| Old rotation values persist in saved state | Medium | Normalize stored values 0–360 → −180–+180 on load |

## Rollback Plan

Revert each file individually via git. No schema or data migration — all changes are rendering/UI. Include rotation value normalization handler for existing state.

## Dependencies

None. All changes self-contained in p5-collage module.

## Success Criteria

- [ ] All 52 images render with correct aspect ratio (no stretching) across diverse sizes
- [ ] Noise intensity slider at 0% shows no overlay; at 100% shows visible grain
- [ ] Rotation slider operates in −180° to +180° range; stored values normalize correctly
- [ ] 3–4 new border styles render without gaps or artifacts
- [ ] All existing tests pass with updated expectations
- [ ] Background pattern selector offers 4+ options
