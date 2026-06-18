/**
 * Tests for drag-manager.js hit-test and drag state machine.
 *
 * Relies on global mocks for deviceManager and getSortedSlots.
 */
const { hitTest, startDrag, updateDrag, endDrag, getDragState } = require('../p5-collage/drag-manager');

function makeCellStates() {
  return {
    0: {
      img: { nodeName: 'IMG' },
      opacity: 1.0,
      pos: { x: 0, y: 0, w: 200, h: 150, zIndex: 0 },
    },
    1: {
      img: { nodeName: 'IMG' },
      opacity: 1.0,
      pos: { x: 300, y: 200, w: 250, h: 200, zIndex: 1 },
    },
    2: {
      img: { nodeName: 'IMG' },
      opacity: 0, // hidden cell
      pos: { x: 100, y: 100, w: 200, h: 150, zIndex: 2 },
    },
  };
}

function setupGlobals(cellStates) {
  global.deviceManager = {
    renderer: { cellStates: cellStates || makeCellStates() },
  };
  global.getSortedSlots = function () {
    const states = global.deviceManager.renderer.cellStates;
    return Object.keys(states)
      .map(Number)
      .map(function (slot) {
        return { slot: slot, zIndex: states[slot].pos.zIndex };
      })
      .sort(function (a, b) { return a.zIndex - b.zIndex; });
  };
  global.collageLayout = { cells: [{ slot: 0 }, { slot: 1 }, { slot: 2 }] };
}

function teardownGlobals() {
  delete global.deviceManager;
  delete global.getSortedSlots;
  delete global.collageLayout;
}

describe('hitTest', () => {
  beforeEach(function () {
    setupGlobals();
  });

  afterEach(function () {
    teardownGlobals();
  });

  test('returns slot when point is inside a cell', () => {
    expect(hitTest(50, 50)).toBe(0); // inside cell 0 at (0,0,200,150)
    expect(hitTest(400, 300)).toBe(1); // inside cell 1 at (300,200,250,200)
  });

  test('returns -1 when point is outside all cells', () => {
    expect(hitTest(250, 100)).toBe(-1); // gap between cells
    expect(hitTest(-10, -10)).toBe(-1); // off-canvas negative
    expect(hitTest(2000, 1000)).toBe(-1); // off-canvas
  });

  test('returns topmost cell on overlap (highest zIndex)', () => {
    // Create overlapping cells: cell 0 at (0,0,200,150), cell 1 at (50,50,200,150) overlapping
    var states = {
      0: { img: { nodeName: 'IMG' }, opacity: 1.0, pos: { x: 0, y: 0, w: 200, h: 150, zIndex: 0 } },
      1: { img: { nodeName: 'IMG' }, opacity: 1.0, pos: { x: 50, y: 50, w: 200, h: 150, zIndex: 5 } },
    };
    teardownGlobals();
    setupGlobals(states);
    // Point (100,100) is inside both cells; should return cell 1 (higher zIndex)
    expect(hitTest(100, 100)).toBe(1);
  });

  test('skips hidden cells (opacity <= 0)', () => {
    // Point (150, 150) is inside hidden cell 2 at (100,100,200,150) with opacity 0
    // But also inside cell 0 at (0,0,200,150) if we check position
    // Actually cell 2 (opacity 0) at (100,100,200,150) overlaps cell 0 (opacity 1) at (0,0,200,150)
    // hitTest should skip cell 2 because it's hidden and hit cell 0 instead
    //
    // With sorted z-order: cell 0 (z=0), cell 1 (z=1), cell 2 (z=2)
    // Reversed iteration: cell 2 first (opacity 0 → skip), then cell 1, then cell 0
    // Point (150,150) — cell 2 area, cell 0 area, but not cell 1 area
    // After skipping cell 2, checks cell 1 (no), then cell 0 (yes at 0,0,200,150)
    expect(hitTest(150, 150)).toBe(0);
  });

  test('returns -1 when deviceManager is null', () => {
    global.deviceManager = null;
    expect(hitTest(50, 50)).toBe(-1);
  });

  test('returns -1 when no sorted slots function', () => {
    global.getSortedSlots = null;
    expect(hitTest(50, 50)).toBe(-1);
  });
});

describe('drag state machine', () => {
  var states;

  beforeEach(function () {
    states = makeCellStates();
    setupGlobals(states);
  });

  afterEach(function () {
    teardownGlobals();
  });

  test('startDrag stores offset and initializes state', () => {
    startDrag(0, 100, 80);
    var state = getDragState();
    expect(state.slot).toBe(0);
    expect(state.startX).toBe(100);
    expect(state.startY).toBe(80);
    expect(state.offsetX).toBe(100); // 100 - 0
    expect(state.offsetY).toBe(80); // 80 - 0
    expect(state.isDragging).toBe(false);
  });

  test('updateDrag does not move cell below threshold (5px)', () => {
    startDrag(0, 100, 80);
    updateDrag(104, 80); // 4px movement — below threshold
    expect(states[0].pos.x).toBe(0);
    expect(states[0].pos.y).toBe(0);
    expect(getDragState().isDragging).toBe(false);
  });

  test('updateDrag moves cell above threshold', () => {
    startDrag(0, 100, 80);
    updateDrag(110, 80); // 10px — above 5px threshold
    expect(states[0].pos.x).toBe(10); // 110 - 100 + 0 = 10
    expect(states[0].pos.y).toBe(0);
    expect(getDragState().isDragging).toBe(true);
  });

  test('updateDrag clamps x to canvas left edge', () => {
    startDrag(0, 50, 80);
    updateDrag(-50, 80); // try to go past left edge
    expect(states[0].pos.x).toBe(0); // clamped
    expect(states[0].pos.y).toBe(0);
  });

  test('updateDrag clamps x to canvas right edge', () => {
    // pos: x=0, w=200 → max x = 1920 - 200 = 1720
    startDrag(0, 50, 80);
    updateDrag(1900, 80); // try to go far right
    expect(states[0].pos.x).toBe(1720); // clamped to canvasW - cellW
    expect(states[0].pos.y).toBe(0);
  });

  test('updateDrag clamps y to canvas top edge', () => {
    startDrag(0, 50, 40);
    updateDrag(60, -50); // try to go above
    expect(states[0].pos.x).toBe(10);
    expect(states[0].pos.y).toBe(0); // clamped
  });

  test('updateDrag clamps y to canvas bottom edge', () => {
    // pos: x=0,y=0,w=200,h=150 → max y = 1080 - 150 = 930
    startDrag(0, 50, 80);
    updateDrag(60, 1100); // try to go past bottom
    expect(states[0].pos.x).toBe(10);
    expect(states[0].pos.y).toBe(930); // clamped
  });

  test('endDrag returns wasDrag=false when no movement', () => {
    startDrag(0, 100, 80);
    var result = endDrag();
    expect(result.wasDrag).toBe(false);
    expect(result.slot).toBe(0);
  });

  test('endDrag returns wasDrag=true after threshold exceeded', () => {
    startDrag(0, 100, 80);
    updateDrag(120, 80); // 20px — above threshold
    var result = endDrag();
    expect(result.wasDrag).toBe(true);
    expect(result.slot).toBe(0);
  });

  test('endDrag resets state', () => {
    startDrag(0, 100, 80);
    updateDrag(120, 80);
    endDrag();
    var state = getDragState();
    expect(state.slot).toBeNull();
    expect(state.isDragging).toBe(false);
  });

  test('startDrag with null slot does nothing', () => {
    startDrag(null, 100, 80);
    var state = getDragState();
    expect(state.slot).toBeNull();
  });

  test('startDrag with -1 slot does nothing', () => {
    startDrag(-1, 100, 80);
    var state = getDragState();
    expect(state.slot).toBeNull();
  });

  test('updateDrag without startDrag is no-op', () => {
    updateDrag(200, 200);
    expect(states[0].pos.x).toBe(0);
    expect(states[0].pos.y).toBe(0);
  });
});
