class GestureStore {
  constructor() {
    this.gestures = {};
    this.recording = {};
    this.timers = {};
    this.recordingTimers = {};  // auto-stop timers managed externally (index.js)
  }

  startRecording(slot) {
    this.recording[slot] = {
      samples: [],
      startTs: Date.now(),
      lastTs: 0,
    };
    // Auto-stop is handled externally via recordingTimers in index.js
  }

  addSample(slot, data) {
    const rec = this.recording[slot];
    if (!rec) return;

    // Cap at 20Hz: skip if less than 50ms since last sample
    const now = Date.now();
    if (rec.lastTs && (now - rec.lastTs) < 50) return;
    rec.lastTs = now;

    rec.samples.push({
      accel: data.accel,
      gyro: data.gyro,
      ts: now,
    });
  }

  stopRecording(slot) {
    const rec = this.recording[slot];
    if (!rec) return null;

    this._clearTimer(slot);

    const gestureId = `gesture_${slot}_${Date.now()}`;
    this.gestures[slot] = {
      gestureId,
      samples: rec.samples,
    };
    delete this.recording[slot];
    return gestureId;
  }

  getGesture(slot) {
    return this.gestures[slot] || null;
  }

  discardRecording(slot) {
    const rec = this.recording[slot];
    if (!rec) return;
    this._clearTimer(slot);
    delete this.recording[slot];
    // Also remove stored gesture if any (per spec: discard clears everything)
    if (this.gestures[slot]) {
      delete this.gestures[slot];
    }
  }

  _clearTimer(slot) {
    if (this.timers[slot]) {
      clearTimeout(this.timers[slot]);
      delete this.timers[slot];
    }
  }

  _autoStop(slot) {
    if (!this.recording[slot]) return;
    this.stopRecording(slot);
  }
}

module.exports = { GestureStore };
