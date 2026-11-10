const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('Operator MIDI routing section', () => {
  const html = read('operator/index.html');
  const css = read('operator/operator.css');
  const js = read('operator/operator.js');

  test('declares section 07 and own-window mode', () => {
    expect(html).toMatch(/07 · Ruteo MIDI/);
    expect(html).toMatch(/section=routing/);
  });

  test('declares ten groups with fixed channel and note pairs, never numbered pads', () => {
    for (let group = 1; group <= 10; group += 1) {
      for (const [gesture, note] of [['tilt', 36], ['flick', 37], ['rotation', 38]]) {
        expect(js).toMatch(new RegExp(`group: ${group}, channel: ${group}[^}]*notes: \\{ tilt: 36, flick: 37, rotation: 38 \\}`));
      }
    }
    expect(html).not.toMatch(/pad\s*\d+/i);
  });

  test('explains note versus CC and read-only boundary', () => {
    expect(html).toContain('Los gestos mandan notas. El movimiento continuo manda CC.');
    expect(html).toMatch(/explica qué mapear[\s\S]*no modifica el mapa MIDI de Ableton/i);
  });

  test('provides guided mapping controls and POST emission contract', () => {
    expect(html).toMatch(/routing-step-counter/);
    for (const label of ['Anterior', 'Enviar', 'Siguiente']) expect(html).toContain(label);
    expect(js).toMatch(/fetch\(['"]\/api\/music\/emit['"]/);
    expect(js).toContain("output: 'note'");
    expect(js).toContain("output: 'cc'");
    expect(js).toContain('controller:');
    expect(js).toContain('topologia');
  });

  test('routing styles use no radius or shadow declarations', () => {
    const routing = css.match(/\/\* MIDI ROUTING START \*\/[\s\S]*?\/\* MIDI ROUTING END \*\//);
    expect(routing).not.toBeNull();
    expect(routing[0]).not.toMatch(/border-radius|box-shadow/i);
  });

  test('explains the symptom in words instead of printing the code', () => {
    expect(js).toMatch(/var ROUTING_SYMPTOMS = \{/);
    for (const code of ['sin-mapeo', 'sin-agente', 'sin-puerto', 'sin-actividad']) {
      expect(js).toContain(code);
    }
    expect(js).toMatch(/El agente no está corriendo/);
    expect(js).toMatch(/no está abierto/);
    expect(js).not.toMatch(/' \+ s\.symptom/);
  });

  test('reads music state without writing to the endpoint', () => {
    expect(js).toMatch(/fetch\(['"]\/api\/music['"]/);
    expect(js).not.toMatch(/fetch\(['"]\/api\/music['"][\s\S]{0,300}method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  });
});
