'use strict';

class ImageLoader {
  constructor(bridgeUrl, options = {}) {
    this.base = bridgeUrl ? bridgeUrl.replace(/\/+$/, '') : '';
    this.maxCached = Number.isFinite(options.maxCached) ? Math.max(0, Math.floor(options.maxCached)) : 48;
    this.createImage = options.createImage || (() => new Image());
    this.images = new Map();
    this.pending = new Map();
    this.pinnedFiles = new Set();
    this.failedFiles = new Set();
    this.evicted = 0;
    this.inkMetadata = new Map();
  }

  _url(path) { return this.base + path; }

  async loadLayout() {
    const res = await fetch(this._url('/api/layout'));
    if (!res.ok) throw new Error('Failed to load layout');
    return await res.json();
  }

  async loadManifest() {
    const res = await fetch(this._url('/api/manifest'));
    if (!res.ok) throw new Error('Failed to load manifest');
    return await res.json();
  }

  async loadSizes() {
    try {
      const res = await fetch(this._url('/api/sizes'));
      if (!res.ok) return null;
      return SizeClasses.loadSizeClasses(await res.json());
    } catch (error) { return null; }
  }

  filesFrom(manifestData) {
    if (!manifestData || typeof manifestData !== 'object') return [];
    const seen = new Set();
    const files = [];
    for (const entry of Object.values(manifestData)) {
      if (!entry || typeof entry.file !== 'string' || !entry.file || seen.has(entry.file)) continue;
      seen.add(entry.file);
      files.push(entry.file);
    }
    return files;
  }

  metadataFrom(manifestData) {
    this.inkMetadata.clear();
    if (manifestData && typeof manifestData === 'object') {
      for (const entry of Object.values(manifestData)) {
        if (entry && typeof entry.file === 'string') this.inkMetadata.set(entry.file, entry);
      }
    }
    return Object.fromEntries(this.inkMetadata);
  }

  getInkRatio(file) {
    const entry = this.inkMetadata.get(file);
    return entry && Number.isFinite(entry.inkRatio) ? entry.inkRatio : 1;
  }

  get(file) {
    const image = this.images.get(file);
    if (image) {
      // Map insertion order is the LRU order.
      this.images.delete(file);
      this.images.set(file, image);
    }
    return image || null;
  }

  isReady(file) { return this.images.has(file); }

  /** Pinning is idempotent: repeated pin calls require only one unpin. */
  pin(file) {
    if (this.pinnedFiles.has(file)) return;
    this.pinnedFiles.add(file);
    this._evict();
  }

  unpin(file) {
    this.pinnedFiles.delete(file);
    this._evict();
  }

  ensure(file) {
    if (this.images.has(file)) return Promise.resolve(this.get(file));
    if (this.pending.has(file)) return this.pending.get(file);
    if (this.failedFiles.has(file)) return Promise.resolve(null);

    let resolveLoad;
    const promise = new Promise(resolve => { resolveLoad = resolve; });
    this.pending.set(file, promise);
    let settled = false;
    const finish = (image) => {
      if (settled) return;
      settled = true;
      this.pending.delete(file);
      if (image) {
        image.inkRatio = this.getInkRatio(file);
        this.images.set(file, image);
        this._evict();
      } else {
        this.failedFiles.add(file);
        console.warn('Failed to load', file);
      }
      resolveLoad(image || null);
    };

    try {
      const image = this.createImage();
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      image.src = this._url(`/images/content/${file}`);
    } catch (error) {
      finish(null);
    }
    return promise;
  }

  _evict() {
    while (this.images.size > this.maxCached) {
      let victim;
      for (const file of this.images.keys()) {
        if (!this.pinnedFiles.has(file)) { victim = file; break; }
      }
      if (victim === undefined) break;
      this.images.delete(victim);
      this.evicted++;
    }
  }

  stats() {
    return {
      cached: this.images.size,
      pending: this.pending.size,
      pinned: this.pinnedFiles.size,
      failed: this.failedFiles.size,
      evicted: this.evicted
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImageLoader };
}
