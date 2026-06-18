# Design: Gesture Gallery

## Technical Approach

Three DOM overlays (gallery, practice, wizard) at increasing z-index. "Gestos" button opens the gallery (not the wizard). Gallery shows 3 example cards; each taps into a practice flow with a heuristic detector. Detection runs client-side only, activated one-at-a-time during practice. "Crear mi gesto" calls the existing wizard unchanged.

All detection lives inside the existing `gestureDetector` object — expanded with 3 detector sub-objects that share the same `processMotion`/`processOrientation` data path but only fire when their `active` flag is set.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Detection locus | Inside existing `gestureDetector` | Separate module | Avoids restructuring app.js IIFE; reuses jerk-magnitude infrastructure for sacudir |
| Detector activation | `active` flag + cooldown timestamp per detector | Event listener attach/detach | Simpler lifecycle; no DOM event wiring for sensor data |
| Practice state | `galleryState` string: `null → gallery → practice → practice-done` | Separate state machine | Matches the linear flow; `practice-done` allows re-practice without re-entering gallery |
| Gallery dismiss | × button + tap-outside on overlay background | Swipe-only | Consistent with existing help-overlay pattern |
| Practice overlay z-index | 95 (between gallery 90 and wizard 100) | Same as gallery | Prevents visual overlap when wizard opens from gallery |

## Z-Index Stack

```
 30  tools-panel
 60  hint-engine
 90  gesture-gallery
 95  practice-overlay
100  help-overlay / wizard-overlay
```

## Data Flow

```
[Gestos] btn → openGallery()
                    ↓
            Gallery overlay (3 cards)
                    ↓
           [Practicar] tap → startPractice(gesture)
                    ↓
       Practice overlay + detector.activate()
                    ↓
         sensor event → processMotion/processOrientation
                    ↓
            detector.check() passes?
                    ↓
          Yes: sendAction() + vibrate() + feedback
          No:  wait for next sensor event
                    ↓
           [Volver] → detector.deactivate() → back to gallery
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `phone-client/index.html` | Modify | Add gallery overlay DOM (#gesture-gallery), practice overlay DOM (#practice-overlay), rename button text "Gesto" → "Gestos" |
| `phone-client/app.js` | Modify | Gallery state machine (`galleryState`, `openGallery`, `closeGallery`, `startPractice`, `endPractice`, `onGestureDetected`); expand `gestureDetector` with 3 heuristic sub-detectors; rewire `wizard-trigger` click to `openGallery`; wire gallery-create-btn to `wizOpen` |
| `phone-client/style.css` | Modify | Add gallery overlay styles, card layout, practice overlay, feedback checkmark, cooldown animation |

## Interfaces / Contracts

### Gallery State Machine (app.js)

```js
var galleryState = null; // null | 'gallery' | 'practice' | 'practice-done'

function openGallery() {
  galleryState = 'gallery';
  $('gesture-gallery').classList.remove('hidden');
  // tools panel stays hidden behind gallery
}

function closeGallery() {
  if (galleryState === 'practice') endPractice();
  galleryState = null;
  $('gesture-gallery').classList.add('hidden');
}

function startPractice(gesture) {
  galleryState = 'practice';
  $('practice-overlay').classList.remove('hidden');
  $('practice-instruction').textContent = instructionFor(gesture);
  $('practice-feedback').classList.add('hidden');
  gestureDetectors[gesture].activate();
}

function onGestureDetected() {
  if (galleryState !== 'practice') return;
  galleryState = 'practice-done';
  sendAction(actionFor(galleryState)); // e.g. 'border-next'
  try { navigator.vibrate(200); } catch(e) {}
  $('practice-feedback').classList.remove('hidden');
  // auto-hide feedback after 2s and allow re-practice
  setTimeout(function() {
    $('practice-feedback').classList.add('hidden');
    galleryState = 'practice';
  }, 2000);
}

function endPractice() {
  gestureDetectors[ /* current */ ].deactivate();
  galleryState = 'gallery';
  $('practice-overlay').classList.add('hidden');
}
```

### Detector Structure (inside gestureDetector)

```js
var gestureDetectors = {
  girar: {
    active: false,
    lastTrigger: 0,
    cooldown: 1000,
    activate: function() { this.active = true; },
    deactivate: function() { this.active = false; },
    check: function(orientation) {
      return this.active && Math.abs(orientation.g) > 30;
    }
  },
  sacudir: {
    active: false,
    lastTrigger: 0,
    cooldown: 1000,
    activate: function() { this.active = true; },
    deactivate: function() { this.active = false; },
    check: function(jerkMag) {
      return this.active && jerkMag > 15;
    }
  },
  elevar: {
    active: false,
    lastTrigger: 0,
    cooldown: 1000,
    activate: function() { this.active = true; },
    deactivate: function() { this.active = false; },
    check: function(accel) {
      return this.active && accel.y < -12;
    }
  }
};
```

`sacudir.check` is called from the existing jerk-magnitude path in `processMotion`. The flick state machine (flickTriggered/flickStartTs) is bypassed during practice — sacudir fires on first jerk > 15 instead of the stabilization sequence.

### Gesture-to-Action Mapping

| Gesture | Action Sent | Instruction Text |
|---------|-------------|------------------|
| `girar` | `border-next` | Girá el teléfono hacia los costados |
| `sacudir` | `shuffle` | Sacudí el teléfono con fuerza |
| `elevar` | `filter` | Levantá el teléfono rápido hacia arriba |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Detector `check()` thresholds | Direct calls with known sensor values, assert true/false + cooldown |
| Unit | Gallery state transitions | Call state machine functions in sequence, assert proper DOM class toggles |
| Integration | `processMotion` + sacudir detector | Feed simulated accel data, assert `sendAction` is called with correct action |
| E2E | Full flow: open gallery → practice → detect → feedback | Browser test with mock sensor APIs (manual for now) |

Existing tests must still pass: `npm test`.

## Migration / Rollout

No migration needed. All changes in `phone-client/`. The gallery overlays start `hidden` so existing connected phones continue working until the page is reloaded. Bridge and p5-collage are unaffected.

Rollback: revert button text to "Gesto", restore `wizOpen()` in click handler, remove gallery+practice DOM and CSS.

## Open Questions

- [ ] Sacudir practice: should it use the full flick stabilization (jerk > 15 → wait for stabilization < 10 → fire) or fire immediately on first jerk > 15? The spec says "reuse existing flick infrastructure" — keeping stabilization avoids false triggers during practice.
