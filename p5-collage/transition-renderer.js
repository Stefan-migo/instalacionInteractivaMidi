/**
 * TransitionRenderer — crossfade state machine for image cycling.
 *
 * State machine:  IDLE  →  FADING  →  IDLE
 *
 * - `startTransition(oldImg, newImg)` begins a crossfade.
 * - `update(dt)` returns per-frame alpha values and state.
 * - FPS gate: if 3 consecutive frames exceed ~33ms (< 30 fps),
 *   falls back to instant swap (completes immediately).
 *
 * State output: { state, oldAlpha, newAlpha, complete }
 */

class TransitionRenderer {
  /**
   * @param {object} [config]
   * @param {number} [config.transitionDuration=300]  — crossfade length in ms
   */
  constructor(config = {}) {
    this.duration = config.transitionDuration ?? 300;
    this.fpsGateThreshold = 30; // fps
    this.fpsGateFrames = 3;

    /** @private */
    this._state = 'idle';
    this._progress = 0;
    this._lowFpsCount = 0;
    this._oldImg = null;
    this._newImg = null;
  }

  /**
   * Begin a crossfade transition.
   *
   * @param {*} oldImg  — image being replaced (will fade out)
   * @param {*} newImg  — image replacing it (will fade in)
   */
  startTransition(oldImg, newImg) {
    this._state = 'fading';
    this._progress = 0;
    this._lowFpsCount = 0;
    this._oldImg = oldImg;
    this._newImg = newImg;
  }

  /**
   * Advance the transition by `dt` milliseconds.
   *
   * @param {number} dt  — elapsed time since last frame in ms
   * @returns {{ state: 'idle'|'fading', oldAlpha: number, newAlpha: number, complete: boolean }}
   */
  update(dt) {
    if (this._state === 'idle') {
      return { state: 'idle', oldAlpha: 1, newAlpha: 1, complete: false };
    }

    /* ── FPS gate ── */
    if (dt > 1000 / this.fpsGateThreshold) {
      this._lowFpsCount++;
    } else {
      this._lowFpsCount = 0;
    }

    if (this._lowFpsCount >= this.fpsGateFrames) {
      this._state = 'idle';
      return { state: 'idle', oldAlpha: 1, newAlpha: 1, complete: true };
    }

    /* ── Advance progress ── */
    this._progress += dt;
    const t = Math.min(this._progress / this.duration, 1);

    if (t >= 1) {
      this._state = 'idle';
      return { state: 'idle', oldAlpha: 1, newAlpha: 1, complete: true };
    }

    return {
      state: 'fading',
      oldAlpha: 1 - t,
      newAlpha: t,
      complete: false,
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TransitionRenderer };
}
