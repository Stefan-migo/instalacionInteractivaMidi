const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('brand mark placements', () => {
  test('the phone header embeds vector geometry without a hardcoded white fill', () => {
    const html = read('phone-client/index.html');
    expect(html).toMatch(/<svg\b[^>]*>[\s\S]*?<path\b[^>]*\bd="[^"]+"/);
    expect(html).not.toContain('fill="#ffffff"');
  });

  // The canvas is the artwork's field, not a place for the studio's watermark:
  // the mark is gone, so neither the module, the script tag nor the call site
  // survive.
  test('the projector paints no brand mark behind the fragments', () => {
    const sketch = read('p5-collage/sketch.js');
    expect(sketch).not.toMatch(/drawBrandMark\s*\(/);
    expect(sketch).not.toMatch(/brandMarkColor\s*\(/);
    const html = read('p5-collage/index.html');
    expect(html).not.toMatch(/brand-mark\.js/);
    expect(html).not.toContain('id="brand-mark"');
  });

  // The QR was the public's door into the phone client. It is out of the
  // artwork: nothing in the projector page may reach a third-party QR service.
  test('the projector page carries no join QR', () => {
    const html = read('p5-collage/index.html');
    expect(html).not.toMatch(/qr-wrapper/);
    expect(html).not.toMatch(/qr-img/);
    expect(html).not.toMatch(/qrserver/);
    expect(html).not.toMatch(/Escaneá para conectar/);
  });

  test('the phone header carries the mark and drops the fragment label', () => {
    const html = read('phone-client/index.html');
    expect(html).not.toMatch(/class="slot-label"/);
    expect(html).toMatch(/<svg[^>]*class="header-mark"[^>]*aria-label="MIDI"/);
    const css = read('phone-client/style.css');
    expect(css).toMatch(/\.header-mark\s*\{[^}]*fill:\s*currentColor/s);
  });
});
