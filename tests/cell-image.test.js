const { createImageApplier } = require('../p5-collage/cell-image');

function makeState() {
  const s = {
    cell: { slot: 0 },
    pos: { x: 0, y: 0, w: 400, h: 300 },
    img: { name: 'first.jpg' },
    currentImageFile: 'first.jpg',
    transition: { started: [], startTransition(a, b) { this.started.push([a, b]); } },
  };
  return { cellStates: { 0: s } };
}

function makeLoader(cached = {}) {
  const calls = { get: [], ensure: [], pin: [], unpin: [] };
  let resolveEnsure;
  const loader = {
    get(file) { calls.get.push(file); return cached[file] || null; },
    ensure(file) {
      calls.ensure.push(file);
      return new Promise(resolve => { resolveEnsure = resolve; });
    },
    pin(file) { calls.pin.push(file); },
    unpin(file) { calls.unpin.push(file); },
    resolveWith(img) { resolveEnsure(img); },
  };
  return { loader, calls };
}

function makeApplier(state, loader, overrides = {}) {
  const calls = { adapt: [], update: [] };
  const applier = createImageApplier({
    state,
    imageLoader: loader,
    adaptCellToImage: s => calls.adapt.push(s),
    sendImageUpdate: (slot, file) => calls.update.push([slot, file]),
    ...overrides,
  });
  return { applier, calls };
}

describe('cell image application', () => {
  test('a cached image commits immediately: pin new, unpin old, transition, re-adapt, announce', async () => {
    const state = makeState();
    const { loader, calls: loaderCalls } = makeLoader({ 'second.jpg': { name: 'second.jpg' } });
    const { applier, calls } = makeApplier(state, loader);

    await applier.apply(0, 'second.jpg');

    expect(loaderCalls.ensure).toEqual([]);
    expect(loaderCalls.pin).toEqual(['second.jpg']);
    expect(loaderCalls.unpin).toEqual(['first.jpg']);
    expect(state.cellStates[0].currentImageFile).toBe('second.jpg');
    expect(state.cellStates[0].img).toEqual({ name: 'second.jpg' });
    expect(state.cellStates[0].transition.started).toEqual([[{ name: 'first.jpg' }, { name: 'second.jpg' }]]);
    expect(state.cellStates[0]._oldImg).toEqual({ name: 'first.jpg' });
    expect(calls.adapt).toEqual([state.cellStates[0]]);
    expect(calls.update).toEqual([[0, 'second.jpg']]);
  });

  test('an uncached image leaves the cell showing its current image until decoded', async () => {
    const state = makeState();
    const { loader, calls: loaderCalls } = makeLoader();
    const { applier, calls } = makeApplier(state, loader);

    const pending = applier.apply(0, 'slow.jpg');

    // Still showing the previous frame, nothing pinned, nothing announced yet.
    expect(state.cellStates[0].currentImageFile).toBe('first.jpg');
    expect(state.cellStates[0].img).toEqual({ name: 'first.jpg' });
    expect(state.cellStates[0]._pendingImageFile).toBe('slow.jpg');
    expect(loaderCalls.ensure).toEqual(['slow.jpg']);
    expect(loaderCalls.unpin).toEqual([]);
    expect(calls.update).toEqual([]);

    loader.resolveWith({ name: 'slow.jpg' });
    await pending;

    expect(state.cellStates[0].currentImageFile).toBe('slow.jpg');
    expect(calls.update).toEqual([[0, 'slow.jpg']]);
  });

  test('a failed load keeps the previous image untouched', async () => {
    const state = makeState();
    const { loader } = makeLoader();
    const { applier, calls } = makeApplier(state, loader);

    const pending = applier.apply(0, 'broken.jpg');
    loader.resolveWith(null);
    await pending;

    expect(state.cellStates[0].currentImageFile).toBe('first.jpg');
    expect(state.cellStates[0].img).toEqual({ name: 'first.jpg' });
    expect(calls.update).toEqual([]);
    expect(calls.adapt).toEqual([]);
  });

  test('a late load never overwrites a newer image that already committed', async () => {
    const state = makeState();
    const { loader, calls: loaderCalls } = makeLoader({ 'fast.jpg': { name: 'fast.jpg' } });
    const { applier } = makeApplier(state, loader);

    const stale = applier.apply(0, 'slow.jpg');
    await applier.apply(0, 'fast.jpg');
    expect(state.cellStates[0].currentImageFile).toBe('fast.jpg');

    // The first request finally arrives; it must be ignored.
    loader.resolveWith({ name: 'slow.jpg' });
    await stale;

    expect(state.cellStates[0].currentImageFile).toBe('fast.jpg');
    expect(state.cellStates[0].img).toEqual({ name: 'fast.jpg' });
    expect(loaderCalls.pin).toEqual(['fast.jpg']);
  });

  test('commits the bitmap when the cell already carries the file name but none is decoded', async () => {
    // This is the initial deal: the deck names the file before its bitmap loads.
    const state = makeState();
    state.cellStates[0].img = null;
    const { loader, calls: loaderCalls } = makeLoader();
    const { applier, calls } = makeApplier(state, loader);

    const pending = applier.apply(0, 'first.jpg');
    loader.resolveWith({ name: 'first.jpg' });
    await pending;

    expect(state.cellStates[0].img).toEqual({ name: 'first.jpg' });
    expect(state.cellStates[0].currentImageFile).toBe('first.jpg');
    expect(calls.update).toEqual([[0, 'first.jpg']]);
    expect(calls.adapt).toEqual([state.cellStates[0]]);
    expect(loaderCalls.unpin).toEqual([]);
  });

  test('re-applying the image a cell already shows changes nothing', async () => {
    const state = makeState();
    // The real loader returns the same cached element it committed, so re-applying
    // the current image must be a no-op.
    const shared = state.cellStates[0].img;
    const { loader, calls: loaderCalls } = makeLoader({ 'first.jpg': shared });
    const { applier, calls } = makeApplier(state, loader);

    await applier.apply(0, 'first.jpg');

    expect(loaderCalls.pin).toEqual([]);
    expect(calls.update).toEqual([]);
    expect(calls.adapt).toEqual([]);
  });

  test('an unknown slot or empty file is a no-op', async () => {
    const state = makeState();
    const { loader } = makeLoader();
    const { applier } = makeApplier(state, loader);

    await expect(applier.apply(9, 'x.jpg')).resolves.toBeNull();
    await expect(applier.apply(0, null)).resolves.toBeNull();
  });
});
