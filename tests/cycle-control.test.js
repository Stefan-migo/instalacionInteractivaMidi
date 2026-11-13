const operatorPage = require('../operator/operator');
const { applyCommand, makeSnapshot } = require('../p5-collage/operator-link');

describe('cycle control', () => {
  test('the operator sends one command for start and one for stop', () => {
    expect(operatorPage.cycleCommand(true)).toEqual({ type: 'setCycle', running: true });
    expect(operatorPage.cycleCommand(false)).toEqual({ type: 'setCycle', running: false });
    expect(operatorPage.COMMAND_TYPES).toContain('setCycle');
  });

  test('the button label says whether the cycle is running', () => {
    expect(operatorPage.cycleLabel(true)).toBe('Ciclo: andando');
    expect(operatorPage.cycleLabel(false)).toBe('Ciclo: detenido');
  });

  test('the command reaches the projector instead of being silently dropped', () => {
    const calls = [];
    const api = {
      deviceManager: { renderer: { cellStates: {} }, layoutEngine: {}, _recalculateLayout: () => calls.push(['layout']) },
      CONFIG: { scatterScale: 1, noiseIntensity: 0.8 },
      setScatterScale: value => calls.push(['scale', value]),
      setCycle: running => calls.push(['cycle', running]),
      getSortedSlots: () => [],
      redraw: () => calls.push(['redraw']),
      publish: () => calls.push(['publish']),
    };
    expect(applyCommand({ type: 'setCycle', running: true }, api)).toBe(true);
    expect(applyCommand({ type: 'setCycle', running: false }, api)).toBe(true);
    expect(calls).toEqual(expect.arrayContaining([['cycle', true], ['cycle', false]]));
  });

  test('the scatter command goes through the projector scale path so the cycle and the slider agree', () => {
    const calls = [];
    const api = {
      deviceManager: { renderer: { cellStates: {} }, layoutEngine: {}, _recalculateLayout: () => calls.push(['layout']) },
      CONFIG: { scatterScale: 1, noiseIntensity: 0.8 },
      setScatterScale: value => calls.push(['scale', value]),
      getSortedSlots: () => [],
      redraw: () => calls.push(['redraw']),
      publish: () => calls.push(['publish']),
    };
    expect(applyCommand({ type: 'setScatterScale', value: 1.35 }, api)).toBe(true);
    expect(calls).toContainEqual(['scale', 1.35]);
  });

  test('the operator state carries the cycle so the button cannot lie', () => {
    const api = {
      deviceManager: { renderer: { cellStates: {} }, layoutEngine: { getCurrentPreset: () => 'scatter' } },
      collageLayout: { cells: [{ slot: 1, imageFile: '001.jpg' }] },
      CONFIG: { scatterScale: 1.2, noiseIntensity: 0.5 },
      selectedSlot: null,
      getSortedSlots: () => [],
      cycleState: () => ({ running: true, dwell: 30, steps: [0.7, 1], scale: 1.2 }),
    };
    expect(makeSnapshot(api).cycle).toEqual({ running: true, dwell: 30, steps: [0.7, 1], scale: 1.2 });
  });
});

// The timer and its wiring only exist in the browser, so the suite pins the glue
// the same way the size-class wiring is pinned: a feature that ships without its
// button or its setup call is the defect class this project keeps hitting.
describe('cycle wiring', () => {
  const fs = require('fs');
  const path = require('path');
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

  test('the projector loads the cycle in setup and steps it on the authored dwell', () => {
    const sketch = read('p5-collage/sketch.js');
    expect(sketch).toContain('loadCycleSpec();');
    expect(sketch).toContain('cycleSpec.dwell * 1000');
    expect(sketch).toContain('applyScatterScale(next.scale)');
    expect(read('p5-collage/operator-link.js')).toContain("case 'setCycle'");
  });

  test('the operator ships the button it talks about', () => {
    const html = read('operator/index.html');
    expect(html).toContain('id="cycle-toggle"');
    expect(read('operator/operator.js')).toContain("getElementById('cycle-toggle')");
  });

  test('the bridge serves the cycle next to sizes and deck', () => {
    expect(read('bridge/index.js')).toContain("pathname === '/api/cycle'");
  });
});
