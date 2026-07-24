/**
 * VillageRenderer — Dark Souls × Supercell canvas renderer
 *
 * Visual identity:
 *  - Palette: deep obsidian (#0d0a14), ashen stone (#2a2332),
 *    corrupted violet (#7c3fcf → #b87cff), amber torch (#e8a630),
 *    necrotic green (#62dca0), blood crimson (#d84858)
 *  - Isometric tiles with depth-shaded bevel + subtle lava-crack veins
 *  - Buildings: 3-layer composite (base slab → body → roof/spire) with
 *    per-building glow colour, window slits, damage cracks, banner drapes
 *  - Torch flicker on every building using sin-based shadowBlur cycling
 *  - Fog-of-war vignette + floating dust particles
 *  - Supercell-style thick black outline on every shape (globalCompositeOperation trick)
 */

// ── Shared palette ──────────────────────────────────────────────────────────
const P = {
  bg0:   '#0d0a14',
  bg1:   '#1a1424',
  bg2:   '#221930',
  tile0: 'rgba(38,30,48,.92)',
  tile1: 'rgba(30,24,40,.92)',
  tileEdge: 'rgba(80,58,110,.32)',
  gridLine: 'rgba(90,65,120,.18)',
  glow:  '#b87cff',
  glowDim:'#7c3fcf',
  amber: '#e8a630',
  green: '#62dca0',
  blood: '#d84858',
  stone: '#4a3f52',
  stoneDark: '#2a2332',
  outline: '#07050d',
  white:  '#f0eaf8',
  shadow: 'rgba(7,5,13,.72)',
  lava:  'rgba(220,80,40,.55)',
};

// ── Per-building theme override ──────────────────────────────────────────────
const THEME = {
  townHall:    { body:'#261d33', roof:'#3a2848', glow:'#d07aff', accent:'#aa60ff', banner:'#7030a0' },
  goldMine:    { body:'#2c2218', roof:'#3d2f1a', glow:'#f0c45e', accent:'#c8922e', banner:'#8a6020' },
  woodCamp:    { body:'#1e2818', roof:'#2c3820', glow:'#8cdf5c', accent:'#5aa832', banner:'#3a7020' },
  soulVault:   { body:'#18202e', roof:'#22304a', glow:'#58b8ff', accent:'#3890e0', banner:'#205090' },
  barracks:    { body:'#2a1e1e', roof:'#3a2828', glow:'#ff7878', accent:'#c84848', banner:'#881830' },
  campfire:    { body:'#1e2010', roof:'#283014', glow:'#9dff7a', accent:'#68e044', banner:'#3a8020' },
  clanCastle:  { body:'#22183a', roof:'#32244e', glow:'#e8b0ff', accent:'#b870f0', banner:'#7028b8' },
  wall:        { body:'#2a2232', roof:'#382e42', glow:'#8060a8', accent:'#604880', banner:null },
  runeTower:   { body:'#1a1428', roof:'#261e38', glow:'#c880ff', accent:'#9040e0', banner:'#5018a0' },
  boneCatapult:{ body:'#2a1e10', roof:'#382a18', glow:'#ff9840', accent:'#d06020', banner:'#803010' },
};

const theme = (type) => THEME[type] ?? { body:'#221830', roof:'#301e40', glow:P.glow, accent:P.glowDim, banner:'#4a2880' };

export class VillageRenderer {
  constructor(canvas, grid, definitions, assets) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.grid   = grid;
    this.definitions = definitions;
    this.assets = assets;
    this.spriteFrameCache = new Map();
    // Off-screen for outline pass
    this._oc  = document.createElement('canvas');
    this._oct = this._oc.getContext('2d');
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }
  resize()   { this.canvas.width = this.canvas.clientWidth; this.canvas.height = this.canvas.clientHeight; }

  // ── Low-level helpers ────────────────────────────────────────────────────

  polygon(points, fill, stroke, lw = 1) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
    c.closePath();
    if (fill)  { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }

  /** Rounded rectangle helper */
  rrect(c, x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    c.beginPath();
    c.moveTo(x+r, y);
    c.arcTo(x+w,y,   x+w,y+h, r);
    c.arcTo(x+w,y+h, x,  y+h, r);
    c.arcTo(x,  y+h, x,  y,   r);
    c.arcTo(x,  y,   x+w,y,   r);
    c.closePath();
  }

  // ── Tile ────────────────────────────────────────────────────────────────

  tile(col, row, camera, fill, stroke) {
    const vp = this.viewport();
    const pt = this.grid.gridToScreen(col, row, camera, vp);
    const hw = this.grid.tileWidth  * camera.zoom / 2;
    const hh = this.grid.tileHeight * camera.zoom / 2;
    stroke = stroke ?? P.tileEdge;
    this.polygon([
      { x: pt.x,      y: pt.y         },
      { x: pt.x + hw, y: pt.y + hh    },
      { x: pt.x,      y: pt.y + hh*2  },
      { x: pt.x - hw, y: pt.y + hh    },
    ], fill, stroke, Math.max(.6, camera.zoom * .9));
  }

  // ── Ground ──────────────────────────────────────────────────────────────

  ground(camera, time) {
    const c  = this.ctx;
    const vp = this.viewport();

    // Deep gradient sky
    const grad = c.createLinearGradient(0, 0, 0, vp.height);
    grad.addColorStop(0,   '#1a1128');
    grad.addColorStop(.4,  '#150f20');
    grad.addColorStop(1,   P.bg0);
    c.fillStyle = grad;
    c.fillRect(0, 0, vp.width, vp.height);

    // Subtle diagonal crack lines (lava veins)
    c.save();
    c.globalAlpha = .07;
    c.strokeStyle = '#ff4820';
    c.lineWidth   = .8;
    for (let i = 0; i < 9; i++) {
      const ox = (i * 173 + time * .004) % (vp.width + 200) - 100;
      c.beginPath();
      c.moveTo(ox, 0);
      c.bezierCurveTo(ox+30, vp.height*.3, ox-20, vp.height*.7, ox+15, vp.height);
      c.stroke();
    }
    c.restore();

    // Isometric tiles — two alternating shades with bevel
    for (let col = 0; col < this.grid.columns; col++) {
      for (let row = 0; row < this.grid.rows; row++) {
        const dark = (col + row) % 2 === 0;
        this.tile(col, row, camera,
          dark ? P.tile0 : P.tile1,
          P.tileEdge
        );
      }
    }

    // Floating dust / embers
    c.save();
    c.globalAlpha = .28;
    for (let i = 0; i < 55; i++) {
      const t  = time * .001 * (i % 4 + .5);
      const x  = ((i * 167 + t * 18) % (vp.width  + 20));
      const y  = ((i * 89  + t * 9)  % (vp.height + 20));
      const s  = i % 5 === 0 ? 2.2 : 1.4;
      c.fillStyle = i % 6 === 0 ? P.amber : i % 4 === 0 ? P.glow : P.stone;
      c.beginPath(); c.arc(x, y, s, 0, Math.PI*2); c.fill();
    }
    c.restore();

    // Fog-of-war vignette
    const vig = c.createRadialGradient(vp.width/2, vp.height/2, vp.height*.15, vp.width/2, vp.height/2, vp.width*.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(5,3,12,.68)');
    c.fillStyle = vig;
    c.fillRect(0, 0, vp.width, vp.height);
  }

  // ── Footprint ────────────────────────────────────────────────────────────

  footprint(building, camera, selected, valid = null) {
    const def = this.definitions[building.type];
    for (let x = 0; x < def.size.w; x++) {
      for (let y = 0; y < def.size.h; y++) {
        let fill, stroke;
        if (valid === true)        { fill='rgba(98,220,160,.22)'; stroke='#62dca0'; }
        else if (valid === false)  { fill='rgba(216,72,88,.22)';  stroke='#d84858'; }
        else if (selected)         { fill='rgba(184,124,255,.18)'; stroke='#b87cff'; }
        else                       { fill='rgba(5,4,8,.15)';       stroke='rgba(0,0,0,.12)'; }
        this.tile(building.col+x, building.row+y, camera, fill, stroke);
      }
    }
  }

  buildingAnchor(building, state) {
    const def   = this.definitions[building.type];
    const cam   = state.camera;
    const scale = cam.zoom;
    const pt    = this.grid.gridToScreen(
      building.col + def.size.w/2,
      building.row + def.size.h/2,
      cam, this.viewport()
    );
    return { x: pt.x, y: pt.y + this.grid.tileHeight * def.size.h * .48 * scale, scale, def };
  }

  // ── Sprite helpers ───────────────────────────────────────────────────────

  _createSpriteFrame(sprite, sheet, frameIndex) {
    const cols = Math.max(1, sheet.columns ?? 1);
    const rows = Math.max(1, sheet.rows ?? 1);
    const fw   = Math.floor(sprite.width  / cols);
    const fh   = Math.floor(sprite.height / rows);
    const oc   = document.createElement('canvas');
    oc.width = fw; oc.height = fh;
    const ctx  = oc.getContext('2d', { willReadFrequently: Boolean(sheet.removeBackground) });
    ctx.drawImage(sprite, (frameIndex % cols)*fw, Math.floor(frameIndex/cols)*fh, fw, fh, 0, 0, fw, fh);
    if (sheet.removeBackground) this._removeBackground(ctx, fw, fh, sheet.backgroundTolerance ?? 28);
    return oc;
  }

  _removeBackground(ctx, w, h, tol) {
    try {
      const img = ctx.getImageData(0, 0, w, h);
      const d   = img.data;
      const bg  = [[0,0],[w-1,0],[0,h-1],[w-1,h-1]].reduce((s,[cx,cy])=>{
        const i=(cy*w+cx)*4; s[0]+=d[i]; s[1]+=d[i+1]; s[2]+=d[i+2]; return s;
      }, [0,0,0]).map(v=>v/4);
      const vis = new Uint8Array(w*h);
      const q   = [];
      const push = (x,y) => {
        if (x<0||y<0||x>=w||y>=h) return;
        const p = y*w+x; if (vis[p]) return;
        const i = p*4;
        if (Math.hypot(d[i]-bg[0], d[i+1]-bg[1], d[i+2]-bg[2]) > tol) return;
        vis[p]=1; q.push(p);
      };
      for (let x=0;x<w;x++){push(x,0);push(x,h-1);}
      for (let y=0;y<h;y++){push(0,y);push(w-1,y);}
      for (let i=0;i<q.length;i++){
        const p=q[i]; const x=p%w; const y=Math.floor(p/w);
        d[p*4+3]=0; push(x-1,y); push(x+1,y); push(x,y-1); push(x,y+1);
      }
      ctx.putImageData(img,0,0);
    } catch(e){ console.warn('[VillageRenderer] bg remove failed',e); }
  }

  _getSpriteFrame(type, sprite, sheet, time) {
    if (!sheet) return sprite;
    const count = Math.max(1, Math.min(sheet.frames ?? sheet.columns*sheet.rows, sheet.columns*sheet.rows));
    const idx   = Math.floor(time/1000*(sheet.fps??2)) % count;
    const key   = `${type}:${idx}`;
    if (!this.spriteFrameCache.has(key)) this.spriteFrameCache.set(key, this._createSpriteFrame(sprite, sheet, idx));
    return this.spriteFrameCache.get(key);
  }

  // ── Building draw ────────────────────────────────────────────────────────

  drawBuilding(building, state, selected, time, lifted = false) {
    const def   = this.definitions[building.type];
    const cam   = state.camera;
    const s     = cam.zoom;
    const t     = theme(building.type);
    const underConstruction = building.readyAt > Date.now();
    const pt    = this.grid.gridToScreen(
      building.col + def.size.w/2,
      building.row + def.size.h/2,
      cam, this.viewport()
    );
    const baseY = pt.y + this.grid.tileHeight * def.size.h * .48 * s;
    const w     = this.grid.tileWidth  * def.size.w * .62 * s;
    const h     = (building.type === 'wall' ? 26 : 54 + def.size.h * 10) * s;
    const c     = this.ctx;
    const flicker = Math.sin(time/180 + building.col * 1.7) * .5 + .5; // 0..1

    c.save();
    c.translate(pt.x, baseY - (lifted ? 11*s : 0));
    if (lifted) c.scale(1.06, 1.06);
    c.globalAlpha = underConstruction ? .55 : 1;

    this.footprint(building, cam, selected);

    // — Drop shadow ellipse
    c.beginPath();
    c.ellipse(0, 6*s, w*(lifted?.66:.58), (lifted?20:14)*s, 0, 0, Math.PI*2);
    c.fillStyle = lifted ? 'rgba(0,0,0,.7)' : 'rgba(0,0,0,.5)';
    c.fill();

    const sprite = this.assets.get(building.type);
    if (sprite) {
      // ── Sprite path ──
      const frame  = this._getSpriteFrame(building.type, sprite, def.spriteSheet, time);
      const sr     = def.spriteRender ?? {};
      const fpW    = this.grid.tileWidth * (sr.maxTilesWide ?? def.size.w) * s;
      const tgtW   = Math.min(this.grid.tileWidth * def.size.w * 1.48 * s, fpW) * (sr.renderScale ?? 1);
      const tgtH   = tgtW * (frame.height / frame.width);
      const dy     = -tgtH * Math.max(0, Math.min(1, sr.anchorY ?? 1)) + (sr.offsetY ?? 0)*s;
      const dx     = -tgtW/2 + (sr.offsetX ?? 0)*s;
      // Supercell-style: draw dark silhouette offset then sprite on top
      c.save();
      c.globalCompositeOperation = 'multiply';
      c.globalAlpha = .45;
      c.fillStyle = P.outline;
      c.fillRect(dx+2*s, dy+3*s, tgtW, tgtH);
      c.restore();
      c.drawImage(frame, dx, dy, tgtW, tgtH);
    } else if (building.type === 'wall') {
      // ── Wall procedural ──
      const crenH  = 10*s;
      const bodyH  = h;
      // Stone body
      const wg = c.createLinearGradient(-w/2, -bodyH, w/2, 0);
      wg.addColorStop(0, t.roof);
      wg.addColorStop(1, t.body);
      c.fillStyle = wg; c.strokeStyle = P.outline; c.lineWidth = 2*s;
      c.fillRect(-w/2, -bodyH, w, bodyH); c.strokeRect(-w/2, -bodyH, w, bodyH);
      // Mortar lines
      c.save(); c.globalAlpha = .25; c.strokeStyle = '#000'; c.lineWidth = .8*s;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-w/2, -bodyH*i/4); c.lineTo(w/2, -bodyH*i/4); c.stroke(); }
      c.restore();
      // Crenellations
      c.fillStyle = t.roof;
      const nCren = Math.max(2, Math.round(w/(12*s)));
      const cw    = w / nCren;
      for (let i = 0; i < nCren; i+=2) {
        c.fillRect(-w/2 + i*cw, -bodyH - crenH, cw, crenH);
        c.strokeRect(-w/2 + i*cw, -bodyH - crenH, cw, crenH);
      }
      // Glow slit
      c.save();
      c.shadowColor = t.glow; c.shadowBlur = (6 + flicker*4)*s;
      c.fillStyle   = t.accent;
      c.fillRect(-w*.05, -bodyH*.55, w*.1, bodyH*.18);
      c.restore();
    } else {
      // ── Generic procedural building ──
      const bW  = w;
      const bH  = h * .58;
      const roofTip = -h;

      // Base slab
      c.fillStyle = P.stoneDark; c.strokeStyle = P.outline; c.lineWidth = 2.5*s;
      c.fillRect(-bW*.54, -bH*.18, bW*1.08, bH*.22); c.strokeRect(-bW*.54, -bH*.18, bW*1.08, bH*.22);

      // Body with gradient
      const bg = c.createLinearGradient(-bW/2, -bH, bW/2, 0);
      bg.addColorStop(0, t.roof); bg.addColorStop(1, t.body);
      c.fillStyle = bg;
      c.fillRect(-bW/2, -bH, bW, bH); c.strokeRect(-bW/2, -bH, bW, bH);

      // Mortar / stone texture lines
      c.save(); c.globalAlpha = .18; c.strokeStyle = P.outline; c.lineWidth = .9*s;
      const rows = Math.max(2, Math.floor(bH / (14*s)));
      for (let i = 1; i < rows; i++) {
        const ry = -bH + i * bH/rows;
        c.beginPath(); c.moveTo(-bW/2, ry); c.lineTo(bW/2, ry); c.stroke();
      }
      c.restore();

      // Roof / spire triangle with glow
      c.shadowColor = t.glow; c.shadowBlur = (10 + flicker * 8)*s;
      this.polygon([
        { x: -bW*.56, y: -bH    },
        { x: 0,       y: roofTip },
        { x:  bW*.56, y: -bH    },
      ], t.roof, P.outline, 2.5*s);
      c.shadowBlur = 0;

      // Glowing window slit(s)
      const wSlitW = bW * .10;
      const wSlitH = bH * .22;
      const wSlitY = -bH * .55;
      c.save();
      c.shadowColor = t.glow; c.shadowBlur = (8 + flicker*10)*s;
      c.fillStyle   = t.accent;
      this.rrect(c, -wSlitW/2, wSlitY, wSlitW, wSlitH, 2*s); c.fill();
      if (def.size.w >= 2) {
        // second slit for wider buildings
        this.rrect(c, -bW*.28, wSlitY, wSlitW, wSlitH, 2*s); c.fill();
        this.rrect(c,  bW*.28 - wSlitW, wSlitY, wSlitW, wSlitH, 2*s); c.fill();
      }
      c.shadowBlur = 0; c.restore();

      // Torch bracket flame
      if (building.type !== 'wall') {
        c.save();
        const tx = bW * .45;
        const ty = -bH * .72;
        c.shadowColor = P.amber; c.shadowBlur = (12 + flicker * 14)*s;
        c.fillStyle   = `rgba(232,166,48,${.6 + flicker*.4})`;
        c.beginPath();
        c.ellipse(tx, ty - 3*s, 3*s, (5+flicker*2)*s, 0, 0, Math.PI*2);
        c.fill();
        c.fillStyle = '#fff8';
        c.beginPath();
        c.ellipse(tx, ty - 4*s, 1.4*s, 2*s, 0, 0, Math.PI*2);
        c.fill();
        c.shadowBlur = 0; c.restore();
      }

      // Banner drape
      if (t.banner && def.size.h >= 2) {
        const bx = 0, by = -bH * .82;
        const bw = bW * .22, bh = bH * .3;
        c.fillStyle = t.banner;
        c.strokeStyle = P.outline; c.lineWidth = 1.5*s;
        c.beginPath();
        c.moveTo(bx - bw/2, by);
        c.lineTo(bx + bw/2, by);
        c.lineTo(bx + bw/2, by + bh * .82);
        c.lineTo(bx,         by + bh);
        c.lineTo(bx - bw/2, by + bh * .82);
        c.closePath();
        c.fill(); c.stroke();
        // Rune symbol on banner
        c.fillStyle = 'rgba(255,255,255,.22)';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `${Math.max(8, bw*.55)}px serif`;
        c.fillText('᛭', bx, by + bh*.46);
      }
    }

    // — Lifted selection outline
    if (lifted) {
      c.strokeStyle = '#d7b8ff'; c.lineWidth = 2.5*s;
      c.setLineDash([6*s, 4*s]);
      c.strokeRect(-w*.56, -h*1.06, w*1.12, h*1.16);
      c.setLineDash([]);
    }

    // — Selection halo
    if (selected && !lifted) {
      c.save();
      c.shadowColor = t.glow; c.shadowBlur = 18*s;
      c.strokeStyle = t.glow; c.lineWidth = 2*s;
      c.strokeRect(-w*.55, -h*1.04, w*1.10, h*1.14);
      c.restore();
    }

    // — Under construction overlay
    if (underConstruction) {
      const secs = Math.ceil((building.readyAt - Date.now()) / 1000);
      const mins = Math.floor(secs/60);
      const label = mins > 0 ? `${mins}m${secs%60}s` : `${secs}s`;
      c.fillStyle = 'rgba(7,4,14,.88)';
      this.rrect(c, -40*s, -h - 30*s, 80*s, 22*s, 6*s); c.fill();
      c.strokeStyle = t.glow; c.lineWidth = 1.5*s;
      this.rrect(c, -40*s, -h - 30*s, 80*s, 22*s, 6*s); c.stroke();
      c.fillStyle = P.white; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `700 ${Math.max(9,11*s)}px 'Cinzel',serif`;
      c.fillText(`⚒ ${label}`, 0, -h - 19*s);
    }

    c.restore();
  }

  // ── Collection bubble ────────────────────────────────────────────────────

  drawCollectionBubble(building, state, time) {
    const def = this.definitions[building.type];
    if (!def?.extractor || building.readyAt > Date.now()) return;
    const stored    = building.storedResource ?? 0;
    const threshold = def.extractor.collectThreshold ?? 1;
    if (stored < threshold) return;
    const capacity  = def.extractor.capacity * (1 + (building.level-1)*.5);
    const full      = stored >= capacity * .98;
    const { x, y, scale } = this.buildingAnchor(building, state);
    const c = this.ctx;
    const bob = Math.sin(time/260 + building.col * 1.1) * 4 * scale;
    const t   = theme(building.type);
    c.save();
    c.translate(x, y - 96*scale + bob);
    c.shadowColor = full ? P.blood : t.glow;
    c.shadowBlur  = (full ? 20 : 13) * scale;
    // Pill background
    this.rrect(c, -22*scale, -12*scale, 44*scale, 24*scale, 12*scale);
    c.fillStyle   = full ? 'rgba(80,16,24,.97)' : 'rgba(12,8,20,.97)';
    c.strokeStyle = full ? P.blood : t.glow;
    c.lineWidth   = Math.max(1.5, 2*scale);
    c.fill(); c.stroke(); c.shadowBlur = 0;
    c.fillStyle  = full ? P.blood : t.glow;
    c.textAlign  = 'center'; c.textBaseline = 'middle';
    c.font       = `800 ${Math.max(11,14*scale)}px 'Cinzel',serif`;
    const icon = def.extractor.resource==='gold'?'🪙':def.extractor.resource==='wood'?'🪵':'✦';
    c.fillText(full ? `${icon}!` : `${icon} ${Math.floor(stored)}`, 0, 0);
    c.restore();
  }

  // ── Collection popups ────────────────────────────────────────────────────

  drawCollectionPopups(interaction, state, time) {
    const c = this.ctx;
    for (const popup of interaction.collectionPopups ?? []) {
      const building = state.buildings.find(b => b.id === popup.buildingId);
      if (!building) continue;
      const age  = Math.max(0, time - popup.createdAt);
      const prog = Math.min(1, age / 1200);
      const { x, y, scale } = this.buildingAnchor(building, state);
      c.save();
      c.globalAlpha = 1 - prog;
      c.translate(x, y - 72*scale - prog*48*scale);
      c.shadowColor = popup.resource==='gold' ? P.amber : popup.resource==='wood' ? '#8cdf5c' : P.glow;
      c.shadowBlur  = 14*scale;
      c.fillStyle   = c.shadowColor;
      c.textAlign   = 'center';
      c.font        = `900 ${Math.max(14,19*scale)}px sans-serif`;
      c.fillText(`+${popup.amount}`, 0, 0);
      c.restore();
    }
  }

  // ── Village unit (garrison display) ──────────────────────────────────────

  drawVillageUnit(x, y, type, scale=1, alpha=1) {
    const c = this.ctx;
    const r = type==='ghoul' ? 7 : type==='necromancer' ? 6.5 : 5.8;
    const fill   = type==='ghoul' ? '#8a7a5a' : type==='necromancer' ? '#b070f0' : '#ddd8ee';
    const stroke = type==='ghoul' ? '#3a3020' : type==='necromancer' ? '#5018a8' : '#2a1e38';
    c.save(); c.globalAlpha = alpha; c.translate(x, y);
    // Shadow
    c.beginPath(); c.ellipse(0, 3.5*scale, 7.5*scale, 3.5*scale, 0, 0, Math.PI*2);
    c.fillStyle = 'rgba(0,0,0,.38)'; c.fill();
    // Body circle
    c.beginPath(); c.arc(0, 0, r*scale, 0, Math.PI*2);
    c.fillStyle = fill; c.fill();
    c.strokeStyle = stroke; c.lineWidth = Math.max(1, 1.8*scale); c.stroke();
    // Eyes
    c.fillStyle = type==='necromancer' ? '#e8b0ff' : '#ffeecc';
    c.beginPath(); c.arc(-r*.32*scale, -r*.18*scale, r*.22*scale, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc( r*.32*scale, -r*.18*scale, r*.22*scale, 0, Math.PI*2); c.fill();
    // Weapon
    c.strokeStyle = type==='necromancer' ? '#c090ff' : '#9a8a78';
    c.lineWidth   = Math.max(1, 1.4*scale);
    c.beginPath();
    c.moveTo(r*.5*scale, -r*.1*scale);
    c.lineTo(r*1.5*scale, -r*1.2*scale);
    c.stroke();
    c.restore();
  }

  drawCampfireGarrison(building, state, time) {
    if (building.type !== 'campfire' || building.readyAt > Date.now()) return;
    const roster = [];
    for (const [t,n] of Object.entries(building.garrison ?? {})) for (let i=0;i<n;i++) roster.push(t);
    const shown = roster.slice(0, 12);
    const { x, y, scale } = this.buildingAnchor(building, state);
    const c = this.ctx;
    c.save(); c.translate(x, y - 24*scale);
    const pulse = .88 + Math.sin(time/175) * .13;
    c.shadowColor = P.green; c.shadowBlur = 20*scale;
    c.fillStyle   = `rgba(98,220,160,${.8 + pulse*.1})`;
    c.beginPath(); c.arc(0, 0, 6.5*scale*pulse, 0, Math.PI*2); c.fill();
    c.shadowBlur = 0;
    c.restore();
    shown.forEach((t, i) => {
      const ring  = Math.floor(i/6);
      const slot  = i % 6;
      const angle = (Math.PI*2/6)*slot + ring*.42;
      const rad   = (30 + ring*14)*scale;
      const sway  = Math.sin(time/400 + i*.7) * 1.8*scale;
      this.drawVillageUnit(
        x + Math.cos(angle)*rad,
        y + Math.sin(angle)*rad*.46 + sway,
        t, scale*.9, .96
      );
    });
    if (roster.length > shown.length) {
      c.save(); c.translate(x, y + 20*scale);
      c.fillStyle   = 'rgba(10,7,16,.92)';
      c.strokeStyle = P.green; c.lineWidth = 1.8*scale;
      c.beginPath(); c.arc(0, 0, 13*scale, 0, Math.PI*2); c.fill(); c.stroke();
      c.fillStyle = P.white; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${Math.max(8,10*scale)}px sans-serif`;
      c.fillText(`+${roster.length - shown.length}`, 0, 0);
      c.restore();
    }
  }

  drawTroopTransfers(state, interaction, time) {
    for (const tr of interaction.troopTransfers ?? []) {
      const from = state.buildings.find(b => b.id === tr.fromId);
      const to   = state.buildings.find(b => b.id === tr.toId);
      if (!from || !to) continue;
      const prog   = Math.min(1, Math.max(0, (time - tr.createdAt) / (tr.duration ?? 1200)));
      const eased  = 1 - Math.pow(1 - prog, 3);
      const s      = this.buildingAnchor(from, state);
      const e      = this.buildingAnchor(to,   state);
      const x      = s.x + (e.x - s.x)*eased;
      const y      = s.y + (e.y - s.y)*eased - Math.sin(prog*Math.PI)*20*state.camera.zoom;
      this.drawVillageUnit(x, y - 18*state.camera.zoom, tr.type, state.camera.zoom, 1 - prog*.12);
    }
  }

  // ── Main render ──────────────────────────────────────────────────────────

  render(state, interaction, time) {
    this.ground(state.camera, time);
    if (interaction.preview)
      this.footprint(interaction.preview, state.camera, false, interaction.preview.valid);
    [...state.buildings]
      .sort((a,b) => (a.col+a.row) - (b.col+b.row))
      .forEach(b => {
        this.drawBuilding(b, state, b.id===interaction.selectedId, time, b.id===interaction.liftedId);
        this.drawCollectionBubble(b, state, time);
        this.drawCampfireGarrison(b, state, time);
      });
    this.drawTroopTransfers(state, interaction, time);
    this.drawCollectionPopups(interaction, state, time);
  }
}
