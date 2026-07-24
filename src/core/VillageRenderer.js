/**
 * VillageRenderer — Ashen Kingdoms
 * Délègue l'art de chaque bâtiment à BuildingArtist.DRAW_FN.
 *
 * SYSTÈME DE COORDONNÉES ISO :
 *   gridToScreen(col, row) renvoie le coin TOP-GAUCHE de la tuile (point nord).
 *   Pour un bâtiment sw×sh, le losange d'empreinte a :
 *     - point nord  = gridToScreen(col,       row)
 *     - point est   = gridToScreen(col+sw,     row)
 *     - point sud   = gridToScreen(col+sw,     row+sh)   ← ancre du dessin
 *     - point ouest = gridToScreen(col,        row+sh)
 *     - centre      = gridToScreen(col+sw/2,   row+sh/2)
 *   Le dessin est centré sur le point SUD (bas du losange) et remonte.
 *   diamond(sw, sh, tileW, tileH) calcule les 4 coins en coords locales
 *   avec origin = point SUD.
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

/**
 * Calcule les 4 coins du losange d'empreinte en coordonnées LOCALES
 * avec origin = point SUD (bas du losange, = ancre de dessin).
 *
 * En iso 2:1, tileWidth=88, tileHeight=44 :
 *   vecteur  col+ :  (+tileW/2, +tileH/2)   →  bas-droite
 *   vecteur  row+ :  (-tileW/2, +tileH/2)   →  bas-gauche
 *
 * Donc depuis le point SUD (col+sw, row+sh) :
 *   nord  = SUD + sw*(-tileW/2,-tileH/2) + sh*(+tileW/2,-tileH/2)
 *         = (0 + (sh-sw)*tileW/2 ,  -(sw+sh)*tileH/2)   relatif au SUD
 *   est   = SUD + sw*(-tileW/2,-tileH/2)
 *         = (-sw*tileW/2, -sw*tileH/2)
 *   ouest = SUD + sh*(+tileW/2,-tileH/2)
 *         = (+sh*tileW/2, -sh*tileH/2)
 *   sud   = (0, 0)
 */
function diamond(sw, sh, tileW, tileH) {
  const ex = tileW / 2;
  const ey = tileH / 2;
  return {
    south: { x: 0,                       y: 0 },
    east:  { x: -sw * ex,                y: -sw * ey },
    north: { x: (sh - sw) * ex,          y: -(sw + sh) * ey },
    west:  { x:  sh * ex,                y: -sh * ey },
    // demi-largeur horizontale et demi-diagonale verticale (pour les helpers)
    hw: (sw + sh) * ex / 2,   // demi-largeur totale du losange
    hh: (sw + sh) * ey / 2,   // demi-hauteur totale
    tileW, tileH, sw, sh,
  };
}

export class VillageRenderer {
  constructor(canvas, grid, definitions, assets) {
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.grid        = grid;
    this.definitions = definitions;
    this.assets      = assets;
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }

  // ─ primitives ──────────────────────────────────────────────────────────────
  polygon(points, fill, stroke, lw = 1) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
    c.closePath();
    if (fill)   { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }

  rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ─ tuile iso ──────────────────────────────────────────────────────────────
  tile(col, row, camera, fill, stroke) {
    const vp = this.viewport();
    // gridToScreen renvoie le point NORD de la tuile (col,row)
    const pt = this.grid.gridToScreen(col, row, camera, vp);
    const hw = this.grid.tileWidth  * camera.zoom / 2;
    const hh = this.grid.tileHeight * camera.zoom / 2;
    this.polygon([
      { x: pt.x,      y: pt.y },          // nord
      { x: pt.x + hw, y: pt.y + hh },     // est
      { x: pt.x,      y: pt.y + hh * 2 }, // sud
      { x: pt.x - hw, y: pt.y + hh },     // ouest
    ], fill, stroke ?? P.tileEdge, Math.max(.6, camera.zoom * .9));
  }

  // ─ fond de scène ──────────────────────────────────────────────────────────
  ground(camera, time) {
    const c = this.ctx, vp = this.viewport();
    const grad = c.createLinearGradient(0, 0, 0, vp.height);
    grad.addColorStop(0, '#1a1128'); grad.addColorStop(.4, '#150f20'); grad.addColorStop(1, P.bg0);
    c.fillStyle = grad; c.fillRect(0, 0, vp.width, vp.height);

    // Veines de lave
    c.save(); c.globalAlpha = .07; c.strokeStyle = '#ff4820'; c.lineWidth = .8;
    for (let i = 0; i < 9; i++) {
      const ox = (i * 173 + time * .004) % (vp.width + 200) - 100;
      c.beginPath(); c.moveTo(ox, 0);
      c.bezierCurveTo(ox + 30, vp.height * .3, ox - 20, vp.height * .7, ox + 15, vp.height);
      c.stroke();
    }
    c.restore();

    // Tuiles iso
    for (let col = 0; col < this.grid.columns; col++)
      for (let row = 0; row < this.grid.rows; row++)
        this.tile(col, row, camera, (col + row) % 2 ? P.tile0 : P.tile1);

    // Braises
    c.save(); c.globalAlpha = .28;
    for (let i = 0; i < 55; i++) {
      const tt = time * .001 * (i % 4 + .5);
      const x = ((i * 167 + tt * 18) % (vp.width  + 20));
      const y = ((i * 89  + tt * 9)  % (vp.height + 20));
      c.fillStyle = i % 6 === 0 ? P.amber : i % 4 === 0 ? P.glow : P.stone;
      c.beginPath(); c.arc(x, y, i % 5 === 0 ? 2.2 : 1.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    // Vignette
    const vig = c.createRadialGradient(vp.width/2,vp.height/2,vp.height*.15,vp.width/2,vp.height/2,vp.width*.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(5,3,12,.68)');
    c.fillStyle = vig; c.fillRect(0, 0, vp.width, vp.height);
  }

  // ─ empreinte tuiles ───────────────────────────────────────────────────────
  footprint(building, camera, selected, valid = null) {
    const def = this.definitions[building.type];
    for (let x = 0; x < def.size.w; x++) for (let y = 0; y < def.size.h; y++) {
      let fill, stroke;
      if      (valid === true)  { fill = 'rgba(98,220,160,.22)';  stroke = '#62dca0'; }
      else if (valid === false) { fill = 'rgba(216,72,88,.22)';   stroke = '#d84858'; }
      else if (selected)        { fill = 'rgba(184,124,255,.18)'; stroke = '#b87cff'; }
      else                      { fill = 'rgba(5,4,8,.15)';       stroke = 'rgba(0,0,0,.12)'; }
      this.tile(building.col + x, building.row + y, camera, fill, stroke);
    }
  }

  // ─ ancre d'un bâtiment = point SUD du losange d'empreinte ────────────────
  //
  //   gridToScreen(col+sw, row+sh) = point NORD de la tuile (col+sw, row+sh)
  //   = point SUD du losange d'empreinte sw×sh
  //   (car le losange sw×sh se termine exactement là où commence la tuile suivante)
  //
  buildingAnchor(building, state) {
    const def  = this.definitions[building.type];
    const cam  = state.camera;
    const vp   = this.viewport();
    const sw   = def.size.w;
    const sh   = def.size.h;

    // Point SUD du losange d'empreinte :
    // gridToScreen du coin sud-est de l'empreinte
    // = gridToScreen(col+sw, row+sh) → c'est le point nord de CETTE tuile
    // mais c'est exactement le point sud du losange sw×sh.
    const ptSouth = this.grid.gridToScreen(
      building.col + sw,
      building.row + sh,
      cam, vp
    );

    const tileW = this.grid.tileWidth  * cam.zoom;
    const tileH = this.grid.tileHeight * cam.zoom;

    return {
      x:     ptSouth.x,
      y:     ptSouth.y,   // ← point SUD exact, pas de décalage artificiel
      tileW,
      tileH,
      scale: cam.zoom,
      def,
      sw,
      sh,
    };
  }

  // ─ dessin principal d'un bâtiment ─────────────────────────────────────────
  drawBuilding(building, state, selected, time, lifted = false) {
    const def  = this.definitions[building.type];
    const cam  = state.camera;
    const anc  = this.buildingAnchor(building, state);
    const { x, y, tileW, tileH, sw, sh } = anc;
    const c    = this.ctx;
    const tSec = time / 1000;
    const flick = Math.sin(tSec * 4.8 + building.col * 1.7) * .5 + .5;
    const level = Math.min(3, Math.max(1, building.level ?? 1));
    const underConst = building.readyAt > Date.now();

    this.footprint(building, cam, selected);

    c.save();
    c.translate(x, y - (lifted ? tileH * .25 : 0));
    if (lifted) c.scale(1.06, 1.06);
    c.globalAlpha = underConst ? .55 : 1;

    // ── Construit l'objet iso attendu par BuildingArtist.DRAW_FN ──────────
    // Le losange est calculé avec origin = (0,0) = point SUD
    // (on est déjà translaté sur ptSouth via c.translate ci-dessus)
    const d   = diamond(sw, sh, tileW, tileH);
    // Hauteur des murs : proportionnelle à la taille du bâtiment
    const wallH = tileH * (sw + sh) * 0.55;
    const iso   = { d, wallH, tileW, tileH, sw, sh };

    const drawFn = DRAW_FN[building.type];
    if (drawFn) {
      drawFn(c, iso, level, tSec, flick, selected);
    } else {
      // Fallback iso : prisme générique violet qui respecte le losange
      const { south, east, north, west } = d;
      // face gauche
      c.beginPath();
      c.moveTo(west.x,  west.y);
      c.lineTo(south.x, south.y);
      c.lineTo(south.x, south.y - wallH);
      c.lineTo(west.x,  west.y  - wallH);
      c.closePath();
      c.fillStyle = '#2a1e40'; c.fill();
      c.strokeStyle = '#07050d'; c.lineWidth = 1.2; c.stroke();
      // face droite
      c.beginPath();
      c.moveTo(east.x,  east.y);
      c.lineTo(south.x, south.y);
      c.lineTo(south.x, south.y - wallH);
      c.lineTo(east.x,  east.y  - wallH);
      c.closePath();
      c.fillStyle = '#1e1530'; c.fill();
      c.strokeStyle = '#07050d'; c.lineWidth = 1.2; c.stroke();
      // toit (losange)
      c.beginPath();
      c.moveTo(north.x, north.y - wallH);
      c.lineTo(east.x,  east.y  - wallH);
      c.lineTo(south.x, south.y - wallH);
      c.lineTo(west.x,  west.y  - wallH);
      c.closePath();
      c.fillStyle = '#3a2a52';
      c.strokeStyle = '#b87cff'; c.lineWidth = 1.5;
      c.fill(); c.stroke();
      // label type au centre du toit
      c.fillStyle = '#b87cff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${Math.max(9, tileW * .14)}px monospace`;
      c.fillText(building.type, (north.x + south.x) / 2, (north.y + south.y) / 2 - wallH);
    }

    // Outline flottant si déplacé
    if (lifted) {
      const { south, east, north, west } = d;
      c.strokeStyle = '#d7b8ff'; c.lineWidth = 2.2;
      c.setLineDash([5, 3]);
      c.beginPath();
      c.moveTo(north.x, north.y - wallH - 4);
      c.lineTo(east.x,  east.y  - wallH - 4);
      c.lineTo(south.x, south.y - 4);
      c.lineTo(west.x,  west.y  - 4);
      c.closePath(); c.stroke();
      c.setLineDash([]);
    }

    // En construction
    if (underConst) {
      const secs  = Math.ceil((building.readyAt - Date.now()) / 1000);
      const mins  = Math.floor(secs / 60);
      const label = mins > 0 ? `${mins}m${secs % 60}s` : `${secs}s`;
      const ow    = tileW * sw * .55;
      this.rrect(c, -ow / 2, d.north.y - wallH - tileH * .55, ow, tileH * .38, tileH * .1);
      c.fillStyle   = 'rgba(7,4,14,.9)'; c.fill();
      c.strokeStyle = P.glow; c.lineWidth = 1.4; c.stroke();
      c.fillStyle     = P.white; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `700 ${Math.max(9, tileH * .3)}px 'Cinzel',serif`;
      c.fillText(`⚒ ${label}`, 0, d.north.y - wallH - tileH * .55 + tileH * .19);
    }

    c.restore();
  }

  // ─ bulle de collecte ──────────────────────────────────────────────────────
  drawCollectionBubble(building, state, time) {
    const def = this.definitions[building.type];
    if (!def?.extractor || building.readyAt > Date.now()) return;
    const stored    = building.storedResource ?? 0;
    const threshold = def.extractor.collectThreshold ?? 1;
    if (stored < threshold) return;
    const capacity  = def.extractor.capacity * (1 + (building.level - 1) * .5);
    const full      = stored >= capacity * .98;
    const anc       = this.buildingAnchor(building, state);
    const { x, y, tileW, tileH, sw, sh } = anc;
    const c         = this.ctx;
    const bob       = Math.sin(time / 260 + building.col * 1.1) * tileH * .12;
    const glowCol   = full ? P.blood : P.glow;
    // La bulle flotte au-dessus du toit : nord du losange - wallH - offset
    const d     = diamond(sw, sh, tileW, tileH);
    const wallH = tileH * (sw + sh) * 0.55;
    const bubY  = y + d.north.y - wallH - tileH * .6 + bob;

    c.save(); c.translate(x, bubY);
    c.shadowColor = glowCol; c.shadowBlur = (full ? 18 : 12);
    this.rrect(c, -tileW * .28, -tileH * .28, tileW * .56, tileH * .32, tileH * .14);
    c.fillStyle   = full ? 'rgba(80,16,24,.97)' : 'rgba(12,8,20,.97)';
    c.strokeStyle = glowCol; c.lineWidth = 1.6;
    c.fill(); c.stroke(); c.shadowBlur = 0;
    c.fillStyle = full ? P.blood : P.glow;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${Math.max(11, tileH * .26)}px 'Cinzel',serif`;
    const icon = def.extractor.resource === 'gold' ? '🪙'
               : def.extractor.resource === 'wood'  ? '🪵' : '✦';
    c.fillText(full ? `${icon}!` : `${icon} ${Math.floor(stored)}`, 0, 0);
    c.restore();
  }

  // ─ popups de collecte ─────────────────────────────────────────────────────
  drawCollectionPopups(interaction, state, time) {
    const c = this.ctx;
    for (const popup of interaction.collectionPopups ?? []) {
      const building = state.buildings.find(b => b.id === popup.buildingId);
      if (!building) continue;
      const age  = Math.max(0, time - popup.createdAt);
      const prog = Math.min(1, age / 1200);
      const anc  = this.buildingAnchor(building, state);
      const { x, y, tileW, tileH, sw, sh } = anc;
      const d     = diamond(sw, sh, tileW, tileH);
      const wallH = tileH * (sw + sh) * 0.55;
      c.save(); c.globalAlpha = 1 - prog;
      c.translate(x, y + d.north.y - wallH - prog * tileH * 1.1);
      const col = popup.resource === 'gold' ? P.amber : popup.resource === 'wood' ? '#8cdf5c' : P.glow;
      c.shadowColor = col; c.shadowBlur = 12;
      c.fillStyle = col; c.textAlign = 'center';
      c.font = `900 ${Math.max(14, tileH * .4)}px sans-serif`;
      c.fillText(`+${popup.amount}`, 0, 0); c.restore();
    }
  }

  // ─ unité de village (garnison) ────────────────────────────────────────────
  drawVillageUnit(x, y, type, scale = 1, alpha = 1) {
    const c = this.ctx;
    const r = type === 'ghoul' ? 7 : type === 'necromancer' ? 6.5 : 5.8;
    const fill   = type === 'ghoul' ? '#8a7a5a' : type === 'necromancer' ? '#b070f0' : '#ddd8ee';
    const stroke = type === 'ghoul' ? '#3a3020' : type === 'necromancer' ? '#5018a8' : '#2a1e38';
    c.save(); c.globalAlpha = alpha; c.translate(x, y);
    c.beginPath(); c.ellipse(0, 3.5 * scale, 7.5 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,.38)'; c.fill();
    c.beginPath(); c.arc(0, 0, r * scale, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = Math.max(1, 1.8 * scale); c.stroke();
    c.fillStyle = type === 'necromancer' ? '#e8b0ff' : '#ffeecc';
    for (const dx of [-r * .32, r * .32]) { c.beginPath(); c.arc(dx * scale, -r * .18 * scale, r * .22 * scale, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  drawCampfireGarrison(building, state, time) {
    if (building.type !== 'campfire' || building.readyAt > Date.now()) return;
    const roster = [];
    for (const [t, n] of Object.entries(building.garrison ?? {})) for (let i = 0; i < n; i++) roster.push(t);
    const shown = roster.slice(0, 12);
    const anc   = this.buildingAnchor(building, state);
    const { x, y, tileW, tileH } = anc;
    const c = this.ctx;
    c.save(); c.translate(x, y - tileH * .55);
    const pulse = .88 + Math.sin(time / 175) * .13;
    c.shadowColor = P.green; c.shadowBlur = 18;
    c.fillStyle = `rgba(98,220,160,${.8 + pulse * .1})`;
    c.beginPath(); c.arc(0, 0, tileW * .09 * pulse, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0; c.restore();
    shown.forEach((t2, i) => {
      const ring  = Math.floor(i / 6), slot = i % 6;
      const angle = (Math.PI * 2 / 6) * slot + ring * .42;
      const rad   = (tileW * .38 + ring * tileW * .18);
      const sway  = Math.sin(time / 400 + i * .7) * tileH * .04;
      this.drawVillageUnit(x + Math.cos(angle) * rad, y + Math.sin(angle) * rad * .46 + sway, t2, state.camera.zoom * .9, .96);
    });
  }

  drawTroopTransfers(state, interaction, time) {
    for (const tr of interaction.troopTransfers ?? []) {
      const from = state.buildings.find(b => b.id === tr.fromId);
      const to   = state.buildings.find(b => b.id === tr.toId);
      if (!from || !to) continue;
      const prog  = Math.min(1, Math.max(0, (time - tr.createdAt) / (tr.duration ?? 1200)));
      const eased = 1 - Math.pow(1 - prog, 3);
      const sv    = this.buildingAnchor(from, state);
      const ev    = this.buildingAnchor(to,   state);
      const xi    = sv.x + (ev.x - sv.x) * eased;
      const yi    = sv.y + (ev.y - sv.y) * eased - Math.sin(prog * Math.PI) * sv.tileH * .5;
      this.drawVillageUnit(xi, yi - sv.tileH * .4, tr.type, state.camera.zoom, 1 - prog * .12);
    }
  }

  // ─ render principal ───────────────────────────────────────────────────────
  render(state, interaction, time) {
    this.ground(state.camera, time);
    if (interaction.preview)
      this.footprint(interaction.preview, state.camera, false, interaction.preview.valid);
    [...state.buildings]
      .sort((a, b) => (a.col + a.row) - (b.col + b.row))
      .forEach(b => {
        this.drawBuilding(b, state, b.id === interaction.selectedId, time, b.id === interaction.liftedId);
        this.drawCollectionBubble(b, state, time);
        this.drawCampfireGarrison(b, state, time);
      });
    this.drawTroopTransfers(state, interaction, time);
    this.drawCollectionPopups(interaction, state, time);
  }
}
