# Delta for phone-client — Gesture Gallery & Wizard Entry

## ADDED Capability: Gesture Gallery (`phone-gesture-gallery`)

**Overview**: Gallery overlay: 3 example cards + "Crear mi gesto". Teaches through practice before custom recording.

### R-GG-1: Gallery Overlay

"Gestos" button (replaces "Gesto") SHALL open the gallery. MUST be dismissible via × or tap-outside.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Open gallery | Dashboard visible | User taps "Gestos" | Gallery opens with 3 cards + "Crear mi gesto" |
| Dismiss × | Gallery open | User taps × | Gallery closes; dashboard visible |
| Dismiss outside | Gallery open | User taps outside card | Gallery closes |

### R-GG-2: Gesture Cards

Gallery SHALL show 3 cards + "Crear mi gesto". Each card: icon, name, description, [Practicar].

| Gesture | Icon | Name | Description | Effect |
|---------|------|------|-------------|--------|
| Girar | ⟳ | Girar | Cambia el borde | Cycles border |
| Sacudir | 𝄐 | Sacudir | Cambia la foto | Shuffles image |
| Elevar | ↕ | Elevar | Cambia el filtro | Cycles filter |

### R-GG-3: Practice Flow

User taps [Practicar] → practice overlay with instruction text. While open, client-side detector activates. On match: phone MUST send the action to the bridge, SHOULD vibrate (`navigator.vibrate()`), and MUST show green check + "¡Bien! Eso fue un gesto." for 2s. User MAY practice again.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Practice Girar | Practice overlay for Girar open | User rotates phone >30° gamma | Sends border-next, vibrates, green check 2s |
| Practice Sacudir | Practice overlay for Sacudir open | User shakes phone (jerk >15) | Sends shuffle, vibrates, green check 2s |
| Practice Elevar | Practice overlay for Elevar open | User jerks up (accel.y < -12) | Cycles filter, vibrates, green check 2s |
| False positive | Practice for Girar open | User rotates slowly (gamma <30°) | No action sent |

### R-GG-4: Detection Heuristics

Client-side only — no bridge changes. Detectors active ONLY while the practice overlay for that gesture is open. Each SHALL have a ~1s cooldown.

| Gesture | Sensor | Condition |
|---------|--------|-----------|
| Girar | `rotationRate.gamma` | abs > 30° |
| Sacudir | `jerkMag` (accel derivative) | > 15 |
| Elevar | `accel.y` | < -12 |

### R-GG-5: "Crear mi gesto"

Gallery MUST always show "Crear mi gesto". Tapping it SHALL open the existing 5-step wizard — unchanged.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Wizard from gallery | Gallery open | User taps "Crear mi gesto" | Existing 5-step wizard opens at practice step |

---

## MODIFIED Capability: Gesture Wizard Entry (`phone-gesture-wizard`)

### Modified R-WIZ-1: Wizard Trigger Button

Button label changes from "Gesto" to "Gestos". Tapping it SHALL open the gallery, not the wizard directly. Wizard only opens via "Crear mi gesto" inside the gallery.
(Previously: "Gesto" opened the wizard directly.)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Flow via gallery | Phone connected | User taps "Gestos" | Gallery opens (not wizard) |
|  | Gallery open | User taps "Crear mi gesto" | Wizard practice step shown |
|  | Wizard open | User completes steps | Flow unchanged: duration → countdown → recording → confirm |

Unchanged: R-WIZ-2 through R-WIZ-12, scenarios W-S2, W-S3, W-S4.

---

## Module Boundaries

| File | Change | Role |
|------|--------|------|
| `phone-client/index.html` | Modified | Button "Gestos"; gallery overlay DOM (cards, ×); practice overlay (instruction, feedback) |
| `phone-client/app.js` | Modified | Button click → gallery; gallery state machine; 3 heuristic detectors in gestureDetector; practice wiring |
| `phone-client/style.css` | Modified | Gallery styles, cards, practice overlay, green check |
| `bridge/*` | Unchanged | — |
| `p5-collage/*` | Unchanged | — |
