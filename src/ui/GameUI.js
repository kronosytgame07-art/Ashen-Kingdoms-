import { RESOURCE_LABELS, resourceCaps, upgradeCost } from '../data/buildings.js';
import { isBuildingUnlocked, maxLevelFor, townHallLevel, requiredTownHallLevel } from '../data/progression.js';
import { UNITS, armyCapacity, armyHousing, isUnitUnlocked } from '../data/units.js';

const BUILD_CATEGORIES = [
  { id: 'resource', label: 'Ressources', icon: '⛏' },
  { id: 'storage', label: 'Stockage', icon: '▣' },
  { id: 'army', label: 'Militaire', icon: '⚔' },
  { id: 'defense', label: 'Défense', icon: '♜' },
  { id: 'trap', label: 'Pièges', icon: '✹' },
  { id: 'decoration', label: 'Décoration', icon: '✦' }
];

const BUILD_ICONS = {
  goldMine: '⛏', lumberMill: '♣', essenceWell: '✦', soulVault: '▣', barracks: '⚔', campfire: '♨',
  runeTower: '♝', boneCatapult: '◉', soulSpire: '▲', cursedTrap: '✹', wall: '▥', clanCastle: '♜'
};

const UNIT_ICONS = { skeleton: '☠', ghoul: '♟', necromancer: '✦' };
const unitIcon = (type) => UNIT_ICONS[type] ?? '◆';
const resourceText = (cost = {}) => Object.entries(cost)
  .map(([resource, amount]) => `${amount} ${RESOURCE_LABELS[resource]?.toLowerCase() ?? resource}`)
  .join(' · ') || 'Gratuit';

export class GameUI {
  constructor(definitions) {
    this.definitions = definitions;
    this.$ = (id) => document.getElementById(id);
    this.toastTimer = null;
    this.handlers = null;
    this.contextBuildingId = null;
    this.buildMenuState = null;
    this.activeBuildCategory = 'resource';
  }

  bind(handlers) {
    this.handlers = handlers;
    document.querySelectorAll('.deploy-unit').forEach((button) => button.addEventListener('click', () => handlers.onSelectBattleUnit(button.dataset.unit)));
    this.$('upgradeButton').addEventListener('click', handlers.onUpgrade);
    this.$('removeButton').addEventListener('click', handlers.onRemove);
    this.$('centerCamera').addEventListener('click', handlers.onCenter);
    this.$('attackButton').addEventListener('click', handlers.onAttack);
    this.$('endBattleButton').addEventListener('click', handlers.onEndBattle);
    this.$('returnVillageButton').addEventListener('click', handlers.onReturnVillage);
    this.$('closeContextButton').addEventListener('click', () => this.closeContext());
    this.$('contextBackdrop').addEventListener('click', () => this.closeContext());
    this.$('openBuildMenuButton').addEventListener('click', () => this.openBuildMenu());
    this.$('closeBuildMenuButton').addEventListener('click', () => this.closeBuildMenu());
    this.$('buildMenuBackdrop').addEventListener('click', () => this.closeBuildMenu());
    this.renderBuildTabs();
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
    this.closeBuildMenu();
    this.contextBuildingId = building.id;
    const kinds = { barracks: 'ENTRAÎNEMENT', campfire: 'RASSEMBLEMENT', clanCastle: 'CLAN & RENFORTS' };
    this.$('contextKind').textContent = kinds[definition.panel] ?? 'BÂTIMENT';
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

    if (definition.panel === 'barracks') this.renderBarracksPanel(body, state, building);
    if (definition.panel === 'campfire') this.renderCampfirePanel(body, state, building);
    if (definition.panel === 'clanCastle') this.renderClanCastlePanel(body, state, building);
  }

  renderBarracksPanel(body, state, building) {
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
      button.innerHTML = `<span>${unitIcon(type)}</span><div><strong>${unit.name}</strong><small>${unit.cost.essence} âmes · ${unit.trainTime}s · place ${unit.housing}</small></div>`;
      button.addEventListener('click', () => this.handlers.onTrain(type, building.id));
      list.append(button);
    }
    body.append(list);
  }

  renderCampfirePanel(body, state, building) {
    const definition = this.definitions[building.type];
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
      row.innerHTML = `<span>${unitIcon(type)}</span><strong>${unit.name}</strong><b>${assigned[type] ?? 0}</b>`;
      list.append(row);
    }
    body.append(list);
  }

  renderClanCastlePanel(body, state, building) {
    const config = this.definitions.clanCastle.reinforcementHousing;
    const capacity = config.base + (building.level - 1) * config.perLevel;
    const reinforcements = building.reinforcements ?? {};
    const used = Object.entries(reinforcements).reduce((sum, [type, amount]) => sum + (UNITS[type]?.housing ?? 0) * amount, 0);
    const clan = state.clan ?? {};

    const status = document.createElement('div');
    status.className = 'context-status';
    status.innerHTML = `<strong>Renforts ${used} / ${capacity}</strong><small>${clan.id ? clan.name : 'Aucun clan rejoint'}</small>`;
    body.append(status);

    if (!clan.id) {
      const form = document.createElement('form');
      form.className = 'clan-create-form';
      form.innerHTML = `<label><span>Fonder un clan</span><input name="clanName" maxlength="24" placeholder="Nom du clan" required /></label><button type="submit">Créer le clan</button>`;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = new FormData(form).get('clanName');
        this.handlers.onCreateClan(name);
      });
      body.append(form);
      return;
    }

    const summary = document.createElement('div');
    summary.className = 'clan-summary';
    summary.innerHTML = `<div><small>RÔLE</small><strong>${clan.role === 'leader' ? 'Chef' : 'Membre'}</strong></div><div><small>MEMBRES</small><strong>${clan.members?.length ?? 1}</strong></div><div><small>DONS</small><strong>${clan.donationsGiven ?? 0}</strong></div><div><small>REÇUS</small><strong>${clan.donationsReceived ?? 0}</strong></div>`;
    body.append(summary);

    const roster = document.createElement('div');
    roster.className = 'clan-roster';
    for (const [type, unit] of Object.entries(UNITS)) {
      const campCount = state.buildings
        .filter((item) => item.type === 'campfire')
        .reduce((sum, camp) => sum + (camp.garrison?.[type] ?? 0), 0);
      const row = document.createElement('div');
      row.className = 'clan-roster-row';
      row.innerHTML = `<span class="clan-unit-icon">${unitIcon(type)}</span><div><strong>${unit.name}</strong><small>Château : ${reinforcements[type] ?? 0} · Brasiers : ${campCount}</small></div>`;
      const actions = document.createElement('div');
      actions.className = 'clan-unit-actions';
      const donate = document.createElement('button');
      donate.textContent = 'Donner';
      donate.disabled = campCount <= 0 || used + unit.housing > capacity;
      donate.addEventListener('click', () => this.handlers.onDonateClanTroop(building.id, type));
      const receive = document.createElement('button');
      receive.textContent = 'Recevoir';
      receive.disabled = used + unit.housing > capacity;
      receive.addEventListener('click', () => this.handlers.onReceiveClanTroop(building.id, type));
      actions.append(donate, receive);
      row.append(actions);
      roster.append(row);
    }
    body.append(roster);

    const leave = document.createElement('button');
    leave.className = 'clan-leave-button';
    leave.textContent = 'Quitter le clan';
    leave.addEventListener('click', () => this.handlers.onLeaveClan());
    body.append(leave);
  }

  renderBuildTabs() {
    const tabs = this.$('buildCategoryTabs');
    tabs.replaceChildren();
    const presentCategories = new Set(Object.values(this.definitions).map((definition) => definition.category));
    for (const category of BUILD_CATEGORIES.filter((item) => presentCategories.has(item.id))) {
      const button = document.createElement('button');
      button.className = 'build-category-tab';
      button.dataset.category = category.id;
      button.innerHTML = `<span>${category.icon}</span><strong>${category.label}</strong>`;
      button.addEventListener('click', () => {
        this.activeBuildCategory = category.id;
        this.renderBuildTabs();
        this.renderBuildMenu();
      });
      button.classList.toggle('active', this.activeBuildCategory === category.id);
      tabs.append(button);
    }
  }

  openBuildMenu() {
    if (!this.buildMenuState) return;
    this.closeContext();
    this.renderBuildTabs();
    this.renderBuildMenu();
    this.$('buildMenuBackdrop').classList.remove('hidden');
    this.$('buildMenu').classList.remove('hidden');
  }

  closeBuildMenu() {
    this.$('buildMenu')?.classList.add('hidden');
    this.$('buildMenuBackdrop')?.classList.add('hidden');
  }

  renderBuildMenu() {
    const state = this.buildMenuState;
    if (!state) return;
    const list = this.$('buildMenuList');
    list.replaceChildren();
    const currentTownHall = townHallLevel(state);
    const entries = Object.entries(this.definitions).filter(([type, definition]) => type !== 'townHall' && definition.category === this.activeBuildCategory);

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'build-menu-empty';
      empty.textContent = 'Aucun bâtiment dans cette catégorie.';
      list.append(empty);
      return;
    }

    for (const [type, definition] of entries) {
      const unlocked = isBuildingUnlocked(type, state);
      const requiredLevel = requiredTownHallLevel(type);
      const currentCount = state.buildings.filter((building) => building.type === type).length;
      const limit = definition.buildLimit?.[currentTownHall] ?? definition.buildLimit ?? Infinity;
      const maxed = currentCount >= limit;
      const affordable = Object.entries(definition.cost).every(([resource, amount]) => (state.resources[resource] ?? 0) >= amount);
      const button = document.createElement('button');
      button.className = 'build-menu-item';
      button.dataset.state = !unlocked ? 'locked' : maxed ? 'maxed' : affordable ? 'available' : 'poor';
      button.disabled = !unlocked || maxed || !affordable;
      const status = !unlocked ? `Trône niveau ${requiredLevel}` : maxed ? 'Maximum atteint' : affordable ? 'Disponible' : 'Ressources insuffisantes';
      button.innerHTML = `<span class="build-menu-icon">${BUILD_ICONS[type] ?? '◆'}</span><div><strong>${definition.name}</strong><small>${resourceText(definition.cost)} · ${definition.buildTime}s</small><em>${status}</em></div><b>${currentCount}${Number.isFinite(limit) ? `/${limit}` : ''}</b>`;
      button.addEventListener('click', () => {
        this.closeBuildMenu();
        this.handlers.onBuild(type);
      });
      list.append(button);
    }
  }

  setBattleMode(active) {
    this.closeContext();
    this.closeBuildMenu();
    this.$('battleHud').classList.toggle('hidden', !active);
    this.$('deploymentBar').classList.toggle('hidden', !active);
    this.$('openBuildMenuButton').classList.toggle('hidden', active);
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
    const eligible = battle.buildings.filter((building) => !building.isTrap);
    const totalHp = eligible.reduce((sum, building) => sum + building.maxHp, 0);
    const remainingHp = eligible.reduce((sum, building) => sum + Math.max(0, building.hp), 0);
    const destruction = totalHp > 0 ? Math.round((1 - remainingHp / totalHp) * 100) : 100;
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
    this.buildMenuState = state;
    const caps = resourceCaps(state);
    ['gold','wood','essence'].forEach((key) => {
      this.$(`${key}Value`).textContent = `${Math.floor(state.resources[key]).toLocaleString('fr-FR')} / ${caps[key].toLocaleString('fr-FR')}`;
    });

    if (this.$('objectiveText')) this.$('objectiveText').textContent = currentQuest?.text ?? `Trône corrompu niveau ${townHallLevel(state)} · Développez librement votre royaume`;
    if (!this.$('buildMenu').classList.contains('hidden')) this.renderBuildMenu();

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
    const production = definition.extractor ? ` · ${Math.floor(building.storedResource ?? 0)} ${RESOURCE_LABELS[definition.extractor.resource]} en réserve` : '';
    const limit = building.type === 'townHall' ? definition.maxLevel : allowedMax;
    this.$('selectionInfo').textContent = `Niveau ${building.level}/${limit}${production} · Amélioration ${cost.gold} or / ${cost.wood} bois`;
    this.$('selectionDescription').textContent = definition.description;
    this.$('upgradeButton').disabled = building.readyAt > Date.now() || building.level >= allowedMax;
    this.$('removeButton').disabled = building.type === 'townHall';
  }
}
