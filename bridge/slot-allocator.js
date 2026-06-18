class SlotAllocator {
  constructor(maxSlots, cooldownMs) {
    this.maxSlots = maxSlots;
    this.cooldownMs = cooldownMs;
    this.slots = new Array(maxSlots).fill(null);
    this.cooldowns = new Array(maxSlots).fill(0);
  }

  allocate() {
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] === null && Date.now() >= this.cooldowns[i]) {
        this.slots[i] = Date.now();
        return i;
      }
    }
    return -1;
  }

  free(slot) {
    if (slot >= 0 && slot < this.maxSlots) {
      this.slots[slot] = null;
      this.cooldowns[slot] = Date.now() + this.cooldownMs;
    }
  }

  isActive(slot) {
    return slot >= 0 && slot < this.maxSlots && this.slots[slot] !== null;
  }

  /**
   * Return indices of all empty (free) slots, excluding cooldown.
   */
  getEmptySlots() {
    const empty = [];
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] === null && Date.now() >= this.cooldowns[i]) {
        empty.push(i);
      }
    }
    return empty;
  }

  /**
   * Move a phone from one slot to another.
   * Frees the old slot (with cooldown) and marks the new one as active.
   * Returns true on success, false if the target is taken or invalid.
   */
  reassign(fromSlot, toSlot) {
    if (fromSlot === toSlot) return true;
    if (!this.isActive(fromSlot)) return false;
    if (toSlot < 0 || toSlot >= this.maxSlots) return false;
    if (this.slots[toSlot] !== null) return false;
    if (Date.now() < this.cooldowns[toSlot]) return false;

    this.free(fromSlot);
    this.slots[toSlot] = Date.now();
    return true;
  }

  get activeSlots() {
    return this.slots.map((s, i) => s !== null ? i : null).filter(s => s !== null);
  }

  get activeCount() {
    return this.slots.filter(s => s !== null).length;
  }
}

module.exports = { SlotAllocator };
