/**
 * control-panel.js — Projector operator sidebar.
 *
 * Builds and manages the fixed right-side control panel:
 *  - Panel toggle show/hide
 *  - Layout preset buttons (6) with active state
 *  - Scatter scale slider
 *  - Canvas background selector (aged-paper / canvas / wood / dark-wool)
 *  - Noise intensity slider
 *  - Cell catalog with thumbnails + eye-toggle visibility
 *  - Per-cell editor for selected slot (filter, border, rotation, scale, opacity)
 *  - Esparcir Todo button (re-randomize all positions)
 *
 * All changes are written directly to CONFIG / cellStates / deviceManager
 * and trigger redraw().
 *
 * Dependencies (globals): CONFIG, deviceManager, collageLayout, imageLoader,
 * selectedSlot, redraw, getSortedSlots, activeSlots, _bgTexture
 */
(function () {
  'use strict';

  var panelBuilt = false;
  var controlPanel = null;

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Build the control panel DOM and append to body.
   * Call once after deviceManager is initialized and images are loaded.
   */
  function buildControlPanel() {
    if (panelBuilt) return;
    panelBuilt = true;

    console.log('[panel] buildControlPanel — creating panel DOM');
    controlPanel = document.createElement('aside');
    controlPanel.id = 'control-panel';
    controlPanel.className = 'collapsed';
    controlPanel.innerHTML = panelHTML();
    document.body.appendChild(controlPanel);

    // Create a separate fixed toggle button outside the panel
    // so it's always visible even when the panel is collapsed
    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'panel-toggle';
    toggleBtn.title = 'Toggle panel';
    toggleBtn.textContent = '\u2630';
    toggleBtn.addEventListener('click', togglePanel);
    document.body.appendChild(toggleBtn);

    bindPanelEvents();

    // ── Document-level canary: log any mousedown in capture phase ──
    // If events on the panel DON'T fire at all, this will show if the
    // event even reaches the document level, and whether the target
    // is inside or outside the panel.
    document.addEventListener('mousedown', function (e) {
      var inPanel = e.target.closest && e.target.closest('#control-panel');
      if (inPanel) {
        console.log('[panel] DOC-CAPTURE mousedown INSIDE panel:', e.target.id || e.target.tagName);
      }
    }, true);
  }

  /**
   * (Re)build the catalog list from collageLayout cells.
   * Call any time catalog needs refreshing (e.g. after image load).
   */
  function populateCatalog() {
    var list = document.getElementById('catalog-list');
    if (!list || typeof collageLayout === 'undefined' || !collageLayout) return;
    list.innerHTML = '';

    var cells = collageLayout.cells;
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var slot = cell.slot;
      var state = getCellState(slot);
      var imgFile = cell.imageFile;
      var img = (typeof imageLoader !== 'undefined' && imageLoader)
        ? imageLoader.get(imgFile) : null;
      var visible = state ? state.opacity > 0 : true;

      var entry = document.createElement('div');
      entry.className = 'catalog-entry';
      if (typeof selectedSlot !== 'undefined' && selectedSlot === slot) {
        entry.className += ' selected';
      }
      entry.dataset.slot = slot;

      // Thumbnail
      var thumb = document.createElement('img');
      thumb.className = 'catalog-thumb';
      thumb.src = img ? img.src : '';
      thumb.alt = imgFile || '';
      entry.appendChild(thumb);

      // Title (filename without extension)
      var title = document.createElement('span');
      title.className = 'catalog-title';
      title.textContent = (imgFile || '').replace(/\.[^.]+$/, '');
      entry.appendChild(title);

      // Slot number
      var slotSpan = document.createElement('span');
      slotSpan.className = 'catalog-slot';
      slotSpan.textContent = '#' + slot;
      entry.appendChild(slotSpan);

      // Eye toggle button
      var eyeBtn = document.createElement('button');
      eyeBtn.className = 'catalog-eye';
      eyeBtn.textContent = visible ? '\u25C9' : '\u25CB';
      eyeBtn.dataset.slot = slot;
      eyeBtn.addEventListener('click', handleEyeToggle);
      entry.appendChild(eyeBtn);

      // Click to select
      entry.addEventListener('click', function (slotId) {
        return function () { selectCell(slotId); };
      }(slot));

      list.appendChild(entry);
    }
  }

  /**
   * Refresh catalog — rebuild from scratch.
   */
  function refreshCatalog() {
    populateCatalog();
  }

  /**
   * Select a cell by slot (or null to deselect).
   * Updates global selectedSlot, catalog highlighting, and per-cell editor.
   */
  function selectCell(slot) {
    if (typeof selectedSlot !== 'undefined') {
      selectedSlot = slot;
    }

    // Update catalog highlighting
    var entries = document.querySelectorAll('.catalog-entry');
    for (var i = 0; i < entries.length; i++) {
      var el = entries[i];
      var entrySlot = parseInt(el.dataset.slot, 10);
      if (entrySlot === slot) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    }

    // Show/hide per-cell editor
    var editor = document.getElementById('per-cell-editor');
    if (editor) {
      if (slot !== null) {
        showPerCellEditor(slot);
      } else {
        editor.classList.remove('visible');
      }
    }

    if (typeof redraw === 'function') redraw();
  }

  // ── Toggle ───────────────────────────────────────────────────────────

  function togglePanel() {
    if (!controlPanel) return;
    controlPanel.classList.toggle('collapsed');
    if (typeof redraw === 'function') redraw();
  }

  // ── HTML template ────────────────────────────────────────────────────

  function panelHTML() {
    var scatterVal = Math.round((typeof CONFIG !== 'undefined' ? (CONFIG.scatterScale || 1.0) : 1.0) * 100);
    var noiseVal = Math.round((typeof CONFIG !== 'undefined' ? (CONFIG.noiseIntensity || 0.3) : 0.3) * 100);
    var currentBg = (typeof CONFIG !== 'undefined' ? (CONFIG.canvasBgStyle || 'aged-paper') : 'aged-paper');

    return ''
      + '<div id="panel-header"><h2>Projector Controls</h2></div>'
      + '<div id="panel-body">'

      // ── Presets ──
      + '<div class="panel-section">'
      + '<div class="panel-section-title">Layout Presets</div>'
      + '<div class="preset-grid" id="preset-grid">'
      + presetBtn('scatter', 'Scatter')
      + presetBtn('spiral', 'Spiral')
      + presetBtn('polaroid-stack', 'Polaroid')
      + presetBtn('neat-grid', 'Grid')
      + presetBtn('vignette', 'Vignette')
      + presetBtn('random', 'Random')
      + '</div></div>'

      // ── Scatter Scale ──
      + '<div class="panel-section">'
      + '<div class="panel-section-title">Scatter Scale</div>'
      + '<div class="slider-row">'
      + '<label>Scale</label>'
      + '<input type="range" id="scatter-scale" min="0.4" max="1.6" step="0.05" value="' + scatterVal / 100 + '">'
      + '<span class="slider-value" id="scatter-scale-val">' + scatterVal + '%</span>'
      + '</div></div>'

      // ── Canvas Background ──
      + '<div class="panel-section">'
      + '<div class="panel-section-title">Canvas Background</div>'
      + '<div class="bg-selector" id="bg-selector">'
      + bgBtn('shader-paper', 'Shader Paper', currentBg === 'shader-paper')
      + '</div></div>'

      // ── Noise Intensity ──
      + '<div class="panel-section">'
      + '<div class="panel-section-title">Noise Texture</div>'
      + '<div class="slider-row">'
      + '<label>Intensity</label>'
      + '<input type="range" id="noise-intensity" min="0" max="100" step="5" value="' + noiseVal + '">'
      + '<span class="slider-value" id="noise-intensity-val">' + noiseVal + '%</span>'
      + '</div></div>'

      // ── Cell Catalog ──
      + '<div class="panel-section">'
      + '<div class="panel-section-title">Cell Catalog</div>'
      + '<div id="catalog-list"></div>'
      + '</div>'

      // ── Per-cell editor ──
      + '<div id="per-cell-editor">'
      + '<div class="panel-section-title">Cell Editor &mdash; Slot <span id="editor-slot-label">&mdash;</span></div>'
      + '<div class="editor-row">'
      + '<label>Filter</label>'
      + '<select id="editor-filter">'
      + '<option value="none">None</option>'
      + '<option value="sepia">Sepia</option>'
      + '<option value="grayscale">Grayscale</option>'
      + '<option value="cyanotype">Cyanotype</option>'
      + '<option value="polaroid">Polaroid</option>'
      + '<option value="vintage">Vintage</option>'
      + '</select></div>'
      + '<div class="editor-row">'
      + '<label>Border</label>'
      + '<select id="editor-border">'
      + '<option value="torn">Torn</option>'
      + '<option value="polaroid">Polaroid</option>'
      + '<option value="stamp">Stamp</option>'
      + '<option value="gold">Gold</option>'
      + '<option value="minimal">Minimal</option>'
      + '<option value="deckled-edge">Deckled Edge</option>'
      + '<option value="double-line">Double Line</option>'
      + '<option value="shadow-box">Shadow Box</option>'
      + '</select></div>'
      + '<div class="editor-row">'
      + '<label>Rotation</label>'
      + '<input type="range" id="editor-rotation" min="-180" max="180" step="1" value="0">'
      + '<span class="editor-value" id="editor-rotation-val">0\u00B0</span>'
      + '</div>'
      + '<div class="editor-row">'
      + '<label>Scale</label>'
      + '<input type="range" id="editor-scale" min="0.4" max="1.8" step="0.05" value="1.0">'
      + '<span class="editor-value" id="editor-scale-val">100%</span>'
      + '</div>'
      + '<div class="editor-row">'
      + '<label>Opacity</label>'
      + '<input type="range" id="editor-opacity" min="0.30" max="1.0" step="0.05" value="1.0">'
      + '<span class="editor-value" id="editor-opacity-val">100%</span>'
      + '</div>'
      + '</div>'

      // ── Esparcir Todo ──
      + '<div class="panel-section">'
      + '<button id="esparcir-todo">Esparcir Todo</button>'
      + '</div>'

      + '</div>';
  }

  function presetBtn(preset, label) {
    var currentPreset = (typeof deviceManager !== 'undefined' && deviceManager && deviceManager.layoutEngine)
      ? deviceManager.layoutEngine.getCurrentPreset() : 'scatter';
    var active = preset === currentPreset ? ' active' : '';
    return '<button class="preset-btn' + active + '" data-preset="' + preset + '">' + label + '</button>';
  }

  function bgBtn(style, label, isActive) {
    return '<button class="bg-btn' + (isActive ? ' active' : '') + '" data-bg="' + style + '">' + label + '</button>';
  }

  // ── Event delegation (single listener for all panel events) ──

  function bindPanelEvents() {
    if (!controlPanel) return;

    console.log('[panel] bindPanelEvents — attaching input/change/click on #control-panel');
    controlPanel.addEventListener('input', handlePanelInput);
    controlPanel.addEventListener('change', handlePanelChange);
    controlPanel.addEventListener('click', handlePanelClick);

    // ── Canary: logs ANY click/mousedown that reaches the panel ──
    // If this fires but handlePanelClick doesn't work, the issue is in the handler.
    // If this DOESN'T fire, events aren't reaching the panel at all.
    controlPanel.addEventListener('click', function (e) {
      console.log('[panel] CANARY click:', e.target.id || e.target.tagName, '| cls:', (e.target.className || '').slice(0, 40));
    });
    controlPanel.addEventListener('mousedown', function (e) {
      console.log('[panel] CANARY mousedown:', e.target.id || e.target.tagName);
    });
  }

  function handlePanelInput(e) {
    var el = e.target;
    console.log('[panel] input event — target:', el.id || el.tagName, 'value:', el.value);
    if (el.id === 'scatter-scale') {
      var v = parseFloat(el.value);
      if (isNaN(v)) return;
      var valEl = document.getElementById('scatter-scale-val');
      if (typeof CONFIG !== 'undefined') CONFIG.scatterScale = v;
      if (valEl) valEl.textContent = Math.round(v * 100) + '%';
      if (typeof deviceManager !== 'undefined' && deviceManager && deviceManager.layoutEngine) {
        deviceManager.layoutEngine.scatterScale = v;
        deviceManager._recalculateLayout();
      }
      if (typeof redraw === 'function') redraw();
    } else if (el.id === 'noise-intensity') {
      var v2 = parseInt(el.value, 10);
      if (isNaN(v2)) return;
      var valEl2 = document.getElementById('noise-intensity-val');
      if (typeof CONFIG !== 'undefined') CONFIG.noiseIntensity = v2 / 100;
      if (valEl2) valEl2.textContent = v2 + '%';
      if (typeof _bgTexture !== 'undefined') _bgTexture = null;
      // Debounce redraw: cancel previous timer, schedule new one 80ms after last change
      if (typeof _bgRebuildTimer !== 'undefined' && _bgRebuildTimer) {
        clearTimeout(_bgRebuildTimer);
      }
      _bgRebuildTimer = setTimeout(function () {
        if (typeof redraw === 'function') redraw();
      }, 80);
    } else if (el.id === 'editor-rotation') {
      var v3 = parseFloat(el.value);
      var valEl3 = document.getElementById('editor-rotation-val');
      if (selectedSlot !== null && deviceManager) {
        var s = deviceManager.renderer.cellStates[selectedSlot];
        if (s && s.pos) s.pos.rotation = v3;
      }
      if (valEl3) valEl3.textContent = Math.round(v3) + '\u00B0';
      if (typeof redraw === 'function') redraw();
    } else if (el.id === 'editor-scale') {
      var v4 = parseFloat(el.value);
      var valEl4 = document.getElementById('editor-scale-val');
      if (selectedSlot !== null && deviceManager) {
        var s2 = deviceManager.renderer.cellStates[selectedSlot];
        if (s2) s2._editorScale = v4;
      }
      if (valEl4) valEl4.textContent = Math.round(v4 * 100) + '%';
      if (typeof redraw === 'function') redraw();
    } else if (el.id === 'editor-opacity') {
      var v5 = parseFloat(el.value);
      var valEl5 = document.getElementById('editor-opacity-val');
      if (selectedSlot !== null && deviceManager) {
        var s3 = deviceManager.renderer.cellStates[selectedSlot];
        if (s3) s3.opacity = v5;
      }
      if (valEl5) valEl5.textContent = Math.round(v5 * 100) + '%';
      if (typeof redraw === 'function') redraw();
    }
  }

  function handlePanelChange(e) {
    // change events fire on <select> elements AND on range inputs when released.
    // Handle selects directly (their IDs aren't in handlePanelInput),
    // then fall through to handlePanelInput for range inputs.

    var el = e.target;
    console.log('[panel] change event — target:', el.id || el.tagName, 'value:', el.value);
    if (el.id === 'editor-filter') {
      if (selectedSlot !== null && deviceManager) {
        var s = deviceManager.renderer.cellStates[selectedSlot];
        if (s) s.filterType = el.value;
        if (typeof redraw === 'function') redraw();
      }
      return;
    }
    if (el.id === 'editor-border') {
      if (selectedSlot !== null && deviceManager) {
        var s = deviceManager.renderer.cellStates[selectedSlot];
        if (s) s.borderStyle = el.value;
        if (typeof redraw === 'function') redraw();
      }
      return;
    }

    // Fall through: handle range input change events (on release)
    handlePanelInput(e);
  }

  function handlePanelClick(e) {
    console.log('[panel] click event — target:', e.target.id || e.target.tagName, 'class:', e.target.className);
    // Preset buttons
    var presetBtn = e.target.closest('.preset-btn');
    if (presetBtn) {
      var grid = document.getElementById('preset-grid');
      var preset = presetBtn.dataset.preset;
      if (!preset) return;
      var btns = grid.querySelectorAll('.preset-btn');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
      presetBtn.classList.add('active');
      if (typeof deviceManager !== 'undefined' && deviceManager && deviceManager.layoutEngine) {
        deviceManager.layoutEngine.setPreset(preset);
        deviceManager._recalculateLayout();
        if (typeof getSortedSlots === 'function') activeSlots = getSortedSlots();
        if (typeof redraw === 'function') redraw();
      }
      return;
    }

    // Background selector buttons
    var bgBtn = e.target.closest('.bg-btn');
    if (bgBtn) {
      var selector = document.getElementById('bg-selector');
      var bg = bgBtn.dataset.bg;
      if (!bg) return;
      var btns = selector.querySelectorAll('.bg-btn');
      for (var i2 = 0; i2 < btns.length; i2++) btns[i2].classList.remove('active');
      bgBtn.classList.add('active');
      if (typeof CONFIG !== 'undefined') CONFIG.canvasBgStyle = bg;
      document.body.className = 'canvas-' + bg;
      if (typeof _bgTexture !== 'undefined') _bgTexture = null;
      if (typeof redraw === 'function') redraw();
      return;
    }

    // Esparcir Todo
    if (e.target.id === 'esparcir-todo') {
      if (typeof deviceManager !== 'undefined' && deviceManager && deviceManager.layoutEngine) {
        deviceManager._recalculateLayout();
        if (typeof getSortedSlots === 'function') activeSlots = getSortedSlots();
        if (typeof redraw === 'function') redraw();
      }
      return;
    }

    // Filter select (change event doesn't bubble reliably for selects,
    // so catch click as well for the <select> element)
    var filterSel = e.target.closest('#editor-filter');
    if (filterSel && filterSel.tagName === 'SELECT') {
      if (selectedSlot !== null && deviceManager) {
        var s = deviceManager.renderer.cellStates[selectedSlot];
        if (s) s.filterType = filterSel.value;
        if (typeof redraw === 'function') redraw();
      }
      return;
    }

    // Border select
    var borderSel = e.target.closest('#editor-border');
    if (borderSel && borderSel.tagName === 'SELECT') {
      if (selectedSlot !== null && deviceManager) {
        var s2 = deviceManager.renderer.cellStates[selectedSlot];
        if (s2) s2.borderStyle = borderSel.value;
        if (typeof redraw === 'function') redraw();
      }
      return;
    }
  }

  // ── Eye toggle handler ───────────────────────────────────────────────

  function handleEyeToggle(ev) {
    ev.stopPropagation();
    var btn = ev.currentTarget;
    var slot = parseInt(btn.dataset.slot, 10);
    var state = getCellState(slot);
    if (!state) return;
    if (state.opacity > 0) {
      state.opacity = 0;
      btn.textContent = '\u25CB';
    } else {
      state.opacity = 1.0;
      btn.textContent = '\u25C9';
    }
    if (typeof redraw === 'function') redraw();
  }

  // ── Per-cell editor ──────────────────────────────────────────────────

  function showPerCellEditor(slot) {
    var editor = document.getElementById('per-cell-editor');
    if (!editor) return;

    var slotLabel = document.getElementById('editor-slot-label');
    if (slotLabel) slotLabel.textContent = '#' + slot;

    var state = getCellState(slot);
    if (!state) {
      editor.classList.remove('visible');
      return;
    }

    editor.classList.add('visible');

    // Set current values on controls (events handled by delegation)
    var filterEl = document.getElementById('editor-filter');
    if (filterEl) filterEl.value = state.filterType || 'none';

    var borderEl = document.getElementById('editor-border');
    if (borderEl) borderEl.value = state.borderStyle || 'torn';

    var rotEl = document.getElementById('editor-rotation');
    var rotVal = document.getElementById('editor-rotation-val');
    var currentRot = state.pos ? (state.pos.rotation || 0) : 0;
    // Normalize legacy 0-360 stored values to -180..+180
    if (currentRot > 180) currentRot -= 360;
    if (rotEl) { rotEl.value = currentRot; }
    if (rotVal) { rotVal.textContent = Math.round(currentRot) + '\u00B0'; }

    var scaleEl = document.getElementById('editor-scale');
    var scaleVal = document.getElementById('editor-scale-val');
    var currentScale = state._editorScale || 1.0;
    if (scaleEl) { scaleEl.value = currentScale; }
    if (scaleVal) { scaleVal.textContent = Math.round(currentScale * 100) + '%'; }

    var opEl = document.getElementById('editor-opacity');
    var opVal = document.getElementById('editor-opacity-val');
    if (opEl) { opEl.value = state.opacity; }
    if (opVal) { opVal.textContent = Math.round(state.opacity * 100) + '%'; }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  function getCellState(slot) {
    if (typeof deviceManager !== 'undefined' && deviceManager && deviceManager.renderer) {
      return deviceManager.renderer.cellStates[slot];
    }
    return null;
  }

  // ── Export public API ────────────────────────────────────────────────

  window.buildControlPanel = buildControlPanel;
  window.populateCatalog = populateCatalog;
  window.refreshCatalog = refreshCatalog;
  window.selectCell = selectCell;
})();
