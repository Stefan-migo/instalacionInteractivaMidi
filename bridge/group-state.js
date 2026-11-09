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

// Musical signal for the continuous lane. PLACEHOLDER: the gyro magnitude
// (how fast the phone is turning) scaled so that roughly 500 deg/s reaches the
// top of the MIDI range. The musical choice is revisited with the artist; what
// matters now is that it is deterministic, bounded and never throws.
const GYRO_FULL_SCALE = 500;

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

function sensorIntensity(sensor) {
  if (!sensor || typeof sensor !== 'object') return 0;

  const gyro = sensor.gyro;
  if (!gyro || typeof gyro !== 'object') return 0;

  const a = toFiniteNumber(gyro.a);
  const b = toFiniteNumber(gyro.b);
  const g = toFiniteNumber(gyro.g);
  if (a === null || b === null || g === null) return 0;

  const magnitude = Math.sqrt(a * a + b * b + g * g);
  if (!Number.isFinite(magnitude)) return 127;

  const scaled = Math.round((magnitude / GYRO_FULL_SCALE) * 127);
  if (scaled < 0) return 0;
  if (scaled > 127) return 127;
  return scaled;
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

  // slot -> { group, value, seq }. A Map keyed by slot makes `drop` a deletion
  // instead of a hole, so a disconnected phone stops contributing at once.
  const samples = new Map();
  let seq = 0;

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

  function push(slot, value) {
    const group = groupForSlot(slot, groupCount, slotsPerGroup);
    if (group === null) return false;
    const numeric = toFiniteNumber(value);
    if (numeric === null) return false;
    seq += 1;
    samples.set(slot, { group, value: numeric, seq });
    return true;
  }

  function drop(slot) {
    return samples.delete(slot);
  }

  function snapshot() {
    const groups = [];
    for (let group = 1; group <= groupCount; group += 1) {
      const entries = [];
      for (const [slot, sample] of samples) {
        if (sample.group === group) entries.push({ slot, value: sample.value, seq: sample.seq });
      }
      groups.push({
        group,
        value: aggregate(modes[group - 1], entries),
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
    drop,
    snapshot,
    config,
  };
}

module.exports = {
  AGGREGATION_MODES,
  DEFAULT_GROUP_COUNT,
  DEFAULT_SLOTS_PER_GROUP,
  groupForSlot,
  aggregate,
  sensorIntensity,
  createGroupAggregator,
};
