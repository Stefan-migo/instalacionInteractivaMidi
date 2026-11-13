const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const BASE_DIR = path.join(__dirname, '..');

describe('deck routes', () => {
  let server;
  let tempDir;
  let deckPath;
  const port = 8139;
  const base = `http://127.0.0.1:${port}`;

  const manifestKeys = () => Object.keys(JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'images/manifest.json'), 'utf8')));

  function request(method, body) {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? null : JSON.stringify(body);
      const req = http.request(`${base}/api/deck`, {
        method,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-routes-'));
    deckPath = path.join(tempDir, 'deck.json');
    fs.writeFileSync(deckPath, JSON.stringify({ version: 1, excluded: [] }));
    process.env.DECK_PATH = deckPath;
    process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');
    process.env.AUTHORING_WRITES_ENABLED = 'true';
    jest.resetModules();
    server = require('../bridge/index');
    await new Promise(resolve => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    delete process.env.DECK_PATH;
    delete process.env.IMAGES_DIR;
    delete process.env.AUTHORING_WRITES_ENABLED;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // The writer once appended a literal backslash-n instead of a newline, and
  // POST answered 200 because it never re-read what it wrote. Only parsing the
  // file and reading it back catches that, so this test does both.
  test('a saved exclusion round-trips through GET and leaves parseable JSON on disk', async () => {
    const first = manifestKeys()[0];

    const saved = await request('POST', { version: 1, excluded: [first] });
    expect(saved.status).toBe(200);

    expect(JSON.parse(fs.readFileSync(deckPath, 'utf8')).excluded).toEqual([first]);

    const read = await request('GET');
    expect(read.status).toBe(200);
    expect(JSON.parse(read.body).excluded).toEqual([first]);
  });

  test('rejections leave the stored bytes untouched', async () => {
    const before = fs.readFileSync(deckPath);

    const unknown = await request('POST', { version: 1, excluded: ['999999'] });
    expect(unknown.status).toBe(400);
    expect(fs.readFileSync(deckPath)).toEqual(before);

    const duplicate = await request('POST', { version: 1, excluded: [manifestKeys()[0], manifestKeys()[0]] });
    expect(duplicate.status).toBe(400);
    expect(fs.readFileSync(deckPath)).toEqual(before);
  });
});
