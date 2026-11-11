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

  // Regression: the z-order row is the pair of opposites, so a fragment can come
  // forward and go back without hunting across rows.
  test('Al frente and Enviar atrás share one row', () => {
    const pairs = buttonPairs(read('phone-client/index.html')).map(buttonsIn);
    const shared = pairs.find(ids => ids.includes('bring-front-btn'));
    expect(shared).toBeDefined();
    expect(shared).toContain('send-back-btn');
    expect(shared).toHaveLength(2);
  });

  test('the controls the handlers bind to still exist', () => {
    const html = read('phone-client/index.html');
    const app = read('phone-client/app.js');
    const ids = [
      'bring-front-btn', 'send-back-btn', 'filter-btn', 'reubicar-btn',
      'change-photo-btn', 'wizard-trigger',
    ];
    for (const id of ids) {
      expect(html).toContain(`id="${id}"`);
      expect(app).toContain(`'${id}'`);
    }
  });

  // Regression: the action grid was three columns while every child was a
  // two-button pair, so every row kept an empty third column on the right.
  test('the action grid is two columns wide so a pair never leaves a gap', () => {
    const css = read('phone-client/style.css');
    const actions = css.match(/\.row-actions\s*\{([^}]*)\}/s);
    expect(actions).not.toBeNull();
    expect(actions[1]).toMatch(/grid-template-columns:\s*repeat\(2,\s*1fr\)/);
    const pair = css.match(/\.button-pair\s*\{([^}]*)\}/s);
    expect(pair).not.toBeNull();
    expect(pair[1]).toMatch(/grid-column:\s*span\s*2/);
  });
});
