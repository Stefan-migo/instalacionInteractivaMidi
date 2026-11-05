/**
 * Tests for sketch.js createRenderer().handleAction behavior.
 *
 * These tests exercise the same logic implemented in sketch.js's handleAction
 * by creating a renderer that mirrors the production implementation.
 * Changes made here MUST be mirrored in sketch.js handleAction.
 */

const CONFIG = {
  filterMap: { sepia: 'sepia', grayscale: 'grayscale', cyanotype: 'cyanotype', polaroid: 'polaroid', vintage: 'vintage', none: 'none' },
};

function createTestRenderer() {
  const state = { cellStates: {} };
  return {
    cellStates: state.cellStates,
    initCell(slot, cell) {
      state.cellStates[slot] = {
        cell,
        pos: { x: 0, y: 0, w: 400, h: 300, zIndex: slot, rotation: 0 },
        img: null,
        opacity: 1.0,
        filterType: 'none',
        borderStyle: 'torn',
        phoneConnected: false,
        currentImageFile: cell && cell.imageFile,
      };
    },
    handleAction(slot, action, imgLoader, payload) {
      const s = state.cellStates[slot];
      if (!s) return;
      switch (action) {
        case 'opacity':
          s.opacity = Math.max(0, Math.min(1, payload.value / 100));
          break;
        case 'rotation':
          s.pos.rotation = payload.value;
          break;
        case 'filter': {
          const filters = Object.keys(CONFIG.filterMap);
          s.filterType = (filters.includes(payload.value)) ? payload.value : 'none';
          break;
        }
        case 'move':
          s.pos.x += payload.dx || 0;
          s.pos.y += payload.dy || 0;
          s.pos.x = Math.max(0, Math.min(1920 - s.pos.w, s.pos.x));
          s.pos.y = Math.max(0, Math.min(1080 - s.pos.h, s.pos.y));
          break;
      }
    },
  };
}

describe('Renderer handleAction — value actions', () => {
  let renderer;

  beforeEach(() => {
    renderer = createTestRenderer();
    renderer.initCell(0, { slot: 0, imageFile: 'test.jpg' });
  });

  describe('opacity', () => {
    test('sets opacity from payload value (0-100 scaled to 0-1)', () => {
      renderer.handleAction(0, 'opacity', null, { value: 75 });
      expect(renderer.cellStates[0].opacity).toBe(0.75);
    });

    test('clamps opacity to [0, 1]', () => {
      renderer.handleAction(0, 'opacity', null, { value: 150 });
      expect(renderer.cellStates[0].opacity).toBe(1.0);

      renderer.handleAction(0, 'opacity', null, { value: -50 });
      expect(renderer.cellStates[0].opacity).toBe(0);
    });
  });

  describe('rotation', () => {
    test('sets rotation from payload value directly (signed)', () => {
      renderer.handleAction(0, 'rotation', null, { value: 45 });
      expect(renderer.cellStates[0].pos.rotation).toBe(45);
    });

    test('accepts negative rotation values', () => {
      renderer.handleAction(0, 'rotation', null, { value: -90 });
      expect(renderer.cellStates[0].pos.rotation).toBe(-90);
    });

    test('accepts values beyond ±180 (values stored verbatim, normalized at read)', () => {
      renderer.handleAction(0, 'rotation', null, { value: 270 });
      expect(renderer.cellStates[0].pos.rotation).toBe(270);
    });

    test('zero rotation stays centered', () => {
      renderer.handleAction(0, 'rotation', null, { value: 0 });
      expect(renderer.cellStates[0].pos.rotation).toBe(0);
    });
  });

  describe('filter', () => {
    test('sets filterType to valid filter name', () => {
      renderer.handleAction(0, 'filter', null, { value: 'sepia' });
      expect(renderer.cellStates[0].filterType).toBe('sepia');
    });

    test('rejects invalid filter name (falls back to none)', () => {
      renderer.handleAction(0, 'filter', null, { value: 'blur' });
      expect(renderer.cellStates[0].filterType).toBe('none');
    });
  });

  describe('move', () => {
    test('moves cell by dx/dy delta', () => {
      renderer.cellStates[0].pos.x = 100;
      renderer.cellStates[0].pos.y = 200;
      renderer.handleAction(0, 'move', null, { dx: 50, dy: -30 });
      expect(renderer.cellStates[0].pos.x).toBe(150);
      expect(renderer.cellStates[0].pos.y).toBe(170);
    });

    test('clamps position to canvas bounds [0, 0, 1920, 1080]', () => {
      renderer.cellStates[0].pos = { x: 0, y: 0, w: 400, h: 300, zIndex: 0, rotation: 0 };
      // Left/top edge
      renderer.handleAction(0, 'move', null, { dx: -100, dy: -100 });
      expect(renderer.cellStates[0].pos.x).toBe(0);
      expect(renderer.cellStates[0].pos.y).toBe(0);

      // Bottom/right edge
      renderer.handleAction(0, 'move', null, { dx: 2000, dy: 1000 });
      expect(renderer.cellStates[0].pos.x).toBe(1520); // 1920 - 400
      expect(renderer.cellStates[0].pos.y).toBe(780);  // 1080 - 300
    });
  });

  describe('rotation normalization (state migration)', () => {
    /**
     * Normalize stored rotation from legacy 0-360 range to -180..+180.
     * Mirrors the logic in showPerCellEditor().
     */
    function normalizeRotation(rot) {
      rot = rot || 0;
      if (rot > 180) rot -= 360;
      return rot;
    }

    test('values ≤ 180 remain unchanged', () => {
      expect(normalizeRotation(0)).toBe(0);
      expect(normalizeRotation(45)).toBe(45);
      expect(normalizeRotation(180)).toBe(180);
    });

    test('values > 180 normalize to -180..+180', () => {
      expect(normalizeRotation(270)).toBe(-90);
      expect(normalizeRotation(360)).toBe(0);
      expect(normalizeRotation(359)).toBe(-1);
    });

    test('null or undefined defaults to 0', () => {
      expect(normalizeRotation(null)).toBe(0);
      expect(normalizeRotation(undefined)).toBe(0);
    });

    test('negative values remain unchanged', () => {
      expect(normalizeRotation(-90)).toBe(-90);
      expect(normalizeRotation(-180)).toBe(-180);
    });
  });
});
