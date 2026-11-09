const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

/** Every `<div class="button-pair">…</div>` block in the tools panel. */
function buttonPairs(html) {
  return [...html.matchAll(/<div class="button-pair">([\s\S]*?)<\/div>/g)].map(match => match[1]);
}

function buttonsIn(block) {
  return [...block.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
}

describe('phone tools panel layout', () => {
  test('a two-column row never keeps a single button, which would leave a gap', () => {
    const pairs = buttonPairs(read('phone-client/index.html'));
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      expect(buttonsIn(pair)).toHaveLength(2);
    }
  });

  // Regression: removing the border button left Filtro alone in its half-width
  // row while Ascender had a full-width row of its own.
  test('Ascender and Filtro share one row', () => {
    const pairs = buttonPairs(read('phone-client/index.html')).map(buttonsIn);
    const shared = pairs.find(ids => ids.includes('bring-front-btn'));
    expect(shared).toBeDefined();
    expect(shared).toContain('filter-btn');
    expect(shared).toHaveLength(2);
  });

  test('the controls the handlers bind to still exist', () => {
    const html = read('phone-client/index.html');
    const app = read('phone-client/app.js');
    const ids = ['bring-front-btn', 'filter-btn', 'cell-prev-btn', 'cell-next-btn', 'wizard-trigger'];
    for (const id of ids) {
      expect(html).toContain(`id="${id}"`);
      expect(app).toContain(`'${id}'`);
    }
  });
});
