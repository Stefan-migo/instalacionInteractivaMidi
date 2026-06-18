const { ImageCycler } = require('../p5-collage/image-cycler');

describe('ImageCycler', () => {
  let cycler;

  beforeEach(() => {
    cycler = new ImageCycler();
  });

  const allImages = [
    'img01.jpg', 'img02.jpg', 'img03.jpg', 'img04.jpg', 'img05.jpg',
    'img06.jpg', 'img07.jpg', 'img08.jpg', 'img09.jpg', 'img10.jpg',
  ];

  /* ── Pool initialisation ── */

  test('initPool creates a pool of poolSize unique images', () => {
    cycler.initPool(0, allImages, 4);
    const pool = cycler._pools[0];
    expect(pool).toBeInstanceOf(Array);
    expect(pool).toHaveLength(4);
    // All items unique and from the source set
    expect(new Set(pool).size).toBe(4);
    pool.forEach((img) => expect(allImages).toContain(img));
  });

  test('poolSize larger than available uses all available images', () => {
    cycler.initPool(0, ['a.jpg', 'b.jpg'], 10);
    expect(cycler._pools[0]).toHaveLength(2);
  });

  test('poolSize of zero creates empty pool', () => {
    cycler.initPool(0, allImages, 0);
    expect(cycler._pools[0]).toHaveLength(0);
  });

  /* ── Cycle forward ── */

  test('cycle forward returns current and previous images', () => {
    cycler.initPool(0, allImages, 4);
    const pool = cycler._pools[0];
    const r = cycler.cycle(0, 'next');
    expect(r).toHaveProperty('current');
    expect(r).toHaveProperty('previous');
    // Cursor advances from 0 to 1
    expect(r.previous).toBe(pool[0]);
    expect(r.current).toBe(pool[1]);
  });

  test('cycle forward wraps at pool boundary', () => {
    cycler.initPool(0, allImages, 3);
    const pool = cycler._pools[0];
    cycler.cycle(0, 'next'); // 0→1
    cycler.cycle(0, 'next'); // 1→2
    const r = cycler.cycle(0, 'next'); // 2→0 (wrap)
    expect(r.current).toBe(pool[0]);
    expect(r.previous).toBe(pool[2]);
  });

  /* ── Cycle backward ── */

  test('cycle backward returns current and previous images', () => {
    cycler.initPool(0, allImages, 4);
    const pool = cycler._pools[0];
    const r = cycler.cycle(0, 'prev');
    // Cursor wraps backward: from 0 to pool.length-1
    expect(r.current).toBe(pool[pool.length - 1]);
    expect(r.previous).toBe(pool[0]);
  });

  test('cycle backward wraps at pool start', () => {
    cycler.initPool(0, allImages, 3);
    const pool = cycler._pools[0];
    // Already at 0, going prev wraps to 2
    const r = cycler.cycle(0, 'prev');
    expect(r.current).toBe(pool[2]);
    expect(r.previous).toBe(pool[0]);
  });

  /* ── Empty pool ── */

  test('cycle on empty pool returns null', () => {
    cycler.initPool(0, allImages, 0);
    expect(cycler.cycle(0, 'next')).toBeNull();
    expect(cycler.cycle(0, 'prev')).toBeNull();
  });

  test('cycle on uninitialised slot returns null', () => {
    expect(cycler.cycle(99, 'next')).toBeNull();
  });

  /* ── Independent per-slot pools ── */

  test('slots have independent pools and cursors', () => {
    cycler.initPool(0, allImages, 3);
    cycler.initPool(1, allImages, 3);

    const pool0 = cycler._pools[0];
    const pool1 = cycler._pools[1];

    // Advance slot 0 twice, slot 1 once
    cycler.cycle(0, 'next');
    cycler.cycle(0, 'next');
    cycler.cycle(1, 'next');

    expect(cycler._cursors[0]).toBe(2);
    expect(cycler._cursors[1]).toBe(1);

    // Pools should be different (random selection)
    // Very unlikely (1/120) two pools of 3 from 10 are identical
    expect(pool0).not.toEqual(pool1);
  });

  test('pool selection is randomised', () => {
    cycler.initPool(0, allImages, 10);
    cycler.initPool(1, allImages, 10);
    // With full pool the order may differ due to random shuffle
    expect(cycler._pools[0]).not.toEqual(cycler._pools[1]);
  });
});
