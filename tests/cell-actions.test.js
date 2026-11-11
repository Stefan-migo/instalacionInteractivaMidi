const { createCellActionHandler } = require('../p5-collage/cell-actions');

describe('cell z-order actions', () => {
  function setup(slot, zIndexes) {
    const cellStates = Object.fromEntries(zIndexes.map((zIndex, index) => [index, { pos: { zIndex } }]));
    const ctx = {
      state: { cellStates },
      getCells: () => zIndexes.map((_, index) => ({ slot: index })),
      getRendererCellStates: () => cellStates,
      getSortedSlots: () => zIndexes.map((_, index) => ({ slot: index })),
      onZOrderChanged: jest.fn(),
    };
    const handle = createCellActionHandler(ctx);
    return { handle: action => handle(slot, action), cellStates, ctx };
  }

  test('send-back moves beneath the immediately lower cell', () => {
    const { handle, cellStates, ctx } = setup(2, [1, 4, 7, 12]);
    handle('send-back');
    expect(cellStates[2].pos.zIndex).toBe(3);
    expect(ctx.onZOrderChanged).toHaveBeenCalledTimes(1);
  });

  test('send-back leaves bottom cell unchanged', () => {
    const { handle, cellStates, ctx } = setup(0, [1, 4, 7]);
    handle('send-back');
    expect(cellStates[0].pos.zIndex).toBe(1);
    expect(ctx.onZOrderChanged).not.toHaveBeenCalled();
  });

  test('bring-front still sets max zIndex plus one', () => {
    const { handle, cellStates, ctx } = setup(0, [1, 4, 7]);
    handle('bring-front');
    expect(cellStates[0].pos.zIndex).toBe(8);
    expect(ctx.onZOrderChanged).toHaveBeenCalledTimes(1);
  });
});
