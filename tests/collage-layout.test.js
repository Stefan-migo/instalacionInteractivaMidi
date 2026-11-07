const { CollageLayout } = require('../p5-collage/collage-layout');

describe('CollageLayout', () => {
  const layoutData = {
    canvas: { w: 1920, h: 1080 },
    totalSlots: 30,
    cells: [
      { slot: 0, cellId: 'cell_00', x: 0, y: 0, w: 400, h: 300, rotation: 2, zIndex: 5, imageId: '001', imageFile: '001.jpg' },
      { slot: 1, cellId: 'cell_01', x: 300, y: 200, w: 350, h: 450, rotation: -3, zIndex: 10, imageId: '002', imageFile: '002.jpg' },
      { slot: 2, cellId: 'cell_02', x: 100, y: 100, w: 300, h: 300, rotation: 0, zIndex: 1, imageId: '003', imageFile: '003.jpg' },
    ],
  };

  test('getCell(slot) returns cell for valid slot', () => {
    const layout = new CollageLayout(layoutData);
    const cell = layout.getCell(0);
    expect(cell).toBeDefined();
    expect(cell.cellId).toBe('cell_00');
    expect(cell.x).toBe(0);
  });

  test('getCell(slot) returns null for unregistered slot', () => {
    const layout = new CollageLayout(layoutData);
    expect(layout.getCell(99)).toBeNull();
  });

  test('getCellsByZIndex returns cells sorted by zIndex ascending', () => {
    const layout = new CollageLayout(layoutData);
    const sorted = layout.getCellsByZIndex();
    expect(sorted[0].zIndex).toBe(1);
    expect(sorted[1].zIndex).toBe(5);
    expect(sorted[2].zIndex).toBe(10);
  });

  test('totalSlots returns correct count', () => {
    const layout = new CollageLayout(layoutData);
    expect(layout.totalSlots).toBe(30);
  });
});
