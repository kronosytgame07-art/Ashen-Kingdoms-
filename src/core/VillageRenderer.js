export class VillageRenderer {
  constructor(canvas, grid, definitions, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = grid;
    this.definitions = definitions;
    this.assets = assets;
    this.spriteFrameCache = new Map();
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }

  polygon(points, fill, stroke, width = 1) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => c.lineTo(p.x, p.y));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }

  tile(col, row, camera, fill, stroke = 'rgba(111,91,128,.28)') {
    const pt = this.grid.gridToScreen(col, row, camera, this.viewport());
    const hw = this.grid.tileWidth * camera.zoom / 2;
    const hh = this.grid.tileHeight * camera.zoom / 2;
    this.polygon([
      { x: pt.x, y: pt.y },
      { x: pt.x + hw, y: pt.y + hh },
      { x: pt.x, y: pt.y + hh * 2 },
      { x: pt.x - hw, y: pt.y + hh }
    ], fill, stroke, Math.max(.7, camera.zoom));
  }

  ground(camera, time) {
    const c = this.ctx;
    const vp = this.viewport();
    const grad = c.createLinearGradient(0, 0, 0, vp.height);
    grad.addColorStop(0, '#2e2638');
    grad.addColorStop(.55, '#211b29');
    grad.addColorStop(1, '#110e16');
    c.fillStyle = grad;
    c.fillRect(0, 0, vp.width, vp.height);
    for (let col = 0; col < this.grid.columns; col++) {
      for (let row = 0; row < this.grid.rows; row++) {
        this.tile(col, row, camera, (col + row) % 2 ? 'rgba(55,49,60,.86)' : 'rgba(47,42,52,.86)');
      }
    }
    c.save();
    c.globalAlpha = .16;
    for (let i = 0; i < 40; i++) {
      const x = (i * 191 + time * .008 * (i % 3 + 1)) % vp.width;
      const y = (i * 83) % vp.height;
      c.fillStyle = i % 4 ? '#8d789c' : '#bd88ff';
      c.fillRect(x, y, 1.5, 1.5);
    }
    c.restore();
  }

  footprint(building, camera, selected, valid = null) {
    const def = this.definitions[building.type];
    for (let x = 0; x < def.size.w; x++) {
      for (let y = 0; y < def.size.h; y++) {
        const fill = valid === true ? 'rgba(93,226,154,.30)' : valid === false ? 'rgba(229,68,85,.36)' : selected ? 'rgba(166,108,255,.22)' : 'rgba(5,4,8,.22)';
        const stroke = valid === true ? '#67e7a3' : valid === false ? '#ff6675' : selected ? '#c08cff' : 'rgba(0,0,0,.2)';
        this.tile(building.col + x, building.row + y, camera, fill, stroke);
      }
    }
  }

  buildingAnchor(building, state) {
    const def = this.definitions[building.type];
    const cam = state.camera;
    const scale = cam.zoom;
    const pt = this.grid.gridToScreen(building.col + def.size.w / 2, building.row + def.size.h / 2, cam, this.viewport());
    return { x: pt.x, y: pt.y + this.grid.tileHeight * def.size.h * .48 * scale, scale, def };
  }

  // ── sprite helpers ─────────────────────────────────────────────────────────

  _createSpriteFrame(sprite, sheet, frameIndex) {
    const cols = Math.max(1, sheet.columns ?? 1);
    const rows = Math.max(1, sheet.rows ?? 1);
    const fw = Math.floor(sprite.width / cols);
    const fh = Math.floor(sprite.height / rows);
    const offscreen = document.createElement('canvas');
    offscreen.width = fw; offscreen.height = fh;
    const ctx = offscreen.getContext('2d', { willReadFrequently: Boolean(sheet.removeBackground) });
    ctx.drawImage(sprite, (frameIndex % cols) * fw, Math.floor(frameIndex / cols) * fh, fw, fh, 0, 0, fw, fh);
    if (sheet.removeBackground) this._removeBackground(ctx, fw, fh, sheet.backgroundTolerance ?? 28);
    return offscreen;
  }

  _removeBackground(ctx, width, height, tolerance) {
    try {
      const img = ctx.getImageData(0, 0, width, height);
      const d = img.data;
      const corners = [[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
      const bg = corners.reduce((s,[x,y])=>{ const i=(y*width+x)*4; s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2]; return s; },[0,0,0]).map(v=>v/4);
      const visited = new Uint8Array(width * height);
      const queue = [];
      const push = (x, y) => {
        if (x<0||y<0||x>=width||y>=height) return;
        const pos = y*width+x;
        if (visited[pos]) return;
        const i = pos*4;
        if (Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]) > tolerance) return;
        visited[pos]=1; queue.push(pos);
      };
      for (let x=0;x<width;x++){push(x,0);push(x,height-1);}
      for (let y=0;y<height;y++){push(0,y);push(width-1,y);}
      for (let cur=0;cur<queue.length;cur++){
        const pos=queue[cur]; const x=pos%width; const y=Math.floor(pos/width);
        d[pos*4+3]=0; push(x-1,y);push(x+1,y);push(x,y-1);push(x,y+1);
      }
      ctx.putImageData(img,0,0);
    } catch(e) { console.warn('[VillageRenderer] Détourage spritesheet échoué',e); }
  }

  _getSpriteFrame(type, sprite, sheet, time) {
    if (!sheet) return sprite;
    const count = Math.max(1, Math.min(sheet.frames ?? sheet.columns*sheet.rows, sheet.columns*sheet.rows));
    const idx = Math.floor(time/1000*(sheet.fps??2)) % count;
    const key = `${type}:${idx}`;
    if (!this.spriteFrameCache.has(key)) this.spriteFrameCache.set(key, this._createSpriteFrame(sprite, sheet, idx));
    return this.spriteFrameCache.get(key);
  }

  // ── building draw ───────────────────────────────────────────────────────────

  drawBuilding(building, state, selected, time, lifted = false) {
    const def = this.definitions[building.type];
    const cam = state.camera;
    const scale = cam.zoom;
    this.footprint(building, cam, selected);
    const pt = this.grid.gridToScreen(building.col + def.size.w/2, building.row + def.size.h/2, cam, this.viewport());
    const baseY = pt.y + this.grid.tileHeight * def.size.h * .48 * scale;
    const w = this.grid.tileWidth * def.size.w * .62 * scale;
    const h = (building.type === 'wall' ? 28 : 58 + def.size.h * 9) * scale;
    const c = this.ctx;
    c.save();
    c.translate(pt.x, baseY - (lifted ? 10*scale : 0));
    if (lifted) c.scale(1.05, 1.05);
    c.globalAlpha = building.readyAt > Date.now() ? .65 : 1;
    c.beginPath();
    c.ellipse(0, 5*scale, w*(lifted?.64:.56), lifted?18*scale:13*scale, 0, 0, Math.PI*2);
    c.fillStyle = lifted?'rgba(0,0,0,.62)':'rgba(0,0,0,.45)'; c.fill();
    const sprite = this.assets.get(building.type);
    if (sprite) {
      const frame = this._getSpriteFrame(building.type, sprite, def.spriteSheet, time);
      const sr = def.spriteRender ?? {};
      const fpW = this.grid.tileWidth * (sr.maxTilesWide ?? def.size.w) * scale;
      const targetW = Math.min(this.grid.tileWidth * def.size.w * 1.48 * scale, fpW) * (sr.renderScale ?? 1);
      const targetH = targetW * (frame.height / frame.width);
      c.drawImage(frame, -targetW/2+(sr.offsetX??0)*scale, -targetH*Math.max(0,Math.min(1,sr.anchorY??1))+(sr.offsetY??0)*scale, targetW, targetH);
    } else if (building.type === 'wall') {
      c.fillStyle = def.colors[0]; c.fillRect(-w/2, -h, w, h);
      c.fillStyle = '#756b7c';
      for (let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*w/5,-h);c.lineTo(i*w/5+w/10,-h-12*scale);c.lineTo(i*w/5+w/5,-h);c.fill();}
    } else {
      const top = -h*.65;
      c.fillStyle=def.colors[0]; c.fillRect(-w/2,top,w,h*.65);
      this.polygon([{x:-w*.58,y:top},{x:0,y:-h},{x:w*.58,y:top}],def.colors[1],'#0d0b0f',2*scale);
      c.shadowColor=def.colors[2]; c.shadowBlur=(8+Math.sin(time/550)*3)*scale;
      c.fillStyle=def.colors[2]; c.fillRect(-w*.06,-h*.28,w*.12,h*.11); c.shadowBlur=0;
    }
    if (lifted){c.strokeStyle='#d7b0ff';c.lineWidth=2*scale;c.strokeRect(-w*.55,-h*1.08,w*1.1,h*1.14);}
    if (building.readyAt > Date.now()) {
      c.fillStyle='rgba(9,7,12,.9)'; c.fillRect(-38*scale,-h-28*scale,76*scale,21*scale);
      c.fillStyle='#dfc4ff'; c.textAlign='center'; c.font=`700 ${Math.max(10,11*scale)}px 'Cinzel',serif`;
      c.fillText(`${Math.ceil((building.readyAt-Date.now())/1000)}s`,0,-h-13*scale);
    }
    c.restore();
  }

  // ── garrison / popups / transfers ──────────────────────────────────────────

  drawCollectionBubble(building, state, time) {
    const def = this.definitions[building.type];
    if (!def?.extractor || building.readyAt > Date.now()) return;
    const stored = building.storedResource ?? 0;
    const threshold = def.extractor.collectThreshold ?? 1;
    if (stored < threshold) return;
    const capacity = def.extractor.capacity * (1 + (building.level-1)*.5);
    const full = stored >= capacity * .98;
    const {x,y,scale} = this.buildingAnchor(building, state);
    const c = this.ctx;
    const bob = Math.sin(time/260+building.col)*4*scale;
    c.save();
    c.translate(x, y-92*scale+bob);
    c.shadowColor = full?'#ff6878':def.colors[2]; c.shadowBlur=(full?18:11)*scale;
    c.fillStyle = full?'rgba(85,20,30,.96)':'rgba(18,13,25,.96)';
    c.strokeStyle = full?'#ff6878':def.colors[2]; c.lineWidth=Math.max(1.5,2*scale);
    c.beginPath(); c.arc(0,0,18*scale,0,Math.PI*2); c.fill(); c.stroke(); c.shadowBlur=0;
    c.fillStyle=def.colors[2]; c.textAlign='center'; c.textBaseline='middle';
    c.font=`800 ${Math.max(12,15*scale)}px 'Cinzel',serif`;
    const icon = def.extractor.resource==='gold'?'●':def.extractor.resource==='wood'?'◆':'✦';
    c.fillText(icon,0,-1*scale);
    c.fillStyle='#fff'; c.font=`800 ${Math.max(8,9*scale)}px sans-serif`;
    c.fillText(full?'!':Math.floor(stored),0,22*scale);
    c.restore();
  }

  drawCollectionPopups(interaction, state, time) {
    const c = this.ctx;
    for (const popup of interaction.collectionPopups ?? []) {
      const building = state.buildings.find(b=>b.id===popup.buildingId);
      if (!building) continue;
      const age = Math.max(0,time-popup.createdAt);
      const prog = Math.min(1,age/1200);
      const {x,y,scale} = this.buildingAnchor(building,state);
      c.save(); c.globalAlpha=1-prog;
      c.translate(x,y-70*scale-prog*42*scale);
      c.fillStyle=popup.resource==='gold'?'#f0c45e':popup.resource==='wood'?'#c08b54':'#c48cff';
      c.shadowColor=c.fillStyle; c.shadowBlur=12*scale;
      c.textAlign='center'; c.font=`900 ${Math.max(14,18*scale)}px sans-serif`;
      c.fillText(`+${popup.amount}`,0,0); c.restore();
    }
  }

  drawVillageUnit(x,y,type,scale=1,alpha=1){
    const c=this.ctx;
    const r=type==='ghoul'?6.5:type==='necromancer'?5.8:5.2;
    const fill=type==='ghoul'?'#778267':type==='necromancer'?'#a36fe4':'#d6d0c4';
    c.save(); c.globalAlpha=alpha; c.translate(x,y);
    c.beginPath(); c.ellipse(0,3*scale,7*scale,3.2*scale,0,0,Math.PI*2); c.fillStyle='rgba(0,0,0,.34)'; c.fill();
    c.beginPath(); c.arc(0,0,r*scale,0,Math.PI*2); c.fillStyle=fill; c.fill();
    c.strokeStyle='#16111a'; c.lineWidth=Math.max(1,1.5*scale); c.stroke();
    if(type==='necromancer'){c.strokeStyle='#ca9cff';c.beginPath();c.moveTo(4*scale,-2*scale);c.lineTo(7*scale,-10*scale);c.stroke();}
    else if(type==='skeleton'){c.strokeStyle='#8a7b6a';c.beginPath();c.moveTo(4*scale,-1*scale);c.lineTo(9*scale,-9*scale);c.stroke();}
    c.restore();
  }

  drawCampfireGarrison(building,state,time){
    if(building.type!=='campfire'||building.readyAt>Date.now())return;
    const roster=[];
    for(const[t,n] of Object.entries(building.garrison??{})) for(let i=0;i<n;i++)roster.push(t);
    const shown=roster.slice(0,12);
    const{x,y,scale}=this.buildingAnchor(building,state);
    const c=this.ctx;
    c.save(); c.translate(x,y-23*scale);
    const pulse=.9+Math.sin(time/180)*.12;
    c.shadowColor='#9dff7a'; c.shadowBlur=18*scale;
    c.fillStyle='rgba(119,255,105,.9)'; c.beginPath(); c.arc(0,0,6*scale*pulse,0,Math.PI*2); c.fill();
    c.shadowBlur=0;
    c.fillStyle='rgba(175,118,255,.75)'; c.beginPath(); c.arc(0,-6*scale,4*scale*pulse,0,Math.PI*2); c.fill();
    c.restore();
    shown.forEach((t,i)=>{
      const ring=Math.floor(i/6);const slot=i%6;
      const angle=(Math.PI*2/6)*slot+ring*.4;
      const rad=(28+ring*13)*scale;
      const sway=Math.sin(time/420+i)*1.5*scale;
      this.drawVillageUnit(x+Math.cos(angle)*rad,y+Math.sin(angle)*rad*.46+sway,t,scale*.9,.95);
    });
    if(roster.length>shown.length){
      c.save(); c.translate(x,y+18*scale);
      c.fillStyle='rgba(13,9,17,.9)'; c.strokeStyle='#9dff7a'; c.lineWidth=1.5*scale;
      c.beginPath(); c.arc(0,0,12*scale,0,Math.PI*2); c.fill(); c.stroke();
      c.fillStyle='#fff'; c.textAlign='center'; c.textBaseline='middle';
      c.font=`800 ${Math.max(8,9*scale)}px sans-serif`;
      c.fillText(`+${roster.length-shown.length}`,0,0); c.restore();
    }
  }

  drawTroopTransfers(state,interaction,time){
    for(const tr of interaction.troopTransfers??[]){
      const from=state.buildings.find(b=>b.id===tr.fromId);
      const to=state.buildings.find(b=>b.id===tr.toId);
      if(!from||!to)continue;
      const prog=Math.min(1,Math.max(0,(time-tr.createdAt)/(tr.duration??1200)));
      const s=this.buildingAnchor(from,state);
      const e=this.buildingAnchor(to,state);
      const eased=1-Math.pow(1-prog,3);
      const x=s.x+(e.x-s.x)*eased;
      const y=s.y+(e.y-s.y)*eased-Math.sin(prog*Math.PI)*18*state.camera.zoom;
      this.drawVillageUnit(x,y-18*state.camera.zoom,tr.type,state.camera.zoom,1-prog*.1);
    }
  }

  render(state, interaction, time) {
    this.ground(state.camera, time);
    if (interaction.preview) this.footprint(interaction.preview, state.camera, false, interaction.preview.valid);
    [...state.buildings]
      .sort((a,b)=>(a.col+a.row)-(b.col+b.row))
      .forEach(b=>{
        this.drawBuilding(b, state, b.id===interaction.selectedId, time, b.id===interaction.liftedId);
        this.drawCollectionBubble(b, state, time);
        this.drawCampfireGarrison(b, state, time);
      });
    this.drawTroopTransfers(state, interaction, time);
    this.drawCollectionPopups(interaction, state, time);
  }
}
