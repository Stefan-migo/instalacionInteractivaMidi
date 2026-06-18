/**
 * SensorMapper — movement-energy detector.
 *
 * Computes frame-to-frame accel+gyro magnitude delta and
 * emits `direction` ("next"|"prev") when energy exceeds
 * `movementThreshold`.  Debounced at 200ms per slot.
 *
 * Output shape: { direction: "next"|"prev"|null, energy: number }
 */

class SensorMapper {
  constructor(config = {}) {
    this.threshold = config.movementThreshold ?? 0.5;
    this.debounceMs = 200;
    this.smoothFactor = 0.3;

    this._previous = Object.create(null);
    this._smoothedEnergy = Object.create(null);
    this._lastTriggerTime = Object.create(null);
  }

  /**
   * Process one sensor frame for a given slot.
   * First call per slot is a no-op (initialises state).
   */
  map(slot, accel, gyro, _orientation) {
    const now = Date.now();
    const prev = this._previous[slot];

    /* ── First frame for this slot — initialise ── */
    if (prev === undefined) {
      this._previous[slot] = { accel: { ...accel }, gyro: { ...gyro } };
      this._smoothedEnergy[slot] = 0;
      this._lastTriggerTime[slot] = now;
      return { direction: null, energy: 0 };
    }

    /* ── Frame-to-frame delta vectors ── */
    const dAccel = {
      x: accel.x - prev.accel.x,
      y: accel.y - prev.accel.y,
      z: accel.z - prev.accel.z,
    };
    const dGyro = {
      a: gyro.a - prev.gyro.a,
      b: gyro.b - prev.gyro.b,
      g: gyro.g - prev.gyro.g,
    };

    /* ── Magnitude of each delta vector ── */
    const accelMag = Math.sqrt(
      dAccel.x * dAccel.x + dAccel.y * dAccel.y + dAccel.z * dAccel.z,
    );
    const gyroMag = Math.sqrt(
      dGyro.a * dGyro.a + dGyro.b * dGyro.b + dGyro.g * dGyro.g,
    );

    /* ── Smooth combined energy ── */
    const rawEnergy = accelMag + gyroMag;
    this._smoothedEnergy[slot] +=
      (rawEnergy - this._smoothedEnergy[slot]) * this.smoothFactor;
    const energy = this._smoothedEnergy[slot];

    /* ── Persist frame for next call ── */
    this._previous[slot] = { accel: { ...accel }, gyro: { ...gyro } };

    /* ── Threshold + debounce gate ── */
    const timeSinceLast = now - this._lastTriggerTime[slot];
    if (energy < this.threshold || timeSinceLast < this.debounceMs) {
      return { direction: null, energy };
    }

    /* ── Direction: accel.x + gyro.b sign ── */
    const directionalSignal = dAccel.x + dGyro.b;
    const direction = directionalSignal >= 0 ? 'next' : 'prev';

    this._lastTriggerTime[slot] = now;
    return { direction, energy };
  }

  /** Reset a slot so the next call acts as fresh init. */
  resetSlot(slot) {
    this._previous[slot] = undefined;
    this._smoothedEnergy[slot] = 0;
    this._lastTriggerTime[slot] = 0;
  }

  /** Remove a slot entirely (memory cleanup on disconnect). */
  removeSlot(slot) {
    delete this._previous[slot];
    delete this._smoothedEnergy[slot];
    delete this._lastTriggerTime[slot];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SensorMapper };
}
