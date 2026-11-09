const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { SlotAllocator } = require('./slot-allocator');
const { MessageRelay, parseRecordingDuration } = require('./message-relay');
const { GestureStore } = require('./gesture-store');
const { DTWMatcher } = require('./dtw-matcher');
const { createGroupAggregator, sensorIntensity, groupForSlot } = require('./group-state');
const { createGestureTriggers } = require('./gesture-triggers');
const { createVoiceGate } = require('./voice-gate');
const { startHeartbeat } = require('./heartbeat');
const { createMusicState } = require('./music-state');
const { SLOT_COUNT, DEFAULT_GROUP_COUNT, deriveTopology } = require('./topology');
const { parseEmitRequest } = require('./message-relay');

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
const PHONE_CLIENT_DIR = path.join(ROOT_DIR, 'phone-client');
const P5_COLLAGE_DIR = path.join(ROOT_DIR, 'p5-collage');
const OPERATOR_DIR = path.join(ROOT_DIR, 'operator');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  // Brand assets: a favicon served as octet-stream is ignored by browsers, and a
  // manifest served as text/plain is never read as a manifest.
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const GESTURE_ACTIONS = {
  'flick': 'cycle-next',
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

// Pre-populate slotImageMap from layout.json so phones always get initial image on connect
const slotImageMap = {};
(function initSlotImageMap() {
  try {
    if (fs.existsSync(LAYOUT_PATH)) {
      const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
      if (layout && Array.isArray(layout.cells)) {
        for (const cell of layout.cells) {
          if (cell && typeof cell.slot === 'number' && cell.imageFile) {
            slotImageMap[cell.slot] = {
              imageFile: cell.imageFile,
              imageUrl: '/images/content/' + cell.imageFile,
            };
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to init slotImageMap from layout:', e.message);
  }
})();
const dtwMatcher = new DTWMatcher(gestureStore, {
  threshold: 0.5,
  downsampleHz: 10,
  debounceMs: 1000,
  defaultAction: 'cycle-next',
});
const p5Players = new Set();
const phoneConnections = new Map();
// Agents are the audio side: they hold no slot, receive per-group state and
// answer with the aggregation they want. See odd/tasks/ableton-music.md, S3.
const musicAgents = new Set();
const groupAggregator = createGroupAggregator({ groupCount: topology.groupCount, slotsPerGroup: topology.slotsPerGroup });
const gestureTriggers = createGestureTriggers();
const voiceGate = createVoiceGate();
const musicState = createMusicState();
// Flick comes from the DTW matcher as an already-discrete event, so it has no
// derived velocity. 100 reads as a firm hit without pretending to measure it.
const FLICK_VELOCITY = 100;
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
        const slot = allocator.allocate();
        if (slot === -1) {
          ws.send(JSON.stringify({ type: 'error', message: 'All slots full' }));
          ws.close();
          return;
        }
        info.role = 'phone';
        info.slot = slot;
        phoneConnections.set(ws, info);
        ws.send(JSON.stringify({ type: 'assigned', slot }));
        // Send current cell-image if available
        if (slotImageMap[slot]) {
          ws.send(JSON.stringify(relay.formatCellImageMessage(
            slot, slotImageMap[slot].imageFile, slotImageMap[slot].imageUrl
          )));
        }
        broadcastToPlayers(relay.formatAssignMessage(slot, ''));
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
        // Same frame, reduced once: the agents never see 30 phones, only 3 groups.
        groupAggregator.push(info.slot, sensorIntensity(msg));

        // Continuous signals become discrete gestures only when someone wants them.
        if (musicAgents.size > 0) {
          const group = groupForSlot(info.slot);
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
          const flickGroup = groupForSlot(info.slot);
          if (musicAgents.size > 0 && flickGroup !== null) {
            voiceGate.add(flickGroup, 'flick', FLICK_VELOCITY);
          }
        }
      } else if (msg.type === 'gesture') {
        const action = GESTURE_ACTIONS[msg.gesture];
        if (action) {
          broadcastToPlayers(relay.formatGestureEventMessage(info.slot, 'matched', null, action));
          const declaredGroup = groupForSlot(info.slot);
          if (musicAgents.size > 0 && declaredGroup !== null) {
            voiceGate.add(declaredGroup, 'flick', FLICK_VELOCITY);
          }
        }
      } else if (msg.type === 'action') {
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
