# Proposal: Phone UI Art Direction

## Intent

The phone client looks like a generic dark-mode app. This is an artistic installation — the phone interface should feel like a period artifact from 1918, not a modern application. Pure visual overhaul, zero new features.

## Scope

### In Scope
- Complete visual redesign of `phone-client/index.html` and `phone-client/style.css`
- CSS custom properties design token system for all visual values
- Paper texture via inline SVG `feTurbulence` filter
- Selective torn-edge `clip-path` on key containers (header, permission card, sensor rows)
- Historical typography: Playfair Display (headings) + Courier Prime (body)
- 1918 Reforma color palette (parchment, ink, faded red)
- Slot number display on dashboard (already functional, needs visual restyle)
- User-created texture asset layer (optional, non-blocking)
- Touch-friendly interaction states (`:active`, no `:hover`)

### Out of Scope
- Show cell image on phone (deferred to future change)
- Gesture recording wizard (deferred to future change)
- Any JS behavior changes beyond visual class toggling
- Layout/structural changes to sensor data flow
- Changes to bridge or p5-collage

## Capabilities

### New Capabilities
- `phone-style`: Visual design system and art direction for the phone client interface

### Modified Capabilities
None — pure visual change, no existing spec capabilities are modified.

## Approach

Hybrid (Option D from exploration): Papel y Tinta foundation with selective Collage accents. CSS custom properties as design tokens on `:root` — colors, typography, spacing, textures all in one place. Inline SVG `feTurbulence` filter applied once as `body::after` overlay for aged-paper grain (GPU-accelerated, no per-element cost). `clip-path` torn edges (12–16 vertices, adapted from p5's `generateTornBorder()`) on key containers only — not every element. Buttons get ink-stamp treatment via `box-shadow` + slight rotation + `mix-blend-mode` ink overlays.

Color palette derives from archival imagery: parchment `#f5e6c8`, ink `#1a1a1a`, faded red `#8b2c24` for Reforma/UCR identity. Playfair Display for headings, Courier Prime for body text. No build step — plain CSS with custom properties. User can tune every visual value by editing `:root` tokens. Optional user-created texture assets served from `phone-client/assets/` and layered via `mix-blend-mode: multiply`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `phone-client/index.html` | Modified | Add SVG filter defs, Google Fonts link, decorative wrappers |
| `phone-client/style.css` | Modified | Complete rewrite — replace all styles with period design tokens |
| `phone-client/app.js` | Minor | Inject/remove CSS classes if needed; slot already displayed |
| `phone-client/assets/` | New | Directory for user-created texture assets (optional) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SVG filter perf on low-end phones | Low | Static body overlay, not per-element; test on real devices |
| Font loading / FOUT | Medium | `font-display: swap`; acceptable serif/monospace fallbacks |
| Readability on small screens | Low | WCAG AA contrast ≥4.5:1; test iOS Safari + Android Chrome |
| User asset loading latency | Low | Assets ≤50KB; lazy-load; design works without them |
| Style drift from collage identity | Medium | Derive every decision from p5 `cell-renderer.js`, not generic vintage |

## Rollback Plan

Restore the three phone-client files (`index.html`, `style.css`, `app.js`) from git. Old dark theme available immediately.

## Dependencies

- Google Fonts CDN (Playfair Display + Courier Prime) — one-time load
- User texture assets in `phone-client/assets/` (optional, non-blocking)

## Success Criteria

- [ ] Phone renders aged-paper background, period typography, ink-stamp buttons
- [ ] All sensor bars, action buttons, and status indicators remain functional
- [ ] Slot number displayed on dashboard
- [ ] CSS custom properties are single source of truth for all visual values
- [ ] Design works without user assets AND with them layered
- [ ] Touch interactions work correctly (no hover-reliant states)
- [ ] Paper texture renders on iOS Safari 15+ and Android Chrome 90+
