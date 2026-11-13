'use strict';

// Calibrated starting point; these values are tunable in images/sizes.json without touching code.
function validateSizes(data, knownImageKeys) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid sizes: expected an object');
  if (data.version !== 1) throw new Error('Invalid sizes: unsupported version');
  const allowedClasses = ['S', 'M', 'L', 'XL'];
  if (!data.classes || typeof data.classes !== 'object' || Array.isArray(data.classes) ||
      allowedClasses.some(name => !Object.prototype.hasOwnProperty.call(data.classes, name)) ||
      Object.keys(data.classes).some(name => !allowedClasses.includes(name))) {
    throw new Error('Invalid sizes: classes must define S, M, L, and XL only');
  }
  for (const [name, area] of Object.entries(data.classes)) {
    if (!name || typeof area !== 'number' || !Number.isFinite(area) || area <= 0 || area > 1) {
      throw new Error(`Invalid sizes: class ${name} must map to an area fraction in (0, 1]`);
    }
  }
  if (!data.assignments || typeof data.assignments !== 'object' || Array.isArray(data.assignments)) {
    throw new Error('Invalid sizes: assignments must be a map');
  }
  const known = knownImageKeys && new Set(knownImageKeys);
  for (const [imageKey, className] of Object.entries(data.assignments)) {
    if (known && !known.has(imageKey)) throw new Error(`Invalid sizes: unknown image ${imageKey}`);
    if (!Object.prototype.hasOwnProperty.call(data.classes, className)) throw new Error(`Invalid sizes: unknown class ${className}`);
  }
  return data;
}

function loadSizeClasses(data, knownImageKeys) {
  return validateSizes(data, knownImageKeys);
}

function getAuthoredSize(data, imageKey) {
  const className = data && data.assignments && data.assignments[imageKey];
  return className && data.classes && Object.prototype.hasOwnProperty.call(data.classes, className)
    ? data.classes[className]
    : null;
}

// Shared by the authoring preview and projector: target ink fraction becomes a frame area.
function getAuthoredDrawSize(data, imageKey, imageWidth, imageHeight, canvasWidth, canvasHeight, inkRatio) {
  const targetInk = getAuthoredSize(data, imageKey);
  if (!targetInk || !(imageWidth > 0) || !(imageHeight > 0) || !(canvasWidth > 0) || !(canvasHeight > 0) || !(inkRatio > 0)) return null;
  const area = targetInk * canvasWidth * canvasHeight / inkRatio;
  const width = Math.sqrt(area * imageWidth / imageHeight);
  return { width, height: area / width };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadSizeClasses, validateSizes, getAuthoredSize, getAuthoredDrawSize };
} else if (typeof window !== 'undefined') {
  window.SizeClasses = { loadSizeClasses, validateSizes, getAuthoredSize, getAuthoredDrawSize };
}
