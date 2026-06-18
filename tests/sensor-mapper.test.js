const { SensorMapper } = require('../p5-collage/sensor-mapper');

describe('SensorMapper', () => {
  let mapper;
  let mockNow;

  beforeEach(() => {
    mockNow = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /* ── Output shape ── */

  test('returns { direction, energy } without scale/drift/rotation/wobble', () => {
    mapper = new SensorMapper({ movementThreshold: 0.5 });
    const r = mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, { a: 0, b: 90, g: 0 });
    expect(r).toEqual({ direction: null, energy: 0 });
    // Old keys must be absent
    expect(r).not.toHaveProperty('scale');
    expect(r).not.toHaveProperty('drift');
    expect(r).not.toHaveProperty('rotation');
    expect(r).not.toHaveProperty('wobble');
    // New keys present
    expect(r).toHaveProperty('direction');
    expect(r).toHaveProperty('energy');
  });

  /* ── Forward movement → next ── */

  test('forward accel exceeding threshold returns direction next', () => {
    mapper = new SensorMapper({ movementThreshold: 0.5 });
    // Initialize — stores first frame
    mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    mockNow += 250; // well past debounce

    const r = mapper.map(0, { x: 10, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    expect(r.direction).toBe('next');
    expect(typeof r.energy).toBe('number');
    expect(r.energy).toBeGreaterThanOrEqual(0.5);
  });

  /* ── Backward movement → prev ── */

  test('negative accel delta returns direction prev', () => {
    mapper = new SensorMapper({ movementThreshold: 0.5 });
    mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    mockNow += 250;

    const r = mapper.map(0, { x: -10, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    expect(r.direction).toBe('prev');
  });

  /* ── Sub-threshold → null ── */

  test('sub-threshold movement returns direction null', () => {
    mapper = new SensorMapper({ movementThreshold: 10 });
    mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    mockNow += 250;

    const r = mapper.map(0, { x: 1, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    expect(r.direction).toBeNull();
    expect(r.energy).toBeLessThan(10);
  });

  /* ── Debounce ── */

  test('debounce suppresses direction within 200ms of trigger', () => {
    mapper = new SensorMapper({ movementThreshold: 0.5 });
    mockNow += 50;
    mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    mockNow += 250;
    // First trigger
    const r1 = mapper.map(0, { x: 10, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    expect(r1.direction).toBe('next');

    // Immediately after — should be debounced
    mockNow += 50; // only 50ms after trigger
    const r2 = mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 10, g: 0 }, {});
    expect(r2.direction).toBeNull();
  });

  test('debounce allows trigger after 200ms interval', () => {
    mapper = new SensorMapper({ movementThreshold: 0.5 });
    mockNow += 50;
    mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    mockNow += 250;
    mapper.map(0, { x: 10, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});

    // Now wait for debounce + new direction
    mockNow += 250;
    // gyro delta should give enough energy
    const r = mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 10, g: 0 }, {});
    expect(r.direction).not.toBeNull();
  });

  /* ── Slot lifecycle ── */

  test('resetSlot reinitialises next call as fresh slot', () => {
    mapper = new SensorMapper({ movementThreshold: 0.5 });
    mockNow += 50;
    mapper.map(0, { x: 10, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    mapper.resetSlot(0);
    mapper.map(0, { x: 20, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    // After reset the next call is init — energy = 0
    const r = mapper.map(0, { x: 20, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    // Delta from prev (20,0,0) to current (20,0,0) = 0 => energy=0
    expect(r.energy).toBe(0);
    expect(r.direction).toBeNull();
  });

  test('removeSlot cleans up and next map reinitialises', () => {
    mapper = new SensorMapper({ movementThreshold: 0.5 });
    mockNow += 50;
    mapper.map(0, { x: 10, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    mapper.removeSlot(0);

    // Next map should init fresh
    mockNow += 50;
    const r = mapper.map(0, { x: 5, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    expect(r.energy).toBe(0);
    expect(r.direction).toBeNull();
  });

  /* ── Gyro contribution ── */

  test('gyro delta can trigger direction prev on negative b', () => {
    mapper = new SensorMapper({ movementThreshold: 0.5 });
    mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, {});
    mockNow += 250;

    const r = mapper.map(0, { x: 0, y: 0, z: 0 }, { a: 0, b: -10, g: 0 }, {});
    expect(r.direction).toBe('prev');
    expect(r.energy).toBeGreaterThan(0.5);
  });
});
