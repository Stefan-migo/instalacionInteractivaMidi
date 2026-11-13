const CONFIG = {
  totalSlots: 30,
  cellSpacing: 4,
  movementThreshold: 0.5,
  transitionDuration: 300,
  dtwThreshold: 0.3,
  dtwDownsampleHz: 10,
  gestureDebounceMs: 1000,
  imageCacheSize: 48,
  minInkCoverage: 0.35,
  maxInkOverflow: 4.25,
  bridgePort: 8080,
  sensorSendInterval: 33,
  fullscreenBg: '#000000',
  defaultPreset: 'scatter',
  presetList: ['scatter', 'spiral', 'polaroid-stack', 'neat-grid', 'vignette', 'random'],
  scatterScale: 1.0,
  // Fragments are allowed to hang off the canvas edge, which is what makes the
  // collage read as cut paper instead of a scrapbook pinned inside a frame.
  // presetEdgeBleed is how far a centre may sit outside, as a canvas fraction;
  // presetMinVisible is how much of a fragment always stays on screen.
  presetEdgeBleed: 0.10,
  presetMinVisible: 0.25,
  filterMap: {
    sepia: 'sepia(0.85) contrast(1.1)',
    grayscale: 'grayscale(1.0) contrast(1.3)',
    cyanotype: 'sepia(0.4) saturate(1.9) hue-rotate(180deg) brightness(0.85) contrast(1.2)',
    polaroid: 'contrast(1.2) saturate(0.6) brightness(1.15) sepia(0.1)',
    vintage: 'sepia(0.35) saturate(0.7) contrast(0.95) brightness(1.03)',
    none: '',
  },
  // The projector canvas is the identity paper tone, flat: fragments read the
  // way they do on the phone client. 'shader-paper' + a non-zero noiseIntensity
  // restores the paper texture if the installation wants it back.
  noiseIntensity: 0,
  canvasBgStyle: 'solid',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG };
}
