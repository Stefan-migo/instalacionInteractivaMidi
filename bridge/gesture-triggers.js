'use strict';

// Turns continuous sensor signals into discrete gesture events
// (see odd/tasks/ableton-music.md, S3 and T8).
//
// The phone client already streams orientation and rotation rate 30 times per
// second. A sound needs an event, not a stream, so each gesture is derived here:
// a threshold decides when it becomes a gesture, hysteresis stops a phone held
// at the edge from machine-gunning, and a cooldown stops a fast shake from
// becoming a drum roll.
//
// Two rules keep the three gestures apart, because one physical motion can
// satisfy several detectors at once:
//   - priority: rotation outranks tilt, so a twist is read as a twist;
//   - exclusivity: the gesture that fires latches the others shut until the
//     phone comes back to rest, so the same motion cannot also be read as a
//     second gesture a moment later.
// A tilt is a movement, not a posture: the angle has to change inside a short
// window, otherwise a phone resting at forty degrees would keep score.
//
// Units come straight from the wire: orientation is degrees (deviceorientation
// beta is pitch) and gyro is degrees per second (rotationRate). Both are
// configurable through music/mapping.json rather than compiled in.

const DEFAULT_COOLDOWN_MS = 200;
// How long the other gestures stay shut after one fires.
const DEFAULT_EXCLUSIVE_MS = 300;
// A tilt has to move this much inside MOVE_WINDOW_MS to count as a gesture.
const MOVE_WINDOW_MS = 150;
// Samples older than this are dropped: they cannot serve as a movement reference.
const HISTORY_MS = 400;
// How much the gesture's own rotation axis has to lead the other two before the
// motion counts as that gesture. A shake moves all three at once; a twist does not.
const DEFAULT_DOMINANCE = 1.4;

// Most specific first. Flick is derived elsewhere (the DTW matcher) and reaches
// this module through suppress(); rotation is a velocity, tilt is the loosest.
const PRIORITY = ['flick', 'rotation', 'tilt'];

const DEFAULT_GESTURES = {
  tilt: {
    source: 'orientation',
    axis: 'b',
    onThreshold: 30,
    offThreshold: 20,
    minVelocity: 40,
    maxVelocity: 127,
    minDelta: 15,
    dominanceAxis: 'b',
  },
  rotation: {
    source: 'gyro',
    axis: 'g',
    onThreshold: 120,
    offThreshold: 60,
    minVelocity: 40,
    maxVelocity: 127,
    minDelta: 0,
    dominanceAxis: 'g',
  },
};

function toFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeGesture(name, config, fallback) {
  const base = fallback || {};
  const merged = { ...base, ...(config && typeof config === 'object' ? config : {}) };
  const minVelocity = Number.isFinite(merged.minVelocity) ? merged.minVelocity : 40;
  const maxVelocity = Number.isFinite(merged.maxVelocity) ? merged.maxVelocity : 127;
  return {
    name,
    source: typeof merged.source === 'string' ? merged.source : 'orientation',
    axis: typeof merged.axis === 'string' ? merged.axis : 'b',
    onThreshold: Number.isFinite(merged.onThreshold) ? merged.onThreshold : 30,
    // The release point must sit below the trigger point, otherwise a value
    // resting on the threshold flickers between armed and fired.
    offThreshold: Number.isFinite(merged.offThreshold) ? merged.offThreshold : 20,
    // Span is how far past the threshold a gesture must go to reach full
    // velocity. Falling back to the threshold itself keeps old configs working,
    // but a real span is what stops everything above twice the threshold from
    // saturating at 127.
    span: Number.isFinite(merged.span) && merged.span > 0
      ? merged.span
      : Number.isFinite(merged.onThreshold) ? merged.onThreshold : 30,
    // Zero means the value itself is already a motion (the gyro), so no change
    // is required; anything above zero demands that much movement in the window.
    minDelta: Number.isFinite(merged.minDelta) && merged.minDelta > 0 ? merged.minDelta : 0,
    // The gyro axis this gesture owns. Its rate has to lead the other two, or the
    // motion is read as something else.
    dominanceAxis: typeof merged.dominanceAxis === 'string' ? merged.dominanceAxis : null,
    dominanceFactor: Number.isFinite(merged.dominanceFactor) && merged.dominanceFactor > 0
      ? merged.dominanceFactor
      : DEFAULT_DOMINANCE,
    minVelocity,
    maxVelocity: Math.max(minVelocity, maxVelocity),
  };
}

// Velocity carries how hard the gesture was made: a gentle crossing lands near
// minVelocity, a doubling of the threshold saturates at maxVelocity.
function velocityFor(gesture, magnitude) {
  const span = Math.max(1, gesture.span || gesture.onThreshold);
  const intensity = Math.min(1, Math.max(0, (magnitude - gesture.onThreshold) / span));
  return Math.round(gesture.minVelocity + intensity * (gesture.maxVelocity - gesture.minVelocity));
}

function createGestureTriggers(options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  let cooldownMs = Number.isFinite(options.cooldownMs) ? options.cooldownMs : DEFAULT_COOLDOWN_MS;
  let exclusiveMs = Number.isFinite(options.exclusiveMs) ? options.exclusiveMs : DEFAULT_EXCLUSIVE_MS;

  function buildGestures(source) {
    const configured = source && typeof source === 'object' ? source : DEFAULT_GESTURES;
    const rank = (name) => {
      const index = PRIORITY.indexOf(name);
      return index === -1 ? PRIORITY.length : index;
    };
    return Object.keys(configured)
      .map((name) => normalizeGesture(name, configured[name], DEFAULT_GESTURES[name]))
      .sort((a, b) => rank(a.name) - rank(b.name));
  }

  let gestures = buildGestures(options.gestures);

  // slot -> { byGesture: name -> { armed, lastFiredAt, samples }, suppressUntil }
  const states = new Map();

  // Adopting the score means new thresholds mid-show: the phone states are
  // dropped, because a latch armed under the old numbers means nothing under
  // the new ones.
  function configure(next = {}) {
    if (next.gestures && typeof next.gestures === 'object') {
      gestures = buildGestures(next.gestures);
    }
    if (Number.isFinite(next.cooldownMs) && next.cooldownMs >= 0) {
      cooldownMs = next.cooldownMs;
    }
    if (Number.isFinite(next.exclusiveMs) && next.exclusiveMs >= 0) {
      exclusiveMs = next.exclusiveMs;
    }
    states.clear();
    return { cooldownMs, exclusiveMs, gestures: gestures.map((gesture) => gesture.name) };
  }

  function stateFor(slot) {
    let entry = states.get(slot);
    if (!entry) {
      const byGesture = {};
      for (const gesture of gestures) {
        byGesture[gesture.name] = { armed: true, lastFiredAt: -Infinity, samples: [] };
      }
      entry = { byGesture, suppressUntil: -Infinity };
      states.set(slot, entry);
    }
    return entry;
  }

  // True when the value moved enough inside the window. A fresh stream has no
  // reference yet, so the first crossing is allowed: a phone that joins the show
  // already tilted still works.
  function moved(state, at, value, minDelta) {
    // The newest sample that is already MOVE_WINDOW_MS old: comparing against the
    // oldest one would hide a return to rest followed by a new movement.
    let reference = null;
    for (let index = state.samples.length - 1; index >= 0; index -= 1) {
      const sample = state.samples[index];
      if (at - sample.at >= MOVE_WINDOW_MS) {
        reference = sample;
        break;
      }
    }
    if (!reference) return true;
    return Math.abs(value - reference.value) >= minDelta;
  }

  // A gesture counts only when its own rotation axis leads the others: a shake
  // moves all three at once, a twist moves one. Without this, a shake reads as a
  // twist and a roll reads as a tilt. A phone that reports no gyro passes, so the
  // rule never silences a browser that omits the sensor.
  function dominates(sensor, gesture) {
    if (!gesture.dominanceAxis) return true;
    const gyro = sensor.gyro;
    if (!gyro || typeof gyro !== 'object') return true;
    const own = Math.abs(toFiniteNumber(gyro[gesture.dominanceAxis]) ?? 0);
    let others = 0;
    for (const axis of ['a', 'b', 'g']) {
      if (axis === gesture.dominanceAxis) continue;
      const value = Math.abs(toFiniteNumber(gyro[axis]) ?? 0);
      if (value > others) others = value;
    }
    return own >= gesture.dominanceFactor * others;
  }

  function feed(slot, sensor) {
    const events = [];
    if (!Number.isInteger(slot) || !sensor || typeof sensor !== 'object') return events;

    const entry = stateFor(slot);
    const at = now();

    for (const gesture of gestures) {
      const source = sensor[gesture.source];
      if (!source || typeof source !== 'object') continue;

      const raw = toFiniteNumber(source[gesture.axis]);
      if (raw === null) continue;

      const magnitude = Math.abs(raw);
      const state = entry.byGesture[gesture.name];

      state.samples.push({ at, value: raw });
      while (state.samples.length && at - state.samples[0].at > HISTORY_MS) state.samples.shift();

      if (!state.armed) {
        if (magnitude < gesture.offThreshold) state.armed = true;
        continue;
      }

      if (magnitude < gesture.onThreshold) continue;
      if (at - state.lastFiredAt < cooldownMs) continue;
      if (at < entry.suppressUntil) continue;
      if (gesture.minDelta > 0 && !moved(state, at, raw, gesture.minDelta)) continue;
      if (!dominates(sensor, gesture)) continue;

      state.armed = false;
      state.lastFiredAt = at;
      // The others lose their latch too: once this motion is over, it must not
      // come back as a different gesture.
      for (const other of gestures) {
        if (other.name !== gesture.name) entry.byGesture[other.name].armed = false;
      }
      entry.suppressUntil = at + exclusiveMs;
      events.push({
        gesture: gesture.name,
        velocity: velocityFor(gesture, magnitude),
        magnitude,
      });
    }

    return events;
  }

  // A gesture derived elsewhere (the DTW flick) tells this module to stand down:
  // the same shake must not also become a tilt or a rotation.
  function suppress(slot, ms) {
    if (!Number.isInteger(slot)) return false;
    const entry = stateFor(slot);
    const window = Number.isFinite(ms) && ms >= 0 ? ms : exclusiveMs;
    entry.suppressUntil = Math.max(entry.suppressUntil, now() + window);
    for (const gesture of gestures) entry.byGesture[gesture.name].armed = false;
    return true;
  }

  function reset(slot) {
    if (slot === undefined) {
      states.clear();
      return;
    }
    states.delete(slot);
  }

  function activeSlots() {
    return [...states.keys()];
  }

  return {
    feed,
    reset,
    suppress,
    configure,
    activeSlots,
    get gestures() {
      return gestures.map((gesture) => gesture.name);
    },
  };
}

module.exports = {
  createGestureTriggers,
  DEFAULT_GESTURES,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_EXCLUSIVE_MS,
  PRIORITY,
  velocityFor,
};
