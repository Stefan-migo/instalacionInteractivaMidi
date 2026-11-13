'use strict';

// How the wall rearranges itself: a list of scatter scales, one every `dwell`
// seconds. It is data, not a constant, because the sequence is an aesthetic
// decision the owner tunes against the projection.
const DEFAULT_CYCLE = { version: 1, dwell: 30, autoStart: true, steps: [0.7, 1, 1.3, 1] };

function validateCycle(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid cycle: expected an object');
  if (data.version !== 1) throw new Error('Invalid cycle: unsupported version');
  if (!Number.isFinite(data.dwell) || data.dwell < 1) throw new Error('Invalid cycle: dwell must be at least one second');
  if (typeof data.autoStart !== 'boolean') throw new Error('Invalid cycle: autoStart must be a boolean');
  if (!Array.isArray(data.steps) || data.steps.length === 0) throw new Error('Invalid cycle: steps must be a non-empty array');
  for (const step of data.steps) {
    if (!Number.isFinite(step) || step <= 0) throw new Error('Invalid cycle: every step must be a positive number');
  }
  return data;
}

function loadCycle(data) {
  return validateCycle(data);
}

// Advancing is the next entry: the collage is rearranged at that step's scale, so
// the last step wraps to the first and a single step holds it where it is.
function advanceCycle(cycle, index) {
  const steps = cycle.steps;
  const nextIndex = (index + 1) % steps.length;
  return { index: nextIndex, scale: steps[nextIndex] };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_CYCLE, validateCycle, loadCycle, advanceCycle };
} else if (typeof window !== 'undefined') {
  window.CycleSteps = { DEFAULT_CYCLE, validateCycle, loadCycle, advanceCycle };
}
