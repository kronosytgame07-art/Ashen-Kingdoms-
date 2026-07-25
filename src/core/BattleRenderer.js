/**
 * BattleRenderer — Ashen Kingdoms
 *
 * Rendu ISOMÉTRIQUE natif via BuildingArtist.DRAW_FN,
 * exactement comme VillageRenderer.
 *
 * BUG-FIX #2 : spawnZone reprojetée via cam/vp courants (plus de décalage
 *              si le canvas change de taille entre start() et le rendu).
 * BUG-FIX #3 : unités stockées en px physiques (zoom=1) → transformées
 *              ctx.scale(renderZoom) avant de les dessiner.
 * BUG-FIX #4 : effets idem — appliqués dans le même espace transformé.
 * BUG-FIX #5 : z-order iso corrigé : tri par centre de bâtiment
 *              (col + size.w/2 + row + size.h/2).
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

  // Zoom de rendu : même formule que BattleManager pour cohérence
  renderZoom(vp) {
    return Math.min(vp.width, vp.height) / 900;
  }

  // Caméra de rendu — zoom appliqué par ctx.scale, pas dans gridToScreen
  camera() {
    return { x: 0, y: 0, zoom: 1 };
  }

  tile(col, row, cam, vp, rz, fill, stroke) {
    const pt = this._grid.gridToScreen(col, row, cam, vp);
    const hw = this._grid.tileWidth  * rz / 2;
    const hh = this._grid.tileHeight * rz / 2;
    this.polygon([
      { x: pt.x * rz,          y: pt.y * rz },
      { x: pt.x * rz + hw,     y: pt.y * rz + hh },
      { x: pt.x * rz,          y: pt.y * rz + hh * 2 },
      { x: pt.x * rz - hw,     y: pt.y * rz + hh },
    ], fill, stroke ?? B.tileEdge, Math.max(.5, rz * .8));
  }

  ground(time, cam, vp, rz) {
    const c = this.ctx;

    const grad = c.createLinearGradient(0, 0, 0, vp.height);
    grad.addColorStop(0, '#1a0f28');
    grad.addColorStop(.5, '#130a1e');
    grad.addColorStop(1, B.bg0);
    c.fillStyle = grad; c.fillRect(0, 0, vp.width, vp.height);

    c.save(); c.globalAlpha = .10; c.strokeStyle = B.lava; c.lineWidth = .9;
    for (let i = 0; i < 10; i++) {
      const ox = (i * 137 + time * .003) % (vp.width + 200) - 100;
      c.beginPath(); c.moveTo(ox, 0);
      c.bezierCurveTo(ox + 25, vp.height * .3, ox - 18, vp.height * .65, ox + 12, vp.height);
      c.stroke();
    }
    c.restore();

    const cols = BATTLE_CONFIG.gridCols;
    const rows = BATTLE_CONFIG.gridRows;
    for (let col = 0; col < cols; col++)
      for (let row = 0; row < rows; row++)
        this.tile(col, row, cam, vp, rz,
          (col + row) % 2 ? B.tile0 : B.tile1, B.tileEdge);

    c.save(); c.globalAlpha = .22;
    for (let i = 0; i < 50; i++) {
      const tt = time * .001 * (i % 4 + .4);
      const x  = (i * 173 + tt * 16) % (vp.width  + 20);
      const y  = (i * 89  + tt * 9)  % (vp.height + 20);
      c.fillStyle = i % 6 === 0 ? B.amber : i % 4 === 0 ? B.lava : B.glow;
      c.beginPath(); c.arc(x, y, i % 5 === 0 ? 2.1 : 1.3, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    const vig = c.createRadialGradient(vp.width/2, vp.height/2, vp.height*.1,
                                        vp.width/2, vp.height/2, vp.width*.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(4,2,10,.72)');
    c.fillStyle = vig; c.fillRect(0, 0, vp.width, vp.height);
  }

  // BUG-FIX #2 : reprojette les cellules de spawn avec le zoom courant
  drawSpawnZone(battle, cam, vp, rz) {
    if (!battle.spawnCells?.length) return;
    const c = this.ctx;
    c.save(); c.globalAlpha = .22;
    for (const cell of battle.spawnCells) {
      const pt = this._grid.gridToScreen(cell.col, cell.row, cam, vp);
      c.fillStyle = B.blood;
      c.beginPath(); c.arc(pt.x * rz, pt.y * rz, 5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  drawBuilding(b, cam, vp, rz, time) {
    const c     = this.ctx;
    const tileW = this._grid.tileWidth  * rz;
    const tileH = this._grid.tileHeight * rz;
    const sw    = b.size?.w ?? 1;
    const sh    = b.size?.h ?? 1;
    const hp    = Math.max(0, b.hp / b.maxHp);

    // BUG-FIX #3/#5 : on projette via gridToScreen (cohérent avec le sol)
    const ptSouth = this._grid.gridToScreen(b.col + sw, b.row + sh, cam, vp);
    const x = ptSouth.x * rz;
    const y = ptSouth.y * rz;

    if (!b.trap || !b.hidden) {
      for (let dx = 0; dx < sw; dx++) {
        for (let dy = 0; dy < sh; dy++) {
          const fillCol = b.isWall
            ? 'rgba(80,50,110,.22)'
            : b.trap
              ? 'rgba(216,72,88,.15)'
              : 'rgba(60,40,90,.20)';
          this.tile(b.col + dx, b.row + dy, cam, vp, rz, fillCol, B.tileEdge);
        }
      }
    }

    if (b.trap && b.hidden) {
      c.save(); c.globalAlpha = .08;
      c.fillStyle = B.blood;
      c.beginPath(); c.arc(x, y, (b.radius ?? 12) * rz * .5, 0, Math.PI * 2); c.fill();
      c.restore();
      return;
    }

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

  // BUG-FIX #3 : les unités sont stockées en px physiques (zoom=1)
  // → on les projette ici en multipliant par rz
  drawUnit(u, rz, time) {
    const c  = this.ctx;
    const hp = Math.max(0, u.hp / u.maxHp);
    const r  = (u.type === 'ghoul' ? 13 : u.type === 'necromancer' ? 11 : 10) * rz;
    const fill  = u.type === 'ghoul' ? '#8a7a58' : u.type === 'necromancer' ? '#a060e0' : '#ddd4ee';
    const glow  = u.type === 'ghoul' ? '#c8b070' : u.type === 'necromancer' ? '#d090ff' : '#f0e8ff';
    const eyeC  = u.type === 'necromancer' ? '#e8a0ff' : '#fff0aa';

    // Position projetée
    const px = u.x * rz;
    const py = u.y * rz;

    c.save();
    c.translate(px, py);
    c.globalAlpha = u.dead ? .22 : 1;

    c.beginPath(); c.ellipse(0, r * .5, r * 1.1, r * .38, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,.44)'; c.fill();

    c.beginPath(); c.arc(0, 0, r + 2 * rz, 0, Math.PI * 2);
    c.fillStyle = B.outline; c.fill();

    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill();

    if (!u.dead) {
      const bob = Math.sin(time / 220 + u.x * .03) * .5 + .5;
      c.save();
      c.shadowColor = glow; c.shadowBlur = (6 + bob * 6) * rz;
      c.strokeStyle = glow; c.lineWidth = 1.5 * rz;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
      c.shadowBlur = 0; c.restore();
    }

    c.fillStyle = eyeC;
    c.beginPath(); c.ellipse(-r * .32, -r * .18, r * .22, r * .18, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse( r * .32, -r * .18, r * .22, r * .18, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = B.outline;
    c.beginPath(); c.ellipse(-r * .32, -r * .18, r * .1, r * .1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse( r * .32, -r * .18, r * .1, r * .1, 0, 0, Math.PI * 2); c.fill();

    c.strokeStyle = u.type === 'necromancer' ? '#c090ff' : '#9a8870';
    c.lineWidth = 2 * rz;
    c.beginPath(); c.moveTo(r * .5, -r * .1); c.lineTo(r * 1.6, -r * 1.3); c.stroke();
    if (u.type === 'necromancer') {
      c.fillStyle = '#d0a0ff';
      c.beginPath(); c.arc(r * 1.6, -r * 1.3, 3 * rz, 0, Math.PI * 2); c.fill();
    }

    if (!u.dead) {
      const bw = r * 2.4, bx = -r * 1.2, by = -r - 10 * rz;
      c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(bx, by, bw, 4 * rz);
      c.fillStyle = hp > .5 ? B.green : hp > .25 ? B.amber : B.blood;
      c.fillRect(bx, by, bw * hp, 4 * rz);
      c.strokeStyle = B.outline; c.lineWidth = .8 * rz; c.strokeRect(bx, by, bw, 4 * rz);
    }
    c.restore();
  }

  // BUG-FIX #4 : effets en px physiques → projetés par rz
  drawEffects(effects, rz) {
    const c = this.ctx;
    for (const fx of effects) {
      const maxLife = fx.kind === 'trap' ? .5 : fx.kind === 'splash' ? .45 : .35;
      const t  = Math.max(0, 1 - fx.life / maxLife);
      const ex = fx.x * rz;
      const ey = fx.y * rz;
      c.save();
      if (fx.kind === 'hit') {
        c.globalAlpha = (1 - t) * .9; c.strokeStyle = B.amber; c.lineWidth = 2.5 * rz;
        c.shadowColor = B.amber; c.shadowBlur = 10 * rz;
        c.beginPath(); c.arc(ex, ey, (6 + t * 22) * rz, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else if (fx.kind === 'shot') {
        c.globalAlpha = (1 - t) * .85; c.strokeStyle = B.glow; c.lineWidth = 2 * rz;
        c.shadowColor = B.glow; c.shadowBlur = 14 * rz;
        c.beginPath(); c.arc(ex, ey, (5 + t * 20) * rz, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else if (fx.kind === 'splash') {
        c.globalAlpha = (1 - t) * .75; c.strokeStyle = B.blood; c.lineWidth = 3 * rz;
        c.shadowColor = B.blood; c.shadowBlur = 16 * rz;
        c.beginPath(); c.arc(ex, ey, (8 + t * 52) * rz, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else if (fx.kind === 'trap') {
        c.globalAlpha = (1 - t) * .8; c.strokeStyle = B.green; c.lineWidth = 2.5 * rz;
        c.shadowColor = B.green; c.shadowBlur = 18 * rz;
        c.beginPath(); c.arc(ex, ey, (6 + t * 44) * rz, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
        c.globalAlpha = (1 - t) * .5; c.strokeStyle = B.green; c.lineWidth = 1.5 * rz;
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          c.beginPath();
          c.moveTo(ex + Math.cos(a) * 6 * rz, ey + Math.sin(a) * 6 * rz);
          c.lineTo(ex + Math.cos(a) * (10 + t * 42) * rz, ey + Math.sin(a) * (10 + t * 42) * rz);
          c.stroke();
        }
      }
      c.restore();
    }
  }

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

    c.fillStyle = 'rgba(7,4,14,.86)';
    this.rrect(c, px - 44, py + 40, 88, 24, 12); c.fill();
    c.strokeStyle = B.amber; c.lineWidth = 1.4;
    this.rrect(c, px - 44, py + 40, 88, 24, 12); c.stroke();
    c.fillStyle = B.amber; c.font = `700 13px 'Cinzel',serif`;
    c.fillText(`💥 ${destPct}%`, px, py + 52);

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

  render(battle, time) {
    const vp  = this.viewport();
    const cam = this.camera();
    // BUG-FIX #3/#4 : renderZoom séparé — la physique reste en zoom=1
    const rz  = this.renderZoom(vp);

    this.ground(time, cam, vp, rz);
    // BUG-FIX #2
    this.drawSpawnZone(battle, cam, vp, rz);

    // BUG-FIX #5 : z-order par centre du bâtiment
    [...battle.buildings]
      .sort((a, b) =>
        (a.col + (a.size?.w ?? 1) / 2 + a.row + (a.size?.h ?? 1) / 2) -
        (b.col + (b.size?.w ?? 1) / 2 + b.row + (b.size?.h ?? 1) / 2)
      )
      .forEach(b => {
        if (b.hp > 0 || b.trap) this.drawBuilding(b, cam, vp, rz, time);
      });

    // BUG-FIX #3 : passage de rz
    battle.deployed
      .sort((a, b) => a.y - b.y)
      .forEach(u => this.drawUnit(u, rz, time));

    // BUG-FIX #4 : passage de rz
    this.drawEffects(battle.effects, rz);
    this.drawHUD(battle, time);
  }
}
