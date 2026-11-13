const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const BASE_DIR = path.join(__dirname, '..');
const SAMPLE_CLASSES = require('../images/sizes.json').classes;

describe('size class data', () => {
  const { loadSizeClasses, getAuthoredSize, validateSizes } = require('../p5-collage/size-classes');

  test('loads calibrated target ink fractions from data and resolves unassigned images to no authored size', () => {
    const data = loadSizeClasses(JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'images/sizes.json'), 'utf8')));
    expect(data.classes).toEqual(SAMPLE_CLASSES);
    expect(Object.keys(data.assignments)).toHaveLength(0);
    expect(getAuthoredSize(data, '001')).toBeNull();
  });

  test('shared draw size maps target ink fraction to aspect-preserving frame dimensions', () => {
    const { getAuthoredDrawSize } = require('../p5-collage/size-classes');
    const data = { version: 1, classes: SAMPLE_CLASSES, assignments: { '001': 'M' } };
    const dimensions = getAuthoredDrawSize(data, '001', 200, 100, 1000, 500, 0.5);
    const targetArea = SAMPLE_CLASSES.M * 1000 * 500 / 0.5;
    expect(dimensions.width).toBeCloseTo(Math.sqrt(targetArea * 2), 10);
    expect(dimensions.height).toBeCloseTo(Math.sqrt(targetArea / 2), 10);
    expect(dimensions.width / dimensions.height).toBeCloseTo(2, 10);
    const operatorSource = fs.readFileSync(path.join(BASE_DIR, 'operator/operator.js'), 'utf8');
    const rendererSource = fs.readFileSync(path.join(BASE_DIR, 'p5-collage/cell-renderer.js'), 'utf8');
    expect(operatorSource).toContain('SizeClasses.getAuthoredDrawSize');
    expect(rendererSource).toContain('SizeClasses.getAuthoredDrawSize');
  });

  test('rejects malformed class data', () => {
    expect(() => validateSizes({ version: 1, classes: { ...SAMPLE_CLASSES, M: 0 }, assignments: {} })).toThrow();
  });
});

describe('POST /api/sizes', () => {
  let server;
  let tempDir;
  let sizesPath;
  const port = 8137;
  const base = `http://127.0.0.1:${port}`;

  function get() {
    return new Promise((resolve, reject) => http.get(`${base}/api/sizes`, res => {
      let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject));
  }

  function post(body, raw = false) {
    const payload = raw ? body : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = http.request(`${base}/api/sizes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, res => {
        let response = '';
        res.on('data', chunk => response += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: response }));
      });
      req.on('error', reject);
      req.end(payload);
    });
  }

  const validPayload = () => ({ version: 1, classes: SAMPLE_CLASSES, assignments: { '001': 'M' } });
  const rejectedWithoutWrite = async (payload, raw = false) => {
    const before = fs.readFileSync(sizesPath);
    const response = await post(payload, raw);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toMatch(/error|invalid|disabled|too large/i);
    expect(fs.readFileSync(sizesPath)).toEqual(before);
  };

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fragment-sizes-'));
    sizesPath = path.join(tempDir, 'sizes.json');
    fs.writeFileSync(sizesPath, JSON.stringify({ version: 1, classes: SAMPLE_CLASSES, assignments: {} }));
    process.env.SIZES_PATH = sizesPath;
    process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');
    process.env.SIZE_WRITES_ENABLED = 'true';
    jest.resetModules();
    server = require('../bridge/index');
    await new Promise(resolve => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    delete process.env.SIZES_PATH;
    delete process.env.SIZE_WRITES_ENABLED;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('GET returns the existing sizes file', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual(JSON.parse(fs.readFileSync(sizesPath, 'utf8')));
  });

  test('POST assignments round-trip through GET', async () => {
    const response = await post(validPayload());
    expect(response.status).toBe(200);
    expect(JSON.parse(fs.readFileSync(sizesPath, 'utf8')).assignments).toEqual({ '001': 'M' });
    const fetched = await get();
    expect(fetched.status).toBe(200);
    expect(JSON.parse(fetched.body)).toEqual(validPayload());
  });

  test('rejects malformed JSON without writing', async () => {
    fs.writeFileSync(sizesPath, JSON.stringify({ version: 1, classes: SAMPLE_CLASSES, assignments: {} }));
    await rejectedWithoutWrite('{', true);
  });

  test('rejects invalid schema without writing', async () => {
    await rejectedWithoutWrite({ version: 1, classes: SAMPLE_CLASSES });
  });

  test('rejects unrecognized image keys without writing', async () => {
    await rejectedWithoutWrite({ ...validPayload(), assignments: { missing: 'M' } });
  });

  test('rejects unrecognized classes without writing', async () => {
    await rejectedWithoutWrite({ ...validPayload(), assignments: { '001': 'XXL' } });
  });

  test('rejects oversized payload without writing', async () => {
    await rejectedWithoutWrite('x'.repeat(17 * 1024), true);
  });
});

describe('GET /api/sizes missing file', () => {
  let server;
  let tempDir;
  const port = 8139;
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fragment-sizes-missing-'));
    process.env.SIZES_PATH = path.join(tempDir, 'absent.json');
    process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');
    delete process.env.SIZE_WRITES_ENABLED;
    jest.resetModules();
    server = require('../bridge/index');
    await new Promise(resolve => server.listen(port, resolve));
  });
  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    delete process.env.SIZES_PATH;
    delete process.env.IMAGES_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  test('returns valid empty defaults when the sizes file is absent', async () => {
    const response = await new Promise((resolve, reject) => http.get(`http://127.0.0.1:${port}/api/sizes`, res => {
      let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ version: 1, classes: SAMPLE_CLASSES, assignments: {} });
  });
});

describe('POST /api/sizes production guard', () => {
  let server;
  let tempDir;
  let sizesPath;
  const port = 8138;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fragment-sizes-disabled-'));
    sizesPath = path.join(tempDir, 'sizes.json');
    fs.writeFileSync(sizesPath, '{"original":true}\n');
    process.env.SIZES_PATH = sizesPath;
    process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');
    delete process.env.SIZE_WRITES_ENABLED;
    jest.resetModules();
    server = require('../bridge/index');
    await new Promise(resolve => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    delete process.env.SIZES_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('refuses writes when the opt-in flag is absent and leaves the file byte-identical', async () => {
    const before = fs.readFileSync(sizesPath);
    const payload = JSON.stringify({ version: 1, classes: SAMPLE_CLASSES, assignments: { '001': 'M' } });
    const response = await new Promise((resolve, reject) => {
      const req = http.request(`http://127.0.0.1:${port}/api/sizes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end(payload);
    });
    expect(response.status).toBe(403);
    expect(response.body).toMatch(/disabled/i);
    expect(fs.readFileSync(sizesPath)).toEqual(before);
  });
});
