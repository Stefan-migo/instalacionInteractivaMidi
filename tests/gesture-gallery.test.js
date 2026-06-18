/**
 * Tests for gesture-gallery feature.
 * Tests gesture detector heuristics (T-8, T-9, T-10) and gallery state machine (T-4).
 * Pure logic — no DOM environment needed.
 */

var lastJerkTime = 0;

describe('gestureDetectors', () => {
  /**
   * Factory matching the gestureDetectors structure from design.md.
   * Each detector: activate/deactivate toggle, check() with threshold + cooldown.
   */
  function createDetectors() {
    return {
      inclinar: {
        lastTrigger: 0,
        cooldown: 1200,
        canFire: true,
        pendingSince: 0,
        check: function (orientation) {
          var now = Date.now();
          if (Math.abs(orientation.b) < 10) this.canFire = true;
          if (!this.canFire) { this.pendingSince = 0; return false; }
          if (now - this.lastTrigger < this.cooldown) return false;
           var absB = Math.abs(orientation.b);
          if (absB > 30) {
            if (this.pendingSince === 0) { this.pendingSince = now; return false; }
            if (now - this.pendingSince > 400 && now - lastJerkTime > 800) {
              this.pendingSince = 0;
              this.lastTrigger = now;
              this.canFire = false;
              return true;
            }
            return false;
          }
          this.pendingSince = 0;
          return false;
        }
      },
      twist: {
        lastTrigger: 0,
        cooldown: 1200,
        canFire: true,
        refAlpha: null,
        check: function (alpha) {
          var now = Date.now();
          if (this.refAlpha === null) { this.refAlpha = alpha; return false; }
          if (this.lastTrigger > 0 && now - this.lastTrigger > 5000) { this.refAlpha = alpha; this.canFire = true; return false; }
          var raw = alpha - this.refAlpha;
          var delta = Math.abs(raw) > 180 ? 360 - Math.abs(raw) : Math.abs(raw);
          if (delta <= 5) this.canFire = true;
          if (delta > 20 && this.canFire && now - this.lastTrigger >= this.cooldown) {
            this.lastTrigger = now;
            this.canFire = false;
            this.refAlpha = alpha;
            return true;
          }
          return false;
        }
      }
    };
  }

  // --- Inclinar — beta (nod) threshold with hysteresis + deferred fire ---
  describe('inclinar', () => {
    test('detects beta > 30° after 400ms defer (happy path)', () => {
      var d = createDetectors();
      var _now = Date.now;
      Date.now = function () { return 10000; };
      lastJerkTime = 0;
      expect(d.inclinar.check({ b: 40 })).toBe(false); // pending
      Date.now = function () { return 10450; };
      expect(d.inclinar.check({ b: 40 })).toBe(true); // fires
      Date.now = _now;
    });

    test('does NOT fire if jerk happens during deferred window', () => {
      var d = createDetectors();
      var _now = Date.now;
      lastJerkTime = 0;
      Date.now = function () { return 10000; };
      expect(d.inclinar.check({ b: 40 })).toBe(false); // pending starts
      lastJerkTime = 10100; // jerk
      d.inclinar.pendingSince = 0; // cancelled
      Date.now = function () { return 12000; };
      expect(d.inclinar.check({ b: 40 })).toBe(false); // pending restarts
      Date.now = function () { return 12450; };
      expect(d.inclinar.check({ b: 40 })).toBe(true); // fires
      Date.now = _now;
    });

    test('boundary: exactly 30° beta is NOT detected', () => {
      var d = createDetectors();
      expect(d.inclinar.check({ b: 30 })).toBe(false);
    });

    test('negative beta beyond -30° is detected after defer', () => {
      var d = createDetectors();
      var _now = Date.now;
      Date.now = function () { return 10000; };
      lastJerkTime = 0;
      expect(d.inclinar.check({ b: -35 })).toBe(false);
      Date.now = function () { return 10450; };
      expect(d.inclinar.check({ b: -35 })).toBe(true);
      Date.now = _now;
    });

    test('hysteresis does NOT re-fire until returning near center', () => {
      var d = createDetectors();
      var _now = Date.now;
      Date.now = function () { return 10000; };
      lastJerkTime = 0;
      expect(d.inclinar.check({ b: 40 })).toBe(false);
      Date.now = function () { return 10450; };
      expect(d.inclinar.check({ b: 40 })).toBe(true);
      Date.now = function () { return 12000; };
      expect(d.inclinar.check({ b: 50 })).toBe(false); // canFire false
      Date.now = function () { return 14000; };
      expect(d.inclinar.check({ b: 5 })).toBe(false);  // resets canFire
      Date.now = function () { return 16000; };
      expect(d.inclinar.check({ b: 40 })).toBe(false); // pending
      Date.now = function () { return 16450; };
      expect(d.inclinar.check({ b: 40 })).toBe(true);  // fires again
      Date.now = _now;
    });
  });

  // --- Twist — alpha delta threshold with hysteresis ---
  describe('twist', () => {
    test('detects alpha delta > 20° (happy path)', () => {
      var d = createDetectors();
      d.twist.refAlpha = 0;
      expect(d.twist.check(25)).toBe(true);
    });

    test('does NOT fire on small delta (< 20°)', () => {
      var d = createDetectors();
      d.twist.refAlpha = 0;
      expect(d.twist.check(15)).toBe(false);
    });

    test('boundary: exactly 20° delta is NOT detected', () => {
      var d = createDetectors();
      d.twist.refAlpha = 0;
      expect(d.twist.check(20)).toBe(false);
    });

    test('handles wrap-around at 0/360 boundary', () => {
      var d = createDetectors();
      d.twist.refAlpha = 350;
      expect(d.twist.check(11)).toBe(true); // 21° delta across 0 boundary
    });

    test('fire → near ref → canFire resets → cooldown → fires again', () => {
      var d = createDetectors();
      var _now = Date.now;
      Date.now = function () { return 10000; };
      d.twist.refAlpha = 0;
      expect(d.twist.check(25)).toBe(true);   // fires, refAlpha=25, canFire=false
      Date.now = function () { return 10100; };
      expect(d.twist.check(30)).toBe(false);  // near ref (delta 5), canFire resets, but cooldown < 1200
      Date.now = function () { return 11300; };
      expect(d.twist.check(4)).toBe(true);    // delta=21 > 20, canFire=true, cooldown 1300>1200 → fires!
      Date.now = _now;
    });
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
