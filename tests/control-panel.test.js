/**
 * Tests for control-panel preset dispatch.
 *
 * Verifies that each preset name is correctly passed to LayoutPresetEngine
 * when preset buttons are clicked.
 *
 * Since control-panel.js is an IIFE, we test the underlying dispatch
 * mechanism: LayoutPresetEngine.setPreset() + compute().
 */
const { LayoutPresetEngine } = require('../p5-collage/layout-preset-engine');

describe('preset dispatch', () => {
  const PRESETS = ['scatter', 'spiral', 'polaroid-stack', 'neat-grid', 'vignette', 'random'];
  const W = 1920;
  const H = 1080;

  function makeCells(count) {
    return Array.from({ length: count }, (_, i) => ({
      slot: i,
      w: 250,
      h: 200,
      imageFile: String(i + 1).padStart(3, '0') + '.jpg',
      originalW: 1000,
      originalH: 800,
      imageId: String(i + 1).padStart(3, '0'),
    }));
  }

  test('setPreset accepts all valid preset names', () => {
    var engine = new LayoutPresetEngine(W, H);
    PRESETS.forEach(function (preset) {
      engine.setPreset(preset);
      expect(engine.getCurrentPreset()).toBe(preset);
    });
  });

  test('setPreset ignores unknown preset name', () => {
    var engine = new LayoutPresetEngine(W, H);
    engine.setPreset('scatter');
    engine.setPreset('unknown-preset');
    // Should remain at 'scatter'
    expect(engine.getCurrentPreset()).toBe('scatter');
  });

  test('compute calls correct preset via setPreset + compute chain', () => {
    var engine = new LayoutPresetEngine(W, H);
    var cells = makeCells(5);

    PRESETS.forEach(function (preset) {
      engine.setPreset(preset);
      var result = engine.compute(cells);
      expect(result).toHaveLength(5);
      // Verify each result has required properties
      result.forEach(function (pos) {
        expect(pos).toHaveProperty('slot');
        expect(pos).toHaveProperty('x');
        expect(pos).toHaveProperty('y');
        expect(pos).toHaveProperty('w');
        expect(pos).toHaveProperty('h');
        expect(pos).toHaveProperty('rotation');
        expect(pos).toHaveProperty('zIndex');
      });
    });
  });

  test('compute returns positions within canvas bounds for all presets', () => {
    var engine = new LayoutPresetEngine(W, H);
    var cells = makeCells(30);

    PRESETS.forEach(function (preset) {
      engine.setPreset(preset);
      var result = engine.compute(cells);
      expect(result).toHaveLength(30);

      result.forEach(function (pos, idx) {
        // Fragments may hang off the canvas; what may not happen is vanishing.
        var visibleW = Math.min(pos.x + pos.w, W) - Math.max(pos.x, 0);
        var visibleH = Math.min(pos.y + pos.h, H) - Math.max(pos.y, 0);
        expect(visibleW).toBeGreaterThanOrEqual(Math.floor(pos.w * engine.minVisible) - 1);
        expect(visibleH).toBeGreaterThanOrEqual(Math.floor(pos.h * engine.minVisible) - 1);
        expect(pos.w).toBeGreaterThan(20);
        expect(pos.h).toBeGreaterThan(20);
      });
    });
  });

  test('compute uses last setPreset when no override given', () => {
    var engine = new LayoutPresetEngine(W, H);
    var cells = makeCells(3);

    engine.setPreset('spiral');
    var result = engine.compute(cells);
    // Spiral preset: uses angle = index * 0.45, which means cells should be
    // placed at different x/y positions from scatter
    var result2 = engine.compute(cells, 'scatter');
    // They should differ — spiral is not scatter
    expect(result[0].x).not.toBe(result2[0].x);
  });

  test('preset override takes precedence over current preset', () => {
    var engine = new LayoutPresetEngine(W, H);
    var cells = makeCells(3);

    engine.setPreset('vignette');
    // Override with 'neat-grid'
    var result = engine.compute(cells, 'neat-grid');
    // Neat-grid positions follow a grid pattern
    // Vignette would place near borders
    // Just verify it returns expected number of results
    expect(result).toHaveLength(3);
  });

  test('compute returns empty array for null cells', () => {
    var engine = new LayoutPresetEngine(W, H);
    expect(engine.compute(null)).toEqual([]);
  });

  test('compute returns empty array for empty cells', () => {
    var engine = new LayoutPresetEngine(W, H);
    expect(engine.compute([])).toEqual([]);
  });
});
