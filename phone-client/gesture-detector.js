/**
 * GestureDetector — the three gallery gestures of the phone client.
 *
 * Extracted from `app.js` so the tests exercise the shipped detectors instead
 * of a copy of them. Three heuristics, one burst at a time:
 *
 * `girar` (twist) — a knob is a rotation about the device's own z axis: the one
 * pointing out of the screen. `DeviceMotionEvent.rotationRate.alpha` measures
 * exactly that, in degrees per second, in every pose: flat on a table (z up) or
 * held upright facing the performer (z toward them). The old detector read
 * `DeviceOrientationEvent.alpha` instead, which is the compass heading about
 * the earth's vertical: it only matches a knob when the phone lies flat, and
 * near `beta = ±90°` the ZXY Euler decomposition is singular, so the wrist roll
 * spills into alpha and made the gesture look like it worked upright.
 *
 * `latigo` (whip) — a shake is translation. The old detector differentiated
 * `accelerationIncludingGravity`, so rotating the phone swung the gravity
 * vector and armed a flick that nobody threw. Here the linear acceleration is
 * used, either as the browser reports it (`e.acceleration`, gravity already
 * removed by the platform's sensor fusion) or estimated with a low-pass of the
 * gravity-included vector when the platform has no linear reading.
 *
 * `inclinar` (nod) — unchanged: `beta` past 30° held 400 ms.
 *
 * Exclusive bursts (S4): after any gesture fires, every detector is locked for
 * `lockoutMs`; while a knob turn is in flight, latigo cannot arm and inclinar
 * cannot fire; while latigo is armed, the knob does not accumulate. One
 * physical motion resolves to at most one gesture.
 *
 * Every `feed*` call returns the gesture name it fired, or `null`.
 */

(function (root) {
  var DEFAULTS = {
    // girar
    twistFireDegrees: 45,
    twistRestRate: 40,          // deg/s below which the wrist counts as rested
    twistRestHoldMs: 120,       // that rest must last this long to re-zero the turn
    twistCooldownMs: 1200,
    twistVetoDegrees: 10,       // a turn past this magnitude owns the burst
    // latigo
    latigoArmJerk: 15,          // m/s^2 of frame-to-frame linear change to arm
    latigoFireJerk: 10,         // ... and the smooth frame that fires it
    latigoWindowMs: 200,
    latigoCooldownMs: 750,
    // inclinar
    inclinarDegrees: 30,
    inclinarHoldMs: 400,
    inclinarCooldownMs: 1200,
    // cross-talk
    lockoutMs: 800,             // one gesture per burst
    jerkMemoryMs: 800,          // a shake cancels a nod in flight
    gravitySmoothing: 0.2,
    maxStepMs: 100,             // a backgrounded tab must not integrate a jump
  };

  function merge(base, overrides) {
    var out = {};
    Object.keys(base).forEach(function (key) { out[key] = base[key]; });
    Object.keys(overrides || {}).forEach(function (key) {
      if (overrides[key] !== undefined) out[key] = overrides[key];
    });
    return out;
  }

  function finite(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function vector(source, fallback) {
    var v = source || fallback;
    return { x: v.x || 0, y: v.y || 0, z: v.z || 0 };
  }

  function hasLinear(linear) {
    return !!linear && finite(linear.x) && finite(linear.y) && finite(linear.z);
  }

  function length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  function create(options) {
    var opts = merge(DEFAULTS, options);

    // girar
    var twistAngle = 0;         // signed degrees accumulated about the device z
    var twistRestSince = null;
    var twistLastTs = null;
    var twistSuppressedUntil = -Infinity;
    var twistLastFireTs = -Infinity;

    // latigo
    var gravity = null;         // low-pass estimate, only for the fallback path
    var prevLinear = null;
    var flickArmed = false;
    var flickArmTs = -Infinity;
    var latigoLastFireTs = -Infinity;
    var lastJerkTs = -Infinity;

    // inclinar
    var nodPendingSince = null;
    var nodCanFire = true;
    var nodLastFireTs = -Infinity;

    // shared
    var lastFireTs = -Infinity;

    /**
     * The single gate every gesture passes through: one burst, one gesture.
     * Returns the gesture name when it is allowed, `null` when the burst is
     * already spent.
     */
    function tryFire(name, ts) {
      if (ts - lastFireTs < opts.lockoutMs) return null;
      lastFireTs = ts;
      return name;
    }

    function twistActive() {
      return Math.abs(twistAngle) > opts.twistVetoDegrees;
    }

    function handleRotation(rotationRate, ts) {
      var rateZ = rotationRate.a || 0;
      var rate = Math.abs(rateZ);

      var dt = 0;
      if (twistLastTs !== null) {
        dt = Math.min(ts - twistLastTs, opts.maxStepMs);
      }
      twistLastTs = ts;

      if (rate < opts.twistRestRate) {
        if (twistRestSince === null) twistRestSince = ts;
        if (ts - twistRestSince >= opts.twistRestHoldMs) twistAngle = 0;
        return null;
      }
      twistRestSince = null;

      // A shake owns the burst until it settles.
      if (flickArmed) return null;
      if (dt <= 0) return null;
      // Still paying for the last turn: a wrist that keeps spinning must not
      // bank angle across the cooldown and fire the instant it expires.
      if (ts < twistSuppressedUntil) {
        twistAngle = 0;
        return null;
      }

      twistAngle += rateZ * (dt / 1000);
      if (Math.abs(twistAngle) < opts.twistFireDegrees) return null;
      if (ts - twistLastFireTs < opts.twistCooldownMs) return null;

      twistLastFireTs = ts;
      twistSuppressedUntil = ts + opts.twistCooldownMs;
      twistAngle = 0;
      return tryFire('twist', ts);
    }

    /**
     * Linear acceleration with gravity removed. Platforms that expose
     * `DeviceMotionEvent.acceleration` already did this; the rest get a
     * low-pass estimate so a pure rotation stays quiet.
     */
    function linearFrom(accel, linear) {
      if (hasLinear(linear)) {
        return { x: linear.x, y: linear.y, z: linear.z };
      }
      var a = vector(accel, { x: 0, y: 0, z: 0 });
      if (!gravity) {
        gravity = { x: a.x, y: a.y, z: a.z };
      } else {
        gravity = {
          x: gravity.x + opts.gravitySmoothing * (a.x - gravity.x),
          y: gravity.y + opts.gravitySmoothing * (a.y - gravity.y),
          z: gravity.z + opts.gravitySmoothing * (a.z - gravity.z),
        };
      }
      return { x: a.x - gravity.x, y: a.y - gravity.y, z: a.z - gravity.z };
    }

    function handleLinear(linear, ts) {
      var jerk = prevLinear ? length({
        x: linear.x - prevLinear.x,
        y: linear.y - prevLinear.y,
        z: linear.z - prevLinear.z,
      }) : 0;
      prevLinear = linear;

      if (jerk > opts.latigoArmJerk) lastJerkTs = ts;

      if (twistActive()) {
        // The turn owns this burst: no flick may arm out of it.
        flickArmed = false;
        return null;
      }

      if (!flickArmed) {
        if (jerk > opts.latigoArmJerk) {
          flickArmed = true;
          flickArmTs = ts;
        }
        return null;
      }

      var elapsed = ts - flickArmTs;
      if (jerk < opts.latigoFireJerk) {
        flickArmed = false;
        if (ts - latigoLastFireTs < opts.latigoCooldownMs) return null;
        latigoLastFireTs = ts;
        return tryFire('latigo', ts);
      }
      if (elapsed > opts.latigoWindowMs) flickArmed = false;
      return null;
    }

    function handleNod(beta, ts) {
      if (Math.abs(beta) < 10) nodCanFire = true;
      if (!nodCanFire) {
        nodPendingSince = null;
        return null;
      }
      if (ts - nodLastFireTs < opts.inclinarCooldownMs) return null;
      if (Math.abs(beta) <= opts.inclinarDegrees) {
        nodPendingSince = null;
        return null;
      }
      if (nodPendingSince === null) {
        nodPendingSince = ts;
        return null;
      }
      var held = ts - nodPendingSince;
      var jerkedRecently = ts - lastJerkTs <= opts.jerkMemoryMs;
      if (held <= opts.inclinarHoldMs || jerkedRecently || twistActive()) return null;

      nodPendingSince = null;
      nodLastFireTs = ts;
      nodCanFire = false;
      return tryFire('inclinar', ts);
    }

    return {
      /**
       * One `devicemotion` frame.
       * `{ accel, linear, rotationRate: { a, b, g }, ts }` — `a` is
       * `rotationRate.alpha`, the rate about the device z axis.
       */
      feedMotion: function (frame) {
        var ts = frame.ts;
        var linear = linearFrom(frame.accel, frame.linear);
        var rotationRate = frame.rotationRate || { a: 0, b: 0, g: 0 };
        var turned = handleRotation(rotationRate, ts);
        if (turned) return turned;
        return handleLinear(linear, ts);
      },

      /**
       * One `deviceorientation` frame.
       * `{ alpha, beta, gamma, ts }` — only `beta` participates; the Euler
       * angles are not a knob.
       */
      feedOrientation: function (frame) {
        return handleNod(frame.beta || 0, frame.ts);
      },

      reset: function () {
        twistAngle = 0;
        twistRestSince = null;
        twistLastTs = null;
        twistSuppressedUntil = -Infinity;
        twistLastFireTs = -Infinity;
        prevLinear = null;
        flickArmed = false;
        flickArmTs = -Infinity;
        latigoLastFireTs = -Infinity;
        lastJerkTs = -Infinity;
        nodPendingSince = null;
        nodCanFire = true;
        nodLastFireTs = -Infinity;
        lastFireTs = -Infinity;
        gravity = null;
      },
    };
  }

  var api = { create: create, DEFAULTS: DEFAULTS };
  root.GestureDetector = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : this);
