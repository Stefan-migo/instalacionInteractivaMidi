# Spec: Phone Client UX — Onboarding Flow

## Overview

Defines the onboarding experience for phone visitors at the exhibition: splash screen, sensor permission flow with recovery, WebGL paper texture background, action-based hint engine, and help overlay. These capabilities transform the phone client from a blank tool into a self-explanatory interactive experience that orients first-time visitors.

This spec complements [`openspec/specs/phone-ux/spec.md`](../phone-ux/spec.md) (functional behavior extensions) and [`openspec/specs/phone-style/spec.md`](../phone-style/spec.md) (visual design system).

---

## Capability: Onboarding Flow (`phone-onboarding`)

### Requirements

#### R-PUP-1: Three-Screen Onboarding Flow

The phone client MUST present a 3-screen sequential flow: Splash → Permission → Dashboard.
Screen 1 (Splash): Project title + [Participar] button.
Screen 2 (Permission): Sensor explanation + [Activar sensores].
Screen 3 (Dashboard): Existing image + controls.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Full flow | Phone loads | User taps [Participar] | Permission screen appears |
| Permission granted | Permission screen shown | User taps [Activar sensores] and grants permission | Dashboard appears with sensor stream active |

#### R-PUP-2: WebSocket Background Connect

The phone MUST initiate WebSocket connection during Permission screen, before sensor permission is granted.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Background connect | Permission screen is visible | User has not yet tapped [Activar sensores] | WebSocket connects in background; status dot updates |
| Slot assigned pre-permission | WebSocket connected | Bridge assigns slot before permission | Slot badge updates; connection ready on dashboard entry |

#### R-PUP-3: WebGL Paper Texture

The phone SHALL replace the SVG feTurbulence filter with a WebGL simplex noise shader (Ashima Arts, identical to p5-collage). SHALL render once to offscreen canvas at 80% default intensity, cached. MUST apply via `mix-blend-mode: multiply` over the entire background. MUST fall back to solid warm fill (#ebd9b3) if WebGL context fails.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| WebGL renders | Phone loads, WebGL available | Page initializes | Shader renders once; paper texture visible at 80% intensity |
| WebGL fallback | Phone loads, WebGL unavailable or fails | Page initializes | Solid #ebd9b3 background; no texture visible |
| Side-by-side match | Both p5-collage and phone-client open | Same intensity + seed | Texture visually matches (tolerance: perceptually equivalent noise pattern) |

#### R-PUP-4: Action-Based HintEngine

The hint engine MUST replace the current idle-timer approach with 5 action-triggered hints: connect, first-drag, first-tools-open, first-bring-front, first-shuffle. Hints MUST fire once per action in sequence. After all 5 are seen, the engine MUST remain silent (no loop).

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Connect hint | Phone connects and receives slot | — | Hint "arrastrá sobre la imagen para mover tu fragmento en el collage" appears |
| Drag hint | User has seen connect hint | User performs first drag | Hint "tocá + para ajustar opacidad, rotación y escala" appears |
| Tools hint | User has performed first drag | User opens tools panel | Hint "dos toques rápidos para ascender tu fragmento" appears |
| Bring-front hint | User has opened tools | User double-taps or presses Ascender | Hint "cambiá de fragmento con ← → en herramientas" appears |
| Shuffle hint | User has ascended once | User triggers shuffle | Hint "grabá un gesto personalizado con Gesto" appears |
| All hints seen | All 5 hints fired | User performs any further action | No hint appears; engine silent |

#### R-PUP-5: Help Overlay

Dashboard MUST show a [?] icon in the top-right corner. Tapping it SHALL open a full-screen overlay with 4 usage instructions and an [Entendí] close button. The overlay MUST be dismissible by both [Entendí] and tapping outside the card.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Open help | Dashboard is visible | User taps [?] | Help overlay opens with instructions |
| Dismiss via button | Help overlay open | User taps [Entendí] | Overlay closes; dashboard visible |
| Dismiss outside | Help overlay open | User taps outside instruction card | Overlay closes |

#### R-PUP-6: Permission Denial Recovery

If the user denies sensor permission, the phone MUST show an error message on the Permission screen: "Sin los sensores no podrás mover tu fragmento. Si querés participar, recargá la página e intentá de nuevo." plus a [Recargar] button that SHALL reload the page.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Permission denied | Permission screen, iOS 13+ | User denies DeviceOrientation or DeviceMotion | Error message + [Recargar] appear on same screen |
| Recovery | Error message showing | User taps [Recargar] | Page reloads; flow restarts from splash |

### Module Boundaries

| File | Change | Role |
|------|--------|------|
| `phone-client/index.html` | Modified | Splash screen markup, help overlay template, shader canvas, permission error block |
| `phone-client/app.js` | Modified | 3-screen flow controller, action-based HintEngine, help overlay logic, permission denial handler, WebSocket early connect |
| `phone-client/style.css` | Modified | Splash/permission/help overlay styles, [?] icon, error state |
| `phone-client/paper-texture.js` | **New** | Extracted WebGL simplex noise shader from `p5-collage/background-texture.js`, render-once caching, fallback to solid color |

## Capability: Gesture Gallery (`phone-gesture-gallery`)

### Overview

Gallery overlay: 3 example cards + "Crear mi gesto". Teaches through practice before custom recording.

### Requirements

#### R-GG-1: Gallery Overlay

"Gestos" button (replaces "Gesto") SHALL open the gallery. MUST be dismissible via × or tap-outside.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Open gallery | Dashboard visible | User taps "Gestos" | Gallery opens with 3 cards + "Crear mi gesto" |
| Dismiss × | Gallery open | User taps × | Gallery closes; dashboard visible |
| Dismiss outside | Gallery open | User taps outside card | Gallery closes |

#### R-GG-2: Gesture Cards

Gallery SHALL show 3 cards + "Crear mi gesto". Each card: icon, name, description, [Practicar].

| Gesture | Icon | Name | Description | Effect |
|---------|------|------|-------------|--------|
| Inclinar | ⤓ | Inclinar | Salta a otra celda | Moves the fragment to another slot |
| Sacudir | 𝄐 | Sacudir | Cambia la foto | Shuffles image |
| Elevar | ↕ | Elevar | Cambia el filtro | Cycles filter |

#### R-GG-3: Practice Flow

User taps [Practicar] → practice overlay with instruction text. While open, client-side detector activates. On match: phone MUST send the action to the bridge, SHOULD vibrate (`navigator.vibrate()`), and MUST show green check + "¡Bien! Eso fue un gesto." for 2s. User MAY practice again.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Practice Inclinar | Practice overlay for Inclinar open | User tilts forward >30° sustained 400ms | Sends cell-next, vibrates, green check 2s |
| Practice Sacudir | Practice overlay for Sacudir open | User shakes phone (jerk >15) | Sends shuffle, vibrates, green check 2s |
| Practice Elevar | Practice overlay for Elevar open | User jerks up (accel.y < -12) | Cycles filter, vibrates, green check 2s |
| False positive | Practice for Girar open | User rotates slowly (gamma <30°) | No action sent |

#### R-GG-4: Detection Heuristics

Client-side only — no bridge changes. Detectors active ONLY while the practice overlay for that gesture is open. Each SHALL have a ~1s cooldown.

| Gesture | Sensor | Condition |
|---------|--------|-----------|
| Girar | `rotationRate.gamma` | abs > 30° |
| Sacudir | `jerkMag` (accel derivative) | > 15 |
| Elevar | `accel.y` | < -12 |

#### R-GG-5: "Crear mi gesto"

Gallery MUST always show "Crear mi gesto". Tapping it SHALL open the existing 5-step wizard — unchanged.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Wizard from gallery | Gallery open | User taps "Crear mi gesto" | Existing 5-step wizard opens at practice step |

### Module Boundaries

| File | Change | Role |
|------|--------|------|
| `phone-client/index.html` | Modified | Button "Gestos"; gallery overlay DOM (cards, ×); practice overlay (instruction, feedback) |
| `phone-client/app.js` | Modified | Button click → gallery; gallery state machine; 3 heuristic detectors in gestureDetector; practice wiring |
| `phone-client/style.css` | Modified | Gallery styles, cards, practice overlay, green check |
| `bridge/*` | Unchanged | — |
| `p5-collage/*` | Unchanged | — |

