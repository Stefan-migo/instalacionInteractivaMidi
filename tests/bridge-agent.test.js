const WebSocket = require('ws');

const PORT = 8101;
describe('bridge agent WebSocket', () => {
  let server;
  beforeAll(done => {
    server = require('../bridge/index');
    server.listen(PORT, done);
  });
  const openSockets = [];
  afterAll(done => {
    // Terminate first: a failed assertion must never leave a socket holding
    // server.close() open, which is how a suite hangs instead of failing.
    for (const ws of openSockets) { try { ws.terminate(); } catch (e) {} }
    server.close(done);
  });

  function connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${PORT}`);
      ws.inbox = [];
      ws.waiters = [];
      ws.on('message', data => {
        const msg = JSON.parse(data.toString());
        const index = ws.waiters.findIndex(waiter => waiter.predicate(msg));
        if (index !== -1) {
          const [waiter] = ws.waiters.splice(index, 1);
          clearTimeout(waiter.timer);
          waiter.resolve(msg);
          return;
        }
        ws.inbox.push(msg);
      });
      ws.once('open', () => { openSockets.push(ws); resolve(ws); });
      ws.once('error', reject);
    });
  }

  // Queue-based: a frame that arrives before next() is awaited is kept, not lost.
  function next(ws, predicate = () => true) {
    const index = ws.inbox.findIndex(msg => predicate(msg));
    if (index !== -1) {
      const [msg] = ws.inbox.splice(index, 1);
      return Promise.resolve(msg);
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        timer: setTimeout(() => {
          ws.waiters = ws.waiters.filter(w => w !== waiter);
          reject(new Error('message timeout'));
        }, 1500),
      };
      ws.waiters.push(waiter);
    });
  }
  const sensor = { type: 'sensor', accel: { x: 1, y: 2, z: 3 }, gyro: { a: 1, b: 2, g: 3 }, orientation: { a: 1, b: 2, g: 3 } };

  test('registers an agent and applies valid config while ignoring invalid entries', async () => {
    const agent = await connect();
    agent.send(JSON.stringify({ type: 'register', role: 'agent' }));
    expect(await next(agent, m => m.event === 'agent-ready')).toMatchObject({ type: 'system', event: 'agent-ready' });
    expect((await next(agent, m => m.type === 'music-config')).groups).toHaveLength(10);
    agent.send(JSON.stringify({ type: 'music-config', groups: [{ group: 1, mode: 'max' }, { group: 11, mode: 'average' }, { group: 2, mode: 'token' }] }));
    expect(await next(agent, m => m.type === 'music-config-applied')).toEqual({ type: 'music-config-applied', groups: [{ group: 1, mode: 'max' }] });
    agent.close();
  });

  test('a phone that reconnects keeps its own slot, so it keeps its group', async () => {
    const first = await connect();
    first.send(JSON.stringify({ type: 'register', role: 'phone', deviceId: 'device-aaa' }));
    const assigned = await next(first, m => m.type === 'assigned');
    first.close();

    // The slot is in cooldown for everybody else, reserved for this device.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const again = await connect();
    again.send(JSON.stringify({ type: 'register', role: 'phone', deviceId: 'device-aaa' }));
    const reassigned = await next(again, m => m.type === 'assigned');
    expect(reassigned.slot).toBe(assigned.slot);

    // A different phone still gets a slot of its own.
    const stranger = await connect();
    stranger.send(JSON.stringify({ type: 'register', role: 'phone', deviceId: 'device-bbb' }));
    const other = await next(stranger, m => m.type === 'assigned');
    expect(other.slot).not.toBe(assigned.slot);

    again.close();
    stranger.close();
  });

  test('fans out ten group frames and removes disconnected phones', async () => {
    const agent = await connect();
    agent.send(JSON.stringify({ type: 'register', role: 'agent' }));
    await next(agent, m => m.event === 'agent-ready');
    await next(agent, m => m.type === 'music-config');
    const phone = await connect();
    phone.send(JSON.stringify({ type: 'register', role: 'phone' }));
    const assigned = await next(phone, m => m.type === 'assigned');
    phone.send(JSON.stringify(sensor));
    const frame = await next(agent, m => m.type === 'music-state' && m.groups.some(g => g.phones > 0));
    expect(frame.groups).toHaveLength(10);
    expect(frame.groups.find(g => g.group === Math.floor(assigned.slot / 3) + 1).phones).toBe(1);
    phone.close();
    const dropped = await next(agent, m => m.type === 'music-state' && m.groups.every(g => g.phones === 0));
    expect(dropped.groups).toHaveLength(10);
    agent.close();
  });

  test('a tilt past the threshold becomes one voice for its group', async () => {
    const agent = await connect();
    agent.send(JSON.stringify({ type: 'register', role: 'agent' }));
    await next(agent, m => m.event === 'agent-ready');
    await next(agent, m => m.type === 'music-config');

    const phone = await connect();
    phone.send(JSON.stringify({ type: 'register', role: 'phone' }));
    const assigned = await next(phone, m => m.type === 'assigned');
    const expectedGroup = Math.floor(assigned.slot / 10) + 1;

    // Two phones' worth of tilts inside one tick must collapse into one voice.
    for (let i = 0; i < 4; i += 1) {
      phone.send(JSON.stringify({
        type: 'sensor',
        accel: { x: 0, y: 0, z: 9.8 },
        gyro: { a: 0, b: 0, g: 0 },
        orientation: { a: 0, b: 60, g: 0 },
      }));
    }

    const gesture = await next(agent, m => m.type === 'music-gesture');
    expect(gesture.voices).toHaveLength(1);
    expect(gesture.voices[0]).toMatchObject({ group: expectedGroup, gesture: 'tilt' });
    expect(gesture.voices[0].velocity).toBeGreaterThanOrEqual(40);

    phone.close();
    agent.close();
  });

  test('the score can move a gesture threshold and the bridge obeys it', async () => {
    const agent = await connect();
    agent.send(JSON.stringify({ type: 'register', role: 'agent' }));
    await next(agent, m => m.event === 'agent-ready');
    await next(agent, m => m.type === 'music-config');

    agent.send(JSON.stringify({
      type: 'music-config',
      groups: [],
      derivation: { cooldownMs: 200, gestures: { tilt: { onThreshold: 200, offThreshold: 150, span: 90 } } },
    }));
    await next(agent, m => m.type === 'music-config-applied');

    const phone = await connect();
    phone.send(JSON.stringify({ type: 'register', role: 'phone' }));
    await next(phone, m => m.type === 'assigned');

    phone.send(JSON.stringify({
      type: 'sensor',
      accel: { x: 0, y: 0, z: 9.8 },
      gyro: { a: 0, b: 0, g: 0 },
      orientation: { a: 0, b: 60, g: 0 },
    }));

    // 60 degrees sits under the new 200 degree threshold: no voice at all.
    await expect(next(agent, m => m.type === 'music-gesture')).rejects.toThrow();

    // Put the shipped score back so the rest of the suite is unaffected.
    agent.send(JSON.stringify({
      type: 'music-config',
      groups: [],
      derivation: {
        gestures: {
          tilt: { onThreshold: 30, offThreshold: 20, span: 90 },
          rotation: { onThreshold: 120, offThreshold: 60, span: 240 },
        },
      },
    }));
    await next(agent, m => m.type === 'music-config-applied');

    phone.close();
    agent.close();
  });
});
