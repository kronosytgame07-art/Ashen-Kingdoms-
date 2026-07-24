/**
 * BattleRenderer — Ashen Kingdoms
 *
 * Rendu ISOMÉTRIQUE natif via BuildingArtist.DRAW_FN,
 * exactement comme VillageRenderer.
 *
 * Le canvas de combat utilise une grille iso identique au village
 * (tileWidth=88, tileHeight=44) mais centrée différemment.
 *
 * Le spawn autour du village est visualisé par des marqueurs
 * sur le bord de la grille.
 */
import { DRAW_FN } from './BuildingArtist.js';
import { BATTLE_CONFIG } from '../data/battle.js';
import { Grid } from './Grid.js';

const B = {
  bg0:    '#0b0810',
  lava:   '#e03810',
  ember:  '#f07020',
  glow:   '#b87cff',
  amber:  '#e8a630',
  green:  '#62dca0',
  blood:  '#d84858',
  stone:  '#2e2438',
  stoneLt:'#3e3250',
  outline:'#07050d',
  white:  '#f0eaf8',
  tile0:  'rgba(30,20,44,.94)',
  tile1:  'rgba(22,14,34,.94)',
  tileEdge:'rgba(80,50,110,.28)',
};

// ─ diamond (même algo que VillageRenderer) ─────────────────────────────────
function diamond(sw, sh, tileW, tileH) {
  const ex = tileW / 2;
  const ey = tileH / 2;
  return {
    south: { x: 0,              y: 0 },
    east:  { x: -sw * ex,       y: -sw * ey },
    north: { x: (sh - sw) * ex, y: -(sw + sh) * ey },
    west:  { x:  sh * ex,       y: -sh * ey },
    hw: (sw + sh) * ex / 2,
    hh: (sw + sh) * ey / 2,
    tileW, tileH, sw, sh,
  };
}

export class BattleRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._grid  = new Grid({
      columns:    BATTLE_CONFIG.gridCols,
      rows:       BATTLE_CONFIG.gridRows,
      tileWidth:  BATTLE_CONFIG.tileWidth,
      tileHeight: BATTLE_CONFIG.tileHeight,
    });
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }

  // ─ helpers ─────────────────────────────────────────────────────────────
  rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  polygon(points, fill, stroke, lw = 1) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
    c.closePath();
    if (fill)   { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }

  // ─ caméra de combat ─────────────────────────────────────────────────────
  // Zoom légèrement réduit pour voir tout le village
  camera(viewport) {
    return { x: 0, y: 0, zoom: Math.min(viewport.width, viewport.height) / 900 };
  }

  // ─ tuile iso ────────────────────────────────────────────────────────────
  tile(col, row, cam, vp, fill, stroke) {
    const pt = this._grid.gridToScreen(col, row, cam, vp);
    const hw = this._grid.tileWidth  * cam.zoom / 2;
    const hh = this._grid.tileHeight * cam.zoom / 2;
    this.polygon([
      { x: pt.x,      y: pt.y },
      { x: pt.x + hw, y: pt.y + hh },
      { x: pt.x,      y: pt.y + hh * 2 },
      { x: pt.x - hw, y: pt.y + hh },
    ], fill, stroke ?? B.tileEdge, Math.max(.5, cam.zoom * .8));
  }

  // ─ sol ──────────────────────────────────────────────────────────────────
  ground(time, cam, vp) {
    const c = this.ctx;

    // Fond dégradé
    const grad = c.createLinearGradient(0, 0, 0, vp.height);
    grad.addColorStop(0, '#1a0f28');
    grad.addColorStop(.5, '#130a1e');
    grad.addColorStop(1, B.bg0);
    c.fillStyle = grad; c.fillRect(0, 0, vp.width, vp.height);

    // Veines de lave
    c.save(); c.globalAlpha = .10; c.strokeStyle = B.lava; c.lineWidth = .9;
    for (let i = 0; i < 10; i++) {
      const ox = (i * 137 + time * .003) % (vp.width + 200) - 100;
      c.beginPath(); c.moveTo(ox, 0);
      c.bezierCurveTo(ox + 25, vp.height * .3, ox - 18, vp.height * .65, ox + 12, vp.height);
      c.stroke();
    }
    c.restore();

    // Tuiles iso
    const cols = BATTLE_CONFIG.gridCols;
    const rows = BATTLE_CONFIG.gridRows;
    for (let col = 0; col < cols; col++)
      for (let row = 0; row < rows; row++)
        this.tile(col, row, cam, vp,
          (col + row) % 2 ? B.tile0 : B.tile1, B.tileEdge);

    // Braises
    c.save(); c.globalAlpha = .22;
    for (let i = 0; i < 50; i++) {
      const tt = time * .001 * (i % 4 + .4);
      const x  = (i * 173 + tt * 16) % (vp.width  + 20);
      const y  = (i * 89  + tt * 9)  % (vp.height + 20);
      c.fillStyle = i % 6 === 0 ? B.amber : i % 4 === 0 ? B.lava : B.glow;
      c.beginPath(); c.arc(x, y, i % 5 === 0 ? 2.1 : 1.3, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    // Vignette
    const vig = c.createRadialGradient(vp.width/2, vp.height/2, vp.height*.1,
                                        vp.width/2, vp.height/2, vp.width*.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(4,2,10,.72)');
    c.fillStyle = vig; c.fillRect(0, 0, vp.width, vp.height);
  }

  // ─ zone de spawn (bord de grille, teinté rouge) ─────────────────────────
  drawSpawnZone(battle, cam, vp) {
    if (!battle.spawnZone?.length) return;
    const c = this.ctx;
    c.save(); c.globalAlpha = .18;
    for (const pt of battle.spawnZone) {
      c.fillStyle = B.blood;
      c.beginPath(); c.arc(pt.x, pt.y, 5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // ─ bâtiment ennemi (prisme iso via BuildingArtist) ─────────────────────
  drawBuilding(b, cam, vp, time) {
    const c   = this.ctx;
    const tileW = this._grid.tileWidth  * cam.zoom;
    const tileH = this._grid.tileHeight * cam.zoom;
    const sw  = b.size?.w ?? 1;
    const sh  = b.size?.h ?? 1;
    const hp  = Math.max(0, b.hp / b.maxHp);

    // Point SUD en px = gridToScreen(col+sw, row+sh)
    const ptSouth = this._grid.gridToScreen(b.col + sw, b.row + sh, cam, vp);
    const x = ptSouth.x;
    const y = ptSouth.y;

    // Empreinte
    if (!b.trap || !b.hidden) {
      for (let dx = 0; dx < sw; dx++) {
        for (let dy = 0; dy < sh; dy++) {
          const fillCol = b.isWall
            ? 'rgba(80,50,110,.22)'
            : b.trap
              ? 'rgba(216,72,88,.15)'
              : 'rgba(60,40,90,.20)';
          this.tile(b.col + dx, b.row + dy, cam, vp, fillCol, B.tileEdge);
        }
      }
    }

    if (b.trap && b.hidden) {
      // Piège caché : juste un léger halo sang
      c.save(); c.globalAlpha = .08;
      c.fillStyle = B.blood;
      c.beginPath(); c.arc(x, y, b.radius * .5, 0, Math.PI * 2); c.fill();
      c.restore();
      return;
    }

    // Dessin iso
    const d     = diamond(sw, sh, tileW, tileH);
    const wallH = tileH * (sw + sh) * 0.55;
    const iso   = { d, wallH, tileW, tileH, sw, sh };
    const tSec  = time / 1000;
    const flick = Math.sin(tSec * 4.2 + b.col * 1.4) * .5 + .5;
    const level = b.enemyLevel ?? 1;

    c.save();
    c.translate(x, y);
    if (b.hp <= 0) c.globalAlpha = .38;

    const drawFn = DRAW_FN[b.type];
    if (drawFn) {
      drawFn(c, iso, level, tSec, flick, false);
    } else {
      // fallback générique
      const { south, east, north, west } = d;
      c.beginPath();
      c.moveTo(west.x, west.y); c.lineTo(south.x, south.y);
      c.lineTo(south.x, south.y - wallH); c.lineTo(west.x, west.y - wallH);
      c.closePath(); c.fillStyle = '#2a1e40'; c.fill();
      c.strokeStyle = B.outline; c.lineWidth = 1.2; c.stroke();
      c.beginPath();
      c.moveTo(east.x, east.y); c.lineTo(south.x, south.y);
      c.lineTo(south.x, south.y - wallH); c.lineTo(east.x, east.y - wallH);
      c.closePath(); c.fillStyle = '#1e1530'; c.fill();
      c.strokeStyle = B.outline; c.lineWidth = 1.2; c.stroke();
      c.beginPath();
      c.moveTo(north.x, north.y - wallH); c.lineTo(east.x, east.y - wallH);
      c.lineTo(south.x, south.y - wallH); c.lineTo(west.x, west.y - wallH);
      c.closePath(); c.fillStyle = '#3a2a52';
      c.strokeStyle = B.glow; c.lineWidth = 1.5;
      c.fill(); c.stroke();
    }

    // Dommages : craquelures rouges
    if (hp < 0.5 && !b.trap) {
      c.globalAlpha *= (1 - hp) * .7;
      c.strokeStyle = B.blood; c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2 + b.col * .3;
        const r   = wallH * .4;
        c.beginPath();
        c.moveTo(0, -wallH * .3);
        c.lineTo(Math.cos(ang) * r, -wallH * .3 + Math.sin(ang) * r * .5);
        c.stroke();
      }
    }

    c.restore();

    // Barre de vie
    if (!b.trap) {
      const bw = tileW * (sw + sh) * .55;
      const bx = x - bw / 2;
      const by = y + d.north.y - wallH - tileH * .4;
      c.fillStyle = 'rgba(0,0,0,.76)'; c.fillRect(bx, by, bw, 6);
      c.fillStyle = hp > .5 ? B.green : hp > .25 ? B.amber : B.blood;
      c.shadowColor = c.fillStyle; c.shadowBlur = 5;
      c.fillRect(bx, by, bw * hp, 6);
      c.shadowBlur = 0;
      c.strokeStyle = B.outline; c.lineWidth = 1; c.strokeRect(bx, by, bw, 6);
    }
  }

  // ─ unité alliée ──────────────────────────────────────────────────────────
  drawUnit(u, time) {
    const c  = this.ctx;
    const hp = Math.max(0, u.hp / u.maxHp);
    const r  = u.type === 'ghoul' ? 13 : u.type === 'necromancer' ? 11 : 10;
    const fill  = u.type === 'ghoul' ? '#8a7a58' : u.type === 'necromancer' ? '#a060e0' : '#ddd4ee';
    const glow  = u.type === 'ghoul' ? '#c8b070' : u.type === 'necromancer' ? '#d090ff' : '#f0e8ff';
    const eyeC  = u.type === 'necromancer' ? '#e8a0ff' : '#fff0aa';

    c.save();
    c.translate(u.x, u.y);
    c.globalAlpha = u.dead ? .22 : 1;

    // Ombre
    c.beginPath(); c.ellipse(0, r * .5, r * 1.1, r * .38, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,.44)'; c.fill();

    // Contour épais
    c.beginPath(); c.arc(0, 0, r + 2, 0, Math.PI * 2);
    c.fillStyle = B.outline; c.fill();

    // Corps
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill();

    // Halo
    if (!u.dead) {
      const bob = Math.sin(time / 220 + u.x * .03) * .5 + .5;
      c.save();
      c.shadowColor = glow; c.shadowBlur = 6 + bob * 6;
      c.strokeStyle = glow; c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
      c.shadowBlur = 0; c.restore();
    }

    // Yeux
    c.fillStyle = eyeC;
    c.beginPath(); c.ellipse(-r * .32, -r * .18, r * .22, r * .18, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse( r * .32, -r * .18, r * .22, r * .18, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = B.outline;
    c.beginPath(); c.ellipse(-r * .32, -r * .18, r * .1, r * .1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse( r * .32, -r * .18, r * .1, r * .1, 0, 0, Math.PI * 2); c.fill();

    // Arme
    c.strokeStyle = u.type === 'necromancer' ? '#c090ff' : '#9a8870';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(r * .5, -r * .1); c.lineTo(r * 1.6, -r * 1.3); c.stroke();
    if (u.type === 'necromancer') {
      c.fillStyle = '#d0a0ff';
      c.beginPath(); c.arc(r * 1.6, -r * 1.3, 3, 0, Math.PI * 2); c.fill();
    }

    // Barre de vie
    if (!u.dead) {
      const bw = r * 2.4, bx = -r * 1.2, by = -r - 10;
      c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(bx, by, bw, 4);
      c.fillStyle = hp > .5 ? B.green : hp > .25 ? B.amber : B.blood;
      c.fillRect(bx, by, bw * hp, 4);
      c.strokeStyle = B.outline; c.lineWidth = .8; c.strokeRect(bx, by, bw, 4);
    }
    c.restore();
  }

  // ─ effets ────────────────────────────────────────────────────────────────
  drawEffects(effects) {
    const c = this.ctx;
    for (const fx of effects) {
      const maxLife = fx.kind === 'trap' ? .5 : fx.kind === 'splash' ? .45 : .35;
      const t = Math.max(0, 1 - fx.life / maxLife);
      c.save();
      if (fx.kind === 'hit') {
        c.globalAlpha = (1 - t) * .9; c.strokeStyle = B.amber; c.lineWidth = 2.5;
        c.shadowColor = B.amber; c.shadowBlur = 10;
        c.beginPath(); c.arc(fx.x, fx.y, 6 + t * 22, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else if (fx.kind === 'shot') {
        c.globalAlpha = (1 - t) * .85; c.strokeStyle = B.glow; c.lineWidth = 2;
        c.shadowColor = B.glow; c.shadowBlur = 14;
        c.beginPath(); c.arc(fx.x, fx.y, 5 + t * 20, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else if (fx.kind === 'splash') {
        c.globalAlpha = (1 - t) * .75; c.strokeStyle = B.blood; c.lineWidth = 3;
        c.shadowColor = B.blood; c.shadowBlur = 16;
        c.beginPath(); c.arc(fx.x, fx.y, 8 + t * 52, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else if (fx.kind === 'trap') {
        c.globalAlpha = (1 - t) * .8; c.strokeStyle = B.green; c.lineWidth = 2.5;
        c.shadowColor = B.green; c.shadowBlur = 18;
        c.beginPath(); c.arc(fx.x, fx.y, 6 + t * 44, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
        c.globalAlpha = (1 - t) * .5; c.strokeStyle = B.green; c.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          c.beginPath();
          c.moveTo(fx.x + Math.cos(a) * 6, fx.y + Math.sin(a) * 6);
          c.lineTo(fx.x + Math.cos(a) * (10 + t * 42), fx.y + Math.sin(a) * (10 + t * 42));
          c.stroke();
        }
      }
      c.restore();
    }
  }

  // ─ HUD ──────────────────────────────────────────────────────────────────
  drawHUD(battle, time) {
    const c  = this.ctx;
    const vp = this.viewport();
    const tl = Math.max(0, battle.timeLeft);
    const mm = Math.floor(tl / 60);
    const ss = Math.floor(tl % 60);
    const label = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    const scoring  = battle.buildings.filter(b => !b.trap);
    const totalHp  = scoring.reduce((s, b) => s + b.maxHp, 0);
    const remHp    = scoring.reduce((s, b) => s + Math.max(0, b.hp), 0);
    const destPct  = Math.round((1 - remHp / totalHp) * 100);
    const urgency  = tl < 20;

    c.save();
    const px = vp.width / 2, py = 16;

    // Timer
    c.shadowColor = urgency ? B.blood : B.glow; c.shadowBlur = urgency ? 18 : 10;
    c.fillStyle   = 'rgba(7,4,14,.92)';
    this.rrect(c, px - 54, py, 108, 32, 16); c.fill();
    c.strokeStyle = urgency ? B.blood : B.glow; c.lineWidth = 1.8;
    this.rrect(c, px - 54, py, 108, 32, 16); c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = urgency ? B.blood : B.white;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 18px 'Cinzel',serif`;
    c.fillText(`⏱ ${label}`, px, py + 16);

    // Destruction %
    c.fillStyle = 'rgba(7,4,14,.86)';
    this.rrect(c, px - 44, py + 40, 88, 24, 12); c.fill();
    c.strokeStyle = B.amber; c.lineWidth = 1.4;
    this.rrect(c, px - 44, py + 40, 88, 24, 12); c.stroke();
    c.fillStyle = B.amber; c.font = `700 13px 'Cinzel',serif`;
    c.fillText(`💥 ${destPct}%`, px, py + 52);

    // Étoiles
    const stars = destPct === 100 ? 3
      : battle.buildings.find(b => b.id === 'enemy-th')?.hp <= 0 ? 2
      : destPct >= 50 ? 1 : 0;
    c.font = '22px serif';
    for (let i = 0; i < 3; i++) {
      c.globalAlpha = i < stars ? 1 : .25;
      c.fillText('⭐', px - 30 + i * 30, py + 82);
    }
    c.globalAlpha = 1;

    c.restore();
  }

  // ─ render principal ──────────────────────────────────────────────────────
  render(battle, time) {
    const vp  = this.viewport();
    const cam = this.camera(vp);

    this.ground(time, cam, vp);
    this.drawSpawnZone(battle, cam, vp);

    // Bâtiments triés par (col+row) pour le z-order iso
    [...battle.buildings]
      .sort((a, b) => (a.col + a.row) - (b.col + b.row))
      .forEach(b => {
        if (b.hp > 0 || b.trap) this.drawBuilding(b, cam, vp, time);
      });

    // Unités
    battle.deployed
      .sort((a, b) => a.y - b.y)
      .forEach(u => this.drawUnit(u, time));

    this.drawEffects(battle.effects);
    this.drawHUD(battle, time);
  }
}
