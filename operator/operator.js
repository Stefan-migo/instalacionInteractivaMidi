(function (root) {
  'use strict';
  var PRESETS = ['scatter', 'spiral', 'polaroid-stack', 'neat-grid', 'vignette', 'random'];
  // Source of truth: p5-collage/config.js. Classic scripts cannot import its CONFIG.
  var FILTERS = ['none', 'sepia', 'grayscale', 'cyanotype', 'polaroid', 'vintage'];
  var Curation = root.DeckCuration;
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
    presets.addEventListener('click', function (event) { var preset = event.target.dataset.preset; if (preset) { command('setPreset', { preset: preset }); showToast(doc, 'Distribución: ' + preset, 'preset'); } });
    doc.getElementById('catalog').addEventListener('click', function (event) { var row = event.target.closest('[data-slot]'); if (row) command('selectCell', { slot: Number(row.dataset.slot) }); });
    doc.getElementById('scatter').addEventListener('input', function (event) { command('setScatterScale', { value: Number(event.target.value) }); });
    doc.getElementById('scatter').addEventListener('change', function (event) { showToast(doc, 'Escala de dispersión: ' + Math.round(Number(event.target.value) * 100) + '%', 'scatter'); });
    doc.getElementById('noise').addEventListener('input', function (event) { command('setNoiseIntensity', { value: Number(event.target.value) }); });
    ['filter', 'rotation', 'scale', 'opacity'].forEach(function (key) { doc.getElementById(key).addEventListener(key === 'filter' ? 'change' : 'input', function (event) { if (!latest || latest.selectedSlot == null) return; var type = { filter: 'setFilter', rotation: 'setRotation', scale: 'setScale', opacity: 'setOpacity' }[key]; command(type, { slot: latest.selectedSlot, value: key === 'filter' ? event.target.value : Number(event.target.value) }); if (key === 'filter') showToast(doc, 'Filtro: ' + event.target.value, 'filter'); }); });
    doc.getElementById('visibility-toggle').addEventListener('click', function () {
      if (latest && latest.selectedSlot != null) { command(visibilityCommand(latest.selectedSlot).type, { slot: latest.selectedSlot }); showToast(doc, 'Visibilidad actualizada para la celda ' + latest.selectedSlot, 'visibility'); }
    });
    doc.getElementById('reset-transform').addEventListener('click', function () { if (!latest || latest.selectedSlot == null) return; command('setScale', { slot: latest.selectedSlot, value: 1 }); command('setRotation', { slot: latest.selectedSlot, value: 0 }); showToast(doc, 'Transformación restablecida para la celda ' + latest.selectedSlot, 'transform'); });
    doc.getElementById('design-mode-entry').addEventListener('click', function () { doc.getElementById('dimensions').scrollIntoView(); showToast(doc, 'Modo Dimensiones abierto', 'design-mode'); });
    doc.getElementById('scatter-all').addEventListener('click', function () { command('esparcirTodo'); showToast(doc, 'Todas las celdas dispersadas', 'scatter-all'); });
    doc.querySelector('.actions').addEventListener('click', function (event) { var action = event.target.dataset.action; if (!action || !latest || latest.selectedSlot == null) return; if (action === 'left') { command('rotateSelected', { delta: -15 }); showToast(doc, 'Rotación aplicada: −15°', 'rotation'); } else if (action === 'right') { command('rotateSelected', { delta: 15 }); showToast(doc, 'Rotación aplicada: +15°', 'rotation'); } else if (action === 'front') { command('bringToFront', { slot: latest.selectedSlot }); showToast(doc, 'Celda ' + latest.selectedSlot + ' al frente', 'front'); } else { command('hideCell', { slot: latest.selectedSlot }); showToast(doc, 'Celda ' + latest.selectedSlot + ' oculta', 'hide'); } });
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
    'topologia': 'La cantidad de grupos de la partitura no coincide con la que espera el puente.'
  };
  var ROUTING_PORTS = { open: 'abierto', closed: 'cerrado', absent: 'ausente' };
  var ROUTING_EMIT_ERRORS = {
    'sin-agente': 'No hay agente conectado: no hay nada que disparar. Levantá el agente en la máquina de Ableton.',
    'sin-puerto': 'El puerto Collage-MIDI no está abierto, así que la nota no llega a Ableton.',
    'invalido': 'El panel pidió una voz que el puerto no puede enviar.',
  };
  function initRouting(doc) {
    var section = doc.getElementById('routing');
    if (!section) return null;
    var matrix = doc.getElementById('routing-matrix');
    var faders = doc.getElementById('routing-faders');
    var diagnosis = doc.getElementById('routing-diagnosis');
    var cells = [];
    // The printed table, used when the bridge does not answer: ten groups of
    // three phones, one channel each, the same three gestures on every one.
    var groups = [
      { group: 1, channel: 1, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 2, channel: 2, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 3, channel: 3, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 4, channel: 4, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 5, channel: 5, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 6, channel: 6, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 7, channel: 7, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 8, channel: 8, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 9, channel: 9, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
      { group: 10, channel: 10, ccController: 21, aggregation: 'average', notes: { tilt: 36, flick: 37, rotation: 38 } },
    ];
    var stepIndex = 0;
    var emitting = false;
    var lastWalkHtml = '';
    var counter = doc.getElementById('routing-step-counter');
    var stepBox = doc.getElementById('routing-step');
    var emitBtn = doc.getElementById('routing-emit');
    var emitStatus = doc.getElementById('routing-emit-status');
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
    function currentSourceGroups() {
      var scoreGroups = data && data.score && data.score.groups;
      return scoreGroups && scoreGroups.length ? scoreGroups : groups;
    }
    function render() {
      var sourceGroups = currentSourceGroups();
      matrix.innerHTML = sourceGroups.flatMap(function (group) { return ROUTING_VOICES.map(function (voice) { return '<article class="routing-cell" data-group="' + group.group + '" data-gesture="' + voice.gesture + '"></article>'; }); }).join('');
      cells = Array.prototype.slice.call(matrix.querySelectorAll('.routing-cell'));
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
      faders.innerHTML = sourceGroups.map(function (group) { return group.group; }).map(function (id) {
        var spec = sourceGroups.find(function (item) { return item.group === id; }) || groups[id - 1];
        var live = data && data.groups && data.groups.find(function (item) { return item.group === id; });
        var controllers = spec.ccControllers || { position: spec.ccController || 21, scale: (spec.ccController || 21) + 1, rotation: (spec.ccController || 21) + 2 };
        var lanes = ['position', 'scale', 'rotation'].map(function (lane) {
          var value = live && live.lanes && Number.isFinite(live.lanes[lane]) ? Math.max(0, Math.min(127, live.lanes[lane])) : 0;
          var label = { position: 'Posición', scale: 'Escala', rotation: 'Rotación' }[lane];
          return '<div class="routing-lane"><span>' + label + ' · CC ' + controllers[lane] + '</span><div class="routing-rail"><div class="routing-fill" style="width:' + (value / 127 * 100) + '%"></div></div><span>' + value + '</span></div>';
        }).join('');
        return '<div class="routing-fader"><strong>Grupo ' + id + ' · canal ' + (spec.channel || id) + ' · CC ' + controllers.position + ' / ' + controllers.scale + ' / ' + controllers.rotation + '</strong>' + lanes + '</div>';
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
      renderWalk(sourceGroups);
    }

    // The mapping walk: thirty note voices, followed by three continuous lanes
    // per group in the same fixed group order.
    function walkFor(sourceGroups) {
      var notes = sourceGroups.flatMap(function (group) {
        return ROUTING_VOICES.map(function (voice) {
          return { output: 'note', group: group.group, channel: group.channel, note: group.notes ? group.notes[voice.gesture] : voice.note, label: voice.label };
        });
      });
      var lanes = sourceGroups.flatMap(function (group) {
        var controllers = group.ccControllers || { position: group.ccController || 21, scale: (group.ccController || 21) + 1, rotation: (group.ccController || 21) + 2 };
        return [
          { output: 'cc', group: group.group, channel: group.channel, controller: controllers.position, label: 'Posición' },
          { output: 'cc', group: group.group, channel: group.channel, controller: controllers.scale, label: 'Escala' },
          { output: 'cc', group: group.group, channel: group.channel, controller: controllers.rotation, label: 'Rotación' },
        ];
      });
      return notes.concat(lanes);
    }
    function renderWalk(sourceGroups) {
      if (!counter || !stepBox) return;
      var voices = walkFor(sourceGroups);
      if (stepIndex > voices.length - 1) stepIndex = voices.length - 1;
      if (stepIndex < 0) stepIndex = 0;
      var voice = voices[stepIndex];
      if (!voice) return;
      var target = voice.output === 'note'
        ? 'canal ' + voice.channel + ' · NOTA ' + voice.note
        : 'canal ' + voice.channel + ' · CC ' + voice.controller;
      var lane = voice.output === 'note' ? 'Gestos · ' + voice.label : voice.label;
      var html = '<p><strong>Grupo ' + voice.group + ' · ' + lane + '</strong></p>'
        + '<p>Envía: ' + target + '</p>'
        + '<ol><li>En Live: Ctrl + M.</li><li>Click en el parámetro a mapear.</li><li>Volvé acá y tocá Enviar.</li></ol>'
        + (voice.output === 'cc'
          ? '<p class="routing-quiet">El barrido mueve el fader de 0 a 127 para que Live aprenda el rango completo.</p>'
          : '');
      counter.textContent = 'Mapa paso ' + (stepIndex + 1) + ' de ' + voices.length;
      if (html !== lastWalkHtml) { stepBox.innerHTML = html; lastWalkHtml = html; }
    }
    function currentVoice() {
      return walkFor(currentSourceGroups())[stepIndex] || null;
    }
    function emitCurrent() {
      var voice = currentVoice();
      if (!voice || emitting) return;
      emitting = true;
      if (emitBtn) emitBtn.disabled = true;
      if (emitStatus) emitStatus.textContent = 'Enviando…';
      var body = voice.output === 'note'
        ? { output: 'note', channel: voice.channel, note: voice.note, velocity: 100 }
        : { output: 'cc', channel: voice.channel, controller: voice.controller };
      fetch('/api/music/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (response) {
          return response.json().then(function (payload) { return { ok: response.ok, payload: payload }; });
        })
        .then(function (result) {
          if (!emitStatus) return;
          if (result.ok) {
            emitStatus.textContent = voice.output === 'note'
              ? 'Nota enviada: Live ya la puede aprender.'
              : 'Barrido enviado: Live ya puede aprender el fader.';
            return;
          }
          var reason = result.payload && result.payload.reason;
          emitStatus.textContent = ROUTING_EMIT_ERRORS[reason] || 'No se pudo enviar: el puente no aceptó el pedido.';
        })
        .catch(function () {
          if (emitStatus) emitStatus.textContent = 'No se pudo enviar: el puente no responde.';
        })
        .then(function () {
          emitting = false;
          if (emitBtn) emitBtn.disabled = false;
        });
    }
    if (emitBtn) emitBtn.addEventListener('click', emitCurrent);
    var prevBtn = doc.getElementById('routing-previous');
    var nextBtn = doc.getElementById('routing-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { stepIndex = Math.max(0, stepIndex - 1); render(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { stepIndex = Math.min(walkFor(currentSourceGroups()).length - 1, stepIndex + 1); render(); });
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
  // Discrete confirmations only: continuous slider drags stay silent to avoid a toast storm; scatter confirms on change/commit.
  var toastMessages = [];
  function showToast(doc, message, key) {
    var toast = doc.getElementById('operator-toast');
    if (!toast) return;
    key = key || 'operator';
    toastMessages = Curation.replaceToast(toastMessages, key, message);
    toast.dataset.key = key;
    toast.querySelector('span').textContent = message;
    toast.hidden = false;
  }
  function initDeckGrid(doc) {
    var grid = doc.getElementById('deck-grid');
    if (!grid || !root.fetch) return;
    var manifest, sizes, deck, selected = new Set(), lastSelected = null;
    var warning = doc.getElementById('deck-warning');
    function refreshWarning() {
      var usable = Object.keys(manifest || {}).filter(function (key) { return !(deck.excluded || []).includes(key); }).length;
      warning.textContent = Curation.warningMessage(usable, 30);
    }
    function render() {
      grid.innerHTML = '';
      Object.keys(manifest || {}).forEach(function (key) {
        var entry = manifest[key]; if (!entry || !entry.file) return;
        var label = doc.createElement('label'); label.className = 'deck-item';
        var checkbox = doc.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(key); checkbox.dataset.key = key;
        var image = doc.createElement('img'); image.loading = 'lazy'; image.src = '/images/thumbs/' + encodeURIComponent(key) + '.webp'; image.alt = entry.file;
        var caption = doc.createElement('span'); caption.textContent = entry.file;
        var state = doc.createElement('small'); state.textContent = (sizes.assignments[key] || 'Sin clase') + (deck.excluded.includes(key) ? ' · Excluida' : '');
        label.appendChild(checkbox); label.appendChild(image); label.appendChild(caption); label.appendChild(state); grid.appendChild(label);
      });
      refreshWarning();
    }
    function save(url, value, name, count, key, confirmation) {
      return root.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }).then(function (response) {
        return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || ('HTTP ' + response.status)); return payload; });
      }).then(function () { showToast(doc, confirmation || (count + ' imágenes ' + name), key); render(); return true; }).catch(function (error) { showToast(doc, 'Error al guardar: ' + error.message, key); return false; });
    }
    Promise.all([root.fetch('/api/manifest').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), root.fetch('/api/sizes').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), root.fetch('/api/deck').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })]).then(function (values) { manifest = values[0]; sizes = values[1]; deck = values[2]; render(); }).catch(function (error) { warning.textContent = 'No se pudo cargar el mazo: ' + error.message; showToast(doc, 'Error al cargar imágenes: ' + error.message, 'load'); });
    grid.addEventListener('change', function (event) {
      var box = event.target; if (box.type !== 'checkbox') return;
      var key = box.dataset.key, keys = Array.prototype.map.call(grid.querySelectorAll('input[type=checkbox]'), function (item) { return item.dataset.key; });
      if (event.shiftKey && lastSelected !== null) selected = Curation.toggleSelection(selected, key, keys, lastSelected);
      else selected = Curation.toggleSelection(selected, key, keys);
      lastSelected = key; render();
    });
    doc.getElementById('deck-all').addEventListener('click', function () { selected = Curation.selectAll(Object.keys(manifest || {})); render(); });
    doc.getElementById('deck-none').addEventListener('click', function () { selected = Curation.selectNone(); render(); });
    doc.querySelectorAll('[data-bulk-size]').forEach(function (button) { button.addEventListener('click', function () { var count = selected.size; if (!count) return showToast(doc, 'Error: selecciona imágenes primero', 'sizes'); selected.forEach(function (key) { sizes.assignments[key] = button.dataset.bulkSize; }); save('/api/sizes', sizes, 'en ' + button.dataset.bulkSize, count, 'sizes', Curation.bulkActionMessage(count, button.dataset.bulkSize)); }); });
    function changeExcluded(exclude) { var keys = Array.from(selected); if (!keys.length) return showToast(doc, 'Error: selecciona imágenes primero', 'deck'); var set = new Set(deck.excluded); keys.forEach(function (key) { if (exclude) set.add(key); else set.delete(key); }); var updated = { version: 1, excluded: Array.from(set) }; save('/api/deck', updated, exclude ? 'fuera del mazo' : 'incluidas en el mazo', keys.length, 'deck').then(function (saved) { if (saved) { deck = updated; render(); } }); }
    doc.getElementById('deck-exclude').addEventListener('click', function () { changeExcluded(true); });
    doc.getElementById('deck-include').addEventListener('click', function () { changeExcluded(false); });
    return { render: render };
  }
  function initDimensions(doc) {
    var canvas = doc.getElementById('dimension-canvas');
    if (!canvas || !root.fetch || !root.SizeClasses) return null;
    var ctx = canvas.getContext('2d');
    var current = 0, files = [], manifest = {}, data = null, image = new Image();
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var file = files[current];
      if (!file) return;
      doc.getElementById('dimension-file').textContent = file;
      var assignedCount = Object.keys(data.assignments).length;
      doc.getElementById('dimension-progress').textContent = (current + 1) + ' / ' + files.length + ' · ' + assignedCount + ' asignadas';
      image.onload = function () {
        var key = Object.keys(manifest).find(function (id) { return manifest[id].file === file; });
        var dims = data && root.SizeClasses.getAuthoredDrawSize(data, key, image.naturalWidth, image.naturalHeight, 1920, 1080, manifest[key].inkRatio || 1);
        var w = dims ? dims.width / 2 : image.naturalWidth * Math.min(960 / image.naturalWidth, 540 / image.naturalHeight);
        var h = dims ? dims.height / 2 : image.naturalHeight * Math.min(960 / image.naturalWidth, 540 / image.naturalHeight);
        ctx.drawImage(image, (960-w)/2, (540-h)/2, w, h);
      };
      image.src = '/images/content/' + encodeURIComponent(file);
      ['S','M','L','XL'].forEach(function (name) { doc.querySelector('[data-size="' + name + '"]').setAttribute('aria-pressed', String(data.assignments[Object.keys(manifest).find(function (id) { return manifest[id].file === file; })] === name)); });
    }
    Promise.all([root.fetch('/api/manifest').then(function (r) { return r.json(); }), root.fetch('/api/sizes').then(function (r) { if (!r.ok) throw new Error('sizes unavailable'); return r.json(); })]).then(function (results) {
      manifest = results[0]; data = results[1]; files = Object.keys(manifest).filter(function (id) { return manifest[id] && manifest[id].file; }).map(function (id) { return manifest[id].file; });
      files = Array.from(new Set(files));
      render();
    }).catch(function (error) { showToast(doc, 'Error al cargar dimensiones: ' + error.message, 'dimensions-load'); });
    doc.querySelectorAll('[data-size]').forEach(function (button) { button.addEventListener('click', function () { var file=files[current], key=Object.keys(manifest).find(function(id){return manifest[id].file===file;}); if (!key) return; data.assignments[key]=button.dataset.size; render(); }); });
    function step(delta) { current = Math.max(0, Math.min(files.length-1, current+delta)); render(); }
    doc.getElementById('dimension-prev').addEventListener('click', function(){step(-1);});
    doc.getElementById('dimension-next').addEventListener('click', function(){step(1);});
    doc.getElementById('dimension-save').addEventListener('click', function(){root.fetch('/api/sizes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(payload){if(!r.ok)throw new Error(payload.error||('HTTP '+r.status));showToast(doc,Object.keys(data.assignments).length+' imágenes guardadas','dimensions');});}).catch(function(error){showToast(doc,'Error al guardar: '+error.message,'dimensions');});});
    doc.addEventListener('keydown', function(event){ if (['s','m','l','x'].includes(event.key.toLowerCase())) { var name={s:'S',m:'M',l:'L',x:'XL'}[event.key.toLowerCase()]; var button=doc.querySelector('[data-size="'+name+'"]'); if(button) button.click(); } else if(event.key==='ArrowLeft')step(-1); else if(event.key==='ArrowRight')step(1); });
  }
  var api = { init: init, initRouting: initRouting, initDimensions: initDimensions, initDeckGrid: initDeckGrid, showToast: showToast, renderModel: renderModel, formatCell: formatCell, visibilityCommand: visibilityCommand, isVisible: isVisible, bindThemeToggle: bindThemeToggle, COMMAND_TYPES: COMMAND_TYPES, PRESETS: PRESETS, FILTERS: FILTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OperatorPage = api;
  if (root.document) initRouting(root.document);
  if (root.document) initDimensions(root.document);
  if (root.document) initDeckGrid(root.document);
  if (root.document) root.document.getElementById('operator-toast').querySelector('button').addEventListener('click', function () { root.document.getElementById('operator-toast').hidden = true; });
  if (root.document && typeof BroadcastChannel !== 'undefined') init(root.document, function (name) { return new BroadcastChannel(name); }, root.MidiTheme);
})(typeof window !== 'undefined' ? window : globalThis);
