# Interactive Collage

A phone-controlled collage installation. Visitors open a web page on their phone; the phone's motion sensors, gestures and on-screen controls move one fragment of a shared collage projected on a 1920×1080 canvas. Up to 30 phones participate at once.

The repository ships a normalized 130-image WebP library in `images/content/`, so a clone renders the full collage. Swap in your own dataset by describing it in `images/manifest.json`; with an empty manifest the system still runs 30 empty cells, which is a useful state for development.

## How it works

```
Phone ──WebSocket──► Bridge (Node.js) ──WebSocket──► p5.js collage (projector)
                          │
                          └── serves both clients + images over HTTP (:8080)
```

- **Bridge** — assigns a slot to each phone, validates and relays every message, records and matches gestures.
- **Phone client** — three screens (splash → sensor permission → dashboard), sensors, gesture wizard, help overlay.
- **Collage** — 30 cells, six layout presets, six image filters, a global image deck that never shows the same photo twice at once, a WebGL paper background, and drag & drop.

## Requirements

- Node.js 22+
- Python 3 with `scripts/requirements.txt` only if you use the image curation helpers

## Quick start

```bash
npm install
npm run bridge
```

Open the projector view at <http://localhost:8080/p5-collage/> and a phone view at <http://localhost:8080/phone-client/>.

No phones at hand? `node scripts/simulate-phones.js` connects 30 virtual phones.

```bash
npm test                 # Jest suite
npm run test:coverage
npm run generate-layout  # rebuild images/layout.json from images/manifest.json
```

## Adding content

1. Drop images into `images/content/`.
2. Describe them in `images/manifest.json`:

   ```json
   { "001": { "file": "001.jpg", "w": 1600, "h": 977 } }
   ```

3. Run `npm run generate-layout` to lay out the 30 cells.

Cells without an image stay empty, so partial datasets are fine. `generate-layout` refuses an empty manifest instead of overwriting the layout.

## Phone sensors need HTTPS

Mobile browsers expose `DeviceMotion`/`DeviceOrientation` only in a secure context. `http://localhost` qualifies; a plain LAN IP does not. To use real phones from another device, serve the phone client over HTTPS — a tunnel or a local TLS certificate both work.

## Browser support

Any Chromium, Firefox or Safari version with WebGL: the paper background uses a simplex-noise shader and falls back to a solid colour when WebGL is unavailable.

## Project layout

| Path | Contents |
|------|----------|
| `bridge/` | WebSocket + HTTP server, protocol, slot allocator, gesture store, DTW matcher |
| `phone-client/` | Mobile client (sensors, gestures, controls, shader) |
| `p5-collage/` | Projector sketch, layout engine, renderers, operator panel, drag manager |
| `images/` | `manifest.json`, generated `layout.json`, `content/` for your images |
| `scripts/` | Layout generator, phone simulator, Python curation helpers |
| `tests/` | Jest suites and fixtures |
| `openspec/` | Capability specs and the SDD change archive |
| `odd/tasks/` | Feature tracking documents |

## License

ISC
