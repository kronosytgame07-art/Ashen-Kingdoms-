import { BUILDINGS, resourceCaps } from '../data/buildings.js';

const PRODUCTION_BONUS_PER_LEVEL = 0.35;
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

export class Economy {
  productionPerSecond(state) {
    const rates = { gold: 0, wood: 0, essence: 0 };
    for (const building of state.buildings) {
      const definition = BUILDINGS[building.type];
      if (!definition?.production || building.readyAt > Date.now()) continue;
      const multiplier = 1 + (building.level - 1) * PRODUCTION_BONUS_PER_LEVEL;
      rates[definition.production.resource] += definition.production.perSecond * multiplier;
    }
    return rates;
  }

  applyProduction(state, seconds) {
    const elapsed = Math.max(0, Math.min(seconds, MAX_OFFLINE_SECONDS));
    if (!elapsed) return { gold: 0, wood: 0, essence: 0 };
    const rates = this.productionPerSecond(state);
    const caps = resourceCaps(state);
    const gained = { gold: 0, wood: 0, essence: 0 };

    for (const resource of Object.keys(gained)) {
      const before = state.resources[resource] ?? 0;
      const after = Math.min(caps[resource], before + rates[resource] * elapsed);
      state.resources[resource] = after;
      gained[resource] = after - before;
    }
    return gained;
  }

  applyOfflineProgress(state, now = Date.now()) {
    const previous = Number(state.savedAt) || now;
    const elapsedSeconds = Math.max(0, (now - previous) / 1000);
    const completed = state.buildings.filter((building) => building.readyAt > previous && building.readyAt <= now).length;
    const gained = this.applyProduction(state, elapsedSeconds);
    state.savedAt = now;
    return { elapsedSeconds, completed, gained };
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
