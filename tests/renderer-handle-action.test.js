/** Tests for the production cell action handler used by createRenderer(). */

const { createCellActionHandler } = require('../p5-collage/cell-actions');
const { CONFIG } = require('../p5-collage/config');
const { ImageCycler } = require('../p5-collage/image-cycler');

function createTestContext() {
  const cells = [
    { slot: 0, imageFile: 'zero.jpg', x: 10, y: 20, w: 400, h: 300 },
    { slot: 1, imageFile: 'one.jpg', x: 30, y: 40, w: 500, h: 350 },
    { slot: 2, imageFile: 'two.jpg', x: 50, y: 60, w: 600, h: 400 },
  ];
  const state = { cellStates: {} };
  for (const cell of cells) {
    state.cellStates[cell.slot] = {
      cell,
      pos: { x: 0, y: 0, w: 400, h: 300, zIndex: cell.slot, rotation: 0 },
      img: { file: cell.imageFile },
      opacity: 1,
      filterType: 'none',
      borderStyle: 'torn',
      currentImageFile: cell.imageFile,
      transition: { startTransition: jest.fn() },
    };
  }
  const imageCycler = new ImageCycler();
  imageCycler.initPool(0, ['cycle-a.jpg', 'cycle-b.jpg'], 2);
  imageCycler._pools[0] = ['cycle-a.jpg', 'cycle-b.jpg'];
  imageCycler._cursors[0] = 0;
  const ctx = {
    state,
    imageCycler,
    getCells: jest.fn(() => cells),
    config: CONFIG,
    sendImageUpdate: jest.fn(),
    adaptCellToImage: jest.fn(),
    generateTornBorder: jest.fn(() => ['border']),
    getSortedSlots: jest.fn(() => [{ slot: 0 }, { slot: 1 }, { slot: 2 }]),
    getRendererCellStates: jest.fn(() => state.cellStates),
    onZOrderChanged: jest.fn(),
  };
  return { ctx, cells, handleAction: createCellActionHandler(ctx), imgLoader: { get: jest.fn(file => ({ file })) } };
}

describe('production cell action handler — value actions', () => {
  let testContext;
  beforeEach(() => { testContext = createTestContext(); });

  describe('opacity', () => {
    test('sets opacity from payload value (0-100 scaled to 0-1)', () => {
      testContext.handleAction(0, 'opacity', null, { value: 75 });
      expect(testContext.ctx.state.cellStates[0].opacity).toBe(0.75);
    });
    test('clamps opacity to [0, 1]', () => {
      testContext.handleAction(0, 'opacity', null, { value: 150 });
      expect(testContext.ctx.state.cellStates[0].opacity).toBe(1);
      testContext.handleAction(0, 'opacity', null, { value: -50 });
      expect(testContext.ctx.state.cellStates[0].opacity).toBe(0);
    });
  });

  describe('rotation', () => {
    test.each([45, -90, 270, 0])('stores rotation %s directly', value => {
      testContext.handleAction(0, 'rotation', null, { value });
      expect(testContext.ctx.state.cellStates[0].pos.rotation).toBe(value);
    });
  });

  describe('filter', () => {
    test('sets valid filter name', () => {
      testContext.handleAction(0, 'filter', null, { value: 'sepia' });
      expect(testContext.ctx.state.cellStates[0].filterType).toBe('sepia');
    });
    test('invalid filter falls back to none', () => {
      testContext.handleAction(0, 'filter', null, { value: 'blur' });
      expect(testContext.ctx.state.cellStates[0].filterType).toBe('none');
    });
    test('filter-next cycles through configured filters', () => {
      const expected = Object.keys(CONFIG.filterMap)[0];
      testContext.handleAction(0, 'filter-next');
      expect(testContext.ctx.state.cellStates[0].filterType).toBe(expected);
    });
  });

  describe('move', () => {
    test('moves cell by dx/dy delta', () => {
      const s = testContext.ctx.state.cellStates[0];
      s.pos.x = 100; s.pos.y = 200;
      testContext.handleAction(0, 'move', null, { dx: 50, dy: -30 });
      expect(s.pos.x).toBe(150); expect(s.pos.y).toBe(170);
    });
    test('clamps position to canvas bounds', () => {
      const s = testContext.ctx.state.cellStates[0];
      testContext.handleAction(0, 'move', null, { dx: -100, dy: -100 });
      expect(s.pos.x).toBe(0); expect(s.pos.y).toBe(0);
      testContext.handleAction(0, 'move', null, { dx: 2000, dy: 1000 });
      expect(s.pos.x).toBe(1520); expect(s.pos.y).toBe(780);
    });
  });

  test('cycle-next loads, transitions, adapts, and announces the image', () => {
    const s = testContext.ctx.state.cellStates[0];
    testContext.handleAction(0, 'cycle-next', testContext.imgLoader);
    expect(testContext.imgLoader.get).toHaveBeenCalledWith('cycle-b.jpg');
    expect(s.currentImageFile).toBe('cycle-b.jpg');
    expect(s.img).toEqual({ file: 'cycle-b.jpg' });
    expect(s.transition.startTransition).toHaveBeenCalledWith({ file: 'zero.jpg' }, { file: 'cycle-b.jpg' });
    expect(testContext.ctx.adaptCellToImage).toHaveBeenCalledWith(s);
    expect(testContext.ctx.sendImageUpdate).toHaveBeenCalledWith(0, 'cycle-b.jpg');
  });

  test('shuffle reassigns cell and image, updates layout budget, adapts, and announces', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = testContext.ctx.state.cellStates[0];
    testContext.handleAction(0, 'shuffle', testContext.imgLoader);
    expect(s.cell).toBe(testContext.cells[2]);
    expect(s.currentImageFile).toBe('two.jpg');
    expect(s._layoutX).toBe(50); expect(s._layoutY).toBe(60);
    expect(s._layoutW).toBe(600); expect(s._layoutH).toBe(400);
    expect(testContext.ctx.adaptCellToImage).toHaveBeenCalledWith(s);
    expect(testContext.ctx.sendImageUpdate).toHaveBeenCalledWith(0, 'two.jpg');
    expect(testContext.ctx.getCells).toHaveBeenCalled();
    Math.random.mockRestore();
  });

  test('shuffle fallback generates a border when adaptation is unavailable', () => {
    testContext.ctx.adaptCellToImage = undefined;
    testContext.handleAction(0, 'shuffle', testContext.imgLoader);
    expect(testContext.ctx.generateTornBorder).toHaveBeenCalledWith(-200, -150, 400, 300, CONFIG.borderSegments, CONFIG.borderJitter, 0);
  });

  test('border-next advances configured border style', () => {
    testContext.handleAction(0, 'border-next');
    expect(testContext.ctx.state.cellStates[0].borderStyle).toBe(CONFIG.borderStyleMap[1]);
  });

  test('scale clamps editor scale', () => {
    const s = testContext.ctx.state.cellStates[0];
    testContext.handleAction(0, 'scale', null, { value: 250 });
    expect(s._editorScale).toBe(1.8);
    testContext.handleAction(0, 'scale', null, { value: 10 });
    expect(s._editorScale).toBe(0.4);
  });

  test('bring-front uses renderer states and refreshes z-order', () => {
    testContext.ctx.state.cellStates[1].pos.zIndex = 9;
    testContext.handleAction(0, 'bring-front');
    expect(testContext.ctx.state.cellStates[0].pos.zIndex).toBe(10);
    expect(testContext.ctx.getRendererCellStates).toHaveBeenCalled();
    expect(testContext.ctx.getSortedSlots).toHaveBeenCalledTimes(1);
    expect(testContext.ctx.onZOrderChanged).toHaveBeenCalledTimes(1);
  });

  test('unknown slot does nothing and calls no collaborators', () => {
    testContext.handleAction(99, 'shuffle', testContext.imgLoader, { value: 50 });
    expect(testContext.ctx.sendImageUpdate).not.toHaveBeenCalled();
    expect(testContext.ctx.adaptCellToImage).not.toHaveBeenCalled();
    expect(testContext.imgLoader.get).not.toHaveBeenCalled();
    expect(testContext.ctx.getCells).not.toHaveBeenCalled();
  });

  describe('rotation normalization (state migration)', () => {
    function normalizeRotation(rot) {
      rot = rot || 0;
      if (rot > 180) rot -= 360;
      return rot;
    }
    test('values ≤ 180 remain unchanged', () => {
      expect([0, 45, 180].map(normalizeRotation)).toEqual([0, 45, 180]);
    });
    test('values > 180 normalize to -180..+180', () => {
      expect([270, 360, 359].map(normalizeRotation)).toEqual([-90, 0, -1]);
    });
    test('null or undefined defaults to 0', () => {
      expect(normalizeRotation(null)).toBe(0); expect(normalizeRotation(undefined)).toBe(0);
    });
    test('negative values remain unchanged', () => {
      expect([-90, -180].map(normalizeRotation)).toEqual([-90, -180]);
    });
  });
});
