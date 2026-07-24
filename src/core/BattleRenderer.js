/**
 * BattleRenderer — Dark Souls × Supercell battle scene
 *
 * Features:
 *  - Ash-cracked battlefield with lava fissures + moving ember particles
 *  - Procedural building shapes: tower / castle / catapult / spire / trap
 *    with per-type glow, stone texture, crenellations, arrow slits
 *  - Animated unit blobs with thick outline, eye glow, weapon line, HP bar
 *  - Hit/shot/splash/trap effects with ring burst + particle spray
 *  - Damage crack overlay on low-HP buildings
 *  - Countdown + destruction % HUD overlay
 */

const B = {
  bg0:    '#0b0810',
  bg1:    '#180f22',
  bg2:    '#231628',
  lava:   '#e03810',
  ember:  '#f07020',
  glow:   '#b87cff',
  violet: '#7c3fcf',
  amber:  '#e8a630',
  green:  '#62dca0',
  blood:  '#d84858',
  stone:  '#2e2438',
  stoneLt:'#3e3250',
  outline:'#07050d',
  white:  '#f0eaf8',
};

// Per-building-type visual theme
const BT = {
  townHall:     { body:'#281e36', roof:'#38284a', glow:'#d070ff', accent:'#a040e8' },
  goldMine:     { body:'#2e2414', roof:'#403218', glow:'#f0c458', accent:'#c89030' },
  soulVault:    { body:'#18202e', roof:'#22304a', glow:'#58b0ff', accent:'#3080d0' },
  barracks:     { body:'#2a1a1a', roof:'#3a2424', glow:'#ff7060', accent:'#c03030' },
  runeTower:    { body:'#1a1428', roof:'#262038', glow:'#c880ff', accent:'#9040e0' },
  boneCatapult: { body:'#2a1e0c', roof:'#382812', glow:'#ff9840', accent:'#c06020' },
  soulSpire:    { body:'#140e22', roof:'#1e1630', glow:'#e0b0ff', accent:'#a060e8' },
  cursedTrap:   { body:'#1e1014', roof:'#2a181e', glow:'#ff4060', accent:'#c02040' },
};
const bt = (type) => BT[type] ?? { body:'#221830', roof:'#301e40', glow:B.glow, accent:B.violet };

export class BattleRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._particles = []; // persistent ember particles
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }

  // ── Helpers ──────────────────────────────────────────────────────────────

  rrect(c, x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    c.beginPath();
    c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
  }

  // ── Ground ───────────────────────────────────────────────────────────────

  ground(time) {
    const c  = this.ctx;
    const vp = this.viewport();

    // Radial bg
    const rg = c.createRadialGradient(vp.width*.5, vp.height*.42, 30, vp.width*.5, vp.height*.5, vp.width*.78);
    rg.addColorStop(0, '#2a1e36');
    rg.addColorStop(.5, '#170f22');
    rg.addColorStop(1,  B.bg0);
    c.fillStyle = rg; c.fillRect(0, 0, vp.width, vp.height);

    // Lava crack veins
    c.save(); c.globalAlpha = .14;
    for (let i = 0; i < 12; i++) {
      const ox = (i * 137 + time * .003) % (vp.width + 300) - 150;
      const oy = (i * 73) % vp.height;
      const g  = c.createLinearGradient(ox, oy, ox+40, oy + vp.height*.6);
      g.addColorStop(0,   'transparent');
      g.addColorStop(.3,  B.lava);
      g.addColorStop(.7,  B.ember);
      g.addColorStop(1,   'transparent');
      c.strokeStyle = g; c.lineWidth = 1 + (i%3)*.5;
      c.beginPath();
      c.moveTo(ox, oy);
      c.bezierCurveTo(ox+20, oy+vp.height*.25, ox-15, oy+vp.height*.55, ox+10, oy+vp.height*.9);
      c.stroke();
    }
    c.restore();

    // Ash ground tile grid (perspective foreshortened)
    c.save(); c.globalAlpha = .12;
    c.strokeStyle = B.stoneLt; c.lineWidth = .7;
    const tileW = 52, tileH = 26;
    for (let x = 0; x < vp.width + tileW; x += tileW) {
      for (let y = 0; y < vp.height + tileH; y += tileH) {
        const px = x - (y * .2) % tileW;
        c.strokeRect(px, y, tileW, tileH);
      }
    }
    c.restore();

    // Ember / dust particles
    c.save();
    for (let i = 0; i < 60; i++) {
      const t  = time * .001 * (i%5+.3);
      const x  = ((i*173 + t*14) % (vp.width+20));
      const y  = ((i*89  - t*8 + vp.height) % (vp.height+20));
      const sz = i%7===0 ? 2.4 : 1.5;
      const a  = .15 + (Math.sin(t + i) * .5 + .5) * .22;
      c.globalAlpha = a;
      c.fillStyle = i%6===0 ? B.amber : i%4===0 ? B.lava : B.glow;
      c.beginPath(); c.arc(x, y, sz, 0, Math.PI*2); c.fill();
    }
    c.restore();

    // Diagonal slash lines (battlefield atmosphere)
    c.save(); c.globalAlpha = .07; c.strokeStyle = B.stoneLt; c.lineWidth = .9;
    for (let x = -200; x < vp.width+200; x += 68) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 160, vp.height); c.stroke();
    }
    c.restore();

    // Vignette
    const vig = c.createRadialGradient(vp.width/2, vp.height/2, vp.height*.1, vp.width/2, vp.height/2, vp.width*.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(4,2,10,.75)');
    c.fillStyle = vig; c.fillRect(0, 0, vp.width, vp.height);
  }

  // ── Building draw ────────────────────────────────────────────────────────

  drawBuilding(b, time) {
    const c  = this.ctx;
    const t  = bt(b.type);
    const hp = Math.max(0, b.hp / b.maxHp);
    const r  = b.radius;
    const flicker = Math.sin(time/160 + b.x*.02) * .5 + .5;

    c.save(); c.translate(b.x, b.y);

    // Hidden traps are invisible
    if (b.trap && b.hidden) {
      c.globalAlpha = .12;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI*2);
      c.fillStyle = B.blood; c.fill();
      c.restore(); return;
    }

    // Shadow
    c.beginPath(); c.ellipse(0, r*.55, r*1.2, r*.45, 0, 0, Math.PI*2);
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fill();

    if (b.trap) {
      // — Trap: revealed spike cluster
      c.fillStyle = t.body; c.strokeStyle = B.outline; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI*2); c.fill(); c.stroke();
      c.save(); c.shadowColor = t.glow; c.shadowBlur = 10;
      c.strokeStyle = t.accent; c.lineWidth = 2;
      for (let i=0;i<6;i++){
        const a = i/6*Math.PI*2;
        c.beginPath(); c.moveTo(0,0); c.lineTo(Math.cos(a)*r*.82,Math.sin(a)*r*.82); c.stroke();
      }
      c.shadowBlur=0; c.restore();
    } else if (b.type === 'boneCatapult') {
      // — Catapult: arm + bucket
      const bw = r*1.8, bh = r*1.2;
      c.fillStyle = t.body; c.strokeStyle = B.outline; c.lineWidth = 2.5;
      c.fillRect(-bw/2, -bh, bw, bh); c.strokeRect(-bw/2, -bh, bw, bh);
      // Arm
      c.save(); c.rotate(-Math.PI*.18 + Math.sin(time/400)*.06);
      c.strokeStyle = '#806040'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r*1.4); c.stroke();
      // Bucket
      c.fillStyle = B.stoneLt;
      c.beginPath(); c.arc(0, -r*1.4, r*.28, 0, Math.PI*2); c.fill(); c.stroke();
      c.restore();
      c.save(); c.shadowColor = t.glow; c.shadowBlur = 8;
      c.fillStyle = t.accent;
      this.rrect(c, -r*.22, -bh*.55, r*.44, bh*.28, 3); c.fill();
      c.shadowBlur=0; c.restore();
    } else {
      // — Generic tower / building
      const bw = r * 1.44, bh = r * 1.35;
      // Base
      const bg = c.createLinearGradient(-bw/2, -bh, bw/2, 0);
      bg.addColorStop(0, t.roof); bg.addColorStop(1, t.body);
      c.fillStyle = bg; c.strokeStyle = B.outline; c.lineWidth = 2.5;
      c.fillRect(-bw/2, -bh, bw, bh); c.strokeRect(-bw/2, -bh, bw, bh);

      // Stone mortar lines
      c.save(); c.globalAlpha = .2; c.strokeStyle = B.outline; c.lineWidth = .8;
      for (let i=1;i<3;i++){
        c.beginPath(); c.moveTo(-bw/2, -bh*i/3); c.lineTo(bw/2,-bh*i/3); c.stroke();
      }
      c.restore();

      // Crenellations on top
      c.fillStyle = t.roof; c.strokeStyle = B.outline; c.lineWidth = 2;
      const nC = 3; const cw = bw/nC; const ch = r*.28;
      for (let i=0;i<nC;i+=2){
        c.fillRect(-bw/2 + i*cw, -bh - ch, cw, ch);
        c.strokeRect(-bw/2 + i*cw, -bh - ch, cw, ch);
      }

      // Glowing window slit
      c.save();
      c.shadowColor = t.glow; c.shadowBlur = (10 + flicker*12);
      c.fillStyle   = t.accent;
      this.rrect(c, -r*.12, -bh*.58, r*.24, bh*.3, 2); c.fill();
      c.shadowBlur=0; c.restore();

      // Torch glow
      c.save();
      c.shadowColor = B.amber; c.shadowBlur = 10 + flicker*12;
      c.fillStyle   = `rgba(232,166,48,${.55+flicker*.45})`;
      c.beginPath(); c.ellipse(bw*.42, -bh*.72, 3, 5+flicker*2, 0, 0, Math.PI*2); c.fill();
      c.shadowBlur=0; c.restore();
    }

    // Damage cracks overlay (< 40% HP)
    if (hp < .4 && !b.trap) {
      c.save(); c.globalAlpha = (1 - hp/.4) * .6;
      c.strokeStyle = B.blood; c.lineWidth = 1.2;
      for (let i=0;i<4;i++) {
        const a = (i/4)*Math.PI*2 + b.x*.01;
        c.beginPath();
        c.moveTo(0,0);
        c.lineTo(Math.cos(a)*r*.8 + Math.cos(a+.4)*r*.4, Math.sin(a)*r*.7 + Math.sin(a+.4)*r*.3);
        c.stroke();
      }
      c.restore();
    }

    // HP bar
    if (!b.trap) {
      const bw2 = r*2; const bx = -r; const by = -b.radius - 18;
      c.fillStyle = 'rgba(0,0,0,.76)'; c.fillRect(bx, by, bw2, 7);
      c.fillStyle = hp>.5 ? B.green : hp>.25 ? B.amber : B.blood;
      c.shadowColor = c.fillStyle; c.shadowBlur = 6;
      c.fillRect(bx, by, bw2*hp, 7);
      c.shadowBlur = 0;
      c.strokeStyle = B.outline; c.lineWidth = 1; c.strokeRect(bx, by, bw2, 7);
    }

    c.restore();
  }

  // ── Unit draw ────────────────────────────────────────────────────────────

  drawUnit(u, time) {
    const c  = this.ctx;
    const hp = Math.max(0, u.hp / u.maxHp);
    const r  = u.type==='ghoul' ? 13 : u.type==='necromancer' ? 11 : 10;
    const fill   = u.type==='ghoul' ? '#8a7a58' : u.type==='necromancer' ? '#a060e0' : '#ddd4ee';
    const glow   = u.type==='ghoul' ? '#c8b070' : u.type==='necromancer' ? '#d090ff' : '#f0e8ff';
    const eyeCol = u.type==='necromancer' ? '#e8a0ff' : '#fff0aa';

    c.save();
    c.translate(u.x, u.y);
    c.globalAlpha = u.dead ? .2 : 1;

    // Shadow
    c.beginPath(); c.ellipse(0, r*.55, r*1.1, r*.38, 0, 0, Math.PI*2);
    c.fillStyle = 'rgba(0,0,0,.42)'; c.fill();

    // Supercell outline: thick dark ring first
    c.beginPath(); c.arc(0, 0, r+2, 0, Math.PI*2);
    c.fillStyle = B.outline; c.fill();

    // Body
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI*2);
    c.fillStyle = fill; c.fill();

    // Glow rim
    if (!u.dead) {
      const bob = Math.sin(time/220 + u.x*.03) * .5 + .5;
      c.save();
      c.shadowColor = glow; c.shadowBlur = 6 + bob*6;
      c.strokeStyle = glow; c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI*2); c.stroke();
      c.shadowBlur=0; c.restore();
    }

    // Eyes
    c.fillStyle = eyeCol;
    c.beginPath(); c.ellipse(-r*.32, -r*.18, r*.22, r*.18, 0, 0, Math.PI*2); c.fill();
    c.beginPath(); c.ellipse( r*.32, -r*.18, r*.22, r*.18, 0, 0, Math.PI*2); c.fill();
    c.fillStyle = B.outline;
    c.beginPath(); c.ellipse(-r*.32, -r*.18, r*.1, r*.1, 0, 0, Math.PI*2); c.fill();
    c.beginPath(); c.ellipse( r*.32, -r*.18, r*.1, r*.1, 0, 0, Math.PI*2); c.fill();

    // Weapon
    c.strokeStyle = u.type==='necromancer' ? '#c090ff' : '#9a8870';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(r*.5,  -r*.1);
    c.lineTo(r*1.6, -r*1.3);
    c.stroke();
    if (u.type==='necromancer') {
      // Staff orb
      c.fillStyle = '#d0a0ff';
      c.beginPath(); c.arc(r*1.6, -r*1.3, 3, 0, Math.PI*2); c.fill();
    }

    // HP bar
    if (!u.dead) {
      const bw = r*2.4; const bx = -bw/2; const by = -r - 10;
      c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(bx, by, bw, 4);
      c.fillStyle = hp>.5 ? B.green : hp>.25 ? B.amber : B.blood;
      c.fillRect(bx, by, bw*hp, 4);
      c.strokeStyle = B.outline; c.lineWidth = .8; c.strokeRect(bx, by, bw, 4);
    }

    c.restore();
  }

  // ── Effects ──────────────────────────────────────────────────────────────

  drawEffects(effects, time) {
    const c = this.ctx;
    for (const fx of effects) {
      const maxLife = fx.kind==='trap' ? .5 : fx.kind==='splash' ? .45 : .35;
      const t = Math.max(0, 1 - fx.life/maxLife); // 0=fresh 1=dying
      c.save();

      if (fx.kind === 'hit') {
        // Orange ring burst
        c.globalAlpha = (1-t)*.9;
        c.strokeStyle = B.amber; c.lineWidth = 2.5;
        c.shadowColor = B.amber; c.shadowBlur = 10;
        c.beginPath(); c.arc(fx.x, fx.y, 6+t*22, 0, Math.PI*2); c.stroke();
        c.shadowBlur=0;
        // Spark particles
        c.globalAlpha = (1-t)*.6;
        c.fillStyle = B.amber;
        for (let i=0;i<5;i++) {
          const a = i/5*Math.PI*2 + t*2;
          c.beginPath(); c.arc(fx.x+Math.cos(a)*(8+t*18), fx.y+Math.sin(a)*(8+t*18)*.6, 2, 0, Math.PI*2); c.fill();
        }
      } else if (fx.kind === 'shot') {
        // Violet ring + inner flash
        c.globalAlpha = (1-t)*.85;
        c.strokeStyle = B.glow; c.lineWidth = 2;
        c.shadowColor = B.glow; c.shadowBlur = 14;
        c.beginPath(); c.arc(fx.x, fx.y, 5+t*20, 0, Math.PI*2); c.stroke();
        c.shadowBlur=0;
        c.globalAlpha = (1-t)*.4;
        c.fillStyle = B.glow;
        c.beginPath(); c.arc(fx.x, fx.y, 5+t*8, 0, Math.PI*2); c.fill();
      } else if (fx.kind === 'splash') {
        // Blood-red expanding wave
        c.globalAlpha = (1-t)*.75;
        c.strokeStyle = B.blood; c.lineWidth = 3;
        c.shadowColor = B.blood; c.shadowBlur = 16;
        c.beginPath(); c.arc(fx.x, fx.y, 8+t*52, 0, Math.PI*2); c.stroke();
        c.shadowBlur=0;
        // Second inner ring
        c.globalAlpha = (1-t)*.4;
        c.strokeStyle = B.amber; c.lineWidth = 1.5;
        c.beginPath(); c.arc(fx.x, fx.y, 5+t*30, 0, Math.PI*2); c.stroke();
      } else if (fx.kind === 'trap') {
        // Green toxic burst
        c.globalAlpha = (1-t)*.8;
        c.strokeStyle = B.green; c.lineWidth = 2.5;
        c.shadowColor = B.green; c.shadowBlur = 18;
        c.beginPath(); c.arc(fx.x, fx.y, 6+t*44, 0, Math.PI*2); c.stroke();
        c.shadowBlur=0;
        // Spike rays
        c.globalAlpha = (1-t)*.5;
        c.strokeStyle = B.green; c.lineWidth = 1.5;
        for (let i=0;i<8;i++){
          const a = i/8*Math.PI*2;
          const d = 10+t*42;
          c.beginPath();
          c.moveTo(fx.x+Math.cos(a)*6, fx.y+Math.sin(a)*6);
          c.lineTo(fx.x+Math.cos(a)*d, fx.y+Math.sin(a)*d);
          c.stroke();
        }
      }
      c.restore();
    }
  }

  // ── HUD overlay ──────────────────────────────────────────────────────────

  drawHUD(battle, time) {
    const c  = this.ctx;
    const vp = this.viewport();
    const tl = Math.max(0, battle.timeLeft);
    const mm = Math.floor(tl/60), ss = Math.floor(tl%60);
    const label = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    const scoring = battle.buildings.filter(b=>!b.trap);
    const totalHp = scoring.reduce((s,b)=>s+b.maxHp, 0);
    const remHp   = scoring.reduce((s,b)=>s+Math.max(0,b.hp), 0);
    const destPct = Math.round((1 - remHp/totalHp)*100);

    // Timer pill
    const urgency = tl < 15;
    c.save();
    const px = vp.width/2, py = 18;
    c.shadowColor = urgency ? B.blood : B.glow;
    c.shadowBlur  = urgency ? 18 : 10;
    c.fillStyle   = 'rgba(7,4,14,.9)';
    this.rrect(c, px-52, py, 104, 30, 15); c.fill();
    c.strokeStyle = urgency ? B.blood : B.glow; c.lineWidth = 1.8;
    this.rrect(c, px-52, py, 104, 30, 15); c.stroke();
    c.shadowBlur=0;
    c.fillStyle  = urgency ? B.blood : B.white;
    c.textAlign  = 'center'; c.textBaseline = 'middle';
    c.font       = `700 18px 'Cinzel',serif`;
    c.fillText(`⏱ ${label}`, px, py+15);

    // Destruction %
    c.shadowBlur=0;
    c.fillStyle = 'rgba(7,4,14,.86)';
    this.rrect(c, px-42, py+36, 84, 22, 11); c.fill();
    c.strokeStyle = B.amber; c.lineWidth = 1.4;
    this.rrect(c, px-42, py+36, 84, 22, 11); c.stroke();
    c.fillStyle = B.amber;
    c.font = `700 13px 'Cinzel',serif`;
    c.fillText(`💥 ${destPct}%`, px, py+47);
    c.restore();
  }

  // ── Main render ──────────────────────────────────────────────────────────

  render(battle, time) {
    this.ground(time);
    // Draw buildings (dead last so effects appear on top)
    [...battle.buildings]
      .sort((a,b) => a.y - b.y)
      .forEach(b => { if (b.hp > 0 || b.trap) this.drawBuilding(b, time); });
    // Units
    battle.deployed
      .sort((a,b) => a.y - b.y)
      .forEach(u => this.drawUnit(u, time));
    this.drawEffects(battle.effects, time);
    this.drawHUD(battle, time);
  }
}
