function createCellActionHandler(ctx) {
  return function handleAction(slot, action, imgLoader, payload) {
    const s = ctx.state.cellStates[slot];
    if (!s) return;
    switch (action) {
      case 'cycle-next': {
        const result = ctx.deck.advance(slot, 'next');
        if (result && result.current) ctx.applyImage(slot, result.current);
        break;
      }
      case 'shuffle': {
        // Exchange images with another cell. Both stay in use, so the deck is
        // untouched and no two fragments ever show the same photo.
        const others = ctx.getCells().filter(c => c.slot !== slot);
        if (others.length === 0) break;
        const other = others[Math.floor(Math.random() * others.length)];
        if (!ctx.deck.swap(slot, other.slot)) break;
        ctx.applyImage(slot, ctx.deck.current(slot));
        ctx.applyImage(other.slot, ctx.deck.current(other.slot));
        break;
      }
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
      case 'send-back': {
        // Step exactly one position down the draw order, then rewrite the
        // zIndexes densely. `zIndex = lower - 1` used to collide with the cell
        // already sitting there — the layout ships consecutive pairs such as
        // 57/58 — which left two cells sharing a zIndex and an undefined draw
        // order. It also walked past the bottom cell into negative values.
        const cells = ctx.getRendererCellStates();
        const order = (typeof ctx.getSortedSlots === 'function' ? ctx.getSortedSlots() : [])
          .map(entry => {
            const cell = cells[entry.slot];
            return { slot: entry.slot, zIndex: cell ? cell.pos.zIndex : entry.zIndex };
          })
          .sort((a, b) => (a.zIndex - b.zIndex) || (a.slot - b.slot));

        const at = order.findIndex(entry => entry.slot === slot);
        if (at <= 0) break; // unknown slot, or already at the back

        const [moved] = order.splice(at, 1);
        order.splice(at - 1, 0, moved);
        order.forEach((entry, index) => {
          const cell = cells[entry.slot];
          if (cell) cell.pos.zIndex = index;
        });
        if (typeof ctx.onZOrderChanged === 'function') ctx.onZOrderChanged();
        break;
      }
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
