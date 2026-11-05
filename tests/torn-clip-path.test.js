const tornClipPath = require('../phone-client/torn-clip-path');

describe('tornClipPath', () => {
  test('returns a string starting with "polygon("', () => {
    const result = tornClipPath(6, 3, 1337);
    expect(result).toMatch(/^polygon\(/);
  });

  test('ends with ")"', () => {
    const result = tornClipPath(6, 3, 1337);
    expect(result).toMatch(/\)$/);
  });

  test('produces 24 coordinate pairs (6 segments × 4 sides)', () => {
    const result = tornClipPath(6, 3, 1337);
    // Extract content inside polygon(...)
    const inner = result.slice(8, -1);
    const pairs = inner.split(', ');
    expect(pairs).toHaveLength(24);
  });

  test('each coordinate pair contains a percentage value', () => {
    const result = tornClipPath(6, 3, 1337);
    const inner = result.slice(8, -1);
    const pairs = inner.split(', ');
    pairs.forEach(pair => {
      expect(pair).toMatch(/% /);
    });
  });

  test('is deterministic for the same seed', () => {
    const a = tornClipPath(6, 3, 1337);
    const b = tornClipPath(6, 3, 1337);
    expect(a).toBe(b);
  });

  test('different seeds produce different polygons', () => {
    const a = tornClipPath(6, 3, 1337);
    const b = tornClipPath(6, 3, 1919);
    expect(a).not.toBe(b);
  });

  test('different jitter values produce different polygons', () => {
    const a = tornClipPath(6, 3, 1337);
    const b = tornClipPath(6, 10, 1337);
    expect(a).not.toBe(b);
  });
});
