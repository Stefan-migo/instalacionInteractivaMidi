const VALID_ACTIONS = [
  'shuffle',
  'record-start', 'record-stop',
  'opacity', 'rotation', 'filter', 'move',
  'scale', 'filter-next',
  'cell-next', 'cell-prev',
  'cycle-next', 'bring-front', 'send-back',
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

// The continuous lane now carries three controllers per group: position,
// scale and rotation (odd/tasks/touch-faders.md, S3). A v2 score that declares
// only `ccController` stays valid so an older agent is never refused mid-show.
const SCORE_LANES = ['position', 'scale', 'rotation'];

function validControllers(group) {
  if (Number.isInteger(group.ccController) && group.ccController >= 0 && group.ccController <= 127) return true;
  const lanes = group.ccControllers;
  if (!lanes || typeof lanes !== 'object') return false;
  return SCORE_LANES.every(lane => Number.isInteger(lanes[lane]) && lanes[lane] >= 0 && lanes[lane] <= 127);
}

function validateMusicScore(message) {
  if (!message || !Number.isInteger(message.version) || !Number.isInteger(message.safeValue) || message.safeValue < 0 || message.safeValue > 127 || !message.derivation || typeof message.derivation !== 'object' || !Array.isArray(message.groups) || message.groups.length < 1 || message.groups.length > 16) return false;
  const seen = new Set();
  return message.groups.every(group => {
    if (!group || typeof group !== 'object' || !Number.isInteger(group.group) || group.group < 1 || group.group > 16 || seen.has(group.group)) return false;
    seen.add(group.group);
    return Number.isInteger(group.channel) && group.channel >= 1 && group.channel <= 16 &&
      validControllers(group) &&
      ['average', 'max', 'last'].includes(group.aggregation) && group.curve && typeof group.curve === 'object' &&
      typeof group.ema === 'number' && group.ema > 0 && group.ema <= 1 && Number.isInteger(group.deadband) && group.deadband >= 0 &&
      typeof group.maxPerSecond === 'number' && group.maxPerSecond > 0 && group.notes && ['tilt', 'flick', 'rotation'].every(name => Number.isInteger(group.notes[name]) && group.notes[name] >= 0 && group.notes[name] <= 127);
  });
}

// One voice, on demand, so Ableton can learn a mapping in its Ctrl+M mode.
// The panel never edits the score; this only makes the message arrive.
const EMIT_OUTPUTS = ['note', 'cc'];

function parseEmitRequest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!EMIT_OUTPUTS.includes(raw.output)) return null;
  const channel = raw.channel;
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) return null;
  if (raw.output === 'note') {
    const note = raw.note;
    const velocity = raw.velocity === undefined ? 100 : raw.velocity;
    if (!Number.isInteger(note) || note < 0 || note > 127) return null;
    if (!Number.isInteger(velocity) || velocity < 1 || velocity > 127) return null;
    return { type: 'music-test', output: 'note', channel, note, velocity };
  }
  const controller = raw.controller;
  if (!Number.isInteger(controller) || controller < 0 || controller > 127) return null;
  return { type: 'music-test', output: 'cc', channel, controller };
}

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

function parseRecordingDuration(msg) {  const raw = typeof msg.duration === 'number' && !Number.isNaN(msg.duration) ? msg.duration : 3000;
  return Math.min(Math.max(raw, 1000), 5000);
}

module.exports = { MessageRelay, VALID_ACTIONS, VALID_GESTURES, FILTER_NAMES, VALID_VALUE_ACTIONS, parseRecordingDuration, parseEmitRequest, validateMusicScore };
