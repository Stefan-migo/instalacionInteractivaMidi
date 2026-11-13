# Interactive Collage — Installation

Phone-sensor-controlled collage installation. Every connected phone owns one fragment of a shared 1920×1080 canvas and drives it with motion, gestures and direct controls.

The repository ships a normalized 130-image WebP library in `images/content/`, so a fresh clone renders the full collage. Replace it with your own dataset by following [Content](#content); with an empty manifest the system still runs 30 empty cells.

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
| `bridge/group-state.js` | Groups the 30 phones into 3 and aggregates each group's sensor intensity |
| `bridge/midi-out.js` | MIDI output adapter for `Collage-MIDI`, degrading silently when the port is missing |
| `music/agent.js` | Local agent: registers with the bridge as `agent` and writes group values to MIDI |
| `p5-collage/sketch.js` | p5 draw loop, WebSocket client, action handling, floating control bar |
| `p5-collage/device-manager.js` | 30 cells, phone↔slot wiring, sensor mapping |
| `p5-collage/operator-link.js` | Receives the operator page's commands and applies them to cells |
| `p5-collage/collage-layout.js` | Parsed layout model: canvas size and the 30 cells |
| `p5-collage/transition-renderer.js` | Crossfade state machine for image cycling (IDLE → FADING → IDLE) |
| `p5-collage/size-classes.js` | Validates the authored size classes and resolves class → ink area → drawn size, shared by the operator preview and the collage |
| `operator/operator.js` | Operator page: presets, scatter scale, background, per-cell editor and the Dimensiones size authoring |
| `p5-collage/layout-preset-engine.js` | Six deterministic layout presets |
| `p5-collage/cell-renderer.js` | Per-cell drawing, filters, object-fit contain |
| `p5-collage/cell-image.js` | Applies a deck assignment to a cell without blanking it while the bitmap loads |
| `p5-collage/image-deck.js` | Global image deck: one distinct image per cell, no repeats on screen |
| `p5-collage/image-loader.js` | On-demand image loading with a bounded, pinned LRU cache |
| `p5-collage/background-texture.js` | WebGL simplex-noise paper background |
| `p5-collage/drag-manager.js` | Hit-testing and drag state machine |
| `phone-client/app.js` | Three-screen flow, sensors, gestures, controls, hint engine |
| `phone-client/gesture-detector.js` | Client-side detectors for girar, látigo and inclinar, plus the one-gesture-per-burst lockout |
| `phone-client/paper-texture.js` | Phone-side paper shader (same noise as the collage) |
| `phone-client/torn-clip-path.js` | Deterministic torn-edge clip-path |
| `scripts/generate-layout.js` | Regenerates `images/layout.json` from `images/manifest.json` |
| `scripts/build-ink-metadata.js` | Measures each image's opaque silhouette and writes `inkBox`, `inkRatio`, `inkCenter` into the manifest |
| `scripts/process-images.py`, `scripts/remove-bg.py` | Image curation helpers (Python) |
| `scripts/simulate-phones.js` | 30 virtual phones for testing without devices |

## Protocol

Client registration (first message on the socket):

```js
{ type: "register", role: "phone" }   // or role: "player" for the p5 canvas
                                      // or role: "agent" for the local music agent
```

Phone → bridge:

```js
{ type: "sensor", accel: {x,y,z}, gyro: {a,b,g}, orientation: {a,b,g} }
{ type: "action", action: "opacity", value: 75 }
{ type: "action", action: "move", dx: 12, dy: -4 }
{ type: "gesture", gesture: "flick", duration: 3000 }
```

Bridge → phone: `{ type: "assigned", slot }`, `{ type: "error", message }`, `{ type: "gesture-status", … }`.

Bridge ⇄ agent: `{ type: "system", event: "agent-ready" }`, `{ type: "music-config", groups }`, `{ type: "music-config-applied", groups }`, and `{ type: "music-state", groups: [{ group, value, lanes, phones }] }` at 20 Hz. Each group's continuous lane carries three controllers on its group channel: CC 21 position, CC 22 scale and CC 23 rotation, fed by the phone pad's touch parameters (not the gyroscope).

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

Valid gestures: `flick`. The bridge resolves it to `shuffle`, the action the gallery on the phone teaches as Látigo. Recorded gestures are matched with DTW, but no client records any more, so the matcher is dormant.

## HTTP endpoints

`/health`, `/api/layout`, `/api/manifest`, `/api/sizes`, `/images/content/<file>`, `/phone-client/…`, `/p5-collage/…`, `/operator/…`.

`IMAGES_DIR` overrides the served image directory (default `images/content`), which is how tests avoid depending on repository data.

## Content

The system is data-driven. To load a dataset:

1. Put image files in `images/content/`.
2. Describe them in `images/manifest.json`:

   ```json
   { "001": { "file": "001.jpg", "w": 1600, "h": 977 } }
   ```

   Optionally, `node scripts/build-ink-metadata.js` adds the silhouette fields the drawing code uses (`inkBox`, `inkRatio`, `inkCenter`, measured with ffmpeg). The script is idempotent and preserves every other field; the four library images with no alpha channel get `inkRatio: 1` and a full-frame box rather than a fabricated contour.

3. Run `npm run generate-layout` to rebuild `images/layout.json` (30 cells, positions, rotation, z-order).

The collage renders whatever the image deck assigns, not the layout: `images/layout.json` keeps geometry only. With an empty manifest the deck is empty and every cell renders nothing, so the installation still runs with zero content.

The deck deals distinct images: with at least as many files as cells, no two fragments show the same photo, and cycling returns the released image to the bottom of the deck. Látigo (`shuffle`) exchanges images between two cells instead. Only the visible cells are decoded up front; the rest of the library loads on demand behind a pinned LRU cache (`CONFIG.imageCacheSize`). `generate-layout` refuses to run against an empty manifest and leaves the existing layout untouched.

Fragments are sized by two rules, because a cell alone does not decide how big a photo looks. The deck prefers an image whose silhouette aspect is within `ASPECT_TOLERANCE` (`p5-collage/image-deck.js`) of the target cell, which keeps `object-fit: contain` from shrinking a panorama into a sliver. Then, after the contain fit, if the painted area falls under `CONFIG.minInkCoverage` of the cell, the fragment is scaled up until it clears that floor, bounded by `CONFIG.maxInkOverflow`. The floor is measured on **ink**, not on the bounding rectangle: the torn silhouette means only 30-60% of a frame is actually painted, so a rectangle-based floor would pass fragments that still look empty. Nothing is cropped to achieve either rule.

Sizes can also be authored per image, in `images/sizes.json`. Each entry maps an image key to a class (`S`, `M`, `L`, `XL`), and each class maps to a target **ink** area as a fraction of the canvas (`0.015` / `0.030` / `0.060` / `0.100` by default — tunable in that file, never hardcoded in a module). For an authored image the drawn frame area becomes `targetInk / inkRatio`, so two images of the same class carry the same painted mass even when one is a panorama and the other a portrait. The per-preset random scale then degrades to jitter, and the ink floor stops correcting and only warns. Every unassigned image keeps the two rules above, which is why the file ships empty: authoring is opt-in per image, and merging it changes nothing on screen. Author them in the operator page's **Dimensiones** mode, which shows one image at a time beside a fixed 300×300 px reference and saves through the bridge.

## Running

```bash
npm install
npm test                    # Jest, 54 suites
npm run test:coverage
npm run bridge              # http://localhost:8080
# projector:  http://localhost:8080/p5-collage/
# phone:      http://localhost:8080/phone-client/
# operator:   http://localhost:8080/operator/
npm run generate-layout     # requires a non-empty manifest
node scripts/simulate-phones.js   # 30 virtual phones
```

Sensors require a secure context: `localhost` works, a plain LAN IP does not. Serving the phone client over HTTPS (tunnel or TLS) is a deployment concern, not a code one.

Size assignments are written through `POST /api/sizes`, which stays disabled unless `SIZE_WRITES_ENABLED=true` is set for the bridge process. It is off in production on purpose: the endpoint rewrites a tracked file, and the same bridge is publicly reachable.

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
