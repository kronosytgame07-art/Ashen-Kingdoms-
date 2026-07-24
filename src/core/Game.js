import { BUILDINGS, upgradeCost, upgradeTime } from '../data/buildings.js';
import { Grid } from './Grid.js';
import { SaveManager } from './SaveManager.js';
import { AssetManager } from './AssetManager.js';
import { Renderer } from './Renderer.js';
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
    this.ui = new GameUI(BUILDINGS);
    this.state = this.saveManager.load(() => ({
      version: 2,
      resources: { gold: 650, wood: 520, essence: 80 },
      buildings: [{ id: makeId(), type: 'townHall', col: 7, row: 7, level: 1, readyAt: 0 }],
      buildQueue: [],
      camera: { x: 0, y: -20, zoom: 1 },
      tutorialStep: 0,
      savedAt: Date.now()
    }));
    this.interaction = { selectedId: null, placementType: null, movingId: null, preview: null };
    this.pointers = new Map();
    this.drag = null;
    this.pinch = null;
    this.lastFrame = performance.now();
    this.lastUiUpdate = 0;
    this.dirty = true;
  }

  async start() {
    await this.assets.loadImage('townHall', 'assets/buildings/hdv1.png');
    this.bindEvents();
    this.renderer.resize();
    requestAnimationFrame((time) => this.loop(time));
    setInterval(() => this.save(), 5000);
  }

  bindEvents() {
    const position = (event) => { const r = this.canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
    this.canvas.addEventListener('pointerdown', (event) => {
      this.canvas.setPointerCapture(event.pointerId);
      const pos = position(event); this.pointers.set(event.pointerId, pos);
      if (this.pointers.size === 2) {
        const [a,b] = [...this.pointers.values()];
        this.pinch = { distance: Math.hypot(a.x-b.x,a.y-b.y), zoom: this.state.camera.zoom, center: { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }, camera: { ...this.state.camera } };
        this.drag = null; return;
      }
      this.drag = { start: pos, camera: { ...this.state.camera }, moved: false, wallCells: new Set() };
      this.updatePreview(pos);
    });

    this.canvas.addEventListener('pointermove', (event) => {
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
      if (this.pointers.size < 2) this.pinch = null;
      if (this.drag && !this.drag.moved) this.handleTap(pos);
      this.drag = null; this.save();
    };
    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);
    this.canvas.addEventListener('wheel', (event) => { event.preventDefault(); this.state.camera.zoom = clamp(this.state.camera.zoom - Math.sign(event.deltaY)*.08,.55,1.65); this.dirty=true; }, { passive:false });
    window.addEventListener('resize', () => { this.renderer.resize(); this.dirty=true; });
    window.addEventListener('beforeunload', () => this.save());

    this.ui.bind({
      onBuild: (type) => { this.interaction.placementType=type; this.interaction.movingId=null; this.interaction.selectedId=null; this.ui.toast(`Placez : ${BUILDINGS[type].name}`); },
      onMove: () => { if(!this.interaction.selectedId)return; this.interaction.movingId=this.interaction.selectedId; this.interaction.selectedId=null; this.ui.toast('Choisissez le nouvel emplacement'); },
      onUpgrade: () => this.upgradeSelected(),
      onRemove: () => this.removeSelected(),
      onCenter: () => { this.state.camera={x:0,y:-20,zoom:1}; this.dirty=true; }
    });
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
    const p=this.interaction.preview; if(!p?.valid || this.drag.wallCells.has(`${p.col},${p.row}`)) return;
    this.drag.wallCells.add(`${p.col},${p.row}`); this.place({col:p.col,row:p.row}, true);
  }

  place(cell, keepWallMode=false) {
    const type=this.interaction.movingId ? this.state.buildings.find((b)=>b.id===this.interaction.movingId)?.type : this.interaction.placementType;
    if(!type || !this.grid.canPlace(type,cell.col,cell.row,BUILDINGS,this.state.buildings,this.interaction.movingId)) return this.ui.toast('Emplacement impossible','error');
    if(this.interaction.movingId){ const b=this.state.buildings.find((x)=>x.id===this.interaction.movingId); b.col=cell.col;b.row=cell.row;this.interaction.movingId=null;this.interaction.selectedId=b.id; }
    else {
      const def=BUILDINGS[type];
      if(Object.entries(def.cost).some(([k,v])=>this.state.resources[k]<v)) return this.ui.toast('Ressources insuffisantes','error');
      Object.entries(def.cost).forEach(([k,v])=>this.state.resources[k]-=v);
      const building={id:makeId(),type,col:cell.col,row:cell.row,level:1,readyAt:Date.now()+def.buildTime*1000};
      this.state.buildings.push(building); this.interaction.selectedId=building.id;
      if(!(type==='wall'&&keepWallMode)) this.interaction.placementType=null;
      this.ui.toast(`${def.name} placé`,'success');
    }
    this.interaction.preview=null; this.save(); this.dirty=true;
  }

  upgradeSelected() {
    const b=this.state.buildings.find((x)=>x.id===this.interaction.selectedId); if(!b||b.readyAt>Date.now())return;
    const def=BUILDINGS[b.type]; if(b.level>=def.maxLevel)return this.ui.toast('Niveau maximum');
    const cost=upgradeCost(b); if(Object.entries(cost).some(([k,v])=>this.state.resources[k]<v))return this.ui.toast('Ressources insuffisantes','error');
    Object.entries(cost).forEach(([k,v])=>this.state.resources[k]-=v); b.level+=1; b.readyAt=Date.now()+upgradeTime(b)*1000; this.ui.toast(`Amélioration niveau ${b.level}`,'success'); this.save(); this.dirty=true;
  }

  removeSelected() {
    const b=this.state.buildings.find((x)=>x.id===this.interaction.selectedId); if(!b||b.type==='townHall')return;
    Object.entries(BUILDINGS[b.type].cost).forEach(([k,v])=>this.state.resources[k]+=Math.floor(v*.5));
    this.state.buildings=this.state.buildings.filter((x)=>x.id!==b.id); this.interaction.selectedId=null; this.ui.toast('Bâtiment retiré'); this.save(); this.dirty=true;
  }

  update(dt) {
    for(const b of this.state.buildings){ const p=BUILDINGS[b.type].production; if(!p||b.readyAt>Date.now())continue; this.state.resources[p.resource]+=p.perSecond*(1+(b.level-1)*.35)*dt; }
    Object.keys(this.state.resources).forEach((k)=>this.state.resources[k]=Math.min(999999,this.state.resources[k]));
  }

  save() { this.saveManager.save(this.state); }

  loop(time) {
    const dt=Math.min(.1,(time-this.lastFrame)/1000); this.lastFrame=time; this.update(dt);
    if(this.dirty || time-this.lastUiUpdate>250){ this.renderer.render(this.state,this.interaction,time); this.ui.update(this.state,this.interaction.selectedId,this.interaction.placementType); this.lastUiUpdate=time; this.dirty=false; }
    requestAnimationFrame((next)=>this.loop(next));
  }
}
