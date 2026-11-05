const http = require('http');
const path = require('path');
const WebSocket = require('ws');

// Keep the bridge's image directory off the production data: the repository carries no
// image content, and serving is what this suite verifies.
process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');

describe('Bridge', () => {
  let server;
  const PORT = 8099;
  const BASE = `http://localhost:${PORT}`;

  beforeAll((done) => {
    server = require('../bridge/index');
    server.listen(PORT, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  function get(path) {
    return new Promise((resolve, reject) => {
      http.get(`${BASE}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', reject);
    });
  }

  describe('HTTP', () => {
    test('GET /health returns 200 with ok status', async () => {
      const res = await get('/health');
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
    });

    test('GET /api/layout returns JSON', async () => {
      const res = await get('/api/layout');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('json');
      const body = JSON.parse(res.body);
      expect(body.canvas).toBeDefined();
      expect(body.cells).toBeInstanceOf(Array);
    });

    test('GET /images/content/sample.png returns image', async () => {
      const res = await get('/images/content/sample.png');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image');
    });

    test('GET /images/content/missing.png returns 404', async () => {
      const res = await get('/images/content/missing.png');
      expect(res.status).toBe(404);
    });

    test('GET /nonexistent returns 404', async () => {
      const res = await get('/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('WebSocket', () => {
    function connectWs() {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${PORT}`);
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
      });
    }

    function waitForMessage(ws) {
      return new Promise((resolve) => {
        ws.once('message', (data) => resolve(JSON.parse(data.toString())));
      });
    }

    test('phone registration receives assigned slot', async () => {
      const phone = await connectWs();
      phone.send(JSON.stringify({ type: 'register', role: 'phone' }));
      const msg = await waitForMessage(phone);
      expect(msg.type).toBe('assigned');
      expect(typeof msg.slot).toBe('number');
      phone.close();
    });

    test('phone gesture message reaches player as gesture-event', async () => {
      const phone = await connectWs();
      phone.send(JSON.stringify({ type: 'register', role: 'phone' }));
      const assignMsg = await waitForMessage(phone);
      expect(assignMsg.type).toBe('assigned');

      const player = await connectWs();
      player.send(JSON.stringify({ type: 'register', role: 'player' }));
      // Give time for player to register
      await new Promise(r => setTimeout(r, 100));

      phone.send(JSON.stringify({ type: 'gesture', gesture: 'flick' }));
      const playerMsg = await waitForMessage(player);
      expect(playerMsg.type).toBe('gesture-event');
      expect(playerMsg.event).toBe('matched');
      expect(playerMsg.action).toBe('cycle-next');
      expect(playerMsg.slot).toBe(assignMsg.slot);

      phone.close();
      player.close();
    });

    test('player registration does not receive slot assignment', async () => {
      const player = await connectWs();
      player.send(JSON.stringify({ type: 'register', role: 'player' }));
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500));
      try {
        await Promise.race([waitForMessage(player), timeout]);
      } catch (e) {
        // expected — players don't get assigned
      }
      player.close();
    });
  });
});
