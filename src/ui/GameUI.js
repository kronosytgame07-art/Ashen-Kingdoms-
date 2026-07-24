import { RESOURCE_LABELS, resourceCaps, upgradeCost } from '../data/buildings.js';
import { isBuildingUnlocked, maxLevelFor, townHallLevel } from '../data/progression.js';
import { UNITS, armyCapacity, armyHousing, isUnitUnlocked } from '../data/units.js';

export class GameUI {
  constructor(definitions) {
    this.definitions = definitions;
    this.$ = (id) => document.getElementById(id);
    this.toastTimer = null;
    this.handlers = null;
    this.contextBuildingId = null;
  }

  bind(handlers) {
    this.handlers = handlers;
    document.querySelectorAll('.build-button').forEach((button) => button.addEventListener('click', () => handlers.onBuild(button.dataset.building)));
    document.querySelectorAll('.deploy-unit').forEach((button) => button.addEventListener('click', () => handlers.onSelectBattleUnit(button.dataset.unit)));
    this.$('upgradeButton').addEventListener('click', handlers.onUpgrade);
    this.$('removeButton').addEventListener('click', handlers.onRemove);
    this.$('centerCamera').addEventListener('click', handlers.onCenter);
    this.$('attackButton').addEventListener('click', handlers.onAttack);
    this.$('endBattleButton').addEventListener('click', handlers.onEndBattle);
    this.$('returnVillageButton').addEventListener('click', handlers.onReturnVillage);
    this.$('closeContextButton').addEventListener('click', () => this.closeContext());
    this.$('contextBackdrop').addEventListener('click', () => this.closeContext());
  }

  toast(message, kind = 'info') {
    const toast = this.$('toast');
    toast.textContent = message; toast.dataset.kind = kind; toast.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  closeContext() {
    this.contextBuildingId = null;
    this.$('buildingContext').classList.add('hidden');
    this.$('contextBackdrop').classList.add('hidden');
  }

  openContext(state, building) {
    const definition = this.definitions[building.type];
    if (!definition?.panel) return false;
    this.contextBuildingId = building.id;
    this.$('contextKind').textContent = definition.panel === 'barracks' ? 'ENTRAÎNEMENT' : 'RASSEMBLEMENT';
    this.$('contextTitle').textContent = definition.name;
    this.$('contextDescription').textContent = definition.description;
    this.renderContextBody(state, building);
    this.$('contextBackdrop').classList.remove('hidden');
    this.$('buildingContext').classList.remove('hidden');
    return true;
  }

  renderContextBody(state, building) {
    const body = this.$('contextBody');
    body.replaceChildren();
    const definition = this.definitions[building.type];

    if (definition.panel === 'barracks') {
      const capacity = armyCapacity(state);
      const used = armyHousing(state);
      const status = document.createElement('div');
      status.className = 'context-status';
      const queue = state.trainingQueue ?? [];
      const queueText = queue.length ? `${UNITS[queue[0].type].name} · ${Math.max(0, Math.ceil((queue[0].readyAt - Date.now()) / 1000))} s · ${queue.length} en attente` : 'File vide';
      status.innerHTML = `<strong>Armée ${used} / ${capacity}</strong><small>${queueText}</small>`;
      body.append(status);

      const list = document.createElement('div');
      list.className = 'context-unit-list';
      for (const [type, unit] of Object.entries(UNITS)) {
        const button = document.createElement('button');
        button.className = 'context-unit-button';
        const unlocked = building.level >= unit.unlockBarracksLevel && isUnitUnlocked(type, state);
        const affordable = (state.resources.essence ?? 0) >= unit.cost.essence;
        button.disabled = !unlocked || !affordable;
        button.innerHTML = `<span>${type === 'skeleton' ? '☠' : type === 'ghoul' ? '♟' : '✦'}</span><div><strong>${unit.name}</strong><small>${unit.cost.essence} âmes · ${unit.trainTime}s · place ${unit.housing}</small></div>`;
        button.addEventListener('click', () => this.handlers.onTrain(type, building.id));
        list.append(button);
      }
      body.append(list);
    }

    if (definition.panel === 'campfire') {
      const capacity = definition.housing.base + (building.level - 1) * definition.housing.perLevel;
      const assigned = building.garrison ?? {};
      const used = Object.entries(assigned).reduce((sum, [type, count]) => sum + (UNITS[type]?.housing ?? 0) * count, 0);
      const status = document.createElement('div');
      status.className = 'context-status';
      status.innerHTML = `<strong>Capacité ${used} / ${capacity}</strong><small>Troupes rassemblées autour du brasier</small>`;
      body.append(status);

      const list = document.createElement('div');
      list.className = 'camp-roster';
      for (const [type, unit] of Object.entries(UNITS)) {
        const row = document.createElement('div');
        row.innerHTML = `<span>${type === 'skeleton' ? '☠' : type === 'ghoul' ? '♟' : '✦'}</span><strong>${unit.name}</strong><b>${assigned[type] ?? 0}</b>`;
        list.append(row);
      }
      body.append(list);
    }
  }

  setBattleMode(active) {
    this.closeContext();
    this.$('battleHud').classList.toggle('hidden', !active);
    this.$('deploymentBar').classList.toggle('hidden', !active);
    document.querySelector('.buildbar').classList.toggle('hidden', active);
    this.$('objectiveCard').classList.toggle('hidden', active);
    this.$('selectionPanel').classList.add('hidden');
    this.$('centerCamera').classList.toggle('hidden', active);
    this.$('attackButton').classList.toggle('hidden', active);
  }

  showBattleResult(result) {
    this.$('battleResult').classList.remove('hidden');
    this.$('resultStars').textContent = `${'★'.repeat(result.stars)}${'☆'.repeat(3-result.stars)}`;
    this.$('resultDestruction').textContent = `${result.destruction} % détruit`;
    this.$('resultLoot').textContent = `Butin : ${result.loot.gold} or · ${result.loot.wood} bois · ${result.loot.essence} âmes`;
  }

  hideBattleResult() { this.$('battleResult').classList.add('hidden'); }

  updateBattle(battle) {
    if (!battle) return;
    const minutes = Math.floor(battle.timeLeft / 60);
    const seconds = Math.ceil(battle.timeLeft % 60).toString().padStart(2,'0');
    this.$('battleTimer').textContent = `${minutes}:${seconds}`;
    const totalHp = battle.buildings.reduce((sum, building) => sum + building.maxHp, 0);
    const remainingHp = battle.buildings.reduce((sum, building) => sum + Math.max(0, building.hp), 0);
    const destruction = Math.round((1 - remainingHp / totalHp) * 100);
    const throneDestroyed = battle.buildings.find((building) => building.id === 'enemy-throne')?.hp <= 0;
    const stars = destruction === 100 ? 3 : throneDestroyed ? 2 : destruction >= 50 ? 1 : 0;
    this.$('battleDestruction').textContent = `${destruction} %`;
    this.$('battleStars').textContent = `${'★'.repeat(stars)}${'☆'.repeat(3-stars)}`;
    const ids = { skeleton:'deploySkeleton', ghoul:'deployGhoul', necromancer:'deployNecromancer' };
    document.querySelectorAll('.deploy-unit').forEach((button) => {
      const type = button.dataset.unit;
      this.$(ids[type]).textContent = battle.available[type] ?? 0;
      button.classList.toggle('active', battle.selectedUnit === type);
      button.disabled = (battle.available[type] ?? 0) <= 0;
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
      const unlocked = definition && isBuildingUnlocked(type, state);
      button.classList.toggle('active', placementType === type);
      button.classList.toggle('locked', !unlocked);
      button.disabled = !definition || !unlocked || Object.entries(definition.cost).some(([key, value]) => state.resources[key] < value);
      button.title = unlocked ? definition.description : 'Débloqué au niveau supérieur du Trône corrompu';
    });

    if (this.$('objectiveText')) this.$('objectiveText').textContent = currentQuest?.text ?? `Trône corrompu niveau ${townHallLevel(state)} · Développez librement votre royaume`;

    if (this.contextBuildingId) {
      const contextBuilding = state.buildings.find((item) => item.id === this.contextBuildingId);
      if (contextBuilding) this.renderContextBody(state, contextBuilding);
      else this.closeContext();
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
    const production = definition.production ? ` · ${Math.floor(building.stored ?? 0)} ${RESOURCE_LABELS[definition.production.resource]} en réserve` : '';
    const limit = building.type === 'townHall' ? definition.maxLevel : allowedMax;
    this.$('selectionInfo').textContent = `Niveau ${building.level}/${limit}${production} · Amélioration ${cost.gold} or / ${cost.wood} bois`;
    this.$('selectionDescription').textContent = definition.description;
    this.$('upgradeButton').disabled = building.readyAt > Date.now() || building.level >= allowedMax;
    this.$('removeButton').disabled = building.type === 'townHall';
  }
}
