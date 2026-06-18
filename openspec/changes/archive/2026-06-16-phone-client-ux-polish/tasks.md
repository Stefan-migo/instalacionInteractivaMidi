# Tasks: Phone Client UX Polish

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

Estimated changed lines: 300–380 (all within `phone-client/`).

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + Splash + Flow | Single PR | All `phone-client/`, no bridge or p5 changes. Safe single-PR delivery. |

## Phase 1: Foundation — Shader Extraction

- [x] T-1: Create `phone-client/paper-texture.js` with `renderPaperTexture(canvas, intesity, seed)` — extract WebGL simplex noise (Ashima Arts) from `p5-collage/background-texture.js`, add solid `#ebd9b3` fallback, default intensity 0.8

## Phase 2: Splash Screen

- [x] T-2: Add splash screen `<div id="splash-screen">` to `index.html` — logo MIDI centered + "Reafirmá la Reforma" + [Participar] button
- [x] T-3: Add CSS for splash screen layout (flex centering, logo size, tagline typography, button)
- [x] T-4: Wire `logoMIDI.svg` via `<img>` with `onerror` fallback to `logoMIDI.png` on both splash and permission screens

## Phase 3: 3-Screen Flow Controller

- [x] T-5: Add `goToScreen()` state machine in `app.js` (splash → permission → dashboard). Use DOM `hidden` class toggle. Init screen = splash. WebSocket `connect()` on splash→permission transition.

## Phase 4: Shader Integration

- [x] T-6: Render paper texture on first dashboard show, store as dataURL, apply via CSS custom property `--paper-bg` to `body::after` as `background-image`
- [x] T-7: Remove SVG `<filter id="paper-texture">` from `index.html` and `filter: url(#paper-texture)` from `body::after` in CSS
- [x] T-8: Verify `mix-blend-mode: multiply` renders correctly with dataURL background

## Phase 5: Permission Flow Update

- [x] T-9: Update permission screen DOM: small logo, sensor explanation text, [Activar sensores] button
- [x] T-10: Add permission denial handler — catch `requestPermission()` rejection, show error message + [Recargar] button inline on same screen
- [x] T-11: Move `connect()` call from page load to splash→permission transition (WebSocket starts during permission screen)
- [x] T-12: Add CSS for denial error message and [Recargar] button

## Phase 6: HintEngine Rewrite

- [x] T-13: Rewrite `initHintEngine` with action flags: `{ connected, dragged, toolsOpened, broughtFront, shuffled }`, all initially `false`
- [x] T-14: Define hint texts in sequence order (connect → drag → tools → bring-front → shuffle)
- [x] T-15: Implement `markAction(flag)` — fires hint only if flag matches `hintSequence[hintIndex]`, increments index, silences when `hintIndex >= 5`
- [x] T-16: Remove idle timer, `localStorage` persistence, infinite-loop fallback

## Phase 7: Help [?] Overlay

- [x] T-17: Add [?] button to dashboard header (top-right) in `index.html`
- [x] T-18: Add help overlay DOM: full-screen overlay with instruction card (4 steps) + [Entendí] button
- [x] T-19: Add CSS for [?] icon, overlay backdrop, instruction card, close/outside-dismiss behavior
- [x] T-20: Wire open/close logic in `app.js` — [?] opens, [Entendí] closes, tap outside card closes, overlay has `z-index: 100`

## Test Strategy

| File | What | Approach |
|------|------|----------|
| `phone-client/paper-texture.js` | `renderPaperTexture()` signature, null/undefined args, WebGL unavailable returns null | Unit test (DOM-free via mock) |
| `phone-client/app.js` | HintEngine `markAction()` sequential correctness, all-seen silence | Unit test on exported logic |
| Manual | 3-screen flow, permission denial, WebGL fallback, [?] overlay | Real device checklist |

## Implementation Order

Phase 1 (shader) first — independent dependency for Phase 4. Then Phase 2 + 3 (splash DOM + flow controller) in parallel. Phase 4 (shader integration) needs Phase 1 done. Phase 5 (permission) needs Phase 3 controller. Phase 6 (HintEngine) and Phase 7 (help overlay) depend only on Phase 3 controller — can run in parallel.
