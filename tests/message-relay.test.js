const { MessageRelay, VALID_ACTIONS, VALID_GESTURES } = require('../bridge/message-relay');

describe('MessageRelay', () => {
  let relay;

  beforeEach(() => {
    relay = new MessageRelay();
  });

  describe('validateSensorMessage', () => {
    test('accepts valid sensor message', () => {
      const msg = {
        type: 'sensor',
        accel: { x: 0.1, y: -0.2, z: 9.8 },
        gyro: { a: 0.5, b: -1.2, g: 0.3 },
        orientation: { a: 45, b: 30, g: -10 },
      };
      expect(relay.validateSensorMessage(msg)).toEqual({ valid: true });
    });

    test('rejects non-object', () => {
      const result = relay.validateSensorMessage('string');
      expect(result.valid).toBe(false);
    });

    test('rejects null', () => {
      expect(relay.validateSensorMessage(null).valid).toBe(false);
    });

    test('rejects missing accel', () => {
      const msg = { type: 'sensor', gyro: { a: 0, b: 0, g: 0 }, orientation: { a: 0, b: 0, g: 0 } };
      expect(relay.validateSensorMessage(msg).valid).toBe(false);
    });

    test('rejects invalid accel value', () => {
      const msg = {
        type: 'sensor',
        accel: { x: 'bad', y: 0, z: 0 },
        gyro: { a: 0, b: 0, g: 0 },
        orientation: { a: 0, b: 0, g: 0 },
      };
      expect(relay.validateSensorMessage(msg).valid).toBe(false);
    });

    test('accepts valid action message', () => {
      expect(relay.validateSensorMessage({ type: 'action', action: 'record-start' }).valid).toBe(true);
    });

    test('accepts action with payload (backward compat)', () => {
      expect(relay.validateSensorMessage({ type: 'action', action: 'opacity', value: 75 }).valid).toBe(true);
      expect(relay.validateSensorMessage({ type: 'action', action: 'move', dx: 10, dy: -5 }).valid).toBe(true);
    });

    test('rejects focus action (removed)', () => {
      expect(relay.validateSensorMessage({ type: 'action', action: 'focus' }).valid).toBe(false);
    });

    test('rejects removed actions via validateSensorMessage', () => {
      const removed = ['reset', 'flipH', 'flipV', 'opacityUp', 'opacityDown', 'lock', 'unlock'];
      for (const a of removed) {
        expect(relay.validateSensorMessage({ type: 'action', action: a }).valid).toBe(false);
      }
    });

    test('rejects invalid action', () => {
      expect(relay.validateSensorMessage({ type: 'action', action: 'nonexistent' }).valid).toBe(false);
    });

    test('rejects unknown type', () => {
      expect(relay.validateSensorMessage({ type: 'unknown' }).valid).toBe(false);
    });

    test('rejects Infinity in accel values', () => {
      const msg = {
        type: 'sensor',
        accel: { x: Infinity, y: 0, z: 0 },
        gyro: { a: 0, b: 0, g: 0 },
        orientation: { a: 0, b: 0, g: 0 },
      };
      expect(relay.validateSensorMessage(msg).valid).toBe(false);
    });
  });

  describe('formatSensorBatchMessage', () => {
    test('includes all required fields', () => {
      const msg = relay.formatSensorBatchMessage(3, { x: 1, y: 2, z: 3 }, { a: 4, b: 5, g: 6 }, { a: 7, b: 8, g: 9 });
      expect(msg.type).toBe('device');
      expect(msg.slot).toBe(3);
      expect(msg.accel).toEqual({ x: 1, y: 2, z: 3 });
      expect(msg.gyro).toEqual({ a: 4, b: 5, g: 6 });
      expect(msg.orientation).toEqual({ a: 7, b: 8, g: 9 });
      expect(msg.ts).toBeDefined();
    });
  });

  describe('formatActionMessage', () => {
    test('formats without payload (backward compat)', () => {
      const msg = relay.formatActionMessage(5, 'shuffle');
      expect(msg.type).toBe('action');
      expect(msg.slot).toBe(5);
      expect(msg.action).toBe('shuffle');
      expect(msg.ts).toBeDefined();
      expect(msg.value).toBeUndefined();
    });

    test('includes value when payload.value is present', () => {
      const msg = relay.formatActionMessage(3, 'opacity', { value: 75 });
      expect(msg.type).toBe('action');
      expect(msg.slot).toBe(3);
      expect(msg.action).toBe('opacity');
      expect(msg.value).toBe(75);
      expect(msg.dx).toBeUndefined();
    });

    test('includes dx/dy when payload.dx is present', () => {
      const msg = relay.formatActionMessage(7, 'move', { dx: 10, dy: -5 });
      expect(msg.type).toBe('action');
      expect(msg.slot).toBe(7);
      expect(msg.action).toBe('move');
      expect(msg.dx).toBe(10);
      expect(msg.dy).toBe(-5);
      expect(msg.value).toBeUndefined();
    });
  });

  describe('formatAssignMessage', () => {
    test('includes slot and cellId', () => {
      const msg = relay.formatAssignMessage(0, 'cell_00');
      expect(msg.type).toBe('system');
      expect(msg.event).toBe('assign');
      expect(msg.slot).toBe(0);
      expect(msg.cellId).toBe('cell_00');
    });
  });

  describe('formatDisconnectMessage', () => {
    test('includes slot', () => {
      const msg = relay.formatDisconnectMessage(3);
      expect(msg.type).toBe('system');
      expect(msg.event).toBe('disconnect');
      expect(msg.slot).toBe(3);
    });
  });

  describe('formatCountMessage', () => {
    test('includes count', () => {
      const msg = relay.formatCountMessage(5);
      expect(msg.type).toBe('system');
      expect(msg.event).toBe('count');
      expect(msg.count).toBe(5);
    });
  });

  describe('formatGestureEventMessage', () => {
    test('formats recorded event with gestureId and action', () => {
      const msg = relay.formatGestureEventMessage(3, 'recorded', 'gesture_1', 'cycle-next');
      expect(msg.type).toBe('gesture-event');
      expect(msg.slot).toBe(3);
      expect(msg.event).toBe('recorded');
      expect(msg.gestureId).toBe('gesture_1');
      expect(msg.action).toBe('cycle-next');
      expect(msg.ts).toBeDefined();
      expect(typeof msg.ts).toBe('number');
    });

    test('formats matched event without gestureId and action', () => {
      const msg = relay.formatGestureEventMessage(5, 'matched');
      expect(msg.type).toBe('gesture-event');
      expect(msg.slot).toBe(5);
      expect(msg.event).toBe('matched');
      expect(msg.gestureId).toBeNull();
      expect(msg.action).toBeNull();
      expect(msg.ts).toBeDefined();
    });
  });

  describe('gesture validation', () => {
    test('accepts valid gesture: flick', () => {
      expect(relay.validateSensorMessage({ type: 'gesture', gesture: 'flick' }).valid).toBe(true);
    });

    test('rejects invalid gesture', () => {
      expect(relay.validateSensorMessage({ type: 'gesture', gesture: 'swipe' }).valid).toBe(false);
    });

    test('rejects gesture with missing gesture field', () => {
      expect(relay.validateSensorMessage({ type: 'gesture' }).valid).toBe(false);
    });

    test('rejects gesture with empty string gesture', () => {
      expect(relay.validateSensorMessage({ type: 'gesture', gesture: '' }).valid).toBe(false);
    });
  });

  describe('VALID_GESTURES', () => {
    test('contains flick only', () => {
      expect(VALID_GESTURES).toEqual(['flick']);
    });

    test('does not contain invalid gestures', () => {
      expect(VALID_GESTURES).not.toContain('swipe');
      expect(VALID_GESTURES).not.toContain('spin');
    });
  });

  describe('formatCellImageMessage', () => {
    test('includes type, slot, imageFile, imageUrl', () => {
      const msg = relay.formatCellImageMessage(3, 'foto_001.jpg', '/images/content/foto_001.jpg');
      expect(msg.type).toBe('cell-image');
      expect(msg.slot).toBe(3);
      expect(msg.imageFile).toBe('foto_001.jpg');
      expect(msg.imageUrl).toBe('/images/content/foto_001.jpg');
    });

    test('formats with different slot and image', () => {
      const msg = relay.formatCellImageMessage(7, 'reforma_1918.jpg', '/images/content/reforma_1918.jpg');
      expect(msg.type).toBe('cell-image');
      expect(msg.slot).toBe(7);
      expect(msg.imageFile).toBe('reforma_1918.jpg');
      expect(msg.imageUrl).toBe('/images/content/reforma_1918.jpg');
    });
  });

  describe('validateValueAction', () => {
    test('valid opacity (integer 0-100)', () => {
      const result = relay.validateValueAction('opacity', 75);
      expect(result).toEqual({ valid: true });
    });

    test('invalid opacity (string)', () => {
      const result = relay.validateValueAction('opacity', 'bad');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('valid rotation (positive)', () => {
      const result = relay.validateValueAction('rotation', 180);
      expect(result).toEqual({ valid: true });
    });

    test('valid rotation (negative)', () => {
      const result = relay.validateValueAction('rotation', -90);
      expect(result).toEqual({ valid: true });
    });

    test('valid filter (in FILTER_NAMES)', () => {
      const result = relay.validateValueAction('filter', 'sepia');
      expect(result).toEqual({ valid: true });
    });

    test('invalid filter (not in FILTER_NAMES)', () => {
      const result = relay.validateValueAction('filter', 'blur');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('valid move (dx, dy numbers)', () => {
      const result = relay.validateValueAction('move', { dx: 10, dy: -5 });
      expect(result).toEqual({ valid: true });
    });

    test('invalid move (missing dy)', () => {
      const result = relay.validateValueAction('move', { x: 10 });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('unknown action returns invalid', () => {
      const result = relay.validateValueAction('nonexistent', 123);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('valid scale (integer 40-180)', () => {
      const result = relay.validateValueAction('scale', 100);
      expect(result).toEqual({ valid: true });
    });

    test('invalid scale (below 40)', () => {
      const result = relay.validateValueAction('scale', 30);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('invalid scale (above 180)', () => {
      const result = relay.validateValueAction('scale', 200);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('parseRecordingDuration', () => {
    test('defaults to 3000ms when no duration provided', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({})).toBe(3000);
    });

    test('uses provided duration within range (4000ms)', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: 4000 })).toBe(4000);
    });

    test('caps at 5000ms maximum', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: 6000 })).toBe(5000);
    });

    test('floors at 1000ms minimum', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: 0 })).toBe(1000);
    });

    test('legacy phones without duration field still work', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ action: 'record-start' })).toBe(3000);
    });

    test('negative duration floors to 1000ms', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: -500 })).toBe(1000);
    });

    test('NaN duration defaults to 3000ms', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: NaN })).toBe(3000);
    });

    test('string duration defaults to 3000ms', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: '4000' })).toBe(3000);
    });

    test('null duration defaults to 3000ms', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: null })).toBe(3000);
    });

    test('duration exactly 1000ms is accepted', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: 1000 })).toBe(1000);
    });

    test('duration exactly 5000ms is accepted', () => {
      const { parseRecordingDuration } = require('../bridge/message-relay');
      expect(parseRecordingDuration({ duration: 5000 })).toBe(5000);
    });
  });

  describe('VALID_ACTIONS', () => {
    test('does NOT contain focus (removed)', () => {
      expect(VALID_ACTIONS).not.toContain('focus');
    });

    test('does NOT contain removed actions', () => {
      const removed = ['reset', 'flipH', 'flipV', 'opacityUp', 'opacityDown', 'lock', 'unlock'];
      for (const a of removed) {
        expect(VALID_ACTIONS).not.toContain(a);
      }
    });

    test('contains record-start and record-stop', () => {
      expect(VALID_ACTIONS).toContain('record-start');
      expect(VALID_ACTIONS).toContain('record-stop');
    });

    test('contains new value actions', () => {
      const added = ['opacity', 'rotation', 'filter', 'move', 'scale'];
      for (const a of added) {
        expect(VALID_ACTIONS).toContain(a);
      }
    });

    test('contains border-next', () => {
      expect(VALID_ACTIONS).toContain('border-next');
    });

    test('contains shuffle', () => {
      expect(VALID_ACTIONS).toContain('shuffle');
    });
  });
});
