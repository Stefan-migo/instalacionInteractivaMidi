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
    // The contract is the relative order, not the absolute number.
    const order = Object.entries(cellStates)
      .map(([slot, cell]) => [Number(slot), cell.pos.zIndex])
      .sort((a, b) => a[1] - b[1])
      .map(([slot]) => slot);
    expect(order).toEqual([0, 2, 1, 3]);
    expect(ctx.onZOrderChanged).toHaveBeenCalledTimes(1);
  });

  // Regression: the layout ships consecutive zIndex pairs (8/9, 57/58, 65/66…).
  // Stepping down by one landed on the value of the cell already sitting there,
  // so two cells shared a zIndex and the draw order became undefined — the
  // button looked like it did nothing.
  test('send-back keeps every zIndex unique when neighbours are consecutive', () => {
    const { handle, cellStates } = setup(2, [8, 9, 10]);
    handle('send-back');
    const zs = Object.values(cellStates).map(cell => cell.pos.zIndex);
    expect(new Set(zs).size).toBe(zs.length);
  });

  // Regression: repeated presses walked past the bottom cell and produced a
  // negative zIndex while still not reaching the back of the collage.
  test('repeated send-back never goes negative and stops at the back', () => {
    const { handle, cellStates } = setup(2, [0, 2, 5]);
    for (let i = 0; i < 8; i++) handle('send-back');
    const zs = Object.values(cellStates).map(cell => cell.pos.zIndex);
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(0);
    expect(new Set(zs).size).toBe(zs.length);
    const back = Object.entries(cellStates)
      .map(([slot, cell]) => [Number(slot), cell.pos.zIndex])
      .sort((a, b) => a[1] - b[1])[0][0];
    expect(back).toBe(2);
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
