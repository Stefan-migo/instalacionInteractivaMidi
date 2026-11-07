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

describe('cell-renderer public surface', () => {
  test('no longer exports the retired torn-border geometry', () => {
    const renderer = require('../p5-collage/cell-renderer');
    expect(Object.keys(renderer).sort()).toEqual(['adaptCellToImage', 'drawImg', 'getCombinedFilters']);
  });
});
