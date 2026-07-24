export class SaveManager {
  constructor(key, version = 2) { this.key = key; this.version = version; }

  load(fallbackFactory) {
    const fallback = fallbackFactory();
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.buildings)) throw new Error('Format de sauvegarde invalide');
      return {
        ...fallback,
        ...parsed,
        version: this.version,
        resources: { ...fallback.resources, ...parsed.resources },
        camera: { ...fallback.camera, ...parsed.camera },
        buildings: parsed.buildings.map((b) => ({ ...b, col: b.col ?? b.x ?? 0, row: b.row ?? b.y ?? 0 }))
      };
    } catch (error) {
      console.error('[SaveManager] Sauvegarde ignorée :', error);
      return fallback;
    }
  }

  save(state) {
    try { localStorage.setItem(this.key, JSON.stringify({ ...state, savedAt: Date.now() })); }
    catch (error) { console.error('[SaveManager] Échec de sauvegarde :', error); }
  }
}
