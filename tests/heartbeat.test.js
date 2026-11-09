const { sweepClients, startHeartbeat } = require('../bridge/heartbeat');

function fakeClient(alive = true) {
  return {
    isAlive: alive,
    pinged: 0,
    terminated: 0,
    ping() { this.pinged += 1; },
    terminate() { this.terminated += 1; },
  };
}

describe('heartbeat', () => {
  test('a client that answered is pinged and marked suspect', () => {
    const client = fakeClient(true);
    const result = sweepClients([client]);

    expect(client.pinged).toBe(1);
    expect(client.terminated).toBe(0);
    expect(client.isAlive).toBe(false);
    expect(result).toEqual({ pinged: 1, terminated: 0 });
  });

  test('a client that never answered is dropped instead of leaking a socket', () => {
    const client = fakeClient(false);
    const result = sweepClients([client]);

    expect(client.terminated).toBe(1);
    expect(client.pinged).toBe(0);
    expect(result).toEqual({ pinged: 0, terminated: 1 });
  });

  test('a pong makes the client alive again for the next sweep', () => {
    const client = fakeClient(true);
    sweepClients([client]);
    client.isAlive = true; // the pong arrived
    sweepClients([client]);

    expect(client.pinged).toBe(2);
    expect(client.terminated).toBe(0);
  });

  test('a closing socket is not pinged again', () => {
    const client = fakeClient(true);
    client.readyState = 3;
    sweepClients([client]);
    expect(client.pinged).toBe(0);
    expect(client.terminated).toBe(0);
  });

  test('a ping that throws does not take the sweep down', () => {
    const broken = { isAlive: true, readyState: 1, ping() { throw new Error('gone'); }, terminate() {} };
    const healthy = fakeClient(true);

    expect(() => sweepClients([broken, healthy])).not.toThrow();
    expect(healthy.pinged).toBe(1);
  });

  test('startHeartbeat sweeps on its own timer and can be stopped', () => {
    const clients = new Set([fakeClient(true)]);
    const timers = [];
    const heartbeat = startHeartbeat({
      clients,
      intervalMs: 30000,
      setTimer: (fn, ms) => { const entry = { fn, ms, cleared: false }; timers.push(entry); return entry; },
      clearTimer: (entry) => { entry.cleared = true; },
    });

    expect(timers[0].ms).toBe(30000);
    timers[0].fn();
    expect(clients.size).toBe(1);
    expect([...clients][0].pinged).toBe(1);

    heartbeat.stop();
    expect(timers[0].cleared).toBe(true);
  });
});
