const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('the tilt gesture jumps the fragment to another cell', () => {
  test('the tilt is mapped to the transito action the bridge already owns', () => {
    const app = read('phone-client/app.js');
    const map = app.match(/var gestureActionMap = \{([\s\S]*?)\};/);
    expect(map).not.toBeNull();
    expect(map[1]).toMatch(/inclinar:\s*'cell-next'/);
    // Látigo is not a jump: it pulls a new photo into this cell, the same action
    // the "Otra foto" button sends. `shuffle` swapped two cells, which read as a
    // second jump and made the two gestures indistinguishable on the device.
    expect(map[1]).toMatch(/latigo:\s*'cycle-next'/);
    expect(map[1]).toMatch(/twist:\s*'filter-next'/);
  });

  test('the action the gesture sends is accepted by the protocol', () => {
    const { VALID_ACTIONS } = require('../bridge/message-relay');
    expect(VALID_ACTIONS).toContain('cell-next');
  });

  test('the gallery teaches the gesture again, with its real effect', () => {
    const html = read('phone-client/index.html');
    const card = html.match(/<div class="gesture-card" data-gesture="inclinar">([\s\S]*?)<\/div>/);
    expect(card).not.toBeNull();
    expect(card[1]).toMatch(/Inclinar/);
    expect(card[1]).toMatch(/saltás de celda/);
    expect(card[1]).not.toMatch(/borde/i);
  });

  test('the help list explains it without promising borders', () => {
    const html = read('phone-client/index.html');
    expect(html).toMatch(/<li>Incliná hacia adelante → saltás a otra celda del collage<\/li>/);
    expect(html).not.toMatch(/cambia borde/i);
  });

  test('the practice overlay has instruction text for the tilt', () => {
    const app = read('phone-client/app.js');
    const instructions = app.match(/var gestureInstructions = \{([\s\S]*?)\};/);
    expect(instructions).not.toBeNull();
    expect(instructions[1]).toMatch(/inclinar:\s*'Incliná el teléfono hacia adelante/);
  });
});
