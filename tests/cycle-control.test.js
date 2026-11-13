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

/**
 * The cycle only runs if the page actually loads `cycle-steps.js`: without it the
 * sketch's try/catch swallows a ReferenceError, cycleSpec stays null and the wall
 * silently never rearranges. This loads exactly the scripts `index.html` declares
 * into a sandbox, so a forgotten <script> tag fails here instead of on the wall.
 */
describe('the projector page really loads the cycle module', () => {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const listed = () => [...read('p5-collage/index.html').matchAll(/<script src="\/p5-collage\/([\w.-]+\.js)"><\/script>/g)].map(match => match[1]);

  test('every projector module that exposes a browser global is declared by the page', () => {
    const dir = path.join(__dirname, '..', 'p5-collage');
    const withGlobal = fs.readdirSync(dir)
      .filter(file => file.endsWith('.js'))
      .filter(file => /(?:window|root)\.[A-Z]\w*\s*=/.test(read(`p5-collage/${file}`)));
    expect(withGlobal.length).toBeGreaterThan(3);
    const declared = listed();
    for (const file of withGlobal) expect({ file, declared: declared.includes(file) }).toEqual({ file, declared: true });
  });

  test('loading only what the page declares produces a working cycle spec', async () => {
    const context = { console, deviceManager: null, redraw: () => {}, setInterval: () => 1, clearInterval: () => {} };
    context.window = context;
    context.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(read('images/cycle.json'))) });
    vm.createContext(context);
    for (const file of ['config.js', 'cycle-steps.js', 'sketch.js']) {
      expect({ file, declared: listed().includes(file) }).toEqual({ file, declared: true });
      vm.runInContext(read(`p5-collage/${file}`), context, { filename: file });
    }
    await vm.runInContext('loadCycleSpec()', context);
    expect(vm.runInContext('typeof CycleSteps', context)).toBe('object');
    expect(vm.runInContext('cycleSpec && cycleSpec.steps.length', context)).toBe(4);
    vm.runInContext('stopCycle()', context);
  });
});
