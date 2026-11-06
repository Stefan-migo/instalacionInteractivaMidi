const http = require('http');
const path = require('path');

// The brand assets are served by the bridge like any other static file, so their
// content types are part of the contract a browser depends on: a favicon served as
// octet-stream is ignored by every browser, and a manifest served as text/plain is
// never read as a manifest.
process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');

describe('Brand assets over HTTP', () => {
  const server = require('../bridge/index');
  const PORT = 8098;
  const BASE = `http://localhost:${PORT}`;

  beforeAll((done) => {
    server.listen(PORT, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  function get(pathname) {
    return new Promise((resolve, reject) => {
      http.get(`${BASE}${pathname}`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data })
        );
      }).on('error', reject);
    });
  }

  test('serves the SVG favicon with the SVG content type', async () => {
    const res = await get('/phone-client/icons/favicon.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).toContain('<svg');
  });

  test('serves the web manifest with the manifest content type', async () => {
    const res = await get('/phone-client/icons/site.webmanifest');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('manifest');
    const manifest = JSON.parse(res.body);
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.background_color).toBe('#000000');
  });

  test('serves the apple touch icon as PNG', async () => {
    const res = await get('/phone-client/icons/apple-touch-icon.png');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  test('serves the multi-resolution favicon with the icon content type', async () => {
    const res = await get('/phone-client/icons/favicon.ico');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image');
  });
});
