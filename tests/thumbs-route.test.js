const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const FIXTURES = path.join(__dirname, 'fixtures', 'images');

// The operator grid loads /images/thumbs/<key>.webp, and the bridge used to
// serve only /images/content/. Both routes went through the same traversal
// guard, so this pins the thumbs prefix and proves the guard came with it.
describe('GET /images/thumbs', () => {
  let server;
  let tempDir;
  const port = 8141;
  const base = `http://127.0.0.1:${port}`;

  function get(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`${base}${urlPath}`, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', reject);
    });
  }

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thumbs-route-'));
    process.env.IMAGES_DIR = FIXTURES;
    process.env.THUMBS_DIR = FIXTURES;
    process.env.DECK_PATH = path.join(tempDir, 'deck.json');
    process.env.SIZES_PATH = path.join(tempDir, 'sizes.json');
    jest.resetModules();
    server = require('../bridge/index');
    await new Promise(resolve => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    delete process.env.IMAGES_DIR;
    delete process.env.THUMBS_DIR;
    delete process.env.DECK_PATH;
    delete process.env.SIZES_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('serves a thumbnail that exists', async () => {
    const response = await get('/images/thumbs/sample.png');
    expect(response.status).toBe(200);
  });

  test('keeps the traversal guard on the thumbs prefix', async () => {
    const encoded = await get('/images/thumbs/%2e%2e%2f%2e%2e%2fpackage.json');
    expect(encoded.status).not.toBe(200);
    expect(encoded.body).not.toContain('"name"');

    const literal = await get('/images/thumbs/..%2fpackage.json');
    expect(literal.status).not.toBe(200);
  });

  test('returns 404 for a thumbnail that does not exist', async () => {
    const response = await get('/images/thumbs/missing.png');
    expect(response.status).toBe(404);
  });

  test('content route still works after the refactor', async () => {
    const response = await get('/images/content/sample.png');
    expect(response.status).toBe(200);
  });
});
