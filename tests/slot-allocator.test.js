const { SlotAllocator } = require('../bridge/slot-allocator');

describe('SlotAllocator', () => {
  test('allocate() returns slot 0 first', () => {
    const allocator = new SlotAllocator(30, 0);
    expect(allocator.allocate()).toBe(0);
  });

  test('allocate() returns sequential slots 0, 1, 2', () => {
    const allocator = new SlotAllocator(30, 0);
    expect(allocator.allocate()).toBe(0);
    expect(allocator.allocate()).toBe(1);
    expect(allocator.allocate()).toBe(2);
  });

  test('free(slot) allows reuse of freed slot', () => {
    const allocator = new SlotAllocator(30, 0);
    allocator.allocate();
    const slot1 = allocator.allocate();
    allocator.allocate();
    allocator.free(slot1);
    expect(allocator.allocate()).toBe(slot1);
  });

  test('allocate() returns -1 when all slots are full', () => {
    const allocator = new SlotAllocator(3, 0);
    allocator.allocate();
    allocator.allocate();
    allocator.allocate();
    expect(allocator.allocate()).toBe(-1);
  });

  test('activeCount returns correct number of active slots', () => {
    const allocator = new SlotAllocator(30, 0);
    expect(allocator.activeCount).toBe(0);
    allocator.allocate();
    expect(allocator.activeCount).toBe(1);
    allocator.allocate();
    expect(allocator.activeCount).toBe(2);
    allocator.free(0);
    expect(allocator.activeCount).toBe(1);
  });

  test('isActive returns true for allocated slot, false for freed', () => {
    const allocator = new SlotAllocator(10, 0);
    const slot = allocator.allocate();
    expect(allocator.isActive(slot)).toBe(true);
    allocator.free(slot);
    expect(allocator.isActive(slot)).toBe(false);
  });

  test('activeSlots returns only currently active slots', () => {
    const allocator = new SlotAllocator(5, 0);
    allocator.allocate();
    allocator.allocate();
    allocator.free(0);
    expect(allocator.activeSlots).toEqual([1]);
  });

  test('free() on invalid slot does not throw', () => {
    const allocator = new SlotAllocator(5, 0);
    expect(() => allocator.free(-1)).not.toThrow();
    expect(() => allocator.free(99)).not.toThrow();
  });

  test('cooldown prevents immediate slot reuse', () => {
    const allocator = new SlotAllocator(1, 99999);
    const slot = allocator.allocate();
    allocator.free(slot);
    expect(allocator.allocate()).toBe(-1);
  });

  test('works with exactly 1 device', () => {
    const allocator = new SlotAllocator(1, 0);
    expect(allocator.allocate()).toBe(0);
    expect(allocator.activeCount).toBe(1);
    allocator.free(0);
    expect(allocator.activeCount).toBe(0);
  });

  // ── getEmptySlots ──────────────────────────────────────────────────────

  test('getEmptySlots returns all slots when none are active', () => {
    const allocator = new SlotAllocator(5, 0);
    expect(allocator.getEmptySlots()).toEqual([0, 1, 2, 3, 4]);
  });

  test('getEmptySlots excludes active slots', () => {
    const allocator = new SlotAllocator(5, 0);
    allocator.allocate(); // takes slot 0
    allocator.allocate(); // takes slot 1
    expect(allocator.getEmptySlots()).toEqual([2, 3, 4]);
  });

  test('getEmptySlots excludes slots in cooldown', () => {
    const allocator = new SlotAllocator(3, 99999);
    allocator.allocate(); // slot 0
    allocator.free(0);
    // slot 0 is in cooldown, not free
    expect(allocator.getEmptySlots()).toEqual([1, 2]);
  });

  // ── reassign ───────────────────────────────────────────────────────────

  test('reassign moves a phone from one slot to an empty one', () => {
    const allocator = new SlotAllocator(5, 0);
    const slot1 = allocator.allocate(); // 0
    const slot2 = allocator.allocate(); // 1
    // slot1 active at 0, slot2 active at 1
    // move slot1 → 3 (empty)
    const result = allocator.reassign(slot1, 3);
    expect(result).toBe(true);
    expect(allocator.isActive(slot1)).toBe(false); // old slot freed
    expect(allocator.isActive(3)).toBe(true);       // new slot active
  });

  test('reassign returns false when target is already active', () => {
    const allocator = new SlotAllocator(5, 0);
    const slot1 = allocator.allocate(); // 0
    allocator.allocate();               // 1
    expect(allocator.reassign(slot1, 1)).toBe(false);
  });

  test('reassign returns false when target is in cooldown', () => {
    const allocator = new SlotAllocator(3, 99999);
    const slot1 = allocator.allocate(); // 0
    allocator.allocate();               // 1
    allocator.free(0);                  // 0 in cooldown
    // slot1 is now 1, slot 0 is in cooldown
    expect(allocator.reassign(1, 0)).toBe(false);
  });

  test('reassign returns false when source is not active', () => {
    const allocator = new SlotAllocator(5, 0);
    expect(allocator.reassign(0, 1)).toBe(false);
  });

  test('reassign returns true for same slot (no-op)', () => {
    const allocator = new SlotAllocator(5, 0);
    const s = allocator.allocate();
    expect(allocator.reassign(s, s)).toBe(true);
    expect(allocator.isActive(s)).toBe(true);
  });

  test('reassign to out-of-range slot returns false', () => {
    const allocator = new SlotAllocator(5, 0);
    allocator.allocate();
    expect(allocator.reassign(0, -1)).toBe(false);
    expect(allocator.reassign(0, 99)).toBe(false);
  });
});
