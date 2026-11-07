(function (root) {
  'use strict';
  function applyCommand(message, api) {
    if (!message || !api || !api.deviceManager) return false;
    var manager = api.deviceManager;
    var states = manager.renderer && manager.renderer.cellStates;
    var slot = message.slot;
    var cell = states && states[slot];
    switch (message.type) {
      case 'requestState': api.publish(); return true;
      case 'setPreset': manager.layoutEngine.setPreset(message.preset); manager._recalculateLayout(); api.activeSlots = api.getSortedSlots(); api.redraw(); break;
      case 'setScatterScale': api.CONFIG.scatterScale = message.value; manager.layoutEngine.scatterScale = message.value; manager._recalculateLayout(); api.redraw(); break;
      case 'setNoiseIntensity': api.CONFIG.noiseIntensity = message.value / 100; api.setBackgroundTexture(null); api.redraw(); break;
      case 'selectCell': api.selectCell(message.slot); api.redraw(); break;
      case 'setFilter': if (!cell) return false; cell.filterType = message.value; api.redraw(); break;
      case 'setBorder': if (!cell) return false; cell.borderStyle = message.value; api.redraw(); break;
      case 'setRotation': if (!cell || !cell.pos) return false; cell.pos.rotation = message.value; api.redraw(); break;
      case 'setScale': if (!cell) return false; cell._editorScale = message.value; api.redraw(); break;
      case 'setOpacity': if (!cell) return false; cell.opacity = message.value; api.redraw(); break;
      case 'toggleVisibility': if (!cell) return false; cell.opacity = cell.opacity > 0 ? 0 : 1; api.redraw(); break;
      case 'rotateSelected':
        cell = states && states[api.selectedSlot]; if (!cell || !cell.pos) return false;
        cell.pos.rotation = ((cell.pos.rotation + message.delta) % 360 + 360) % 360; api.redraw(); break;
      case 'bringToFront':
        if (!cell || !cell.pos) return false;
        var maxZ = 0; Object.keys(states).forEach(function (key) { if (states[key] && states[key].pos) maxZ = Math.max(maxZ, states[key].pos.zIndex); });
        cell.pos.zIndex = maxZ + 1; api.activeSlots = api.getSortedSlots(); api.redraw(); break;
      case 'hideCell': if (!cell) return false; cell.opacity = 0; api.redraw(); break;
      case 'esparcirTodo': manager._recalculateLayout(); api.activeSlots = api.getSortedSlots(); api.redraw(); break;
      default: return false;
    }
    api.publish();
    return true;
  }
  function makeSnapshot(api) {
    var manager = api.deviceManager;
    if (!manager || !api.collageLayout) return null;
    var cells = api.collageLayout.cells.map(function (item) {
      var state = manager.renderer.cellStates[item.slot] || {};
      return { slot: item.slot, imageFile: state.currentImageFile || item.imageFile || null, filterType: state.filterType || 'none', borderStyle: state.borderStyle || 'torn', rotation: state.pos ? state.pos.rotation || 0 : 0, scale: state._editorScale || 1, opacity: state.opacity == null ? 1 : state.opacity };
    });
    return { state: cells, preset: manager.layoutEngine.getCurrentPreset(), scatterScale: api.CONFIG.scatterScale, noiseIntensity: Math.round(api.CONFIG.noiseIntensity * 100), selectedSlot: api.selectedSlot, connected: manager.count || 0, total: cells.length, cells: cells };
  }
  function start(api, factory) {
    var commands = factory('midi-operator-cmd');
    var state = factory('midi-operator-state');
    function publish() { var snapshot = makeSnapshot(api); if (snapshot) state.postMessage(snapshot); }
    api.publish = publish;
    commands.addEventListener('message', function (event) { if (api.deviceManager) applyCommand(event.data, api); });
    var timer = setInterval(publish, 1000);
    return { publish: publish, stop: function () { clearInterval(timer); } };
  }
  var api = { applyCommand: applyCommand, makeSnapshot: makeSnapshot, start: start };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OperatorLink = api;
  if (root.document && typeof BroadcastChannel !== 'undefined') {
    start({ get deviceManager() { return deviceManager; }, get collageLayout() { return collageLayout; }, get CONFIG() { return CONFIG; }, get selectedSlot() { return selectedSlot; }, set activeSlots(value) { activeSlots = value; }, getSortedSlots: function () { return getSortedSlots(); }, redraw: function () { redraw(); }, selectCell: function (slot) { selectCell(slot); }, setBackgroundTexture: function (value) { _bgTexture = value; } }, function (name) { return new BroadcastChannel(name); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
