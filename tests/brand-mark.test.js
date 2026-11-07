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

  test.each(['p5-collage/index.html', 'phone-client/index.html'])('%s embeds vector geometry without a hardcoded white fill', (file) => {
    const html = read(file);
    expect(html).toMatch(/<svg\b[^>]*>[\s\S]*?<path\b[^>]*\bd="[^"]+"/);
    expect(html).not.toContain('fill="#ffffff"');
  });

  test('collage watermark cannot intercept interaction and remains translucent', () => {
    const html = read('p5-collage/index.html');
    const markStyle = html.match(/#brand-mark\s*\{([^}]*)\}/s);
    expect(markStyle).not.toBeNull();
    expect(markStyle[1]).toMatch(/pointer-events:\s*none/);
    expect(markStyle[1]).toMatch(/opacity:\s*\.6\b/);
  });

  // Regression: the mark shipped invisible once. #brand-mark was placed on the <svg>
  // itself, so the "#brand-mark svg" rule never matched, no fill was applied, and the
  // path fell back to SVG's default black on a near-black canvas. The wrapper shape is
  // now part of the contract because the styling rule depends on it.
  test('the collage mark is a wrapper around the svg, so its fill rule can match', () => {
    const html = read('p5-collage/index.html');
    expect(html).not.toMatch(/<svg[^>]*\bid="brand-mark"/);
    expect(html).toMatch(/<[a-z]+[^>]*\bid="brand-mark"[^>]*>\s*<svg\b/s);
    const fillRule = html.match(/#brand-mark svg\s*\{([^}]*)\}/s);
    expect(fillRule).not.toBeNull();
    expect(fillRule[1]).toMatch(/fill:\s*currentColor/);
  });

  test('the phone header carries the mark and drops the fragment label', () => {
    const html = read('phone-client/index.html');
    expect(html).not.toMatch(/class="slot-label"/);
    expect(html).toMatch(/<svg[^>]*class="header-mark"[^>]*aria-label="MIDI"/);
    const css = read('phone-client/style.css');
    expect(css).toMatch(/\.header-mark\s*\{[^}]*fill:\s*currentColor/s);
  });
});
