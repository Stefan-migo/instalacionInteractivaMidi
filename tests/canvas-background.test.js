/**
 * The projector canvas is the artwork surface, not UI chrome: it has to be the
 * identity paper tone with no paper shader, so fragments read the same way they
 * do on the phone client.
 */
const fs = require('fs');
const path = require('path');

const { CONFIG } = require('../p5-collage/config');

const SKETCH = fs.readFileSync(path.join(__dirname, '..', 'p5-collage', 'sketch.js'), 'utf8');
const THEME = fs.readFileSync(path.join(__dirname, '..', 'shared', 'theme.css'), 'utf8');

describe('Canvas background', () => {
  test('asks for a solid canvas and no paper texture', () => {
    expect(CONFIG.canvasBgStyle).toBe('solid');
    expect(CONFIG.noiseIntensity).toBe(0);
  });

  test('paints the solid canvas in the identity paper tone', () => {
    expect(SKETCH).toMatch(/'solid':\s*\[\s*244,\s*244,\s*244\s*\]/);
  });

  test('keeps the brand mark visible against the light canvas', () => {
    // The mark was #f4f4f4 while the canvas was near-black. On a paper-toned
    // canvas that is the same value as the background, so it disappears.
    expect(THEME).toMatch(/--mark-on-canvas:\s*#111111/);
    // Same reason for the headless fallback: it must not be white either.
    expect(SKETCH).toMatch(/let color = '#111111';/);
    expect(SKETCH).not.toMatch(/let color = '#ffffff';/);
  });
});
