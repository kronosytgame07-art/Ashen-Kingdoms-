import { BUILDINGS, resourceCaps } from '../data/buildings.js';

const PRODUCTION_BONUS_PER_LEVEL = 0.35;
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

export class Economy {
  ensureExtractorState(state) {
    const now = Date.now();
    for (const building of state.buildings) {
      const definition = BUILDINGS[building.type];
      if (!definition?.extractor) continue;
      building.storedResource ??= 0;
      building.lastProductionAt ??= Math.min(now, state.savedAt || now);
    }
  }

  extractorRate(building) {
    const definition = BUILDINGS[building.type];
    if (!definition?.extractor) return 0;
    return definition.extractor.perSecond * (1 + (building.level - 1) * PRODUCTION_BONUS_PER_LEVEL);
  }

  extractorCapacity(building) {
    const definition = BUILDINGS[building.type];
    if (!definition?.extractor) return 0;
    return Math.round(definition.extractor.capacity * (1 + (building.level - 1) * 0.5));
  }

  applyExtractorProduction(state, seconds) {
    const elapsed = Math.max(0, Math.min(seconds, MAX_OFFLINE_SECONDS));
    if (!elapsed) return 0;
    let produced = 0;
    for (const building of state.buildings) {
      const definition = BUILDINGS[building.type];
      if (!definition?.extractor || building.readyAt > Date.now()) continue;
      building.storedResource ??= 0;
      const capacity = this.extractorCapacity(building);
      const before = building.storedResource;
      building.storedResource = Math.min(capacity, before + this.extractorRate(building) * elapsed);
      produced += building.storedResource - before;
      building.lastProductionAt = Date.now();
    }
    return produced;
  }

  collectExtractor(state, building) {
    const definition = BUILDINGS[building.type];
    if (!definition?.extractor) return { ok: false, reason: 'Ce bâtiment ne produit rien à récolter' };
    const amount = Math.floor(building.storedResource ?? 0);
    if (amount < 1) return { ok: false, reason: 'Rien à récolter pour le moment' };
    const resource = definition.extractor.resource;
    const cap = resourceCaps(state)[resource];
    const availableSpace = Math.max(0, cap - (state.resources[resource] ?? 0));
    const collected = Math.min(amount, Math.floor(availableSpace));
    if (collected < 1) return { ok: false, reason: 'Stockage du royaume plein' };
    state.resources[resource] += collected;
    building.storedResource = Math.max(0, (building.storedResource ?? 0) - collected);
    return { ok: true, resource, amount: collected };
  }

  applyProduction() {
    // La production automatique vers l’inventaire est volontairement désactivée.
    // Les extracteurs remplissent leur stockage local via applyExtractorProduction().
    return { gold: 0, wood: 0, essence: 0 };
  }

  applyOfflineProgress(state, now = Date.now()) {
    this.ensureExtractorState(state);
    const previous = Number(state.savedAt) || now;
    const elapsedSeconds = Math.max(0, (now - previous) / 1000);
    const completed = state.buildings.filter((building) => building.readyAt > previous && building.readyAt <= now).length;
    const produced = this.applyExtractorProduction(state, elapsedSeconds);
    state.savedAt = now;
    return { elapsedSeconds, completed, produced, gained: { gold: 0, wood: 0, essence: 0 } };
  }

  canAfford(state, cost) {
    return Object.entries(cost).every(([resource, amount]) => (state.resources[resource] ?? 0) >= amount);
  }

  spend(state, cost) {
    if (!this.canAfford(state, cost)) return false;
    for (const [resource, amount] of Object.entries(cost)) state.resources[resource] -= amount;
    return true;
  }
}