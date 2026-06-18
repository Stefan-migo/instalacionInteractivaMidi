/**
 * LayoutPresetEngine — exact port of tempExample/src/data.ts generateLayout()
 *
 * 6 presets (scatter, spiral, polaroid-stack, neat-grid, vignette, random)
 * produce pixel positions for ALL cells using the same algorithms as the
 * Gemini reference app. Uses Math.random() for true randomness per item.
 */
class LayoutPresetEngine {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.currentPreset = 'scatter';
    this._presets = ['scatter', 'spiral', 'polaroid-stack', 'neat-grid', 'vignette', 'random'];
    this.scatterScale = 1.0;
  }

  getPresets() {
    return [...this._presets];
  }

  setPreset(name) {
    if (this._presets.includes(name)) {
      this.currentPreset = name;
    }
  }

  getCurrentPreset() {
    return this.currentPreset;
  }

  /**
   * Compute positions for ALL cells using exact tempExample algorithms.
   * @param {Array} cells - Array of cell objects with {slot, w, h, ...}
   * @param {string} [presetOverride]
   * @returns {Array} [{slot, x, y, w, h, rotation, scale, opacity, filterType, blendMode, zIndex}]
   */
  compute(cells, presetOverride) {
    if (!cells || cells.length === 0) return [];
    const preset = presetOverride || this.currentPreset;
    if (!this._presets.includes(preset)) return [];

    return this._generateLayout(cells, preset);
  }

  /* ── Exact port of data.ts generateLayout() ── */

  _generateLayout(cells, preset) {
    const randSpread = (min, max) => Math.random() * (max - min) + min;
    const filterChoices = ['vintage', 'vintage', 'sepia', 'grayscale', 'cyanotype', 'polaroid', 'none'];
    const blendChoices = ['normal', 'normal', 'normal', 'multiply', 'darken', 'overlay', 'luminosity'];

    return cells.map((cell, i) => {
      // --- Defaults (same as tempExample) ---
      let xPct = 50;
      let yPct = 50;
      let rotation = 0;
      let scale = 1.0;
      let opacity = 0.85;

      // --- Preset-specific positioning (EXACT ranges from data.ts) ---
      switch (preset) {
        case 'scatter':
          // Full frame coverage with comfortable margin
          xPct = randSpread(12, 88);
          yPct = randSpread(12, 88);
          rotation = randSpread(-35, 35);
          scale = randSpread(0.7, 1.25) * this.scatterScale;
          opacity = randSpread(0.8, 0.98);
          break;

        case 'spiral': {
          // Spiral radiating outward
          const angle = i * 0.45;
          const radius = 6 + (i * 1.1) * this.scatterScale;
          xPct = 50 + Math.cos(angle) * radius;
          yPct = 50 + Math.sin(angle) * radius;
          rotation = (angle * 180) / Math.PI + randSpread(-15, 15);
          scale = randSpread(0.65, 1.15) * this.scatterScale;
          opacity = randSpread(0.82, 0.96);
          break;
        }

        case 'polaroid-stack':
          // Focused closely in the center, simulating a messy pile of photos
          xPct = randSpread(30, 70);
          yPct = randSpread(28, 72);
          rotation = randSpread(-45, 45);
          scale = randSpread(0.9, 1.3) * this.scatterScale;
          opacity = randSpread(0.88, 1.0);
          break;

        case 'neat-grid': {
          // 5x6 grid spaced nicely (exact cols=6 from tempExample)
          const cols = 6;
          const row = Math.floor(i / cols);
          const col = i % cols;
          xPct = 10 + (col * 16) + randSpread(-2, 2);
          yPct = 12 + (row * 16) + randSpread(-2, 2);
          rotation = randSpread(-5, 5);
          scale = randSpread(0.75, 0.95) * this.scatterScale;
          opacity = 0.95;
          break;
        }

        case 'vignette': {
          // Placed primarily around the borders, leaving the center core open
          const angle = Math.random() * Math.PI * 2;
          const dist = randSpread(30, 44) * this.scatterScale;
          xPct = 50 + Math.cos(angle) * dist;
          yPct = 50 + Math.sin(angle) * dist;
          rotation = (angle * 180) / Math.PI + 90 + randSpread(-20, 20);
          scale = randSpread(0.8, 1.2) * this.scatterScale;
          opacity = randSpread(0.75, 0.95);
          break;
        }

        case 'random':
        default:
          // Fully chaotic
          xPct = randSpread(5, 95);
          yPct = randSpread(5, 95);
          rotation = randSpread(-180, 180);
          scale = randSpread(0.5, 1.4) * this.scatterScale;
          opacity = randSpread(0.6, 1.0);
          break;
      }

      // Clamp to [2, 98] (same as tempExample)
      xPct = Math.max(2, Math.min(98, xPct));
      yPct = Math.max(2, Math.min(98, yPct));

      // Convert percentage center → pixel top-left
      const displayW = cell.w * scale;
      const displayH = cell.h * scale;
      const centerX = (xPct / 100) * this.canvasW;
      const centerY = (yPct / 100) * this.canvasH;
      const x = Math.max(0, centerX - displayW / 2);
      const y = Math.max(0, centerY - displayH / 2);

      // Random filters & blend (exact weighted distribution from tempExample)
      const filterType = filterChoices[Math.floor(Math.random() * filterChoices.length)];
      const blendMode = blendChoices[Math.floor(Math.random() * blendChoices.length)];

      return {
        slot: cell.slot,
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(Math.max(20, displayW)),
        h: Math.round(Math.max(20, displayH)),
        rotation: Math.round(rotation),
        scale,
        opacity,
        zIndex: i + 1, // position-based, same as tempExample
        filterType,
        blendMode,
      };
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LayoutPresetEngine };
}
