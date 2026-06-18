# Delta: Phone Client UX Polish (projector-controls)

## ADDED Requirements

### R-PUP-1: Three-Screen Onboarding Flow

The phone client MUST present a 3-screen sequential flow: Splash → Permission → Dashboard.
Screen 1 (Splash): MIDI logo centered + "Reafirmá la Reforma" tagline + [Participar] button.
Screen 2 (Permission): Small logo + sensor explanation + [Activar sensores].
Screen 3 (Dashboard): Existing image + controls.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Full flow | Phone loads | User taps [Participar] | Permission screen appears |
| Permission granted | Permission screen shown | User taps [Activar sensores] and grants permission | Dashboard appears with sensor stream active |

### R-PUP-2: WebSocket Background Connect

The phone MUST initiate WebSocket connection during Permission screen, before sensor permission is granted.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Background connect | Permission screen is visible | User has not yet tapped [Activar sensores] | WebSocket connects in background; status dot updates |
| Slot assigned pre-permission | WebSocket connected | Bridge assigns slot before permission | Slot badge updates; connection ready on dashboard entry |

### R-PUP-3: WebGL Paper Texture

The phone SHALL replace the SVG feTurbulence filter with a WebGL simplex noise shader (Ashima Arts, identical to p5-collage). SHALL render once to offscreen canvas at 80% default intensity, cached. MUST apply via `mix-blend-mode: multiply` over the entire background. MUST fall back to solid warm fill (#ebd9b3) if WebGL context fails.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| WebGL renders | Phone loads, WebGL available | Page initializes | Shader renders once; paper texture visible at 80% intensity |
| WebGL fallback | Phone loads, WebGL unavailable or fails | Page initializes | Solid #ebd9b3 background; no texture visible |
| Side-by-side match | Both p5-collage and phone-client open | Same intensity + seed | Texture visually matches (tolerance: perceptually equivalent noise pattern) |

### R-PUP-4: Action-Based HintEngine

The hint engine MUST replace the current idle-timer approach with 5 action-triggered hints: connect, first-drag, first-tools-open, first-bring-front, first-shuffle. Hints MUST fire once per action in sequence. After all 5 are seen, the engine MUST remain silent (no loop).

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Connect hint | Phone connects and receives slot | — | Hint "arrastrá sobre la imagen para mover tu fragmento en el collage" appears |
| Drag hint | User has seen connect hint | User performs first drag | Hint "tocá + para ajustar opacidad, rotación y escala" appears |
| Tools hint | User has performed first drag | User opens tools panel | Hint "dos toques rápidos para ascender tu fragmento" appears |
| Bring-front hint | User has opened tools | User double-taps or presses Ascender | Hint "cambiá de fragmento con ← → en herramientas" appears |
| Shuffle hint | User has ascended once | User triggers shuffle | Hint "grabá un gesto personalizado con Gesto" appears |
| All hints seen | All 5 hints fired | User performs any further action | No hint appears; engine silent |

### R-PUP-5: Help Overlay

Dashboard MUST show a [?] icon in the top-right corner. Tapping it SHALL open a full-screen overlay with 4 usage instructions and an [Entendí] close button. The overlay MUST be dismissible by both [Entendí] and tapping outside the card.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Open help | Dashboard is visible | User taps [?] | Help overlay opens with instructions |
| Dismiss via button | Help overlay open | User taps [Entendí] | Overlay closes; dashboard visible |
| Dismiss outside | Help overlay open | User taps outside instruction card | Overlay closes |

### R-PUP-6: Permission Denial Recovery

If the user denies sensor permission, the phone MUST show an error message on the Permission screen: "Sin los sensores no podrás mover tu fragmento. Si querés participar, recargá la página e intentá de nuevo." plus a [Recargar] button that SHALL reload the page.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Permission denied | Permission screen, iOS 13+ | User denies DeviceOrientation or DeviceMotion | Error message + [Recargar] appear on same screen |
| Recovery | Error message showing | User taps [Recargar] | Page reloads; flow restarts from splash |

### R-PUP-7: logoMIDI Branding

Both Splash and Permission screens MUST display the MIDI logo from `assets/logoMIDI.svg` (fallback to `logoMIDI.png`). Splash: large centered. Permission: small top area.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| SVG renders | Phone loads | Splash screen renders | logoMIDI.svg displayed centered |
| PNG fallback | SVG fails to load | Image onerror fires | logoMIDI.png displayed as fallback |

## Module Boundaries

| File | Change | Role |
|------|--------|------|
| `phone-client/index.html` | Modified | Splash screen markup, help overlay template, shader canvas, logo refs, permission error block |
| `phone-client/app.js` | Modified | 3-screen flow controller, action-based HintEngine, help overlay logic, permission denial handler, WebSocket early connect |
| `phone-client/style.css` | Modified | Splash/permission/help overlay styles, [?] icon, error state |
| `phone-client/paper-texture.js` | **New** | Extracted WebGL simplex noise shader from `p5-collage/background-texture.js`, render-once caching, fallback to solid color |
| `phone-client/assets/logoMIDI.svg` | Wired (exists) | MIDI logo on Splash + Permission screens |
