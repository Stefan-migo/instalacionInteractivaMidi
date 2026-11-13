const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const BASE_DIR = path.join(__dirname, '..');
const { checkAuthoring, TOKEN_HEADER } = require('../bridge/authoring-guard');

describe('authoring gate', () => {
  const enabled = (extra) => Object.assign({ AUTHORING_WRITES_ENABLED: 'true' }, extra);

  test('the master switch wins over a valid token', () => {
    expect(checkAuthoring({}, { [TOKEN_HEADER]: 's3cret' })).toEqual({ ok: false, status: 403, reason: 'disabled' });
    expect(checkAuthoring({ AUTHORING_WRITES_ENABLED: 'false' }, {})).toEqual({ ok: false, status: 403, reason: 'disabled' });
  });

  test('without a configured token the local workflow stays open', () => {
    expect(checkAuthoring(enabled(), {})).toEqual({ ok: true });
    expect(checkAuthoring(enabled(), { [TOKEN_HEADER]: 'anything' })).toEqual({ ok: true });
  });

  test('a configured token is required, matched exactly and read case-insensitively', () => {
    expect(checkAuthoring(enabled({ AUTHORING_TOKEN: 's3cret' }), {})).toEqual({ ok: false, status: 401, reason: 'token' });
    expect(checkAuthoring(enabled({ AUTHORING_TOKEN: 's3cret' }), { [TOKEN_HEADER]: 'wrong-value' })).toEqual({ ok: false, status: 401, reason: 'token' });
    expect(checkAuthoring(enabled({ AUTHORING_TOKEN: 's3cret' }), { [TOKEN_HEADER]: 's3cret-' })).toEqual({ ok: false, status: 401, reason: 'token' });
    expect(checkAuthoring(enabled({ AUTHORING_TOKEN: 's3cret' }), { 'X-Operator-Token': 's3cret' })).toEqual({ ok: true });
  });
});

describe('authoring routes behind the token', () => {
  let server;
  let tempDir;
  let sizesPath;
  let deckPath;
  const port = 8143;
  const base = `http://127.0.0.1:${port}`;
  const token = 'operator-token-for-tests';

  const manifest = () => JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'images/manifest.json'), 'utf8'));
  const readSizes = () => JSON.parse(fs.readFileSync(sizesPath, 'utf8'));

  function request(method, route, body, headers) {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? null : JSON.stringify(body);
      const req = http.request(`${base}${route}`, {
        method,
        headers: Object.assign(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}, headers || {}),
      }, res => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authoring-token-'));
    sizesPath = path.join(tempDir, 'sizes.json');
    deckPath = path.join(tempDir, 'deck.json');
    fs.writeFileSync(sizesPath, JSON.stringify({ version: 1, classes: { S: 0.015, M: 0.03, L: 0.06, XL: 0.1 }, assignments: {} }, null, 2));
    fs.writeFileSync(deckPath, JSON.stringify({ version: 1, excluded: [] }, null, 2));
    process.env.SIZES_PATH = sizesPath;
    process.env.DECK_PATH = deckPath;
    process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');
    process.env.AUTHORING_WRITES_ENABLED = 'true';
    process.env.AUTHORING_TOKEN = token;
    jest.resetModules();
    server = require('../bridge/index');
    await new Promise(resolve => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    delete process.env.SIZES_PATH;
    delete process.env.DECK_PATH;
    delete process.env.IMAGES_DIR;
    delete process.env.AUTHORING_WRITES_ENABLED;
    delete process.env.AUTHORING_TOKEN;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('a write without the token is refused and leaves the file untouched', async () => {
    const before = fs.readFileSync(sizesPath, 'utf8');
    const response = await request('POST', '/api/sizes', readSizes());
    expect(response.status).toBe(401);
    expect(JSON.parse(response.body).error).toMatch(/token/i);
    expect(fs.readFileSync(sizesPath, 'utf8')).toBe(before);
  });

  test('a write with a wrong token is refused and leaves the file untouched', async () => {
    const before = fs.readFileSync(sizesPath, 'utf8');
    const response = await request('POST', '/api/sizes', readSizes(), { [TOKEN_HEADER]: 'nope' });
    expect(response.status).toBe(401);
    expect(fs.readFileSync(sizesPath, 'utf8')).toBe(before);
  });

  test('the deck route is behind the same token', async () => {
    const first = Object.keys(manifest())[0];
    const refused = await request('POST', '/api/deck', { version: 1, excluded: [first] });
    expect(refused.status).toBe(401);
    expect(JSON.parse(fs.readFileSync(deckPath, 'utf8')).excluded).toEqual([]);
    const saved = await request('POST', '/api/deck', { version: 1, excluded: [first] }, { [TOKEN_HEADER]: token });
    expect(saved.status).toBe(200);
    expect(JSON.parse(fs.readFileSync(deckPath, 'utf8')).excluded).toEqual([first]);
  });

  test('the token unlocks a real save', async () => {
    const first = Object.keys(manifest())[0];
    const payload = Object.assign(readSizes(), { assignments: { [first]: 'XL' } });
    const saved = await request('POST', '/api/sizes', payload, { [TOKEN_HEADER]: token });
    expect(saved.status).toBe(200);
    expect(readSizes().assignments).toEqual({ [first]: 'XL' });
    expect((await request('GET', '/api/sizes')).status).toBe(200);
  });
});
