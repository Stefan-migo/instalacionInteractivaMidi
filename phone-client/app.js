(function () {
  var params = new URLSearchParams(location.search);
  var isSecure = location.protocol === 'https:';
  var wsProto = isSecure ? 'wss:' : 'ws:';
  var wsUrl;
  if (params.get('bridge')) {
    var b = params.get('bridge').replace(/^ws?s?:\/\//, '').replace(/\/+$/, '');
    wsUrl = wsProto + '//' + b;
  } else if (isSecure) {
    wsUrl = wsProto + '//' + location.host;
  } else {
    var port = params.get('port') || '8080';
    wsUrl = 'ws://' + location.hostname + ':' + port;
  }

  var ws = null;
  var slot = -1;
  var recording = false;
  var sendInterval = null;
  var lastSensor = {
    accel: { x: 0, y: 0, z: 0 },
    gyro: { a: 0, b: 0, g: 0 },
    orientation: { a: 0, b: 0, g: 0 },
  };
  var paperTextureRendered = false;
  // Stable seed for deterministic decoration (paper texture + torn edges).
  var DECOR_SEED = 1337;
  var galleryState = null;
  var gestureDetectors = null;
  var lastFiredGesture = null;
  var lastFireTime = 0;
  var lastJerkTime = 0; // tracks recent jerk for cross-talk suppression
  var activePracticeGesture = null;

  var $ = function (id) { return document.getElementById(id); };
  var slotBadge = $('slot-badge');
  var statusDot = $('status-dot');
  var statusText = $('status-text');
  var splashScreen = $('splash-screen');
  var permScreen = $('permission-screen');
  var dashboard = $('dashboard');
  var permBtn = $('permission-btn');
  var recIndicator = $('rec-indicator');
  var cellImage = $('cell-image');
  var cellPlaceholder = $('thumbnail-placeholder');
  var gestureStatus = $('gesture-status');
  var fabBtn = $('fab-btn');
  var toolsPanel = $('tools-panel');

  // --- 3-Screen Flow Controller ---
  var currentScreen = 'splash';

  function goToScreen(name) {
    splashScreen.classList.add('hidden');
    permScreen.classList.add('hidden');
    dashboard.classList.add('hidden');
    currentScreen = name;
    if (name === 'splash') {
      splashScreen.classList.remove('hidden');
    } else if (name === 'permission') {
      permScreen.classList.remove('hidden');
    } else if (name === 'dashboard') {
      dashboard.classList.remove('hidden');
      if (!paperTextureRendered) {
        renderDashboardPaperTexture();
        paperTextureRendered = true;
      }
      // Auto-open help overlay on first dashboard entry
      openHelp();
    }
  }

  function renderDashboardPaperTexture() {
    var canvas = $('paper-canvas');
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var ok = renderPaperTexture(canvas, canvas.width, canvas.height, 0.8, DECOR_SEED);
    if (ok) {
      try {
        var dataUrl = canvas.toDataURL('image/png');
        document.body.style.setProperty('--user-bg', 'url(' + dataUrl + ')');
      } catch (e) { /* best-effort */ }
    }
    // If WebGL failed, paper-texture.js already filled the offscreen canvas
    // with the warm fallback color, but body::after already defaults to #ebd9b3,
    // so the background renders correctly either way.
  }

  // Start on splash
  goToScreen('splash');
  // Render paper texture immediately so all screens have the shader background
  renderDashboardPaperTexture();

  // --- Splash [Participar] button ---
  $('splash-participar-btn').addEventListener('click', function () {
    goToScreen('permission');
    connect();
  });

  // --- Image error handling ---
  if (cellImage) {
    cellImage.onerror = function () {
      this.style.display = 'none';
      if (cellPlaceholder) cellPlaceholder.style.display = 'block';
    };
    cellImage.onload = function () {
      this.style.display = 'block';
      if (cellPlaceholder) cellPlaceholder.style.display = 'none';
    };
  }

  // --- Torn edge effect ---
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.torn-container').forEach(function (el, i) {
      el.style.clipPath = tornClipPath(6, 3, DECOR_SEED + i);
    });
  });

  // --- Bottom Sheet toggle ---
  var toolsOpen = false;

  function toggleTools() {
    toolsOpen = !toolsOpen;
    toolsPanel.classList.toggle('hidden', !toolsOpen);
    fabBtn.textContent = toolsOpen ? '−' : '+';
    if (toolsOpen) {
      document.querySelectorAll('#tools-panel .torn-container').forEach(function (el, i) {
        if (!el.style.clipPath) {
          el.style.clipPath = tornClipPath(6, 3, 2000 + i);
        }
      });
    }
  }

  if (fabBtn) {
    fabBtn.addEventListener('click', toggleTools);
  }

  // Tap outside the tools panel to close it
  document.addEventListener('click', function (e) {
    if (!toolsOpen) return;
    if (toolsPanel.contains(e.target)) return;
    if (fabBtn && fabBtn.contains(e.target)) return;
    toggleTools();
  });

  function showGestureStatus(text, type) {
    gestureStatus.textContent = text;
    gestureStatus.className = 'gesture-status ' + type;
    gestureStatus.classList.remove('hidden');
  }

  function hideGestureStatus() {
    gestureStatus.className = 'gesture-status hidden';
  }

  function setStatus(connected) {
    statusDot.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
    statusText.textContent = connected ? 'Conectado' : 'Desconectado';
    if (dashboard) dashboard.classList.toggle('disconnected', !connected);
  }

  function connect() {
    try { ws = new WebSocket(wsUrl); } catch (e) { setTimeout(connect, 2000); return; }

    ws.onopen = function () {
      setStatus(true);
      ws.send(JSON.stringify({ type: 'register', role: 'phone' }));
    };

    ws.onmessage = function (e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'assigned') {
          slot = msg.slot;
          slotBadge.textContent = slot;
        }
        if (msg.type === 'cell-image') {
          if (cellImage) {
            cellImage.src = msg.imageUrl;
            if (cellPlaceholder) cellPlaceholder.style.display = 'none';
          }
        }
        if (msg.type === 'gesture-status') {
          if (msg.recording) {
            recording = true;
            recIndicator.classList.remove('hidden');
            if (wiz.step === 'recording') {
              // Wizard already showing recording step — keep it
            } else {
              $('wizard-trigger')?.classList.add('recording');
              showGestureStatus('Grabando — mové el teléfono', 'recording');
            }
          } else {
            recording = false;
            recIndicator.classList.add('hidden');
            $('wizard-trigger')?.classList.remove('recording');
            if (msg.gestureId) {
              if (wiz.step === 'recording') {
                wizClearTimers();
                wizGoTo('confirmed');
                wiz.autoReturnTimer = setTimeout(wizClose, 4000);
              } else {
                showGestureStatus('Gesto grabado. Repetilo para activarlo', 'recorded');
              }
            } else {
              hideGestureStatus();
            }
          }
        }
      } catch (err) { /* ignore parse errors */ }
    };

    ws.onclose = function () {
      setStatus(false);
      slot = -1;
      slotBadge.textContent = '—';
      if (sendInterval) clearInterval(sendInterval);
      sendInterval = null;
      setTimeout(connect, 2000);
    };
  }

  function sendSensor() {
    if (ws && ws.readyState === WebSocket.OPEN && slot >= 0) {
      ws.send(JSON.stringify({ type: 'sensor', ...lastSensor }));
    }
  }

  function sendGesture(gesture) {
    if (ws && ws.readyState === WebSocket.OPEN && slot >= 0) {
      ws.send(JSON.stringify({ type: 'gesture', gesture }));
    }
  }

  function sendAction(action) {
    if (ws && ws.readyState === WebSocket.OPEN && slot >= 0) {
      ws.send(JSON.stringify({ type: 'action', action }));
    }
  }

  function sendActionWithPayload(action, payload) {
    if (ws && ws.readyState === WebSocket.OPEN && slot >= 0) {
      ws.send(JSON.stringify({ type: 'action', action, ...payload }));
    }
  }

  // --- Gesture Gallery State Machine ---
  var gestureActionMap = {
    inclinar: 'border-next',
    latigo: 'shuffle',
    twist: 'filter-next'
  };

  var gestureInstructions = {
    inclinar: 'Incliná el teléfono hacia adelante → cambia borde',
    latigo: 'Sacudí el teléfono → cambia foto',
    twist: 'Girá el teléfono como una perilla → cambia filtro'
  };

  function openGallery() {
    if (galleryState !== null) closeGallery();
    galleryState = 'gallery';
    var el = $('gesture-gallery');
    if (el) el.classList.remove('hidden');
  }

  function closeGallery() {
    if (galleryState === 'practice' || galleryState === 'practice-done') {
      endPractice();
    }
    galleryState = null;
    var el = $('gesture-gallery');
    if (el) el.classList.add('hidden');
  }

  function startPractice(gesture) {
    // 'latigo' has no detector — it uses the existing flick detection
    if (gesture !== 'latigo' && (!gestureDetectors || !gestureDetectors[gesture])) return;
    galleryState = 'practice';
    $('practice-overlay').classList.remove('hidden');
    $('practice-instruction').textContent = gestureInstructions[gesture] || '';
    $('practice-feedback').classList.add('hidden');
    activePracticeGesture = gesture;
  }

  function endPractice() {
    activePracticeGesture = null;
    galleryState = 'gallery';
    $('practice-overlay').classList.add('hidden');
    $('practice-feedback').classList.add('hidden');
  }

  function onGestureDetected(gesture) {
    // Always fire the action (gestures work as defaults)
    var action = gestureActionMap[gesture];
    if (action) sendAction(action);

    // Update lockout to prevent cross-talk between gesture sensors
    lastFiredGesture = gesture;
    lastFireTime = Date.now();

    // Only show practice UI if user is in the gesture gallery
    if (galleryState === 'practice') {
      galleryState = 'practice-done';
      try { navigator.vibrate(200); } catch (e) { /* best-effort */ }
      $('practice-feedback').classList.remove('hidden');
      setTimeout(function () {
        $('practice-feedback').classList.add('hidden');
        galleryState = 'practice';
      }, 2000);
    }
  }

  // --- Gesture Wizard State Machine ---
  var wiz = {
    step: null,
    chosenDuration: 3000,
    practiceStartTs: 0,
    practiceSamples: 0,
    practiceTimer: null,
    countdownTimer: null,
    countdownValue: 3,
    autoReturnTimer: null,
  };

  function wizOpen() {
    wizClose();
    wiz.step = 'practice';
    wiz.chosenDuration = 3000;
    $('wizard-overlay').classList.remove('hidden');
    document.querySelectorAll('.wizard-step').forEach(function (el) { el.classList.add('hidden'); });
    $('wizard-step-practice').classList.remove('hidden');
  }

  function wizClose() {
    if (wiz.step === 'recording' && recording) {
      sendAction('record-stop');
    }
    wizClearTimers();
    wiz.step = null;
    wiz.practiceSamples = 0;
    $('wizard-overlay').classList.add('hidden');
  }

  function wizClearTimers() {
    if (wiz.practiceTimer) { clearTimeout(wiz.practiceTimer); wiz.practiceTimer = null; }
    if (wiz.countdownTimer) { clearInterval(wiz.countdownTimer); wiz.countdownTimer = null; }
    if (wiz.autoReturnTimer) { clearTimeout(wiz.autoReturnTimer); wiz.autoReturnTimer = null; }
  }

  function wizGoTo(step) {
    wiz.step = step;
    document.querySelectorAll('.wizard-step').forEach(function (el) { el.classList.add('hidden'); });
    var el = $('wizard-step-' + step);
    if (el) el.classList.remove('hidden');
  }

  $('wizard-cancel').addEventListener('click', wizClose);

  $('wizard-practice-btn').addEventListener('click', function () {
    if (wiz.step !== 'practice') return;
    wiz.practiceStartTs = Date.now();
    wiz.practiceSamples = 0;
    this.textContent = 'Grabando práctica…';

    var collector = setInterval(function () {
      wiz.practiceSamples++;
    }, 33);

    wiz.practiceTimer = setTimeout(function () {
      clearInterval(collector);
      var elapsed = Date.now() - wiz.practiceStartTs;
      var rounded = Math.min(Math.round(elapsed / 1000), 5);
      $('wizard-practice-duration').textContent = rounded;
      wizGoTo('duration');
    }, 3000);
  });

  document.querySelectorAll('.duration-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (wiz.step !== 'duration') return;
      wiz.chosenDuration = parseInt(this.dataset.duration, 10);
      wiz.countdownValue = 3;
      $('wizard-countdown-number').textContent = '3';
      wizGoTo('countdown');

      wiz.countdownTimer = setInterval(function () {
        wiz.countdownValue--;
        if (wiz.countdownValue > 0) {
          $('wizard-countdown-number').textContent = wiz.countdownValue;
        } else {
          clearInterval(wiz.countdownTimer);
          wiz.countdownTimer = null;
          wizGoTo('recording');
          recording = true;
          recIndicator.classList.remove('hidden');
          sendActionWithPayload('record-start', { duration: wiz.chosenDuration });
        }
      }, 1000);
    });
  });

  // --- Permission flow ---
  permBtn.addEventListener('click', async function () {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      try {
        var r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') {
          showPermissionDenial();
          return;
        }
      } catch (e) {
        showPermissionDenial();
        return;
      }
    }
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
      try {
        var r = await DeviceMotionEvent.requestPermission();
        if (r !== 'granted') {
          showPermissionDenial();
          return;
        }
      } catch (e) {
        showPermissionDenial();
        return;
      }
    }

    // Permission granted — proceed to dashboard
    goToScreen('dashboard');
    permBtn.textContent = 'Sensores activados';
    permBtn.style.borderColor = '#2d6a4f';

    window.addEventListener('devicemotion', function (e) {
      var a = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
      var r = e.rotationRate || { alpha: 0, beta: 0, gamma: 0 };
      lastSensor.accel = { x: a.x || 0, y: a.y || 0, z: a.z || 0 };
      lastSensor.gyro = { a: r.alpha || 0, b: r.beta || 0, g: r.gamma || 0 };
      gestureDetector.processMotion({ x: a.x || 0, y: a.y || 0, z: a.z || 0 });
    });

    window.addEventListener('deviceorientation', function (e) {
      lastSensor.orientation = { a: e.alpha || 0, b: e.beta || 0, g: e.gamma || 0 };
      gestureDetector.processOrientation(e.beta || 0, e.gamma || 0, e.alpha || 0);
    });

    sendInterval = setInterval(sendSensor, 33);

    // Gesture detection: flick only
    var gestureDetector = {
      prevAccel: null,
      flickStartTs: 0,
      flickTriggered: false,
      lastFlickTs: 0,

      processMotion: function (accel) {
        var ax = accel.x || 0;
        var ay = accel.y || 0;
        var az = accel.z || 0;

        if (this.prevAccel) {
          var jerkX = ax - this.prevAccel.x;
          var jerkY = ay - this.prevAccel.y;
          var jerkZ = az - this.prevAccel.z;
          var jerkMag = Math.sqrt(jerkX * jerkX + jerkY * jerkY + jerkZ * jerkZ);

          if (jerkMag > 15 && !this.flickTriggered) {
            this.flickTriggered = true;
            this.flickStartTs = Date.now();
            lastJerkTime = Date.now();
            // Cancel any pending inclinar — it was a flick, not a tilt
            if (gestureDetectors && gestureDetectors.inclinar) {
              gestureDetectors.inclinar.pendingSince = 0;
            }
          }

          if (this.flickTriggered) {
            var elapsed = Date.now() - this.flickStartTs;
              if (jerkMag < 10) {
              var now = Date.now();
              if (now - this.lastFlickTs > 750) {
                if (activePracticeGesture === 'latigo') {
                  onGestureDetected('latigo');
                } else {
                  sendGesture('flick');
                  lastFiredGesture = 'latigo';
                  lastFireTime = Date.now();
                }
                this.lastFlickTs = now;
              }
              this.flickTriggered = false;
            } else if (elapsed > 200) {
              this.flickTriggered = false;
            }
          }
        }
        this.prevAccel = { x: ax, y: ay, z: az };

          // girar-muneca NOT checked here — rotationRate.beta is angular velocity,
          // not the absolute tilt angle. Only check in processOrientation below.
      },

      processOrientation: function (beta, gamma, alpha) {
        if (!gestureDetectors) return;
        var now = Date.now();
        // Track alpha frame-to-frame — if alpha is actively changing, user is twisting
        var alphaMoving = false;
        if (this._lastAlpha !== undefined) {
          var aRaw = alpha - this._lastAlpha;
          if (Math.abs(aRaw) > 5) alphaMoving = true;
        }
        this._lastAlpha = alpha;

        // Check inclinar (beta) — only if alpha isn't actively changing
        if (gestureDetectors.inclinar && !alphaMoving
            && (!lastFiredGesture || lastFiredGesture !== 'twist' || now - lastFireTime > 800)) {
          if (gestureDetectors.inclinar.check({ b: beta })) {
            lastFiredGesture = 'inclinar';
            lastFireTime = now;
            onGestureDetected('inclinar');
            return;
          }
        }
        // Pre-init refAlpha so first twist isn't wasted on setup
        if (gestureDetectors.twist && gestureDetectors.twist.refAlpha === null) {
          gestureDetectors.twist.refAlpha = alpha;
        }
        // Check twist (alpha)
        if (gestureDetectors.twist && (!lastFiredGesture || lastFiredGesture !== 'inclinar' || now - lastFireTime > 800)) {
          if (gestureDetectors.twist.check(alpha)) {
            lastFiredGesture = 'twist';
            lastFireTime = now;
            onGestureDetected('twist');
          }
        }
      },
    };

    // Practice gesture detectors with per-gesture activation + 1s cooldown
    gestureDetectors = {
      inclinar: {
        lastTrigger: 0,
        cooldown: 1200,
        canFire: true,
        pendingSince: 0,
        check: function (orientation) {
          var now = Date.now();
          // Beta near zero (< 10°) resets canFire (phone returned to level)
          if (Math.abs(orientation.b) < 10) this.canFire = true;
          if (!this.canFire) {
            this.pendingSince = 0;
            return false;
          }
          if (now - this.lastTrigger < this.cooldown) return false;

          var absB = Math.abs(orientation.b);
          if (absB > 30) {
            if (this.pendingSince === 0) {
              this.pendingSince = now;
              return false;
            }
            if (now - this.pendingSince > 400 && now - lastJerkTime > 800) {
              this.pendingSince = 0;
              this.lastTrigger = now;
              this.canFire = false;
              return true;
            }
            return false;
          }
          this.pendingSince = 0;
          return false;
        }
      },
      twist: {
        lastTrigger: 0,
        cooldown: 1200,
        canFire: true,
        refAlpha: null,
        check: function (alpha) {
          var now = Date.now();
          if (this.refAlpha === null) {
            this.refAlpha = alpha;
            return false;
          }
          // Reset refAlpha if idle > 5s (prevents drift from slow head turns)
          if (this.lastTrigger > 0 && now - this.lastTrigger > 5000) {
            this.refAlpha = alpha;
            this.canFire = true;
            return false;
          }
          // Compute angle delta with wrap-around (0-360)
          var raw = alpha - this.refAlpha;
          var delta = Math.abs(raw) > 180 ? 360 - Math.abs(raw) : Math.abs(raw);
          // Reset canFire when back near ref (no time req — cooldown prevents double fire)
          if (delta <= 5) this.canFire = true;
          if (delta > 20 && this.canFire && now - this.lastTrigger >= this.cooldown) {
            this.lastTrigger = now;
            this.canFire = false;
            this.refAlpha = alpha;
            return true;
          }
          return false;
        }
      }
    };
  });

  function showPermissionDenial() {
    var err = $('permission-error');
    if (err) err.classList.remove('hidden');
  }

  // Reload button inside permission denial
  $('reload-btn').addEventListener('click', function () {
    location.reload();
  });

  // --- Controls ---

  // Filter button
  (function initFilterBtn() {
    var btn = $('filter-btn');
    if (!btn) return;
    var FILTERS = ['sepia', 'grayscale', 'cyanotype', 'polaroid', 'vintage', 'none'];
    var idx = FILTERS.length - 1;

    btn.addEventListener('click', function () {
      idx = (idx + 1) % FILTERS.length;
      var name = FILTERS[idx];
      sendActionWithPayload('filter', { value: name });
    });
  })();

  // Border button
  (function initBorderBtn() {
    var btn = $('border-btn');
    if (!btn) return;
    var BORDERS = ['torn', 'polaroid', 'stamp', 'gold', 'minimal'];
    var idx = 0;

    btn.addEventListener('click', function () {
      idx = (idx + 1) % BORDERS.length;
      sendActionWithPayload('border-next', {});
    });
  })();

  // Opacity slider
  (function initOpacitySlider() {
    var slider = $('opacity-slider');
    var display = $('opacity-value');
    if (!slider) return;

    slider.addEventListener('input', function () {
      var val = parseInt(this.value, 10);
      if (display) display.textContent = val + '%';
      sendActionWithPayload('opacity', { value: val });
    });
  })();

  // Rotation slider
  (function initRotationSlider() {
    var slider = $('rotation-slider');
    var display = $('rotation-value');
    if (!slider) return;

    slider.addEventListener('input', function () {
      var val = parseInt(this.value, 10);
      var label = val > 0 ? '+' + val : '' + val;
      if (display) display.textContent = label + '°';
      sendActionWithPayload('rotation', { value: val });
    });
  })();

  // Scale slider
  (function initScaleSlider() {
    var slider = $('scale-slider');
    var display = $('scale-value');
    if (!slider) return;

    slider.addEventListener('input', function () {
      var val = parseInt(this.value, 10);
      if (display) display.textContent = val + '%';
      sendActionWithPayload('scale', { value: val });
    });
  })();

  // --- Touch Overlay + Pinch-to-Zoom ---
  (function initTouchOverlay() {
    var overlay = $('touch-overlay');
    if (!overlay) return;

    var active = false;
    var lastX = 0;
    var lastY = 0;
    var startX = 0;
    var startY = 0;
    var moved = false;
    var lastTapTime = 0;
    var dragEndFired = false;
    var TAP_TIMEOUT = 300;
    var CANVAS_W = 1920;
    var CANVAS_H = 1080;
    var DEAD_ZONE = 3;
    var SENSITIVITY = 3;
    var dragHintFired = false;

    // Pinch-to-zoom state
    var isPinching = false;
    var zoomScale = 1;
    var initialPinchDist = 0;
    var cellImg = $('cell-image');

    function getPinchDist(e) {
      if (e.touches.length < 2) return 0;
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function applyZoom(scale) {
      zoomScale = Math.max(1, Math.min(scale, 3));
      if (cellImg) cellImg.style.transform = 'scale(' + zoomScale + ')';
    }

    function resetZoom() {
      zoomScale = 1;
      isPinching = false;
      if (cellImg) cellImg.style.transform = '';
    }

    function getScale() {
      return {
        sx: CANVAS_W / overlay.offsetWidth / SENSITIVITY,
        sy: CANVAS_H / overlay.offsetHeight / SENSITIVITY
      };
    }

    function handleStart(cx, cy) {
      active = true;
      lastX = cx;
      lastY = cy;
      startX = cx;
      startY = cy;
      moved = false;
    }

    function handleMove(cx, cy) {
      if (!active) return;
      var rawDx = cx - lastX;
      var rawDy = cy - lastY;
      lastX = cx;
      lastY = cy;

      if (Math.abs(rawDx) < DEAD_ZONE && Math.abs(rawDy) < DEAD_ZONE) return;

      moved = true;

      var s = getScale();
      var dx = rawDx * s.sx;
      var dy = rawDy * s.sy;

      sendActionWithPayload('move', { dx: dx, dy: dy });
    }

    function handleEnd() {
      if (active && !moved && !isPinching) {
        var now = Date.now();
        if (now - lastTapTime < TAP_TIMEOUT) {
          sendAction('bring-front');
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
      }
      if (active && moved && !dragEndFired && !isPinching) {
        dragEndFired = true;
        markAction('dragged');
      }
      active = false;
    }

    overlay.addEventListener('touchstart', function (e) {
      if (e.touches.length >= 2) {
        isPinching = true;
        initialPinchDist = getPinchDist(e);
        return;
      }
      if (!isPinching) {
        var t = e.touches[0];
        handleStart(t.clientX, t.clientY);
      }
    }, { passive: true });

    overlay.addEventListener('touchmove', function (e) {
      if (isPinching && e.touches.length >= 2) {
        var dist = getPinchDist(e);
        if (initialPinchDist > 0) {
          applyZoom(zoomScale * (dist / initialPinchDist));
        }
        initialPinchDist = dist;
        return;
      }
      if (!isPinching) {
        var t = e.touches[0];
        handleMove(t.clientX, t.clientY);
      }
    }, { passive: true });

    overlay.addEventListener('touchend', function (e) {
      if (isPinching && e.touches.length < 2) {
        resetZoom();
        return;
      }
      if (!isPinching) handleEnd();
    }, { passive: true });

    overlay.addEventListener('touchcancel', function () {
      handleEnd();
    }, { passive: true });

    overlay.addEventListener('mousedown', function (e) {
      handleStart(e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', function (e) {
      handleMove(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', function () {
      handleEnd();
    });
  })();

  // --- Hint Engine (2 hints: idle-triggered + first-drag-end) ---
  var hintFlags = {
    connected: false,
    dragged: false
  };
  var hintSequence = ['connected', 'dragged'];
  var hintIndex = 0;
  var hintDismissTimer = null;
  var firstHintTimer = null;
  var hintsEnabled = false;

  var hintTexts = {
    connected: 'arrastrá sobre la imagen para mover tu fragmento en el collage',
    dragged: 'tocá + para ajustar opacidad, rotación y escala'
  };

  function markAction(flag) {
    if (hintIndex >= hintSequence.length) return;
    if (flag !== hintSequence[hintIndex]) return;

    hintFlags[flag] = true;
    hintIndex++;
    cancelFirstHintTimer();

    var engine = $('hint-engine');
    var textEl = $('hint-text');
    if (engine && textEl) {
      textEl.textContent = hintTexts[flag] || '';
      engine.classList.remove('hidden');
      // Force reflow then add visible class for CSS transition
      engine.offsetHeight;
      engine.classList.add('visible');

      if (hintDismissTimer) clearTimeout(hintDismissTimer);
      hintDismissTimer = setTimeout(function () {
        engine.classList.remove('visible');
        setTimeout(function () {
          if (!engine.classList.contains('visible')) {
            engine.classList.add('hidden');
          }
        }, 600);
      }, 4000);
    }
  }

  // Hints only start after user dismisses the auto-open help overlay
  function startHintIdleTimer() {
    hintsEnabled = true;
    if (hintIndex > 0) return;
    cancelFirstHintTimer();
    firstHintTimer = setTimeout(function () {
      markAction('connected');
    }, 1000);
  }

  function cancelFirstHintTimer() {
    if (firstHintTimer) {
      clearTimeout(firstHintTimer);
      firstHintTimer = null;
    }
  }

  function skipFirstHint() {
    if (!hintsEnabled) return;
    cancelFirstHintTimer();
    if (hintIndex === 0 && !hintFlags.connected) {
      hintIndex = 1;
    }
  }

  // If user interacts before hint 1 fires, skip it
  document.addEventListener('touchstart', skipFirstHint, { passive: true });
  document.addEventListener('mousedown', skipFirstHint, { passive: true });

  // Wire hint engine into existing interactions
  // connected: idle timer after help dismissed
  // dragged: triggered when first drag ends (touchend after movement)

  // --- Help Overlay ---
  var helpOverlay = $('help-overlay');
  var helpBtn = $('help-btn');
  var helpEntendiBtn = $('help-entendi-btn');
  var helpCard = $('help-card');

  function openHelp() {
    if (helpOverlay) helpOverlay.classList.remove('hidden');
  }

  function closeHelp() {
    if (helpOverlay) helpOverlay.classList.add('hidden');
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', openHelp);
  }

  if (helpEntendiBtn) {
    helpEntendiBtn.addEventListener('click', function () {
      closeHelp();
      startHintIdleTimer();
    });
  }

  // Close help overlay on tap outside the card
  if (helpOverlay) {
    helpOverlay.addEventListener('click', function (e) {
      if (helpCard && !helpCard.contains(e.target)) {
        closeHelp();
      }
    });
  }

  // --- Wizard trigger button → Gallery ---
  $('wizard-trigger')?.addEventListener('click', function () {
    if (recording) {
      sendAction('record-stop');
    } else {
      openGallery();
    }
  });

  // --- Gallery control wiring ---
  (function initGallery() {
    var gallery = $('gesture-gallery');
    var closeBtn = $('gallery-close-btn');
    var galleryCard = document.querySelector('.gallery-card');
    var createBtn = $('create-gesture-btn');
    var practiceBackBtn = $('practice-back-btn');

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', closeGallery);
    }

    // Tap outside card
    if (gallery) {
      gallery.addEventListener('click', function (e) {
        if (galleryCard && !galleryCard.contains(e.target)) {
          closeGallery();
        }
      });
    }

    // [Practicar] buttons
    document.querySelectorAll('.practice-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var gesture = this.getAttribute('data-gesture');
        if (gesture) startPractice(gesture);
      });
    });

    // [Volver] from practice
    if (practiceBackBtn) {
      practiceBackBtn.addEventListener('click', endPractice);
    }

    // [+ Crear mi gesto] → wizard overlays on top of gallery
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        wizOpen();
      });
    }
  })();

  // Shuffle button
  document.querySelector('[data-action="shuffle"]')?.addEventListener('click', function () {
    sendAction('shuffle');
    this.style.background = 'rgba(139, 44, 36, 0.1)';
    setTimeout(function (btn) {
      btn.style.background = '';
    }, 150, this);
  });

  // Tránsito
  document.getElementById('cell-prev-btn')?.addEventListener('click', function () {
    sendAction('cell-prev');
    this.style.background = 'rgba(139, 44, 36, 0.1)';
    setTimeout(function (btn) { btn.style.background = ''; }, 150, this);
  });

  document.getElementById('cell-next-btn')?.addEventListener('click', function () {
    sendAction('cell-next');
    this.style.background = 'rgba(139, 44, 36, 0.1)';
    setTimeout(function (btn) { btn.style.background = ''; }, 150, this);
  });

  // Ascender
  document.getElementById('bring-front-btn')?.addEventListener('click', function () {
    sendAction('bring-front');
    this.style.background = 'rgba(139, 44, 36, 0.1)';
    setTimeout(function (btn) { btn.style.background = ''; }, 150, this);
  });

  // NOTE: connect() is NO LONGER called on page load.
  // It is called when user taps [Participar] on the splash screen.
})();
