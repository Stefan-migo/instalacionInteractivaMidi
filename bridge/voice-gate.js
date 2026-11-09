'use strict';

// Collapses a burst of gesture events into one voice per group and gesture
// (see odd/tasks/ableton-music.md, S3: "ten phones tilting at once read as one
// accent instead of ten stacked notes").
//
// The 20 Hz state tick is the window: everything a group produces between two
// ticks becomes a single note carrying the hardest velocity of the batch. No
// timer of its own, so nothing extra to leak or tune.

function createVoiceGate() {
  const pending = new Map();

  function add(group, gesture, velocity) {
    if (!Number.isInteger(group) || group < 1) return false;
    if (typeof gesture !== 'string' || gesture === '') return false;
    if (typeof velocity !== 'number' || !Number.isFinite(velocity)) return false;

    const key = group + ':' + gesture;
    const value = Math.round(velocity);
    const existing = pending.get(key);

    if (existing) {
      if (value > existing.velocity) existing.velocity = value;
      return false;
    }

    pending.set(key, { group, gesture, velocity: value });
    return true;
  }

  function flush() {
    const events = [...pending.values()];
    pending.clear();
    return events;
  }

  function size() {
    return pending.size;
  }

  return { add, flush, size };
}

module.exports = { createVoiceGate };
