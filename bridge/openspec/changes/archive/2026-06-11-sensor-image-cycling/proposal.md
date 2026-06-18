# Proposal: Sensor-Driven Image Cycling

## Intent

Replace unused sensor-to-scale mapping with movement-driven image cycling, transitions, and gesture recording. Phone movement becomes meaningful: users cycle images with visual transitions, and can record/replay gestures that trigger collage actions.

## Scope

### In Scope
- Remove scale from sensor mapping; remove `sensorMap.scaleRange`
- Remove focus mode (action, `drawFocusedView`, `focusedSlot` tracking)
- Movement-threshold detection to cycle images per cell
- Transition effects (crossfade first; blend modes as perf fallback)
- Gesture recording: ~1-2s accel/gyro capture, per-slot on bridge
- DTW recognition; matched gestures fire collage actions
- Dashboard: remove focus, add record toggle and status indicator
- Support arbitrary dataset size (random pool selection)

### Out of Scope
- ML-based gesture classification
- Multi-phone collaborative gestures
- Persistent gesture storage across restarts
- Gesture sharing between slots

## Capabilities

### New Capabilities
- `image-cycling`: movement-threshold image advance with transitions
- `gesture-recording`: capture, store, recognize sequences via DTW
- `gesture-actions`: map recognized gestures to collage commands

### Modified Capabilities
- None

## Approach

- **SensorMapper**: cycle direction from accel+gyro energy, debounced
- **CellRenderer**: transition state machine; crossfade first, blend modes deferred
- **Bridge**: gesture-store per slot; DTW matcher async
- **Protocol**: `action: "record-start"|"record-stop"`; `type: "gesture"`
- **Dashboard**: record toggle replaces focus

## Affected Areas

| Area | Impact |
|------|--------|
| `bridge/message-relay.js` | New actions + gesture msg format |
| `bridge/index.js` | Gesture store + DTW handling |
| `p5-collage/sensor-mapper.js` | Rewrite — movement-energy output |
| `p5-collage/sketch.js` | Remove focus, wire cycling |
| `p5-collage/cell-renderer.js` | Add transitions + blend modes |
| `p5-collage/device-manager.js` | Handle cycle + gesture-match |
| `p5-collage/config.js` | Remove scale/focus, add cycle config |
| `phone-client/app.js` | Record button/logic |
| `phone-client/index.html` | Dashboard update |
| `tests/sensor-mapper.test.js` | Rewrite — new semantics |
| `tests/message-relay.test.js` | Remove focus, add gestures |
| `tests/device-manager.test.js` | Remove focus behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| DTW too slow for 33ms | Med | Downsample to 10Hz; threshold fallback |
| Transitions drop frames | Med | Blend modes fallback; degrade on low FPS |
| Gesture false positives | High | Min distance + confirm window |

## Rollback

Revert via git. Prior files preserved in history.

## Dependencies

None. DTW is self-contained math (~50 lines).

## Success Criteria

- [ ] Focus removed: no button, no `drawFocusedView`, no `focusedSlot`
- [ ] Movement cycles images with visible transition
- [ ] Gesture recording captures and stores sensor sequence
- [ ] Repeated recorded gesture triggers configured action
- [ ] All tests pass; new coverage for gesture + cycle logic
- [ ] `SensorMapper.map()` returns cycle direction, no `scale` key
