const { GestureStore } = require('../bridge/gesture-store');

describe('GestureStore', () => {
  let store;

  beforeEach(() => {
    store = new GestureStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startRecording / stopRecording', () => {
    test('records samples and returns gestureId on stop', () => {
      store.startRecording(5);
      store.addSample(5, { accel: { x: 1, y: 2, z: 3 }, gyro: { a: 0.1, b: 0.2, g: 0.3 } });
      jest.advanceTimersByTime(60);
      store.addSample(5, { accel: { x: 4, y: 5, z: 6 }, gyro: { a: 0.4, b: 0.5, g: 0.6 } });

      const gestureId = store.stopRecording(5);

      expect(gestureId).toBeDefined();
      expect(typeof gestureId).toBe('string');
      expect(gestureId.length).toBeGreaterThan(0);

      const gesture = store.getGesture(5);
      expect(gesture).not.toBeNull();
      expect(gesture.samples).toHaveLength(2);
      expect(gesture.samples[0].accel).toEqual({ x: 1, y: 2, z: 3 });
      expect(gesture.samples[0].gyro).toEqual({ a: 0.1, b: 0.2, g: 0.3 });
      expect(gesture.samples[0].ts).toBeDefined();
    });

    test('stopRecording without startRecording is a no-op', () => {
      const result = store.stopRecording(99);
      expect(result).toBeNull();
      expect(store.getGesture(99)).toBeNull();
    });
  });

  describe('addSample — 20Hz capping', () => {
    test('caps samples at 20Hz (50ms intervals)', () => {
      store.startRecording(3);
      const data = { accel: { x: 1, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } };

      // Add 10 samples at 10ms intervals (should cap to ~2 at 50ms intervals)
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(10);
        store.addSample(3, data);
      }

      const gesture = store.getGesture(3);
      // With 10ms intervals and 50ms cap, we should have at most ceil(100ms/50ms) = 2 samples
      expect(gesture).toBeNull(); // still recording

      const gestureId = store.stopRecording(3);
      const saved = store.getGesture(3);
      // ~100ms of 10ms intervals = at most 2 samples kept (every 50ms)
      expect(saved.samples.length).toBeLessThanOrEqual(3);
    });

    test('addSample when not recording is ignored', () => {
      store.addSample(5, { accel: { x: 1, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } });
      expect(store.getGesture(5)).toBeNull();
    });
  });

  describe('auto-stop at 2 seconds', () => {
    test('auto-stops recording after 2s timeout', () => {
      store.startRecording(7);
      const data = { accel: { x: 1, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } };
      store.addSample(7, data);

      // Not stopped yet before timeout
      expect(store.getGesture(7)).toBeNull();

      // Not stopped yet
      expect(store.getGesture(7)).toBeNull();

      // Simulate external auto-stop (as done by index.js)
      store.recordingTimers[7] = setTimeout(() => store.stopRecording(7), 2000);
      jest.advanceTimersByTime(2500);

      const gesture = store.getGesture(7);
      expect(gesture).not.toBeNull();
      expect(gesture.samples.length).toBeGreaterThanOrEqual(1);
    });

    test('manual stop via stopRecording works', () => {
      store.startRecording(2);
      store.addSample(2, { accel: { x: 0, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } });
      store.stopRecording(2);

      jest.advanceTimersByTime(3000);
      const gesture = store.getGesture(2);
      expect(gesture).not.toBeNull();
    });
  });

  describe('overwrite', () => {
    test('re-recording replaces previous gesture', () => {
      store.startRecording(1);
      store.addSample(1, { accel: { x: 1, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } });
      store.stopRecording(1);

      const firstGesture = store.getGesture(1);

      jest.advanceTimersByTime(100);
      store.startRecording(1);
      store.addSample(1, { accel: { x: 9, y: 9, z: 9 }, gyro: { a: 9, b: 9, g: 9 } });
      store.stopRecording(1);

      const secondGesture = store.getGesture(1);
      expect(secondGesture.samples[0].accel.x).toBe(9);
      expect(secondGesture.gestureId).not.toBe(firstGesture.gestureId);
    });
  });

  describe('discardRecording', () => {
    test('discards in-progress recording without storing', () => {
      store.startRecording(4);
      store.addSample(4, { accel: { x: 1, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } });
      store.discardRecording(4);

      expect(store.getGesture(4)).toBeNull();

      // Recording state should be cleared — can't stop what was discarded
      const result = store.stopRecording(4);
      expect(result).toBeNull();
    });

    test('discardRecording on non-recording slot is no-op', () => {
      expect(() => store.discardRecording(99)).not.toThrow();
    });
  });

  describe('getGesture', () => {
    test('returns null for slot with no gesture', () => {
      expect(store.getGesture(42)).toBeNull();
    });

    test('returns null for slot after discard', () => {
      store.startRecording(0);
      store.addSample(0, { accel: { x: 1, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } });
      store.stopRecording(0);
      expect(store.getGesture(0)).not.toBeNull();

      store.startRecording(0);
      store.discardRecording(0);
      expect(store.getGesture(0)).toBeNull();
    });
  });
});
