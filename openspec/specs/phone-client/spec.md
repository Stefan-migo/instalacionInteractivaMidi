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

Gallery overlay: 3 example cards. Teaches each gesture through practice.

### Requirements

#### R-GG-1: Gallery Overlay

"Gestos" button (replaces "Gesto") SHALL open the gallery. MUST be dismissible via × or tap-outside.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Open gallery | Dashboard visible | User taps "Gestos" | Gallery opens with 3 cards |
| Dismiss × | Gallery open | User taps × | Gallery closes; dashboard visible |
| Dismiss outside | Gallery open | User taps outside card | Gallery closes |

#### R-GG-2: Gesture Cards

Gallery SHALL show 3 cards. Each card: icon, name, description, [Practicar].

| Gesture | Name | Description | Effect |
|---------|------|-------------|--------|
| Inclinar | Inclinar | Incliná hacia adelante → saltás de celda | `cell-next` |
| Látigo | Látigo | Sacudí → cambia foto | `shuffle` |
| Girar | Girar | Girá como perilla → cambia filtro | `filter-next` |

#### R-GG-3: Practice Flow

User taps [Practicar] → practice overlay with instruction text. The gesture is the installation control whenever sensors are authorised; the overlay only teaches it and shows the feedback. On match: phone MUST send the action to the bridge, SHOULD vibrate (`navigator.vibrate()`), and MUST show green check + "¡Bien! Eso fue un gesto." for 2s. User MAY practice again.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Practice Inclinar | Practice overlay for Inclinar open | User tilts past 30° for 400 ms | Sends cell-next, vibrates, green check 2s |
| Practice Látigo | Practice overlay for Látigo open | User shakes the phone (gravity-free jerk > 15, then < 10) | Sends shuffle, vibrates, green check 2s |
| Practice Girar | Practice overlay for Girar open | User turns the phone 45° about its own z axis | Sends filter-next, vibrates, green check 2s |
| False positive | Practice for Girar open | User rotates slower than 40°/s | No action sent |

#### R-GG-4: Detection Heuristics

Client-side only — no bridge changes. The detectors are the shipped module `phone-client/gesture-detector.js`; `phone-client/app.js` only feeds it sensor frames. They run whenever sensors are authorised, because the gestures are the default controls, not a practice-only toy.

One physical burst MUST resolve to at most one gesture: after any gesture fires, every detector is locked for 800 ms; a knob turn in flight blocks Látigo and Inclinar; an armed Látigo blocks the knob.

| Gesture | Sensor | Condition |
|---------|--------|-----------|
| Girar | `rotationRate.alpha` (deg/s about the device z axis) | signed integral ≥ 45°, re-armed after 120 ms below 40 °/s, 1200 ms cooldown |
| Látigo | linear acceleration (`acceleration`, gravity removed; low-pass estimate when the platform omits it) | frame-to-frame change > 15 m/s² arms, < 10 m/s² within 200 ms fires, 750 ms cooldown |
| Inclinar | `deviceorientation.beta` | beyond 30° held 400 ms, cancelled by a jerk in the last 800 ms, 1200 ms cooldown |

`DeviceOrientationEvent.alpha` MUST NOT take part in any detector: it is the heading about the earth vertical, so it only matches a knob when the phone lies flat, and the ZXY decomposition is singular near `beta = ±90°`, where the wrist roll spills into it.

#### R-GG-5: No gesture recording

The gallery MUST NOT offer to record a gesture, and no client code may send `record-start` or `record-stop`. *(The wizard was removed: a visitor stands in front of the piece for minutes, so recording a template taught nothing usable. The DTW matcher stays in the bridge and is dormant.)*

### Module Boundaries

| File | Change | Role |
|------|--------|------|
| `phone-client/index.html` | Modified | Button "Gestos"; gallery overlay DOM (cards, ×); practice overlay (instruction, feedback); loads the detector module before `app.js` |
| `phone-client/gesture-detector.js` | Added | The three detectors and the burst lockout. Plain global script with a CommonJS shim so tests exercise the shipped code |
| `phone-client/app.js` | Modified | Button click → gallery; gallery state machine; sensor listeners feed the detector; practice wiring |
| `phone-client/style.css` | Modified | Gallery styles, cards, practice overlay, green check |
| `bridge/*` | Modified | `flick` resolves to `shuffle`, the action the gallery teaches |
| `p5-collage/*` | Unchanged | — |
