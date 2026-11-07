const fs = require('fs');
const path = require('path');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('connected-device counter placement', () => {
  test('the projector page no longer shows a connection counter', () => {
    const collage = read('p5-collage/index.html');
    expect(collage).not.toContain('status-hud');
    expect(collage).not.toContain('Conectados');
  });

  test('the projection sketch no longer maintains a connection HUD', () => {
    const sketch = read('p5-collage/sketch.js');
    expect(sketch).not.toContain('updateHUD');
    expect(sketch).not.toContain('status-hud');
  });

  test('the operator page owns the counter', () => {
    const operator = read('operator/index.html');
    expect(operator).toContain('id="connection"');
    expect(read('operator/operator.js')).toContain("'Conectados: ' + state.connected + ' / ' + state.total");
  });
});
