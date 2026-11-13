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
| `operator/deck-curation.js` | Selection, empty-cell warning and toast text for the operator's grid and bulk actions |
| `p5-collage/deck-list.js` | Validates the deck exclusions and resolves the usable image pool in manifest order |
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
| `scripts/build-thumbnails.js` | Generates `images/thumbs/<key>.webp` at 200 px for the operator grid |
| `scripts/import-library.js` | Release entry point: dedupes a raw folder, normalizes it to WebP and rewrites the manifest with renumbered keys |
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

`/health`, `/api/layout`, `/api/manifest`, `/api/sizes`, `/api/deck`, `/images/content/<file>`, `/images/thumbs/<file>`, `/phone-client/…`, `/p5-collage/…`, `/operator/…`.

`IMAGES_DIR` overrides the served image directory (default `images/content`), which is how tests avoid depending on repository data.

## Content

The system is data-driven. To load a dataset:

1. Put image files in `images/content/`.
2. Describe them in `images/manifest.json`:

   ```json
   { "001": { "file": "001.jpg", "w": 1600, "h": 977 } }
   ```

   Optionally, `node scripts/build-ink-metadata.js` adds the silhouette fields the drawing code uses (`inkBox`, `inkRatio`, `inkCenter`, measured with ffmpeg). The script is idempotent and preserves every other field; the four library images with no alpha channel get `inkRatio: 1` and a full-frame box rather than a fabricated contour.

To replace the whole library, `node scripts/import-library.js` is the release entry point. It enumerates the source folder deterministically, drops exact duplicates by content hash, normalizes every survivor to WebP (longest edge ≤ 1600 px, quality 90, alpha preserved, never upscaled) into `images/content/`, and rewrites `images/manifest.json` with `file`, `w` and `h` only. The `role`/`axis`/`pole` taxonomy of earlier libraries is no longer emitted, because no code reads it. Keys are renumbered `001…N`, so **a release invalidates the authored sizes in `images/sizes.json` and the exclusions in `images/deck.json`: both are reset**. Afterwards run the ink pass, `npm run generate-layout` and `node scripts/build-thumbnails.js --force`, in that order. `--force` is not optional for a release: keys keep their names while the pictures behind them change, so the mtime skip would keep the previous library's thumbnails and the grid would show the wrong image for every reused key. `--dry-run` prints the plan and writes nothing.

3. Run `npm run generate-layout` to rebuild `images/layout.json` (30 cells, positions, rotation, z-order).

The collage renders whatever the image deck assigns, not the layout: `images/layout.json` keeps geometry only. With an empty manifest the deck is empty and every cell renders nothing, so the installation still runs with zero content.

The deck deals distinct images: with at least as many files as cells, no two fragments show the same photo, and cycling returns the released image to the bottom of the deck. Látigo (`shuffle`) exchanges images between two cells instead. Only the visible cells are decoded up front; the rest of the library loads on demand behind a pinned LRU cache (`CONFIG.imageCacheSize`). `generate-layout` refuses to run against an empty manifest and leaves the existing layout untouched.

Fragments are sized by two rules, because a cell alone does not decide how big a photo looks. The deck prefers an image whose silhouette aspect is within `ASPECT_TOLERANCE` (`p5-collage/image-deck.js`) of the target cell, which keeps `object-fit: contain` from shrinking a panorama into a sliver. Then, after the contain fit, if the painted area falls under `CONFIG.minInkCoverage` of the cell, the fragment is scaled up until it clears that floor, bounded by `CONFIG.maxInkOverflow`. The floor is measured on **ink**, not on the bounding rectangle: the torn silhouette means only 30-60% of a frame is actually painted, so a rectangle-based floor would pass fragments that still look empty. Nothing is cropped to achieve either rule.

Where a fragment sits is decided by its composition percentage, measured in the fragment's own units instead of in canvas pixels: up to `bleedBand` (`0.75` in `p5-collage/layout-preset-engine.js`, mirrored on the other side) the fragment stays inside the canvas and beyond it the overhang grows as a fraction of the fragment itself, so a small fragment starts hanging over the edge at the same composition point as a large one and by the same fraction of itself. `minVisible` (`0.25`) is the floor of what always stays painted. The rule is resolved by `resolveAnchor` against the drawn fragment, so it also holds after the general scale or a size class shrinks it; a fragment the operator dragged keeps its own centre.

Sizes can also be authored per image, in `images/sizes.json`. Each entry maps an image key to a class (`S`, `M`, `L`, `XL`), and each class maps to a target **ink** area as a fraction of the canvas (`0.015` / `0.030` / `0.060` / `0.100` by default — tunable in that file, never hardcoded in a module). For an authored image the drawn frame area becomes `targetInk / inkRatio`, so two images of the same class carry the same painted mass even when one is a panorama and the other a portrait. That base is then multiplied by the operator's general scale (the **Escala de dispersión** slider), so authoring a class never disables it, and the per-preset random scale degrades to jitter; the ink floor stops correcting and only warns. Every unassigned image keeps the two rules above, which is why the file ships empty: authoring is opt-in per image, and merging it changes nothing on screen. Author them in the operator page's **Dimensiones** mode, which shows one image at a time beside a fixed 300×300 px reference and saves through the bridge.

Images can also be taken out of the deck, in `images/deck.json` (`version` plus an `excluded` list, shipped empty). An excluded image is never dealt and returns when it is re-included; nothing deletes files. Because the deck deals one distinct image per visible cell and never repeats, **below 30 available images the surplus cells render nothing**, so the operator's grid states how many cells would be left empty before saving. The grid lists `images/thumbs/<key>.webp` thumbnails and both bulk actions — size class and exclusion — go through the same guarded write endpoints as the Dimensiones mode. Operator confirmations are toasts; continuous slider drags stay silent on purpose, because one toast per tick would say nothing.

## Running

```bash
npm install
npm test                    # Jest, 59 suites
npm run test:coverage
npm run bridge              # http://localhost:8080
# projector:  http://localhost:8080/p5-collage/
# phone:      http://localhost:8080/phone-client/
# operator:   http://localhost:8080/operator/
npm run generate-layout     # requires a non-empty manifest
node scripts/import-library.js --dry-run   # preview a library release
node scripts/simulate-phones.js   # 30 virtual phones
```

Sensors require a secure context: `localhost` works, a plain LAN IP does not. Serving the phone client over HTTPS (tunnel or TLS) is a deployment concern, not a code one.

Authoring writes — `POST /api/sizes` and `POST /api/deck` — stay disabled unless `AUTHORING_WRITES_ENABLED=true` is set for the bridge process. Both are off in production on purpose: they rewrite tracked files, and the same bridge is publicly reachable. When `AUTHORING_TOKEN` is also set, every authoring write must carry it as the `X-Operator-Token` header, compared in constant time; the operator page asks for it the first time a save is refused with `401` and keeps it in `sessionStorage` for that tab. Without the token the endpoint stays as permissive as before, which is what the local workflow relies on. A token-protected production bridge still writes on the server's disk, so bring `images/sizes.json` / `images/deck.json` back into git rather than letting the next deploy trip over a modified file.

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
