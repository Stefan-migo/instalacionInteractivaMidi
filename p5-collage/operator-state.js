(function (root) {
  'use strict';
  var PRESETS = ['scatter', 'spiral', 'polaroid-stack', 'neat-grid', 'vignette', 'random'];
  function apply(state, callbacks) {
    var applied = {};
    if (!state || !callbacks) return applied;
    if (Number.isFinite(state.scatterScale) && state.scatterScale >= 0.4 && state.scatterScale <= 1.8 && callbacks.setScatterScale) { callbacks.setScatterScale(state.scatterScale); applied.scatterScale = state.scatterScale; }
    if (Number.isFinite(state.noiseIntensity) && state.noiseIntensity >= 0 && state.noiseIntensity <= 1 && callbacks.setNoiseIntensity) { callbacks.setNoiseIntensity(state.noiseIntensity); applied.noiseIntensity = state.noiseIntensity; }
    if (PRESETS.indexOf(state.preset) !== -1 && callbacks.setPreset) { callbacks.setPreset(state.preset); applied.preset = state.preset; }
    if (typeof state.cycleRunning === 'boolean' && callbacks.setCycle) { callbacks.setCycle(state.cycleRunning); applied.cycleRunning = state.cycleRunning; }
    return applied;
  }
  var api = { apply: apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
