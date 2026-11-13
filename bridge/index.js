const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { SlotAllocator } = require('./slot-allocator');
const { MessageRelay, parseRecordingDuration } = require('./message-relay');
const { GestureStore } = require('./gesture-store');
const { DTWMatcher } = require('./dtw-matcher');
const { createGroupAggregator, groupForOrdinal, touchPositionToCc, touchScaleToCc, touchRotationToCc } = require('./group-state');
const { createGestureTriggers } = require('./gesture-triggers');
const { createVoiceGate } = require('./voice-gate');
const { startHeartbeat } = require('./heartbeat');
const { createMusicState } = require('./music-state');
const { SLOT_COUNT, DEFAULT_GROUP_COUNT, deriveTopology } = require('./topology');
const { parseEmitRequest } = require('./message-relay');
const { validateSizes } = require('../p5-collage/size-classes');
const { validateDeckList } = require('../p5-collage/deck-list');

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, limit, callback) {
  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > limit) {
      req.destroy();
      callback(new Error('body too large'));
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    try {
      callback(null, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
    } catch (error) {
      callback(error);
    }
  });
  req.on('error', (error) => callback(error));
}

const ROOT_DIR = path.join(__dirname, '..');
// Overridable so tests (and deployments with assets elsewhere) do not depend on the
// repository carrying image content. Absolute paths are honoured as given.
const IMAGE_DIR = process.env.IMAGES_DIR
  ? path.resolve(process.env.IMAGES_DIR)
  : path.join(ROOT_DIR, 'images', 'content');
const LAYOUT_PATH = path.join(ROOT_DIR, 'images', 'layout.json');
const MANIFEST_PATH = path.join(ROOT_DIR, 'images', 'manifest.json');
const SIZES_PATH = process.env.SIZES_PATH ? path.resolve(process.env.SIZES_PATH) : path.join(ROOT_DIR, 'images', 'sizes.json');
const SIZE_WRITE_LIMIT = 16 * 1024;
const DECK_PATH = process.env.DECK_PATH ? path.resolve(process.env.DECK_PATH) : path.join(ROOT_DIR, 'images', 'deck.json');
const DECK_WRITE_LIMIT = 16 * 1024;
const PHONE_CLIENT_DIR = path.join(ROOT_DIR, 'phone-client');
const P5_COLLAGE_DIR = path.join(ROOT_DIR, 'p5-collage');
const OPERATOR_DIR = path.join(ROOT_DIR, 'operator');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  // Brand assets: a favicon served as octet-stream is ignored by browsers, and a
  // manifest served as text/plain is never read as a manifest.
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const GESTURE_ACTIONS = {
  // The gallery on the phone teaches látigo as "cambia foto", and practice has
  // always sent `shuffle`. One gesture, one action: the whip swaps the image
  // with another fragment instead of advancing this cell's deck.
  'flick': 'shuffle',
};

// Reported by /health so an operator can tell one instance from two. Two
// instances is the failure mode this whole design forbids: the state is in memory.
const STARTED_AT = new Date().toISOString();

// The partition is configuration, never a constant (S12): GROUP_COUNT decides how
// many groups the thirty phones form, and the score must declare the same number.
const topology = deriveTopology(SLOT_COUNT, Number(process.env.GROUP_COUNT || DEFAULT_GROUP_COUNT));
const allocator = new SlotAllocator(topology.slotCount, 5000);
const relay = new MessageRelay();
const gestureStore = new GestureStore();

// Which image a slot is actually showing. The p5 collage is the only authority:
// it owns the deck, and `images/layout.json` carries geometry only, so seeding
// this from the layout handed phones an image the deck had never drawn. Every
// entry here comes from an `image-update` published by a player.
const slotImageMap = {};
const dtwMatcher = new DTWMatcher(gestureStore, {
  threshold: 0.5,
  downsampleHz: 10,
  debounceMs: 1000,
  defaultAction: 'shuffle',
});
const p5Players = new Set();
const phoneConnections = new Map();
let phoneOrdinal = 0;
function slotToConnection(slot) {
  for (const info of phoneConnections.values()) {
    if (info.slot === slot) return info;
  }
  return null;
}
// Agents are the audio side: they hold no slot, receive per-group state and
// answer with the aggregation they want. See odd/tasks/ableton-music.md, S3.
const musicAgents = new Set();
const groupAggregator = createGroupAggregator({
  groupCount: topology.groupCount,
  slotsPerGroup: topology.slotsPerGroup,
  resolveGroup: slot => {
    const info = slotToConnection(slot);
    return info ? info.group : null;
  },
});
const gestureTriggers = createGestureTriggers();
const voiceGate = createVoiceGate();
const musicState = createMusicState();

// The continuous lanes are driven by the pad, not by the gyroscope (see
// odd/tasks/touch-faders.md, S1). A phone joins the music with its resting
// values so the group average never jumps when the second phone touches.
const RESTING_SCALE = 100;
const RESTING_ROTATION = 0;

function seedTouchLanes(slot) {
  groupAggregator.pushLane(slot, 'position', 0);
  groupAggregator.pushLane(slot, 'scale', touchScaleToCc(RESTING_SCALE));
  groupAggregator.pushLane(slot, 'rotation', touchRotationToCc(RESTING_ROTATION));
}

// Move carries a delta (speed), scale and rotation carry their absolute slider
// value. A frame the mapper cannot read leaves its lane untouched.
function feedTouchLanes(msg, slot) {
  if (!msg || !Number.isInteger(slot)) return;
  if (msg.action === 'move') {
    groupAggregator.pushLane(slot, 'position', touchPositionToCc(msg.dx, msg.dy));
    return;
  }
  if (msg.action === 'scale') {
    groupAggregator.pushLane(slot, 'scale', touchScaleToCc(msg.value));
    return;
  }
  if (msg.action === 'rotation') {
    groupAggregator.pushLane(slot, 'rotation', touchRotationToCc(msg.value));
  }
}
// Flick comes from the DTW matcher as an already-discrete event, so it has no
// derived velocity. 100 reads as a firm hit without pretending to measure it.
const FLICK_VELOCITY = 100;
// A flick is the most specific gesture, so it silences the two derived ones for
// this long: the same shake must not also arrive as a tilt or a rotation.
const FLICK_SUPPRESS_MS = 400;

// Diagnostic ring buffer: the last couple of seconds of raw sensor frames per
// phone. A gesture that reads wrong is a fact about which axis the hand moved,
// so the numbers are kept and read out, never guessed at.
const SENSOR_TRACE_FRAMES = 900;
const sensorTrace = new Map();

// deviceId -> { slot, seenAt }. A phone that comes back keeps its fragment: its
// slot stays reserved for it, so a reconnect never moves a performer into another
// group mid-show. The record expires so a phone that really left frees its slot.
const DEVICE_MEMORY_MS = 10 * 60 * 1000;
const deviceSlots = new Map();

function rememberDevice(deviceId, slot) {
  if (typeof deviceId !== 'string' || !deviceId) return;
  deviceSlots.set(deviceId, { slot, seenAt: Date.now() });
}

function slotForDevice(deviceId) {
  if (typeof deviceId !== 'string' || !deviceId) return null;
  const record = deviceSlots.get(deviceId);
  if (!record) return null;
  if (Date.now() - record.seenAt > DEVICE_MEMORY_MS) {
    deviceSlots.delete(deviceId);
    return null;
  }
  if (!allocator.reclaim(record.slot)) return null;
  return record.slot;
}

function traceSensor(slot, message) {
  let frames = sensorTrace.get(slot);
  if (!frames) {
    frames = [];
    sensorTrace.set(slot, frames);
  }
  frames.push({ at: Date.now(), gyro: message.gyro, orientation: message.orientation });
  if (frames.length > SENSOR_TRACE_FRAMES) frames.shift();
}
const MUSIC_STATE_INTERVAL_MS = 50;
let musicStateTimer = null;

function broadcastToPlayers(data) {
  const msg = JSON.stringify(data);
  for (const ws of p5Players) {
    if (ws.readyState !== 1) continue;
    try { ws.send(msg); } catch (e) {}
  }
}

function broadcastToAgents(data) {
  if (musicAgents.size === 0) return;
  const msg = JSON.stringify(data);
  for (const ws of musicAgents) {
    if (ws.readyState !== 1) continue;
    try { ws.send(msg); } catch (e) {}
  }
}

function startMusicStateTimer() {
  if (musicStateTimer) return;
  musicStateTimer = setInterval(() => {
    if (musicAgents.size === 0) return;
    broadcastToAgents({ type: 'music-state', groups: groupAggregator.snapshot() });
    // The tick is also the dedupe window: ten phones of a group that gesture
    // together become one voice with the hardest velocity of the batch.
    const voices = voiceGate.flush();
    if (voices.length > 0) {
      broadcastToAgents({ type: 'music-gesture', voices });
    }
  }, MUSIC_STATE_INTERVAL_MS);
  // The state feed must never be the reason the process (or a test run) stays alive.
  if (typeof musicStateTimer.unref === 'function') musicStateTimer.unref();
}

function stopMusicStateTimer() {
  if (!musicStateTimer) return;
  clearInterval(musicStateTimer);
  musicStateTimer = null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      pid: process.pid,
      startedAt: STARTED_AT,
      clients: wss.clients.size,
      agents: musicAgents.size,
    }));
    return;
  }

  if (pathname === '/api/music') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(musicState.snapshot({ agent: musicAgents.size > 0, phones: phoneConnections.size, bridgeGroups: topology.groupCount })));
    return;
  }

  // Read-only diagnostic: the last sensor frames per phone, in arrival order.
  if (pathname === '/api/music/debug') {
    const slots = {};
    for (const [slot, frames] of sensorTrace) slots[slot] = frames;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ frames: SENSOR_TRACE_FRAMES, slots }));
    return;
  }

  // Firing one voice so Live can learn it. The panel may ask; it may never write.
  if (pathname === '/api/music/emit' && req.method === 'POST') {
    readJsonBody(req, 4096, (error, body) => {
      if (error) return sendJson(res, 400, { ok: false, reason: 'invalido' });
      const message = parseEmitRequest(body);
      if (!message) return sendJson(res, 400, { ok: false, reason: 'invalido' });
      if (musicAgents.size === 0) return sendJson(res, 409, { ok: false, reason: 'sin-agente' });
      const port = musicState.snapshot({ agent: true }).status.port;
      if (port !== 'open') return sendJson(res, 409, { ok: false, reason: 'sin-puerto' });
      const payload = JSON.stringify(message);
      for (const client of musicAgents) {
        if (client.readyState === 1) client.send(payload);
      }
      return sendJson(res, 200, { ok: true });
    });
    return;
  }

  if (pathname === '/api/sizes' && req.method === 'GET') {
    fs.readFile(SIZES_PATH, 'utf8', (error, text) => {
      try {
        if (error) throw error;
        const sizes = JSON.parse(text);
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        validateSizes(sizes, Object.keys(manifest));
        return sendJson(res, 200, sizes);
      } catch (readError) {
        return sendJson(res, 200, { version: 1, classes: { S: 0.015, M: 0.03, L: 0.06, XL: 0.1 }, assignments: {} });
      }
    });
    return;
  }

  if (pathname === '/api/deck' && req.method === 'GET') {
    fs.readFile(DECK_PATH, 'utf8', (error, text) => {
      try {
        if (error) throw error;
        const deck = JSON.parse(text);
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        validateDeckList(deck, Object.keys(manifest));
        return sendJson(res, 200, deck);
      } catch {
        return sendJson(res, 200, { version: 1, excluded: [] });
      }
    });
    return;
  }

  if (pathname === '/api/deck' && req.method === 'POST') {
    if (process.env.AUTHORING_WRITES_ENABLED !== 'true') return sendJson(res, 403, { ok: false, error: 'Deck assignments are disabled' });
    readJsonBody(req, DECK_WRITE_LIMIT, async (error, submitted) => {
      if (error) return sendJson(res, error.message === 'body too large' ? 413 : 400, { ok: false, error: error.message });
      try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        validateDeckList(submitted, Object.keys(manifest));
      } catch (validationError) { return sendJson(res, 400, { ok: false, error: validationError.message }); }
      const tempPath = `${DECK_PATH}.${process.pid}.${Date.now()}.tmp`;
      try {
        await fs.promises.writeFile(tempPath, `${JSON.stringify(submitted, null, 2)}\\n`, { flag: 'wx' });
        await fs.promises.rename(tempPath, DECK_PATH);
        return sendJson(res, 200, { ok: true });
      } catch {
        try { await fs.promises.unlink(tempPath); } catch {}
        return sendJson(res, 500, { ok: false, error: 'Failed to save deck' });
      }
    });
    return;
  }

  if (pathname === '/api/sizes' && req.method === 'POST') {
    if (process.env.AUTHORING_WRITES_ENABLED !== 'true') {
      return sendJson(res, 403, { ok: false, error: 'Size assignments are disabled' });
    }
    let size = 0;
    const chunks = [];
    let rejected = false;
    req.on('data', chunk => {
      if (rejected) return;
      size += chunk.length;
      if (size > SIZE_WRITE_LIMIT) {
        rejected = true;
        chunks.length = 0;
        sendJson(res, 413, { ok: false, error: 'Sizes payload too large' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (rejected) return;
      let submitted;
      try {
        submitted = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const current = JSON.parse(fs.readFileSync(SIZES_PATH, 'utf8'));
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        if (!submitted || Object.keys(submitted).sort().join(',') !== 'assignments,classes,version') {
          throw new Error('Invalid sizes: expected version, classes, and assignments only');
        }
        validateSizes(submitted, Object.keys(manifest));
        const submittedClasses = Object.keys(submitted.classes).sort();
        const configuredClasses = Object.keys(current.classes).sort();
        if (submittedClasses.length !== configuredClasses.length || submittedClasses.some((name, index) =>
          name !== configuredClasses[index] || submitted.classes[name] !== current.classes[name])) {
          throw new Error('Invalid sizes: class areas must match the configured classes');
        }
      } catch (error) {
        return sendJson(res, 400, { ok: false, error: error.message || 'Invalid sizes JSON' });
      }
      const tempPath = `${SIZES_PATH}.${process.pid}.${Date.now()}.tmp`;
      try {
        await fs.promises.writeFile(tempPath, `${JSON.stringify(submitted, null, 2)}\n`, { flag: 'wx' });
        await fs.promises.rename(tempPath, SIZES_PATH);
        return sendJson(res, 200, { ok: true });
      } catch (error) {
        try { await fs.promises.unlink(tempPath); } catch {}
        return sendJson(res, 500, { ok: false, error: 'Failed to save sizes' });
      }
    });
    req.on('error', () => {
      if (!res.headersSent) sendJson(res, 400, { ok: false, error: 'Invalid sizes request' });
    });
    return;
  }

  if (pathname === '/api/layout') {
    fs.readFile(LAYOUT_PATH, (err, data) => {
      if (err) { res.writeHead(500); res.end('{}'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    });
    return;
  }

  if (pathname === '/api/manifest') {
    fs.readFile(MANIFEST_PATH, (err, data) => {
      if (err) { res.writeHead(500); res.end('{}'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    });
    return;
  }

  if (pathname.startsWith('/images/content/')) {
    let imageName;
    try {
      imageName = decodeURIComponent(pathname.slice('/images/content/'.length));
    } catch (e) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    if (imageName === '.' || imageName === '..') {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    const filePath = path.join(IMAGE_DIR, path.basename(imageName));
    serveFile(filePath, res);
    return;
  }

  if (pathname === '/phone-client' || pathname.startsWith('/phone-client/')) {
    let relative = pathname.replace(/^\/phone-client/, '') || '/';
    if (relative === '/') relative = '/index.html';
    const filePath = path.join(PHONE_CLIENT_DIR, relative);
    serveFile(filePath, res);
    return;
  }

  if (pathname === '/p5-collage' || pathname.startsWith('/p5-collage/')) {
    let relative = pathname.replace(/^\/p5-collage/, '') || '/';
    if (relative === '/') relative = '/index.html';
    const filePath = path.join(P5_COLLAGE_DIR, relative);
    serveFile(filePath, res);
    return;
  }

  if (pathname === '/operator' || pathname.startsWith('/operator/')) {
    let relative = pathname.replace(/^\/operator/, '') || '/';
    if (relative === '/') relative = '/index.html';
    const filePath = path.join(OPERATOR_DIR, relative);
    serveFile(filePath, res);
    return;
  }

  if (pathname === '/shared' || pathname.startsWith('/shared/')) {
    let relative = pathname.replace(/^\/shared/, '') || '/';
    if (relative === '/') relative = '/index.html';
    const filePath = path.join(SHARED_DIR, relative);
    serveFile(filePath, res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isJS = ext === '.js';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    };
    if (isJS) {
      headers['Cache-Control'] = 'no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

const wss = new WebSocketServer({ server });

// Cloud proxies cut idle sockets and a phone carried out of range leaves a
// half-open one. Pinging keeps the connection honest and frees dead slots.
const heartbeat = startHeartbeat({
  clients: wss.clients,
  intervalMs: parseInt(process.env.HEARTBEAT_MS, 10) || undefined,
});
wss.on('close', () => heartbeat.stop());

wss.on('connection', (ws) => {
  let info = { role: null, slot: -1 };

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch { return; }

    if (!info.role) {
      if (msg.type === 'register' && msg.role === 'player') {
        info.role = 'player';
        p5Players.add(ws);
        // Replay existing phone state so late-joining players catch up
        for (const slot of allocator.activeSlots) {
          ws.send(JSON.stringify(relay.formatAssignMessage(slot, '')));
        }
        return;
      }
      if (msg.type === 'register' && msg.role === 'agent') {
        info.role = 'agent';
        musicAgents.add(ws);
        startMusicStateTimer();
        ws.send(JSON.stringify({ type: 'system', event: 'agent-ready' }));
        ws.send(JSON.stringify({ type: 'music-config', groups: groupAggregator.config() }));
        return;
      }
      if (msg.type === 'register' && msg.role === 'phone') {
        // A returning phone gets its own slot back before anyone else's.
        const remembered = slotForDevice(msg.deviceId);
        const slot = remembered !== null ? remembered : allocator.allocate();
        if (slot === -1) {
          ws.send(JSON.stringify({ type: 'error', message: 'All slots full' }));
          ws.close();
          return;
        }
        rememberDevice(msg.deviceId, slot);
        info.role = 'phone';
        info.slot = slot;
        info.group = groupForOrdinal(++phoneOrdinal, topology.groupCount);
        phoneConnections.set(ws, info);
        ws.send(JSON.stringify({ type: 'assigned', slot }));
        // Send current cell-image if available
        if (slotImageMap[slot]) {
          ws.send(JSON.stringify(relay.formatCellImageMessage(
            slot, slotImageMap[slot].imageFile, slotImageMap[slot].imageUrl
          )));
        }
        broadcastToPlayers(relay.formatAssignMessage(slot, ''));
        seedTouchLanes(slot);
        return;
      }
      ws.send(JSON.stringify({ type: 'error', message: 'Send { type: "register", role: "phone"|"player"|"agent" }' }));
      return;
    }

    if (info.role === 'phone') {
      const validation = relay.validateSensorMessage(msg);
      if (!validation.valid) return;
      if (msg.type === 'sensor') {
        broadcastToPlayers(relay.formatSensorBatchMessage(info.slot, msg.accel, msg.gyro, msg.orientation));
        traceSensor(info.slot, msg);

        // Continuous signals become discrete gestures only when someone wants them.
        if (musicAgents.size > 0) {
          const group = info.group;
          if (group !== null) {
            for (const event of gestureTriggers.feed(info.slot, msg)) {
              voiceGate.add(group, event.gesture, event.velocity);
            }
          }
        }

        // Feed samples to gesture recording (stores sensor data while recording)
        gestureStore.addSample(info.slot, msg);

        // Feed DTW matcher for gesture recognition
        const matchResult = dtwMatcher.addSample(info.slot, msg);
        if (matchResult && matchResult.matched) {
          broadcastToPlayers(relay.formatGestureEventMessage(
            info.slot, 'matched', matchResult.gestureId, matchResult.action
          ));
          const flickGroup = info.group;
          if (musicAgents.size > 0 && flickGroup !== null) {
            voiceGate.add(flickGroup, 'flick', FLICK_VELOCITY);
          }
          gestureTriggers.suppress(info.slot, FLICK_SUPPRESS_MS);
        }
      } else if (msg.type === 'gesture') {
        const action = GESTURE_ACTIONS[msg.gesture];
        if (action) {
          broadcastToPlayers(relay.formatGestureEventMessage(info.slot, 'matched', null, action));
          const declaredGroup = info.group;
          if (musicAgents.size > 0 && declaredGroup !== null) {
            voiceGate.add(declaredGroup, 'flick', FLICK_VELOCITY);
          }
          gestureTriggers.suppress(info.slot, FLICK_SUPPRESS_MS);
        }
      } else if (msg.type === 'action') {
        feedTouchLanes(msg, info.slot);
        if (msg.action === 'record-start') {
          const duration = parseRecordingDuration(msg);
          gestureStore.startRecording(info.slot);
          ws.send(JSON.stringify({ type: 'gesture-status', recording: true }));
          if (gestureStore.recordingTimers) {
            gestureStore.recordingTimers[info.slot] = setTimeout(() => {
              const gId = gestureStore.stopRecording(info.slot);
              if (gId) {
                try { ws.send(JSON.stringify({ type: 'gesture-status', recording: false, gestureId: gId })); } catch {}
                broadcastToPlayers(relay.formatGestureEventMessage(info.slot, 'recorded', gId));
              }
            }, duration);
          }
        } else if (msg.action === 'record-stop') {
          // Clear auto-stop timer
          if (gestureStore.recordingTimers && gestureStore.recordingTimers[info.slot]) {
            clearTimeout(gestureStore.recordingTimers[info.slot]);
            delete gestureStore.recordingTimers[info.slot];
          }
          const gestureId = gestureStore.stopRecording(info.slot);
          if (gestureId) {
            ws.send(JSON.stringify({ type: 'gesture-status', recording: false, gestureId }));
            broadcastToPlayers(relay.formatGestureEventMessage(info.slot, 'recorded', gestureId));
          }
        } else if (msg.action === 'cell-next' || msg.action === 'cell-prev') {
          const emptySlots = allocator.getEmptySlots();
          if (emptySlots.length === 0) return;

          const currentSlot = info.slot;
          const direction = msg.action === 'cell-next' ? 1 : -1;
          let targetSlot = -1;

          if (direction === 1) {
            // Next empty slot AFTER current, wrap to first
            const after = emptySlots.filter(s => s > currentSlot);
            targetSlot = after.length > 0 ? after[0] : emptySlots[0];
          } else {
            // Previous empty slot BEFORE current, wrap to last
            const before = emptySlots.filter(s => s < currentSlot);
            targetSlot = before.length > 0 ? before[before.length - 1] : emptySlots[emptySlots.length - 1];
          }

          if (targetSlot === -1 || targetSlot === currentSlot) return;

          const success = allocator.reassign(currentSlot, targetSlot);
          if (!success) return;

          // Update phone's slot tracking
          const oldSlot = info.slot;
          info.slot = targetSlot;

          // Keep the phone's group and pad values while its cell changes.
          groupAggregator.move(oldSlot, targetSlot);

          // Broadcast disconnect for the old slot
          broadcastToPlayers(relay.formatDisconnectMessage(oldSlot));

          // Tell the phone its new fragment
          ws.send(JSON.stringify({ type: 'assigned', slot: targetSlot }));

          // Send new cell-image if available
          if (slotImageMap[targetSlot]) {
            ws.send(JSON.stringify(relay.formatCellImageMessage(
              targetSlot, slotImageMap[targetSlot].imageFile, slotImageMap[targetSlot].imageUrl
            )));
          }

          // Broadcast the new assign to p5 players
          broadcastToPlayers(relay.formatAssignMessage(targetSlot, ''));
          return; // Don't fall through to generic action broadcast
        }
        broadcastToPlayers(relay.formatActionMessage(info.slot, msg.action, msg));
      }
    } else if (info.role === 'player') {
      if (msg.type === 'image-update' && typeof msg.slot === 'number' && msg.imageFile) {
        console.log(`[bridge] image-update: slot=${msg.slot}, file=${msg.imageFile}`);
        slotImageMap[msg.slot] = {
          imageFile: msg.imageFile,
          imageUrl: `/images/content/${msg.imageFile}`,
        };
        // Relay to phone clients
        const relayMsg = relay.formatCellImageMessage(
          msg.slot, msg.imageFile, `/images/content/${msg.imageFile}`
        );
        for (const [phoneWs, phoneInfo] of phoneConnections) {
          if (phoneInfo.slot === msg.slot && phoneWs.readyState === 1) {
            try {
              phoneWs.send(JSON.stringify(relayMsg));
            } catch (e) {}
          }
        }
      }
    } else if (info.role === 'agent') {
      if (msg.type === 'music-output') {
        musicState.recordOutput(msg);
      }
      if (msg.type === 'music-config') {
        if (msg.portStatus === 'open' || msg.portStatus === 'closed') musicState.recordOutput({ output: 'port', status: msg.portStatus });
        musicState.acceptConfig(msg);
        const applied = [];
        for (const entry of (Array.isArray(msg.groups) ? msg.groups : [])) {
          if (!entry || typeof entry !== 'object') continue;
          if (groupAggregator.setMode(entry.group, entry.mode)) {
            applied.push({ group: entry.group, mode: entry.mode });
          }
        }
        // The score also decides how a phone gesture is derived: the agent owns
        // that decision, the bridge only applies it.
        if (msg.derivation && typeof msg.derivation === 'object') {
          gestureTriggers.configure(msg.derivation);
        }
        ws.send(JSON.stringify({ type: 'music-config-applied', groups: applied }));
      }
    }
  });

  ws.on('close', () => {
    if (info.role === 'phone' && info.slot >= 0) {
      gestureStore.discardRecording(info.slot);
      allocator.free(info.slot);
      phoneConnections.delete(ws);
      // A disconnected phone stops contributing instead of freezing its last value.
      groupAggregator.drop(info.slot);
      gestureTriggers.reset(info.slot);
      broadcastToPlayers(relay.formatDisconnectMessage(info.slot));
    }
    if (info.role === 'player') {
      p5Players.delete(ws);
    }
    if (info.role === 'agent') {
      musicAgents.delete(ws);
      if (musicAgents.size === 0) stopMusicStateTimer();
    }
  });
});

if (require.main === module) {
  const PORT = parseInt(process.env.PORT, 10) || 8080;
  server.listen(PORT, () => {
    console.log(`Bridge running on :${PORT}`);
  });
}

module.exports = server;
