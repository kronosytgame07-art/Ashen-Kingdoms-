/**
 * VillageRenderer — delegates all building art to BuildingArtist.js
 * Ground, particles, fog vignette, collection bubbles, garrison, popups here.
 */
import { DRAW_FN } from './BuildingArtist.js';

const P = {
  bg0:      '#0d0a14',
  tile0:    'rgba(36,28,48,.92)',
  tile1:    'rgba(28,22,40,.92)',
  tileEdge: 'rgba(80,58,110,.30)',
  glow:     '#b87cff',
  amber:    '#e8a630',
  stone:    '#4a3f52',
  blood:    '#d84858',
  green:    '#62dca0',
  black:    '#07050d',
  white:    '#f0eaf8',
};

export class VillageRenderer {
  constructor(canvas, grid, definitions, assets) {
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.grid        = grid;
    this.definitions = definitions;
    this.assets      = assets;
    this.spriteFrameCache = new Map();
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }

  // ─ primitives ───────────────────────────────────────────────────────────────
  polygon(points, fill, stroke, lw=1) {
    const c=this.ctx;
    c.beginPath(); c.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++) c.lineTo(points[i].x,points[i].y);
    c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
  }

  rrect(c,x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    c.beginPath();
    c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
  }

  // ─ iso tile ─────────────────────────────────────────────────────────────────
  tile(col,row,camera,fill,stroke) {
    const vp=this.viewport();
    const pt=this.grid.gridToScreen(col,row,camera,vp);
    const hw=this.grid.tileWidth*camera.zoom/2;
    const hh=this.grid.tileHeight*camera.zoom/2;
    stroke=stroke??P.tileEdge;
    this.polygon([
      {x:pt.x,    y:pt.y},
      {x:pt.x+hw, y:pt.y+hh},
      {x:pt.x,    y:pt.y+hh*2},
      {x:pt.x-hw, y:pt.y+hh},
    ],fill,stroke,Math.max(.6,camera.zoom*.9));
  }

  // ─ ground ──────────────────────────────────────────────────────────────────
  ground(camera, time) {
    const c=this.ctx, vp=this.viewport();
    const grad=c.createLinearGradient(0,0,0,vp.height);
    grad.addColorStop(0,'#1a1128'); grad.addColorStop(.4,'#150f20'); grad.addColorStop(1,P.bg0);
    c.fillStyle=grad; c.fillRect(0,0,vp.width,vp.height);

    // Lava veins
    c.save(); c.globalAlpha=.07; c.strokeStyle='#ff4820'; c.lineWidth=.8;
    for(let i=0;i<9;i++){
      const ox=(i*173+time*.004)%(vp.width+200)-100;
      c.beginPath(); c.moveTo(ox,0);
      c.bezierCurveTo(ox+30,vp.height*.3,ox-20,vp.height*.7,ox+15,vp.height); c.stroke();
    }
    c.restore();

    // Iso tiles
    for(let col=0;col<this.grid.columns;col++)
      for(let row=0;row<this.grid.rows;row++)
        this.tile(col,row,camera,(col+row)%2?P.tile0:P.tile1);

    // Embers
    c.save(); c.globalAlpha=.28;
    for(let i=0;i<55;i++){
      const tt=time*.001*(i%4+.5);
      const x=((i*167+tt*18)%(vp.width+20));
      const y=((i*89 +tt*9) %(vp.height+20));
      c.fillStyle=i%6===0?P.amber:i%4===0?P.glow:P.stone;
      c.beginPath();c.arc(x,y,i%5===0?2.2:1.4,0,Math.PI*2);c.fill();
    }
    c.restore();

    // Vignette
    const vig=c.createRadialGradient(vp.width/2,vp.height/2,vp.height*.15,vp.width/2,vp.height/2,vp.width*.72);
    vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(5,3,12,.68)');
    c.fillStyle=vig;c.fillRect(0,0,vp.width,vp.height);
  }

  // ─ footprint ────────────────────────────────────────────────────────────
  footprint(building,camera,selected,valid=null){
    const def=this.definitions[building.type];
    for(let x=0;x<def.size.w;x++) for(let y=0;y<def.size.h;y++){
      let fill,stroke;
      if(valid===true)       {fill='rgba(98,220,160,.22)'; stroke='#62dca0';}
      else if(valid===false) {fill='rgba(216,72,88,.22)';  stroke='#d84858';}
      else if(selected)      {fill='rgba(184,124,255,.18)';stroke='#b87cff';}
      else                   {fill='rgba(5,4,8,.15)';       stroke='rgba(0,0,0,.12)';}
      this.tile(building.col+x,building.row+y,camera,fill,stroke);
    }
  }

  buildingAnchor(building,state){
    const def=this.definitions[building.type];
    const cam=state.camera, scale=cam.zoom;
    const pt=this.grid.gridToScreen(
      building.col+def.size.w/2,
      building.row+def.size.h/2,
      cam,this.viewport()
    );
    return{x:pt.x,y:pt.y+this.grid.tileHeight*def.size.h*.48*scale,scale,def};
  }

  // ─ sprite helpers (kept for townHall photo sprite fallback) ───────────────
  _createSpriteFrame(sprite,sheet,frameIndex){
    const cols=Math.max(1,sheet.columns??1),rows=Math.max(1,sheet.rows??1);
    const fw=Math.floor(sprite.width/cols),fh=Math.floor(sprite.height/rows);
    const oc=document.createElement('canvas');oc.width=fw;oc.height=fh;
    const ctx=oc.getContext('2d',{willReadFrequently:Boolean(sheet.removeBackground)});
    ctx.drawImage(sprite,(frameIndex%cols)*fw,Math.floor(frameIndex/cols)*fh,fw,fh,0,0,fw,fh);
    if(sheet.removeBackground)this._removeBackground(ctx,fw,fh,sheet.backgroundTolerance??28);
    return oc;
  }
  _removeBackground(ctx,w,h,tol){
    try{
      const img=ctx.getImageData(0,0,w,h);const d=img.data;
      const bg=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].reduce((s,[cx,cy])=>{
        const i=(cy*w+cx)*4;s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2];return s;
      },[0,0,0]).map(v=>v/4);
      const vis=new Uint8Array(w*h),q=[];
      const push=(x,y)=>{
        if(x<0||y<0||x>=w||y>=h)return;
        const p=y*w+x;if(vis[p])return;
        const i=p*4;
        if(Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2])>tol)return;
        vis[p]=1;q.push(p);
      };
      for(let x=0;x<w;x++){push(x,0);push(x,h-1);}
      for(let y=0;y<h;y++){push(0,y);push(w-1,y);}
      for(let i=0;i<q.length;i++){const p=q[i];const x=p%w;const y=Math.floor(p/w);d[p*4+3]=0;push(x-1,y);push(x+1,y);push(x,y-1);push(x,y+1);}
      ctx.putImageData(img,0,0);
    }catch(e){console.warn('[VR] bg remove',e);}
  }
  _getSpriteFrame(type,sprite,sheet,time){
    if(!sheet)return sprite;
    const count=Math.max(1,Math.min(sheet.frames??sheet.columns*sheet.rows,sheet.columns*sheet.rows));
    const idx=Math.floor(time/1000*(sheet.fps??2))%count;
    const key=`${type}:${idx}`;
    if(!this.spriteFrameCache.has(key))this.spriteFrameCache.set(key,this._createSpriteFrame(sprite,sheet,idx));
    return this.spriteFrameCache.get(key);
  }

  // ─ main building draw ─────────────────────────────────────────────────────
  drawBuilding(building, state, selected, time, lifted=false) {
    const def   = this.definitions[building.type];
    const cam   = state.camera;
    const s     = cam.zoom;
    const pt    = this.grid.gridToScreen(
      building.col+def.size.w/2,
      building.row+def.size.h/2,
      cam, this.viewport()
    );
    const baseY = pt.y + this.grid.tileHeight*def.size.h*.48*s;
    const c     = this.ctx;
    const tSec  = time/1000;                               // continuous seconds
    const flick = Math.sin(tSec*4.8+building.col*1.7)*.5+.5; // per-building flicker
    const level = Math.min(3, Math.max(1, building.level ?? 1));
    const underConst = building.readyAt > Date.now();

    this.footprint(building, cam, selected);

    c.save();
    c.translate(pt.x, baseY - (lifted ? 11*s : 0));
    if(lifted) c.scale(1.06,1.06);
    c.globalAlpha = underConst ? .55 : 1;

    // — try custom sprite (townHall photo override)
    const sprite = this.assets?.get(building.type);
    if(sprite) {
      const frame = this._getSpriteFrame(building.type, sprite, def.spriteSheet, time);
      const sr    = def.spriteRender ?? {};
      const fpW   = this.grid.tileWidth*(sr.maxTilesWide??def.size.w)*s;
      const tgtW  = Math.min(this.grid.tileWidth*def.size.w*1.48*s,fpW)*(sr.renderScale??1);
      const tgtH  = tgtW*(frame.height/frame.width);
      // shadow
      c.save(); c.globalCompositeOperation='multiply'; c.globalAlpha=.45;
      c.fillStyle='#07050d'; c.fillRect(-tgtW/2+2*s,-tgtH*(sr.anchorY??1)+3*s,tgtW,tgtH);
      c.restore();
      c.drawImage(frame,-tgtW/2+(sr.offsetX??0)*s,-tgtH*Math.max(0,Math.min(1,sr.anchorY??1))+(sr.offsetY??0)*s,tgtW,tgtH);
    } else {
      // — procedural art from BuildingArtist
      const drawFn = DRAW_FN[building.type];
      if(drawFn) drawFn(c, s, level, tSec, flick, selected);
    }

    // — Lifted dashed outline
    if(lifted){
      const hw=this.grid.tileWidth*def.size.w*.55*s;
      const hh2=(50+def.size.h*12)*s;
      c.strokeStyle='#d7b8ff'; c.lineWidth=2.5*s;
      c.setLineDash([6*s,4*s]);
      c.strokeRect(-hw,-hh2,hw*2,hh2*1.08);
      c.setLineDash([]);
    }

    // — Under-construction overlay
    if(underConst){
      const secs=Math.ceil((building.readyAt-Date.now())/1000);
      const mins=Math.floor(secs/60);
      const label=mins>0?`${mins}m${secs%60}s`:`${secs}s`;
      const ow=80*s;
      this.rrect(c,-ow/2,-60*s*def.size.h,ow,22*s,6*s);
      c.fillStyle='rgba(7,4,14,.88)'; c.fill();
      c.strokeStyle=P.glow; c.lineWidth=1.5*s; c.stroke();
      c.fillStyle=P.white; c.textAlign='center'; c.textBaseline='middle';
      c.font=`700 ${Math.max(9,11*s)}px 'Cinzel',serif`;
      c.fillText(`⚒ ${label}`,0,-60*s*def.size.h+11*s);
    }

    c.restore();
  }

  // ─ collection bubble ───────────────────────────────────────────────────
  drawCollectionBubble(building, state, time) {
    const def=this.definitions[building.type];
    if(!def?.extractor||building.readyAt>Date.now())return;
    const stored=building.storedResource??0;
    const threshold=def.extractor.collectThreshold??1;
    if(stored<threshold)return;
    const capacity=def.extractor.capacity*(1+(building.level-1)*.5);
    const full=stored>=capacity*.98;
    const {x,y,scale}=this.buildingAnchor(building,state);
    const c=this.ctx;
    const bob=Math.sin(time/260+building.col*1.1)*4*scale;
    const glowCol=full?P.blood:P.glow;
    c.save(); c.translate(x,y-96*scale+bob);
    c.shadowColor=glowCol; c.shadowBlur=(full?20:13)*scale;
    this.rrect(c,-22*scale,-12*scale,44*scale,24*scale,12*scale);
    c.fillStyle=full?'rgba(80,16,24,.97)':'rgba(12,8,20,.97)';
    c.strokeStyle=glowCol; c.lineWidth=Math.max(1.5,2*scale);
    c.fill();c.stroke();c.shadowBlur=0;
    c.fillStyle=full?P.blood:P.glow;
    c.textAlign='center';c.textBaseline='middle';
    c.font=`800 ${Math.max(11,14*scale)}px 'Cinzel',serif`;
    const icon=def.extractor.resource==='gold'?'🪙':def.extractor.resource==='wood'?'🪵':'✦';
    c.fillText(full?`${icon}!`:`${icon} ${Math.floor(stored)}`,0,0);
    c.restore();
  }

  // ─ collection popups ───────────────────────────────────────────────────
  drawCollectionPopups(interaction, state, time) {
    const c=this.ctx;
    for(const popup of interaction.collectionPopups??[]){
      const building=state.buildings.find(b=>b.id===popup.buildingId);
      if(!building)continue;
      const age=Math.max(0,time-popup.createdAt);
      const prog=Math.min(1,age/1200);
      const {x,y,scale}=this.buildingAnchor(building,state);
      c.save(); c.globalAlpha=1-prog;
      c.translate(x,y-72*scale-prog*48*scale);
      const col=popup.resource==='gold'?P.amber:popup.resource==='wood'?'#8cdf5c':P.glow;
      c.shadowColor=col;c.shadowBlur=14*scale;
      c.fillStyle=col;c.textAlign='center';
      c.font=`900 ${Math.max(14,19*scale)}px sans-serif`;
      c.fillText(`+${popup.amount}`,0,0);c.restore();
    }
  }

  // ─ village unit (for garrison display) ─────────────────────────────────
  drawVillageUnit(x,y,type,scale=1,alpha=1){
    const c=this.ctx;
    const r=type==='ghoul'?7:type==='necromancer'?6.5:5.8;
    const fill=type==='ghoul'?'#8a7a5a':type==='necromancer'?'#b070f0':'#ddd8ee';
    const stroke=type==='ghoul'?'#3a3020':type==='necromancer'?'#5018a8':'#2a1e38';
    c.save();c.globalAlpha=alpha;c.translate(x,y);
    c.beginPath();c.ellipse(0,3.5*scale,7.5*scale,3.5*scale,0,0,Math.PI*2);
    c.fillStyle='rgba(0,0,0,.38)';c.fill();
    c.beginPath();c.arc(0,0,r*scale,0,Math.PI*2);
    c.fillStyle=fill;c.fill();
    c.strokeStyle=stroke;c.lineWidth=Math.max(1,1.8*scale);c.stroke();
    c.fillStyle=type==='necromancer'?'#e8b0ff':'#ffeecc';
    c.beginPath();c.arc(-r*.32*scale,-r*.18*scale,r*.22*scale,0,Math.PI*2);c.fill();
    c.beginPath();c.arc( r*.32*scale,-r*.18*scale,r*.22*scale,0,Math.PI*2);c.fill();
    c.strokeStyle=type==='necromancer'?'#c090ff':'#9a8a78';
    c.lineWidth=Math.max(1,1.4*scale);
    c.beginPath();c.moveTo(r*.5*scale,-r*.1*scale);c.lineTo(r*1.5*scale,-r*1.2*scale);c.stroke();
    c.restore();
  }

  drawCampfireGarrison(building,state,time){
    if(building.type!=='campfire'||building.readyAt>Date.now())return;
    const roster=[];
    for(const[t,n] of Object.entries(building.garrison??{}))for(let i=0;i<n;i++)roster.push(t);
    const shown=roster.slice(0,12);
    const{x,y,scale}=this.buildingAnchor(building,state);
    const c=this.ctx;
    c.save();c.translate(x,y-24*scale);
    const pulse=.88+Math.sin(time/175)*.13;
    c.shadowColor=P.green;c.shadowBlur=20*scale;
    c.fillStyle=`rgba(98,220,160,${.8+pulse*.1})`;
    c.beginPath();c.arc(0,0,6.5*scale*pulse,0,Math.PI*2);c.fill();
    c.shadowBlur=0;c.restore();
    shown.forEach((t2,i)=>{
      const ring=Math.floor(i/6),slot=i%6;
      const angle=(Math.PI*2/6)*slot+ring*.42;
      const rad=(30+ring*14)*scale;
      const sway=Math.sin(time/400+i*.7)*1.8*scale;
      this.drawVillageUnit(x+Math.cos(angle)*rad,y+Math.sin(angle)*rad*.46+sway,t2,scale*.9,.96);
    });
    if(roster.length>shown.length){
      c.save();c.translate(x,y+20*scale);
      c.fillStyle='rgba(10,7,16,.92)';c.strokeStyle=P.green;c.lineWidth=1.8*scale;
      c.beginPath();c.arc(0,0,13*scale,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle=P.white;c.textAlign='center';c.textBaseline='middle';
      c.font=`800 ${Math.max(8,10*scale)}px sans-serif`;
      c.fillText(`+${roster.length-shown.length}`,0,0);c.restore();
    }
  }

  drawTroopTransfers(state,interaction,time){
    for(const tr of interaction.troopTransfers??[]){
      const from=state.buildings.find(b=>b.id===tr.fromId);
      const to=state.buildings.find(b=>b.id===tr.toId);
      if(!from||!to)continue;
      const prog=Math.min(1,Math.max(0,(time-tr.createdAt)/(tr.duration??1200)));
      const eased=1-Math.pow(1-prog,3);
      const sv=this.buildingAnchor(from,state),ev=this.buildingAnchor(to,state);
      const x=sv.x+(ev.x-sv.x)*eased;
      const y=sv.y+(ev.y-sv.y)*eased-Math.sin(prog*Math.PI)*20*state.camera.zoom;
      this.drawVillageUnit(x,y-18*state.camera.zoom,tr.type,state.camera.zoom,1-prog*.12);
    }
  }

  // ─ main render ───────────────────────────────────────────────────────────────
  render(state, interaction, time) {
    this.ground(state.camera, time);
    if(interaction.preview)
      this.footprint(interaction.preview,state.camera,false,interaction.preview.valid);
    [...state.buildings]
      .sort((a,b)=>(a.col+a.row)-(b.col+b.row))
      .forEach(b=>{
        this.drawBuilding(b,state,b.id===interaction.selectedId,time,b.id===interaction.liftedId);
        this.drawCollectionBubble(b,state,time);
        this.drawCampfireGarrison(b,state,time);
      });
    this.drawTroopTransfers(state,interaction,time);
    this.drawCollectionPopups(interaction,state,time);
  }
}
