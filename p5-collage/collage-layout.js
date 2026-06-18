class CollageLayout {
  constructor(data) {
    this.canvasW = data.canvas.w;
    this.canvasH = data.canvas.h;
    this.cells = data.cells || [];
    this.totalSlots = data.totalSlots;
    this.bySlot = {};
    for (const cell of this.cells) {
      this.bySlot[cell.slot] = cell;
    }
  }

  getCell(slot) {
    return this.bySlot[slot] || null;
  }

  getCellsByZIndex() {
    return [...this.cells].sort((a, b) => a.zIndex - b.zIndex);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CollageLayout };
}
