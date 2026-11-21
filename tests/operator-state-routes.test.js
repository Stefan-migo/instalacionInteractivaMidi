const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const BASE_DIR = path.join(__dirname, '..');

describe('operator state route', () => {
  let server;
  let tempDir;
  let statePath;
  const port = 8161;
  const base = `http://127.0.0.1:${port}`;
  const TOKEN = 'test-operator-token';
  const settled = {
    scatterScale: 1.3,
    noiseIntensity: 0.4,
    preset: 'spiral',
    cycleRunning: true,
    updatedAt: '2026-11-21T03:00:00.000Z',
  };

  function request(method, body, headers) {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? null : JSON.stringify(body);
      const requestHeaders = payload
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...(headers || {}) }
        : (headers || {});
      const req = http.request(`${base}/api/operator-state`, { method, headers: requestHeaders }, res => {
        let response = '';
        res.on('data', chunk => response += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: response }));
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'operator-state-'));
    statePath = path.join(tempDir, 'operator-state.json');
    process.env.OPERATOR_STATE_PATH = statePath;
    process.env.AUTHORING_WRITES_ENABLED = 'true';
    process.env.AUTHORING_TOKEN = TOKEN;
    jest.resetModules();
    server = require('../bridge/index');
    await new Promise(resolve => server.listen(port, resolve));
  });

  afterAll(done => {
    delete process.env.OPERATOR_STATE_PATH;
    delete process.env.AUTHORING_WRITES_ENABLED;
    delete process.env.AUTHORING_TOKEN;
    server.close(done);
  });

  test('reads an empty state when nothing was ever stored', async () => {
    const { status, body } = await request('GET');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ version: 1, state: null });
  });

  test('stores the tuning and reads the same values back', async () => {
    const written = await request('POST', { version: 1, state: settled }, { 'X-Operator-Token': TOKEN });
    expect(written.status).toBe(200);

    const { body } = await request('GET');
    const stored = JSON.parse(body);
    expect(stored.version).toBe(1);
    expect(stored.state.scatterScale).toBe(settled.scatterScale);
    expect(stored.state.noiseIntensity).toBe(settled.noiseIntensity);
    expect(stored.state.preset).toBe(settled.preset);
    expect(stored.state.cycleRunning).toBe(settled.cycleRunning);
  });

  // The write paths are public on the deployed bridge, so the token is the only
  // thing between a stranger and the wall's tuning.
  test('without the token the request is refused and nothing is written', async () => {
    const before = fs.readFileSync(statePath);
    const { status } = await request('POST', { version: 1, state: { ...settled, scatterScale: 0.5 } });
    expect(status).toBe(401);
    expect(fs.readFileSync(statePath)).toEqual(before);
  });

  test('an out-of-range value is rejected and leaves the stored bytes untouched', async () => {
    const before = fs.readFileSync(statePath);
    const { status } = await request(
      'POST',
      { version: 1, state: { ...settled, scatterScale: 1.81 } },
      { 'X-Operator-Token': TOKEN }
    );
    expect(status).toBe(400);
    expect(fs.readFileSync(statePath)).toEqual(before);
  });
});

describe('operator state wiring', () => {
  const read = file => fs.readFileSync(path.join(BASE_DIR, file), 'utf8');

  // The projector has to ask for the state and apply it through the module the
  // page loads: an inline copy silently drifted from the tested helper once.
  test('the projector loads the helper before the sketch and applies the state in setup', () => {
    const html = read('p5-collage/index.html');
    expect(html).toMatch(/<script src="\/p5-collage\/operator-state\.js"><\/script>/);
    expect(html.indexOf('operator-state.js')).toBeLessThan(html.indexOf('/p5-collage/sketch.js'));

    const sketch = read('p5-collage/sketch.js');
    expect(sketch).toContain("fetch('/api/operator-state')");
    expect(sketch).toMatch(/window\.OperatorState\.apply\(/);
  });
});
