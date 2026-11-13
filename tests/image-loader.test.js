'use strict';

const { ImageLoader } = require('../p5-collage/image-loader');

function factoryHarness() {
  const elements = new Map();
  const createImage = () => {
    const image = {};
    Object.defineProperty(image, 'src', {
      set(value) { image.url = value; elements.set(value.split('/').pop(), image); }
    });
    return image;
  };
  return { createImage, elements };
}

function settle(image) { image.onload(); }

describe('ImageLoader', () => {
  test('get is synchronous and never starts a load', async () => {
    const h = factoryHarness();
    const loader = new ImageLoader('', { createImage: h.createImage });
    expect(loader.get('a.jpg')).toBeNull();
    expect(h.elements.size).toBe(0);
    const pending = loader.ensure('a.jpg');
    expect(h.elements.size).toBe(1);
    expect(loader.get('a.jpg')).toBeNull();
    const image = h.elements.get('a.jpg'); settle(image);
    expect(await pending).toBe(image);
    expect(loader.get('a.jpg')).toBe(image);
  });

  test('concurrent ensure calls share one load', async () => {
    const h = factoryHarness(); const loader = new ImageLoader('', { createImage: h.createImage });
    const a = loader.ensure('a.jpg'); const b = loader.ensure('a.jpg');
    expect(h.elements.size).toBe(1); settle(h.elements.get('a.jpg'));
    await expect(Promise.all([a, b])).resolves.toEqual([h.elements.get('a.jpg'), h.elements.get('a.jpg')]);
  });

  test('failure resolves null, records and warns only once', async () => {
    const h = factoryHarness(); const loader = new ImageLoader('', { createImage: h.createImage });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const a = loader.ensure('bad.jpg'); const b = loader.ensure('bad.jpg');
      h.elements.get('bad.jpg').onerror();
      await expect(Promise.all([a, b])).resolves.toEqual([null, null]);
      expect(warn).toHaveBeenCalledTimes(1); expect(loader.stats().failed).toBe(1);
    } finally { warn.mockRestore(); }
  });

  test('evicts least recently used unpinned image', async () => {
    const h = factoryHarness(); const loader = new ImageLoader('', { maxCached: 2, createImage: h.createImage });
    async function load(file) { const p = loader.ensure(file); settle(h.elements.get(file)); await p; }
    await load('a.jpg'); await load('b.jpg'); loader.get('a.jpg'); await load('c.jpg');
    expect(loader.get('a.jpg')).not.toBeNull(); expect(loader.get('b.jpg')).toBeNull();
    expect(loader.stats().evicted).toBe(1);
  });

  test('pinned files survive eviction and over-bound all-pinned cache is allowed', async () => {
    const h = factoryHarness(); const loader = new ImageLoader('', { maxCached: 1, createImage: h.createImage });
    async function load(file) { const p = loader.ensure(file); settle(h.elements.get(file)); await p; }
    await load('a.jpg'); loader.pin('a.jpg'); loader.pin('b.jpg'); await load('b.jpg');
    loader.pin('c.jpg'); await load('c.jpg'); expect(loader.get('a.jpg')).not.toBeNull(); expect(loader.get('b.jpg')).not.toBeNull();
    expect(loader.get('c.jpg')).not.toBeNull(); expect(loader.stats()).toMatchObject({ cached: 3, pinned: 3, evicted: 0 });
  });

  test('filesFrom tolerates missing data and preserves unique manifest order', () => {
    const loader = new ImageLoader('');
    expect(loader.filesFrom({})).toEqual([]); expect(loader.filesFrom(null)).toEqual([]);
    expect(loader.filesFrom({ a: {}, b: { file: 'x.jpg' }, c: { file: 'x.jpg' }, d: { file: 'y.jpg' } })).toEqual(['x.jpg', 'y.jpg']);
  });

  test('maps manifest ink ratios by filename and annotates decoded images', async () => {
    const h = factoryHarness();
    const loader = new ImageLoader('', { createImage: h.createImage });
    const metadata = loader.metadataFrom({ a: { file: 'a.webp', inkRatio: 0.42 }, b: { file: 'b.webp' } });
    expect(metadata['a.webp'].inkRatio).toBe(0.42);
    expect(loader.getInkRatio('missing.webp')).toBe(1);
    const pending = loader.ensure('a.webp');
    settle(h.elements.get('a.webp'));
    const image = await pending;
    expect(image.inkRatio).toBe(0.42);
  });

  test('stats track cache, pending, pins and failure', async () => {
    const h = factoryHarness(); const loader = new ImageLoader('', { maxCached: 1, createImage: h.createImage });
    const p = loader.ensure('a.jpg'); expect(loader.stats()).toMatchObject({ cached: 0, pending: 1, pinned: 0 });
    settle(h.elements.get('a.jpg')); await p; loader.pin('a.jpg');
    expect(loader.stats()).toMatchObject({ cached: 1, pending: 0, pinned: 1, failed: 0, evicted: 0 });
  });
});
