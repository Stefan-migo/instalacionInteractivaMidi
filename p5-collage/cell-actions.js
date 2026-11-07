function createCellActionHandler(ctx) {
  return function handleAction(slot, action, imgLoader, payload) {
    const s = ctx.state.cellStates[slot];
    if (!s) return;
    switch (action) {
      case 'cycle-next': {
        const result = ctx.imageCycler.cycle(slot, 'next');
        if (result) {
          const newImg = imgLoader.get(result.current);
          if (newImg && s.img) {
            s._oldImg = s.img;
            s.img = newImg;
            s.currentImageFile = result.current;
            s.transition.startTransition(s._oldImg, newImg);
            // Adapt the cell frame to the new image's aspect ratio
            if (typeof ctx.adaptCellToImage === 'function') {
              ctx.adaptCellToImage(s);
            }
            ctx.sendImageUpdate(slot, result.current);
          }
        }
        break;
      }
      case 'shuffle':
        const allCells = ctx.getCells();
        const others = allCells.filter(c => c.slot !== slot);
        const newCell = others[Math.floor(Math.random() * others.length)];
        s.cell = newCell;
        s.img = imgLoader.get(newCell.imageFile);
        s.currentImageFile = newCell.imageFile;
        // Update layout budget for this new cell
        s._layoutX = newCell.x;
        s._layoutY = newCell.y;
        s._layoutW = newCell.w;
        s._layoutH = newCell.h;
        // Adapt cell frame to the new cell's image aspect ratio
        if (typeof ctx.adaptCellToImage === 'function') {
          ctx.adaptCellToImage(s);
        }
        ctx.sendImageUpdate(slot, newCell.imageFile);
        break;
      case 'filter-next': {
        const filters = Object.keys(ctx.config.filterMap);
        const curIdx = filters.indexOf(s.filterType);
        s.filterType = filters[(curIdx + 1) % filters.length];
        break;
      }
      case 'opacity':
        if (payload && payload.value != null) {
          s.opacity = Math.max(0, Math.min(1, payload.value / 100));
        }
        break;
      case 'rotation':
        if (payload && payload.value != null) {
          s.pos.rotation = payload.value;
        }
        break;
      case 'filter': {
        if (payload && payload.value != null) {
          const filters = Object.keys(ctx.config.filterMap);
          s.filterType = (filters.includes(payload.value)) ? payload.value : 'none';
        }
        break;
      }
      case 'scale':
        if (payload && payload.value != null) {
          s._editorScale = Math.max(0.4, Math.min(1.8, payload.value / 100));
        }
        break;
      case 'move':
        if (payload) {
          s.pos.x += payload.dx || 0;
          s.pos.y += payload.dy || 0;
          s.pos.x = Math.max(0, Math.min(1920 - s.pos.w, s.pos.x));
          s.pos.y = Math.max(0, Math.min(1080 - s.pos.h, s.pos.y));
        }
        break;
      case 'bring-front': {
        // Bring this cell to the front by giving it max zIndex + 1
        let maxZ = 0;
        const sortedSlots = typeof ctx.getSortedSlots === 'function' ? ctx.getSortedSlots() : [];
        for (const other of sortedSlots) {
          const otherState = ctx.getRendererCellStates()[other.slot];
          if (otherState && otherState.pos.zIndex > maxZ) {
            maxZ = otherState.pos.zIndex;
          }
        }
        s.pos.zIndex = maxZ + 1;
        if (typeof ctx.getSortedSlots === 'function') {
          ctx.onZOrderChanged();
        }
        break;
      }
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCellActionHandler };
}
