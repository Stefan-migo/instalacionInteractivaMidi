const http = require('http');
const path = require('path');

process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');

describe('Operator and shared routes', () => {
  const server = require('../bridge/index');
  const PORT = 8107;
  const BASE = `http://localhost:${PORT}`;

  beforeAll((done) => { server.listen(PORT, done); });
  afterAll((done) => { server.close(done); });

  function get(pathname) {
    return new Promise((resolve, reject) => {
      http.get(`${BASE}${pathname}`, (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] }));
      }).on('error', reject);
    });
  }

  test('serves operator page and shared theme assets with their content types and returns 404 for missing files', async () => {
    const operator = await get('/operator/');
    const css = await get('/shared/theme.css');
    const js = await get('/shared/theme.js');
    const missing = await get('/operator/nope.js');
    expect(operator.status).toBe(200);
    expect(operator.type).toContain('text/html');
    expect(css.status).toBe(200);
    expect(css.type).toContain('text/css');
    expect(js.status).toBe(200);
    expect(js.type).toContain('javascript');
    expect(missing.status).toBe(404);
  });
});
