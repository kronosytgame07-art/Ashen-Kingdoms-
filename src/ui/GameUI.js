import { RESOURCE_LABELS, resourceCaps, upgradeCost } from '../data/buildings.js';
import { isBuildingUnlocked, maxLevelFor, townHallLevel } from '../data/progression.js';
import { UNITS, armyCapacity, armyHousing, isUnitUnlocked } from '../data/units.js';

export class GameUI {
  constructor(definitions) {
    this.definitions = definitions;
    this.$ = (id) => document.getElementById(id);
    this.toastTimer = null;
  }

  bind(handlers) {
    document.querySelectorAll('.build-button').forEach((button) => button.addEventListener('click', () => handlers.onBuild(button.dataset.building)));
    document.querySelectorAll('.unit-button').forEach((button) => button.addEventListener('click', () => handlers.onTrain(button.dataset.unit)));
    this.$('moveButton').addEventListener('click', handlers.onMove);
    this.$('upgradeButton').addEventListener('click', handlers.onUpgrade);
    this.$('removeButton').addEventListener('click', handlers.onRemove);
    this.$('centerCamera').addEventListener('click', handlers.onCenter);
  }

  toast(message, kind = 'info') {
    const toast = this.$('toast');
    toast.textContent = message; toast.dataset.kind = kind; toast.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  updateTraining(state) {
    const capacity = armyCapacity(state);
    const used = armyHousing(state);
    this.$('armyCapacity').textContent = `${used} / ${capacity}`;

    const queue = state.trainingQueue ?? [];
    if (!queue.length) this.$('trainingQueue').textContent = 'File vide';
    else {
      const first = queue[0];
      const remaining = Math.max(0, Math.ceil((first.readyAt - Date.now()) / 1000));
      this.$('trainingQueue').textContent = `${UNITS[first.type].name} · ${remaining}s · ${queue.length} en attente`;
    }

    document.querySelectorAll('.unit-button').forEach((button) => {
      const type = button.dataset.unit;
      const unit = UNITS[type];
      const unlocked = isUnitUnlocked(type, state);
      const affordable = (state.resources.essence ?? 0) >= unit.cost.essence;
      button.disabled = !unlocked || !affordable || capacity <= 0;
      button.classList.toggle('locked', !unlocked);
      const amount = state.army?.[type] ?? 0;
      button.title = unlocked ? `${unit.description} · Armée : ${amount}` : `Caserne niveau ${unit.unlockBarracksLevel} requise`;
    });
  }

  update(state, selectedId, placementType, currentQuest = null) {
    const caps = resourceCaps(state);
    ['gold','wood','essence'].forEach((key) => {
      this.$(`${key}Value`).textContent = `${Math.floor(state.resources[key]).toLocaleString('fr-FR')} / ${caps[key].toLocaleString('fr-FR')}`;
    });

    document.querySelectorAll('.build-button').forEach((button) => {
      const type = button.dataset.building;
      const definition = this.definitions[type];
      const unlocked = isBuildingUnlocked(type, state);
      button.classList.toggle('active', placementType === type);
      button.classList.toggle('locked', !unlocked);
      button.disabled = !unlocked || Object.entries(definition.cost).some(([key, value]) => state.resources[key] < value);
      button.title = unlocked ? definition.description : 'Débloqué au niveau supérieur du Trône corrompu';
    });

    this.updateTraining(state);

    if (this.$('objectiveText')) {
      this.$('objectiveText').textContent = currentQuest?.text ?? `Trône corrompu niveau ${townHallLevel(state)} · Développez librement votre royaume`;
    }

    const building = state.buildings.find((item) => item.id === selectedId);
    const panel = this.$('selectionPanel');
    if (!building) { panel.classList.add('hidden'); return; }
    const definition = this.definitions[building.type];
    const cost = upgradeCost(building);
    const allowedMax = maxLevelFor(building.type, state, this.definitions);
    panel.classList.remove('hidden');
    this.$('selectionType').textContent = building.readyAt > Date.now() ? 'CONSTRUCTION' : definition.category?.toUpperCase() ?? 'BÂTIMENT';
    this.$('selectionName').textContent = definition.name;
    const production = definition.production ? ` · +${Math.round(definition.production.perSecond * (1 + (building.level - 1) * .35) * 60)} ${RESOURCE_LABELS[definition.production.resource]}/min` : '';
    const limit = building.type === 'townHall' ? definition.maxLevel : allowedMax;
    this.$('selectionInfo').textContent = `Niveau ${building.level}/${limit}${production} · Amélioration ${cost.gold} or / ${cost.wood} bois`;
    this.$('selectionDescription').textContent = definition.description;
    this.$('upgradeButton').disabled = building.readyAt > Date.now() || building.level >= allowedMax;
    this.$('removeButton').disabled = building.type === 'townHall';
  }
}
