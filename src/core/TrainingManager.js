import { UNITS, armyCapacity, armyHousing, campfireCapacity, garrisonHousing, isUnitUnlocked } from '../data/units.js';

const makeId = () => globalThis.crypto?.randomUUID?.() || `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class TrainingManager {
  ensureState(state) {
    state.trainingQueue ??= [];
    for (const building of state.buildings) {
      if (building.type === 'campfire') building.garrison ??= { skeleton: 0, ghoul: 0, necromancer: 0 };
    }
  }

  availableCampfires(state) {
    return state.buildings.filter((building) => building.type === 'campfire' && building.readyAt <= Date.now());
  }

  canTrain(state, type) {
    this.ensureState(state);
    const unit = UNITS[type];
    if (!unit) return { ok: false, reason: 'Troupe inconnue' };
    if (!isUnitUnlocked(type, state)) return { ok: false, reason: 'Améliorez la Caserne pour débloquer cette troupe' };
    if (!this.availableCampfires(state).length) return { ok: false, reason: 'Construisez un Brasier rituel' };
    if ((state.resources.essence ?? 0) < unit.cost.essence) return { ok: false, reason: 'Pas assez d’âmes' };
    const reservedHousing = state.trainingQueue.reduce((sum, item) => sum + (UNITS[item.type]?.housing ?? 0), 0);
    if (armyHousing(state) + reservedHousing + unit.housing > armyCapacity(state)) return { ok: false, reason: 'Capacité des Brasiers rituels atteinte' };
    return { ok: true };
  }

  enqueue(state, type, now = Date.now(), barracksId = null) {
    const result = this.canTrain(state, type);
    if (!result.ok) return result;
    const unit = UNITS[type];
    state.resources.essence -= unit.cost.essence;
    const previous = state.trainingQueue[state.trainingQueue.length - 1];
    const startsAt = Math.max(now, previous?.readyAt ?? now);
    state.trainingQueue.push({ id: makeId(), type, barracksId, startsAt, readyAt: startsAt + unit.trainTime * 1000 });
    return { ok: true };
  }

  assignToCampfire(state, type) {
    const unit = UNITS[type];
    const candidates = this.availableCampfires(state)
      .map((building) => ({ building, free: campfireCapacity(building) - garrisonHousing(building.garrison) }))
      .filter((entry) => entry.free >= unit.housing)
      .sort((a, b) => b.free - a.free);
    const target = candidates[0]?.building;
    if (!target) return null;
    target.garrison ??= { skeleton: 0, ghoul: 0, necromancer: 0 };
    target.garrison[type] = (target.garrison[type] ?? 0) + 1;
    return target;
  }

  update(state, now = Date.now()) {
    this.ensureState(state);
    const completed = [];
    while (state.trainingQueue.length && state.trainingQueue[0].readyAt <= now) {
      const item = state.trainingQueue[0];
      const campfire = this.assignToCampfire(state, item.type);
      if (!campfire) break;
      state.trainingQueue.shift();
      completed.push({ type: item.type, barracksId: item.barracksId, campfireId: campfire.id });
    }
    return completed;
  }

  applyOfflineProgress(state, now = Date.now()) {
    return this.update(state, now);
  }
}
