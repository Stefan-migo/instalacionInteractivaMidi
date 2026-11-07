class ImageDeck {
  constructor(files, options = {}) {
    const library = Array.isArray(files) ? files : [];
    this._files = [...new Set(library)];
    this._deck = [...this._files];
    this._slots = new Map();
    this._rng = typeof options.rng === 'function' ? options.rng : Math.random;
    this._warned = false;
  }

  claim(slot) {
    return this._claim(slot, null);
  }

  _claim(slot, excluded) {
    if (this._slots.has(slot)) return this._slots.get(slot);
    if (this._files.length === 0) return null;

    let file;
    if (this._deck.length > 0) {
      const random = Number(this._rng());
      let index = Math.min(this._deck.length - 1, Math.max(0, Math.floor(random * this._deck.length)));
      if (this._deck[index] === excluded && this._deck.length > 1) index = (index + 1) % this._deck.length;
      [file] = this._deck.splice(index, 1);
    } else {
      if (!this._warned) {
        console.warn('ImageDeck exhausted; reusing images from the library.');
        this._warned = true;
      }
      const random = Number(this._rng());
      const index = Math.min(this._files.length - 1, Math.max(0, Math.floor(random * this._files.length)));
      file = this._files[index];
    }
    this._slots.set(slot, file);
    return file;
  }

  current(slot) {
    return this._slots.has(slot) ? this._slots.get(slot) : null;
  }

  release(slot) {
    if (!this._slots.has(slot)) return null;
    const file = this._slots.get(slot);
    this._slots.delete(slot);
    this._deck.push(file);
    return file;
  }

  advance(slot, direction) {
    if (direction !== 'next' && direction !== 'prev') return null;
    const previous = this.release(slot);
    const current = this._claim(slot, previous);
    return current === null ? null : { current, previous };
  }

  swap(a, b) {
    if (a === b || !this._slots.has(a) || !this._slots.has(b)) return false;
    const first = this._slots.get(a);
    this._slots.set(a, this._slots.get(b));
    this._slots.set(b, first);
    return true;
  }

  isInUse(file) {
    return [...this._slots.values()].includes(file);
  }

  inUseFiles() {
    return [...this._slots.values()];
  }

  deckFiles() {
    return [...this._deck];
  }

  get availableCount() {
    return this._deck.length;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImageDeck };
}
