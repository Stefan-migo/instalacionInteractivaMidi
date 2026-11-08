/**
 * MIDI brand mark, painted onto the collage canvas.
 *
 * It used to be a DOM overlay above the canvas, so no fragment could ever cover
 * it. Painting it in the canvas composite puts it in its proper place: on the
 * paper, underneath every photo.
 *
 * Geometry is inline path data (the Logo/ assets are not shipped), filled with
 * the `--mark-on-canvas` colour, which never follows the light theme because the
 * collage field is always near-black.
 */

const MARK_VIEWBOX = { width: 1890.67, height: 620 };

const MARK_PATH =
  'M37 0h462v192h-462zM535 0h193v192h-193zM0 192h193v428h-193zM268 192h192v428h-192z' +
  'M536 228h192v1h-192zM535 229h193v391h-193zM878 136.4h49.9758v49.9758h-49.9758z' +
  'M1075.27 136.4h49.9758v49.9758h-49.9758zM1198.9 136.4h148.612v49.9758h-148.612z' +
  'M1421.16 136.4h198.588v24.9879h-198.588zM1742.05 136.4h148.612v49.9758h-148.612z' +
  'M1421.16 161.388h223.576v24.9879h-223.576zM878 186.376h74.9636v24.9879h-74.9636z' +
  'M1050.28 186.376h74.9636v24.9879h-74.9636zM1247.56 186.376h51.2909v247.248h-51.2909z' +
  'M1421.16 186.376h49.9758v247.248h-49.9758zM1593.44 186.376h74.9636v24.9879h-74.9636z' +
  'M1792.03 186.376h49.9758v247.248h-49.9758zM878 211.364h98.6364v23.6727h-98.6364z' +
  'M1026.61 211.364h98.6364v23.6727h-98.6364zM1618.43 211.364h49.9758v197.273h-49.9758z' +
  'M878 235.036h247.248v26.303h-247.248zM878 261.339h49.9758v222.261h-49.9758z' +
  'M951.648 261.339h99.9515v23.6727h-99.9515zM1075.27 261.339h49.9758v222.261h-49.9758z' +
  'M952.964 285.012h97.3212v1.31515h-97.3212zM976.636 286.327h49.9758v48.6606h-49.9758z' +
  'M1594.76 408.636h73.6485v1.31515h-73.6485zM1593.44 409.952h74.9636v23.6727h-74.9636z' +
  'M1198.9 433.624h148.612v49.9758h-148.612zM1421.16 433.624h247.248v1.31515h-247.248z' +
  'M1742.05 433.624h148.612v49.9758h-148.612zM1421.16 434.939h223.576v23.6727h-223.576z' +
  'M1421.16 458.612h198.588v24.9879h-198.588z';

let _cachedPath = null;

function getMarkPath(pathFactory) {
  if (pathFactory) return pathFactory(MARK_PATH);
  if (!_cachedPath && typeof Path2D !== 'undefined') _cachedPath = new Path2D(MARK_PATH);
  return _cachedPath || null;
}

/**
 * Paint the mark centred on a canvas, preserving the viewBox aspect ratio.
 *
 * @param {CanvasRenderingContext2D} ctx — the p5 drawingContext
 * @param {object} [options]
 * @param {number} options.width    — canvas width in px (required)
 * @param {number} options.height   — canvas height in px (required)
 * @param {number} [options.opacity=0.6]
 * @param {string} [options.color='#ffffff'] — pass `--mark-on-canvas`
 * @param {number} [options.widthRatio=0.4]  — fraction of the canvas width
 * @param {number} [options.maxWidth=780]    — hard ceiling in px
 * @param {function} [options.pathFactory]   — injection point for tests
 * @returns {boolean} whether anything was painted
 */
function drawBrandMark(ctx, options) {
  const opts = options || {};
  const width = opts.width;
  const height = opts.height;
  if (!ctx || !(width > 0) || !(height > 0)) return false;

  const widthRatio = opts.widthRatio === undefined ? 0.4 : opts.widthRatio;
  const maxWidth = opts.maxWidth === undefined ? 780 : opts.maxWidth;
  const opacity = opts.opacity === undefined ? 0.6 : opts.opacity;
  const color = opts.color || '#ffffff';

  const targetWidth = Math.min(width * widthRatio, maxWidth);
  const scale = targetWidth / MARK_VIEWBOX.width;
  const markHeight = MARK_VIEWBOX.height * scale;

  const path = getMarkPath(opts.pathFactory);
  if (!path) return false;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.translate((width - targetWidth) / 2, (height - markHeight) / 2);
  ctx.scale(scale, scale);
  ctx.fill(path);
  ctx.restore();
  return true;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawBrandMark, MARK_PATH, MARK_VIEWBOX };
}
