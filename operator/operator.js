(function (root) {
  'use strict';
  var PRESETS = ['scatter', 'spiral', 'polaroid-stack', 'neat-grid', 'vignette', 'random'];
  // Source of truth: p5-collage/config.js. Classic scripts cannot import its CONFIG.
  var FILTERS = ['none', 'sepia', 'grayscale', 'cyanotype', 'polaroid', 'vintage'];
  var COMMAND_TYPES = ['setPreset', 'setScatterScale', 'setNoiseIntensity', 'selectCell', 'setFilter', 'setRotation', 'setScale', 'setOpacity', 'toggleVisibility', 'rotateSelected', 'bringToFront', 'hideCell', 'esparcirTodo', 'requestState'];

  function visibilityCommand(slot) { return { type: 'toggleVisibility', slot: slot }; }
  function isVisible(opacity) { return opacity > 0; }
  function bindThemeToggle(button, Theme) {
    function update(theme) {
      var light = theme === 'light';
      button.setAttribute('aria-pressed', String(light));
      button.textContent = light ? 'Tema oscuro' : 'Tema claro';
    }
    update(Theme.getTheme());
    button.addEventListener('click', function () { update(Theme.toggleTheme()); });
    Theme.onThemeChange(update);
  }

  function formatCell(cell) {
    return { slot: cell.slot, imageFile: cell.imageFile || null, filterType: cell.filterType || 'none', rotation: cell.rotation || 0, scale: cell.scale || 1, opacity: cell.opacity == null ? 1 : cell.opacity };
  }
  function renderModel(state) {
    return { preset: state.preset, scatterScale: state.scatterScale, noiseIntensity: state.noiseIntensity, selectedSlot: state.selectedSlot, connected: state.connected, total: state.total, cells: (state.cells || []).map(formatCell) };
  }
  function init(doc, channelFactory, themeApi) {
    if (!doc || !channelFactory) return null;
    var send = channelFactory('midi-operator-cmd');
    var receive = channelFactory('midi-operator-state');
    var latest = null;
    var gotState = false;
    function command(type, fields) { var message = fields || {}; message.type = type; send.postMessage(message); }
    function request() { command('requestState'); }
    function setOptions(el, values) { el.innerHTML = values.map(function (value) { return '<option value="' + value + '">' + value + '</option>'; }).join(''); }
    var presets = doc.getElementById('presets');
    presets.innerHTML = PRESETS.map(function (name) { return '<button type="button" data-preset="' + name + '" aria-pressed="false">' + name + '</button>'; }).join('');
    setOptions(doc.getElementById('filter'), FILTERS);
    function update() {
      if (!latest) return;
      var state = latest;
      doc.getElementById('connection').textContent = 'Conectados: ' + state.connected + ' / ' + state.total;
      doc.querySelectorAll('[data-preset]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.preset === state.preset)); });
      doc.getElementById('scatter').value = state.scatterScale;
      doc.getElementById('scatter-value').textContent = Math.round(state.scatterScale * 100) + '%';
      doc.getElementById('noise').value = state.noiseIntensity;
      doc.getElementById('noise-value').textContent = state.noiseIntensity + '%';
      var catalog = doc.getElementById('catalog');
      catalog.innerHTML = '';
      state.cells.forEach(function (cell) {
        var button = doc.createElement('button');
        button.type = 'button'; button.className = 'catalog-row'; button.dataset.slot = cell.slot; button.setAttribute('role', 'option');
        button.setAttribute('aria-current', String(cell.slot === state.selectedSlot));
        var image = doc.createElement('img'); image.alt = ''; if (cell.imageFile) image.src = '/images/content/' + encodeURIComponent(cell.imageFile);
        var title = doc.createElement('span'); title.textContent = cell.imageFile || 'Celda ' + cell.slot;
        var number = doc.createElement('span'); number.textContent = '#' + cell.slot;
        button.appendChild(image); button.appendChild(title); button.appendChild(number); catalog.appendChild(button);
      });
      var cell = state.cells.filter(function (item) { return item.slot === state.selectedSlot; })[0];
      var editor = doc.getElementById('editor');
      editor.classList.toggle('enabled', !!cell);
      doc.getElementById('selected-label').textContent = cell ? '#' + cell.slot : '—';
      var visibilityToggle = doc.getElementById('visibility-toggle');
      visibilityToggle.disabled = !cell;
      visibilityToggle.setAttribute('aria-pressed', String(cell && isVisible(cell.opacity)));
      visibilityToggle.textContent = cell && isVisible(cell.opacity) ? 'Celda visible' : 'Celda oculta';
      if (!cell) return;
      [['filter', cell.filterType], ['rotation', cell.rotation], ['scale', cell.scale], ['opacity', cell.opacity]].forEach(function (entry) { doc.getElementById(entry[0]).value = entry[1]; });
      doc.getElementById('rotation-value').textContent = Math.round(cell.rotation) + '°';
      doc.getElementById('scale-value').textContent = Math.round(cell.scale * 100) + '%';
      doc.getElementById('opacity-value').textContent = Math.round(cell.opacity * 100) + '%';
    }
    receive.addEventListener('message', function (event) { latest = event.data; gotState = true; update(); });
    if (themeApi) bindThemeToggle(doc.getElementById('theme-toggle'), themeApi);
    presets.addEventListener('click', function (event) { var preset = event.target.dataset.preset; if (preset) command('setPreset', { preset: preset }); });
    doc.getElementById('catalog').addEventListener('click', function (event) { var row = event.target.closest('[data-slot]'); if (row) command('selectCell', { slot: Number(row.dataset.slot) }); });
    doc.getElementById('scatter').addEventListener('input', function (event) { command('setScatterScale', { value: Number(event.target.value) }); });
    doc.getElementById('noise').addEventListener('input', function (event) { command('setNoiseIntensity', { value: Number(event.target.value) }); });
    ['filter', 'rotation', 'scale', 'opacity'].forEach(function (key) { doc.getElementById(key).addEventListener(key === 'filter' ? 'change' : 'input', function (event) { if (!latest || latest.selectedSlot == null) return; var type = { filter: 'setFilter', rotation: 'setRotation', scale: 'setScale', opacity: 'setOpacity' }[key]; command(type, { slot: latest.selectedSlot, value: key === 'filter' ? event.target.value : Number(event.target.value) }); }); });
    doc.getElementById('visibility-toggle').addEventListener('click', function () {
      if (latest && latest.selectedSlot != null) command(visibilityCommand(latest.selectedSlot).type, { slot: latest.selectedSlot });
    });
    doc.getElementById('scatter-all').addEventListener('click', function () { command('esparcirTodo'); });
    doc.querySelector('.actions').addEventListener('click', function (event) { var action = event.target.dataset.action; if (!action || !latest || latest.selectedSlot == null) return; if (action === 'left') command('rotateSelected', { delta: -15 }); else if (action === 'right') command('rotateSelected', { delta: 15 }); else if (action === 'front') command('bringToFront', { slot: latest.selectedSlot }); else command('hideCell', { slot: latest.selectedSlot }); });
    request();
    setTimeout(function () { if (!gotState) request(); }, 500);
    return { command: command, renderModel: renderModel, getState: function () { return latest; } };
  }
  var api = { init: init, renderModel: renderModel, formatCell: formatCell, visibilityCommand: visibilityCommand, isVisible: isVisible, bindThemeToggle: bindThemeToggle, COMMAND_TYPES: COMMAND_TYPES, PRESETS: PRESETS, FILTERS: FILTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OperatorPage = api;
  if (root.document && typeof BroadcastChannel !== 'undefined') init(root.document, function (name) { return new BroadcastChannel(name); }, root.MidiTheme);
})(typeof window !== 'undefined' ? window : globalThis);
