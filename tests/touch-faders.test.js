'use strict';

// The routing faders are fed by the pad, not by the gyroscope (odd/tasks/touch-faders.md).
// Asserted through the agent stream, which is the public interface: the agent is
// the only consumer that sees what the bridge decided.

const WebSocket = require('ws');
const server = require('../bridge/index');

const PORT = 8115;
const BASE_URL = `ws://127.0.0.1:${PORT}`;

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE_URL);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function waitMessage(ws, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('message timeout')), timeoutMs);
    ws.on('message', function listener(data) {
      const message = JSON.parse(data.toString());
      if (!predicate(message)) return;
      clearTimeout(timer);
      ws.off('message', listener);
      resolve(message);
    });
  });
}

// The bridge broadcasts every 50ms; wait for the first frame that satisfies the
// assertion instead of sleeping a fixed amount.
function waitGroup(agent, group, predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  return (async function poll() {
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('group lane timeout');
      const message = await waitMessage(agent, m => m.type === 'music-state', remaining);
      const entry = message.groups.find(item => item.group === group);
      if (entry && predicate(entry)) return entry;
    }
  })();
}

describe('the pad drives the routing faders', () => {
  let agent;
  let phone;
  let group;
  const sockets = [];

  beforeAll(done => { server.listen(PORT, done); });

  afterAll(done => {
    while (sockets.length) sockets.pop().terminate();
    server.close(done);
  });

  async function open(role) {
    const socket = await connect();
    sockets.push(socket);
    socket.send(JSON.stringify({ type: 'register', role }));
    return socket;
  }

  test('a phone joins at rest and every pad parameter moves its lane', async () => {
    agent = await open('agent');
    await waitMessage(agent, m => m.type === 'music-config');

    phone = await open('phone');
    const assigned = await waitMessage(phone, m => m.type === 'assigned');
    group = Math.floor(assigned.slot / 3) + 1;

    const resting = await waitGroup(agent, group, entry => entry.lanes.scale !== null);
    expect(resting.lanes).toEqual({ position: 0, scale: 54, rotation: 64 });
    expect(resting.phones).toBe(1);

    phone.send(JSON.stringify({ type: 'action', action: 'scale', value: 180 }));
    const scaled = await waitGroup(agent, group, entry => entry.lanes.scale > 54);
    expect(scaled.lanes.scale).toBe(127);

    phone.send(JSON.stringify({ type: 'action', action: 'rotation', value: -180 }));
    const rotated = await waitGroup(agent, group, entry => entry.lanes.rotation < 64);
    expect(rotated.lanes.rotation).toBe(0);

    phone.send(JSON.stringify({ type: 'action', action: 'move', dx: 1000, dy: 0 }));
    const dragged = await waitGroup(agent, group, entry => entry.lanes.position > 0);
    expect(dragged.lanes.position).toBeGreaterThan(90);
  });

  test('the drag lane fades back to rest on its own', async () => {
    const settled = await waitGroup(agent, group, entry => entry.lanes.position === 0, 3000);
    expect(settled.lanes.position).toBe(0);
  });

  test('a phone that never touches still holds the group average', async () => {
    const second = await open('phone');
    await waitMessage(second, m => m.type === 'assigned');

    const joined = await waitGroup(agent, group, entry => entry.phones === 2);
    expect(joined.phones).toBe(2);

    // Put the first phone back on its resting values: with both phones resting,
    // the group average has to land exactly on rest again.
    phone.send(JSON.stringify({ type: 'action', action: 'scale', value: 100 }));
    phone.send(JSON.stringify({ type: 'action', action: 'rotation', value: 0 }));

    const settled = await waitGroup(agent, group, entry => entry.lanes.rotation === 64 && entry.lanes.scale === 54);
    expect(settled.lanes.scale).toBe(54);
    expect(settled.lanes.rotation).toBe(64);
  });
});
