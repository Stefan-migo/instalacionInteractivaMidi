/**
 * DeviceManager — manages phone slots + full collage rendering.
 *
 * All 30 cells are initialized on startup and always visible.
 * Phones connect to specific slots and control them via sensor/actions.
 * When a phone disconnects, the cell remains visible (keeps its state).
 */
class DeviceManager {
  constructor(layout, renderer, sensorMapper, imageLoader, layoutEngine) {
    this.layout = layout;
    this.renderer = renderer;
    this.sensorMapper = sensorMapper;
    this.imageLoader = imageLoader;
    this.layoutEngine = layoutEngine;
    this.phoneSlots = new Set();   // slots with connected phones
    this.sensorData = {};
    this.initialized = false;
  }

  /**
   * Initialize ALL cells on startup — they stay visible forever.
   * Call once after construction.
   */
  initAll() {
    const cells = this.layout.cells;
    for (const cell of cells) {
      this.renderer.initCell(cell.slot, cell);
    }
    this.initialized = true;
    this._recalculateLayout();
  }

  /**
   * Phone connects to a slot.
   * Cell is already visible from initAll() — we just wire phone control.
   */
  assign(slot) {
    if (!this.layout.getCell(slot)) return;
    this.phoneSlots.add(slot);
    this.sensorMapper.resetSlot(slot);
    // Mark cell as phone-connected for rendering effects
    const s = this.renderer.cellStates[slot];
    if (s) s.phoneConnected = true;
  }

  updateSensor(slot, accel, gyro, orientation) {
    if (!this.phoneSlots.has(slot)) return;
    this.sensorData[slot] = { accel, gyro, orientation };
    const sm = this.sensorMapper.map(slot, accel, gyro, orientation);
    this.renderer.updateFromSensor(slot, sm);
  }

  handleAction(slot, action, payload = null) {
    if (!this.phoneSlots.has(slot)) return;
    this.renderer.handleAction(slot, action, this.imageLoader, payload);
  }

  /**
   * Phone disconnects — cell stays visible, just loses phone control.
   */
  disconnect(slot) {
    this.phoneSlots.delete(slot);
    this.sensorMapper.removeSlot(slot);
    delete this.sensorData[slot];
    const s = this.renderer.cellStates[slot];
    if (s) s.phoneConnected = false;
  }

  /**
   * Recalculate layout for ALL cells using current preset.
   */
  _recalculateLayout() {
    if (!this.layoutEngine || !this.initialized) return;
    const positions = this.layoutEngine.compute(this.layout.cells);
    for (const pos of positions) {
      this.renderer.updateCellPosition(pos.slot, pos);
    }
  }

  get count() {
    return this.phoneSlots.size;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DeviceManager };
}
