class ImageLoader {
  constructor(bridgeUrl) {
    this.base = bridgeUrl ? bridgeUrl.replace(/\/+$/, '') : '';
    this.images = new Map();
    this.loadedCount = 0;
    this.totalCount = 0;
  }

  _url(path) {
    return this.base + path;
  }

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

  async loadImage(imageFile) {
    const url = this._url(`/images/content/${imageFile}`);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { this.images.set(imageFile, img); this.loadedCount++; resolve(img); };
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
    });
  }

  async loadAllImages(manifestData) {
    const entries = Object.values(manifestData);
    this.totalCount = entries.length;
    const promises = entries.map(e =>
      this.loadImage(e.file)
        .catch(() => { console.warn('Failed to load', e.file); return null; })
    );
    await Promise.all(promises);
    const countEl = document.getElementById('load-count');
    if (countEl) countEl.textContent = `${this.loadedCount} / ${this.totalCount}`;
    console.log(`Images loaded: ${this.loadedCount}/${this.totalCount}`);
    return this.images;
  }

  get(imageFile) {
    return this.images.get(imageFile) || null;
  }
}
