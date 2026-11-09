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
// Units come straight from the wire: orientation is degrees (deviceorientation
// beta is pitch) and gyro is degrees per second (rotationRate). Both are
// configurable through music/mapping.json rather than compiled in.

const DEFAULT_COOLDOWN_MS = 200;

const DEFAULT_GESTURES = {
  tilt: {
    source: 'orientation',
    axis: 'b',
    onThreshold: 30,
    offThreshold: 20,
    minVelocity: 40,
    maxVelocity: 127,
  },
  rotation: {
    source: 'gyro',
    axis: 'g',
    onThreshold: 120,
    offThreshold: 60,
    minVelocity: 40,
    maxVelocity: 127,
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
    minVelocity,
    maxVelocity: Math.max(minVelocity, maxVelocity),
  };
}

// Velocity carries how hard the gesture was made: a gentle crossing lands near
// minVelocity, a doubling of the threshold saturates at maxVelocity.
function velocityFor(gesture, magnitude) {
  const span = Math.max(1, gesture.onThreshold);
  const intensity = Math.min(1, Math.max(0, (magnitude - gesture.onThreshold) / span));
  return Math.round(gesture.minVelocity + intensity * (gesture.maxVelocity - gesture.minVelocity));
}

function createGestureTriggers(options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const cooldownMs = Number.isFinite(options.cooldownMs) ? options.cooldownMs : DEFAULT_COOLDOWN_MS;

  const configured = options.gestures && typeof options.gestures === 'object' ? options.gestures : DEFAULT_GESTURES;
  const gestures = Object.keys(configured).map((name) =>
    normalizeGesture(name, configured[name], DEFAULT_GESTURES[name])
  );

  // slot -> gesture name -> { armed, lastFiredAt }. Armed starts true and goes
  // false when the gesture fires; it only comes back below offThreshold.
  const states = new Map();

  function stateFor(slot) {
    let byGesture = states.get(slot);
    if (!byGesture) {
      byGesture = {};
      for (const gesture of gestures) {
        byGesture[gesture.name] = { armed: true, lastFiredAt: -Infinity };
      }
      states.set(slot, byGesture);
    }
    return byGesture;
  }

  function feed(slot, sensor) {
    const events = [];
    if (!Number.isInteger(slot) || !sensor || typeof sensor !== 'object') return events;

    const byGesture = stateFor(slot);
    const at = now();

    for (const gesture of gestures) {
      const source = sensor[gesture.source];
      if (!source || typeof source !== 'object') continue;

      const raw = toFiniteNumber(source[gesture.axis]);
      if (raw === null) continue;

      const magnitude = Math.abs(raw);
      const state = byGesture[gesture.name];

      if (!state.armed) {
        if (magnitude < gesture.offThreshold) state.armed = true;
        continue;
      }

      if (magnitude < gesture.onThreshold) continue;
      if (at - state.lastFiredAt < cooldownMs) continue;

      state.armed = false;
      state.lastFiredAt = at;
      events.push({
        gesture: gesture.name,
        velocity: velocityFor(gesture, magnitude),
        magnitude,
      });
    }

    return events;
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

  return { feed, reset, activeSlots, gestures: gestures.map((gesture) => gesture.name) };
}

module.exports = { createGestureTriggers, DEFAULT_GESTURES, DEFAULT_COOLDOWN_MS, velocityFor };
