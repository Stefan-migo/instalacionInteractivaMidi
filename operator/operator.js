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
  var ROUTING_VOICES = [{ gesture: 'tilt', label: 'Inclinar', note: 36 }, { gesture: 'flick', label: 'Látigo', note: 37 }, { gesture: 'rotation', label: 'Girar', note: 38 }];
  // The bridge reports a code; the panel owes the operator the sentence that names the cause.
  var ROUTING_SYMPTOMS = {
    'sin-mapeo': 'El agente todavía no mandó la partitura: sin mapeo no hay notas ni faders.',
    'sin-agente': 'El agente no está corriendo: no hay notas y los faders no se mueven.',
    'sin-puerto': 'El puerto Collage-MIDI no está abierto: las notas no llegan a Ableton.',
    'sin-actividad': 'Todo conectado, pero sin actividad: nadie movió el teléfono en los últimos segundos.',
  };
  var ROUTING_PORTS = { open: 'abierto', closed: 'cerrado', absent: 'ausente' };
  function initRouting(doc) {
    var section = doc.getElementById('routing');
    if (!section) return null;
    var matrix = doc.getElementById('routing-matrix');
    var faders = doc.getElementById('routing-faders');
    var diagnosis = doc.getElementById('routing-diagnosis');
    var cells = Array.prototype.slice.call(matrix.querySelectorAll('.routing-cell'));
    var groups = [1, 2, 3].map(function (group) { return { group: group, channel: group, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } }; });
    var data = null;
    var timer = null;
    var visible = false;
    if (new URLSearchParams(root.location && root.location.search || '').get('section') === 'routing') {
      doc.body.classList.add('routing-window');
      doc.title = '07 · Ruteo MIDI — MIDI · Operador';
    }
    function voiceActivity(group, gesture, now) {
      var liveGroup = data && data.groups && data.groups.find(function (item) { return item.group === group; });
      var last = liveGroup && liveGroup.lastNote;
      return !!(last && last.gesture === gesture && now - Date.parse(last.at) <= 1200 && now >= Date.parse(last.at));
    }
    function render() {
      var scoreGroups = data && data.score && data.score.groups;
      var sourceGroups = scoreGroups && scoreGroups.length ? scoreGroups : groups;
      var now = Date.now();
      cells.forEach(function (cell) {
        var groupId = Number(cell.dataset.group);
        var gesture = cell.dataset.gesture;
        var group = sourceGroups.find(function (item) { return item.group === groupId; }) || groups[groupId - 1];
        var channel = group.channel || groupId;
        var note = group.notes && group.notes[gesture] || groups[groupId - 1].notes[gesture];
        var active = voiceActivity(groupId, gesture, now);
        var label = ROUTING_VOICES.find(function (voice) { return voice.gesture === gesture; }).label;
        var live = data && data.groups && data.groups.find(function (item) { return item.group === groupId; });
        var velocity = live && live.lastNote && Number.isFinite(live.lastNote.velocity) ? live.lastNote.velocity : 64;
        cell.dataset.channel = channel; cell.dataset.note = note;
        cell.innerHTML = '<h3>Grupo ' + groupId + ' · ' + label + '</h3><p><span class="routing-dot' + (active ? ' is-on' : '') + '" aria-label="' + (active ? 'Recién disparó' : 'En espera') + '"></span>' + (active ? 'Recién disparó' : 'En espera') + '</p><p>Recibe ' + label + '</p><p>Envía Canal ' + channel + ' · NOTA ' + note + ' · fuerza ' + velocity + '</p><p>Mapear Nota ' + note + ' en canal ' + channel + ' → la voz del grupo ' + groupId + '</p>';
      });
      faders.innerHTML = [1, 2, 3].map(function (id) {
        var spec = sourceGroups.find(function (item) { return item.group === id; }) || groups[id - 1];
        var live = data && data.groups && data.groups.find(function (item) { return item.group === id; });
        var value = live && Number.isFinite(live.value) ? Math.max(0, Math.min(100, live.value)) : 0;
        return '<div class="routing-fader"><strong>Grupo ' + id + ' · CC ' + (spec.ccController || 21) + ' · canal ' + (spec.channel || id) + '</strong><p>Agregación: promedio · ' + Math.round(value) + '</p><div class="routing-rail"><div class="routing-fill" style="width:' + value + '%"></div></div></div>';
      }).join('');
      if (!data) {
        diagnosis.innerHTML = '<p class="routing-quiet">Sin respuesta del puente: no se pudo consultar /api/music. La hoja de ruteo fija sigue visible.</p>';
      } else {
        var s = data.status || {};
        var port = ROUTING_PORTS[s.port] || ROUTING_PORTS.absent;
        var facts = [
          'Puerto MIDI ' + (s.port === 'open' ? '■ ' : '□ ') + port,
          'Agente ' + (s.agent ? '■ activo' : '□ inactivo'),
          'Teléfonos ' + (s.phones || 0),
          s.lastNoteAt ? 'Última nota ' + new Date(s.lastNoteAt).toLocaleTimeString() : 'Sin notas recientes',
        ];
        var symptom = ROUTING_SYMPTOMS[s.symptom] || 'Todo en orden: la última nota llegó a Ableton.';
        diagnosis.innerHTML = '<p>' + facts.join(' · ') + '</p><p class="routing-quiet">' + symptom + '</p>';
      }
    }
    function poll() {
      if (!visible) return;
      fetch('/api/music').then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }).then(function (result) { data = result; render(); }).catch(function () { data = null; render(); });
    }
    function setVisible(next) {
      visible = next;
      if (visible) { poll(); if (!timer) timer = setInterval(poll, 1000); }
      else if (timer) { clearInterval(timer); timer = null; }
    }
    if (typeof IntersectionObserver !== 'undefined') {
      var observer = new IntersectionObserver(function (entries) { setVisible(entries[0].isIntersecting); });
      observer.observe(section);
    } else setVisible(true);
    render();
    setInterval(function () { if (visible) render(); }, 250);
    doc.getElementById('routing-print').addEventListener('click', function () { root.print(); });
    doc.getElementById('routing-copy').addEventListener('click', function () {
      var text = cells.map(function (cell) { return 'Grupo ' + cell.dataset.group + ' · ' + cell.querySelector('h3').textContent.split('· ')[1] + ' · canal ' + cell.dataset.channel + ' · nota ' + cell.dataset.note + ' · la voz del grupo ' + cell.dataset.group; }).join('\n');
      var status = doc.getElementById('routing-copy-status');
      var fallback = doc.getElementById('routing-copy-text');
      fallback.value = text;
      if (root.navigator.clipboard && root.navigator.clipboard.writeText) root.navigator.clipboard.writeText(text).then(function () { status.textContent = 'Hoja copiada.'; }).catch(function () { fallback.classList.add('is-visible'); fallback.focus(); fallback.select(); status.textContent = 'No se pudo copiar; texto seleccionado para copiar manualmente.'; });
      else { fallback.classList.add('is-visible'); fallback.focus(); fallback.select(); status.textContent = 'Portapapeles no disponible; texto seleccionado para copiar manualmente.'; }
    });
    return { render: render, poll: poll };
  }
  var api = { init: init, initRouting: initRouting, renderModel: renderModel, formatCell: formatCell, visibilityCommand: visibilityCommand, isVisible: isVisible, bindThemeToggle: bindThemeToggle, COMMAND_TYPES: COMMAND_TYPES, PRESETS: PRESETS, FILTERS: FILTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OperatorPage = api;
  if (root.document) initRouting(root.document);
  if (root.document && typeof BroadcastChannel !== 'undefined') init(root.document, function (name) { return new BroadcastChannel(name); }, root.MidiTheme);
})(typeof window !== 'undefined' ? window : globalThis);
