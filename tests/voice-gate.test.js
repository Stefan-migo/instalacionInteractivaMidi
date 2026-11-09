const { createVoiceGate } = require('../bridge/voice-gate');

describe('voice gate', () => {
  test('ten phones of a group make one voice, with the hardest velocity', () => {
    const gate = createVoiceGate();
    for (let i = 0; i < 10; i += 1) gate.add(1, 'tilt', 40 + i);

    expect(gate.flush()).toEqual([{ group: 1, gesture: 'tilt', velocity: 49 }]);
  });

  test('different gestures and groups stay separate voices', () => {
    const gate = createVoiceGate();
    gate.add(1, 'tilt', 50);
    gate.add(1, 'rotation', 60);
    gate.add(2, 'tilt', 70);

    expect(gate.flush()).toHaveLength(3);
  });

  test('flush empties the gate', () => {
    const gate = createVoiceGate();
    gate.add(1, 'tilt', 50);
    gate.flush();

    expect(gate.flush()).toEqual([]);
    expect(gate.size()).toBe(0);
  });

  test('nonsense is refused instead of queued', () => {
    const gate = createVoiceGate();
    expect(gate.add(0, 'tilt', 50)).toBe(false);
    expect(gate.add(1, '', 50)).toBe(false);
    expect(gate.add(1, 'tilt', NaN)).toBe(false);
    expect(gate.flush()).toEqual([]);
  });
});
