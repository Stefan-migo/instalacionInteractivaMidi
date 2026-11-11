const path = require('path');
const WebSocket = require('ws');

// Serving is not what this suite covers, but the bridge reads it at require time.
process.env.IMAGES_DIR = path.join(__dirname, 'fixtures', 'images');

const LAYOUT = require('../images/layout.json');

/**
 * Resolve with the first buffered message matching `predicate`.
 *
 * Messages are buffered from the moment the socket opens, and the buffer is
 * searched before subscribing: the bridge answers a registration with
 * `assigned` and `cell-image` back to back, so a listener attached after the
 * first one resolves would miss the second and a negative assertion would pass
 * for the wrong reason.
 */
function waitFor(socket, predicate, timeoutMs = 2000) {
  const buffered = socket.messages.find(predicate);
  if (buffered) return Promise.resolve(buffered);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('timeout waiting for message'));
    }, timeoutMs);
    function onMessage() {
      const match = socket.messages.find(predicate);
      if (!match) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(match);
    }
    socket.on('message', onMessage);
  });
}

/**
 * The collage owns the deck; `images/layout.json` carries geometry only. The
 * bridge used to seed its slot→image cache from the layout, so a phone that
 * registered before the collage published anything was shown an image the deck
 * had never drawn — and a reassignment served the same invented entry.
 */
describe('slot image authority', () => {
  let server;
  const PORT = 8097;
  const sockets = [];

  beforeAll((done) => {
    server = require('../bridge/index');
    server.listen(PORT, done);
  });

  afterAll((done) => {
    while (sockets.length) sockets.pop().terminate();
    server.close(done);
  });

  function connect() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://localhost:${PORT}`);
      socket.messages = [];
      socket.on('message', (raw) => socket.messages.push(JSON.parse(raw)));
      sockets.push(socket);
      socket.on('open', () => resolve(socket));
      socket.on('error', reject);
    });
  }

  test('a phone gets no image until a player publishes one', async () => {
    const phone = await connect();
    phone.send(JSON.stringify({ type: 'register', role: 'phone' }));
    const assigned = await waitFor(phone, (m) => m.type === 'assigned');

    // The layout names an image for this slot, and the bridge must ignore it.
    const fromLayout = LAYOUT.cells.find((cell) => cell.slot === assigned.slot).imageFile;
    expect(fromLayout).toBeTruthy();

    await expect(waitFor(phone, (m) => m.type === 'cell-image', 400)).rejects.toThrow(/timeout/);

    const player = await connect();
    player.send(JSON.stringify({ type: 'register', role: 'player' }));
    const published = '048.webp';
    player.send(JSON.stringify({ type: 'image-update', slot: assigned.slot, imageFile: published }));

    const image = await waitFor(phone, (m) => m.type === 'cell-image');
    expect(image.imageFile).toBe(published);
    expect(image.imageUrl).toBe(`/images/content/${published}`);
    expect(image.imageFile).not.toBe(fromLayout);
  });
});
