'use strict';

const { buildMusicConfig } = require('../music/agent');
const mapping = require('../music/mapping.json');

test('music-config publishes the complete ten-group score', () => {
  const config = buildMusicConfig(mapping);
  expect(config).toMatchObject({ version: 2, safeValue: 64, derivation: mapping.derivation });
  expect(config.groups).toHaveLength(10);
  for (const [index, group] of config.groups.entries()) {
    expect(group).toEqual({
      group: index + 1,
      channel: index + 1,
      ccController: 21,
      aggregation: 'average',
      curve: { shape: 'linear', gamma: 1 },
      ema: 0.5,
      deadband: 2,
      maxPerSecond: 20,
      notes: { tilt: 36, flick: 37, rotation: 38 },
    });
  }
});
