const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

/** The guide's numbered steps, with any inline emphasis stripped. */
function helpSteps(html) {
  const list = html.match(/<ol class="help-list">([\s\S]*?)<\/ol>/);
  if (!list) return [];
  return [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, '').trim());
}

describe('phone sheet navigation', () => {
  test('the guide lists the seven steps in the order the phone is used', () => {
    expect(helpSteps(read('phone-client/index.html'))).toEqual([
      'Arrastrá sobre la imagen para mover tu fragmento en el collage',
      'Dos toques rápidos para ascender tu fragmento al frente',
      'Incliná hacia adelante → saltás a otra celda del collage',
      'Sacudí → cambia foto',
      'Girá como perilla → cambia filtro',
      'Revisá la pestaña controles para más opciones',
      'Revisá la pestaña gestos para más información',
    ]);
  });

  // Regression: the tab was called "Forma", a word the guide never uses and that
  // says nothing about what the panel holds.
  test('the first tab is called Controles under one identifier', () => {
    const html = read('phone-client/index.html');
    expect(html).toMatch(/data-tab="controles"[^>]*>Controles</);
    expect(html).toMatch(/data-panel="controles"/);
    expect(html).not.toMatch(/data-tab="forma"/);
    expect(html).not.toMatch(/data-panel="forma"/);
  });

  // Regression: openHelp() opened the guide and the document-level "tap outside"
  // listener collapsed it again in the same click, so ? looked broken.
  test('? opens the guide, and collapses it only when the guide is already open', () => {
    const app = read('phone-client/app.js');

    const openHelp = app.match(/function openHelp\(\) \{([\s\S]*?)\n  \}/);
    expect(openHelp).not.toBeNull();
    expect(openHelp[1]).toMatch(/setTools\(false\)/);
    expect(openHelp[1]).toMatch(/selectSheetTab\('guia'\)/);

    const outsideTap = app.match(/document\.addEventListener\('click', function \(e\) \{([\s\S]*?)\n  \}\);/);
    expect(outsideTap).not.toBeNull();
    expect(outsideTap[1]).toMatch(/helpBtn/);
  });
});
