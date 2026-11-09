const {
  normalizeMapping,
  applyCurve,
  createEma,
  createGroupShaper,
  DEFAULT_MAPPING,
} = require('../music/mapping');

const FILE = require('../music/mapping.json');

describe('normalizeMapping', () => {
  test('an empty file becomes three usable groups', () => {
    const { mapping, errors } = normalizeMapping({});
    expect(errors).toEqual([]);
    expect(mapping.groups).toHaveLength(3);
    expect(mapping.groups.map(g => g.channel)).toEqual([1, 2, 3]);
  });

  test('the shipped score is valid and gives every group its nine voices', () => {
    const { mapping, errors } = normalizeMapping(FILE);
    expect(errors).toEqual([]);
    for (const group of mapping.groups) {
      expect(group.gestures.tilt.note).toBe(36);
      expect(group.gestures.flick.note).toBe(37);
      expect(group.gestures.rotation.note).toBe(38);
    }
  });

  test('bad values are reported and replaced, never fatal', () => {
    const { mapping, errors } = normalizeMapping({
      groups: [{ group: 1, channel: 99, aggregation: 'telepathy', ema: 'fast', deadband: -3 }],
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(mapping.groups[0].channel).toBe(1);
    expect(mapping.groups[0].aggregation).toBe('average');
    expect(mapping.groups[0].ema).toBe(DEFAULT_MAPPING.groups[0].ema);
    expect(mapping.groups[0].deadband).toBeGreaterThanOrEqual(0);
  });

  test('nonsense input still returns something usable', () => {
    for (const input of [null, undefined, 'nope', 42, []]) {
      expect(() => normalizeMapping(input)).not.toThrow();
      expect(normalizeMapping(input).mapping.groups).toHaveLength(3);
    }
  });
});

describe('applyCurve', () => {
  test('linear passes the value through', () => {
    expect(applyCurve(64, { shape: 'linear', gamma: 1 })).toBe(64);
  });

  test('exponential bends the bottom, and the ends stay put', () => {
    expect(applyCurve(0, { shape: 'exponential', gamma: 2 })).toBe(0);
    expect(applyCurve(127, { shape: 'exponential', gamma: 2 })).toBe(127);
    expect(applyCurve(64, { shape: 'exponential', gamma: 2 })).toBe(32);
  });

  test('logarithmic lifts the bottom, and the ends stay put', () => {
    expect(applyCurve(0, { shape: 'logarithmic', gamma: 2 })).toBe(0);
    expect(applyCurve(127, { shape: 'logarithmic', gamma: 2 })).toBe(127);
    expect(applyCurve(64, { shape: 'logarithmic', gamma: 2 })).toBe(96);
  });

  test('an unknown shape behaves linearly instead of breaking the show', () => {
    expect(applyCurve(64, { shape: 'sigmoid-ish', gamma: 2 })).toBe(64);
  });
});

describe('createEma', () => {
  test('seeds with the first value and then smooths', () => {
    const ema = createEma(0.5);
    expect(ema.push(100)).toBe(100);
    expect(ema.push(0)).toBe(50);
    expect(ema.push(0)).toBe(25);
  });

  test('alpha 1 is no smoothing at all', () => {
    const ema = createEma(1);
    ema.push(10);
    expect(ema.push(90)).toBe(90);
  });
});

describe('createGroupShaper', () => {
  function shaper(overrides = {}) {
    let now = 0;
    const instance = createGroupShaper({
      curve: { shape: 'linear', gamma: 1 },
      ema: 1,
      deadband: 2,
      maxPerSecond: 20,
      safeValue: 64,
      now: () => now,
      ...overrides,
    });
    return { instance, advance: (ms) => { now += ms; } };
  }

  test('the first value is always sent', () => {
    const { instance } = shaper();
    expect(instance.push(50)).toBe(50);
  });

  test('the deadband swallows changes too small to hear', () => {
    const { instance, advance } = shaper();
    instance.push(50);
    advance(100);
    expect(instance.push(51)).toBeNull();
    advance(100);
    expect(instance.push(52)).toBe(52);
  });

  test('the rate limit caps how many messages leave per second', () => {
    const { instance, advance } = shaper({ maxPerSecond: 4 });
    instance.push(10);
    advance(100);
    expect(instance.push(80)).toBeNull();
    advance(200);
    expect(instance.push(80)).toBe(80);
  });

  test('a silent group parks once at the safe value', () => {
    const { instance } = shaper();
    instance.push(90);
    expect(instance.push(null)).toBe(64);
    expect(instance.push(null)).toBeNull();
  });

  test('values are clamped and rounded to 7 bits', () => {
    const { instance, advance } = shaper({ deadband: 0 });
    expect(instance.push(999)).toBe(127);
    advance(100);
    expect(instance.push(-40)).toBe(0);
    advance(100);
    expect(instance.push(63.6)).toBe(64);
  });
});
