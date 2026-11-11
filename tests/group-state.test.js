const {
  groupForSlot,
  groupForOrdinal,
  aggregate,
  createGroupAggregator,
  touchPositionToCc,
  touchScaleToCc,
  touchRotationToCc,
  decayPosition,
} = require('../bridge/group-state');

describe('group state', () => {
  test('maps 1-based connection ordinals round-robin and rejects invalid inputs', () => {
    expect(Array.from({ length: 10 }, (_, index) => groupForOrdinal(index + 1, 10)))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(groupForOrdinal(11, 10)).toBe(1);
    expect(groupForOrdinal(12, 10)).toBe(2);
    for (const ordinal of [0, -1, 1.5]) expect(groupForOrdinal(ordinal, 10)).toBeNull();
    for (const count of [0, -1, 1.5]) expect(groupForOrdinal(1, count)).toBeNull();
  });

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
    state.push(9, 90, 1000);
    state.push(1, 10, 1000);
    expect(state.snapshot({ now: 1000 })[0]).toEqual({
      group: 1,
      value: 10,
      lanes: { position: 10, scale: null, rotation: null },
      phones: 2,
    });
  });

  test('injected connection groups aggregate across slots and reject null groups', () => {
    const groups = new Map([[0, 4], [29, 4], [5, null]]);
    const state = createGroupAggregator({
      groupCount: 10,
      slotsPerGroup: 3,
      resolveGroup: slot => groups.get(slot),
    });
    expect(state.pushLane(0, 'scale', 20, 1000)).toBe(true);
    expect(state.pushLane(29, 'scale', 80, 1000)).toBe(true);
    expect(state.pushLane(5, 'scale', 50, 1000)).toBe(false);
    expect(state.snapshot({ now: 1000 })[3]).toMatchObject({
      group: 4, lanes: { scale: 50 }, phones: 2,
    });
  });

  test('move preserves the sample group and lane values across slots', () => {
    const state = createGroupAggregator({
      groupCount: 10,
      resolveGroup: slot => slot === 0 || slot === 29 ? 7 : null,
    });
    state.pushLane(0, 'scale', 82, 1000);
    state.pushLane(0, 'rotation', 31, 2000);
    expect(state.move(0, 29)).toBe(true);
    expect(state.move(4, 29)).toBe(false);
    expect(state.snapshot({ now: 2000 })[6]).toMatchObject({
      group: 7, lanes: { scale: 82, rotation: 31 }, phones: 1,
    });
    expect(state.snapshot({ now: 2000 }).flatMap(group => group.phones ? [group.group] : []))
      .toEqual([7]);
  });

  test('drop removes a phone contribution', () => {
    const state = createGroupAggregator();
    state.push(0, 50, 1000);
    state.drop(0);
    expect(state.snapshot({ now: 1000 })[0]).toEqual({
      group: 1,
      value: null,
      lanes: { position: null, scale: null, rotation: null },
      phones: 0,
    });
  });

});

describe('touch lanes', () => {
  test('the scale slider range maps onto the whole MIDI range', () => {
    expect(touchScaleToCc(40)).toBe(0);
    expect(touchScaleToCc(100)).toBe(54);
    expect(touchScaleToCc(180)).toBe(127);
  });

  test('a scale outside the slider range is clamped rather than dropped', () => {
    expect(touchScaleToCc(10)).toBe(0);
    expect(touchScaleToCc(400)).toBe(127);
  });

  test('a scale that is not a number yields no value at all', () => {
    expect(touchScaleToCc(NaN)).toBeNull();
    expect(touchScaleToCc('100')).toBeNull();
    expect(touchScaleToCc(undefined)).toBeNull();
  });

  test('rotation maps -180..180 onto 0..127 with rest in the middle', () => {
    expect(touchRotationToCc(-180)).toBe(0);
    expect(touchRotationToCc(0)).toBe(64);
    expect(touchRotationToCc(180)).toBe(127);
  });

  test('rotation beyond a half turn is clamped to the ends', () => {
    expect(touchRotationToCc(-400)).toBe(0);
    expect(touchRotationToCc(400)).toBe(127);
    expect(touchRotationToCc(NaN)).toBeNull();
  });

  test('position grows with finger speed and saturates at the top', () => {
    expect(touchPositionToCc(0, 0)).toBe(0);
    expect(touchPositionToCc(3, 4)).toBe(10);
    expect(touchPositionToCc(1000, 0)).toBe(127);
  });

  test('a broken position frame produces rest instead of NaN', () => {
    expect(touchPositionToCc(NaN, 5)).toBe(0);
    expect(touchPositionToCc(5, undefined)).toBe(0);
  });

  test('position decays with a half life and lands on rest', () => {
    expect(decayPosition(100, 0)).toBe(100);
    expect(decayPosition(100, 350)).toBe(50);
    expect(decayPosition(100, 700)).toBe(25);
    expect(decayPosition(100, 5000)).toBe(0);
  });

  test('averages each lane across the phones of a group', () => {
    const state = createGroupAggregator();
    state.pushLane(0, 'scale', 0, 1000);
    state.pushLane(1, 'scale', 60, 1000);
    state.pushLane(2, 'scale', 120, 1000);

    const [group] = state.snapshot({ now: 1000 });
    expect(group.lanes.scale).toBe(60);
    expect(group.phones).toBe(3);
  });

  test('a lane nobody touched stays null instead of inventing a value', () => {
    const state = createGroupAggregator();
    state.pushLane(0, 'scale', 54, 1000);

    const [group] = state.snapshot({ now: 1000 });
    expect(group.lanes.scale).toBe(54);
    expect(group.lanes.position).toBeNull();
    expect(group.lanes.rotation).toBeNull();
  });

  test('the position lane decays in the snapshot while the phone stops moving', () => {
    const state = createGroupAggregator();
    state.pushLane(0, 'position', 127, 1000);

    expect(state.snapshot({ now: 1000 })[0].lanes.position).toBe(127);
    expect(state.snapshot({ now: 1350 })[0].lanes.position).toBe(64);
    expect(state.snapshot({ now: 3000 })[0].lanes.position).toBe(0);
  });

  test('scale and rotation hold while the finger is off the pad', () => {
    const state = createGroupAggregator();
    state.pushLane(0, 'scale', 54, 1000);
    state.pushLane(0, 'rotation', 64, 1000);

    const [group] = state.snapshot({ now: 9000 });
    expect(group.lanes.scale).toBe(54);
    expect(group.lanes.rotation).toBe(64);
  });

  test('push is the legacy alias for the position lane', () => {
    const state = createGroupAggregator();
    state.push(0, 90, 1000);

    const [group] = state.snapshot({ now: 1000 });
    expect(group.lanes.position).toBe(90);
    expect(group.value).toBe(90);
  });

  test('an unknown lane name is refused instead of stored', () => {
    const state = createGroupAggregator();
    expect(state.pushLane(0, 'opacity', 40, 1000)).toBe(false);
    expect(state.snapshot({ now: 1000 })[0].lanes.position).toBeNull();
  });
});
