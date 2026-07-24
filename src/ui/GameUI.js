import { RESOURCE_LABELS, upgradeCost } from '../data/buildings.js';

export class GameUI {
  constructor(definitions) {
    this.definitions = definitions;
    this.$ = (id) => document.getElementById(id);
    this.toastTimer = null;
  }

  bind(handlers) {
    document.querySelectorAll('.build-button').forEach((button) => button.addEventListener('click', () => handlers.onBuild(button.dataset.building)));
    this.$('moveButton').addEventListener('click', handlers.onMove);
    this.$('upgradeButton').addEventListener('click', handlers.onUpgrade);
    this.$('removeButton').addEventListener('click', handlers.onRemove);
    this.$('centerCamera').addEventListener('click', handlers.onCenter);
  }

  toast(message, kind = 'info') {
    const toast = this.$('toast');
    toast.textContent = message; toast.dataset.kind = kind; toast.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  update(state, selectedId, placementType) {
    ['gold','wood','essence'].forEach((key) => { this.$(`${key}Value`).textContent = Math.floor(state.resources[key]).toLocaleString('fr-FR'); });
    document.querySelectorAll('.build-button').forEach((button) => {
      const def = this.definitions[button.dataset.building];
      button.classList.toggle('active', placementType === button.dataset.building);
      button.disabled = Object.entries(def.cost).some(([key, value]) => state.resources[key] < value);
    });
    const building = state.buildings.find((item) => item.id === selectedId);
    const panel = this.$('selectionPanel');
    if (!building) { panel.classList.add('hidden'); return; }
    const def = this.definitions[building.type], cost = upgradeCost(building);
    panel.classList.remove('hidden');
    this.$('selectionType').textContent = building.readyAt > Date.now() ? 'CONSTRUCTION' : 'BÂTIMENT';
    this.$('selectionName').textContent = def.name;
    const production = def.production ? ` · +${Math.round(def.production.perSecond * (1 + (building.level - 1) * .35) * 60)} ${RESOURCE_LABELS[def.production.resource]}/min` : '';
    this.$('selectionInfo').textContent = `Niveau ${building.level}${production} · Amélioration ${cost.gold} or / ${cost.wood} bois`;
    this.$('selectionDescription').textContent = def.description;
    this.$('upgradeButton').disabled = building.readyAt > Date.now() || building.level >= def.maxLevel;
    this.$('removeButton').disabled = building.type === 'townHall';
  }
}
