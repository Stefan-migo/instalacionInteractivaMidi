# Collage Interactivo — Reforma Universitaria 1918

## Project
Interactive installation: phone sensors → overlapping collage of historical images on a 1920×1080 canvas.
Dataset: 51 images from the 1918 University Reform in Córdoba, Argentina.

## Architecture
```
Phone → WebSocket → Bridge (Node.js) → WebSocket → p5 Collage (browser)
```

## Modules
- `bridge/` — Node.js WebSocket server (port 8080), slot allocator, message relay, image serving
- `phone-client/` — Static client: sensors + dashboard buttons, deployed to Vercel
- `p5-collage/` — p5.js sketch: bento grid with overlapping torn-border cells
- `images/` — Dataset (content/), generated layout.json, manifest.json
- `tests/` — Jest tests (RED → GREEN → REFACTOR)

## Protocol
- Phone → Bridge: `{ type: "sensor", accel:{x,y,z}, gyro:{a,b,g}, orientation:{a,b,g} }`
- Phone → Bridge: `{ type: "action", action: "focus"|"reset"|"shuffle"|"flipH"|"flipV"|"opacityUp"|"opacityDown"|"lock"|"unlock" }`
- Bridge → Phone: `{ type: "assigned", slot: N }`
- Bridge → p5: `{ type: "device", slot, accel, gyro, orientation }`
- Bridge → p5: `{ type: "action", slot, action }`
- Bridge → p5: `{ type: "system", event: "assign"|"disconnect"|"count", ... }`

## Running
```bash
npm test                    # Run tests
npm run generate-layout     # Regenerate layout.json
npm run bridge              # Start bridge at :8080
# Open http://localhost:8080/phone-client on phone
# Open p5-collage/index.html in browser
```

## TDD Workflow
SDD phases via `/sdd-*` commands:
1. `/sdd-explore` — Research
2. `/sdd-propose` — Approach
3. `/sdd-spec` — What
4. `/sdd-design` — How
5. `/sdd-tasks` — Break into tasks
6. `/sdd-apply` — RED → GREEN → REFACTOR
7. `/sdd-verify` — All tests pass
8. `/sdd-archive` — Save to Engram
