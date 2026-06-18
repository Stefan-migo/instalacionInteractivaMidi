# Design: Phone Client UX Polish

## Technical Approach

Three-screen state machine in `app.js` (splash → permission → dashboard). Replace SVG feTurbulence with extracted WebGL simplex noise shader rendered once to dataURL. Rewrite HintEngine to track action flags sequentially. Add help overlay + permission denial handler — all DOM-managed within existing `phone-client/` files.

## Architecture Decisions

### Decision: Screen Flow Controller

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| Simple `goToScreen()` state machine in app.js IIFE | Router, separate controller | Existing codebase uses IIFE pattern; consistent, no new patterns |
| DOM visibility toggle (`hidden` class) | Dynamic DOM insertion | Zero layout shift, screen markup loads with page |
| WebSocket connect starts on splash→permission transition | Connect immediately on page load | Prevents unnecessary connection before user shows intent; preserves slot for active users |
| Error state is inline in permission-screen (no new screen) | Separate error screen | Same DOM container; avoids screen count explosion |

### Decision: Shader Extraction

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| `paper-texture.js` — standalone function `renderPaperTexture(canvas, intensity, seed)` | Inline in app.js, p5 dependency | Zero-dependency, testable, mirrors existing `torn-clip-path.js` pattern |
| Render once → dataURL → CSS custom property `--paper-bg` | Live canvas with requestAnimationFrame | One render, zero runtime cost; CSS `background-image` with multiply works identically |
| Copy GLSL sources verbatim from background-texture.js | Reference via import | No module system; verbatim copy guaranteed correct; phone-client owns its copy per proposal scope |

### Decision: HintEngine Rewrite

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| In-memory action flags + sequence index | Idle timer, local storage loop | Matches spec: no loop, no persistence, timer-based dismiss only |
| Strict sequential (hint N+1 waits for hint N dismissal) | Fire on any new action | Spec scenarios require connect→drag→tools→bring-front→shuffle sequence |
| Timer-based dismissal (4.5s) + dismiss on tap | Dismiss only on action | Still needs auto-dismiss so hint doesn't block content |

### Decision: logoMIDI Wiring

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| `<img>` tag with onerror PNG fallback | Inline SVG, CSS background | Native loading/error handling; simple, matches standard browser behavior |
| `/phone-client/assets/logoMIDI.svg` path | Relative `assets/logoMIDI.svg` | Consistent with existing `/phone-client/` script paths served by bridge |

## Data Flow

```
Page Load
  ├── paper-texture.js: render WebGL → dataURL → CSS --paper-bg (body::after)
  └── Screen 1 (Splash) shown
         │
         [Participar]
         │
         ▼
       Screen 2 (Permission) shown
         ├── WebSocket connect()
         │
         [Activar sensores]
         │
         ├── Granted → Screen 3 (Dashboard) + sensor listeners
         └── Denied  → Permission screen shows error + [Recargar]

Dashboard interaction:
  ┌── [?] → Help overlay → [Entendí] / tap outside → close
  │
  ├── drag → markAction('dragged') → HintEngine: show if next in sequence
  ├── + → toolsOpen → markAction('toolsOpened')
  ├── Ascender / double-tap → sendAction('bring-front') → markAction('broughtFront')
  └── shuffle button → sendAction('shuffle') → markAction('shuffled')
```

## File Changes

| File | Action | Role |
|------|--------|------|
| `phone-client/paper-texture.js` | **Create** | `renderPaperTexture(canvas, intensity, seed)` — WebGL simplex noise, no deps |
| `phone-client/index.html` | Modify | Splash screen, help overlay, logo refs, error block; remove SVG filter; add hidden paper canvas |
| `phone-client/app.js` | Modify | 3-screen flow, action-based HintEngine, help overlay, permission denial, WS early connect |
| `phone-client/style.css` | Modify | Splash/help overlay/error styles; remove SVG filter reference; add `--paper-bg` CSS var |

## Interfaces / Contracts

### paper-texture.js
```js
/**
 * Render paper texture via WebGL simplex noise (Ashima Arts).
 * @param {HTMLCanvasElement}  [canvas]   - optional canvas; created if omitted
 * @param {number}             [intensity=0.8]  - noise intensity 0..1
 * @param {number}             [seed=1918]      - pseudo-random seed (reserved)
 * @returns {HTMLCanvasElement|null}  rendered canvas, or null on failure
 */
function renderPaperTexture(canvas, intensity, seed)
```

### Screen flow controller (app.js IIFE)
```js
var SCREENS = { splash: 'splash-screen', permission: 'permission-screen', dashboard: 'dashboard' };
var currentScreen = 'splash';

function goToScreen(name) { /* hide all, show target */ }
```

### HintEngine action flags
```js
var hintFlags = { connected: false, dragged: false, toolsOpened: false, broughtFront: false, shuffled: false };
var hintSequence = ['connected', 'dragged', 'toolsOpened', 'broughtFront', 'shuffled'];
var hintIndex = 0;

function markAction(flag) { /* fire hint if flag matches next in sequence */ }
```

### CSS custom properties (new / modified)
- `--paper-bg` — dataURL of rendered WebGL texture (replaces `--user-bg` + SVG filter)

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `renderPaperTexture()` returns canvas or null | DOM-free test: verify function signature, WebGL unavailable returns null, fallback behavior |
| Unit | HintEngine sequential logic | Test `markAction` fires correct hint text at correct sequence position |
| Integration | 3-screen flow DOM state | Verify `goToScreen` toggles `hidden` class correctly |
| E2E | Manual browser test | Verify splash→permission→dashboard flow on real device |
| Manual | WebGL fallback | Test on browser with WebGL disabled; verify solid fill renders |

## Edge Cases

| Case | Behavior |
|------|----------|
| WebGL unavailable | `renderPaperTexture` returns null; `--paper-bg` never set; CSS fallback to `#ebd9b3` solid fill |
| SVG logo load failure | `onerror` fires; falls back to `logoMIDI.png` |
| Very small screens (< 320px) | Existing CSS safe-area + spacing handles constraints; splash layout uses flex centering |
| Double-tap while help overlay open | Help overlay has z-index 100 and blocks touch overlay via pointer-events |
| All 5 hints seen | `hintIndex >= 5` guard; all subsequent `markAction()` calls are no-ops |
| Sensor permission denied (iOS 13+) | Error message + [Recargar] shown inline on permission screen; no screen transition |
| Orientation change after texture render | Texture rendered once at initial viewport; noise pattern mismatch is visually negligible; no re-render (deferred to future if needed) |
