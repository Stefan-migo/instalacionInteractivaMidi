# Exploration: phone-ui-art-direction

## Current State

The phone client (`phone-client/index.html`, `phone-client/style.css`, `phone-client/app.js`) has a **generic dark-mode app aesthetic**:

- **Background**: `#0a0a0a` solid black
- **Text**: `#e5e7eb` light gray, system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`)
- **Buttons**: `#2563eb` blue primary, `#1f2937` dark gray action buttons, rounded corners (10–12px)
- **Layout**: Clean CSS grid (`3-column actions-grid`), rounded sensor bars, centered card layout
- **Status indicators**: Blue badge, green/red connection dot, standard emoji icons
- **No textures, no decorative elements, no period styling**

### The Collage Aesthetic (p5 side)

The p5.js collage uses:
- Dark background (`#0a0a0a`)
- **Torn borders**: white strokes (`stroke(255)`, `strokeWeight(1)`) with seeded random jitter (`borderSegments: 32`, `borderJitter: 6`)
- Overlapping cells with varying z-index, slight rotation
- Images can flip, change opacity, use blend modes (multiply, screen, overlay, difference)
- The overall feel is raw, deconstructed, historical — like physical photo fragments scattered on a table

### Bridge Server Context

The bridge at `bridge/index.js` serves the phone client statically at `/phone-client`. There is **no build step** — the phone client is plain HTML/CSS/JS served directly. The bridge runs on Node.js on port 8080, and the phone client is opened on a phone browser pointing to the bridge URL. Any CSS changes must work with direct file serving (no preprocessors unless we add a build step).

---

## Affected Areas

| File | Why Affected |
|------|-------------|
| `phone-client/style.css` | Complete visual overhaul — replace generic dark theme with period-appropriate artistic styling |
| `phone-client/index.html` | May need structural changes for decorative elements, SVG filters, font loading, or additional wrapping elements |
| `phone-client/app.js` | Minimal changes — possibly for font loading, CSS class toggling, or paper texture initialization |
| `bridge/index.js` | **Not affected** — serves static files; no logic change needed |
| `openspec/config.yaml` | Update if we add a build step or dependencies |

---

## Approaches

### Option A — Papel y Tinta (Paper & Ink)

Transform the phone UI to look like it's printed on aged paper. Uses CSS paper textures, torn edges via clip-path, vintage typography, and ink-stamp buttons.

**Key techniques**:
- CSS `box-shadow` layering + pseudo-elements for paper texture (no external assets)
- `clip-path: polygon(...)` for torn/irregular edges on cards and buttons
- Google Fonts: Playfair Display (headings), Courier Prime or IBM Plex Mono (body)
- CSS `filter: url(#paper-texture)` with inline SVG `feTurbulence` for grain
- Color palette via CSS custom properties: aged parchment `#f5e6c8`, ink black `#1a1a1a`, faded red `#8b2c24` (UCR), sepia `#704c24`

**Pros**:
- No external image assets needed for paper texture (CSS/SVG only)
- The torn-edge clip-path mirrors the p5 collage's torn-border language directly
- Pure CSS approach is performant on mobile browsers
- Inline SVG filters are self-contained (no extra requests)
- Design token system via custom properties makes iteration easy

**Cons**:
- `clip-path` with many vertices can be verbose in CSS
- SVG `feTurbulence` performance varies on older mobile devices
- Paper texture via pure CSS may look less convincing than real scanned textures
- Playfair Display is a variable font — one extra network request

**Effort**: Medium

### Option B — Archivo Universitario (Archive)

The phone UI looks like a physical archive folder or university file from 1918. Manila folder colors, typewritten text, stamped labels, carbon-copy effects.

**Key techniques**:
- Background: manila tan (`#e8d5a3`) with subtle repeating texture (base64-encoded noise)
- Typewriter font: Courier Prime or Special Elite from Google Fonts
- Stamped buttons: `box-shadow` inset/outset with rotation transform, red stamp ink effect
- Carbon copy: `mix-blend-mode: multiply` overlays on text elements
- Index card aesthetic: bordered sections with hand-drawn feel
- Dated headers: typographic treatment mimicking rubber stamps with `text-shadow` and rotation

**Pros**:
- Strong thematic connection to the university archive context of the Reforma
- Typewriter fonts are distinctive and immediately read as "vintage"
- Manila folder colors are warm and unexpected for a phone UI
- Carbon-copy effects with CSS blend modes are lightweight

**Cons**:
- Less visual connection to the p5 collage aesthetic (which is torn paper / photo fragments, not archive folders)
- Typewriter fonts can hurt readability on small screens at small sizes
- The "file folder" metaphor may not translate well to a touch interface
- Risk of looking too much like a gimmick rather than a cohesive art piece

**Effort**: Medium

### Option C — Collage Fragment

The phone UI itself is designed as a collage piece. Irregular layout, overlapping elements, mixed textures, cut-out feel — directly extending the p5 torn-border language to the phone screen.

**Key techniques**:
- Asymmetric grid with overlapping cards (negative margins, absolute positioning)
- `clip-path` torn edges matching the p5 collage's own jitter algorithm
- Multiple background textures layered via `::before`/`::after` pseudo-elements with `mix-blend-mode`
- Hand-drawn decorative elements via inline SVG
- User-created texture assets (scanned paper, ink splatters) served from the bridge
- Random rotation on cards via CSS transforms
- No straight lines anywhere — every border is irregular

**Pros**:
- Direct visual continuity with the p5 collage — phone and screen feel like the same artwork
- Most artistically ambitious and cohesive
- The asymmetrical layout can hide the "app" feel completely
- User-created textures give unique, unreproducible character
- The torn-edge clip-path formula can be ported from `cell-renderer.js` `generateTornBorder()` to CSS

**Cons**:
- **Highest effort** — requires custom texture assets and careful CSS
- Asymmetric layouts are harder to make functional on small phone screens
- Externally loaded texture assets add HTTP requests (or must be base64-encoded)
- Risk of sacrificing usability for aesthetics (buttons might be hard to find)
- The torn-edge clip-path with 32+ vertices per element may hurt repaint performance on mobile

**Effort**: High

### Option D — Hybrid: Papel y Tinta base + Collage accent elements (RECOMMENDED)

Start with the Papel y Tinta approach as the structural foundation, then selectively integrate collage-derived accents:
- Paper texture via inline SVG `feTurbulence` filter (from Option A)
- Design token system via CSS custom properties (from Option A)
- Torn-edge `clip-path` on **key containers** only (header, permission card, sensor bars) — not on every button (from Option C)
- Ink-stamp buttons with slight rotation (from Option B)
- Faded red accent (`#8b2c24`) ties to UCR colors and the Reforma's political identity
- User-created background textures (scanned paper) as optional decorative layer
- The p5 border jitter formula adapted to CSS for the main container edges only

**Why this works**:
- The paper texture creates the period feel immediately
- Selective torn edges connect to the collage without overwhelming usability
- Button placement stays clean and functional (unlike full collage fragmentation)
- CSS custom properties make the system easy to iterate and theme
- User can create exactly 1–2 texture assets (background, button stamps) rather than a full asset library
- Performance: `feTurbulence` applied once as body filter, not per-element clip-paths

**Effort**: Medium

---

## CSS Techniques Evaluation

| Technique | Performance | Mobile Support | Complexity | Verdict |
|-----------|-------------|----------------|------------|---------|
| SVG `feTurbulence` paper grain | Good (GPU-accelerated) | iOS Safari 9+, Android Chrome 30+ | Low | ✅ Use as body overlay |
| `clip-path: polygon()` torn edges | Good (composited) | iOS Safari 9+, Android Chrome 50+ | Medium | ✅ Use selectively |
| CSS custom properties / design tokens | Native | All modern browsers | Low | ✅ Foundation |
| `mix-blend-mode` overlays | Good | iOS Safari 8+, Android Chrome 41+ | Low | ✅ Use for texture layers |
| Google Fonts (Playfair Display / Courier Prime) | Good (cached) | All browsers | Low | ✅ Use 1-2 weights only |
| Base64-embedded decorative SVG | Good (no request) | All browsers | Low | ✅ Use for decorative elements |
| TornPaper.js library | Good (SVG filter) | All browsers | Low | ⚠️ Interesting but adds JS weight; CSS-only preferred |
| CSS `filter: url()` with SVG filter | Good | iOS Safari 10+, Android Chrome 47+ | Low | ✅ Best approach for paper texture |

### Recommended Technical Stack

```
CSS custom properties (design tokens)
├── :root tokens for colors, spacing, typography, textures
├── Semantic tokens: --color-bg, --color-text, --color-accent, --color-surface
├── Typography: --font-heading, --font-body
└── Texture: --texture-paper (SVG filter reference)

SVG filter (inline in HTML, hidden via display:none)
├── <filter id="paper-texture">
│   ├── <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" />
│   ├── <feColorMatrix type="matrix" values="..." /> (tint to sepia)
│   └── <feBlend mode="multiply" in="SourceGraphic" in2="..."/>
└── Applied via CSS: body::after { filter: url(#paper-texture); mix-blend-mode: multiply; }

CSS custom properties (design tokens)
├── --color-bg: #f5e6c8 (aged parchment)
├── --color-text: #1a1a1a (ink black)
├── --color-accent: #8b2c24 (faded red / UCR)
├── --color-surface: rgba(245, 230, 200, 0.9)
├ --color-border: #3a2a1a (dark ink)
├── --font-heading: 'Playfair Display', Georgia, serif
├── --font-body: 'Courier Prime', 'Courier New', monospace
└── --radius: 0 (intentionally — no rounded corners for period feel)

clip-path torn edges (on key containers only)
├── Header / permission card / sensor containers
├── Generated from p5's jitter algorithm adapted to CSS polygon
└── ~12-16 vertices per element (lighter than p5's 32 for mobile perf)
```

### Color Palette Rationale

| Token | Value | Role |
|-------|-------|------|
| `--color-bg` | `#f5e6c8` | Aged parchment — warm, historical |
| `--color-text` | `#1a1a1a` | Near-black ink |
| `--color-accent` | `#8b2c24` | Faded red — Reforma / UCR identity |
| `--color-accent-hover` | `#6e201a` | Darker red for active states |
| `--color-surface` | `rgba(245, 230, 200, 0.9)` | Translucent paper for cards |
| `--color-muted` | `#8b7d6b` | Faded text / secondary info |
| `--color-border` | `#3a2a1a` | Dark ink for borders and strokes |
| `--color-success` | `#2d6a4f` | Faded green (connection status) |
| `--color-error` | `#8b2c24` | Same as accent (error = ink red) |

### Typography Strategy

- **Headings**: Playfair Display (Google Fonts) — elegant serif, 18th/19th century feel
- **Body / labels**: Courier Prime or IBM Plex Mono — typewriter aesthetic, highly readable on mobile
- **Fallback stack**: serif for headings, monospace for body — no system sans-serif at all
- **Size scale**: 0.75rem / 0.875rem / 1rem / 1.25rem / 1.5rem — traditional print scale
- **No font weights below 400** — period print was bold by nature

### Texture Strategy (User-Created Assets)

The user wants to create some assets themselves. Recommended:

1. **Background texture** — 1 scanned image of aged paper (e.g., 800×600px, JPEG, ~50KB). Served from bridge. Applied as CSS background with `mix-blend-mode: multiply` on `body::after`.
2. **Button stamp texture** — 1 scanned ink splatter / rubber stamp impression (transparent PNG). Served from bridge. Applied as `background` on buttons with `mix-blend-mode: multiply`.
3. **Decorative SVG elements** — user-created SVG for the slot badge frame, status badges, etc.

All assets can be placed in `phone-client/assets/` and served by the bridge.

---

## Design Constraints

| Constraint | Implication |
|------------|-------------|
| **Real phone browsers** | Must test on iOS Safari 15+ and Android Chrome 90+ |
| **No hover states** | All interactions are touch; use `:active` not `:hover` |
| **30fps sensor data** | CSS repaints must not block the main thread; avoid per-frame layout triggers |
| **Self-explanatory** | Buttons must remain identifiable even with period styling |
| **CSS-first** | Prefer CSS over JS for visual effects; keep JS for sensor/WebSocket logic |
| **No build step** | No Sass/Less/PostCSS unless we add one; plain CSS with custom properties |
| **User creates assets** | Design must work without assets first, then layer them on |
| **No framework** | Pure HTML/CSS/JS — the project has zero framework dependencies |

---

## Risks

1. **Mobile performance**: SVG filters and clip-path with many vertices can cause jank on low-end phones during sensor updates. Mitigation: apply `feTurbulence` once as a static overlay (not animated), keep clip-path to ≤16 vertices, and use `will-change: transform` on animated elements.
2. **Font loading delay**: Google Fonts may not load on first render, causing a flash of unstyled text (FOUT). Mitigation: use `font-display: swap` and ensure fallback serif/monospace fonts look acceptable.
3. **Readability**: Vintage styling (low contrast, textured backgrounds, small typewriter fonts) may reduce legibility on small screens. Mitigation: test with actual phones, ensure contrast ratio ≥ 4.5:1 for body text.
4. **Asset load time**: User-created textures add HTTP requests. Mitigation: keep assets small (≤50KB each), consider base64 for critical decorative SVGs, lazy-load background textures.
5. **Style drift**: The phone UI could end up looking like a generic "vintage" WordPress theme rather than an artistic piece. Mitigation: derive visual decisions from the p5 collage code (torn border jitter, color choices) rather than general vintage aesthetics.

---

## Recommendation

**Proceed with Option D — Hybrid: Papel y Tinta foundation + Collage accent elements.**

This gives the strongest artistic impact with the best usability/performance tradeoff. The phone will feel like a period artifact while staying functional as a touch remote. Start with CSS custom properties and paper texture (no external assets), then layer user-created textures and torn-edge clip-paths in subsequent iterations.

Key wins:
- Direct visual lineage from the p5 collage (shared torn-edge language, same historical context)
- Performant enough for 30fps sensor updates
- User can start with zero custom assets and add them later
- CSS custom properties make the entire system easy to tune

**Next phase**: Propose a concrete visual spec with component-by-component style decisions.

---

## Ready for Proposal

Yes. The exploration identified clear options, a recommended hybrid approach, and the technical constraints are well understood. Move to `/sdd-propose`.
