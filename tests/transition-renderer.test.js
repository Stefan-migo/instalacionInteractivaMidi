const { TransitionRenderer } = require('../p5-collage/transition-renderer');

describe('TransitionRenderer', () => {
  let renderer;

  beforeEach(() => {
    renderer = new TransitionRenderer({ transitionDuration: 300 });
  });

  /* ── Initial state ── */

  test('starts in idle state', () => {
    const state = renderer.update(0);
    expect(state.state).toBe('idle');
    expect(state.complete).toBe(false);
  });

  /* ── Start transition ── */

  test('startTransition sets state to fading', () => {
    renderer.startTransition('oldImg', 'newImg');
    const state = renderer.update(0);
    expect(state.state).toBe('fading');
    expect(state.complete).toBe(false);
  });

  /* ── Alpha ramp ── */

  test('oldAlpha decreases and newAlpha increases over duration', () => {
    renderer.startTransition('oldImg', 'newImg');

    // After 150ms (half of 300ms)
    const half = renderer.update(150);
    expect(half.oldAlpha).toBeCloseTo(0.5, 1);
    expect(half.newAlpha).toBeCloseTo(0.5, 1);

    // After another 150ms (total 300ms) — complete
    const full = renderer.update(150);
    expect(full.state).toBe('idle');
    expect(full.complete).toBe(true);
    // After completion alphas are both 1 (new image fully shown)
    expect(full.oldAlpha).toBe(1);
    expect(full.newAlpha).toBe(1);
  });

  test('start of transition has oldAlpha=1 newAlpha=0', () => {
    renderer.startTransition('oldImg', 'newImg');
    const start = renderer.update(0);
    expect(start.oldAlpha).toBeCloseTo(1, 2);
    expect(start.newAlpha).toBeCloseTo(0, 2);
  });

  /* ── Custom duration ── */

  test('supports custom duration via constructor', () => {
    const fast = new TransitionRenderer({ transitionDuration: 100 });
    fast.startTransition('old', 'new');
    const mid = fast.update(50);
    expect(mid.oldAlpha).toBeCloseTo(0.5, 1);
    expect(mid.newAlpha).toBeCloseTo(0.5, 1);
    const done = fast.update(50);
    expect(done.state).toBe('idle');
    expect(done.complete).toBe(true);
  });

  /* ── FPS gate ── */

  test('falls back to instant swap after 3 consecutive slow frames', () => {
    renderer.startTransition('oldImg', 'newImg');

    const r1 = renderer.update(40); // slow frame (>33ms)
    expect(r1.state).toBe('fading');

    const r2 = renderer.update(40);
    expect(r2.state).toBe('fading');

    const r3 = renderer.update(40); // 3rd slow frame → trigger
    expect(r3.state).toBe('idle');
    expect(r3.complete).toBe(true);
    expect(r3.oldAlpha).toBe(1);
    expect(r3.newAlpha).toBe(1);
  });

  test('one good frame resets the low-fps counter', () => {
    renderer.startTransition('oldImg', 'newImg');

    renderer.update(40); // slow — count=1
    renderer.update(40); // slow — count=2
    renderer.update(16); // good — count=0 (reset)
    renderer.update(40); // slow — count=1
    renderer.update(40); // slow — count=2

    const r = renderer.update(40); // slow — count=3 → trigger
    expect(r.state).toBe('idle');
    expect(r.complete).toBe(true);
  });

  /* ── Completion ── */

  test('completes naturally after accumulated dt reaches duration', () => {
    renderer.startTransition('old', 'new');
    renderer.update(100);
    renderer.update(100);
    const mid = renderer.update(100);
    expect(mid.state).toBe('idle');
    expect(mid.complete).toBe(true);
  });

  test('extra calls after completion stay idle', () => {
    renderer.startTransition('old', 'new');
    renderer.update(300);
    const extra = renderer.update(100);
    expect(extra.state).toBe('idle');
    expect(extra.complete).toBe(false);
  });

  /* ── Restart while active ── */

  test('calling startTransition mid-fade resets progress', () => {
    renderer.startTransition('old1', 'new1');
    renderer.update(200); // 200ms in

    renderer.startTransition('old2', 'new2');
    const state = renderer.update(0);
    // Should be at start of new transition
    expect(state.state).toBe('fading');
    expect(state.oldAlpha).toBeCloseTo(1, 2);
    expect(state.newAlpha).toBeCloseTo(0, 2);
  });
});
