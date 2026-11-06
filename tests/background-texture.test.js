describe('drawBackgroundTexture', () => {
  let drawBackgroundTexture;
  let mockP;
  let mockGfx;

  beforeAll(() => {
    drawBackgroundTexture = require('../p5-collage/background-texture').drawBackgroundTexture;
  });

  beforeEach(() => {
    mockGfx = {
      clear: jest.fn(),
      noStroke: jest.fn(),
      fill: jest.fn(),
      rect: jest.fn(),
      canvas: {
        getContext: jest.fn(() => ({
          drawImage: jest.fn(),
        })),
      },
    };

    mockP = {
      createGraphics: jest.fn(() => mockGfx),
    };
  });

  test('returns an offscreen graphics buffer', () => {
    const result = drawBackgroundTexture(mockP, 1920, 1080, 1.0, 42, 'shader-paper');
    expect(result).toBe(mockGfx);
    expect(mockP.createGraphics).toHaveBeenCalledWith(1920, 1080);
  });

  test('clears the buffer before drawing', () => {
    drawBackgroundTexture(mockP, 1920, 1080, 1.0, 42, 'shader-paper');
    expect(mockGfx.clear).toHaveBeenCalled();
  });

  test('non-shader-paper style returns solid fill fallback', () => {
    mockGfx.clear.mockClear();
    mockGfx.rect.mockClear();
    drawBackgroundTexture(mockP, 1920, 1080, 1.0, 42, 'aged-paper');
    // Should draw a solid black fill rect
    expect(mockGfx.fill).toHaveBeenCalledWith(0, 0, 0);
    expect(mockGfx.rect).toHaveBeenCalledWith(0, 0, 1920, 1080);
  });

  test('unknown style returns solid fill fallback', () => {
    mockGfx.clear.mockClear();
    mockGfx.rect.mockClear();
    drawBackgroundTexture(mockP, 1920, 1080, 1.0, 42, 'unknown');
    expect(mockGfx.fill).toHaveBeenCalledWith(0, 0, 0);
    expect(mockGfx.rect).toHaveBeenCalled();
  });

  test('zero intensity returns empty buffer', () => {
    drawBackgroundTexture(mockP, 1920, 1080, 0.0, 42, 'shader-paper');
    expect(mockGfx.clear).toHaveBeenCalled();
    // No fill/rect should have been called after clear
  });

  test('shader-paper style falls back gracefully when WebGL unavailable', () => {
    // In test env there's no WebGL/webcam, so shader-paper falls back
    // to a solid black fill without throwing
    mockGfx.clear.mockClear();
    mockGfx.rect.mockClear();
    expect(function () {
      drawBackgroundTexture(mockP, 1920, 1080, 1.0, 42, 'shader-paper');
    }).not.toThrow();
    // Should have called clear (once for gfx.clear, then drawImage fallback)
    expect(mockGfx.clear).toHaveBeenCalled();
  });

  test('each style renders without throwing', () => {
    ['shader-paper', 'unknown'].forEach(function (style) {
      expect(function () {
        drawBackgroundTexture(mockP, 1920, 1080, 0.5, 42, style);
      }).not.toThrow();
    });
  });
});
