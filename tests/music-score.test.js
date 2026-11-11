'use strict';

const { buildMusicConfig } = require('../music/agent');
const mapping = require('../music/mapping.json');
const { normalizeMapping } = require('../music/mapping');
const { validateMusicScore } = require('../bridge/message-relay');

function scoreWith(groups) {
  return { version: 3, safeValue: 64, derivation: { cooldownMs: 200, gestures: {} }, groups };
}

function groupWith(overrides) {
  return Object.assign({
    group: 1,
    channel: 1,
    aggregation: 'average',
    curve: { shape: 'linear', gamma: 1 },
    ema: 0.5,
    deadband: 2,
    maxPerSecond: 20,
    notes: { tilt: 36, flick: 37, rotation: 38 },
  }, overrides);
}

test('music-config publishes the complete ten-group score', () => {
  const config = buildMusicConfig(mapping);
  expect(config).toMatchObject({ version: 2, safeValue: 64, derivation: mapping.derivation });
  expect(config.groups).toHaveLength(10);
  for (const [index, group] of config.groups.entries()) {
    expect(group).toEqual({
      group: index + 1,
      channel: index + 1,
      ccController: 21,
      ccControllers: { position: 21, scale: 22, rotation: 23 },
      aggregation: 'average',
      curve: { shape: 'linear', gamma: 1 },
      ema: 0.5,
      deadband: 2,
      maxPerSecond: 20,
      notes: { tilt: 36, flick: 37, rotation: 38 },
    });
  }
});

describe('one controller per lane', () => {
  test('a v2 score derives the three controllers from the one it declares', () => {
    const { mapping: normalized, errors } = normalizeMapping({
      version: 2,
      safeValue: 64,
      groups: [{ group: 1, channel: 1, ccController: 30 }],
    });

    expect(normalized.groups[0].ccControllers).toEqual({ position: 30, scale: 31, rotation: 32 });
    expect(normalized.groups[0].ccController).toBe(30);
    expect(errors).toEqual([]);
  });

  test('a score that declares the three lanes keeps them exactly', () => {
    const { mapping: normalized, errors } = normalizeMapping({
      version: 3,
      safeValue: 64,
      groups: [{ group: 1, channel: 1, ccControllers: { position: 40, scale: 41, rotation: 42 } }],
    });

    expect(normalized.groups[0].ccControllers).toEqual({ position: 40, scale: 41, rotation: 42 });
    expect(normalized.groups[0].ccController).toBe(40);
    expect(errors).toEqual([]);
  });

  test('a lane outside the controller range falls back instead of breaking the score', () => {
    const { mapping: normalized, errors } = normalizeMapping({
      version: 3,
      safeValue: 64,
      groups: [{ group: 1, channel: 1, ccControllers: { position: 21, scale: 300, rotation: 23 } }],
    });

    expect(normalized.groups[0].ccControllers).toEqual({ position: 21, scale: 22, rotation: 23 });
    expect(errors.join(' ')).toContain('scale');
  });

  test('a v2 controller at the top of the range cannot derive lanes past 127', () => {
    const { mapping: normalized } = normalizeMapping({
      version: 2,
      safeValue: 64,
      groups: [{ group: 1, channel: 1, ccController: 127 }],
    });

    expect(normalized.groups[0].ccControllers).toEqual({ position: 127, scale: 22, rotation: 23 });
  });
});

describe('the bridge accepts both score shapes', () => {
  test('a score with one controller per lane is valid', () => {
    expect(validateMusicScore(scoreWith([
      groupWith({ ccControllers: { position: 21, scale: 22, rotation: 23 } }),
    ]))).toBe(true);
  });

  test('a legacy score with a single controller is still valid', () => {
    expect(validateMusicScore(scoreWith([groupWith({ ccController: 21 })]))).toBe(true);
  });

  test('a lane map missing a lane is refused', () => {
    expect(validateMusicScore(scoreWith([
      groupWith({ ccControllers: { position: 21, scale: 22 } }),
    ]))).toBe(false);
  });

  test('a lane that is not an integer is refused', () => {
    expect(validateMusicScore(scoreWith([
      groupWith({ ccControllers: { position: 21, scale: 22.5, rotation: 23 } }),
    ]))).toBe(false);
  });

  test('a score with neither controller shape is refused', () => {
    expect(validateMusicScore(scoreWith([groupWith({})]))).toBe(false);
  });
});
