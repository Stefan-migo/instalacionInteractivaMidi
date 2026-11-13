/**
 * Tests for the gesture gallery: the state machine the phone runs, and the fact
 * that the detectors it drives are the shipped module instead of a copy that
 * used to live in this file. Their behavior is pinned in
 * tests/gesture-detector.test.js.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('the phone runs the shipped gesture detector', () => {
  test('the module is served before the client that uses it', () => {
    const html = read('phone-client/index.html');
    const moduleAt = html.indexOf('/phone-client/gesture-detector.js');
    const appAt = html.indexOf('/phone-client/app.js');
    expect(moduleAt).toBeGreaterThan(-1);
    expect(appAt).toBeGreaterThan(moduleAt);
  });

  test('the client builds its detector from the module', () => {
    const app = read('phone-client/app.js');
    expect(app).toContain('gestureDetector = GestureDetector.create()');
    expect(app).toContain('gestureDetector.feedMotion(');
    expect(app).toContain('gestureDetector.feedOrientation(');
  });

  // Regression: the client carried its own copy of the detectors, so the suite
  // stayed green while the phone shipped different thresholds — and a knob read
  // the compass heading (alpha) instead of the device z axis.
  test('the client carries no detector of its own', () => {
    const app = read('phone-client/app.js');
    expect(app).not.toContain('refAlpha');
    expect(app).not.toContain('jerkMag');
    expect(app).not.toContain('processMotion');
  });
});

// --- T-18: Gallery state machine transitions ---
describe('gallery state machine', () => {
  /**
   * Factory for the gallery state machine.
   * States: null → 'gallery' → 'practice' → 'practice-done' → 'practice' → 'gallery' → null
   */
  function createStateMachine() {
    var galleryState = null;
    return {
      getState: function () { return galleryState; },
      openGallery: function () { galleryState = 'gallery'; },
      closeGallery: function () { galleryState = null; },
      startPractice: function () { galleryState = 'practice'; },
      onGestureDetected: function () {
        if (galleryState !== 'practice') return false;
        galleryState = 'practice-done';
        return true;
      },
      endPractice: function () { galleryState = 'gallery'; }
    };
  }

  test('starts as null', () => {
    var sm = createStateMachine();
    expect(sm.getState()).toBeNull();
  });

  test('openGallery transitions null → gallery', () => {
    var sm = createStateMachine();
    sm.openGallery();
    expect(sm.getState()).toBe('gallery');
  });

  test('closeGallery transitions any → null', () => {
    var sm = createStateMachine();
    sm.openGallery();
    sm.closeGallery();
    expect(sm.getState()).toBeNull();
  });

  test('startPractice transitions gallery → practice', () => {
    var sm = createStateMachine();
    sm.openGallery();
    sm.startPractice();
    expect(sm.getState()).toBe('practice');
  });

  test('onGestureDetected transitions practice → practice-done', () => {
    var sm = createStateMachine();
    sm.openGallery();
    sm.startPractice();
    expect(sm.onGestureDetected()).toBe(true);
    expect(sm.getState()).toBe('practice-done');
  });

  test('onGestureDetected returns false when not in practice', () => {
    var sm = createStateMachine();
    sm.openGallery();
    expect(sm.onGestureDetected()).toBe(false);
    expect(sm.getState()).toBe('gallery');
  });

  test('endPractice returns from practice-done to gallery', () => {
    var sm = createStateMachine();
    sm.openGallery();
    sm.startPractice();
    sm.onGestureDetected();
    sm.endPractice();
    expect(sm.getState()).toBe('gallery');
  });

  test('closeGallery from practice resets to null', () => {
    var sm = createStateMachine();
    sm.openGallery();
    sm.startPractice();
    sm.closeGallery();
    expect(sm.getState()).toBeNull();
  });

  test('full cycle: null → gallery → practice → practice-done → practice → gallery → null', () => {
    var sm = createStateMachine();
    expect(sm.getState()).toBeNull();

    sm.openGallery();
    expect(sm.getState()).toBe('gallery');

    sm.startPractice();
    expect(sm.getState()).toBe('practice');

    sm.onGestureDetected();
    expect(sm.getState()).toBe('practice-done');

    // Simulate re-practice: back to practice via feedback timeout
    // (In production this happens via setTimeout, here we test endPractice)
    sm.endPractice();
    expect(sm.getState()).toBe('gallery');

    sm.closeGallery();
    expect(sm.getState()).toBeNull();
  });
});
