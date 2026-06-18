/**
 * DTWMatcher — Dynamic Time Warping gesture matcher.
 *
 * Uses a sliding-window approach to handle gestures at different speeds:
 * - Records a gesture (stored samples)
 * - Accumulates live samples in a rolling buffer (up to 2x stored length)
 * - On each sample, compares the buffer against the stored gesture via DTW
 * - DTW intrinsically handles time warping (same gesture at different speeds)
 * - Buffer auto-evicts oldest samples; only cleared on successful match
 */
class DTWMatcher {
  constructor(gestureStore, config = {}) {
    this.gestureStore = gestureStore;
    this.threshold = config.threshold || 0.5;
    this.downsampleHz = config.downsampleHz || 10;
    this.debounceMs = config.debounceMs || 1000;
    this.defaultAction = config.defaultAction || 'cycle-next';
    this.downsampleInterval = 1000 / this.downsampleHz; // e.g. 100ms for 10Hz

    this.windows = {};       // slot → { samples: [], lastTs: 0 }
    this.cooldowns = {};     // slot → timestamp when cooldown expires
  }

  /**
   * Process one sensor sample for a slot that has a stored gesture.
   * Uses a sliding-window + continuous matching approach:
   *   - Accumulates samples into a rolling buffer (up to 2x stored length)
   *   - Attempts DTW match once buffer is >= 70% of stored length
   *   - On failed match, keeps accumulating (does NOT clear buffer)
   *   - On successful match, fires action + clears buffer + sets cooldown
   */
  addSample(slot, data) {
    const gesture = this.gestureStore.getGesture(slot);
    if (!gesture) return null;

    // Downsample: skip if less than interval since last
    const now = Date.now();
    const win = this._getWindow(slot);
    if (win.lastTs && (now - win.lastTs) < this.downsampleInterval) {
      return null;
    }
    win.lastTs = now;

    win.samples.push({
      accel: data.accel,
      gyro: data.gyro,
    });

    const storedLen = gesture.samples.length;

    // Rolling buffer: keep up to 2x stored length
    // This allows the gesture to be performed at up to 2x slower speed
    const maxLen = Math.max(storedLen + 5, Math.floor(storedLen * 2));
    while (win.samples.length > maxLen) {
      win.samples.shift();
    }

    // Need at least 70% of stored length to attempt a match
    const minSamples = Math.max(2, Math.floor(storedLen * 0.7));
    if (win.samples.length < minSamples) return null;

    // Cooldown check — suppress match result but still accumulate samples
    if (this.cooldowns[slot] && now < this.cooldowns[slot]) {
      return { matched: false };
    }

    // Run DTW match
    const result = this._match(slot);
    return result;
  }

  _getWindow(slot) {
    if (!this.windows[slot]) {
      this.windows[slot] = { samples: [], lastTs: 0 };
    }
    return this.windows[slot];
  }

  _match(slot) {
    const gesture = this.gestureStore.getGesture(slot);
    if (!gesture || gesture.samples.length === 0) return null;

    const win = this.windows[slot];
    if (win.samples.length === 0) return null;

    // Compute DTW distance between stored gesture and live window
    const storedSamples = gesture.samples;
    const liveSamples = win.samples;

    const distance = this._dtw(
      this._toVectors(storedSamples),
      this._toVectors(liveSamples)
    );

    if (distance < this.threshold) {
      // Match! Set cooldown and clear window
      const now = Date.now();
      this.cooldowns[slot] = now + this.debounceMs;
      this.windows[slot] = { samples: [], lastTs: 0 };
      return {
        matched: true,
        gestureId: gesture.gestureId,
        action: this.defaultAction,
      };
    }

    // No match — do NOT clear window.
    // Sliding buffer continues accumulating; next sample gets another try.
    return { matched: false };
  }

  _toVectors(samples) {
    return samples.map(s => [
      s.accel ? s.accel.x || 0 : 0,
      s.accel ? s.accel.y || 0 : 0,
      s.accel ? s.accel.z || 0 : 0,
      s.gyro ? s.gyro.a || 0 : 0,
      s.gyro ? s.gyro.b || 0 : 0,
      s.gyro ? s.gyro.g || 0 : 0,
    ]);
  }

  _dtw(a, b) {
    const n = a.length;
    const m = b.length;
    if (n === 0 || m === 0) return Infinity;

    // Initialize matrix with large values
    const dtw = [];
    for (let i = 0; i <= n; i++) {
      dtw[i] = new Array(m + 1).fill(Infinity);
    }
    dtw[0][0] = 0;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = this._euclideanDistance(a[i - 1], b[j - 1]);
        dtw[i][j] = cost + Math.min(
          dtw[i - 1][j],    // insertion
          dtw[i][j - 1],    // deletion
          dtw[i - 1][j - 1] // match
        );
      }
    }

    // Normalize by path length — makes DTW comparable across different lengths
    return dtw[n][m] / (n + m);
  }

  _euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length && i < b.length; i++) {
      sum += (a[i] - b[i]) * (a[i] - b[i]);
    }
    return Math.sqrt(sum);
  }
}

module.exports = { DTWMatcher };
