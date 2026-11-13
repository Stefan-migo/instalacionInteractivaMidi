const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const BASE_DIR = path.join(__dirname, '..');

describe('cycle steps', () => {
  const CycleSteps = require('../p5-collage/cycle-steps');

  test('the shipped file is a valid cycle that steps every thirty seconds', () => {
    const shipped = CycleSteps.loadCycle(JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'images/cycle.json'), 'utf8')));
    expect(shipped.dwell).toBe(30);
    expect(shipped.autoStart).toBe(true);
    expect(shipped.steps.length).toBeGreaterThan(1);
    expect(CycleSteps.loadCycle(CycleSteps.DEFAULT_CYCLE)).toEqual(CycleSteps.DEFAULT_CYCLE);
  });

  test('rejects a cycle the projector cannot run', () => {
    const valid = { version: 1, dwell: 30, autoStart: true, steps: [0.7, 1] };
    expect(() => CycleSteps.validateCycle(null)).toThrow(/expected an object/);
    expect(() => CycleSteps.validateCycle({ ...valid, version: 2 })).toThrow(/unsupported version/);
    expect(() => CycleSteps.validateCycle({ ...valid, dwell: 0 })).toThrow(/dwell/);
    expect(() => CycleSteps.validateCycle({ ...valid, dwell: '30' })).toThrow(/dwell/);
    expect(() => CycleSteps.validateCycle({ ...valid, autoStart: 'yes' })).toThrow(/autoStart/);
    expect(() => CycleSteps.validateCycle({ ...valid, steps: [] })).toThrow(/non-empty/);
    expect(() => CycleSteps.validateCycle({ ...valid, steps: [0.7, -1] })).toThrow(/positive/);
    expect(() => CycleSteps.validateCycle({ ...valid, steps: [0.7, 'x'] })).toThrow(/positive/);
  });

  test('advances in order, wraps to the first step and holds a single step', () => {
    const cycle = { version: 1, dwell: 30, autoStart: false, steps: [0.7, 1, 1.3] };
    expect(CycleSteps.advanceCycle(cycle, -1)).toEqual({ index: 0, scale: 0.7 });
    expect(CycleSteps.advanceCycle(cycle, 0)).toEqual({ index: 1, scale: 1 });
    expect(CycleSteps.advanceCycle(cycle, 1)).toEqual({ index: 2, scale: 1.3 });
    expect(CycleSteps.advanceCycle(cycle, 2)).toEqual({ index: 0, scale: 0.7 });
    const single = { ...cycle, steps: [0.9] };
    expect(CycleSteps.advanceCycle(single, -1)).toEqual({ index: 0, scale: 0.9 });
    expect(CycleSteps.advanceCycle(single, 0)).toEqual({ index: 0, scale: 0.9 });
  });
});

describe('GET /api/cycle', () => {
  let server;
  let tempDir;
  let cyclePath;
  const port = 8147;
  const base = `http://127.0.0.1:${port}`;

  function get() {
    return new Promise((resolve, reject) => {
      http.get(`${base}/api/cycle`, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', reject);
    });
  }

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-route-'));
    cyclePath = path.join(tempDir, 'cycle.json');
    process.env.CYCLE_PATH = cyclePath;
    process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');
    jest.resetModules();
    server = require('../bridge/index');
    await new Promise(resolve => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    delete process.env.CYCLE_PATH;
    delete process.env.IMAGES_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('serves the authored cycle and falls back to the default when it is missing or corrupt', async () => {
    const absent = await get();
    expect(absent.status).toBe(200);
    expect(JSON.parse(absent.body).steps.length).toBeGreaterThan(1);

    const authored = { version: 1, dwell: 12, autoStart: false, steps: [0.5, 1.5] };
    fs.writeFileSync(cyclePath, JSON.stringify(authored));
    expect(JSON.parse((await get()).body)).toEqual(authored);

    fs.writeFileSync(cyclePath, '{ this is not json');
    const corrupt = await get();
    expect(corrupt.status).toBe(200);
    expect(JSON.parse(corrupt.body).version).toBe(1);
  });
});
