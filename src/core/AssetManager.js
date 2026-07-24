export class AssetManager {
  constructor() { this.images = new Map(); }

  async loadImage(key, url) {
    if (!url) return null;
    if (this.images.has(key)) return this.images.get(key);
    const image = new Image();
    const promise = new Promise((resolve) => {
      image.onload = () => resolve(image);
      image.onerror = () => { console.warn(`[AssetManager] Image introuvable: ${url}`); resolve(null); };
    });
    const resolvedUrl = new URL(`../../${url.replace(/^\.\//, '')}`, import.meta.url).href;
    image.src = resolvedUrl;
    const loaded = await promise;
    this.images.set(key, loaded);
    return loaded;
  }

  get(key) { return this.images.get(key) || null; }
}
