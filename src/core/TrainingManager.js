import { UNITS, armyCapacity, armyHousing, isUnitUnlocked } from '../data/units.js';

const makeId = () => globalThis.crypto?.randomUUID?.() || `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class TrainingManager {
  ensureState(state) {
    state.army ??= { skeleton: 0, ghoul: 0, necromancer: 0 };
    state.trainingQueue ??= [];
  }

  canTrain(state, type) {
    this.ensureState(state);
    const unit = UNITS[type];
    if (!unit) return { ok: false, reason: 'Troupe inconnue' };
    if (!isUnitUnlocked(type, state)) return { ok: false, reason: 'Améliorez la Caserne pour débloquer cette troupe' };
    if ((state.resources.essence ?? 0) < unit.cost.essence) return { ok: false, reason: 'Pas assez d’âmes' };
    const reservedHousing = state.trainingQueue.reduce((sum, item) => sum + (UNITS[item.type]?.housing ?? 0), 0);
    if (armyHousing(state) + reservedHousing + unit.housing > armyCapacity(state)) return { ok: false, reason: 'Camp militaire plein' };
    return { ok: true };
  }

  enqueue(state, type, now = Date.now()) {
    const result = this.canTrain(state, type);
    if (!result.ok) return result;
    const unit = UNITS[type];
    state.resources.essence -= unit.cost.essence;
    const previous = state.trainingQueue[state.trainingQueue.length - 1];
    const startsAt = Math.max(now, previous?.readyAt ?? now);
    state.trainingQueue.push({ id: makeId(), type, startsAt, readyAt: startsAt + unit.trainTime * 1000 });
    return { ok: true };
  }

  update(state, now = Date.now()) {
    this.ensureState(state);
    const completed = [];
    while (state.trainingQueue.length && state.trainingQueue[0].readyAt <= now) {
      const item = state.trainingQueue.shift();
      state.army[item.type] = (state.army[item.type] ?? 0) + 1;
      completed.push(item.type);
    }
    return completed;
  }

  applyOfflineProgress(state, now = Date.now()) {
    return this.update(state, now);
  }
}
