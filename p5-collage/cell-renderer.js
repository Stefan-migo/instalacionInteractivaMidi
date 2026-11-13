function getCombinedFilters(filterType) {
  const map = {
    sepia: 'sepia(0.85) contrast(1.1)',
    grayscale: 'grayscale(1.0) contrast(1.3)',
    cyanotype: 'sepia(0.4) saturate(1.9) hue-rotate(180deg) brightness(0.85) contrast(1.2)',
    polaroid: 'contrast(1.2) saturate(0.6) brightness(1.15) sepia(0.1)',
    vintage: 'sepia(0.35) saturate(0.7) contrast(0.95) brightness(1.03)',
    none: '',
  };
  return map[filterType] || '';
}

/**
 * Draw an image with flip transforms and opacity.
 * Uses p5 push/pop/translate/scale globals and drawingContext.
 *
 * Uses CONTAIN mode — the image is ALWAYS fully visible, never cropped.
 * If the cell aspect ratio matches the image (via adaptCellToImage),
 * there is no letterboxing.
 */
function drawImg(img, flipH, flipV, x, y, w, h, opacity, filterType, inkRatio, authored) {
  if (!img) return;
  push();
  translate(x + w / 2, y + h / 2);
  if (flipH) scale(-1, 1);
  if (flipV) scale(1, -1);
  const filterStr = getCombinedFilters(filterType);
  if (filterStr) drawingContext.filter = filterStr;
  drawingContext.globalAlpha = opacity;

  // Object-fit contain: scale source to fit INSIDE destination (no cropping)
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw > 0 && ih > 0) {
    const fitScale = Math.min(w / iw, h / ih);
    let dw = iw * fitScale, dh = ih * fitScale;
    const config = typeof CONFIG !== 'undefined' ? CONFIG : require('./config').CONFIG;
    const cellArea = w * h;
    const drawnArea = dw * dh;
    if (Number.isFinite(inkRatio) && inkRatio > 0 && cellArea > 0 && drawnArea > 0) {
      if (authored) {
        if (inkRatio * drawnArea < config.minInkCoverage * cellArea && !img._warnedAuthoredInkFloor) {
          console.warn('Authored fragment size is below the ink coverage floor:', inkRatio * drawnArea, config.minInkCoverage * cellArea);
          img._warnedAuthoredInkFloor = true;
        }
      } else {
        const needed = Math.sqrt((config.minInkCoverage * cellArea) / (inkRatio * drawnArea));
        const multiplier = Math.min(config.maxInkOverflow, Math.max(1, needed));
        dw *= multiplier;
        dh *= multiplier;
      }
    }
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    drawingContext.drawImage(img, 0, 0, iw, ih, -w / 2 + dx, -h / 2 + dy, dw, dh);
  } else {
    drawingContext.drawImage(img, -w / 2, -h / 2, w, h);
  }

  drawingContext.globalAlpha = 1;
  if (filterStr) drawingContext.filter = 'none';
  pop();
}

/**
 * The operator's general scale, so an authored class never disables the
 * scatter slider: the class sets the base ink mass and this multiplies it.
 */
function generalScale() {
  const raw = typeof CONFIG !== 'undefined' && CONFIG ? Number(CONFIG.scatterScale) : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

/**
 * Place one axis of a fragment from the composition percentage.
 *
 * The percentage is measured in the fragment's own units, so the point where a
 * fragment starts to hang over the canvas is the same for every size: inside the
 * band it stays contained (flush at the band edge), outside it the overhang grows
 * as a fraction of the fragment until half of it is over the canvas. The old rule
 * centred the layout box and let the fragment's own half-width decide, which is
 * why only big fragments ever reached the edge.
 */
function axisAnchor(u, size, extent, band, minVisible) {
  const maxOverhang = Math.max(0, 1 - minVisible) * size;
  let position;
  if (u >= band) {
    const t = (u - band) / (1 - band);
    position = extent - size + Math.min(maxOverhang, t * size / 2);
  } else if (u <= 1 - band) {
    const t = (1 - band - u) / (1 - band);
    position = -Math.min(maxOverhang, t * size / 2);
  } else {
    const t = (u - (1 - band)) / (2 * band - 1);
    position = t * (extent - size);
  }
  const keep = size * minVisible;
  return Math.max(keep - size, Math.min(extent - keep, position));
}

/** Resolve the engine's composition percentage onto a drawn fragment's rect. */
function resolveAnchor(anchor, width, height) {
  if (!anchor || !(width > 0) || !(height > 0)) return null;
  const band = Number.isFinite(anchor.band) ? anchor.band : 0.75;
  const minVisible = Number.isFinite(anchor.minVisible) ? anchor.minVisible : 0.25;
  if (!(anchor.canvasW > 0) || !(anchor.canvasH > 0)) return null;
  return {
    x: axisAnchor(anchor.xPct, width, anchor.canvasW, band, minVisible),
    y: axisAnchor(anchor.yPct, height, anchor.canvasH, band, minVisible),
  };
}

/**
 * Adapt a cell's dimensions to match the displayed image's aspect ratio.
 *
 * Fits the image INSIDE the original layout bounds (contain mode),
 * then updates cellState.pos.w/h.
 * Call after setting/replacing a cell's image.
 *
 * @param {object} cellState — the cell state object with .img and .pos
 * @param {string} [centerAt='current'] — 'current' keeps the cell where it is
 *        (respects user drags); 'layout' centers at the layout budget position
 *        (used when the layout preset changes).
 * @returns {boolean} true if adapted, false if no image or invalid sizes
 */
function adaptCellToImage(cellState, centerAt) {
  const img = cellState.img;
  if (!img) return false;

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih || iw <= 0 || ih <= 0) return false;

  // Use the original layout dimensions as the bounding budget
  const origW = cellState._layoutW !== undefined ? cellState._layoutW : cellState.pos.w;
  const origH = cellState._layoutH !== undefined ? cellState._layoutH : cellState.pos.h;
  if (origW <= 0 || origH <= 0) return false;

  // Contain: fit the image inside the layout budget
  const fitScale = Math.min(origW / iw, origH / ih);
  let newW = Math.round(iw * fitScale);
  let newH = Math.round(ih * fitScale);
  const key = cellState.currentImageFile && typeof imageLoader !== 'undefined' && imageLoader.fileToKey && imageLoader.fileToKey[cellState.currentImageFile];
  const targetInk = key && typeof SizeClasses !== 'undefined' && SizeClasses.getAuthoredSize(sizeClassesData, key);
  if (targetInk) {
    const authored = SizeClasses.getAuthoredDrawSize(sizeClassesData, key, iw, ih, 1920, 1080, imageLoader.getInkRatio(cellState.currentImageFile));
    if (authored) {
      const jitter = 0.98 + Math.random() * 0.04;
      const composed = jitter * generalScale();
      newW = Math.round(authored.width * composed); newH = Math.round(authored.height * composed);
      cellState._authoredSize = true;
    }
  } else cellState._authoredSize = false;
  if (newW <= 0 || newH <= 0) return false;

  // The composition percentage places the drawn fragment, not the layout box, so
  // a fragment that shrank (a smaller class, or the general scale down) still
  // hangs over the edge its percentage asked for. A fragment the operator dragged
  // keeps its own centre.
  const anchored = cellState._anchor && !cellState._userMoved
    ? resolveAnchor(cellState._anchor, newW, newH)
    : null;
  if (anchored) {
    cellState.pos.x = Math.round(anchored.x);
    cellState.pos.y = Math.round(anchored.y);
    cellState.pos.w = newW;
    cellState.pos.h = newH;
    return true;
  }

  // Center at the right position:
  //  'layout'  → center within the layout budget (for preset changes)
  //  'current' → keep current center (respects user drags on image cycle)
  let cx, cy;
  if (centerAt === 'layout') {
    cx = cellState._layoutX + cellState._layoutW / 2;
    cy = cellState._layoutY + cellState._layoutH / 2;
  } else {
    cx = cellState.pos.x + cellState.pos.w / 2;
    cy = cellState.pos.y + cellState.pos.h / 2;
  }

  cellState.pos.x = Math.round(cx - newW / 2);
  cellState.pos.y = Math.round(cy - newH / 2);
  cellState.pos.w = newW;
  cellState.pos.h = newH;

  return true;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawImg, getCombinedFilters, adaptCellToImage, resolveAnchor };
}
