let drawImg;

describe('drawImg', () => {
  beforeAll(() => {
    ({ drawImg } = require('../p5-collage/cell-renderer'));
  });

  beforeEach(() => {
    global.push = jest.fn();
    global.pop = jest.fn();
    global.translate = jest.fn();
    global.scale = jest.fn();
    global.drawingContext = { globalAlpha: 1, drawImage: jest.fn() };
  });

  afterEach(() => {
    delete global.push;
    delete global.pop;
    delete global.translate;
    delete global.scale;
    delete global.drawingContext;
  });

  test('returns early when img is null (no error)', () => {
    expect(() => drawImg(null, false, false, 0, 0, 100, 200, 0.5)).not.toThrow();
  });

  test('returns early when img is undefined (no error)', () => {
    expect(() => drawImg(undefined, false, false, 0, 0, 100, 200, 0.5)).not.toThrow();
  });

  // Helper: create mock img with known dimensions
  function makeImg(w, h) {
    return { nodeName: 'IMG', width: w, height: h };
  }

  test('draws image with object-fit contain (no cropping)', () => {
    // Cell: 100×200, Image: 800×600 (landscape)
    // Contain: Math.min(100/800, 200/600) = Math.min(0.125, 0.333) = 0.125
    // dw = 800*0.125 = 100, dh = 600*0.125 = 75
    // dx = (100-100)/2 = 0, dy = (200-75)/2 = 62.5
    const mockImg = makeImg(800, 600);
    drawImg(mockImg, false, false, 10, 20, 100, 200, 0.5);

    expect(global.translate).toHaveBeenCalledWith(60, 120); // 10+50, 20+100
    expect(global.drawingContext.drawImage).toHaveBeenCalledWith(
      mockImg, 0, 0, 800, 600, -50, -37.5, 100, 75,
    );
    // After draw, alpha is reset to 1
    expect(global.drawingContext.globalAlpha).toBe(1);
    expect(global.pop).toHaveBeenCalled();
  });

  test('scales low ink coverage to the floor without cropping', () => {
    const mockImg = makeImg(100, 100);
    drawImg(mockImg, false, false, 0, 0, 100, 100, 1, 'none', 0.1);
    const callArgs = global.drawingContext.drawImage.mock.calls[0];
    expect(callArgs.slice(1, 5)).toEqual([0, 0, 100, 100]);
    expect(callArgs[7]).toBeCloseTo(100 * Math.sqrt(3.5));
    expect(callArgs[8]).toBeCloseTo(100 * Math.sqrt(3.5));
  });

  test('applies flipH scale', () => {
    const mockImg = makeImg(800, 600);
    drawImg(mockImg, true, false, 0, 0, 100, 100, 1);

    expect(global.scale).toHaveBeenCalledWith(-1, 1);
  });

  test('applies flipV scale', () => {
    const mockImg = makeImg(800, 600);
    drawImg(mockImg, false, true, 0, 0, 100, 100, 1);

    expect(global.scale).toHaveBeenCalledWith(1, -1);
  });

  test('applies both flipH and flipV', () => {
    const mockImg = makeImg(800, 600);
    drawImg(mockImg, true, true, 0, 0, 100, 100, 1);

    expect(global.scale).toHaveBeenCalledWith(-1, 1);
    expect(global.scale).toHaveBeenCalledWith(1, -1);
  });

  test('applies and resets filter when filterType is provided', () => {
    const mockImg = makeImg(800, 600);
    // Track filter values set during the function
    const filterValues = [];
    let _filter = undefined;
    Object.defineProperty(global.drawingContext, 'filter', {
      get() { return _filter; },
      set(v) {
        filterValues.push(v);
        _filter = v;
      },
      configurable: true,
    });

    drawImg(mockImg, false, false, 0, 0, 100, 100, 1, 'sepia');

    // Should have set filter → sepia, then reset to 'none'
    expect(filterValues).toContain('sepia(0.85) contrast(1.1)');
    expect(filterValues).toContain('none');
    // Filter should end as 'none' after reset
    expect(global.drawingContext.filter).toBe('none');
  });

  test('does not set filter when filterType is undefined', () => {
    const mockImg = makeImg(800, 600);
    global.drawingContext.filter = 'none'; // set initial state

    drawImg(mockImg, false, false, 0, 0, 100, 100, 1);

    // Should remain 'none' — no filter applied
    expect(global.drawingContext.filter).toBe('none');
  });

  // ── Object-fit contain tests (image fully visible, no cropping) ─────

  test('portrait image in landscape cell uses contain (no crop)', () => {
    // Cell: 200×100 (landscape), Image: 655×1024 (portrait)
    // fitScale = Math.min(200/655, 100/1024) ≈ 0.09766
    // dw = 655*0.09766 ≈ 63.96, dh = 1024*0.09766 = 100
    // dx = (200-63.96)/2 ≈ 68.02, dy = (100-100)/2 = 0
    const mockImg = makeImg(655, 1024);
    drawImg(mockImg, false, false, 0, 0, 200, 100, 1);

    const callArgs = global.drawingContext.drawImage.mock.calls[0];
    expect(callArgs.length).toBe(9);
    // Source is ALWAYS the full image (no crop)
    expect(callArgs[0]).toBe(mockImg);
    expect(callArgs[1]).toBeCloseTo(0, -1);  // sx = 0
    expect(callArgs[2]).toBeCloseTo(0, -1);  // sy = 0
    expect(callArgs[3]).toBeCloseTo(655, -1); // sw = full width
    expect(callArgs[4]).toBeCloseTo(1024, -1); // sh = full height
  });

  test('wide landscape image in portrait cell uses contain (no crop)', () => {
    // Cell: 100×200 (portrait), Image: 3915×2455 (wide landscape)
    // fitScale = Math.min(100/3915, 200/2455) ≈ 0.02554
    // dw ≈ 100, dh ≈ 62.7
    // dx ≈ 0, dy ≈ 68.65
    const mockImg = makeImg(3915, 2455);
    drawImg(mockImg, false, false, 0, 0, 100, 200, 1);

    const callArgs = global.drawingContext.drawImage.mock.calls[0];
    expect(callArgs.length).toBe(9);
    // Source is ALWAYS the full image (no crop)
    expect(callArgs[0]).toBe(mockImg);
    expect(callArgs[1]).toBeCloseTo(0, -1);  // sx = 0
    expect(callArgs[2]).toBeCloseTo(0, -1);  // sy = 0
    expect(callArgs[3]).toBeCloseTo(3915, -1); // sw = full width
    expect(callArgs[4]).toBeCloseTo(2455, -1); // sh = full height
  });

  test('square image in square cell uses full image', () => {
    // Cell: 100×100 (square), Image: 500×500 (square)
    // fitScale = Math.min(100/500, 100/500) = 0.2
    // dw = 500*0.2 = 100, dh = 500*0.2 = 100
    // dx = 0, dy = 0
    const mockImg = makeImg(500, 500);
    drawImg(mockImg, false, false, 0, 0, 100, 100, 1);

    const callArgs = global.drawingContext.drawImage.mock.calls[0];
    expect(callArgs.length).toBe(9);
    expect(callArgs[1]).toBe(0); // sx = 0
    expect(callArgs[2]).toBe(0); // sy = 0
    expect(callArgs[3]).toBe(500); // sw = full image
    expect(callArgs[4]).toBe(500); // sh = full image
  });
});

const { getCombinedFilters } = require('../p5-collage/cell-renderer');

describe('getCombinedFilters', () => {
  test('returns sepia filter string for sepia type', () => {
    const result = getCombinedFilters('sepia');
    expect(result).toBe('sepia(0.85) contrast(1.1)');
  });

  test('returns grayscale filter string for grayscale type', () => {
    const result = getCombinedFilters('grayscale');
    expect(result).toBe('grayscale(1.0) contrast(1.3)');
  });

  test('returns cyanotype filter string for cyanotype type', () => {
    const result = getCombinedFilters('cyanotype');
    expect(result).toBe('sepia(0.4) saturate(1.9) hue-rotate(180deg) brightness(0.85) contrast(1.2)');
  });

  test('returns polaroid filter string for polaroid type', () => {
    const result = getCombinedFilters('polaroid');
    expect(result).toBe('contrast(1.2) saturate(0.6) brightness(1.15) sepia(0.1)');
  });

  test('returns vintage filter string for vintage type', () => {
    const result = getCombinedFilters('vintage');
    expect(result).toBe('sepia(0.35) saturate(0.7) contrast(0.95) brightness(1.03)');
  });

  test('returns empty string for none type', () => {
    const result = getCombinedFilters('none');
    expect(result).toBe('');
  });

  test('returns empty string for unknown type', () => {
    const result = getCombinedFilters('unknown');
    expect(result).toBe('');
  });
});

describe('adaptCellToImage with authored sizes', () => {
  const SizeClasses = require('../p5-collage/size-classes');
  let adaptCellToImage;

  beforeAll(() => {
    ({ adaptCellToImage } = require('../p5-collage/cell-renderer'));
  });

  beforeEach(() => {
    global.SizeClasses = SizeClasses;
    global.sizeClassesData = { version: 1, classes: { S: 0.015, M: 0.03, L: 0.06, XL: 0.1 }, assignments: { '001': 'M' } };
    global.imageLoader = { fileToKey: { '001.jpg': '001', '002.jpg': '002' }, getInkRatio: () => 0.5 };
    global.CONFIG = { scatterScale: 1 };
  });

  afterEach(() => {
    delete global.SizeClasses;
    delete global.sizeClassesData;
    delete global.imageLoader;
    delete global.CONFIG;
  });

  function cell(imageFile) {
    return {
      img: { naturalWidth: 200, naturalHeight: 100 },
      pos: { x: 0, y: 0, w: 100, h: 50 },
      _layoutX: 0, _layoutY: 0, _layoutW: 100, _layoutH: 50,
      currentImageFile: imageFile || '001.jpg',
    };
  }

  function authoredWidth() {
    return SizeClasses.getAuthoredDrawSize(global.sizeClassesData, '001', 200, 100, 1920, 1080, 0.5).width;
  }

  test('draws the authored class once at the neutral general scale', () => {
    const state = cell();
    expect(adaptCellToImage(state)).toBe(true);
    expect(state._authoredSize).toBe(true);
    expect(state.pos.w / authoredWidth()).toBeGreaterThan(0.97);
    expect(state.pos.w / authoredWidth()).toBeLessThan(1.05);
  });

  test('the general scale multiplies the authored class instead of being ignored', () => {
    global.CONFIG.scatterScale = 2;
    const state = cell();
    adaptCellToImage(state);
    expect(state.pos.w / authoredWidth()).toBeGreaterThan(1.9);
    expect(state.pos.w / authoredWidth()).toBeLessThan(2.2);
    expect(state.pos.h / state.pos.w).toBeCloseTo(0.5, 2);
  });

  test('an unassigned image still fits inside its layout budget whatever the general scale is', () => {
    global.CONFIG.scatterScale = 2;
    const state = cell('002.jpg');
    adaptCellToImage(state);
    expect(state._authoredSize).toBe(false);
    expect(state.pos.w).toBe(100);
    expect(state.pos.h).toBe(50);
  });
});

describe('resolveAnchor', () => {
  let resolveAnchor;

  beforeAll(() => {
    ({ resolveAnchor } = require('../p5-collage/cell-renderer'));
  });

  const frame = (overrides) => Object.assign({
    xPct: 0.98, yPct: 0.5, band: 0.75, minVisible: 0.25, canvasW: 1920, canvasH: 1080,
  }, overrides);

  const rightOverhangFraction = (rect, size) => (rect.x + size - 1920) / size;

  test('a small fragment hangs over the edge by the same fraction of itself as a big one', () => {
    const small = resolveAnchor(frame(), 300, 200);
    const big = resolveAnchor(frame(), 900, 600);
    expect(rightOverhangFraction(small, 300)).toBeCloseTo(rightOverhangFraction(big, 900), 6);
    expect(rightOverhangFraction(small, 300)).toBeCloseTo(0.46, 6);
  });

  test('the bleed starts at the same composition point whatever the size', () => {
    const flushSmall = resolveAnchor(frame({ xPct: 0.75 }), 300, 200);
    const flushBig = resolveAnchor(frame({ xPct: 0.75 }), 900, 600);
    expect(flushSmall.x).toBe(1920 - 300);
    expect(flushBig.x).toBe(1920 - 900);
    expect(resolveAnchor(frame({ xPct: 0.74 }), 300, 200).x + 300).toBeLessThan(1920);
    expect(resolveAnchor(frame({ xPct: 0.74 }), 900, 600).x + 900).toBeLessThan(1920);
  });

  test('centres the fragment on either axis at the middle percentage', () => {
    expect(resolveAnchor(frame({ xPct: 0.5 }), 300, 200).x).toBe((1920 - 300) / 2);
    expect(resolveAnchor(frame({ xPct: 0.5 }), 900, 600).x).toBe((1920 - 900) / 2);
    expect(resolveAnchor(frame({ yPct: 0.5 }), 300, 200).y).toBe((1080 - 200) / 2);
  });

  test('mirrors on the left edge and keeps minVisible on canvas past the bleed limit', () => {
    expect(resolveAnchor(frame({ xPct: 0.25 }), 300, 200).x).toBeCloseTo(0, 10);
    const left = resolveAnchor(frame({ xPct: 0.02 }), 300, 200);
    const right = resolveAnchor(frame({ xPct: 1.1 }), 300, 200);
    expect(-left.x).toBeCloseTo(0.46 * 300, 6);
    expect(1920 - right.x).toBeGreaterThanOrEqual(0.25 * 300 - 1e-9);
  });
});

describe('adaptCellToImage with an edge anchor', () => {
  let adaptCellToImage;
  let resolveAnchor;

  beforeAll(() => {
    ({ adaptCellToImage, resolveAnchor } = require('../p5-collage/cell-renderer'));
  });

  beforeEach(() => {
    global.SizeClasses = require('../p5-collage/size-classes');
    global.sizeClassesData = { version: 1, classes: { S: 0.015, M: 0.03, L: 0.06, XL: 0.1 }, assignments: { '001': 'S' } };
    global.imageLoader = { fileToKey: { '001.jpg': '001' }, getInkRatio: () => 0.5 };
    global.CONFIG = { scatterScale: 1 };
  });

  afterEach(() => {
    delete global.SizeClasses;
    delete global.sizeClassesData;
    delete global.imageLoader;
    delete global.CONFIG;
  });

  const anchor = { xPct: 0.98, yPct: 0.5, band: 0.75, minVisible: 0.25, canvasW: 1920, canvasH: 1080 };

  function cell(extra) {
    return Object.assign({
      img: { naturalWidth: 200, naturalHeight: 100 },
      pos: { x: 10, y: 20, w: 100, h: 50 },
      _layoutX: 0, _layoutY: 0, _layoutW: 100, _layoutH: 50,
      currentImageFile: '001.jpg',
      _anchor: anchor,
    }, extra);
  }

  test('places an authored fragment on its own edge anchor, not on the layout box centre', () => {
    const state = cell();
    adaptCellToImage(state, 'layout');
    const expected = resolveAnchor(anchor, state.pos.w, state.pos.h);
    expect(state.pos.x).toBe(Math.round(expected.x));
    expect(state.pos.y).toBe(Math.round(expected.y));
    expect(state.pos.x + state.pos.w).toBeGreaterThan(1920);
  });

  test('a cell the operator dragged keeps its own centre when its image changes', () => {
    const state = cell({ _userMoved: true });
    adaptCellToImage(state);
    expect(state.pos.x).toBe(Math.round(10 + 100 / 2 - state.pos.w / 2));
  });

  test('the image cycle re-anchors an untouched cell, so a smaller class still bleeds', () => {
    const state = cell();
    adaptCellToImage(state);
    const expected = resolveAnchor(anchor, state.pos.w, state.pos.h);
    expect(state.pos.x).toBe(Math.round(expected.x));
  });

  test('without an anchor the layout box still decides', () => {
    const state = cell({ _anchor: null });
    adaptCellToImage(state, 'layout');
    expect(state.pos.x).toBe(Math.round(0 + 100 / 2 - state.pos.w / 2));
  });
});

describe('cell-renderer public surface', () => {
  test('no longer exports the retired torn-border geometry', () => {
    const renderer = require('../p5-collage/cell-renderer');
    expect(Object.keys(renderer).sort()).toEqual(['adaptCellToImage', 'drawImg', 'getCombinedFilters', 'resolveAnchor']);
  });
});
