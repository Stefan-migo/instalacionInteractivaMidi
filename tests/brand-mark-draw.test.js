const { drawBrandMark, MARK_PATH, MARK_VIEWBOX } = require('../p5-collage/brand-mark');

function fakeContext() {
  const calls = [];
  const ctx = {
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: (x, y) => calls.push(['translate', x, y]),
    scale: (x, y) => calls.push(['scale', x, y]),
    fill: path => calls.push(['fill', path]),
    set globalAlpha(value) { calls.push(['globalAlpha', value]); },
    set fillStyle(value) { calls.push(['fillStyle', value]); },
  };
  return { ctx, calls };
}

const SENTINEL = { kind: 'path' };
const factory = () => SENTINEL;

function find(calls, name) {
  return calls.find(call => call[0] === name);
}

describe('drawing the brand mark on the collage canvas', () => {
  test('paints centred at 40% of the canvas width, preserving the viewBox ratio', () => {
    const { ctx, calls } = fakeContext();

    expect(drawBrandMark(ctx, { width: 1920, height: 1080, pathFactory: factory })).toBe(true);

    const targetWidth = 1920 * 0.4;                 // 768, under the 780 ceiling
    const scale = targetWidth / MARK_VIEWBOX.width;
    const markHeight = MARK_VIEWBOX.height * scale;

    expect(find(calls, 'translate')[1]).toBeCloseTo((1920 - targetWidth) / 2, 4);
    expect(find(calls, 'translate')[2]).toBeCloseTo((1080 - markHeight) / 2, 4);
    expect(find(calls, 'scale')[1]).toBeCloseTo(scale, 6);
    expect(find(calls, 'fill')[1]).toBe(SENTINEL);
  });

  test('clamps the mark to the 780px ceiling on a wide canvas', () => {
    const { ctx, calls } = fakeContext();

    drawBrandMark(ctx, { width: 3000, height: 2000, pathFactory: factory });

    expect(find(calls, 'scale')[1]).toBeCloseTo(780 / MARK_VIEWBOX.width, 6);
  });

  test('is translucent and takes the colour it is given', () => {
    const { ctx, calls } = fakeContext();

    drawBrandMark(ctx, { width: 1920, height: 1080, color: '#fefefe', pathFactory: factory });

    expect(find(calls, 'globalAlpha')[1]).toBe(0.35);
    expect(find(calls, 'fillStyle')[1]).toBe('#fefefe');
  });

  test('restores the context so the cells are not affected', () => {
    const { ctx, calls } = fakeContext();

    drawBrandMark(ctx, { width: 1920, height: 1080, pathFactory: factory });

    expect(calls[0]).toEqual(['save']);
    expect(calls[calls.length - 1]).toEqual(['restore']);
    expect(find(calls, 'fill')).toBeDefined();
  });

  test('reports that it painted nothing without a context or a size', () => {
    const { ctx, calls } = fakeContext();

    expect(drawBrandMark(null, { width: 1920, height: 1080, pathFactory: factory })).toBe(false);
    expect(drawBrandMark(ctx, { width: 0, height: 1080, pathFactory: factory })).toBe(false);
    expect(drawBrandMark(ctx, { width: 1920, height: 0, pathFactory: factory })).toBe(false);
    expect(drawBrandMark(ctx, {}, factory)).toBe(false);
    expect(calls).toEqual([]);
  });

  test('skips painting when no path can be built (headless)', () => {
    const { ctx, calls } = fakeContext();

    expect(drawBrandMark(ctx, { width: 1920, height: 1080, pathFactory: () => null })).toBe(false);
    expect(calls).toEqual([]);
  });

  test('ships the MIDI geometry as inline path data', () => {
    expect(MARK_PATH.startsWith('M37 0h462v192h-462z')).toBe(true);
    expect(MARK_VIEWBOX).toEqual({ width: 1890.67, height: 620 });
  });
});
