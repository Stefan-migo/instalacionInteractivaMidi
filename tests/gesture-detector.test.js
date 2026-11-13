/**
 * Tests for the shipped gesture detectors (`phone-client/gesture-detector.js`).
 *
 * These exercise the real module, not a copy of it: the previous suite
 * re-declared the detectors inside the test file, so it stayed green while the
 * phone shipped different thresholds.
 *
 * Specs: odd/tasks/gesture-quality.md — S1 (latigo vs girar), S2/S3 (girar is a
 * knob about the device z axis), S4 (one gesture per burst, cross veto).
 */

const { create } = require('../phone-client/gesture-detector');

// --- helpers -------------------------------------------------------------

const PRIME_TS = 1000;

function motionDetector(overrides) {
  return create(Object.assign({}, overrides));
}

/**
 * One `devicemotion` frame. The gravity-included vector stays still and the
 * linear part stays at rest, so látigo sees no jerk and cannot interfere.
 */
function motionFrame(detector, ts, rotationA, extra) {
  return detector.feedMotion(Object.assign({
    accel: { x: 0, y: 0, z: 9.8 },
    linear: { x: 0, y: 0, z: 0 },
    rotationRate: { a: rotationA, b: 0, g: 0 },
    ts,
  }, extra));
}

/** The detector cannot know dt on the very first sample: prime the clock. */
function prime(detector, ts) {
  return motionFrame(detector, ts, 0);
}

/**
 * A knob turn: `rate` degrees/second about the device z axis for `degrees`.
 * Returns the gesture names fired, in order.
 */
function turnKnob(detector, { rate = 200, degrees = 45, startTs = PRIME_TS, stepMs = 25 } = {}) {
  prime(detector, startTs);
  const fired = [];
  const steps = Math.round((degrees / rate) * 1000 / stepMs);
  for (let i = 1; i <= steps; i += 1) {
    const result = motionFrame(detector, startTs + i * stepMs, rate);
    if (result) fired.push(result);
  }
  return fired;
}

/** Keep the wrist moving at a constant rate for `steps` frames. */
function keepTurning(detector, startTs, rate, steps, stepMs = 25) {
  const fired = [];
  for (let i = 1; i <= steps; i += 1) {
    const result = motionFrame(detector, startTs + i * stepMs, rate);
    if (result) fired.push(result);
  }
  return fired;
}

/** Let the wrist come to rest, which re-zeros the accumulated turn. */
function rest(detector, startTs, steps = 6, stepMs = 25) {
  for (let i = 1; i <= steps; i += 1) motionFrame(detector, startTs + i * stepMs, 0);
}

/**
 * A whip: rest, a hard shove, then the wrist smoothing out. `latigo` arms on
 * the shove and fires on the smooth frame, exactly as the detector is built.
 */
function whip(detector, startTs = PRIME_TS) {
  const fired = [];
  const push = result => { if (result) fired.push(result); };
  push(detector.feedMotion({
    accel: { x: 0, y: 0, z: 9.8 },
    linear: { x: 0, y: 0, z: 0 },
    rotationRate: { a: 0, b: 0, g: 0 },
    ts: startTs,
  }));
  push(detector.feedMotion({
    accel: { x: 0, y: 0, z: 9.8 },
    linear: { x: 20, y: 0, z: 0 },
    rotationRate: { a: 0, b: 0, g: 0 },
    ts: startTs + 25,
  }));
  push(detector.feedMotion({
    accel: { x: 0, y: 0, z: 9.8 },
    linear: { x: 12, y: 0, z: 0 },
    rotationRate: { a: 0, b: 0, g: 0 },
    ts: startTs + 50,
  }));
  return fired;
}

/**
 * A whip as a wrist actually throws it: a 5 Hz lateral shake. Gravity stays on
 * z and nothing rotates about the device z axis.
 */
function shake(detector, { amp = 30, hz = 5, startTs = PRIME_TS, frames = 12, stepMs = 25 } = {}) {
  const fired = [];
  for (let i = 0; i < frames; i += 1) {
    const t = (i * stepMs) / 1000;
    const x = amp * Math.sin(2 * Math.PI * hz * t);
    const result = detector.feedMotion({
      accel: { x, y: 0, z: 9.8 },
      linear: { x, y: 0, z: 0 },
      rotationRate: { a: 0, b: 0, g: 0 },
      ts: startTs + i * stepMs,
    });
    if (result) fired.push(result);
  }
  return fired;
}

// --- girar: rotation about the device z axis -----------------------------

describe('girar (knob)', () => {
  test('fires once after accumulating 45 degrees about the device z axis', () => {
    const detector = motionDetector();
    // 200 deg/s in 25 ms steps is 5 degrees per frame: the ninth turning frame
    // lands exactly on the 45 degree threshold.
    expect(turnKnob(detector, { rate: 200, degrees: 45 })).toEqual(['twist']);
  });

  test('40 degrees of the same turn is not enough', () => {
    const detector = motionDetector();
    expect(turnKnob(detector, { rate: 200, degrees: 40 })).toEqual([]);
  });

  test('a slow turn never fires, however far it goes', () => {
    const detector = motionDetector();
    // 30 deg/s is below the 40 deg/s rest rate: the knob must be turned, not
    // drifted. 180 degrees of drift in a row must stay silent.
    expect(turnKnob(detector, { rate: 30, degrees: 180 })).toEqual([]);
  });

  test('a wobble that comes back nets out and does not fire', () => {
    const detector = motionDetector();
    const fired = [];
    prime(detector, PRIME_TS);
    // +30 degrees ...
    for (let i = 1; i <= 7; i += 1) {
      const r = motionFrame(detector, PRIME_TS + i * 25, 200);
      if (r) fired.push(r);
    }
    // ... then straight back the other way.
    for (let i = 8; i <= 14; i += 1) {
      const r = motionFrame(detector, PRIME_TS + i * 25, -200);
      if (r) fired.push(r);
    }
    expect(fired).toEqual([]);
  });

  test('re-arms only after the wrist rests, so one long spin fires once', () => {
    const detector = motionDetector();
    const fired = turnKnob(detector, { rate: 200, degrees: 45 });
    // Keep spinning without ever resting: cooldown plus no re-arm.
    const more = keepTurning(detector, PRIME_TS + 225, 200, 20);
    expect(fired.concat(more)).toEqual(['twist']);
  });

  test('a second turn fires again after resting and clearing the cooldown', () => {
    const detector = motionDetector();
    expect(turnKnob(detector, { rate: 200, degrees: 45 })).toEqual(['twist']);
    rest(detector, PRIME_TS + 225);
    // The fire happened at 1225 ms, so the 1200 ms cooldown clears at 2425 ms.
    expect(turnKnob(detector, { rate: 200, degrees: 45, startTs: 2500 })).toEqual(['twist']);
  });

  test('the cooldown blocks a second turn inside 1200 ms', () => {
    const detector = motionDetector();
    expect(turnKnob(detector, { rate: 200, degrees: 45 })).toEqual(['twist']);
    rest(detector, PRIME_TS + 225);
    // 1400 ms is rested, but only 175 ms after the fire at 1225 ms.
    expect(turnKnob(detector, { rate: 200, degrees: 45, startTs: 1400 })).toEqual([]);
  });
});

// --- girar does not read deviceorientation -------------------------------

describe('girar ignores the Euler angles', () => {
  test('a jumping alpha never fires twist', () => {
    const detector = motionDetector();
    const fired = [];
    // Holding the phone upright makes the ZXY decomposition singular: alpha
    // throws itself around without the phone turning about its own z axis.
    for (let i = 1; i <= 20; i += 1) {
      const result = detector.feedOrientation({
        alpha: (i * 37) % 360,
        beta: 0,
        gamma: 0,
        ts: PRIME_TS + i * 25,
      });
      if (result) fired.push(result);
    }
    expect(fired).toEqual([]);
  });

  test('the same turn fires the same in the flat and the upright pose', () => {
    const flat = motionDetector();
    const upright = motionDetector();
    const firedFlat = [];
    const firedUpright = [];

    for (let i = 1; i <= 10; i += 1) {
      const ts = PRIME_TS + i * 25;
      // Flat on a table: beta 0, gamma 0, alpha steady.
      const a = flat.feedOrientation({ alpha: 0, beta: 0, gamma: 0, ts });
      if (a) firedFlat.push(a);
      const b = motionFrame(flat, ts, 200);
      if (b) firedFlat.push(b);

      // Upright, screen facing the performer: beta 90, alpha drifting wildly.
      // The 250 ms window is far below the nod's 400 ms hold, so only the knob
      // can resolve this burst.
      const c = upright.feedOrientation({ alpha: i * 41, beta: 90, gamma: 0, ts });
      if (c) firedUpright.push(c);
      const d = motionFrame(upright, ts, 200);
      if (d) firedUpright.push(d);
    }

    expect(firedFlat).toEqual(['twist']);
    expect(firedUpright).toEqual(firedFlat);
  });
});

// --- latigo: gravity-free shake ------------------------------------------

describe('latigo (whip)', () => {
  test('fires once on a shake burst of linear acceleration', () => {
    const detector = motionDetector();
    expect(shake(detector)).toEqual(['latigo']);
  });

  test('a shove that smooths out fires exactly once', () => {
    const detector = motionDetector();
    expect(whip(detector)).toEqual(['latigo']);
  });

  test('rotating the phone does not look like a shake (gravity removed)', () => {
    const detector = motionDetector();
    const fired = [];
    // A quarter turn of the device in 250 ms: the gravity-included vector
    // swings from straight down to horizontal, but nothing is shoved. The
    // linear reading is what the platform already stripped gravity from.
    const accelerations = [
      { x: 0, y: 0, z: 9.8 },
      { x: 2.5, y: 0, z: 9.47 },
      { x: 5.0, y: 0, z: 8.49 },
      { x: 7.1, y: 0, z: 6.93 },
      { x: 8.7, y: 0, z: 4.9 },
      { x: 9.5, y: 0, z: 2.5 },
      { x: 9.8, y: 0, z: 0 },
    ];
    accelerations.forEach((accel, index) => {
      const r = detector.feedMotion({
        accel,
        linear: { x: 0, y: 0, z: 0 },
        rotationRate: { a: 0, b: -60, g: 0 },
        ts: PRIME_TS + index * 42,
      });
      if (r) fired.push(r);
    });
    expect(fired).toEqual([]);
  });

  test('falls back to a gravity estimate when the browser reports no linear accel', () => {
    const detector = motionDetector();
    const fired = [];
    // Phone at rest, then a hard shove along x, then rest again.
    const frames = [
      { x: 0, y: 0, z: 9.8 },
      { x: 0, y: 0, z: 9.8 },
      { x: 0, y: 0, z: 9.8 },
      { x: 22, y: 0, z: 9.8 },
      { x: 6, y: 0, z: 9.8 },
      { x: 0, y: 0, z: 9.8 },
      { x: 0, y: 0, z: 9.8 },
    ];
    frames.forEach((accel, index) => {
      const r = detector.feedMotion({
        accel,
        linear: null,
        rotationRate: { a: 0, b: 0, g: 0 },
        ts: PRIME_TS + index * 25,
      });
      if (r) fired.push(r);
    });
    expect(fired).toEqual(['latigo']);
  });
});

// --- S4: one gesture per burst, cross veto -------------------------------

describe('one gesture per burst', () => {
  test('a shake that happens while the knob is turning does not fire latigo', () => {
    const detector = motionDetector();
    const fired = [];
    prime(detector, PRIME_TS);
    // Knob turning: 15 degrees accumulated and still going.
    for (let i = 1; i <= 4; i += 1) {
      const r = motionFrame(detector, PRIME_TS + i * 25, 200);
      if (r) fired.push(r);
    }
    // A shove arrives mid-turn, then smooths out: látigo would fire here.
    const shove = { accel: { x: 0, y: 0, z: 9.8 }, rotationRate: { a: 200, b: 0, g: 0 } };
    let r = detector.feedMotion(Object.assign({}, shove, {
      linear: { x: 25, y: 0, z: 0 }, ts: PRIME_TS + 125,
    }));
    if (r) fired.push(r);
    r = detector.feedMotion(Object.assign({}, shove, {
      linear: { x: 17, y: 0, z: 0 }, ts: PRIME_TS + 150,
    }));
    if (r) fired.push(r);
    expect(fired).not.toContain('latigo');
  });

  test('a knob turn that starts while latigo is armed does not fire twist', () => {
    const detector = motionDetector();
    const fired = [];
    let r = detector.feedMotion({
      accel: { x: 0, y: 0, z: 9.8 },
      linear: { x: 20, y: 0, z: 0 },
      rotationRate: { a: 0, b: 0, g: 0 },
      ts: PRIME_TS,
    });
    if (r) fired.push(r);
    // Still shaking (no settle), so látigo stays armed while the wrist turns.
    for (let i = 1; i <= 9; i += 1) {
      r = detector.feedMotion({
        accel: { x: 0, y: 0, z: 9.8 },
        linear: { x: 20, y: 0, z: 0 },
        rotationRate: { a: 200, b: 0, g: 0 },
        ts: PRIME_TS + i * 20,
      });
      if (r) fired.push(r);
    }
    expect(fired).toEqual([]);
  });

  test('the shared lockout drops a second gesture inside 800 ms', () => {
    const detector = motionDetector();
    // Látigo fires at 1050 ms.
    expect(whip(detector, PRIME_TS)).toEqual(['latigo']);
    // A knob turn completes at ~1375 ms: inside the 800 ms lockout.
    expect(turnKnob(detector, { rate: 200, degrees: 45, startTs: 1200 })).toEqual([]);
  });
});

// --- inclinar keeps working ----------------------------------------------

describe('inclinar (nod)', () => {
  test('fires after 400 ms held past 30 degrees', () => {
    const detector = motionDetector();
    expect(detector.feedOrientation({ alpha: 0, beta: 40, gamma: 0, ts: 1000 })).toBeNull();
    expect(detector.feedOrientation({ alpha: 0, beta: 40, gamma: 0, ts: 1450 })).toBe('inclinar');
  });

  test('does not fire on a tilt shorter than the hold', () => {
    const detector = motionDetector();
    expect(detector.feedOrientation({ alpha: 0, beta: 40, gamma: 0, ts: 1000 })).toBeNull();
    expect(detector.feedOrientation({ alpha: 0, beta: 40, gamma: 0, ts: 1200 })).toBeNull();
  });

  test('a jerk cancels the pending nod', () => {
    const detector = motionDetector();
    detector.feedOrientation({ alpha: 0, beta: 40, gamma: 0, ts: 1000 });
    // A shake at 1050 ms marks a recent jerk.
    prime(detector, 1025);
    detector.feedMotion({
      accel: { x: 0, y: 0, z: 9.8 },
      linear: { x: 20, y: 0, z: 0 },
      rotationRate: { a: 0, b: 0, g: 0 },
      ts: 1050,
    });
    expect(detector.feedOrientation({ alpha: 0, beta: 40, gamma: 0, ts: 1500 })).toBeNull();
  });

  test('a nod while the knob is turning is dropped', () => {
    const detector = motionDetector();
    expect(detector.feedOrientation({ alpha: 0, beta: 40, gamma: 0, ts: 1000 })).toBeNull();
    // Knob turning during the hold.
    prime(detector, 1000);
    for (let i = 1; i <= 4; i += 1) {
      motionFrame(detector, 1000 + i * 25, 200);
    }
    expect(detector.feedOrientation({ alpha: 0, beta: 40, gamma: 0, ts: 1450 })).toBeNull();
  });
});
