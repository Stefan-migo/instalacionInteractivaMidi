/**
 * PadTransform — two-finger transform math for the phone pad.
 *
 * One finger drags the fragment (handled by the pad itself in `app.js`).
 * Two fingers transform it: pinch changes the scale slider,
 * twist changes the rotation slider.
 *
 * Pure math only: no DOM, no WebSocket. Values are shaped so the bridge
 * accepts them (scale is an integer within 40..180, rotation is finite
 * and inside -180..180).
 */
var PadTransform = (function () {
  var SCALE_MIN = 40;
  var SCALE_MAX = 180;
  var HALF_TURN = 180;
  var FULL_TURN = 360;

  function finite(value, fallback) {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  }

  /** Euclidean distance between two finger points, in px. */
  function distance(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Angle of the line joining both fingers, in degrees (0 = right, CCW positive). */
  function angleDeg(a, b) {
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  }

  /** Wrap any angle into (-180, 180]. */
  function wrapAngle(deg) {
    var value = finite(deg, 0) % FULL_TURN;
    if (value <= -HALF_TURN) value += FULL_TURN;
    if (value > HALF_TURN) value -= FULL_TURN;
    return value;
  }

  /** Shortest signed turn from one angle to another, in degrees. */
  function deltaAngle(fromDeg, toDeg) {
    return wrapAngle(finite(toDeg, 0) - finite(fromDeg, 0));
  }

  function clampScale(value) {
    return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(value)));
  }

  /**
   * Scale slider value after a pinch.
   * The ratio between the current and the starting finger distance multiplies
   * the scale the gesture started with, so the pinch is relative, never absolute.
   */
  function scaleFromPinch(startScale, startDistance, currentDistance) {
    var base = finite(startScale, SCALE_MIN);
    var start = finite(startDistance, 0);
    var current = finite(currentDistance, 0);
    if (start <= 0 || current <= 0) return clampScale(base);
    return clampScale(base * (current / start));
  }

  /** Rotation slider value after a twist: the turn adds up and wraps into range. */
  function rotationFromTwist(startRotation, deltaDeg) {
    var base = finite(startRotation, 0);
    return wrapAngle(base + finite(deltaDeg, 0));
  }

  return {
    SCALE_MIN: SCALE_MIN,
    SCALE_MAX: SCALE_MAX,
    distance: distance,
    angleDeg: angleDeg,
    wrapAngle: wrapAngle,
    deltaAngle: deltaAngle,
    scaleFromPinch: scaleFromPinch,
    rotationFromTwist: rotationFromTwist
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PadTransform;
}
