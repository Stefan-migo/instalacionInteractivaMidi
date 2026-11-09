// A fast heartbeat, so the sweep runs several times inside one test.
process.env.HEARTBEAT_MS = '50';

const WebSocket = require('ws');
const http = require('http');

const PORT = 8123;

describe('bridge liveness and instance report', () => {
  let server;

  beforeAll((done) => {
    server = require('../bridge/index');
    server.listen(PORT, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  function get(pathname) {
    return new Promise((resolve, reject) => {
      http.get({ host: 'localhost', port: PORT, path: pathname }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', reject);
    });
  }

  test('a healthy phone is not killed by its own heartbeat', async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    ws.send(JSON.stringify({ type: 'register', role: 'phone' }));

    // More than five sweeps: a client that answers pings must survive them all.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(ws.readyState).toBe(1);

    // And it is still able to work: the socket is not half-dead.
    const stillWorks = await new Promise((resolve) => {
      ws.send(JSON.stringify({
        type: 'sensor',
        accel: { x: 0, y: 0, z: 9.8 },
        gyro: { a: 0, b: 0, g: 0 },
        orientation: { a: 0, b: 0, g: 0 },
      }));
      setTimeout(() => resolve(ws.readyState === 1), 100);
    });

    expect(stillWorks).toBe(true);
    ws.close();
  });

  test('/health tells an operator which instance is answering', async () => {
    const res = await get('/health');
    const body = JSON.parse(res.body);

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.pid).toBe(process.pid);
    expect(typeof body.startedAt).toBe('string');
    expect(typeof body.clients).toBe('number');
    expect(typeof body.agents).toBe('number');
  });
});
