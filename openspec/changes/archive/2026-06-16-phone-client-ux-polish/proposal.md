# Proposal: Phone Client UX Polish

## Intent

Prepare the phone client for the exhibition opening. Current flow lacks branding, uses a mismatched SVG texture filter, an idle-based hint engine that loops forever, and no fallback for sensor permission denial. Visitors need a self-explanatory experience from first tap.

## Scope

### In Scope
- MIDI logo + "Reafirmá la Reforma" branding on permission flow (2 splash/landing screens)
- Replace SVG feTurbulence filter with the same WebGL simplex noise shader from p5-collage (Ashima Arts), rendered once to offscreen canvas, cached, at 80% intensity
- Rewrite HintEngine: client-side action tracking (drag, bring-front, tools-open, shuffle) instead of idle timer; no infinite loop
- Help [?] icon in dashboard: opens overlay with 4 usage instructions + [Entendí] close
- Permission denial handling: error message + [Recargar] button on same screen

### Out of Scope
- No i18n, no bridge changes, no gesture wizard changes
- No p5-collage changes (shader source is read-only reference; phone-client gets its own copy)
- No layout.json, image dataset, or Vercel deploy changes

## User Flow

| # | Screen | Content | Transition |
|---|--------|---------|------------|
| 1 | Splash | [LOGO MIDI centered] + "Reafirmá la Reforma" + [Participar] | Tap → Screen 2 |
| 2 | Permission | [LOGO MIDI small] + sensor explanation + [Activar sensores]. WebSocket connects in background. | Grant → Screen 3. Deny → message + [Recargar] on same screen |
| 3 | Dashboard | Image + hint engine + [?] help icon (top-right). Action-triggered hints. | — |

## Visual Changes

- **Logo**: Wire `logoMIDI.svg` / `.png` (currently orphaned in `assets/`) into Screens 1 and 2
- **Shader**: Remove SVG `feTurbulence`. New `phone-client/paper-texture.js` extracted from `p5-collage/background-texture.js`. Renders same simplex noise via WebGL once, cached. `mix-blend-mode: multiply` retained. Default `intensity: 0.8`

## UX Changes

- **HintEngine**: Replace idle timer with in-memory action flags. Sequence: on-connect → first drag → first tools-open → first bring-front → first shuffle. Silence after all seen.
- **Help [?]**: Top-right corner of dashboard. Overlay: 4 instructions (drag to move, double-tap to ascend, tap + for tools, create gesture) + [Entendí] close.
- **Permission denied**: Show "Sin los sensores no podrás mover tu fragmento. Si querés participar, recargá la página e intentá de nuevo." + [Recargar] button. No screen transition.

## Implementation Boundaries

All changes confined to `phone-client/`:
- `index.html` — splash screen markup, help overlay, logo refs
- `app.js` — 3-screen flow controller, hint engine rewrite, help overlay logic, permission denial handler
- `style.css` — splash/permission layouts, help overlay, [?] icon
- `paper-texture.js` (new) — extracted/adapted shader from `p5-collage/background-texture.js`
- `assets/logoMIDI.svg` — wired into screens

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| WebGL context fails on mobile | Low | Fallback to solid warm fill (same as p5-collage) |
| iOS 16+ sensor permission quirks | Medium | [Recargar] recovery; test on real devices pre-exhibition |
| logoMIDI.svg rendering issue | Low | .png fallback already in assets |

## Rollback Plan

Revert all `phone-client/` files to the current commit. The original SVG filter markup can be preserved as a comment for quick recovery. No bridge or p5 changes are involved — rollback is safe at any point.

## Success Criteria

- [ ] Phone shows 3-screen flow with MIDI branding
- [ ] Background texture visually matches p5 collage under WebGL (side-by-side comparison)
- [ ] Hints fire on tracked actions only; silence after all 5 seen
- [ ] Help overlay opens/closes on [?] / [Entendí]
- [ ] Permission denial shows error message + [Recargar] button
