const { groupForSlot, aggregate, sensorIntensity, createGroupAggregator } = require('../bridge/group-state');

describe('group state', () => {
  test('maps the zero-based first and last slots into three contiguous groups of ten', () => {
    expect(groupForSlot(0)).toBe(1);
    expect(groupForSlot(29)).toBe(3);
    const groups = [1, 2, 3].map(group =>
      Array.from({ length: 30 }, (_, slot) => slot).filter(slot => groupForSlot(slot) === group)
    );
    expect(groups.map(slots => slots.length)).toEqual([10, 10, 10]);
    expect(groups[0]).toEqual(Array.from({ length: 10 }, (_, i) => i));
    expect(groups[1]).toEqual(Array.from({ length: 10 }, (_, i) => i + 10));
    expect(groups[2]).toEqual(Array.from({ length: 10 }, (_, i) => i + 20));
    expect(groupForSlot(-1)).toBeNull();
    expect(groupForSlot(30)).toBeNull();
  });

  test('aggregates average and max and returns null for empty groups', () => {
    expect(aggregate('average', [2, 6])).toBe(4);
    expect(aggregate('max', [2, 6])).toBe(6);
    expect(aggregate('average', [])).toBeNull();
  });

  test('last follows push insertion order rather than slot order', () => {
    const state = createGroupAggregator({ modes: ['last'] });
    state.push(9, 90);
    state.push(1, 10);
    expect(state.snapshot()[0]).toEqual({ group: 1, value: 10, phones: 2 });
  });

  test('drop removes a phone contribution', () => {
    const state = createGroupAggregator();
    state.push(0, 50);
    state.drop(0);
    expect(state.snapshot()[0]).toEqual({ group: 1, value: null, phones: 0 });
  });

  test('sensor intensity is bounded and malformed frames safely produce zero', () => {
    expect(sensorIntensity({ accel: { x: 0, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 }, orientation: { a: 0, b: 0, g: 0 } })).toBeGreaterThanOrEqual(0);
    expect(sensorIntensity({ accel: { x: 1e9, y: 1e9, z: 1e9 }, gyro: { a: 1e9, b: 1e9, g: 1e9 }, orientation: { a: 1e9, b: 1e9, g: 1e9 } })).toBe(127);
    expect(sensorIntensity(null)).toBe(0);
  });
});
