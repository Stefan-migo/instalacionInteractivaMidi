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
});
