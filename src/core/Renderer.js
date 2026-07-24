export class Renderer {
  constructor(canvas, grid, definitions, assets) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.grid = grid; this.definitions = definitions; this.assets = assets;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr); this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }
  polygon(points, fill, stroke, width = 1) { const c = this.ctx; c.beginPath(); c.moveTo(points[0].x, points[0].y); points.slice(1).forEach((p) => c.lineTo(p.x, p.y)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }

  tile(col, row, camera, fill, stroke = 'rgba(111,91,128,.28)') {
    const p = this.grid.gridToScreen(col, row, camera, this.viewport());
    const hw = this.grid.tileWidth * camera.zoom / 2, hh = this.grid.tileHeight * camera.zoom / 2;
    this.polygon([{x:p.x,y:p.y},{x:p.x+hw,y:p.y+hh},{x:p.x,y:p.y+hh*2},{x:p.x-hw,y:p.y+hh}], fill, stroke, Math.max(.7, camera.zoom));
  }

  ground(camera, time) {
    const c = this.ctx, v = this.viewport();
    const g = c.createLinearGradient(0, 0, 0, v.height); g.addColorStop(0, '#2e2638'); g.addColorStop(.55, '#211b29'); g.addColorStop(1, '#110e16'); c.fillStyle = g; c.fillRect(0,0,v.width,v.height);
    for (let col=0; col<this.grid.columns; col+=1) for (let row=0; row<this.grid.rows; row+=1) this.tile(col,row,camera,(col+row)%2?'rgba(55,49,60,.86)':'rgba(47,42,52,.86)');
    c.save(); c.globalAlpha=.16; for(let i=0;i<40;i+=1){ const x=(i*191+time*.008*(i%3+1))%v.width, y=(i*83)%v.height; c.fillStyle=i%4?'#8d789c':'#bd88ff'; c.fillRect(x,y,1.5,1.5);} c.restore();
  }

  footprint(building, camera, selected, valid = null) {
    const d=this.definitions[building.type];
    for(let x=0;x<d.size.w;x+=1) for(let y=0;y<d.size.h;y+=1){
      const fill=valid===true?'rgba(93,226,154,.30)':valid===false?'rgba(229,68,85,.36)':selected?'rgba(166,108,255,.22)':'rgba(5,4,8,.22)';
      const stroke=valid===true?'#67e7a3':valid===false?'#ff6675':selected?'#c08cff':'rgba(0,0,0,.2)'; this.tile(building.col+x,building.row+y,camera,fill,stroke);
    }
  }

  building(building, state, selected, time) {
    const d=this.definitions[building.type], camera=state.camera, scale=camera.zoom;
    this.footprint(building,camera,selected);
    const p=this.grid.gridToScreen(building.col+d.size.w/2,building.row+d.size.h/2,camera,this.viewport());
    const baseY=p.y+this.grid.tileHeight*d.size.h*.48*scale, width=this.grid.tileWidth*d.size.w*.62*scale, height=(building.type==='wall'?28:58+d.size.h*9)*scale, c=this.ctx;
    c.save(); c.translate(p.x,baseY); c.globalAlpha=building.readyAt>Date.now()?.65:1;
    c.beginPath(); c.ellipse(0,5*scale,width*.56,13*scale,0,0,Math.PI*2); c.fillStyle='rgba(0,0,0,.45)'; c.fill();
    const sprite=this.assets.get(building.type);
    if(sprite){ const targetW=this.grid.tileWidth*d.size.w*1.35*scale, targetH=targetW*(sprite.height/sprite.width); c.drawImage(sprite,-targetW/2,-targetH+18*scale,targetW,targetH); }
    else if(building.type==='wall'){ c.fillStyle=d.colors[0]; c.fillRect(-width/2,-height,width,height); c.fillStyle='#756b7c'; for(let i=-2;i<=2;i+=1){c.beginPath();c.moveTo(i*width/5,-height);c.lineTo(i*width/5+width/10,-height-12*scale);c.lineTo(i*width/5+width/5,-height);c.fill();} }
    else { const top=-height*.65; c.fillStyle=d.colors[0]; c.fillRect(-width/2,top,width,height*.65); this.polygon([{x:-width*.58,y:top},{x:0,y:-height},{x:width*.58,y:top}],d.colors[1],'#0d0b0f',2*scale); c.shadowColor=d.colors[2]; c.shadowBlur=(8+Math.sin(time/550)*3)*scale; c.fillStyle=d.colors[2]; c.fillRect(-width*.06,-height*.28,width*.12,height*.11); c.shadowBlur=0; }
    if(building.readyAt>Date.now()){ c.fillStyle='rgba(9,7,12,.9)'; c.fillRect(-38*scale,-height-28*scale,76*scale,21*scale); c.fillStyle='#dfc4ff'; c.textAlign='center'; c.font=`700 ${Math.max(10,11*scale)}px sans-serif`; c.fillText(`${Math.ceil((building.readyAt-Date.now())/1000)}s`,0,-height-13*scale); }
    c.restore();
  }

  render(state, interaction, time) {
    this.ground(state.camera,time);
    if(interaction.preview){ this.footprint(interaction.preview,state.camera,false,interaction.preview.valid); }
    [...state.buildings].sort((a,b)=>(a.col+a.row)-(b.col+b.row)).forEach((b)=>this.building(b,state,b.id===interaction.selectedId,time));
  }
}
