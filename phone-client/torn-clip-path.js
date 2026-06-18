/**
 * Generates a CSS clip-path polygon with pseudo-random torn edges.
 * Mirrors the p5.js generateTornBorder() LCG algorithm.
 *
 * @param {number} segments - Number of vertices per side (6 recommended)
 * @param {number} jitter - Maximum deviation as percentage (3 recommended)
 * @param {number} seed - Seed for deterministic RNG (1918 + index recommended)
 * @returns {string} CSS polygon() value
 */
function tornClipPath(segments, jitter, seed) {
  var s = seed | 0;
  var rng = function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  var pts = [];

  // Top edge (left to right)
  for (var i = 0; i < segments; i++) {
    pts.push(
      ((i / segments) * 100 + (rng() - 0.5) * jitter).toFixed(1) + '% ' +
      ((rng() - 0.5) * jitter / 2).toFixed(1) + '%'
    );
  }

  // Right edge (top to bottom)
  for (var i = 0; i < segments; i++) {
    pts.push(
      (100 + (rng() - 0.5) * jitter / 2).toFixed(1) + '% ' +
      ((i / segments) * 100 + (rng() - 0.5) * jitter).toFixed(1) + '%'
    );
  }

  // Bottom edge (right to left)
  for (var i = 0; i < segments; i++) {
    pts.push(
      ((1 - i / segments) * 100 + (rng() - 0.5) * jitter).toFixed(1) + '% ' +
      (100 + (rng() - 0.5) * jitter / 2).toFixed(1) + '%'
    );
  }

  // Left edge (bottom to top)
  for (var i = 0; i < segments; i++) {
    pts.push(
      ((rng() - 0.5) * jitter / 2).toFixed(1) + '% ' +
      ((1 - i / segments) * 100 + (rng() - 0.5) * jitter).toFixed(1) + '%'
    );
  }

  return 'polygon(' + pts.join(', ') + ')';
}

// CommonJS export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = tornClipPath;
}
