/**
 * drag-manager.js — Drag state machine for p5 collage cells.
 *
 * Manages mouse/touch drag with 5px threshold to distinguish click from drag.
 * Moves cell position in real time, clamped to canvas bounds.
 *
 * Exposed globally: hitTest, startDrag, updateDrag, endDrag, getDragState
 * Also exports via CommonJS for testing.
 *
 * Dependencies (globals): deviceManager, collageLayout, CONFIG
 */
(function () {
  'use strict';

  var DRAG_THRESHOLD = 5; // px

  var _dragState = {
    slot: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
  };

  /**
   * Test if point (x, y) hits any cell, iterating activeSlots in reverse z-order.
   * @param {number} x - Canvas X coordinate
   * @param {number} y - Canvas Y coordinate
   * @returns {number} slot number, or -1 if no hit
   */
  function hitTest(x, y) {
    if (!deviceManager || !collageLayout) return -1;

    // Get sorted slots (ascending z-order) and iterate in reverse
    var slots = (typeof getSortedSlots === 'function')
      ? getSortedSlots()
      : [];

    for (var i = slots.length - 1; i >= 0; i--) {
      var slot = slots[i].slot;
      var s = deviceManager.renderer.cellStates[slot];
      if (!s || !s.img) continue;
      if (s.opacity <= 0) continue; // hidden cells can't be hit

      var pos = s.pos;
      if (x >= pos.x && x <= pos.x + pos.w && y >= pos.y && y <= pos.y + pos.h) {
        return slot;
      }
    }

    return -1;
  }

  /**
   * Begin a drag operation on the given slot.
   * @param {number} slot
   * @param {number} mx - Mouse X at press
   * @param {number} my - Mouse Y at press
   */
  function startDrag(slot, mx, my) {
    if (slot === null || slot === undefined || slot < 0) return;
    var s = deviceManager.renderer.cellStates[slot];
    if (!s) return;

    _dragState.slot = slot;
    _dragState.startX = mx;
    _dragState.startY = my;
    _dragState.offsetX = mx - s.pos.x;
    _dragState.offsetY = my - s.pos.y;
    _dragState.isDragging = false;
  }

  /**
   * Update drag position (call from mouseDragged / touchMoved).
   * Moves cell to follow cursor, clamped to canvas bounds.
   * Activates drag mode once threshold is exceeded.
   * @param {number} mx - Current mouse X
   * @param {number} my - Current mouse Y
   */
  function updateDrag(mx, my) {
    if (_dragState.slot === null || _dragState.slot < 0) return;

    // Check drag threshold
    var dx = mx - _dragState.startX;
    var dy = my - _dragState.startY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < DRAG_THRESHOLD) {
      return; // below threshold, not dragging yet
    }

    _dragState.isDragging = true;

    var s = deviceManager.renderer.cellStates[_dragState.slot];
    if (!s) return;

    // Calculate new position from mouse with offset
    var newX = mx - _dragState.offsetX;
    var newY = my - _dragState.offsetY;

    // Clamp to canvas bounds
    var canvasW = 1920;
    var canvasH = 1080;
    if (typeof CONFIG !== 'undefined') {
      // CONFIG doesn't have canvas dimensions directly, use constants
    }

    newX = Math.max(0, Math.min(canvasW - s.pos.w, newX));
    newY = Math.max(0, Math.min(canvasH - s.pos.h, newY));

    s.pos.x = newX;
    s.pos.y = newY;
  }

  /**
   * End a drag operation.
   * @returns {{ wasDrag: boolean, slot: number }}
   */
  function endDrag() {
    var result = {
      wasDrag: _dragState.isDragging,
      slot: _dragState.slot,
    };

    _dragState.slot = null;
    _dragState.startX = 0;
    _dragState.startY = 0;
    _dragState.offsetX = 0;
    _dragState.offsetY = 0;
    _dragState.isDragging = false;

    return result;
  }

  /**
   * Get current drag state (read-only snapshot).
   * @returns {object}
   */
  function getDragState() {
    return {
      slot: _dragState.slot,
      startX: _dragState.startX,
      startY: _dragState.startY,
      offsetX: _dragState.offsetX,
      offsetY: _dragState.offsetY,
      isDragging: _dragState.isDragging,
    };
  }

  // ── Public API (browser) ──

  if (typeof window !== 'undefined') {
    window.hitTest = hitTest;
    window.startDrag = startDrag;
    window.updateDrag = updateDrag;
    window.endDrag = endDrag;
    window.getDragState = getDragState;
  }

  // ── CommonJS export for testing ──
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { hitTest, startDrag, updateDrag, endDrag, getDragState };
  }
})();
