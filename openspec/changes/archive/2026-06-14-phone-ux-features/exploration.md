## Exploration: Phone UX Features

### Current State

The phone client (`phone-client/`) is a static WebSocket client that connects to the bridge, receives a slot assignment, and provides a dashboard with:
- 8 action buttons (record gesture, reset, shuffle, flipH, flipV, opacity down/up, lock)
- 3 sensor visualization bars (accelerometer, gyroscope, orientation)
- Connection status indicator
- Recording indicator and gesture status messages

The bridge (`bridge/index.js`) relays messages between phones and p5 players. The bridge has **no knowledge of image state** per slot — all image management (pool initialization, cycling, shuffle) happens in the p5 collage client's `ImageCycler` and renderer state. The bridge only knows which phones are connected to which slots.

### Affected Areas

- `bridge/index.js` — New message type to relay image updates to phones; accept configurable recording duration
- `bridge/message-relay.js` — New `formatCellImageMessage()` method for sending image updates to phones
- `phone-client/app.js` — Major: thumbnail display, gesture wizard UI, remove sensor bar code
- `phone-client/index.html` — Restructure dashboard layout: replace sensor bars with thumbnail + wizard UI
- `phone-client/style.css` — Add thumbnail styling, wizard styling; remove sensor bar styles
- `p5-collage/sketch.js` — Send image-change notifications to bridge after cycle/shuffle
- `tests/message-relay.test.js` — Tests for new message formats
- `tests/gesture-store.test.js` — Verify no regression for duration-aware recording

### Feature Analysis

---

#### Feature 1: Show Cell Image as Thumbnail

**Feasibility:** Medium. The bridge has zero knowledge of image state per slot, so a notification flow from p5 → bridge → phone is needed.

**How it must work:**

1. **Initial assignment**: When phone connects, p5 has already initialized the cell with its initial image from layout.json. The bridge doesn't know which image is displayed. Two approaches:
   - **Option A (bridge loads layout)**: Bridge loads `layout.json` and can look up initial `imageFile` per slot when assigning. Still doesn't handle dynamic changes.
   - **Option B (p5 notifies)**: p5 sends a message to bridge after `initCell()`: `{ type: "image-update", slot, imageFile }`. Bridge stores the mapping.

2. **Dynamic updates**: After `cycle-next`, `shuffle`, or any action that changes the image, the p5 renderer must send an `image-update` message back to the bridge, which then broadcasts to the phone.

3. **Bridge → Phone message**: New message type: `{ type: "cell-image", slot, imageFile: "012.jpg", imageUrl: "/images/content/012.jpg" }`

4. **Phone side**: 
   - On `assigned` message: phone already knows its slot; it could fetch `/api/layout` to get initial image. Or bridge sends a `cell-image` message immediately after assign.
   - On `cell-image` message: update `<img>` src.
   - UI: Replace the sensor bars area with a thumbnail image container.

**Approaches:**

1. **Bridge tracks image state (recommended)**
   - p5 sends `image-update` messages to bridge every time an image changes
   - Bridge stores `slotImageMap[slot] = imageFile` 
   - Bridge sends `cell-image` to phone on every update
   - Pros: Phone always has the correct current image; works for all image-change actions
   - Cons: Requires p5-side changes to send notifications after every image-affecting action
   - Effort: Medium (~120 lines total)

2. **Phone fetches + guesses**
   - Phone fetches layout.json to get initial imageFile
   - Phone has no way to know after shuffle/cycle — would need to fetch all images and track state
   - Pros: Zero bridge changes
   - Cons: Won't know current image after dynamic changes; breaks the core feature
   - Effort: Low (~40 lines) but incomplete

**Recommendation:** Approach 1. The key question is where to inject the `image-update` notification. In `sketch.js`, the `handleAction` method in `createRenderer()` processes `cycle-next`, `cycle-prev`, and `shuffle` — each changes the image. The cleanest injection point is after any action that changes `s.img`.

---

#### Feature 2: Gesture Wizard

**Feasibility:** High. The core gesture infrastructure (store, DTW matcher, recording) already works. The change is primarily on the phone client UI. Bridge changes are minimal.

**Current flow vs wizard flow:**

| Step | Current | Wizard |
|------|---------|--------|
| 1 | Tap "Record" → 3s countdown → 3s recording → stop | Tap "Practice" → record gesture, calculate duration |
| 2 | — | Choose desired recording duration (up to 5s) |
| 3 | — | 3-2-1 countdown |
| 4 | Sensor samples → stored as gesture | Sensor samples → stored as gesture (with user-chosen duration) |
| 5 | "Repeat to activate" shown | "Repeat to activate" shown |

**Bridge changes needed:**
- Accept a `duration` parameter on `record-start` message (currently hardcoded 3000ms in index.js line 177)
- `{ type: "action", action: "record-start", duration: 4000 }`
- Use this value instead of 3000 for the auto-stop timer
- Fallback to 3000ms if not provided (backward compatible)

**Phone client changes:**
- Replace single "Record" button with:
  - Step 1: "Practice" button → records motion for ~3s → calculates duration → shows duration
  - Step 2: Duration picker (slider or buttons: 2s/3s/4s/5s)
  - Step 3: 3-2-1 countdown
  - Step 4: Recording with live indicator
  - Step 5: Status "Gesto grabado"
- All wizard steps as an overlay/modal replacing the current single-button flow
- The practice step uses the existing `gestureDetector` infrastructure but measures the gesture's actual time span

**Approaches:**

1. **Client-side wizard with bridge relay (recommended)**
   - Wizard UI entirely on phone client (vanilla JS multi-step overlay)
   - Bridge only changed to accept duration parameter
   - Practice uses local sensor data (already available via `devicemotion`)
   - Pros: Minimal bridge changes, self-contained, backward compatible
   - Cons: More JS/CSS on phone client
   - Effort: Medium (~200 lines total, mostly phone client)

2. **Bridge-managed wizard**
   - Bridge controls wizard state machine
   - Phone sends practice messages, bridge calculates durations
   - Pros: Single source of truth
   - Cons: More bridge changes, more protocol messages, overengineered for a phone-only UX feature
   - Effort: High (~350 lines)

**Recommendation:** Approach 1. The wizard is a phone UX concern — the bridge just needs to accommodate the configurable recording duration.

---

#### Feature 3: Remove Sensor Bars

**Feasibility:** Trivial. The sensor bars are decorative/feedback only — removing them has zero functional impact.

**What changes:**
- `phone-client/index.html`: Remove lines 53-57 (`.sensors` div with accel/gyro/orientation bars)
- `phone-client/style.css`: Remove lines 314-352 (`.sensors`, `.sensor-row`, `.sensor-bar`, `.sensor-fill` styles) and line 362-364 (`.disconnected .sensor-fill`)
- `phone-client/app.js`: Remove lines 34-36 (DOM element refs), lines 147-150 (accelBar transform), lines 157-158 (orientBar transform). Keep the `devicemotion` listener and sensor data — they are still needed for gesture recording and DTW matching.

**Impact on layout:**
- The sensor bars area takes ~100px vertical space at the bottom
- Removing it creates space for the thumbnail (Feature 1)
- The action buttons grid above remains unchanged
- The `.sensors.torn-container` wrapper is replaced by a `.thumbnail` container

**Approach:** Straight deletion + replacement with thumbnail container.

---

### Protocol Analysis: Bridge-to-Phone Messages

Current messages bridge sends to phones:

| Type | Purpose | Format |
|------|---------|--------|
| `assigned` | Slot allocation | `{ type: "assigned", slot: N }` |
| `gesture-status` | Recording state | `{ type: "gesture-status", recording: bool, gestureId?: string }` |
| `error` | Error notification | `{ type: "error", message: string }` |

New message needed for Feature 1:

| Type | Purpose | Format |
|------|---------|--------|
| `cell-image` | Current image for slot | `{ type: "cell-image", slot: N, imageFile: "012.jpg", imageUrl: "/images/content/012.jpg" }` |

No new messages needed for Features 2 or 3 — Feature 2 reuses the existing gesture-status/record-start/record-stop flow with an additional duration parameter.

### Image Serving

Already functional:
- Images served at `GET /images/content/{filename}` via `bridge/index.js` lines 65-68
- Phone client already loads from the same bridge (same origin since served from `http://bridge:8080/phone-client/`)
- Phone can construct image URL: `http://bridge:8080/images/content/012.jpg` (or just `/images/content/012.jpg` if same origin)
- Layout available at `GET /api/layout` (lines 56-63)

### Key Questions Answered

1. **Does the bridge currently tell phones which image is active for their slot?** No. The bridge has zero knowledge of image state per slot. The `AssignMessage` to p5 players includes an empty `cellId` string. Phones receive only `{ type: "assigned", slot }`.

2. **What would need to change in the bridge to send image updates to phones?** The bridge needs: (a) a `slotImageMap` to track current image per slot, (b) ability to receive `image-update` messages from p5 players, (c) a new `cell-image` message type to relay to phones. Estimated: ~30-50 lines in bridge.

3. **Can the phone client independently determine the image URL from the slot?** Only for the initial image (via `/api/layout`). After dynamic changes (shuffle, cycle-next) the phone has no way to know the current image without bridge relay.

4. **How does gesture recording work end-to-end today?** 3-second countdown → `record-start` → bridge begins accumulating sensor samples → 3-second auto-stop timer → `record-stop` → gesture stored → DTW matcher continuously compares → on match, broadcasts `gesture-event` with action.

5. **What minimal bridge changes are needed for the wizard?** Accept a `duration` ms parameter on `record-start` action messages. Currently hardcoded to 3000ms in index.js line 177. Change to: `const duration = msg.duration || 3000;` and use that for the setTimeout.

6. **Estimated line changes per feature:**
   - Feature 1 (thumbnail): ~100-160 lines (bridge 30-50, p5 10-20, phone 30-60, CSS 20-30)
   - Feature 2 (wizard): ~160-320 lines (bridge 10-20, phone 100-200, CSS 50-100)
   - Feature 3 (remove bars): ~45-80 lines (all deletions/replacements)

### Risks

- **Feature 1 - Image synchronization**: If p5 fails to send `image-update` after an image change, the phone thumbnail will show stale image. Need careful audit of all image-changing code paths in sketch.js: `cycle-next`, `cycle-prev`, `shuffle` — these are the three actions that change `s.img`.
- **Feature 2 - Duration parameter**: The `record-start` handler in bridge/index.js currently hardcodes 3000ms. If a phone sends an extremely long duration (e.g., 60000ms), the recording timer could be problematic. Add max duration validation (5000ms per requirements).
- **Feature 2 - Backward compatibility**: Existing phone clients that send `record-start` without the duration parameter must still work (default to 3000ms).
- **Feature 3 - Sensor data loss**: The `devicemotion` listener must stay in app.js even after removing sensor bar visualization — it still feeds gesture detection and sensor message sending to the bridge.
- **Line budget**: Feature 2 (wizard) alone could push ~200-320 lines. Combined with Feature 1 (~160) and Feature 3 (~80), total could reach ~440-560 lines. This may exceed the 400-line review budget and need a chained PR strategy.

### Ready for Proposal

Yes. All three features have clear paths. Recommendation: proceed to proposal with the following:
- **Feature 3 first** (simplest, clears space for thumbnail)
- **Feature 1 second** (core functionality, some bridge changes)
- **Feature 2 third** (most complex UI, standalone)

This ordering allows each feature to be built on the work of the previous one without blocking.

### Approaches Summary

| Feature | Approach | Effort | Risk |
|---------|----------|--------|------|
| Thumbnail | Bridge tracks image state + p5 notifies on changes | Medium (~120 lines) | Image sync gaps |
| Wizard | Client-side multi-step overlay + bridge duration param | Medium (~200 lines) | Backward compat |
| Remove bars | Direct deletion + replace with thumbnail container | Low (~60 lines) | Must keep sensor listeners |
