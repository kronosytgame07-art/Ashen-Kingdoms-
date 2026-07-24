const INDEX_KEY = 'ashen-kingdoms-profiles-v1';
const LEGACY_KEY = 'ashen-kingdoms-save-v2';

const makeId = () => globalThis.crypto?.randomUUID?.() || `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class ProfileManager {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.ensureIndex();
    this.migrateLegacySave();
  }

  ensureIndex() {
    if (!this.storage.getItem(INDEX_KEY)) this.storage.setItem(INDEX_KEY, JSON.stringify({ activeId: null, profiles: [] }));
  }

  readIndex() {
    try {
      const parsed = JSON.parse(this.storage.getItem(INDEX_KEY));
      return parsed && Array.isArray(parsed.profiles) ? parsed : { activeId: null, profiles: [] };
    } catch {
      return { activeId: null, profiles: [] };
    }
  }

  writeIndex(index) { this.storage.setItem(INDEX_KEY, JSON.stringify(index)); }
  saveKey(id) { return `ashen-kingdoms-profile:${id}`; }

  migrateLegacySave() {
    const legacy = this.storage.getItem(LEGACY_KEY);
    const index = this.readIndex();
    if (!legacy || index.profiles.length) return;
    const id = makeId();
    index.profiles.push({ id, name: 'Royaume ancien', createdAt: Date.now(), lastPlayedAt: Date.now() });
    index.activeId = id;
    this.storage.setItem(this.saveKey(id), legacy);
    this.writeIndex(index);
  }

  list() { return [...this.readIndex().profiles].sort((a,b) => b.lastPlayedAt - a.lastPlayedAt); }
  activeId() { return this.readIndex().activeId; }

  create(name = 'Nouveau royaume') {
    const index = this.readIndex();
    const id = makeId();
    const profile = { id, name: name.trim() || 'Nouveau royaume', createdAt: Date.now(), lastPlayedAt: Date.now() };
    index.profiles.push(profile);
    index.activeId = id;
    this.writeIndex(index);
    return profile;
  }

  select(id) {
    const index = this.readIndex();
    const profile = index.profiles.find((item) => item.id === id);
    if (!profile) return false;
    profile.lastPlayedAt = Date.now();
    index.activeId = id;
    this.writeIndex(index);
    return true;
  }

  rename(id, name) {
    const index = this.readIndex();
    const profile = index.profiles.find((item) => item.id === id);
    if (!profile) return false;
    profile.name = name.trim() || profile.name;
    this.writeIndex(index);
    return true;
  }

  remove(id) {
    const index = this.readIndex();
    index.profiles = index.profiles.filter((item) => item.id !== id);
    if (index.activeId === id) index.activeId = index.profiles[0]?.id ?? null;
    this.storage.removeItem(this.saveKey(id));
    this.writeIndex(index);
  }

  storageKey(id = this.activeId()) { return id ? this.saveKey(id) : null; }
}
