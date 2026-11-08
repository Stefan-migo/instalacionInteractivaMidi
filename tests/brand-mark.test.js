const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('brand mark placements', () => {
  test('canvas mark token stays white in light theme for the near-black shader', () => {
    const theme = read('shared/theme.css');
    expect(theme).toMatch(/:root\s*\{[^}]*--mark-on-canvas:\s*#ffffff\s*;/s);
    const light = theme.match(/:root\[data-theme="light"\]\s*\{([^}]*)\}/s);
    expect(light).not.toBeNull();
    expect(light[1]).not.toMatch(/--mark-on-canvas\s*:/);
  });

  test('the phone header embeds vector geometry without a hardcoded white fill', () => {
    const html = read('phone-client/index.html');
    expect(html).toMatch(/<svg\b[^>]*>[\s\S]*?<path\b[^>]*\bd="[^"]+"/);
    expect(html).not.toContain('fill="#ffffff"');
  });

  // Regression: the mark was a DOM overlay above the canvas, so no fragment could
  // ever cover it. It is now part of the canvas composite, on the paper.
  test('the collage no longer carries a DOM overlay for the mark', () => {
    const html = read('p5-collage/index.html');
    expect(html).not.toContain('id="brand-mark"');
    expect(html).toMatch(/<script src="\/p5-collage\/brand-mark\.js"><\/script>/);
    expect(html.indexOf('brand-mark.js')).toBeLessThan(html.indexOf('sketch.js'));
  });

  test('the mark is painted after the paper texture and before the cells', () => {
    const sketch = read('p5-collage/sketch.js');
    const texture = sketch.indexOf('image(_bgTexture, 0, 0)');
    const mark = sketch.indexOf('drawBrandMark(');
    const cells = sketch.indexOf('drawGrid(dt)');
    expect(texture).toBeGreaterThan(-1);
    expect(mark).toBeGreaterThan(texture);
    expect(cells).toBeGreaterThan(mark);
  });

  test('the canvas mark takes its colour from the --mark-on-canvas token and stays translucent', () => {
    const sketch = read('p5-collage/sketch.js');
    expect(sketch).toMatch(/--mark-on-canvas/);
    const call = sketch.slice(sketch.indexOf('drawBrandMark(drawingContext'), sketch.indexOf('drawGrid(dt)'));
    expect(call).toMatch(/opacity:\s*0\.6/);
  });

  test('the collage geometry ships as inline path data, since Logo/ is not published', () => {
    const module = read('p5-collage/brand-mark.js');
    expect(module).toMatch(/M37 0h462v192h-462z/);
    expect(module).not.toMatch(/\.(png|jpe?g|svg)['"]/);
  });

  test('the phone header carries the mark and drops the fragment label', () => {
    const html = read('phone-client/index.html');
    expect(html).not.toMatch(/class="slot-label"/);
    expect(html).toMatch(/<svg[^>]*class="header-mark"[^>]*aria-label="MIDI"/);
    const css = read('phone-client/style.css');
    expect(css).toMatch(/\.header-mark\s*\{[^}]*fill:\s*currentColor/s);
  });
});
