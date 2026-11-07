/**
 * Executes the real sketch.js wiring in a sandbox with p5 stubs, so the
 * deck ↔ image-loader ↔ renderer integration is covered instead of assumed.
 * No browser, no network: images resolve synchronously through an injected
 * factory.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { CONFIG } = require('../p5-collage/config');
const { ImageDeck } = require('../p5-collage/image-deck');
const { ImageLoader } = require('../p5-collage/image-loader');
const { createCellActionHandler } = require('../p5-collage/cell-actions');
const { createImageApplier } = require('../p5-collage/cell-image');
const { adaptCellToImage } = require('../p5-collage/cell-renderer');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'p5-collage', 'sketch.js'), 'utf8');

/** An ImageLoader whose bitmaps decode synchronously from an injected factory. */
function makeLoader() {
  return new ImageLoader('', {
    maxCached: 200,
    createImage: () => {
      const image = { naturalWidth: 400, naturalHeight: 300, width: 400, height: 300 };
      Object.defineProperty(image, 'src', {
        set(value) {
          image.srcValue = value;
          if (typeof image.onload === 'function') image.onload();
        },
      });
      return image;
    },
  });
}

function boot({ fileCount = 40, cellCount = 3 } = {}) {
  const files = Array.from({ length: fileCount }, (_, i) => `photo-${String(i).padStart(3, '0')}.jpg`);
  const cells = Array.from({ length: cellCount }, (_, i) => ({
    slot: i, x: 10 * i, y: 20 * i, w: 400, h: 300, imageFile: null,
  }));

  class FakeSocket {
    constructor() { this.sent = []; this.readyState = FakeSocket.OPEN; FakeSocket.last = this; }
    send(payload) { this.sent.push(JSON.parse(payload)); }
    close() {}
  }
  FakeSocket.OPEN = 1;

  const noop = () => {};
  const context = {
    CONFIG,
    ImageDeck,
    ImageLoader,
    FakeSocket,
    TransitionRenderer: class { startTransition() { this.started = true; } update() { return { state: 'idle' }; } },
    createCellActionHandler,
    createImageApplier,
    adaptCellToImage,
    console, Math, Promise, Number, Object, Array, JSON, Set, Date,
    document: { getElementById: () => null, querySelector: () => null },
    location: { protocol: 'http:', hostname: 'localhost', host: 'localhost:8080' },
    WebSocket: FakeSocket,
    drawImg: noop, redraw: noop, millis: () => 0, background: noop, image: noop,
    push: noop, pop: noop, translate: noop, rotate: noop, scale: noop, radians: v => v,
    noFill: noop, stroke: noop, strokeWeight: noop, rect: noop, rectMode: noop,
    drawingContext: {}, createCanvas: noop, noLoop: noop,
    mouseX: 0, mouseY: 0, touches: [],
    setInterval: () => 0, setTimeout: () => 0, clearInterval: noop,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(SOURCE, context);

  // Install collaborators through in-context assignments: sketch.js declares
  // them with `let`, so a property on the context object would be shadowed.
  const loader = makeLoader();
  context.__collab = { loader, cells, files };
  vm.runInContext(`
    imageLoader = __collab.loader;
    collageLayout = { cells: __collab.cells };
    imageDeck = new ImageDeck(__collab.files, { rng: () => 0 });
  `, context);

  const renderer = vm.runInContext('createRenderer()', context);
  vm.runInContext('deviceManager = { renderer: __renderer }', Object.assign(context, { __renderer: renderer }));
  // Mirror DeviceManager.initAll(), which is what calls initCell in production.
  for (const cell of cells) renderer.initCell(cell.slot, cell);
  return { context, renderer, cells, files, loader };
}

describe('sketch wiring — deck, loader and renderer together', () => {
  test('every cell claims a distinct image from the deck', () => {
    const { renderer, files } = boot({ cellCount: 30 });
    const shown = Object.values(renderer.cellStates).map(s => s.currentImageFile);
    expect(shown).toHaveLength(30);
    expect(new Set(shown).size).toBe(30);
    for (const file of shown) expect(files).toContain(file);
  });

  test('the deck decides each cell image, not layout.json', () => {
    const { renderer } = boot({ cellCount: 3 });
    const shown = Object.values(renderer.cellStates).map(s => s.currentImageFile);
    expect(shown.every(file => typeof file === 'string' && file.endsWith('.jpg'))).toBe(true);
  });

  test('cycling advances the deck and the cell settles on the new image', async () => {
    const { renderer, context } = boot({ cellCount: 3 });
    const before = renderer.cellStates[0].currentImageFile;
    renderer.handleAction(0, 'cycle-next', context.imageLoader, null);
    await renderer.cellStates[0]._readyPromise;
    const after = renderer.cellStates[0].currentImageFile;
    expect(after).not.toBe(before);
    expect(vm.runInContext('imageDeck.current(0)', context)).toBe(after);
    expect(renderer.cellStates[0].img).not.toBeNull();
  });

  test('opening the socket publishes one image-update per cell', () => {
    const { context, cells } = boot({ cellCount: 30 });
    vm.runInContext('connectWebSocket(); ws.onopen();', context);
    const sent = context.FakeSocket.last.sent;
    const updates = sent.filter(m => m.type === 'image-update');
    expect(updates).toHaveLength(cells.length);
    expect(new Set(updates.map(m => m.imageFile)).size).toBe(cells.length);
    expect(sent[0]).toEqual({ type: 'register', role: 'player' });
  });

  test('an empty library still initialises every cell without throwing', () => {
    const { renderer } = boot({ fileCount: 0, cellCount: 30 });
    const states = Object.values(renderer.cellStates);
    expect(states).toHaveLength(30);
    for (const s of states) {
      expect(s.currentImageFile).toBeNull();
      expect(s.img).toBeNull();
    }
  });
});
