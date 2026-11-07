/**
 * Cell image application — the bridge between the deck's assignment of an
 * image file to a cell and the cell actually showing it.
 *
 * Loading is asynchronous: a file claimed from the deck may not be decoded yet.
 * The rule this module exists to enforce is that a cell NEVER loses the image it
 * is already showing while the next one loads. It keeps the previous image until
 * the new bitmap is available, then commits in one step (transition, re-adapt,
 * announce) so the viewer never sees an empty fragment.
 *
 * Commits are token-guarded: if a second image is requested while the first is
 * still loading, the older load resolving late must not overwrite the newer one.
 */

function createImageApplier(ctx) {
  const { state, imageLoader, adaptCellToImage, sendImageUpdate } = ctx;
  if (!state || !imageLoader) throw new Error('createImageApplier requires state and imageLoader');

  function commit(slot, file, img) {
    const s = state.cellStates[slot];
    if (!s || !img || s.currentImageFile === file) return s ? s.img || null : null;

    const previousFile = s.currentImageFile;
    const previousImg = s.img;

    s.img = img;
    s.currentImageFile = file;
    s._pendingImageFile = null;

    if (typeof imageLoader.pin === 'function') imageLoader.pin(file);
    if (previousFile && previousFile !== file && typeof imageLoader.unpin === 'function') {
      imageLoader.unpin(previousFile);
    }

    if (previousImg && previousImg !== img) {
      s._oldImg = previousImg;
      s.transition.startTransition(previousImg, img);
    }

    if (typeof adaptCellToImage === 'function') adaptCellToImage(s);
    if (typeof sendImageUpdate === 'function') sendImageUpdate(slot, file);
    return img;
  }

  /**
   * Show `file` in `slot`.
   *
   * Returns a promise that always resolves (never rejects): to the committed
   * image, to the unchanged previous image when loading fails, or null.
   */
  function apply(slot, file) {
    const s = state.cellStates[slot];
    if (!s || !file) return Promise.resolve(null);

    const token = (s._imageToken || 0) + 1;
    s._imageToken = token;

    const cached = imageLoader.get(file);
    if (cached) return Promise.resolve(commit(slot, file, cached));

    s._pendingImageFile = file;
    const promise = imageLoader.ensure(file).then(img => {
      // A newer request superseded this one, or the load failed: keep what the
      // cell is already showing.
      if (s._imageToken !== token) return s.img || null;
      return commit(slot, file, img);
    });
    s._readyPromise = promise;
    return promise;
  }

  return { apply };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createImageApplier };
}
