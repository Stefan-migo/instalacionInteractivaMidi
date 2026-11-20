/**
 * The projector canvas is the artwork's field: the identity paper tone with a
 * subtle paper grain over it, and the grain stays drivable from the operator.
 */
const fs = require('fs');
const path = require('path');

const { CONFIG } = require('../p5-collage/config');

const SKETCH = fs.readFileSync(path.join(__dirname, '..', 'p5-collage', 'sketch.js'), 'utf8');

describe('Canvas background', () => {
  test('asks for the paper shader at a subtle default intensity', () => {
    expect(CONFIG.canvasBgStyle).toBe('shader-paper');
    // Subtle: visible as paper, never as grain or as a pattern.
    expect(CONFIG.noiseIntensity).toBeGreaterThan(0);
    expect(CONFIG.noiseIntensity).toBeLessThanOrEqual(0.5);
  });

  // The shader is a grain layer now, so the style must not change the canvas
  // colour: the paper tone is the same one the phone client paints.
  test('paints the texture over the identity paper tone, not a second colour', () => {
    expect(SKETCH).toMatch(/'shader-paper':\s*\[\s*244,\s*244,\s*244\s*\]/);
    expect(SKETCH).toMatch(/'solid':\s*\[\s*244,\s*244,\s*244\s*\]/);
  });

  // The texture is rendered once and cached; a cache keyed only on "is it
  // null?" froze the operator's slider at whatever intensity booted the page.
  test('rebuilds the texture when the operator changes the intensity', () => {
    expect(SKETCH).toMatch(/_bgIntensity\s*!==\s*CONFIG\.noiseIntensity/);
    expect(SKETCH).toMatch(/_bgIntensity\s*=\s*CONFIG\.noiseIntensity/);
  });
});
