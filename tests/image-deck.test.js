const { ImageDeck, ASPECT_TOLERANCE } = require('../p5-collage/image-deck');

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const files = (count) => Array.from({ length: count }, (_, i) => `image-${i}`);

describe('ImageDeck', () => {
  test('30 claims from 300 files are distinct', () => {
    const deck = new ImageDeck(files(300), { rng: () => 0.5 });
    const assigned = Array.from({ length: 30 }, (_, slot) => deck.claim(slot));
    expect(new Set(assigned).size).toBe(30);
    expect(deck.inUseFiles()).toHaveLength(30);
    expect(deck.deckFiles()).toHaveLength(270);
    expect(deck.deckFiles().filter((file) => deck.isInUse(file))).toEqual([]);
  });

  test('deals a compatible ink aspect without repeating an active file', () => {
    const files = ['square.webp', 'square-alt.webp', 'wide.webp'];
    const deck = new ImageDeck(files, {
      rng: () => 0,
      metadata: {
        'square.webp': { inkBox: { w: 100, h: 100 } },
        'square-alt.webp': { inkBox: { w: 100, h: 100 } },
        'wide.webp': { inkBox: { w: 200, h: 100 } },
      },
    });
    const first = deck.claim('other', { w: 100, h: 100 });
    const chosen = deck.claim('target', { w: 200, h: 100 });
    expect(chosen).toBe('wide.webp');
    expect(chosen).not.toBe(first);
    expect(deck.inUseFiles()).toContain(chosen);
    const selectedAspect = chosen === 'wide.webp' ? 2 : 1;
    expect(Math.abs(selectedAspect - 2) / 2).toBeLessThanOrEqual(ASPECT_TOLERANCE);
  });

  test('claim is idempotent and does not consume the deck twice', () => {
    const deck = new ImageDeck(files(3), { rng: () => 0 });
    const first = deck.claim('a');
    const remaining = deck.deckFiles();
    expect(deck.claim('a')).toBe(first);
    expect(deck.deckFiles()).toEqual(remaining);
  });

  test('advance releases to the bottom and preserves distinct active assignments', () => {
    const deck = new ImageDeck(files(300), { rng: seeded(3) });
    for (let slot = 0; slot < 30; slot += 1) deck.claim(slot);
    for (let i = 0; i < 200; i += 1) {
      const slot = Math.floor(seeded(i + 1)() * 30);
      const previous = deck.current(slot);
      const result = deck.advance(slot, i % 2 ? 'prev' : 'next');
      expect(result.previous).toBe(previous);
      expect(result.current).not.toBe(previous);
      expect(deck.deckFiles().at(-1)).toBe(previous);
      expect(new Set(deck.inUseFiles()).size).toBe(deck.inUseFiles().length);
    }
  });

  test('advance claims for an unassigned slot and gracefully degrades with no files', () => {
    const deck = new ImageDeck(['only'], { rng: () => 0 });
    expect(deck.advance('new', 'next')).toEqual({ current: 'only', previous: null });
    const empty = new ImageDeck([], { rng: () => 0 });
    expect(empty.advance('new', 'next')).toBeNull();
  });

  test('swap exchanges assigned images without changing the deck', () => {
    const deck = new ImageDeck(files(4), { rng: () => 0 });
    const a = deck.claim('a');
    const b = deck.claim('b');
    const before = deck.deckFiles();
    expect(deck.swap('a', 'b')).toBe(true);
    expect(deck.current('a')).toBe(b);
    expect(deck.current('b')).toBe(a);
    expect(deck.deckFiles()).toEqual(before);
    expect(deck.swap('a', 'a')).toBe(false);
  });

  test('degradation reuses library files and warns once per instance', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const deck = new ImageDeck(files(5), { rng: () => 0 });
      const assigned = Array.from({ length: 10 }, (_, slot) => deck.claim(slot));
      for (let slot = 0; slot < 10; slot += 1) deck.claim(slot);
      expect(assigned.every(Boolean)).toBe(true);
      expect(new Set(assigned).size).toBeLessThan(10);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  test('empty library methods return clean empty values', () => {
    const deck = new ImageDeck([], { rng: () => 0 });
    expect(deck.claim('a')).toBeNull();
    expect(deck.current('a')).toBeNull();
    expect(deck.release('a')).toBeNull();
    expect(deck.advance('a', 'next')).toBeNull();
    expect(deck.swap('a', 'b')).toBe(false);
    expect(deck.isInUse('x')).toBe(false);
    expect(deck.inUseFiles()).toEqual([]);
    expect(deck.deckFiles()).toEqual([]);
    expect(deck.availableCount).toBe(0);
  });

  test('identical seeded RNGs produce identical order and different seeds differ', () => {
    const a = new ImageDeck(files(20), { rng: seeded(10) });
    const b = new ImageDeck(files(20), { rng: seeded(10) });
    const c = new ImageDeck(files(20), { rng: seeded(11) });
    const sequence = (deck) => Array.from({ length: 10 }, (_, i) => deck.claim(i));
    expect(sequence(a)).toEqual(sequence(b));
    expect(sequence(a)).not.toEqual(sequence(c));
  });

  test('duplicate filenames create only one deck entry', () => {
    const deck = new ImageDeck(['a', 'b', 'a', 'c', 'b'], { rng: () => 0 });
    expect(deck.deckFiles()).toHaveLength(3);
    expect(new Set(deck.deckFiles()).size).toBe(3);
  });
});
