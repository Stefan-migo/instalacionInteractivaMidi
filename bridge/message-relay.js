const VALID_ACTIONS = [
  'shuffle',
  'record-start', 'record-stop',
  'opacity', 'rotation', 'filter', 'move',
  'scale', 'filter-next',
  'cell-next', 'cell-prev',
  'bring-front',
];

const FILTER_NAMES = ['sepia', 'grayscale', 'cyanotype', 'polaroid', 'vintage', 'none'];

const VALID_VALUE_ACTIONS = {
  opacity:   { validator: v => typeof v === 'number' && v >= 0 && v <= 100 && Number.isInteger(v) },
  rotation:  { validator: v => typeof v === 'number' && isFinite(v) },
  filter:    { validator: v => FILTER_NAMES.includes(v) },
  move:      { validator: v => typeof v.dx === 'number' && typeof v.dy === 'number' && isFinite(v.dx) && isFinite(v.dy) },
  scale:     { validator: v => typeof v === 'number' && v >= 40 && v <= 180 && Number.isInteger(v) },
};

const VALID_GESTURES = [
  'flick',
];

const SENSOR_KEYS = ['accel', 'gyro', 'orientation'];
const AXIS_KEYS = { accel: ['x', 'y', 'z'], gyro: ['a', 'b', 'g'], orientation: ['a', 'b', 'g'] };

class MessageRelay {
  validateSensorMessage(msg) {
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: 'not an object' };
    }

    if (msg.type === 'sensor') {
      for (const key of SENSOR_KEYS) {
        if (!msg[key] || typeof msg[key] !== 'object') {
          return { valid: false, error: `missing or invalid ${key}` };
        }
        for (const axis of AXIS_KEYS[key]) {
          if (typeof msg[key][axis] !== 'number' || !isFinite(msg[key][axis])) {
            return { valid: false, error: `invalid ${key}.${axis}` };
          }
        }
      }
      return { valid: true };
    }

    if (msg.type === 'action') {
      if (!VALID_ACTIONS.includes(msg.action)) {
        return { valid: false, error: `invalid action: ${msg.action}` };
      }
      // Validate value-bearing action payloads
      if (VALID_VALUE_ACTIONS[msg.action]) {
        return this.validateValueAction(msg.action, msg.value ?? msg);
      }
      return { valid: true };
    }

    if (msg.type === 'gesture') {
      if (!VALID_GESTURES.includes(msg.gesture)) {
        return { valid: false, error: `invalid gesture: ${msg.gesture}` };
      }
      return { valid: true };
    }

    return { valid: false, error: `unknown type: ${msg.type}` };
  }

  validateValueAction(action, value) {
    const rule = VALID_VALUE_ACTIONS[action];
    if (!rule) {
      return { valid: false, error: `unknown value action: ${action}` };
    }
    if (!rule.validator(value)) {
      return { valid: false, error: `invalid value for ${action}: ${JSON.stringify(value)}` };
    }
    return { valid: true };
  }

  formatSensorBatchMessage(slot, accel, gyro, orientation) {
    return { type: 'device', slot, accel, gyro, orientation, ts: Date.now() };
  }

  formatActionMessage(slot, action, payload = null) {
    const msg = { type: 'action', slot, action, ts: Date.now() };
    if (payload) {
      if (payload.value !== undefined) msg.value = payload.value;
      if (payload.dx !== undefined) { msg.dx = payload.dx; msg.dy = payload.dy; }
    }
    return msg;
  }

  formatAssignMessage(slot, cellId) {
    return { type: 'system', event: 'assign', slot, cellId };
  }

  formatDisconnectMessage(slot) {
    return { type: 'system', event: 'disconnect', slot };
  }

  formatCellImageMessage(slot, imageFile, imageUrl) {
    return { type: 'cell-image', slot, imageFile, imageUrl };
  }

  formatCountMessage(count) {
    return { type: 'system', event: 'count', count };
  }

  formatGestureEventMessage(slot, event, gestureId, action) {
    return {
      type: 'gesture-event',
      slot,
      event,
      gestureId: gestureId || null,
      action: action || null,
      ts: Date.now(),
    };
  }
}

function parseRecordingDuration(msg) {
  const raw = typeof msg.duration === 'number' && !Number.isNaN(msg.duration) ? msg.duration : 3000;
  return Math.min(Math.max(raw, 1000), 5000);
}

module.exports = { MessageRelay, VALID_ACTIONS, VALID_GESTURES, FILTER_NAMES, VALID_VALUE_ACTIONS, parseRecordingDuration };
