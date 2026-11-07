# Interactive Collage — Installation

Phone-sensor-controlled collage installation. Every connected phone owns one fragment of a shared 1920×1080 canvas and drives it with motion, gestures and direct controls.

The repository ships **no image content**. It runs with 30 empty cells (no photos) until you add images. See [Content](#content).

## Architecture

```
Phone (sensors + controls) ──WS──► Bridge (Node.js, :8080) ──WS──► p5 Collage (browser, 1920×1080)
                                        └── HTTP: /images/content, /api/manifest, /api/layout,
                                                   /phone-client, /p5-collage
```

The bridge serves both clients and the assets, so a single origin covers HTTP and WebSocket.

## Modules

| Path | Role |
|------|------|
| `bridge/index.js` | HTTP + WebSocket server, static serving, slot assignment, action routing, gesture recording |
| `bridge/message-relay.js` | Protocol validation, `VALID_ACTIONS`, filter names, message formatters |
| `bridge/slot-allocator.js` | Slot assignment, empty-slot listing, reassignment (Tránsito) |
| `bridge/gesture-store.js` | Gesture sample recording and lifecycle |
| `bridge/dtw-matcher.js` | Sliding-window DTW, speed-invariant gesture matching |
| `p5-collage/sketch.js` | p5 draw loop, WebSocket client, action handling, floating control bar |
| `p5-collage/device-manager.js` | 30 cells, phone↔slot wiring, sensor mapping |
| `p5-collage/control-panel.js` | Operator sidebar (layout presets, background, per-cell editor) |
| `p5-collage/layout-preset-engine.js` | Six deterministic layout presets |
| `p5-collage/cell-renderer.js` | Per-cell drawing, filters, object-fit contain |
| `p5-collage/background-texture.js` | WebGL simplex-noise paper background |
| `p5-collage/drag-manager.js` | Hit-testing and drag state machine |
| `phone-client/app.js` | Three-screen flow, sensors, gestures, controls, hint engine |
| `phone-client/paper-texture.js` | Phone-side paper shader (same noise as the collage) |
| `phone-client/torn-clip-path.js` | Deterministic torn-edge clip-path |
| `scripts/generate-layout.js` | Regenerates `images/layout.json` from `images/manifest.json` |
| `scripts/process-images.py`, `scripts/remove-bg.py` | Image curation helpers (Python) |
| `scripts/simulate-phones.js` | 30 virtual phones for testing without devices |

## Protocol

Client registration (first message on the socket):

```js
{ type: "register", role: "phone" }   // or role: "player" for the p5 canvas
```

Phone → bridge:

```js
{ type: "sensor", accel: {x,y,z}, gyro: {a,b,g}, orientation: {a,b,g} }
{ type: "action", action: "opacity", value: 75 }
{ type: "action", action: "move", dx: 12, dy: -4 }
{ type: "gesture", gesture: "flick", duration: 3000 }
```

Bridge → phone: `{ type: "assigned", slot }`, `{ type: "error", message }`, `{ type: "gesture-status", … }`.

Bridge → p5: `{ type: "device", slot, accel, gyro, orientation }`, `{ type: "action", slot, action, value?, dx?, dy? }`, `{ type: "system", event: "assign"|"disconnect"|"count" }`, `{ type: "gesture-event", slot, event, gestureId, action }`, `{ type: "cell-image", slot, imageFile, imageUrl }`.

p5 → bridge: `{ type: "image-update", slot, imageFile }`.

Valid actions and value ranges (`bridge/message-relay.js`):

| Action | Value |
|--------|-------|
| `shuffle`, `bring-front`, `cell-next`, `cell-prev`, `filter-next` | — |
| `opacity` | integer `0..100` |
| `scale` | integer `40..180` |
| `rotation` | finite number |
| `filter` | `sepia` \| `grayscale` \| `cyanotype` \| `polaroid` \| `vintage` \| `none` |
| `move` | `{ dx, dy }` finite numbers |
| `record-start`, `record-stop` | optional `duration` (`1000..5000` ms) |

Valid gestures: `flick`. Recorded gestures are matched with DTW.

## HTTP endpoints

`/health`, `/api/layout`, `/api/manifest`, `/images/content/<file>`, `/phone-client/…`, `/p5-collage/…`.

`IMAGES_DIR` overrides the served image directory (default `images/content`), which is how tests avoid depending on repository data.

## Content

The system is data-driven. To load a dataset:

1. Put image files in `images/content/`.
2. Describe them in `images/manifest.json`:

   ```json
   { "001": { "file": "001.jpg", "w": 1600, "h": 977 } }
   ```

3. Run `npm run generate-layout` to rebuild `images/layout.json` (30 cells, positions, rotation, z-order).

A cell with `imageFile: null` renders nothing, so the installation still runs with zero content. `generate-layout` refuses to run against an empty manifest and leaves the existing layout untouched.

## Running

```bash
npm install
npm test                    # Jest, 20 suites
npm run test:coverage
npm run bridge              # http://localhost:8080
# projector:  http://localhost:8080/p5-collage/
# phone:      http://localhost:8080/phone-client/
npm run generate-layout     # requires a non-empty manifest
node scripts/simulate-phones.js   # 30 virtual phones
```

Sensors require a secure context: `localhost` works, a plain LAN IP does not. Serving the phone client over HTTPS (tunnel or TLS) is a deployment concern, not a code one.

## Testing

Jest, `**/tests/**/*.test.js`. Browser modules are plain global scripts and end with a CommonJS shim:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { /* public functions */ };
}
```

Tests `require()` the module and stub the p5 globals it uses (`push`, `pop`, `translate`, `scale`, `drawingContext`) in `beforeEach`. Keep that pattern: it is the only reason Node can test browser code with no build step.

## Workflow

`openspec/` holds the capability specs and the change archive. New behavior follows the SDD cycle: explore → propose → spec → design → tasks → apply (RED → GREEN → REFACTOR) → verify → archive. `openspec/changes/archive/` is historical record and is intentionally not neutralized.
