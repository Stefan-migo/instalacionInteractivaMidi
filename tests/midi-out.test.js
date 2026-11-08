const { createMidiOut, DEFAULT_PORT_NAME } = require('../bridge/midi-out');

// Fake sink: same surface @julusian/midi exposes on an Output instance.
function fakeMidi(portNames) {
  const sent = [];
  const opened = [];
  let closeCount = 0;

  class Output {
    getPortCount() {
      return portNames.length;
    }
    getPortName(index) {
      return portNames[index];
    }
    openPort(index) {
      opened.push(index);
    }
    sendMessage(message) {
      sent.push(message);
    }
    closePort() {
      closeCount += 1;
    }
  }

  return { midiModule: { Output }, sent, opened, closeCount: () => closeCount };
}

describe('midi-out', () => {
  test('the port name is a contract, not a convenience', () => {
    expect(DEFAULT_PORT_NAME).toBe('Collage-MIDI');
  });

  test('degrades silently when the native module is unavailable', () => {
    const out = createMidiOut({ midiModule: null, log: () => {} });

    expect(out.isAvailable()).toBe(false);
    expect(out.reason).toBe('no-module');
    expect(out.sendCC(1, 21, 100)).toBe(false);
    expect(out.sendNoteOn(10, 36, 100)).toBe(false);
  });

  test('degrades silently when the port does not exist', () => {
    const { midiModule, opened } = fakeMidi(['Microsoft GS Wavetable Synth']);
    const out = createMidiOut({ midiModule, log: () => {} });

    expect(out.isAvailable()).toBe(false);
    expect(out.reason).toBe('no-port');
    expect(opened).toEqual([]);
    expect(out.sendCC(1, 21, 100)).toBe(false);
  });

  test('matches the port name exactly, not loosely', () => {
    const { midiModule } = fakeMidi(['Collage-MIDI ', 'collagemidi']);
    const out = createMidiOut({ midiModule, log: () => {} });

    expect(out.isAvailable()).toBe(false);
    expect(out.reason).toBe('no-port');
  });

  test('opens the port named Collage-MIDI', () => {
    const fake = fakeMidi(['Microsoft GS Wavetable Synth', 'Collage-MIDI']);
    const out = createMidiOut({ midiModule: fake.midiModule, log: () => {} });

    expect(out.isAvailable()).toBe(true);
    expect(out.reason).toBe(null);
    expect(fake.opened).toEqual([1]);
  });

  test('sends CC on the requested channel', () => {
    const fake = fakeMidi(['Collage-MIDI']);
    const out = createMidiOut({ midiModule: fake.midiModule, log: () => {} });

    expect(out.sendCC(1, 21, 100)).toBe(true);
    expect(out.sendCC(6, 21, 0)).toBe(true);
    expect(fake.sent).toEqual([
      [0xb0, 21, 100],
      [0xb5, 21, 0],
    ]);
  });

  test('clamps and rounds CC values into 7 bits', () => {
    const fake = fakeMidi(['Collage-MIDI']);
    const out = createMidiOut({ midiModule: fake.midiModule, log: () => {} });

    out.sendCC(1, 21, 999);
    out.sendCC(1, 21, -5);
    out.sendCC(1, 21, 63.6);

    expect(fake.sent).toEqual([
      [0xb0, 21, 127],
      [0xb0, 21, 0],
      [0xb0, 21, 64],
    ]);
  });

  test('fires notes on the fire channel', () => {
    const fake = fakeMidi(['Collage-MIDI']);
    const out = createMidiOut({ midiModule: fake.midiModule, log: () => {} });

    expect(out.sendNoteOn(10, 36, 100)).toBe(true);
    expect(out.sendNoteOff(10, 36)).toBe(true);
    expect(fake.sent).toEqual([
      [0x99, 36, 100],
      [0x89, 36, 0],
    ]);
  });

  test('drops an out-of-range channel instead of sending garbage', () => {
    const fake = fakeMidi(['Collage-MIDI']);
    const out = createMidiOut({ midiModule: fake.midiModule, log: () => {} });

    expect(out.sendCC(0, 21, 100)).toBe(false);
    expect(out.sendCC(17, 21, 100)).toBe(false);
    expect(fake.sent).toEqual([]);
  });

  test('survives a port that disappears mid-show', () => {
    const fake = fakeMidi(['Collage-MIDI']);
    const out = createMidiOut({ midiModule: fake.midiModule, log: () => {} });

    const originalSend = fake.midiModule.Output.prototype.sendMessage;
    fake.midiModule.Output.prototype.sendMessage = () => {
      throw new Error('port closed');
    };

    expect(() => out.sendCC(1, 21, 100)).not.toThrow();
    expect(out.sendCC(1, 21, 100)).toBe(false);

    fake.midiModule.Output.prototype.sendMessage = originalSend;
  });

  test('closes safely, and repeatedly, even when unavailable', () => {
    const missing = createMidiOut({ midiModule: null, log: () => {} });
    expect(() => missing.close()).not.toThrow();
    expect(() => missing.close()).not.toThrow();

    const fake = fakeMidi(['Collage-MIDI']);
    const out = createMidiOut({ midiModule: fake.midiModule, log: () => {} });
    out.close();
    out.close();

    expect(fake.closeCount()).toBe(1);
    expect(out.isAvailable()).toBe(false);
  });
});
