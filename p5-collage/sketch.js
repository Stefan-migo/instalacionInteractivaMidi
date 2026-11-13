let collageLayout, deviceManager, imageLoader, imageDeck, ws;
let _cellsReady = 0, _cellsTotal = 0;
let sizeClassesData = null;

function updateLoadCount() {
  const el = document.getElementById('load-count');
  if (el) el.textContent = `${_cellsReady} / ${_cellsTotal}`;
}
let activeSlots = [];
let lastFrameTime = 0;
let selectedSlot = null;

function sendImageUpdate(slot, imageFile) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'image-update', slot, imageFile }));
  }
}

function setup() {
  createCanvas(1920, 1080);
  noLoop();

  const bridgeUrl = location.protocol === 'https:' ? '' : `http://${location.hostname}:${CONFIG.bridgePort}`;
  imageLoader = new ImageLoader(bridgeUrl, { maxCached: CONFIG.imageCacheSize });

  Promise.all([
    imageLoader.loadLayout(),
    imageLoader.loadManifest(),
    imageLoader.loadSizes(),
  ]).then(([layoutData, manifestData, sizesData]) => {
    sizeClassesData = sizesData;
    collageLayout = new CollageLayout(layoutData);
    // The deck is the single authority for which image each cell shows.
    const inkMetadata = imageLoader.metadataFrom(manifestData);
    imageDeck = new ImageDeck(imageLoader.filesFrom(manifestData), { metadata: inkMetadata });

    const fileToKey = Object.fromEntries(Object.entries(manifestData).map(([key, entry]) => [entry.file, key]));
    imageLoader.fileToKey = fileToKey;
    const sm = new SensorMapper(CONFIG);
    const renderer = createRenderer();
    renderer.fileToKey = fileToKey;
    const layoutEngine = new LayoutPresetEngine(1920, 1080);
    layoutEngine.scatterScale = CONFIG.scatterScale || 1.0;

    const imageLoaderGet = { get: (id) => imageLoader.get(id) };
    deviceManager = new DeviceManager(collageLayout, renderer, sm, imageLoaderGet, layoutEngine);

    // Init ALL cells immediately — they stay visible forever. Each cell claims a
    // distinct image from the deck; only those 30 bitmaps are decoded up front.
    deviceManager.initAll();
    activeSlots = getSortedSlots();
    _cellsTotal = Object.keys(renderer.cellStates).length;
    updateLoadCount();

    return Promise.all(Object.values(renderer.cellStates).map(s => s._readyPromise));
  }).then(() => {
    document.getElementById('loading').style.display = 'none';
    connectWebSocket();
    setInterval(() => { try { redraw(); } catch (e) {} }, 33);
  }).catch(err => {
    document.querySelector('#loading p').textContent = 'Error: ' + err.message;
  });
}

function createRenderer() {
  const state = { cellStates: {} };
  const applyImage = createImageApplier({
    state,
    imageLoader,
    adaptCellToImage,
    sendImageUpdate,
  }).apply;
  const handleAction = createCellActionHandler({
    state,
    deck: imageDeck,
    applyImage,
    getCells: () => collageLayout.cells,
    config: CONFIG,
    sendImageUpdate,
    adaptCellToImage,
    getSortedSlots,
    getRendererCellStates: () => deviceManager ? deviceManager.renderer.cellStates : {},
    onZOrderChanged: () => { activeSlots = getSortedSlots(); },
  });

  return {
    cellStates: state.cellStates,
    initCell(slot, cell) {
      const file = imageDeck.claim(slot, cell);

      const cellState = {
        cell,
        pos: { x: cell.x, y: cell.y, w: cell.w, h: cell.h, zIndex: slot, rotation: 0 },
        img: file ? imageLoader.get(file) : null,
        opacity: 1.0,
        flipH: false, flipV: false,
        locked: false,
        filterType: 'none',
        phoneConnected: false,
        // Store the original layout dimensions as the bounding budget for adaptation
        _layoutX: cell.x,
        _layoutY: cell.y,
        _layoutW: cell.w,
        _layoutH: cell.h,
        transition: new TransitionRenderer({ transitionDuration: CONFIG.transitionDuration }),
        currentImageFile: file,
      };

      state.cellStates[slot] = cellState;

      // Adapt cell size to the initial image's aspect ratio
      if (typeof adaptCellToImage === 'function') {
        adaptCellToImage(cellState);
      }

      if (!file) {
        cellState._readyPromise = Promise.resolve(null);
        return;
      }
      imageLoader.pin(file);
      cellState._readyPromise = applyImage(slot, file).then(() => {
        _cellsReady++;
        updateLoadCount();
        return null;
      });
    },
    updateCellPosition(slot, pos) {
      const s = state.cellStates[slot];
      if (!s) return;
      // Update the layout budget to the new layout's position/size
      s._layoutX = pos.x;
      s._layoutY = pos.y;
      s._layoutW = pos.w;
      s._layoutH = pos.h;
      // Set position anchor to the new layout, then adapt within that budget
      if (typeof adaptCellToImage === 'function') {
        s.pos.x = pos.x;
        s.pos.y = pos.y;
        adaptCellToImage(s, 'layout');
      } else {
        s.pos = pos;
      }
    },
    removeCell(slot) {
      // In the new model, cells are never removed — they stay visible
      // but lose phone connection effects
      const s = state.cellStates[slot];
      if (s) s.phoneConnected = false;
    },
    updateFromSensor(slot, sensorData) {
      const s = state.cellStates[slot];
      if (!s || s.locked) return;
      s.sensor = sensorData;
    },
    handleAction,
  };
}

/**
 * All cells sorted by zIndex — used for draw order.
 */
function getSortedSlots() {
  if (!collageLayout) return [];
  return [...collageLayout.cells]
    .map(c => {
      const s = deviceManager?.renderer.cellStates[c.slot];
      return { slot: c.slot, zIndex: s?.pos?.zIndex ?? c.slot };
    })
    .sort((a, b) => a.zIndex - b.zIndex);
}

function connectWebSocket() {
  const isSecure = location.protocol === 'https:';
  const wsProto = isSecure ? 'wss:' : 'ws:';
  const host = isSecure ? location.host : `${location.hostname}:${CONFIG.bridgePort}`;
  const wsUrl = `${wsProto}//${host}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'register', role: 'player' }));
    // Publish the initial deal so the bridge — and any phone that connects
    // later — knows which image each cell is actually showing.
    const states = deviceManager ? deviceManager.renderer.cellStates : {};
    Object.keys(states).forEach(key => {
      const s = states[key];
      if (s && s.currentImageFile) sendImageUpdate(Number(key), s.currentImageFile);
    });
  };

  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'device') {
        deviceManager.updateSensor(msg.slot, msg.accel, msg.gyro, msg.orientation);
      } else if (msg.type === 'action') {
        deviceManager.handleAction(msg.slot, msg.action, msg);
      } else if (msg.type === 'gesture-event') {
        if (msg.event === 'matched' && msg.action) {
          deviceManager.handleAction(msg.slot, msg.action);
        }
      } else if (msg.type === 'system') {
        if (msg.event === 'assign') {
          deviceManager.assign(msg.slot);
          activeSlots = getSortedSlots();
          // The bridge caches what each slot shows so it can answer a phone that
          // registers or is reassigned. Publish the cell's real image: the deck
          // is the authority, and the layout's imageFile is geometry-era noise.
          const assigned = deviceManager.renderer.cellStates[msg.slot];
          if (assigned && assigned.currentImageFile) {
            sendImageUpdate(msg.slot, assigned.currentImageFile);
          }
        } else if (msg.event === 'disconnect') {
          deviceManager.disconnect(msg.slot);
          activeSlots = getSortedSlots();
        }
      }
    } catch {}
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 2000);
  };
}

/**
 * Handle a click/touch point on the canvas:
 *  - If it hits a cell: bring to front, select it
 *  - If it misses all cells: deselect
 */
function handleCanvasClick(px, py) {
  if (!deviceManager || !collageLayout) return;

  const sorted = getSortedSlots().reverse();
  let hit = false;
  for (const { slot } of sorted) {
    const s = deviceManager.renderer.cellStates[slot];
    if (!s || !s.img) continue;
    const pos = s.pos;
    if (px >= pos.x && px <= pos.x + pos.w && py >= pos.y && py <= pos.y + pos.h) {
      // Bring to front
      let maxZIndex = 0;
      for (const { slot: s2 } of getSortedSlots()) {
        const other = deviceManager.renderer.cellStates[s2];
        if (other && other.pos.zIndex > maxZIndex) {
          maxZIndex = other.pos.zIndex;
        }
      }
      s.pos.zIndex = maxZIndex + 1;
      activeSlots = getSortedSlots();
      // Select this cell
      selectedSlot = slot;
      hit = true;
      break;
    }
  }

  if (!hit) {
    selectedSlot = null;
  }

  selectCell(selectedSlot);
}

function selectCell(slot) {
  selectedSlot = slot;
  if (typeof redraw === 'function') redraw();
}

function isOverlayEvent() { return false; }

function mousePressed(event) {
  if (!deviceManager) return false;
  // IMPORTANT: return true so p5.js does NOT preventDefault() — p5.js fires
  // global mousedown for ALL page clicks, and preventing default would break
  // sliders, selects, and buttons inside overlays like the sidebar.
  if (isOverlayEvent(event)) return true;
  var slot = hitTest(mouseX, mouseY);
  if (slot >= 0) {
    startDrag(slot, mouseX, mouseY);
  } else {
    // Click on empty canvas — deselect
    if (typeof selectCell === 'function') selectCell(null);
  }
  return false;
}

function mouseDragged(event) {
  if (!deviceManager) return false;
  if (isOverlayEvent(event)) return true;
  updateDrag(mouseX, mouseY);
  if (typeof redraw === 'function') redraw();
  return false;
}

function mouseReleased(event) {
  if (!deviceManager) return false;
  if (isOverlayEvent(event)) return true;
  var result = endDrag();
  if (result.slot >= 0) {
    if (!result.wasDrag) {
      // Click (below threshold) — select and bring to front
      handleCanvasClick(mouseX, mouseY);
    } else {
      // Was a drag.
      selectedSlot = result.slot;
      if (typeof redraw === 'function') redraw();
    }
  }
  return false;
}

function touchStarted(event) {
  if (!deviceManager || touches.length === 0) return false;
  if (isOverlayEvent(event)) return true;
  var tx = touches[0].x;
  var ty = touches[0].y;
  var slot = hitTest(tx, ty);
  if (slot >= 0) {
    startDrag(slot, tx, ty);
  } else {
    if (typeof selectCell === 'function') selectCell(null);
  }
  return false;
}

function touchMoved(event) {
  if (!deviceManager || touches.length === 0) return false;
  if (isOverlayEvent(event)) return true;
  updateDrag(touches[0].x, touches[0].y);
  if (typeof redraw === 'function') redraw();
  return false;
}

function touchEnded(event) {
  if (!deviceManager) return false;
  if (isOverlayEvent(event)) return true;
  var result = endDrag();
  if (result.slot >= 0) {
    if (!result.wasDrag) {
      handleCanvasClick(mouseX, mouseY);
    } else {
      selectedSlot = result.slot;
      if (typeof redraw === 'function') redraw();
    }
  }
  return false;
}

let _markColor = null;

/**
 * The collage mark is painted on the canvas, so it cannot rely on CSS. It reads
 * the one token that deliberately never follows the light theme.
 */
function brandMarkColor() {
  if (_markColor) return _markColor;
  // Fallback is the ink tone, not white: the canvas is the paper tone, so a
  // white mark would be invisible if the token cannot be read.
  let color = '#111111';
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--mark-on-canvas').trim();
    if (value) color = value;
  } catch (e) { /* headless or detached document */ }
  _markColor = color;
  return color;
}

let _bgTexture = null;
let _bgSeed = Math.floor(Math.random() * 100000);

// Canvas background color — the artwork surface, not UI chrome. 'solid' is the
// identity paper tone; 'shader-paper' keeps the texture available.
const CANVAS_BG_COLORS = {
  'shader-paper': [235, 217, 179],  // warm yellow-beige (shader-generated)
  'solid': [244, 244, 244],         // identity paper tone, same as the phone client
};

function draw() {
  const now = millis();
  const dt = lastFrameTime === 0 ? 16 : now - lastFrameTime;
  lastFrameTime = now;

  try {
    // Canvas background color — fall back to warm beige for unknown styles
    const bgColor = CANVAS_BG_COLORS[CONFIG.canvasBgStyle] || [235, 217, 179];
    background(bgColor[0], bgColor[1], bgColor[2]);

    // Draw background texture behind all cells (lazy-init on first frame).
    // Only the shader-paper style has a texture: the helper falls back to a
    // solid black fill for any other style, so raising the noise slider on a
    // flat canvas would paint the whole canvas black.
    if (CONFIG.noiseIntensity > 0 && CONFIG.canvasBgStyle === 'shader-paper') {
      if (!_bgTexture) {
        _bgTexture = drawBackgroundTexture(window, 1920, 1080, CONFIG.noiseIntensity, _bgSeed, CONFIG.canvasBgStyle);
      }
      image(_bgTexture, 0, 0);
    }

    // Brand mark: on the paper, underneath every fragment. Painting it after
    // drawGrid would put it on top of the artwork instead of behind it.
    drawBrandMark(drawingContext, {
      width: 1920,
      height: 1080,
      opacity: 0.35,
      color: brandMarkColor(),
    });

    if (!deviceManager || !collageLayout) return;
    drawGrid(dt);

  } catch (e) {
    console.error('[draw]', e);
  }
}

function drawGrid(dt) {
  const slots = activeSlots;
  for (const { slot } of slots) {
    const s = deviceManager.renderer.cellStates[slot];
    if (!s) continue;
    drawCell(s, dt);
  }
}

function drawCell(s, dt) {
  const pos = s.pos;
  const cx = pos.x + pos.w / 2;
  const cy = pos.y + pos.h / 2;
  const w = pos.w;
  const h = pos.h;

  push();

  // Apply blend mode if set
  if (s.blendMode && s.blendMode !== 'normal') {
    drawingContext.globalCompositeOperation = s.blendMode;
  }

  translate(cx, cy);
  if (pos.rotation) rotate(radians(pos.rotation));

  // Apply per-cell editor scale (set via control panel per-cell editor)
  const editorScale = s._editorScale || 1.0;
  if (editorScale !== 1.0) scale(editorScale);

  const tState = s.transition.update(dt);
  if (tState.state === 'fading' && s._oldImg) {
    drawImg(s._oldImg, s.flipH, s.flipV, -w / 2, -h / 2, w, h, s.opacity * tState.oldAlpha, s.filterType, s._oldImg.inkRatio, s._authoredSize);
    drawImg(s.img, s.flipH, s.flipV, -w / 2, -h / 2, w, h, s.opacity * tState.newAlpha, s.filterType, s.img.inkRatio, s._authoredSize);
  } else {
    drawImg(s.img, s.flipH, s.flipV, -w / 2, -h / 2, w, h, s.opacity, s.filterType, s.img && s.img.inkRatio, s._authoredSize);
  }

  // Selection highlight — dashed golden border when cell is selected
  if (selectedSlot !== null && s.cell && s.cell.slot === selectedSlot) {
    push();
    noFill();
    stroke('#a67c52');
    strokeWeight(3);
    drawingContext.setLineDash([8, 4]);
    const pad = 6;
    rectMode(CENTER);
    rect(0, 0, w + pad * 2, h + pad * 2);
    drawingContext.setLineDash([]);
    pop();
  }

  pop();

  // Reset composite operation
  if (s.blendMode && s.blendMode !== 'normal') {
    drawingContext.globalCompositeOperation = 'source-over';
  }
}

function drawImageWithTransform(s, x, y, w, h, opacity) {
  if (!s.img) return;
  drawImg(s.img, s.flipH, s.flipV, x, y, w, h, opacity, s.filterType, s.img.inkRatio);
}
