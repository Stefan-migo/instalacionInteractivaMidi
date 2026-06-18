## Exploration: p5-collage-visual-enhancements

### Current State
52 historical images (1918 University Reform, Córdoba) rendered in 30 cells on a 1920×1080 p5.js canvas. Architecture: phone sensors → WebSocket bridge → p5 collage. Cells pre-initialized on startup, always visible. Per-frame rendering: solid background → cached noise texture → 30 cells (image + border + optional selection highlight).

### Affected Areas

#### 1. Dynamic Image Framing

**Current State:**
- Layout pre-generated and served as `layout.json` with fixed `w`/`h` per cell.
- `layout.json` stores `originalW`/`originalH` — the source image dimensions.
- Images are drawn via `drawImg()` using `drawContext.drawImage(img, -w/2, -h/2, w, h)` — stretches the image to the cell rect, **ignoring image aspect ratio**.
- `LayoutPresetEngine.compute()` applies a single `scale` factor to both `cell.w` and `cell.h`, preserving the cell's aspect ratio but not the image's.
- When images cycle/shuffle via `ImageCycler`, the cell dimensions stay fixed to the original layout values, while the new image may have a completely different aspect ratio.

**Key dataset insight:** The 51 images have diverse aspect ratios — portrait (e.g., `003.jpg` 655×1024), landscape (e.g., `004.jpg` 3915×2455), near-square (`028.jpg` 3246×3307), and extreme wide (`012.jpg` 843×379). The `manifest.json` has `w`/`h` for every image. The `layout.json` cells each have `originalW`/`originalH`.

**Affected files:**
- `p5-collage/cell-renderer.js` — `drawImg()` function needs aspect-ratio-aware logic
- `p5-collage/image-loader.js` — could expose aspect ratio per image
- `p5-collage/layout-preset-engine.js` — cell sizing during preset computation
- `p5-collage/sketch.js` — `drawCell()` and renderer creation
- `p5-collage/image-cycler.js` — needs to notify of aspect ratio changes on cycle
- `images/layout.json` — already has `originalW`/`originalH`
- `images/manifest.json` — already has `w`/`h`
- `tests/cell-renderer.test.js` — existing tests need update

#### 2. Canvas Background

**Current State:**
- `background-texture.js` renders 6 layers to a cached `p5.Graphics` buffer: base color → fibers (80 lines) → grain (600 dots) → age spots (15 patches × 30 circles) → dust (150 specks) → vignette (20 concentric ellipses).
- Uses deterministic seeded RNG (mulberry32) for reproducibility.
- Pre-rendered once, cached in `_bgTexture` global, invalidated when `noiseIntensity` or `canvasBgStyle` changes.
- 4 background styles: aged-paper (default), canvas, wood, dark-wool.
- `sketch.js` draws background color first, then overlays `_bgTexture` if `noiseIntensity > 0`.

**Performance characteristic:** ~1300 draw calls on a 1920×1080 p5.Graphics, built once. Per-frame cost = 1 `drawImage()` call — under 1ms.

**Fragment shaders feasibility:**
- p5.js 1.9.0 is loaded. The collage uses `createCanvas(1920, 1080)` → default P2D renderer.
- Adding WebGL shaders would require either: (a) switching to WEBGL renderer (breaks ALL Canvas2D drawing — not viable), or (b) creating a separate WEBGL offscreen renderer + compositing.
- Option (b) is architecturally possible: create a `createGraphics(1920, 1080, WEBGL)`, write a custom shader, render to it, then `image()` it in P2D. But `p5.Graphics` in WEBGL mode has limited shader support and known bugs with `createShader()` on some platforms.
- **Verdict:** Fragment shaders are high-effort with significant risk. Not recommended for this iteration.

**Additional p5.js patterns (low risk):**
- More p5.js procedural textures (scanlines, halftone dots, watercolor bleed) using the same offscreen buffer pattern
- Radial gradient overlays for mood
- CSS-based overlays (the HTML already has `.canvas-*` classes with `background-image` patterns)
- Mix-blend-mode compositing of multiple texture layers

**Affected files:**
- `p5-collage/background-texture.js` — all
- `p5-collage/sketch.js` — `draw()`, `_bgTexture` lifecycle
- `p5-collage/config.js` — `noiseIntensity`, `canvasBgStyle`
- `p5-collage/control-panel.js` — background selector, noise slider
- `p5-collage/index.html` — existing CSS background patterns
- `tests/background-texture.test.js`

#### 3. Intensity Slider

**Current State — full data flow:**
1. Slider defined in `control-panel.js` line 224: `<input type="range" id="noise-intensity" min="0" max="100" step="5">` — default `noiseVal` = 30 (matches `CONFIG.noiseIntensity: 0.3`)
2. On change → `handlePanelInput` → `CONFIG.noiseIntensity = v2 / 100` → sets `_bgTexture = null` → `redraw()`
3. Next `draw()` → `CONFIG.noiseIntensity > 0` → rebuilds `_bgTexture` via `drawBackgroundTexture(window, 1920, 1080, CONFIG.noiseIntensity, _bgSeed)`
4. `drawBackgroundTexture` uses `intensity` to scale element **counts**: fibers = `80 * intensity`, grain = `600 * intensity`, spots = `15 * intensity`, dust = `150 * intensity`
5. Individual element alpha values are FIXED: fibers alpha 5-15, grain alpha 3-10, spots alpha 3-10, dust alpha 8-30

**Root cause of "no reaction":**
- The slider controls element **density** (count), not element **opacity** or overall layer opacity.
- Elements are extremely faint (alpha 5-15 / 255 = 2-6% opacity).
- At intensity 0.3 (default 30%): ~24 fibers, ~180 grain dots, ~5 spot patches, ~45 dust specks on a 1920×1080 canvas (2M pixels).
- At intensity 1.0 (100%): ~80 fibers, ~600 grain dots, ~15 spot patches, ~150 dust specks.
- The difference between 24 faint lines and 80 faint lines on 2M pixels is visually negligible, especially when behind 30 overlapping cells.
- The base color fill (`#f7eedd` aged paper) dominates the visual.

**Also:** The board's `bg` options already produce CSS-based texture (dots, lines) via `index.html` body classes, so the p5 noise texture is competing with or hidden behind these.

**Affected files:**
- `p5-collage/background-texture.js` — needs opacity-based control or blending
- `p5-collage/control-panel.js` — slider range + display
- `p5-collage/sketch.js` — `CONFIG.noiseIntensity` gate
- `p5-collage/config.js` — default value

#### 4. Rotation Slider

**Current State:**
- Slider: `<input type="range" id="editor-rotation" min="0" max="360" step="1" value="0">`
- `handlePanelInput`: `s.pos.rotation = v3` (assigns 0-360 directly)
- `handleAction('rotation')`: `s.pos.rotation = ((payload.value % 360) + 360) % 360` — normalizes to 0-360
- `drawCell()`: `rotate(radians(pos.rotation))`
- `showPerCellEditor()`: reads state rotation back to slider value

**Issue:** The slider range 0-360 is counterintuitive for rotation. Convention is -180 to +180 with 0 at center (neutral position). However, the rotation value is used in `drawCell()` via `rotate(radians(pos.rotation))` which works with any angle, so the representation is purely UI.

**Data consistency:** The `handleAction` path (phone actions) normalizes to 0-360 with `((value % 360) + 360) % 360`. If we change slider to -180..+180, we need to update this normalization too, or convert between representations.

**Affected files:**
- `p5-collage/control-panel.js` — slider min/max, value display, `showPerCellEditor()`, `handlePanelInput`

#### 5. Better Borders

**Current State:**
- `border-renderer.js` has 5 styles: `torn`, `polaroid`, `stamp`, `gold`, `minimal`.
- All use p5.js drawing primitives (`vertex`, `rect`, `ellipse`, `line`) inside `push/pop`.
- Torn border generates 128 LCG vertices (4 sides × 32 segments) with jitter, stored in `cellState.borderVerts`.
- Torn vertices are regenerated when cell size changes (`updateCellPosition`).
- All borders are relative to cell center (already inside `translate(cx, cy)`).

**SVG-based borders:**
- Native SVG in Canvas2D via `Path2D` is possible: convert torn vertices to a `Path2D` string, draw with `drawingContext.stroke(new Path2D(pathStr))`.
- SVG files as external images: pre-rendered border templates loaded via `loadImage()`. Problem: borders must adapt to dynamic cell sizes. SVG scaling would work if borders are defined relative to cell dimensions.
- Alternative: generate border pattern as a p5.Graphics once per style per size, then cache and composite via `image()`.
- **Verdict:** SVG/Path2D approach adds moderate complexity for marginal visual gain — the existing p5 primitives already render well. For custom SVG border files, the challenge of scaling to arbitrary cell sizes makes this less practical than procedural generation.

**Additional border styles (low effort):**
- Double-line border, shadow/drop-shadow border, deckled edge (variation of torn with periodic sine-wave jitter), frame corner accents, film-frame sprocket holes.
- These can all be done with p5 primitives following the existing pattern.

**Affected files:**
- `p5-collage/border-renderer.js` — new styles + SVG/Path2D experiments
- `p5-collage/cell-renderer.js` — `generateTornBorder()` could be optimized for Path2D
- `tests/border-renderer.test.js`

### Approaches

#### 1. Dynamic Image Framing

1. **Object-fit contain (distortion-free, let cells keep their size)**
   - Pros: Minimal change, no layout recalculation, works during image cycling
   - Cons: Images may not fill the cell (letterboxing), wasted canvas area
   - Effort: Low

2. **Resize cell to match image aspect ratio on cycle** (image-drives-cell-size)
   - Pros: Each image gets ideal framing, organic varied look
   - Cons: Needs layout recalculation on every cycle, cells can overlap unexpectedly, requires collision prevention
   - Effort: Medium-High

3. **Hybrid: object-fit cover + compute cell size from image at layout time**
   - Pros: Images always fill cells without distortion (cropping), no per-cycle cost
   - Cons: Layout generation needs update, parts of image may be cropped off
   - Effort: Low (layout generation change)

**Recommendation: Approach 3 (object-fit cover) as base, with approach 2 as optional enhancement for image cycling.** The simplest fix is to make `drawImg()` compute a scale that fits the image to the cell using `Math.max(w/img.width, h/img.height)` for cover or `Math.min(...)` for contain, then adjust the draw offsets. This is purely in `drawImg()` — no layout changes needed.

#### 2. Canvas Background

1. **Enhance existing p5.Graphics buffer with more layers** (scanlines, halftone, radial color overlays)
   - Pros: Zero architectural change, same caching pattern, composable
   - Cons: Still limited to Canvas2D, no true pixel/GPU shaders
   - Effort: Low

2. **Separate WEBGL offscreen renderer for shader backgrounds**
   - Pros: GPU-powered, infinite variety, smooth gradients, animated noise
   - Cons: p5.Graphics WEBGL has shader limitations, browser compatibility risk, architectural complexity
   - Effort: High

3. **CSS-based backgrounds (already partial — expand)**
   - Pros: GPU-composited, no JS cost, already works for 4 styles
   - Cons: Can't interact with p5 compositing, limited procedural variety
   - Effort: Low

**Recommendation: Approach 1 (enhance p5.Graphics layers) + Approach 3 (expand CSS backgrounds) in parallel.** The p5 texture can add more rich overlay layers (watercolor stain, cyanotype tint, film grain) using the same pattern. CSS can handle geometric backgrounds, while p5 handles organic textures.

#### 3. Intensity Slider

1. **Add composite opacity control** — multiply the entire texture by an opacity factor derived from intensity
   - Pros: Makes the slider response visible immediately (texture fades in/out)
   - Cons: Still uses density-based element count; opacity alone may look like a fade rather than "more texture"
   - Effort: Low

2. **Replace count-based density with element-alpha scaling** — at high intensity, make each element more opaque rather than adding more elements
   - Pros: Visible difference per intensity step, keeps draw calls bounded
   - Cons: Smooth transition requires rethinking the alpha ranges
   - Effort: Low

3. **Combined: density + opacity + vignette depth** — at low intensity: faint, few elements. At high intensity: more elements, more opaque, stronger vignette
   - Pros: Most visually responsive, natural analog feel
   - Cons: Slightly more complex implementation
   - Effort: Medium

**Recommendation: Approach 3 (combined).** Scale element alpha proportional to intensity (not just count), and also scale vignette darkness. This creates the most dramatic visual response. Additionally, consider adding a "global opacity" composite pass for the entire texture overlay.

#### 4. Rotation Slider

1. **Change slider to [-180, 180]**
   - Pros: Direct solution, intuitive UX
   - Cons: Need to update display and all read paths
   - Effort: Low

2. **Slider [-180, 180] + convert to [0, 360] internally**
   - Pros: Keeps internal model consistent with existing rotation math
   - Cons: Extra conversion layer
   - Effort: Low

**Recommendation: Approach 1.** Change slider min/max, update `handlePanelInput` to directly assign signed rotation, update `showPerCellEditor` to read signed value. The `radians()` call in `drawCell()` handles negative values fine. Also update `handleAction('rotation')` to NOT normalize to 0-360 — accept signed values.

#### 5. Better Borders

1. **More p5.js border styles** (deckled edge, double-line, shadow, film-frame, woodcut)
   - Pros: Follows existing pattern, trivially testable, zero new dependencies
   - Cons: Still procedural (no hand-crafted SVG art)
   - Effort: Low

2. **Path2D-based torn border** — convert `generateTornBorder` vertex output to `Path2D` path string, use `drawingContext.stroke(new Path2D(...))`
   - Pros: Native Canvas2D path API, potentially better rendering at scale
   - Cons: Path2D path strings can be tricky with 128 vertices
   - Effort: Medium

3. **Pre-rendered border images** — load PNG border assets, tile/stretch around cells
   - Pros: Highest visual quality, hand-crafted art possible
   - Cons: Asset management, corners vs edges, scaling issues, no per-cell variation
   - Effort: High (asset creation + rendering logic)

**Recommendation: Approach 1 (more p5.js styles) + optional Approach 2 (Path2D torn).** The existing pattern scales well. New border styles like deckled edge (torn but with wave function), double-line, shadow-box, and sprocket-hole can be added rapidly.

### Recommendation Summary

| Area | Approach | Priority | Effort |
|------|----------|----------|--------|
| Dynamic framing | `drawImg()` with object-fit cover calculation | High | Low |
| Canvas background | Enhance p5.Graphics layers + CSS overlays | Medium | Low |
| Intensity slider | Combined density + opacity + vignette scaling | High | Medium |
| Rotation slider | -180 to +180 range | High | Low |
| Better borders | More p5.js styles + optional Path2D torn | Medium | Low |

### Risks

- **Dynamic framing + image cycling:** If approach 2 (resize cells on cycle) is chosen without collision prevention, cells may overlap awkwardly. Stick to approach 3 (object-fit cover in `drawImg()`) to avoid this entirely.
- **WEBGL shader backgrounds:** High risk of breaking the P2D rendering pipeline. Avoid for v1.
- **Intensity slider combined approach:** The rebuild of `_bgTexture` on every slider change at 1920×1080 triggers ~1300 draw calls. On low-end hardware this could cause a visible hitch (~50-100ms). Consider adding a debounce or rebuild throttle.
- **Rotation slider sign change:** The `handleAction('rotation')` path from phone clients normalizes to 0-360. Both representations must be kept consistent. If the control panel uses signed and phones send unsigned, there's a conflict.
- **Border performance with Path2D:** `Path2D` construction from 128 vertices per frame per cell could be slower than the current vertex array approach. Profile before committing.

### Ready for Proposal
**Yes.** The analysis is complete with clear recommendations, affected files, and effort estimates for each area. The orchestrator should present the recommendations above, starting with the high-priority (high-effort feedback, low-effort fix) items: **rotation slider** and **intensity slider** are the lowest-hanging fruit with the highest user-visible impact. Dynamic image framing is the next priority for visual quality.
