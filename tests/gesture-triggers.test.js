const { createGestureTriggers } = require('../bridge/gesture-triggers');

// The clock is injected so hysteresis and cooldown are deterministic.
function createHarness(overrides = {}) {
  let now = 1000;
  const triggers = createGestureTriggers({
    now: () => now,
    cooldownMs: 200,
    gestures: {
      tilt: { source: 'orientation', axis: 'b', onThreshold: 30, offThreshold: 20, minVelocity: 40, maxVelocity: 127 },
      rotation: { source: 'gyro', axis: 'g', onThreshold: 120, offThreshold: 60, minVelocity: 40, maxVelocity: 127 },
    },
    ...overrides,
  });
  return {
    triggers,
    advance: (ms) => { now += ms; },
    at: (ms) => { now = ms; },
  };
}

function orientation(b) {
  return { accel: { x: 0, y: 0, z: 9.8 }, gyro: { a: 0, b: 0, g: 0 }, orientation: { a: 0, b, g: 0 } };
}

function gyro(g) {
  return { accel: { x: 0, y: 0, z: 9.8 }, gyro: { a: 0, b: 0, g }, orientation: { a: 0, b: 0, g: 0 } };
}

describe('gesture triggers', () => {
  test('stays quiet below the threshold', () => {
    const { triggers } = createHarness();
    expect(triggers.feed(0, orientation(29))).toEqual([]);
  });

  test('fires once when the threshold is crossed', () => {
    const { triggers } = createHarness();
    const events = triggers.feed(0, orientation(31));

    expect(events).toHaveLength(1);
    expect(events[0].gesture).toBe('tilt');
    expect(events[0].velocity).toBeGreaterThanOrEqual(40);
    expect(events[0].velocity).toBeLessThanOrEqual(127);
  });

  test('holding the pose does not machine-gun the note', () => {
    const { triggers, advance } = createHarness();
    triggers.feed(0, orientation(35));

    advance(500);
    expect(triggers.feed(0, orientation(60))).toEqual([]);
    advance(500);
    expect(triggers.feed(0, orientation(80))).toEqual([]);
  });

  test('re-arms only after the value drops below the off threshold', () => {
    const { triggers, advance } = createHarness();
    triggers.feed(0, orientation(35));
    advance(500);

    // Between off and on: still latched, no new event.
    expect(triggers.feed(0, orientation(25))).toEqual([]);
    expect(triggers.feed(0, orientation(40))).toEqual([]);

    // Below off: re-armed.
    expect(triggers.feed(0, orientation(10))).toEqual([]);
    advance(500);
    expect(triggers.feed(0, orientation(40))).toHaveLength(1);
  });

  test('the cooldown blocks a re-trigger even after re-arming', () => {
    const { triggers, advance } = createHarness();
    triggers.feed(0, orientation(31));
    triggers.feed(0, orientation(5));
    advance(50);

    expect(triggers.feed(0, orientation(31))).toEqual([]);

    triggers.feed(0, orientation(5));
    advance(200);
    expect(triggers.feed(0, orientation(31))).toHaveLength(1);
  });

  test('a harder crossing sends a harder velocity, capped at the maximum', () => {
    const { triggers, at } = createHarness();
    const soft = triggers.feed(0, orientation(31))[0].velocity;

    at(10000);
    const hard = triggers.feed(1, orientation(90))[0].velocity;
    at(20000);
    const absurd = triggers.feed(2, orientation(1e6))[0].velocity;

    expect(hard).toBeGreaterThan(soft);
    expect(absurd).toBe(127);
  });

  test('a negative value trips the same gesture', () => {
    const { triggers } = createHarness();
    expect(triggers.feed(0, orientation(-31))).toHaveLength(1);
  });

  test('each gesture reads only its own source and axis', () => {
    const { triggers } = createHarness();
    expect(triggers.feed(0, gyro(200))[0].gesture).toBe('rotation');
    expect(triggers.feed(1, orientation(90))[0].gesture).toBe('tilt');
    // gyro.a is not wired to anything yet: no event, no throw.
    expect(triggers.feed(2, { accel: { x: 0, y: 0, z: 9.8 }, gyro: { a: 900, b: 0, g: 0 }, orientation: { a: 0, b: 0, g: 0 } })).toEqual([]);
  });

  test('phones are independent', () => {
    const { triggers } = createHarness();
    expect(triggers.feed(0, orientation(60))).toHaveLength(1);
    expect(triggers.feed(1, orientation(60))).toHaveLength(1);
  });

  test('reset clears one phone without touching the others', () => {
    const { triggers, advance } = createHarness();
    triggers.feed(0, orientation(60));
    triggers.feed(1, orientation(60));
    advance(500);

    triggers.reset(0);

    expect(triggers.feed(0, orientation(60))).toHaveLength(1);
    expect(triggers.feed(1, orientation(60))).toEqual([]);
  });

  test('span sets how far past the threshold a full-force hit is', () => {
    let now = 1000;
    const triggers = createGestureTriggers({
      now: () => now,
      gestures: {
        tilt: { source: 'orientation', axis: 'b', onThreshold: 30, offThreshold: 20, span: 90, minVelocity: 40, maxVelocity: 127 },
      },
    });

    const soft = triggers.feed(0, orientation(31))[0].velocity;
    now += 1000;
    const medium = triggers.feed(1, orientation(90))[0].velocity;
    now += 1000;
    const hard = triggers.feed(2, orientation(120))[0].velocity;

    expect(soft).toBeLessThan(medium);
    expect(medium).toBeLessThan(127);
    expect(hard).toBe(127);
  });

  test('configure adopts the score and forgets the old latches', () => {
    const { triggers } = createHarness();
    expect(triggers.feed(0, orientation(60))).toHaveLength(1);

    triggers.configure({ gestures: { tilt: { onThreshold: 200, offThreshold: 150, span: 90 } } });

    expect(triggers.gestures).toEqual(['tilt']);
    expect(triggers.feed(0, orientation(60))).toEqual([]);

    triggers.configure({ gestures: { tilt: { onThreshold: 30, offThreshold: 20, span: 90 } } });
    expect(triggers.feed(0, orientation(60))).toHaveLength(1);
  });

  test('malformed frames are ignored, never fatal', () => {
    const { triggers } = createHarness();
    expect(() => triggers.feed(0, null)).not.toThrow();
    expect(() => triggers.feed(0, {})).not.toThrow();
    expect(() => triggers.feed(0, { orientation: { b: 'hot' } })).not.toThrow();
    expect(() => triggers.feed(undefined, orientation(60))).not.toThrow();
    expect(triggers.feed(0, null)).toEqual([]);
  });
});
