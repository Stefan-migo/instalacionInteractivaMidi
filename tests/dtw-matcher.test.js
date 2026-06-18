const { GestureStore } = require('../bridge/gesture-store');
const { DTWMatcher } = require('../bridge/dtw-matcher');

function makeSample(accelX, gyroA) {
  return { accel: { x: accelX, y: 0, z: 0 }, gyro: { a: gyroA, b: 0, g: 0 } };
}

describe('DTWMatcher', () => {
  let gestureStore;
  let matcher;

  beforeEach(() => {
    jest.useFakeTimers();
    gestureStore = new GestureStore();
    matcher = new DTWMatcher(gestureStore, {
      threshold: 0.5,
      downsampleHz: 10,
      debounceMs: 1000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('addSample — match success', () => {
    test('returns matched result when DTW distance is below threshold', () => {
      // Record a gesture with known pattern on slot 3
      gestureStore.startRecording(3);
      const pattern = [
        { accel: { x: 1.0, y: 0, z: 0 }, gyro: { a: 0.5, b: 0, g: 0 } },
        { accel: { x: 2.0, y: 0, z: 0 }, gyro: { a: 1.0, b: 0, g: 0 } },
        { accel: { x: 3.0, y: 0, z: 0 }, gyro: { a: 1.5, b: 0, g: 0 } },
      ];
      pattern.forEach((d) => {
        jest.advanceTimersByTime(60);
        gestureStore.addSample(3, d);
      });
      gestureStore.stopRecording(3);
      gestureStore.getGesture(3).action = 'cycle-next';

      // Feed matching samples — match fires when window has enough samples
      // First sample starts the window
      let result = matcher.addSample(3, pattern[0]);
      expect(result).toBeNull(); // not enough samples yet

      // Second sample triggers match (window has 2 samples, stored has 3)
      jest.advanceTimersByTime(110);
      result = matcher.addSample(3, pattern[1]);
      expect(result).not.toBeNull();
      expect(result.matched).toBe(true);
      expect(result.gestureId).toBe(gestureStore.getGesture(3).gestureId);
      expect(result.action).toBe('cycle-next');
    });
  });

  describe('addSample — no match', () => {
    test('returns matched:false when DTW distance exceeds threshold', () => {
      // Record a gesture with specific pattern
      gestureStore.startRecording(7);
      jest.advanceTimersByTime(60);
      gestureStore.addSample(7, { accel: { x: 100, y: 100, z: 100 }, gyro: { a: 100, b: 100, g: 100 } });
      jest.advanceTimersByTime(60);
      gestureStore.addSample(7, { accel: { x: 100, y: 100, z: 100 }, gyro: { a: 100, b: 100, g: 100 } });
      jest.advanceTimersByTime(60);
      gestureStore.addSample(7, { accel: { x: 100, y: 100, z: 100 }, gyro: { a: 100, b: 100, g: 100 } });
      gestureStore.stopRecording(7);
      gestureStore.getGesture(7).action = 'cycle-prev';

      // Feed very different samples
      let result = matcher.addSample(7, { accel: { x: 0, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } });
      expect(result).toBeNull(); // collecting

      jest.advanceTimersByTime(110);
      result = matcher.addSample(7, { accel: { x: 0, y: 0, z: 0 }, gyro: { a: 0, b: 0, g: 0 } });
      expect(result).not.toBeNull();
      expect(result.matched).toBe(false);
    });
  });

  describe('addSample — empty gesture skip', () => {
    test('returns null when slot has no stored gesture', () => {
      let result = matcher.addSample(9, makeSample(1, 1));
      expect(result).toBeNull();
      jest.advanceTimersByTime(110);
      result = matcher.addSample(9, makeSample(1, 1));
      expect(result).toBeNull();
    });
  });

  describe('addSample — debounce', () => {
    test('suppresses matches within cooldown period', () => {
      // Record gesture with 2 distinct samples for easy matching
      gestureStore.startRecording(4);
      jest.advanceTimersByTime(60);
      gestureStore.addSample(4, makeSample(1, 0.5));
      jest.advanceTimersByTime(60);
      gestureStore.addSample(4, makeSample(2, 1.0));
      jest.advanceTimersByTime(60);
      gestureStore.addSample(4, makeSample(3, 1.5));
      gestureStore.stopRecording(4);
      gestureStore.getGesture(4).action = 'transition-toggle';

      // First match should fire on second sample
      matcher.addSample(4, makeSample(1, 0.5)); // starts window
      jest.advanceTimersByTime(110);
      const first = matcher.addSample(4, makeSample(2, 1.0)); // triggers match
      expect(first.matched).toBe(true);

      // During cooldown: samples still accumulate but match is suppressed
      jest.advanceTimersByTime(200); // still within 1s cooldown
      const r1 = matcher.addSample(4, makeSample(1, 0.5)); // window: 1 sample → no match yet
      expect(r1).toBeNull();
      jest.advanceTimersByTime(110);
      const r2 = matcher.addSample(4, makeSample(2, 1.0)); // window: 2 samples → cooldown active
      expect(r2).not.toBeNull();
      expect(r2.matched).toBe(false);

      // Window kept 2 samples during cooldown.
      // After cooldown expires, next sample triggers match immediately.
      jest.advanceTimersByTime(1000);
      // Window now has 2 pending samples from cooldown period + cooldown expired
      const third = matcher.addSample(4, makeSample(1, 0.5)); // window: 3 samples → match!
      expect(third).not.toBeNull();
      expect(third.matched).toBe(true);
    });
  });

  describe('downsample', () => {
    test('downsamples to configured rate (10Hz = 100ms intervals)', () => {
      // Record 2 samples for slot 5
      gestureStore.startRecording(5);
      jest.advanceTimersByTime(60);
      gestureStore.addSample(5, makeSample(1, 0.5));
      jest.advanceTimersByTime(60);
      gestureStore.addSample(5, makeSample(2, 1.0));
      jest.advanceTimersByTime(60);
      gestureStore.addSample(5, makeSample(3, 1.5));
      gestureStore.stopRecording(5);
      gestureStore.getGesture(5).action = 'test';

      // Feed samples at 30ms intervals — only ~every 4th should pass the 100ms gate
      matcher.addSample(5, makeSample(1, 0.5)); // T=0: passes
      jest.advanceTimersByTime(30);
      let r = matcher.addSample(5, makeSample(1, 0.5)); // T=30: skipped (< 100ms)
      expect(r).toBeNull();
      jest.advanceTimersByTime(30);
      r = matcher.addSample(5, makeSample(1, 0.5)); // T=60: skipped
      expect(r).toBeNull();
      jest.advanceTimersByTime(30);
      r = matcher.addSample(5, makeSample(2, 1.0)); // T=90: skipped
      expect(r).toBeNull();
      jest.advanceTimersByTime(30);
      r = matcher.addSample(5, makeSample(3, 1.5)); // T=120: should pass (120 >= 100)
      expect(r).not.toBeNull(); // returns match or no-match result
    });
  });
});
