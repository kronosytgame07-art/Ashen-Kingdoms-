import { BUILDINGS, resourceCaps, upgradeCost, upgradeTime } from '../data/buildings.js';
import { QUESTS, isBuildingUnlocked, maxLevelFor } from '../data/progression.js';
import { UNITS, armyCounts } from '../data/units.js';
import { BATTLE_CONFIG } from '../data/battle.js';
import { Grid } from './Grid.js';
import { SaveManager } from './SaveManager.js';
import { AssetManager } from './AssetManager.js';
import { Renderer } from './Renderer.js';
import { Economy } from './Economy.js';
import { TrainingManager } from './TrainingManager.js';
import { BattleManager } from './BattleManager.js';
import { ClanManager } from './ClanManager.js';
import { GameUI } from '../ui/GameUI.js';
import { bus, EVENTS } from './EventBus.js';

const makeId  = () => globalThis.crypto?.randomUUID?.() || `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LONG_PRESS_MS   = 500;
const MOVE_TOLERANCE  = 10;

export class Game {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.grid = new Grid();
    this.saveManager = new SaveManager(options.storageKey ?? 'ashen-kingdoms-save-v2');
    this.assets = new AssetManager();
    this.renderer = new Renderer(canvas, this.grid, BUILDINGS, this.assets);
    this.economy = new Economy();
    this.training = new TrainingManager();
    this.battle = new BattleManager();
    this.clans = new ClanManager();
    this.ui = new GameUI(BUILDINGS);
    this.state = this.saveManager.load(() => ({
      version: 2,
      resources: { gold: 650, wood: 520, essence: 80 },
      buildings: [{ id: makeId(), type: 'townHall', col: 7, row: 7, level: 1, readyAt: 0 }],
      buildQueue: [],
      trainingQueue: [],
      camera: { x: 0, y: -20, zoom: 1 },
      tutorialStep: 0,
      completedQuests: [],
      claimedQuests: [],
      savedAt: Date.now()
    }));
    this.training.ensureState(this.state);
    this.economy.ensureExtractorState(this.state);
    this.clans.ensureState(this.state);
    this.interaction = {
      selectedId: null, placementType: null, movingId: null,
      preview: null, liftedId: null, collectionPopups: [], troopTransfers: []
    };
    this.pointers  = new Map();
    this.drag      = null;
    this.pinch     = null;
    this.longPressTimer = null;
    this.lastFrame      = performance.now();
    this.lastUiUpdate   = 0;
    this.dirty   = true;
    this.running = true;
    this.saveInterval = null;
    this._busUnsubs   = [];
  }

  async start() {
    for (const [type, def] of Object.entries(BUILDINGS))
      if (def.sprite) await this.assets.loadImage(type, def.sprite);
    const offline        = this.economy.applyOfflineProgress(this.state);
    const trainedOffline = this.training.applyOfflineProgress(this.state);
    this.refreshQuests();
    this._bindBusEvents();
    this.bindEvents();
    this.renderer.resize();
    this.notifyOfflineProgress(offline, trainedOffline);
    requestAnimationFrame((t) => this.loop(t));
    this.saveInterval = setInterval(() => this.save(), 5000);
  }

  destroy() {
    this.running = false;
    if (this.saveInterval) clearInterval(this.saveInterval);
    this._busUnsubs.forEach((fn) => fn());
    this._busUnsubs = [];
  }

  // ── EventBus ─────────────────────────────────────────────────────────

  _bindBusEvents() {
    this._busUnsubs.push(
      bus.on(EVENTS.SAVE_REQUESTED, () => this.save()),
      bus.on(EVENTS.BUILDING_READY, ({ building }) => {
        this.ui.toast(`${BUILDINGS[building.type]?.name ?? building.type} terminé !`, 'success');
        this.dirty = true;
      }),
      bus.on(EVENTS.UNIT_TRAINED, ({ type }) => {
        this.ui.toast(`${UNITS[type]?.name ?? type} a rejoint un Brasier`, 'success');
        this.dirty = true;
      }),
      bus.on(EVENTS.QUEST_COMPLETED, ({ text }) => {
        this.ui.toast(`Objectif accompli : ${text}`, 'success');
        this.dirty = true;
      }),
      bus.on(EVENTS.BATTLE_STARTED, () => {
        this.ui.setBattleMode(true);
        this.ui.hideBattleResult();
        this.ui.updateBattle(this.battle.state);
        this.ui.toast('Touchez le champ de bataille pour déployer vos troupes', 'success');
        this.dirty = true;
      }),
      bus.on(EVENTS.BATTLE_FINISHED, ({ result }) => this.applyBattleResult(result)),
      bus.on(EVENTS.EXTRACTOR_COLLECTED, ({ building, amount, resource }) => {
        this.interaction.collectionPopups.push({
          buildingId: building.id, amount, resource, createdAt: performance.now()
        });
        this.ui.toast(`+${amount} ${BUILDINGS[building.type]?.name ?? resource}`, 'success');
        globalThis.navigator?.vibrate?.(18);
        this.save(); this.dirty = true;
      }),
      bus.on(EVENTS.RESOURCES_CHANGED, () => { this.dirty = true; }),
      bus.on(EVENTS.PROFILE_CHANGED, () => {
        this.save();
        this.options.onReturnToMenu?.();
      })
    );
  }

  // ── offline notification ─────────────────────────────────────────────

  notifyOfflineProgress(result, trainedOffline = []) {
    if (trainedOffline.length > 0)
      this.ui.toast(`${trainedOffline.length} troupe(s) ont rejoint les Brasiers`, 'success');
    else if (result.completed > 0)
      this.ui.toast(`${result.completed} construction(s) terminée(s) pendant votre absence`, 'success');
    else if (result.elapsedSeconds > 30 && result.produced >= 1)
      this.ui.toast('Vos extracteurs ont continué à produire', 'success');
  }

  // ── long-press move ────────────────────────────────────────────────

  clearLongPress() {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }

  beginLongPressMove(building, pos) {
    this.clearLongPress();
    if (!building || building.type === 'townHall') return;
    this.ui.closeContext();
    this.interaction.movingId  = building.id;
    this.interaction.liftedId  = building.id;
    this.interaction.selectedId = null;
    this.drag.longPressTriggered = true;
    this.drag.original = { col: building.col, row: building.row };
    this.updatePreview(pos);
    globalThis.navigator?.vibrate?.(35);
    this.ui.toast('Déplacez le bâtiment puis relâchez', 'success');
    this.dirty = true;
  }

  // ── input binding ───────────────────────────────────────────────────

  bindEvents() {
    const pos = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // ── pointerdown ──────────────────────────────────────────────────
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.pointers.set(e.pointerId, p);

      if (this.battle.state?.active) {
        // BUG-FIX #1 : passe le viewport courant à deploy()
        if (this.battle.deploy(p.x, p.y, this.renderer.viewport())) {
          bus.emit(EVENTS.UNIT_DEPLOYED, { state: this.battle.state });
          this.ui.updateBattle(this.battle.state);
          this.dirty = true;
        }
        return;
      }

      if (this.pointers.size === 2) {
        this.clearLongPress();
        const [a, b] = [...this.pointers.values()];
        this.pinch = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: this.state.camera.zoom,
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          camera: { ...this.state.camera }
        };
        this.drag = null;
        return;
      }

      const cell    = this.grid.screenToGrid(p.x, p.y, this.state.camera, this.renderer.viewport());
      const pressed = this.grid.buildingAt(cell.col, cell.row, BUILDINGS, this.state.buildings);
      this.drag = {
        start: p, camera: { ...this.state.camera }, moved: false,
        wallCells: new Set(), pressedBuildingId: pressed?.id ?? null, longPressTriggered: false
      };
      if (!this.interaction.placementType && !this.interaction.movingId && pressed)
        this.longPressTimer = setTimeout(() => this.beginLongPressMove(pressed, p), LONG_PRESS_MS);
      this.updatePreview(p);
    });

    // ── pointermove ──────────────────────────────────────────────────
    this.canvas.addEventListener('pointermove', (e) => {
      const p = pos(e);

      if (this.battle.state?.active) {
        this.pointers.set(e.pointerId, p);
        return;
      }

      if (!this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, p);
        return;
      }
      this.pointers.set(e.pointerId, p);

      if (this.pointers.size === 2 && this.pinch) {
        this.clearLongPress();
        const [a, b] = [...this.pointers.values()];
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoom   = clamp(
          this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.distance,
          0.55, 1.65
        );
        this.state.camera.zoom = zoom;
        this.state.camera.x   = this.pinch.camera.x + (center.x - this.pinch.center.x);
        this.state.camera.y   = this.pinch.camera.y + (center.y - this.pinch.center.y);
        this.dirty = true;
        return;
      }

      if (!this.drag) return;

      const dx = p.x - this.drag.start.x;
      const dy = p.y - this.drag.start.y;
      const d  = Math.hypot(dx, dy);

      if (d > MOVE_TOLERANCE && !this.drag.longPressTriggered) this.clearLongPress();
      this.drag.moved ||= d > 7;

      if (this.interaction.placementType || this.interaction.movingId) {
        this.updatePreview(p);
        if (this.interaction.placementType === 'wall' && this.drag.moved) this.placeWallPreview();
      } else if (this.drag.moved) {
        this.ui.closeContext();
        this.state.camera.x = this.drag.camera.x + dx;
        this.state.camera.y = this.drag.camera.y + dy;
        this.dirty = true;
      }
    });

    // ── pointerup / pointercancel ─────────────────────────────────────
    const endPointer = (e) => {
      const p = pos(e);
      this.pointers.delete(e.pointerId);
      if (this.battle.state?.active) return;
      this.clearLongPress();
      if (this.pointers.size < 2) this.pinch = null;
      if (this.drag?.longPressTriggered && this.interaction.movingId)
        this.finishLongPressMove(p);
      else if (this.drag && !this.drag.moved)
        this.handleTap(p);
      this.drag = null;
      this.save();
    };
    this.canvas.addEventListener('pointerup',     endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);

    // ── wheel ────────────────────────────────────────────────────────
    this.canvas.addEventListener('wheel', (e) => {
      if (this.battle.state?.active) return;
      e.preventDefault();
      this.state.camera.zoom = clamp(this.state.camera.zoom - Math.sign(e.deltaY) * 0.08, 0.55, 1.65);
      this.dirty = true;
    }, { passive: false });

    window.addEventListener('resize',       () => { this.renderer.resize(); this.dirty = true; });
    window.addEventListener('beforeunload', () => this.save());

    // ── UI callbacks ─────────────────────────────────────────────────
    this.ui.bind({
      onBuild: (type) => {
        if (!isBuildingUnlocked(type, this.state))
          return this.ui.toast('Améliorez le Trône corrompu pour débloquer ce bâtiment', 'error');
        this.ui.closeContext();
        this.interaction.placementType = type;
        this.interaction.movingId      = null;
        this.interaction.selectedId    = null;
        this.ui.toast(`Placez : ${BUILDINGS[type].name}`);
      },
      onTrain:            (type, barracksId) => this.trainUnit(type, barracksId),
      onCreateClan:       (name)             => this.createClan(name),
      onLeaveClan:        ()                 => this.leaveClan(),
      onDonateClanTroop:  (buildingId, type) => this.donateClanTroop(buildingId, type),
      onReceiveClanTroop: (buildingId, type) => this.receiveClanTroop(buildingId, type),
      onUpgrade:          ()                 => this.upgradeSelected(),
      onRemove:           ()                 => this.removeSelected(),
      onCenter: () => {
        this.ui.closeContext();
        this.state.camera = { x: 0, y: -20, zoom: 1 };
        this.dirty = true;
      },
      onAttack:            ()     => this.startBattle(),
      onSelectBattleUnit:  (type) => {
        if (this.battle.selectUnit(type)) { this.ui.updateBattle(this.battle.state); this.dirty = true; }
      },
      onEndBattle:    () => this.finishBattle(),
      onReturnVillage: () => this.returnToVillage()
    });
  }

  // ── clan actions ─────────────────────────────────────────────────────

  createClan(name) {
    const result = this.clans.createClan(this.state, name);
    if (!result.ok) return this.ui.toast(result.reason, 'error');
    bus.emit(EVENTS.CLAN_CREATED, { name: this.state.clan.name });
    this.ui.toast(`Clan ${this.state.clan.name} fondé`, 'success');
    this.save(); this.dirty = true;
  }

  leaveClan() {
    this.clans.leaveClan(this.state);
    bus.emit(EVENTS.CLAN_LEFT, {});
    this.ui.toast('Vous avez quitté le clan', 'success');
    this.save(); this.dirty = true;
  }

  donateClanTroop(buildingId, type) {
    const building = this.state.buildings.find((b) => b.id === buildingId && b.type === 'clanCastle');
    if (!building) return;
    const result = this.clans.donateFromCampfires(this.state, building, type);
    if (!result.ok) return this.ui.toast(result.reason, 'error');
    this.ui.toast(`${UNITS[type].name} donné au Château de Clan`, 'success');
    this.save(); this.dirty = true;
  }

  receiveClanTroop(buildingId, type) {
    const building = this.state.buildings.find((b) => b.id === buildingId && b.type === 'clanCastle');
    if (!building) return;
    const result = this.clans.receiveLocalReinforcement(this.state, building, type);
    if (!result.ok) return this.ui.toast(result.reason, 'error');
    this.ui.toast(`${UNITS[type].name} reçu en renfort`, 'success');
    this.save(); this.dirty = true;
  }

  // ── movement ────────────────────────────────────────────────────────

  finishLongPressMove(p) {
    const building = this.state.buildings.find((b) => b.id === this.interaction.movingId);
    if (!building || !this.drag?.original) return;
    const cell  = this.grid.screenToGrid(p.x, p.y, this.state.camera, this.renderer.viewport());
    const valid = this.grid.canPlace(building.type, cell.col, cell.row, BUILDINGS, this.state.buildings, building.id);
    if (valid) {
      building.col = cell.col; building.row = cell.row;
      this.ui.toast('Bâtiment déplacé', 'success');
    } else {
      building.col = this.drag.original.col; building.row = this.drag.original.row;
      this.ui.toast('Emplacement invalide — bâtiment replacé', 'error');
    }
    this.interaction.movingId   = null;
    this.interaction.liftedId   = null;
    this.interaction.preview    = null;
    this.interaction.selectedId = building.id;
    this.dirty = true;
  }

  // ── battle ──────────────────────────────────────────────────────────

  startBattle() {
    const army = armyCounts(this.state);
    const vp   = this.renderer.viewport();
    const result = this.battle.start({ ...this.state, army }, vp);
    if (!result.ok) return this.ui.toast(result.reason, 'error');
    bus.emit(EVENTS.BATTLE_STARTED, { state: this.battle.state });
  }

  finishBattle() {
    const result = this.battle.finish();
    // BUG-FIX #8 : finish() retourne null si déjà terminé — évite double emit
    if (result) bus.emit(EVENTS.BATTLE_FINISHED, { result });
  }

  applyBattleResult(result) {
    // BUG-FIX #8 : double protection contre double application du loot
    if (this.battle.state?.rewardApplied) return;
    if (!result) return;
    this.battle.state.rewardApplied = true;
    for (const [res, amt] of Object.entries(result.loot))
      this.state.resources[res] = (this.state.resources[res] ?? 0) + amt;
    const survivors = { ...this.battle.state.available };
    // BUG-FIX #9 : on accumule dans les garnisons existantes
    // au lieu de les écraser, pour ne pas perdre les troupes en place
    for (const [type, n] of Object.entries(survivors))
      for (let i = 0; i < n; i++) this.training.assignToCampfire(this.state, type);
    bus.emit(EVENTS.RESOURCES_CHANGED, { resources: this.state.resources });
    this.ui.updateBattle(this.battle.state);
    this.ui.showBattleResult(result);
    this.ui.toast(
      result.stars > 0 ? 'Raid terminé — butin récupéré' : 'Raid échoué',
      result.stars > 0 ? 'success' : 'error'
    );
    this.save(); this.dirty = true;
  }

  returnToVillage() {
    this.battle.state = null;
    this.ui.setBattleMode(false);
    this.ui.hideBattleResult();
    this.dirty = true;
  }

  // ── training ─────────────────────────────────────────────────────────

  trainUnit(type, barracksId = null) {
    const result = this.training.enqueue(this.state, type, Date.now(), barracksId);
    if (!result.ok) return this.ui.toast(result.reason, 'error');
    this.ui.toast(`${UNITS[type].name} ajouté à la file`, 'success');
    this.refreshQuests(); this.save(); this.dirty = true;
  }

  // ── placement ───────────────────────────────────────────────────────

  updatePreview(p) {
    const cell = this.grid.screenToGrid(p.x, p.y, this.state.camera, this.renderer.viewport());
    const type = this.interaction.movingId
      ? this.state.buildings.find((b) => b.id === this.interaction.movingId)?.type
      : this.interaction.placementType;
    if (!type) { this.interaction.preview = null; return; }
    this.interaction.preview = {
      type, col: cell.col, row: cell.row,
      valid: this.grid.canPlace(type, cell.col, cell.row, BUILDINGS, this.state.buildings, this.interaction.movingId)
    };
    this.dirty = true;
  }

  handleTap(p) {
    const cell     = this.grid.screenToGrid(p.x, p.y, this.state.camera, this.renderer.viewport());
    if (this.interaction.placementType || this.interaction.movingId) { this.place(cell); return; }
    const building = this.grid.buildingAt(cell.col, cell.row, BUILDINGS, this.state.buildings);
    if (!building) {
      this.interaction.selectedId = null;
      this.ui.closeContext();
      this.dirty = true;
      return;
    }
    if (BUILDINGS[building.type]?.extractor && building.readyAt <= Date.now()) {
      const result = this.economy.collectExtractor(this.state, building);
      if (result.ok) {
        bus.emit(EVENTS.EXTRACTOR_COLLECTED, { building, amount: result.amount, resource: result.resource });
        return;
      }
    }
    this.interaction.selectedId = building.id;
    if (!this.ui.openContext(this.state, building)) this.ui.closeContext();
    this.dirty = true;
  }

  placeWallPreview() {
    const preview = this.interaction.preview;
    if (!preview?.valid || this.drag.wallCells.has(`${preview.col},${preview.row}`)) return;
    this.drag.wallCells.add(`${preview.col},${preview.row}`);
    this.place({ col: preview.col, row: preview.row }, true);
  }

  place(cell, keepWallMode = false) {
    const type = this.interaction.movingId
      ? this.state.buildings.find((b) => b.id === this.interaction.movingId)?.type
      : this.interaction.placementType;
    if (!type || !this.grid.canPlace(type, cell.col, cell.row, BUILDINGS, this.state.buildings, this.interaction.movingId))
      return this.ui.toast('Emplacement impossible', 'error');
    if (this.interaction.movingId) {
      const building = this.state.buildings.find((b) => b.id === this.interaction.movingId);
      building.col = cell.col; building.row = cell.row;
      this.interaction.movingId   = null;
      this.interaction.liftedId   = null;
      this.interaction.selectedId = building.id;
    } else {
      if (!isBuildingUnlocked(type, this.state)) return this.ui.toast('Bâtiment verrouillé', 'error');
      const def = BUILDINGS[type];
      if (!this.economy.spend(this.state, def.cost)) return this.ui.toast('Ressources insuffisantes', 'error');
      const building = { id: makeId(), type, col: cell.col, row: cell.row, level: 1, readyAt: Date.now() + def.buildTime * 1000 };
      if (def.extractor)       { building.storedResource = 0; building.lastProductionAt = Date.now(); }
      if (def.panel === 'campfire')    building.garrison       = { skeleton: 0, ghoul: 0, necromancer: 0 };
      if (def.panel === 'clanCastle')  building.reinforcements = { skeleton: 0, ghoul: 0, necromancer: 0 };
      this.state.buildings.push(building);
      this.interaction.selectedId = building.id;
      if (!(type === 'wall' && keepWallMode)) this.interaction.placementType = null;
      bus.emit(EVENTS.BUILDING_PLACED, { building, type });
      this.ui.toast(`${def.name} placé`, 'success');
      this.refreshQuests();
    }
    this.clans.ensureState(this.state);
    this.interaction.preview = null;
    this.save(); this.dirty = true;
  }

  // ── upgrade / remove ───────────────────────────────────────────────

  upgradeSelected() {
    const building = this.state.buildings.find((b) => b.id === this.interaction.selectedId);
    if (!building || building.readyAt > Date.now()) return;
    const allowedMax = maxLevelFor(building.type, this.state, BUILDINGS);
    if (building.level >= allowedMax)
      return this.ui.toast(
        building.type === 'townHall' ? 'Niveau maximum' : 'Améliorez le Trône corrompu pour continuer',
        'error'
      );
    const cost = upgradeCost(building);
    if (!this.economy.spend(this.state, cost)) return this.ui.toast('Ressources insuffisantes', 'error');
    building.level  += 1;
    building.readyAt = Date.now() + upgradeTime(building) * 1000;
    bus.emit(EVENTS.BUILDING_UPGRADED, { building });
    bus.emit(EVENTS.RESOURCES_CHANGED, { resources: this.state.resources });
    this.ui.toast(`Amélioration niveau ${building.level}`, 'success');
    this.refreshQuests(); this.save(); this.dirty = true;
  }

  removeSelected() {
    const building = this.state.buildings.find((b) => b.id === this.interaction.selectedId);
    if (!building || building.type === 'townHall') return;
    if (building.type === 'campfire' && Object.values(building.garrison ?? {}).some((n) => n > 0))
      return this.ui.toast('Videz ce Brasier avant de le retirer', 'error');
    if (building.type === 'clanCastle' && Object.values(building.reinforcements ?? {}).some((n) => n > 0))
      return this.ui.toast('Videz les renforts avant de retirer le Château', 'error');
    Object.entries(BUILDINGS[building.type].cost).forEach(([res, amt]) => {
      this.state.resources[res] += Math.floor(amt * 0.5);
    });
    this.state.buildings = this.state.buildings.filter((b) => b.id !== building.id);
    this.interaction.selectedId = null;
    this.ui.closeContext();
    bus.emit(EVENTS.BUILDING_REMOVED,   { building });
    bus.emit(EVENTS.RESOURCES_CHANGED,  { resources: this.state.resources });
    this.ui.toast('Bâtiment retiré');
    this.save(); this.dirty = true;
  }

  // ── quests ──────────────────────────────────────────────────────────

  refreshQuests() {
    this.state.completedQuests ??= [];
    this.state.claimedQuests   ??= [];
    const counts = armyCounts(this.state);
    for (const quest of QUESTS) {
      let done = false;
      if (quest.type === 'build') done = this.state.buildings.some((b) => b.type === quest.target);
      if (quest.type === 'level') done = this.state.buildings.some((b) => b.type === quest.target && b.level >= quest.value);
      if (quest.type === 'train') done = (counts[quest.target] ?? 0) >= quest.value;
      if (done && !this.state.completedQuests.includes(quest.id)) {
        this.state.completedQuests.push(quest.id);
        for (const [res, amt] of Object.entries(quest.reward))
          this.state.resources[res] = (this.state.resources[res] ?? 0) + amt;
        this.state.claimedQuests.push(quest.id);
        bus.emit(EVENTS.QUEST_COMPLETED, { id: quest.id, text: quest.text, reward: quest.reward });
      }
    }
  }

  currentQuest() {
    return QUESTS.find((q) => !this.state.completedQuests.includes(q.id)) ?? null;
  }

  // ── game loop ─────────────────────────────────────────────────────────

  update(dt) {
    if (this.battle.state?.active) {
      const result = this.battle.update(dt);
      if (result) bus.emit(EVENTS.BATTLE_FINISHED, { result });
      this.ui.updateBattle(this.battle.state);
      this.dirty = true;
      return;
    }
    this.economy.applyExtractorProduction(this.state, dt);
    const completedUnits = this.training.update(this.state);
    if (completedUnits.length > 0) {
      for (const completed of completedUnits) {
        this.interaction.troopTransfers.push({ ...completed, createdAt: performance.now() });
        bus.emit(EVENTS.UNIT_TRAINED, { type: completed.type, campfireId: completed.campfireId });
      }
      this.dirty = true;
    }
    const caps = resourceCaps(this.state);
    for (const res of Object.keys(this.state.resources))
      this.state.resources[res] = Math.min(caps[res], this.state.resources[res]);
    const now = performance.now();
    this.interaction.collectionPopups = this.interaction.collectionPopups.filter((p) => now - p.createdAt < 1200);
    this.interaction.troopTransfers   = this.interaction.troopTransfers.filter((t) => now - t.createdAt < 1400);
    for (const b of this.state.buildings) {
      if (b.readyAt > 0 && b.readyAt <= Date.now() && !b._readyEmitted) {
        b._readyEmitted = true;
        bus.emit(EVENTS.BUILDING_READY, { building: b });
      }
    }
    this.refreshQuests();
  }

  save() { this.state.savedAt = Date.now(); this.saveManager.save(this.state); }

  loop(time) {
    if (!this.running) return;
    const dt = Math.min(0.1, (time - this.lastFrame) / 1000);
    this.lastFrame = time;
    this.update(dt);
    if (this.dirty || time - this.lastUiUpdate > 250) {
      this.renderer.render(this.state, this.interaction, time, this.battle.state);
      if (!this.battle.state?.active && !this.battle.state?.result)
        this.ui.update(this.state, this.interaction.selectedId, this.interaction.placementType, this.currentQuest());
      this.lastUiUpdate = time;
      this.dirty = false;
    }
    requestAnimationFrame((next) => this.loop(next));
  }
}
