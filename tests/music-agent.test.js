const { createMusicAgent, backoffDelay } = require('../music/agent');

// Fake WebSocket: enough surface for the agent, nothing more.
function createSocketFactory() {
  const sockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.readyState = 0;
      this.handlers = {};
      sockets.push(this);
    }
    on(event, handler) {
      this.handlers[event] = handler;
    }
    send(payload) {
      this.sent.push(JSON.parse(payload));
    }
    close() {
      this.readyState = 3;
    }
    // test helpers
    open() {
      this.readyState = 1;
      if (this.handlers.open) this.handlers.open();
    }
    emit(message) {
      if (this.handlers.message) this.handlers.message(Buffer.from(JSON.stringify(message)));
    }
    emitRaw(raw) {
      if (this.handlers.message) this.handlers.message(raw);
    }
    fail(error) {
      if (this.handlers.error) this.handlers.error(error);
    }
    serverClose() {
      this.readyState = 3;
      if (this.handlers.close) this.handlers.close();
    }
  }
  return { Impl: FakeWebSocket, sockets, last: () => sockets[sockets.length - 1] };
}

function createFakeScheduler() {
  const pending = [];
  return {
    pending,
    setTimeout(fn, delay) {
      const entry = { fn, delay, cleared: false };
      pending.push(entry);
      return entry;
    },
    clearTimeout(entry) {
      if (entry) entry.cleared = true;
    },
    runAll() {
      const due = pending.filter((entry) => !entry.cleared);
      for (const entry of due) entry.fn();
      return due;
    },
  };
}

function createFakeMidiOut() {
  const sent = [];
  return {
    sent,
    isAvailable: () => true,
    sendCC(channel, controller, value) {
      sent.push([channel, controller, value]);
      return true;
    },
    notes: [],
    sendNoteOn(channel, note, velocity) {
      this.notes.push(['on', channel, note, velocity]);
      return true;
    },
    sendNoteOff(channel, note) {
      this.notes.push(['off', channel, note]);
      return true;
    },
    close() {},
  };
}

function buildAgent(overrides = {}) {
  const sockets = createSocketFactory();
  const scheduler = createFakeScheduler();
  const midiOut = createFakeMidiOut();
  const agent = createMusicAgent({
    WebSocketImpl: sockets.Impl,
    midiOut,
    scheduler,
    log: () => {},
    ...overrides,
  });
  return { agent, sockets, scheduler, midiOut };
}

const STATE = {
  type: 'music-state',
  groups: [
    { group: 1, value: 57.4, phones: 3 },
    { group: 2, value: null, phones: 0 },
    { group: 3, value: 120, phones: 5 },
  ],
};

describe('backoffDelay', () => {
  test('doubles per attempt and caps', () => {
    expect(backoffDelay(0)).toBe(500);
    expect(backoffDelay(1)).toBe(500);
    expect(backoffDelay(2)).toBe(1000);
    expect(backoffDelay(3)).toBe(2000);
    expect(backoffDelay(10)).toBe(8000);
  });
});

describe('music agent', () => {
  test('registers as an agent when the socket opens', () => {
    const { agent, sockets } = buildAgent();
    agent.start();

    sockets.last().open();

    expect(sockets.last().url).toContain('ws://');
    expect(sockets.last().sent[0]).toEqual({ type: 'register', role: 'agent' });
  });

  test('answers the bridge config with the modes it wants', () => {
    const { agent, sockets } = buildAgent();
    agent.start();
    sockets.last().open();
    sockets.last().sent.length = 0;

    sockets.last().emit({ type: 'music-config', groups: [{ group: 1, mode: 'average' }] });

    expect(sockets.last().sent).toEqual([
      {
        type: 'music-config',
        groups: [
          { group: 1, mode: 'average' },
          { group: 2, mode: 'average' },
          { group: 3, mode: 'average' },
        ],
      },
    ]);
  });

  test('sends one CC per group on its own channel, rounding to 7 bits', () => {
    const { agent, sockets, midiOut } = buildAgent();
    agent.start();
    sockets.last().open();

    sockets.last().emit(STATE);

    expect(midiOut.sent).toEqual([
      [1, 21, 57],
      [2, 21, 64],
      [3, 21, 120],
    ]);
  });

  test('a silent group falls to the safe value once, not every frame', () => {
    const { agent, sockets, midiOut } = buildAgent();
    agent.start();
    sockets.last().open();

    sockets.last().emit(STATE);
    midiOut.sent.length = 0;
    sockets.last().emit(STATE);
    sockets.last().emit(STATE);

    expect(midiOut.sent).toEqual([]);
  });

  test('reconnecting is scheduled with backoff, and a clean open resets it', () => {
    const { agent, sockets, scheduler } = buildAgent();
    agent.start();
    sockets.last().open();

    sockets.last().serverClose();
    expect(scheduler.pending.map((entry) => entry.delay)).toEqual([500]);

    scheduler.runAll();
    sockets.last().open();
    expect(sockets.sockets).toHaveLength(2);

    sockets.last().serverClose();
    expect(scheduler.pending.map((entry) => entry.delay)).toEqual([500, 500]);
  });

  test('a failed connection also backs off instead of throwing', () => {
    const { agent, sockets, scheduler } = buildAgent();
    agent.start();

    expect(() => sockets.last().fail(new Error('ECONNREFUSED'))).not.toThrow();
    expect(scheduler.pending).toHaveLength(1);
    expect(agent.reconnects).toBe(1);
  });

  test('losing the bridge parks every group at the safe value', () => {
    const { agent, sockets, midiOut } = buildAgent();
    agent.start();
    sockets.last().open();
    sockets.last().emit(STATE);
    midiOut.sent.length = 0;

    sockets.last().serverClose();

    expect(midiOut.sent).toEqual([
      [1, 21, 64],
      [2, 21, 64],
      [3, 21, 64],
    ]);
  });

  test('garbage from the wire is ignored without throwing', () => {
    const { agent, sockets, midiOut } = buildAgent();
    agent.start();
    sockets.last().open();

    expect(() => sockets.last().emitRaw('not json')).not.toThrow();
    expect(() => sockets.last().emit({ type: 'music-state' })).not.toThrow();
    expect(() => sockets.last().emit({ type: 'music-state', groups: 'nope' })).not.toThrow();
    expect(() => sockets.last().emit({ type: 'music-state', groups: [{ group: 9, value: 3 }] })).not.toThrow();
    expect(() => sockets.last().emit(null)).not.toThrow();
    expect(midiOut.sent).toEqual([]);
  });

  test('a visual-only installation still connects and never throws', () => {
    const midiOut = { isAvailable: () => false, sendCC: () => false, close: () => {} };
    const { agent, sockets } = buildAgent({ midiOut, portName: 'Collage-MIDI' });
    agent.start();
    sockets.last().open();

    expect(() => sockets.last().emit(STATE)).not.toThrow();
    expect(agent.isMidiAvailable()).toBe(false);
  });

  test('stop() closes the socket and cancels the pending reconnect', () => {
    const { agent, sockets, scheduler } = buildAgent();
    agent.start();
    sockets.last().open();
    sockets.last().serverClose();
    const pending = scheduler.pending[0];

    agent.stop();

    expect(pending.cleared).toBe(true);
  });

  test('a gesture voice becomes a note on that group channel, then is released', () => {
    const { agent, sockets, midiOut, scheduler } = buildAgent();
    agent.start();
    sockets.last().open();

    sockets.last().emit({
      type: 'music-gesture',
      voices: [
        { group: 1, gesture: 'tilt', velocity: 90 },
        { group: 3, gesture: 'flick', velocity: 100 },
      ],
    });

    expect(midiOut.notes).toEqual([
      ['on', 1, 36, 90],
      ['on', 3, 37, 100],
    ]);

    scheduler.runAll();

    expect(midiOut.notes).toEqual([
      ['on', 1, 36, 90],
      ['on', 3, 37, 100],
      ['off', 1, 36],
      ['off', 3, 37],
    ]);
  });

  test('an unknown gesture is skipped instead of guessed', () => {
    const { agent, sockets, midiOut } = buildAgent();
    agent.start();
    sockets.last().open();

    expect(() => sockets.last().emit({
      type: 'music-gesture',
      voices: [{ group: 1, gesture: 'shrug', velocity: 80 }, { group: 0, gesture: 'tilt', velocity: 80 }],
    })).not.toThrow();
    expect(midiOut.notes).toEqual([]);
  });

  test('stop() releases a note that is still ringing', () => {
    const { agent, sockets, midiOut } = buildAgent();
    agent.start();
    sockets.last().open();
    sockets.last().emit({ type: 'music-gesture', voices: [{ group: 2, gesture: 'rotation', velocity: 70 }] });

    agent.stop();

    expect(midiOut.notes).toEqual([
      ['on', 2, 38, 70],
      ['off', 2, 38],
    ]);
  });

  test('the nine voices can be remapped without touching the code', () => {
    const { agent, sockets, midiOut } = buildAgent({ notes: { tilt: 60, flick: 61, rotation: 62 } });
    agent.start();
    sockets.last().open();

    sockets.last().emit({ type: 'music-gesture', voices: [{ group: 2, gesture: 'rotation', velocity: 55 }] });

    expect(midiOut.notes[0]).toEqual(['on', 2, 62, 55]);
  });
});
