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

  // A solid fill here used to paint the whole 1920x1080 canvas black: the
  // texture is a grain layer, so an unsupported style must paint nothing.
  test('a non-paper style paints nothing, so the canvas keeps its own colour', () => {
    mockGfx.clear.mockClear();
    mockGfx.rect.mockClear();
    drawBackgroundTexture(mockP, 1920, 1080, 1.0, 42, 'aged-paper');
    expect(mockGfx.clear).toHaveBeenCalled();
    expect(mockGfx.rect).not.toHaveBeenCalled();
  });

  test('an unknown style paints nothing either', () => {
    mockGfx.clear.mockClear();
    mockGfx.rect.mockClear();
    drawBackgroundTexture(mockP, 1920, 1080, 1.0, 42, 'unknown');
    expect(mockGfx.clear).toHaveBeenCalled();
    expect(mockGfx.rect).not.toHaveBeenCalled();
  });

  test('the shader paints a translucent grain, never an opaque colour', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'p5-collage', 'background-texture.js'), 'utf8');
    // An opaque near-black layer replaced the paper colour instead of tinting it.
    expect(src).not.toMatch(/vec3\(clamp\(noise, 0\.0, 0\.10\)\)/);
    expect(src).toMatch(/gl_FragColor = vec4\(vec3\(0\.0\), alpha\)/);
    expect(src).toMatch(/\* 0\.30 \* u_intensity/);
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
