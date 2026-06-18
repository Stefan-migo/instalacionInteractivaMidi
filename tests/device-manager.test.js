const { CollageLayout } = require('../p5-collage/collage-layout');
const { SensorMapper } = require('../p5-collage/sensor-mapper');

const CONFIG = {
  movementThreshold: 0.5,
};

const layoutData = {
  canvas: { w: 1920, h: 1080 },
  totalSlots: 30,
  cells: [
    { slot: 0, cellId: 'cell_00', x: 0, y: 0, w: 400, h: 300, rotation: 0, zIndex: 1, borderStyle: 'torn', imageId: '001', imageFile: '001.jpg' },
    { slot: 1, cellId: 'cell_01', x: 100, y: 100, w: 300, h: 250, rotation: 2, zIndex: 2, borderStyle: 'torn', imageId: '002', imageFile: '002.jpg' },
  ],
};

function makeRenderer(methods) {
  return {
    initCell: jest.fn(),
    removeCell: jest.fn(),
    updateFromSensor: jest.fn(),
    handleAction: jest.fn(),
    updateCellPosition: jest.fn(),
    cellStates: {},
    ...methods,
  };
}

function makeDM(renderer, layoutEngine) {
  const layout = new CollageLayout(layoutData);
  const sensorMapper = new SensorMapper(CONFIG);
  const { DeviceManager } = require('../p5-collage/device-manager');
  return new DeviceManager(layout, renderer || makeRenderer(), sensorMapper, { get: () => null }, layoutEngine);
}

function makeStubEngine() {
  return {
    compute: jest.fn(() => layoutData.cells.map(c => ({
      slot: c.slot, x: c.x, y: c.y, w: c.w, h: c.h, rotation: c.rotation,
      scale: 1.0, opacity: 1.0, filterType: 'none', blendMode: 'normal', zIndex: c.slot,
    }))),
    getPresets: () => ['scatter'],
    setPreset: jest.fn(),
    getCurrentPreset: () => 'scatter',
    scatterScale: 1.0,
  };
}

describe('DeviceManager', () => {
  test('initAll initializes all cells and recalculates layout', () => {
    const renderer = makeRenderer();
    const engine = makeStubEngine();
    const dm = makeDM(renderer, engine);

    dm.initAll();

    // Should init ALL cells
    expect(renderer.initCell).toHaveBeenCalledTimes(layoutData.cells.length);
    expect(renderer.initCell).toHaveBeenCalledWith(0, layoutData.cells[0]);
    expect(renderer.initCell).toHaveBeenCalledWith(1, layoutData.cells[1]);

    // Should compute positions for ALL cells
    expect(engine.compute).toHaveBeenCalledWith(layoutData.cells);

    // Should update positions for each cell
    expect(renderer.updateCellPosition).toHaveBeenCalledTimes(layoutData.cells.length);
  });

  test('assign(slot) marks phone as connected without initCell', () => {
    const renderer = makeRenderer({ cellStates: { 0: {}, 1: {} } });
    const dm = makeDM(renderer, makeStubEngine());

    dm.assign(0);
    expect(dm.count).toBe(1);
    // initCell should NOT be called on assign (cells are pre-initialized)
    expect(renderer.initCell).not.toHaveBeenCalled();
    expect(renderer.cellStates[0].phoneConnected).toBe(true);
  });

  test('disconnect(slot) removes phone without removeCell', () => {
    const renderer = makeRenderer({ cellStates: { 0: { phoneConnected: true }, 1: {} } });
    const dm = makeDM(renderer, makeStubEngine());
    dm.phoneSlots.add(0);

    dm.disconnect(0);
    expect(dm.count).toBe(0);
    // removeCell should NOT be called — cell stays visible
    expect(renderer.removeCell).not.toHaveBeenCalled();
    expect(renderer.cellStates[0].phoneConnected).toBe(false);
  });

  test('updateSensor only processes phone-connected slots', () => {
    const renderer = makeRenderer({ cellStates: { 0: { pos: {} }, 1: { pos: {} } } });
    const dm = makeDM(renderer, makeStubEngine());
    dm.phoneSlots.add(0);

    // Slot 0 is connected — should work
    dm.updateSensor(0, { x: 5, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, { a: 0, b: 90, g: 0 });
    expect(renderer.updateFromSensor).toHaveBeenCalled();

    // Slot 1 is NOT connected — should be ignored
    renderer.updateFromSensor.mockClear();
    dm.updateSensor(1, { x: 5, y: 0, z: 0 }, { a: 0, b: 0, g: 0 }, { a: 0, b: 90, g: 0 });
    expect(renderer.updateFromSensor).not.toHaveBeenCalled();
  });

  test('handleAction only processes phone-connected slots', () => {
    const renderer = makeRenderer();
    const dm = makeDM(renderer, makeStubEngine());
    dm.phoneSlots.add(0);

    dm.handleAction(0, 'shuffle', { value: 75 });
    expect(renderer.handleAction).toHaveBeenCalledWith(0, 'shuffle', expect.any(Object), { value: 75 });

    renderer.handleAction.mockClear();
    dm.handleAction(1, 'shuffle');
    expect(renderer.handleAction).not.toHaveBeenCalled();
  });

  /* ── Integration: initAll + assign + recalc ── */

  describe('integration with LayoutPresetEngine', () => {
    function makeRealRenderer() {
      const state = { cellStates: {} };
      return {
        cellStates: state.cellStates,
        initCell(slot, cell) {
          state.cellStates[slot] = {
            cell,
            pos: { x: cell.x, y: cell.y, w: cell.w, h: cell.h, rotation: 0, zIndex: slot },
            img: null,
            opacity: 1.0,
            flipH: false,
            flipV: false,
            locked: false,
            filterType: 'none',
            borderStyle: 'torn',
            phoneConnected: false,
            currentImageFile: cell.imageFile,
          };
        },
        updateCellPosition(slot, pos) {
          if (state.cellStates[slot]) {
            state.cellStates[slot].pos = pos;
          }
        },
        removeCell: jest.fn(),
        updateFromSensor: jest.fn(),
        handleAction: jest.fn(),
      };
    }

    function makeDMWithEngine(renderer) {
      const { LayoutPresetEngine } = require('../p5-collage/layout-preset-engine');
      const layout = new CollageLayout(layoutData);
      const sensorMapper = new SensorMapper(CONFIG);
      const engine = new LayoutPresetEngine(1920, 1080);
      const { DeviceManager } = require('../p5-collage/device-manager');
      const dm = new DeviceManager(layout, renderer, sensorMapper, { get: () => null }, engine);
      return dm;
    }

    test('initAll computes positions for all cells', () => {
      const renderer = makeRealRenderer();
      const dm = makeDMWithEngine(renderer);

      dm.initAll();

      // All cells should have positions
      expect(renderer.cellStates[0]).toBeDefined();
      expect(renderer.cellStates[1]).toBeDefined();
      expect(renderer.cellStates[0].pos.w).toBeGreaterThan(20);
      expect(renderer.cellStates[1].pos.w).toBeGreaterThan(20);
    });

    test('changing engine preset and recalculating updates positions', () => {
      const renderer = makeRealRenderer();
      const dm = makeDMWithEngine(renderer);
      dm.initAll();

      const posBefore = { ...renderer.cellStates[0].pos };

      // Change preset and trigger recalculate
      dm.layoutEngine.setPreset('spiral');
      dm._recalculateLayout();

      const posAfter = renderer.cellStates[0].pos;
      // Position should be different with different preset
      const changed = posBefore.x !== posAfter.x || posBefore.y !== posAfter.y;
      expect(changed).toBe(true);
    });

    test('per-cell state preserved after layout recalc', () => {
      const renderer = makeRealRenderer();
      const dm = makeDMWithEngine(renderer);
      dm.initAll();

      const cellState = renderer.cellStates[0];
      cellState.opacity = 0.75;
      cellState.flipH = true;
      cellState.filterType = 'sepia';

      // Trigger recalc with different preset
      dm.layoutEngine.setPreset('neat-grid');
      dm._recalculateLayout();

      const after = renderer.cellStates[0];
      expect(after.opacity).toBe(0.75);
      expect(after.flipH).toBe(true);
      expect(after.filterType).toBe('sepia');
      expect(after.pos.w).toBeGreaterThan(20);
    });

    test('disconnect keeps cell visible with phoneConnected=false', () => {
      const renderer = makeRealRenderer();
      const dm = makeDMWithEngine(renderer);
      const cell = layoutData.cells[0];
      dm.initAll();

      dm.assign(0);
      expect(renderer.cellStates[0].phoneConnected).toBe(true);

      dm.disconnect(0);
      // Cell should still exist and be visible, just not phone-connected
      expect(renderer.cellStates[0]).toBeDefined();
      expect(renderer.cellStates[0].phoneConnected).toBe(false);
    });
  });
});
