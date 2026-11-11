'use strict';

// Per-group state for the music lane (see odd/tasks/ableton-music.md, S3).
//
// The bridge aggregates; the agent maps and emits. Thirty phones sit in three
// groups of ten, and the group comes from the slot the allocator already handed
// out (0..29), so no new assignment logic exists.
//
// Everything here is pure and dependency-free so it can be tested without a
// socket, a timer or a MIDI port.

const AGGREGATION_MODES = ['average', 'max', 'last'];

const DEFAULT_GROUP_COUNT = 3;
const DEFAULT_SLOTS_PER_GROUP = 10;

// The three continuous lanes the pad drives (see odd/tasks/touch-faders.md, S3).
// One MIDI controller each, on the group's channel: 21 position, 22 scale,
// 23 rotation.
const TOUCH_LANES = ['position', 'scale', 'rotation'];
const PAD_SCALE_MIN = 40;
const PAD_SCALE_MAX = 180;

// A drag event of 64 canvas units reaches the top of the range: the pad already
// scales finger pixels into canvas units, so this is a calibration, not physics.
const POSITION_FULL_SCALE = 64;

// Position is speed, not state: it fades out when the finger lifts. Half a
// second is long enough to feel connected and short enough to park the fader.
const POSITION_DECAY_MS = 350;
const POSITION_FLOOR = 4;

// The continuous signal is the pad's touch, not the phone's physics: see
// TOUCH_LANES below.

function groupForSlot(slot, groupCount = DEFAULT_GROUP_COUNT, slotsPerGroup = DEFAULT_SLOTS_PER_GROUP) {
  if (!Number.isInteger(slot)) return null;
  if (!Number.isInteger(groupCount) || groupCount < 1) return null;
  if (!Number.isInteger(slotsPerGroup) || slotsPerGroup < 1) return null;
  if (slot < 0 || slot >= groupCount * slotsPerGroup) return null;
  return Math.floor(slot / slotsPerGroup) + 1;
}

function toFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// aggregate() accepts either raw numbers or the { value } samples snapshot()
// builds, so the pure function stays usable on its own.
function sampleValue(entry) {
  if (typeof entry === 'number') return toFiniteNumber(entry);
  if (entry && typeof entry === 'object') return toFiniteNumber(entry.value);
  return null;
}

function sampleSeq(entry) {
  if (entry && typeof entry === 'object' && typeof entry.seq === 'number') return entry.seq;
  return 0;
}

function aggregate(mode, entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;

  if (mode === 'max') {
    let highest = null;
    for (const entry of entries) {
      const value = sampleValue(entry);
      if (value === null) continue;
      if (highest === null || value > highest) highest = value;
    }
    return highest;
  }

  if (mode === 'last') {
    let latest = null;
    for (const entry of entries) {
      const value = sampleValue(entry);
      if (value === null) continue;
      const entrySeq = sampleSeq(entry);
      if (latest === null || entrySeq > latest.seq) latest = { seq: entrySeq, value };
    }
    return latest === null ? null : latest.value;
  }

  // average is the default for any unknown mode, so a bad config never silences a group.
  let sum = 0;
  let count = 0;
  for (const entry of entries) {
    const value = sampleValue(entry);
    if (value === null) continue;
    sum += value;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

function clampCc(value) {
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 127) return 127;
  return rounded;
}

// ── The pad's three parameters as 7-bit lanes ────────────────────────────────
// Each mapper returns null when it cannot read a number, so a malformed frame
// never becomes a MIDI value: the lane simply keeps whatever it had.

function touchScaleToCc(value) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return null;
  const bounded = Math.max(PAD_SCALE_MIN, Math.min(PAD_SCALE_MAX, numeric));
  return clampCc(((bounded - PAD_SCALE_MIN) / (PAD_SCALE_MAX - PAD_SCALE_MIN)) * 127);
}

function touchRotationToCc(value) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return null;
  const bounded = Math.max(-180, Math.min(180, numeric));
  return clampCc(((bounded + 180) / 360) * 127);
}

// A drag arrives as a delta: its magnitude is the speed of that frame, which is
// why this lane needs no accumulation, only decay.
function touchPositionToCc(dx, dy) {
  const x = toFiniteNumber(dx);
  const y = toFiniteNumber(dy);
  if (x === null || y === null) return 0;
  const magnitude = Math.sqrt(x * x + y * y);
  if (!Number.isFinite(magnitude)) return 0;
  return clampCc((magnitude / POSITION_FULL_SCALE) * 127);
}

function decayPosition(value, elapsedMs) {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric <= 0) return 0;
  const elapsed = toFiniteNumber(elapsedMs);
  if (elapsed === null || elapsed <= 0) return clampCc(numeric);
  const decayed = numeric * Math.pow(0.5, elapsed / POSITION_DECAY_MS);
  if (!Number.isFinite(decayed) || decayed < POSITION_FLOOR) return 0;
  return clampCc(decayed);
}

function createGroupAggregator(options = {}) {
  const groupCount = Number.isInteger(options.groupCount) ? options.groupCount : DEFAULT_GROUP_COUNT;
  const slotsPerGroup = Number.isInteger(options.slotsPerGroup)
    ? options.slotsPerGroup
    : DEFAULT_SLOTS_PER_GROUP;

  const modes = new Array(groupCount).fill('average');
  if (Array.isArray(options.modes)) {
    options.modes.forEach((mode, index) => {
      if (index < groupCount && AGGREGATION_MODES.includes(mode)) {
        modes[index] = mode;
      }
    });
  }

  // slot -> { group, lanes, touchedAt, seq }. A Map keyed by slot makes `drop` a
  // deletion instead of a hole, so a disconnected phone stops contributing at
  // once. Each lane remembers when it was last written: position decays from
  // that instant, scale and rotation do not.
  const samples = new Map();
  let seq = 0;

  function emptyLanes() {
    return { position: null, scale: null, rotation: null };
  }

  function emptyTouchedAt() {
    return { position: 0, scale: 0, rotation: 0 };
  }

  function entryFor(slot, group) {
    const existing = samples.get(slot);
    if (existing && existing.group === group) return existing;
    return { group, lanes: emptyLanes(), touchedAt: emptyTouchedAt(), seq: 0 };
  }

  function modeFor(group) {
    if (!Number.isInteger(group) || group < 1 || group > groupCount) return null;
    return modes[group - 1];
  }

  function setMode(group, mode) {
    if (!Number.isInteger(group) || group < 1 || group > groupCount) return false;
    if (!AGGREGATION_MODES.includes(mode)) return false;
    modes[group - 1] = mode;
    return true;
  }

  function pushLane(slot, lane, value, at = Date.now()) {
    if (!TOUCH_LANES.includes(lane)) return false;
    const group = groupForSlot(slot, groupCount, slotsPerGroup);
    if (group === null) return false;
    const numeric = toFiniteNumber(value);
    if (numeric === null) return false;
    seq += 1;
    const entry = entryFor(slot, group);
    entry.lanes[lane] = clampCc(numeric);
    const stamp = toFiniteNumber(at);
    entry.touchedAt[lane] = stamp === null ? Date.now() : stamp;
    entry.seq = seq;
    samples.set(slot, entry);
    return true;
  }

  // Kept so a caller that only knows about one continuous value keeps working:
  // that value is the position lane.
  function push(slot, value, at = Date.now()) {
    return pushLane(slot, 'position', value, at);
  }

  function drop(slot) {
    return samples.delete(slot);
  }

  function snapshot(options = {}) {
    const injected = toFiniteNumber(options && options.now);
    const at = injected === null ? Date.now() : injected;
    const groups = [];

    for (let group = 1; group <= groupCount; group += 1) {
      const entries = [];
      for (const [slot, sample] of samples) {
        if (sample.group === group) entries.push({ slot, sample });
      }

      const lanes = emptyLanes();
      for (const lane of TOUCH_LANES) {
        const laneEntries = [];
        for (const { sample } of entries) {
          const value = sample.lanes[lane];
          if (value === null) continue;
          const shaped = lane === 'position'
            ? decayPosition(value, at - sample.touchedAt[lane])
            : value;
          laneEntries.push({ value: shaped, seq: sample.seq });
        }
        lanes[lane] = aggregate(modes[group - 1], laneEntries);
      }

      groups.push({
        group,
        // `value` stays the position lane so older readers of /api/music and of
        // the music-state stream keep seeing a single continuous number.
        value: lanes.position,
        lanes,
        phones: entries.length,
      });
    }

    return groups;
  }

  function config() {
    return modes.map((mode, index) => ({ group: index + 1, mode }));
  }

  return {
    groupCount,
    slotsPerGroup,
    modeFor,
    setMode,
    push,
    pushLane,
    drop,
    snapshot,
    config,
  };
}

module.exports = {
  AGGREGATION_MODES,
  DEFAULT_GROUP_COUNT,
  DEFAULT_SLOTS_PER_GROUP,
  TOUCH_LANES,
  PAD_SCALE_MIN,
  PAD_SCALE_MAX,
  POSITION_FULL_SCALE,
  POSITION_DECAY_MS,
  groupForSlot,
  aggregate,
  touchScaleToCc,
  touchRotationToCc,
  touchPositionToCc,
  decayPosition,
  createGroupAggregator,
};
