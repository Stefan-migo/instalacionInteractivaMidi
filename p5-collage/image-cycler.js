/**
 * ImageCycler — per-slot random image pool management.
 *
 * Each slot gets its own randomly selected pool of images.
 * `cycle(slot, direction)` advances the pool cursor and returns
 * `{ current, previous }` image references, wrapping at boundaries.
 */

class ImageCycler {
  constructor() {
    this._pools = Object.create(null);
    this._cursors = Object.create(null);
  }

  /**
   * Initialise (or re-initialise) a slot's image pool.
   *
   * @param {number|string} slot
   * @param {string[]} allImageFiles  — full set of available image paths/IDs
   * @param {number} poolSize         — desired pool size (clamped to available)
   */
  initPool(slot, allImageFiles, poolSize) {
    const available = [...allImageFiles];
    const size = Math.min(poolSize, available.length);
    const pool = [];

    // Random selection without replacement (Fisher–Yates style)
    for (let i = 0; i < size; i++) {
      const idx = Math.floor(Math.random() * available.length);
      pool.push(available.splice(idx, 1)[0]);
    }

    this._pools[slot] = pool;
    this._cursors[slot] = 0;
  }

  /**
   * Advance the slot's cursor and return the previous + current images.
   *
   * @param {number|string} slot
   * @param {'next'|'prev'} direction
   * @returns {{ current: string, previous: string } | null}
   */
  cycle(slot, direction) {
    const pool = this._pools[slot];
    if (!pool || pool.length === 0) return null;

    const oldCursor = this._cursors[slot];
    const previous = pool[oldCursor];

    let newCursor;
    if (direction === 'next') {
      newCursor = (oldCursor + 1) % pool.length;
    } else {
      newCursor = (oldCursor - 1 + pool.length) % pool.length;
    }

    this._cursors[slot] = newCursor;

    return {
      current: pool[newCursor],
      previous,
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImageCycler };
}
