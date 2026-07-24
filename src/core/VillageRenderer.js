/**
 * VillageRenderer — delegates all building art to BuildingArtist.js
 * Ground, particles, HUD chrome and overlays stay here.
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

  // ── helpers ──────────────────────────────────────────────────────────────

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

  // ── isometric tile ───────────────────────────────────────────────────────

  tile(col,row,camera,fill,stroke){
    const vp=this.viewport();
    const pt=this.grid.gridToScreen(col,row,camera,vp);
    const hw=this.grid.tileWidth*camera.zoom/2;
    const hh=this.grid.tileHeight*camera.zoom/2;
    stroke=stroke??P.tileEdge;
    this.polygon([
      {x:pt.x,    y:pt.y      },
      {x:pt.x+hw, y:pt.y+hh   },
      {x:pt.x,    y:pt.y+hh*2 },
      {x:pt.x-hw, y:pt.y+hh   },
    ],fill,stroke,Math.max(.6,camera.zoom*.9));
  }

  // ── ground ───────────────────────────────────────────────────────────────

  ground(camera, time) {
    const c=this.ctx, vp=this.viewport();
    // Deep bg
    const grad=c.createLinearGradient(0,0,0,vp.height);
    grad.addColorStop(0,'#1a1128'); grad.addColorStop(.4,'#150f20'); grad.addColorStop(1,P.bg0);
    c.fillStyle=grad; c.fillRect(0,0,vp.width,vp.height);

    // Lava crack veins
    c.save(); c.globalAlpha=.07; c.strokeStyle='#ff4820'; c.lineWidth=.8;
    for(let i=0;i<9;i++){
      const ox=(i*173+time*.004)%(vp.width+200)-100;
      c.beginPath(); c.moveTo(ox,0);
      c.bezierCurveTo(ox+30,vp.height*.3,ox-20,vp.height*.7,ox+15,vp.height);
      c.stroke();
    }
    c.restore();

    // Iso tiles
    for(let col=0;col<this.grid.columns;col++)
      for(let row=0;row<this.grid.rows;row++)
        this.tile(col,row,camera,(col+row)%2?P.tile0:P.tile1);

    // Floating embers
    c.save(); c.globalAlpha=.28;
    for(let i=0;i<55;i++){
      const tt=time*.001*(i%4+.5);
      const x=((i*167+tt*18)%(vp.width+20));
      const y=((i*89+tt*9)%(vp.height+20));
      const sz=i%5===0?2.2:1.4;
      c.fillStyle=i%6===0?P.amber:i%4===0?P.glow:P.stone;
      c.beginPath();c.arc(x,y,sz,0,Math.PI*2);c.fill();
    }
    c.restore();

    // Vignette
    const vig=c.createRadialGradient(vp.width/2,vp.height/2,vp.height*.15,vp.width/2,vp.height/2,vp.width*.72);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(5,3,12,.68)');
    c.fillStyle=vig; c.fillRect(0,0,vp.width,vp.height);
  }

  // ── footprint ────────────────────────────────────────────────────────────

  footprint(building,camera,selected,valid=null){
    const def=this.definitions[building.type];
    for(let x=0;x<def.size.w;x++) for(let y=0;y<def.size.h;y++){
      let fill,stroke;
      if(valid===true)       {fill='rgba(98,220,160,.22)';stroke='#62dca0';}
      else if(valid===false) {fill='rgba(216,72,88,.22)'; stroke='#d84858';}
      else if(selected)      {fill='rgba(184,124,255,.18)';stroke='#b87cff';}
      else                   {fill='rgba(5,4,8,.15)';      stroke='rgba(0,0,0,.12)';}
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

  // ── sprite helpers ───────────────────────────────────────────────────────

  _createSpriteFrame(sprite,sheet,frameIndex){
    const cols=Math.max(1,sheet.columns??1),rows=Math.max(1,sheet.rows??1);
    const fw=Math.floor(sprite.width/cols),fh=Math.floor(sprite.height/rows);
    const oc=document.createElement('canvas'); oc.width=fw; oc.height=fh;
    const ctx=oc.getContext('2d',{willReadFrequently:Boolean(sheet.removeBackground)});
    ctx.drawImage(sprite,(frameIndex%cols)*fw,Math.floor(frameIndex/cols)*fh,fw,fh,0,0,fw,fh);
    if(sheet.removeBackground) this._removeBackground(ctx,fw,fh,sheet.backgroundTolerance??28);
    return oc;
  }

  _removeBackground(ctx,w,h,tol){
    try{
      const img=ctx.getImageData(0,0,w,h); const d=img.data;
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
    }catch(e){console.warn('[VillageRenderer] bg remove failed',e);}
  }

  _getSpriteFrame(type,sprite,sheet,time){
    if(!sheet)return sprite;