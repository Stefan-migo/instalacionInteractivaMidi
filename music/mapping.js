'use strict';

// The score, and the shaping between the bridge's group values and the wire
// (see odd/tasks/ableton-music.md, S10 and T5).
//
// Everything here is pure: no sockets, no MIDI, no timers except an injected
// clock. The pipeline per group is curve -> EMA -> deadband -> rate limit, in
// that order, because that is the order the artist reasons about: what shape,
// how smooth, what is too small to hear, how many messages per second.

const SHAPES = ['linear', 'exponential', 'logarithmic'];
const AGGREGATIONS = ['average', 'max', 'last'];

function clamp7(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 127) return 127;
  return rounded;
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function integerOr(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

const DEFAULT_MAPPING = {
  version: 1,
  safeValue: 64,
  groups: [1, 2, 3].map((group) => ({
    group,
    channel: group,
    aggregation: 'average',
    ccController: 21,
    curve: { shape: 'linear', gamma: 1 },
    ema: 0.5,
    deadband: 2,
    maxPerSecond: 20,
    gestures: {
      tilt: { note: 36, onThreshold: 30, offThreshold: 20, span: 90 },
      flick: { note: 37 },
      rotation: { note: 38, onThreshold: 120, offThreshold: 60, span: 240 },
    },
  })),
};

function normalizeCurve(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const shape = SHAPES.includes(source.shape) ? source.shape : fallback.shape;
  const gamma = numberOr(source.gamma, fallback.gamma);
  return { shape, gamma: gamma > 0 ? gamma : fallback.gamma };
}

function normalizeGesture(name, raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const note = integerOr(source.note, fallback.note);
  const normalized = {
    note: note >= 0 && note <= 127 ? note : fallback.note,
  };
  if (fallback.onThreshold !== undefined) {
    normalized.onThreshold = numberOr(source.onThreshold, fallback.onThreshold);
    normalized.offThreshold = numberOr(source.offThreshold, fallback.offThreshold);
    normalized.span = numberOr(source.span, fallback.span);
  }
  return normalized;
}

function normalizeGroup(raw, index, errors) {
  const fallback = DEFAULT_MAPPING.groups[index];
  const source = raw && typeof raw === 'object' ? raw : {};

  let channel = integerOr(source.channel, fallback.channel);
  if (channel < 1 || channel > 16) {
    errors.push('group ' + (index + 1) + ': channel must be 1..16, using ' + fallback.channel);
    channel = fallback.channel;
  }

  let aggregation = source.aggregation;
  if (!AGGREGATIONS.includes(aggregation)) {
    if (aggregation !== undefined) {
      errors.push('group ' + (index + 1) + ': unknown aggregation, using ' + fallback.aggregation);
    }
    aggregation = fallback.aggregation;
  }

  let ema = numberOr(source.ema, fallback.ema);
  if (!(ema > 0 && ema <= 1)) {
    if (source.ema !== undefined) errors.push('group ' + (index + 1) + ': ema must be in (0, 1], using ' + fallback.ema);
    ema = fallback.ema;
  }

  let deadband = integerOr(source.deadband, fallback.deadband);
  if (deadband < 0) {
    errors.push('group ' + (index + 1) + ': deadband cannot be negative, using ' + fallback.deadband);
    deadband = fallback.deadband;
  }

  let maxPerSecond = numberOr(source.maxPerSecond, fallback.maxPerSecond);
  if (!(maxPerSecond > 0)) {
    if (source.maxPerSecond !== undefined) errors.push('group ' + (index + 1) + ': maxPerSecond must be positive');
    maxPerSecond = fallback.maxPerSecond;
  }

  let ccController = integerOr(source.ccController, fallback.ccController);
  if (ccController < 0 || ccController > 127) {
    if (source.ccController !== undefined) errors.push('group ' + (index + 1) + ': ccController must be 0..127');
    ccController = fallback.ccController;
  }

  const gesturesSource = source.gestures && typeof source.gestures === 'object' ? source.gestures : {};
  const gestures = {};
  for (const name of Object.keys(fallback.gestures)) {
    gestures[name] = normalizeGesture(name, gesturesSource[name], fallback.gestures[name]);
  }

  return { group: index + 1, channel, aggregation, ccController, curve: normalizeCurve(source.curve, fallback.curve), ema, deadband, maxPerSecond, gestures };
}

// Never throws and never returns something unusable: a broken score must not
// stop the show, it must show up as a list of complaints and keep working.
function normalizeMapping(raw) {
  const errors = [];
  const source = raw && typeof raw === 'object' ? raw : {};
  const provided = Array.isArray(source.groups) ? source.groups : [];

  if (raw !== undefined && raw !== null && typeof raw !== 'object') {
    errors.push('mapping is not an object, using defaults');
  }
  if (source.groups !== undefined && !Array.isArray(source.groups)) {
    errors.push('groups is not an array, using defaults');
  }

  const groups = DEFAULT_MAPPING.groups.map((fallback, index) =>
    normalizeGroup(provided[index], index, errors)
  );

  if (provided.length > groups.length) {
    errors.push('more groups than channels: only the first ' + groups.length + ' were used');
  }

  const safeValue = clamp7(numberOr(source.safeValue, DEFAULT_MAPPING.safeValue));
  const version = integerOr(source.version, DEFAULT_MAPPING.version);

  return { mapping: { version, safeValue, groups }, errors };
}

function applyCurve(value, curve) {
  const clamped = Math.max(0, Math.min(127, numberOr(value, 0)));
  const x = clamped / 127;
  const shape = curve && SHAPES.includes(curve.shape) ? curve.shape : 'linear';
  const gamma = curve && Number.isFinite(curve.gamma) && curve.gamma > 0 ? curve.gamma : 1;

  let shaped;
  if (shape === 'exponential') shaped = Math.pow(x, gamma);
  else if (shape === 'logarithmic') shaped = 1 - Math.pow(1 - x, gamma);
  else shaped = x;

  return clamp7(shaped * 127);
}

function createEma(alpha) {
  const a = Number.isFinite(alpha) && alpha > 0 && alpha <= 1 ? alpha : 0.5;
  let current = null;

  return {
    push(value) {
      const numeric = numberOr(value, current === null ? 0 : current);
      current = current === null ? numeric : current + a * (numeric - current);
      return current;
    },
    get value() {
      return current;
    },
    reset() {
      current = null;
    },
  };
}

function createGroupShaper(options = {}) {
  const fallback = DEFAULT_MAPPING.groups[0];
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const curve = normalizeCurve(options.curve, fallback.curve);
  const ema = createEma(numberOr(options.ema, fallback.ema));
  const deadband = Math.max(0, integerOr(options.deadband, fallback.deadband));
  const maxPerSecond = numberOr(options.maxPerSecond, fallback.maxPerSecond);
  const intervalMs = maxPerSecond > 0 ? 1000 / maxPerSecond : 0;
  const safeValue = clamp7(numberOr(options.safeValue, DEFAULT_MAPPING.safeValue));

  let lastSent = null;
  let lastSentAt = -Infinity;

  function isSilent(value) {
    return value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value));
  }

  // Returns the 7-bit value to send, or null when there is nothing worth
  // sending. A silent group parks at the safe value exactly once.
  function push(rawValue) {
    const at = now();

    if (isSilent(rawValue)) {
      if (lastSent === safeValue) return null;
      lastSent = safeValue;
      lastSentAt = at;
      return safeValue;
    }

    const shaped = applyCurve(rawValue, curve);
    const smoothed = ema.push(shaped);
    const candidate = clamp7(smoothed);

    if (lastSent !== null && Math.abs(candidate - lastSent) < deadband) return null;
    if (at - lastSentAt < intervalMs) return null;

    lastSent = candidate;
    lastSentAt = at;
    return candidate;
  }

  function reset() {
    lastSent = null;
    lastSentAt = -Infinity;
    ema.reset();
  }

  return {
    push,
    reset,
    get lastSent() {
      return lastSent;
    },
  };
}

module.exports = {
  SHAPES,
  AGGREGATIONS,
  DEFAULT_MAPPING,
  clamp7,
  normalizeMapping,
  applyCurve,
  createEma,
  createGroupShaper,
};
