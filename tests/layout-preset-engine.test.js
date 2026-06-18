const { LayoutPresetEngine } = require('../p5-collage/layout-preset-engine');

describe('LayoutPresetEngine', () => {
  const W = 1920;
  const H = 1080;
  const PRESETS = ['scatter', 'spiral', 'polaroid-stack', 'neat-grid', 'vignette', 'random'];

  // Sample cell objects matching layout.json structure
  function makeCells(count) {
    return Array.from({ length: count }, (_, i) => ({
      slot: i,
      w: 250,
      h: 200,
      imageFile: `${String(i + 1).padStart(3, '0')}.jpg`,
      originalW: 1000,
      originalH: 800,
      imageId: String(i + 1).padStart(3, '0'),
    }));
  }

  function makeEngine() {
    return new LayoutPresetEngine(W, H);
  }

  /* ── Empty cells ── */

  test('returns [] for empty cells', () => {
    const engine = makeEngine();
    expect(engine.compute([], 'scatter')).toEqual([]);
  });

  /* ── Each preset produces valid output ── */

  describe.each(PRESETS)('preset "%s"', (preset) => {
    test('places single cell within canvas bounds', () => {
      const engine = makeEngine();
      const result = engine.compute(makeCells(1), preset);
      expect(result).toHaveLength(1);
      expect(result[0].slot).toBe(0);
      expect(result[0].x).toBeGreaterThanOrEqual(0);
      expect(result[0].y).toBeGreaterThanOrEqual(0);
      // Cell center must be within canvas bounds
      const cx = result[0].x + result[0].w / 2;
      const cy = result[0].y + result[0].h / 2;
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cx).toBeLessThanOrEqual(W);
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(H);
      expect(result[0].w).toBeGreaterThan(20);
      expect(result[0].h).toBeGreaterThan(20);
      expect(typeof result[0].rotation).toBe('number');
      expect(result[0].scale).toBeGreaterThan(0);
      expect(result[0].opacity).toBeGreaterThan(0);
      expect(result[0].opacity).toBeLessThanOrEqual(1);
      expect(['none', 'vintage', 'sepia', 'grayscale', 'cyanotype', 'polaroid']).toContain(result[0].filterType);
      expect(result[0].blendMode).toBeTruthy();
    });
  });

  /* ── Multiple slot counts × all presets ── */

  describe.each([1, 5, 15, 30])('%d cells', (n) => {
    test.each(PRESETS)('preset "%s" places all cells within canvas bounds', (preset) => {
      const engine = makeEngine();
      const result = engine.compute(makeCells(n), preset);

      expect(result).toHaveLength(n);
      for (const cell of result) {
        expect(cell.slot).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        // Cell center must be within canvas bounds
        const cx = cell.x + cell.w / 2;
        const cy = cell.y + cell.h / 2;
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cx).toBeLessThanOrEqual(W);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cy).toBeLessThanOrEqual(H);
        expect(cell.w).toBeGreaterThan(20);
        expect(cell.h).toBeGreaterThan(20);
        expect(typeof cell.rotation).toBe('number');
        expect(typeof cell.zIndex).toBe('number');
        expect(cell.zIndex).toBeGreaterThan(0);
      }
    });
  });

  /* ── Preset switching ── */

  describe('preset switching', () => {
    test('different presets produce different positions for same cells', () => {
      const engine = makeEngine();
      const cells = makeCells(5);
      const results = PRESETS.map(p => engine.compute(cells, p));

      for (let i = 1; i < results.length; i++) {
        const a = results[i - 1];
        const b = results[i];
        // At least one cell position should differ
        const differs = a.some((cell, j) =>
          cell.x !== b[j].x || cell.y !== b[j].y
        );
        expect(differs).toBe(true);
      }
    });
  });

  /* ── getPresets ── */

  describe('getPresets', () => {
    test('returns all 6 preset names', () => {
      const engine = makeEngine();
      expect(engine.getPresets()).toEqual(PRESETS);
    });
  });

  /* ── setPreset / getCurrentPreset ── */

  describe('setPreset and getCurrentPreset', () => {
    test('default preset is scatter', () => {
      const engine = makeEngine();
      expect(engine.getCurrentPreset()).toBe('scatter');
    });

    test('setPreset updates current preset', () => {
      const engine = makeEngine();
      engine.setPreset('spiral');
      expect(engine.getCurrentPreset()).toBe('spiral');
    });

    test('setPreset ignores invalid preset names (no throw)', () => {
      const engine = makeEngine();
      engine.setPreset('spiral');
      engine.setPreset('nonexistent');
      expect(engine.getCurrentPreset()).toBe('spiral');
    });

    test('compute without preset param uses current preset', () => {
      const engine = makeEngine();
      engine.setPreset('neat-grid');
      const result = engine.compute(makeCells(3));
      expect(result).toHaveLength(3);
    });
  });

  /* ── Output fields ── */

  describe('output fields', () => {
    test('every cell has slot, x, y, w, h, rotation, scale, opacity, filterType, blendMode, zIndex', () => {
      const engine = makeEngine();
      const result = engine.compute(makeCells(3), 'scatter');
      for (const cell of result) {
        expect(cell).toHaveProperty('slot');
        expect(cell).toHaveProperty('x');
        expect(cell).toHaveProperty('y');
        expect(cell).toHaveProperty('w');
        expect(cell).toHaveProperty('h');
        expect(cell).toHaveProperty('rotation');
        expect(cell).toHaveProperty('scale');
        expect(cell).toHaveProperty('opacity');
        expect(cell).toHaveProperty('filterType');
        expect(cell).toHaveProperty('blendMode');
        expect(cell).toHaveProperty('zIndex');
      }
    });
  });

  /* ── scatterScale ── */

  describe('scatterScale', () => {
    test('higher scatterScale increases scale values', () => {
      const engine = makeEngine();
      const cells = makeCells(10);
      engine.scatterScale = 0.5;
      const rLow = engine.compute(cells, 'scatter');
      engine.scatterScale = 2.0;
      const rHigh = engine.compute(cells, 'scatter');

      // Most cells should be larger with higher scatterScale
      const avgWLow = rLow.reduce((s, c) => s + c.w, 0) / rLow.length;
      const avgWHigh = rHigh.reduce((s, c) => s + c.w, 0) / rHigh.length;
      expect(avgWHigh).toBeGreaterThan(avgWLow);
    });
  });
});
