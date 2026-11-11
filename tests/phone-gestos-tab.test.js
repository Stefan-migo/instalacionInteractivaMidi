const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('phone Gestos tab', () => {
  // Regression: the tab offered to record a gesture, and the wizard that did it
  // taught nothing a visitor could use in the ten minutes they stand there.
  test('the phone no longer offers to create a gesture', () => {
    const html = read('phone-client/index.html');
    const app = read('phone-client/app.js');
    expect(html).not.toContain('id="create-gesture-btn"');
    expect(html).not.toContain('id="wizard-overlay"');
    expect(html).not.toContain('Crear mi gesto');
    expect(app).not.toMatch(/record-start|record-stop/);
  });

  // Nothing can start a recording any more, so the chips that only ever appeared
  // during one are dead weight in the HUD.
  test('nothing is left that could show a recording state', () => {
    const html = read('phone-client/index.html');
    const css = read('phone-client/style.css');
    const app = read('phone-client/app.js');
    expect(html).not.toContain('id="rec-indicator"');
    expect(html).not.toContain('id="gesture-status"');
    expect(css).not.toMatch(/\.rec-indicator|\.gesture-status|\.wizard-|\.duration-btn/);
    expect(app).not.toMatch(/showGestureStatus|hideGestureStatus/);
  });

  test('the tab teaches the pad instead: pinch scales, two fingers rotate', () => {
    const html = read('phone-client/index.html');
    const css = read('phone-client/style.css');
    const note = html.match(/<div class="pad-note">([\s\S]*?)<\/div>/);
    expect(note).not.toBeNull();
    expect(note[1]).toMatch(/pellizcá para escalar/);
    expect(note[1]).toMatch(/girá para rotar/);
    expect(css).toMatch(/\.pad-note\s*\{/);
  });

  // The sheet is short on vertical room; a label above the sentence repeated
  // what the sentence already says.
  test('the pad note is one sentence, with no heading above it', () => {
    const html = read('phone-client/index.html');
    const css = read('phone-client/style.css');
    expect(html).not.toContain('pad-note-title');
    expect(html).not.toContain('Pad táctil');
    expect(css).not.toMatch(/\.pad-note-title/);
  });

  test('the three gestures keep their card and their practice button', () => {
    const html = read('phone-client/index.html');
    for (const gesture of ['inclinar', 'latigo', 'twist']) {
      const card = html.match(new RegExp(`<div class="gesture-card" data-gesture="${gesture}">([\\s\\S]*?)</div>`));
      expect(card).not.toBeNull();
      expect(card[1]).toContain(`data-gesture="${gesture}"`);
      expect(card[1]).toMatch(/Practicar/);
    }
  });
});
