import { BUILDINGS, resourceCaps, upgradeCost, upgradeTime } from '../data/buildings.js';
import { QUESTS, isBuildingUnlocked, maxLevelFor } from '../data/progression.js';
import { UNITS } from '../data/units.js';
import { Grid } from './Grid.js';
import { SaveManager } from './SaveManager.js';
import { AssetManager } from './AssetManager.js';
import { Renderer } from './Renderer.js';
import { Economy } from './Economy.js';
import { TrainingManager } from './TrainingManager.js';
import { BattleManager } from './BattleManager.js';
import { GameUI } from '../ui/GameUI.js';

const makeId = () => globalThis.crypto?.randomUUID?.() || `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.grid = new Grid();
    this.saveManager = new SaveManager('ashen-kingdoms-save-v2');
    this.assets = new AssetManager();
    this.renderer = new Renderer(canvas, this.grid, BUILDINGS, this.assets);
    this.economy = new Economy();
    this.training = new TrainingManager();
    this.battle = new BattleManager();
    this.ui = new GameUI(BUILDINGS);
    this.state = this.saveManager.load(() => ({
      version: 2,
      resources: { gold: 650, wood: 520, essence: 80 },
      buildings: [{ id: makeId(), type: 'townHall', col: 7, row: 7, level: 1, readyAt: 0 }],
      buildQueue: [],
      trainingQueue: [],
      army: { skeleton: 0, ghoul: 0, necromancer: 0 },
      camera: { x: 0, y: -20, zoom: 1 },
      tutorialStep: 0,
      completedQuests: [],
      claimedQuests: [],
      savedAt: Date.now()
    }));
    this.training.ensureState(this.state);
    this.interaction = { selectedId: null, placementType: null, movingId: null, preview: null };
    this.pointers = new Map();
    this.drag = null;
    this.pinch = null;
    this.lastFrame = performance.now();
    this.lastUiUpdate = 0;
    this.dirty = true;
  }

  async start() {
    for (const [type, definition] of Object.entries(BUILDINGS)) {
      if (definition.sprite) await this.assets.loadImage(type, definition.sprite);
    }
    const offline = this.economy.applyOfflineProgress(this.state);
    const trainedOffline = this.training.applyOfflineProgress(this.state);
    this.refreshQuests();
    this.bindEvents();
    this.renderer.resize();
    this.notifyOfflineProgress(offline, trainedOffline);
    requestAnimationFrame((time) => this.loop(time));
    setInterval(() => this.save(), 5000);
  }

  notifyOfflineProgress(result, trainedOffline = []) {
    const total = Object.values(result.gained).reduce((sum, value) => sum + value, 0);
    if (trainedOffline.length > 0) this.ui.toast(`${trainedOffline.length} troupe(s) prête(s) pendant votre absence`, 'success');
    else if (result.completed > 0) this.ui.toast(`${result.completed} construction(s) terminée(s) pendant votre absence`, 'success');
    else if (result.elapsedSeconds > 30 && total >= 1) this.ui.toast('Production hors ligne récupérée', 'success');
  }

  bindEvents() {
    const position = (event) => { const r = this.canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
    this.canvas.addEventListener('pointerdown', (event) => {
      this.canvas.setPointerCapture(event.pointerId);
      const pos = position(event); this.pointers.set(event.pointerId, pos);
      if (this.battle.state?.active) {
        if (this.battle.deploy(pos.x, pos.y, this.renderer.viewport())) { this.ui.updateBattle(this.battle.state); this.dirty = true; }
        return;
      }
      if (this.pointers.size === 2) {
        const [a,b] = [...this.pointers.values()];
        this.pinch = { distance: Math.hypot(a.x-b.x,a.y-b.y), zoom: this.state.camera.zoom, center: { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }, camera: { ...this.state.camera } };
        this.drag = null; return;
      }
      this.drag = { start: pos, camera: { ...this.state.camera }, moved: false, wallCells: new Set() };
      this.updatePreview(pos);
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (this.battle.state?.active) return;
      if (!this.pointers.has(event.pointerId)) return;
      const pos = position(event); this.pointers.set(event.pointerId, pos);
      if (this.pointers.size === 2 && this.pinch) {
        const [a,b] = [...this.pointers.values()];
        const center = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
        const zoom = clamp(this.pinch.zoom * Math.hypot(a.x-b.x,a.y-b.y) / this.pinch.distance, .55, 1.65);
        this.state.camera.zoom = zoom;
        this.state.camera.x = this.pinch.camera.x + (center.x - this.pinch.center.x);
        this.state.camera.y = this.pinch.camera.y + (center.y - this.pinch.center.y);
        this.dirty = true; return;
      }
      if (!this.drag) return;
      const dx = pos.x-this.drag.start.x, dy = pos.y-this.drag.start.y;
      this.drag.moved ||= Math.hypot(dx,dy) > 7;
      if (this.interaction.placementType || this.interaction.movingId) {
        this.updatePreview(pos);
        if (this.interaction.placementType === 'wall' && this.drag.moved) this.placeWallPreview();
      } else if (this.drag.moved) {
        this.state.camera.x = this.drag.camera.x + dx; this.state.camera.y = this.drag.camera.y + dy; this.dirty = true;
      }
    });

    const endPointer = (event) => {
      const pos = position(event); this.pointers.delete(event.pointerId);
      if (this.battle.state?.active) return;
      if (this.pointers.size < 2) this.pinch = null;
      if (this.drag && !this.drag.moved) this.handleTap(pos);
      this.drag = null; this.save();
    };
    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);
    this.canvas.addEventListener('wheel', (event) => { if (this.battle.state?.active) return; event.preventDefault(); this.state.camera.zoom = clamp(this.state.camera.zoom - Math.sign(event.deltaY)*.08,.55,1.65); this.dirty=true; }, { passive:false });
    window.addEventListener('resize', () => { this.renderer.resize(); this.dirty=true; });
    window.addEventListener('beforeunload', () => this.save());

    this.ui.bind({
      onBuild: (type) => {
        if (!isBuildingUnlocked(type, this.state)) return this.ui.toast('Améliorez le Trône corrompu pour débloquer ce bâtiment', 'error');
        this.interaction.placementType=type; this.interaction.movingId=null; this.interaction.selectedId=null;
        this.ui.toast(`Placez : ${BUILDINGS[type].name}`);
      },
      onTrain: (type) => this.trainUnit(type),
      onMove: () => { if(!this.interaction.selectedId)return; this.interaction.movingId=this.interaction.selectedId; this.interaction.selectedId=null; this.ui.toast('Choisissez le nouvel emplacement'); },
      onUpgrade: () => this.upgradeSelected(),
      onRemove: () => this.removeSelected(),
      onCenter: () => { this.state.camera={x:0,y:-20,zoom:1}; this.dirty=true; },
      onAttack: () => this.startBattle(),
      onSelectBattleUnit: (type) => { if (this.battle.selectUnit(type)) { this.ui.updateBattle(this.battle.state); this.dirty = true; } },
      onEndBattle: () => this.finishBattle(),
      onReturnVillage: () => this.returnToVillage()
    });
  }

  startBattle() {
    const result = this.battle.start(this.state);
    if (!result.ok) return this.ui.toast(result.reason, 'error');
    this.ui.setBattleMode(true);
    this.ui.hideBattleResult();
    this.ui.updateBattle(this.battle.state);
    this.ui.toast('Touchez le champ de bataille pour déployer vos troupes', 'success');
    this.dirty = true;
  }

  finishBattle() {
    const result = this.battle.finish();
    if (!result) return;
    this.applyBattleResult(result);
  }

  applyBattleResult(result) {
    if (this.battle.state?.rewardApplied) return;
    this.battle.state.rewardApplied = true;
    for (const [resource, amount] of Object.entries(result.loot)) this.state.resources[resource] = (this.state.resources[resource] ?? 0) + amount;
    for (const type of Object.keys(this.state.army)) this.state.army[type] = this.battle.state.available[type] ?? 0;
    this.ui.updateBattle(this.battle.state);
    this.ui.showBattleResult(result);
    this.ui.toast(result.stars > 0 ? 'Raid terminé — butin récupéré' : 'Raid échoué', result.stars > 0 ? 'success' : 'error');
    this.save();
    this.dirty = true;
  }

  returnToVillage() {
    this.battle.state = null;
    this.ui.setBattleMode(false);
    this.ui.hideBattleResult();
    this.dirty = true;
  }

  trainUnit(type) {
    const result = this.training.enqueue(this.state, type);
    if (!result.ok) return this.ui.toast(result.reason, 'error');
    this.ui.toast(`${UNITS[type].name} ajouté à la file`, 'success');
    this.refreshQuests();
    this.save();
    this.dirty = true;
  }

  updatePreview(pos) {
    const cell = this.grid.screenToGrid(pos.x,pos.y,this.state.camera,this.renderer.viewport());
    const type = this.interaction.movingId ? this.state.buildings.find((b)=>b.id===this.interaction.movingId)?.type : this.interaction.placementType;
    if (!type) { this.interaction.preview=null; return; }
    this.interaction.preview = { type, col:cell.col, row:cell.row, valid:this.grid.canPlace(type,cell.col,cell.row,BUILDINGS,this.state.buildings,this.interaction.movingId) };
    this.dirty=true;
  }

  handleTap(pos) {
    const cell = this.grid.screenToGrid(pos.x,pos.y,this.state.camera,this.renderer.viewport());
    if (this.interaction.placementType || this.interaction.movingId) this.place(cell);
    else this.interaction.selectedId = this.grid.buildingAt(cell.col,cell.row,BUILDINGS,this.state.buildings)?.id || null;
    this.dirty=true;
  }

  placeWallPreview() {
    const preview=this.interaction.preview; if(!preview?.valid || this.drag.wallCells.has(`${preview.col},${preview.row}`)) return;
    this.drag.wallCells.add(`${preview.col},${preview.row}`); this.place({col:preview.col,row:preview.row}, true);
  }

  place(cell, keepWallMode=false) {
    const type=this.interaction.movingId ? this.state.buildings.find((building)=>building.id===this.interaction.movingId)?.type : this.interaction.placementType;
    if(!type || !this.grid.canPlace(type,cell.col,cell.row,BUILDINGS,this.state.buildings,this.interaction.movingId)) return this.ui.toast('Emplacement impossible','error');
    if(this.interaction.movingId){
      const building=this.state.buildings.find((item)=>item.id===this.interaction.movingId);
      building.col=cell.col; building.row=cell.row; this.interaction.movingId=null; this.interaction.selectedId=building.id;
    } else {
      if (!isBuildingUnlocked(type, this.state)) return this.ui.toast('Bâtiment verrouillé', 'error');
      const definition=BUILDINGS[type];
      if(!this.economy.spend(this.state, definition.cost)) return this.ui.toast('Ressources insuffisantes','error');
      const building={id:makeId(),type,col:cell.col,row:cell.row,level:1,readyAt:Date.now()+definition.buildTime*1000};
      this.state.buildings.push(building); this.interaction.selectedId=building.id;
      if(!(type==='wall'&&keepWallMode)) this.interaction.placementType=null;
      this.ui.toast(`${definition.name} placé`,'success');
      this.refreshQuests();
    }
    this.interaction.preview=null; this.save(); this.dirty=true;
  }

  upgradeSelected() {
    const building=this.state.buildings.find((item)=>item.id===this.interaction.selectedId);
    if(!building||building.readyAt>Date.now())return;
    const definition=BUILDINGS[building.type];
    const allowedMax=maxLevelFor(building.type,this.state,BUILDINGS);
    if(building.level>=allowedMax){
      const reason = building.type === 'townHall' ? 'Niveau maximum' : 'Améliorez le Trône corrompu pour continuer';
      return this.ui.toast(reason, 'error');
    }
    const cost=upgradeCost(building);
    if(!this.economy.spend(this.state,cost)) return this.ui.toast('Ressources insuffisantes','error');
    building.level+=1;
    building.readyAt=Date.now()+upgradeTime(building)*1000;
    this.ui.toast(`Amélioration niveau ${building.level}`,'success');
    this.refreshQuests();
    this.save(); this.dirty=true;
  }

  removeSelected() {
    const building=this.state.buildings.find((item)=>item.id===this.interaction.selectedId); if(!building||building.type==='townHall')return;
    Object.entries(BUILDINGS[building.type].cost).forEach(([resource,amount])=>this.state.resources[resource]+=Math.floor(amount*.5));
    this.state.buildings=this.state.buildings.filter((item)=>item.id!==building.id); this.interaction.selectedId=null;
    this.ui.toast('Bâtiment retiré'); this.save(); this.dirty=true;
  }

  refreshQuests() {
    this.state.completedQuests ??= [];
    this.state.claimedQuests ??= [];
    for (const quest of QUESTS) {
      let complete = false;
      if (quest.type === 'build') complete = this.state.buildings.some((building) => building.type === quest.target);
      if (quest.type === 'level') complete = this.state.buildings.some((building) => building.type === quest.target && building.level >= quest.value);
      if (quest.type === 'train') complete = (this.state.army?.[quest.target] ?? 0) >= quest.value;
      if (complete && !this.state.completedQuests.includes(quest.id)) {
        this.state.completedQuests.push(quest.id);
        for (const [resource, amount] of Object.entries(quest.reward)) this.state.resources[resource] = (this.state.resources[resource] ?? 0) + amount;
        this.state.claimedQuests.push(quest.id);
        this.ui.toast(`Objectif accompli : ${quest.text}`, 'success');
      }
    }
  }

  currentQuest() { return QUESTS.find((quest) => !this.state.completedQuests.includes(quest.id)) ?? null; }

  update(dt) {
    if (this.battle.state?.active) {
      const result = this.battle.update(dt, this.renderer.viewport());
      if (result) this.applyBattleResult(result);
      this.ui.updateBattle(this.battle.state);
      this.dirty = true;
      return;
    }
    this.economy.applyProduction(this.state, dt);
    const completedUnits = this.training.update(this.state);
    if (completedUnits.length > 0) {
      const last = completedUnits.at(-1);
      this.ui.toast(`${UNITS[last].name} prêt`, 'success');
      this.dirty = true;
    }
    const caps = resourceCaps(this.state);
    for (const resource of Object.keys(this.state.resources)) this.state.resources[resource]=Math.min(caps[resource],this.state.resources[resource]);
    this.refreshQuests();
  }

  save() { this.state.savedAt = Date.now(); this.saveManager.save(this.state); }

  loop(time) {
    const dt=Math.min(.1,(time-this.lastFrame)/1000); this.lastFrame=time; this.update(dt);
    if(this.dirty || time-this.lastUiUpdate>250){
      this.renderer.render(this.state,this.interaction,time,this.battle.state);
      if (!this.battle.state?.active && !this.battle.state?.result) this.ui.update(this.state,this.interaction.selectedId,this.interaction.placementType,this.currentQuest());
      this.lastUiUpdate=time; this.dirty=false;
    }
    requestAnimationFrame((next)=>this.loop(next));
  }
}