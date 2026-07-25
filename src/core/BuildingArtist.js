/**
 * BuildingArtist.js  —  Ashen Kingdoms  v3.0  « Supercell Dark-Saoul »
 *
 * Sprites isométriques dessinés au Canvas 2D.
 * Chaque bâtiment = prisme isométrique vue de coin (2:1 ratio).
 *
 * Signature : drawFn(c, iso, level, t, f, sel)
 *   c     CanvasRenderingContext2D
 *   iso   { d, wallH, tileW, tileH, sw, sh }
 *   d     = diamond(sw, sh, tileW, tileH)
 *   level 1|2|3
 *   t     secondes (pour animations)
 *   f     flicker 0..1 (sin lent)
 *   sel   bool (sélectionné)
 */

// ── Palette Dark-Saoul ──────────────────────────────────────────────────────
const C = {
  // Noirs & pierres violacées
  void0:   '#04020a',
  void1:   '#0a0614',
  stone0:  '#12101e',
  stone1:  '#1e1a2e',
  stone2:  '#2c2640',
  stone3:  '#3e3658',
  stone4:  '#564c72',
  // Faces iso
  faceL:   '#181428',
  faceR:   '#100e1e',
  roofD:   '#221c34',
  roofM:   '#2e2648',
  roofL:   '#42386a',
  // Accents lumineux
  glow:    '#c890ff',
  glowD:   '#7a30c0',
  ember:   '#ff6020',
  gold:    '#ffc840',
  amber:   '#e89030',
  blood:   '#cc2040',
  teal:    '#20c8b0',
  blue:    '#40a8ff',
  green:   '#50e090',
  bone:    '#d8c8a8',
  wood:    '#8a5c28',
  woodD:   '#5a3810',
  lava:    '#ff3000',
  lavaDim: '#a02000',
  rust:    '#8a3010',
  // FX
  white:   '#f8f0ff',
  smoke:   '#3a2868',
  ash:     '#58486c',
};

// ── Helpers géométriques ────────────────────────────────────────────────────

function diamond(sw, sh, tileW, tileH) {
  const hw = sw * tileW / 2;
  const hh = sh * tileH / 2;
  return {
    top:    { x: 0,   y: -hh },
    right:  { x: hw,  y: 0   },
    bottom: { x: 0,   y:  hh },
    left:   { x: -hw, y: 0   },
    hw, hh,
  };
}

function drawRoof(c, d, fill, stroke) {
  c.beginPath();
  c.moveTo(d.top.x, d.top.y);
  c.lineTo(d.right.x, d.right.y);
  c.lineTo(d.bottom.x, d.bottom.y);
  c.lineTo(d.left.x, d.left.y);
  c.closePath();
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}

function drawFaceLeft(c, d, wallH, fill) {
  c.beginPath();
  c.moveTo(d.left.x,   d.left.y);
  c.lineTo(d.bottom.x, d.bottom.y);
  c.lineTo(d.bottom.x, d.bottom.y + wallH);
  c.lineTo(d.left.x,   d.left.y   + wallH);
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = C.void0; c.lineWidth = 1.2; c.stroke();
}

function drawFaceRight(c, d, wallH, fill) {
  c.beginPath();
  c.moveTo(d.right.x,  d.right.y);
  c.lineTo(d.bottom.x, d.bottom.y);
  c.lineTo(d.bottom.x, d.bottom.y + wallH);
  c.lineTo(d.right.x,  d.right.y  + wallH);
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = C.void0; c.lineWidth = 1.2; c.stroke();
}

function selDiamond(c, d, wallH, col) {
  c.save();
  c.shadowColor = col; c.shadowBlur = 22;
  c.strokeStyle = col; c.lineWidth = 2.4;
  c.setLineDash([5, 3]);
  c.beginPath();
  c.moveTo(d.top.x,     d.top.y - 2);
  c.lineTo(d.right.x+2, d.right.y);
  c.lineTo(d.bottom.x,  d.bottom.y + wallH + 2);
  c.lineTo(d.left.x-2,  d.left.y + wallH);
  c.closePath(); c.stroke();
  c.setLineDash([]); c.shadowBlur = 0; c.restore();
}

function groundShadow(c, d) {
  c.save(); c.globalAlpha = .38;
  c.beginPath();
  c.moveTo(d.top.x, d.top.y + 6);
  c.lineTo(d.right.x+4, d.right.y + 6);
  c.lineTo(d.bottom.x, d.bottom.y + 6);
  c.lineTo(d.left.x-4, d.left.y + 6);
  c.closePath(); c.fillStyle = '#000'; c.fill();
  c.restore();
}

function crenelsLeft(c, d, n, cH, col) {
  const step = 1 / n;
  for (let i = 0; i < n; i += 2) {
    const t0 = i * step, t1 = (i+1) * step;
    const lerp = (a, b, t) => a + (b-a)*t;
    const x0 = lerp(d.left.x, d.bottom.x, t0), y0 = lerp(d.left.y, d.bottom.y, t0);
    const x1 = lerp(d.left.x, d.bottom.x, t1), y1 = lerp(d.left.y, d.bottom.y, t1);
    c.beginPath();
    c.moveTo(x0, y0); c.lineTo(x0, y0-cH);
    c.lineTo(x1, y1-cH); c.lineTo(x1, y1);
    c.closePath();
    c.fillStyle = col; c.fill();
    c.strokeStyle = C.void0; c.lineWidth = 1; c.stroke();
  }
}

function crenelsRight(c, d, n, cH, col) {
  const step = 1 / n;
  for (let i = 0; i < n; i += 2) {
    const t0 = i * step, t1 = (i+1) * step;
    const lerp = (a, b, t) => a + (b-a)*t;
    const x0 = lerp(d.right.x, d.bottom.x, t0), y0 = lerp(d.right.y, d.bottom.y, t0);
    const x1 = lerp(d.right.x, d.bottom.x, t1), y1 = lerp(d.right.y, d.bottom.y, t1);
    c.beginPath();
    c.moveTo(x0, y0); c.lineTo(x0, y0-cH);
    c.lineTo(x1, y1-cH); c.lineTo(x1, y1);
    c.closePath();
    c.fillStyle = col; c.fill();
    c.strokeStyle = C.void0; c.lineWidth = 1; c.stroke();
  }
}

function windowLeft(c, d, wallH, tx, col, f) {
  const lerp = (a, b, t) => a + (b-a)*t;
  const ex = lerp(d.left.x, d.bottom.x, tx);
  const ey = lerp(d.left.y, d.bottom.y, tx);
  const wx = (d.bottom.x - d.left.x) * .045;
  const wy = wallH * .38;
  c.save(); c.shadowColor = col; c.shadowBlur = 6 + f*9;
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(ex-wx, ey+wallH*.18);
  c.lineTo(ex,    ey+wallH*.18-wy*.55);
  c.lineTo(ex+wx, ey+wallH*.18);
  c.lineTo(ex+wx, ey+wallH*.72);
  c.lineTo(ex,    ey+wallH*.72+wy*.55);
  c.lineTo(ex-wx, ey+wallH*.72);
  c.closePath(); c.fill(); c.shadowBlur = 0; c.restore();
}

function windowRight(c, d, wallH, tx, col, f) {
  const lerp = (a, b, t) => a + (b-a)*t;
  const ex = lerp(d.right.x, d.bottom.x, tx);
  const ey = lerp(d.right.y, d.bottom.y, tx);
  const wx = (d.bottom.x - d.right.x) * .045;
  const wy = wallH * .38;
  c.save(); c.shadowColor = col; c.shadowBlur = 6 + f*9;
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(ex-wx, ey+wallH*.18);
  c.lineTo(ex,    ey+wallH*.18-wy*.55);
  c.lineTo(ex+wx, ey+wallH*.18);
  c.lineTo(ex+wx, ey+wallH*.72);
  c.lineTo(ex,    ey+wallH*.72+wy*.55);
  c.lineTo(ex-wx, ey+wallH*.72);
  c.closePath(); c.fill(); c.shadowBlur = 0; c.restore();
}

function torchOnEdge(c, d, wallH, tx, side, f, col) {
  col = col ?? C.amber;
  const lerp = (a, b, t) => a + (b-a)*t;
  const ax = side==='L' ? lerp(d.left.x,  d.bottom.x, tx) : lerp(d.right.x, d.bottom.x, tx);
  const ay = side==='L' ? lerp(d.left.y,  d.bottom.y, tx) : lerp(d.right.y, d.bottom.y, tx);
  const x = ax, y = ay + wallH * .28;
  const sz = Math.max(2, wallH*.09);
  c.save();
  // tige
  c.strokeStyle = C.bone; c.lineWidth = sz*.5;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y-sz*2.5); c.stroke();
  // socle
  c.fillStyle = C.stone3;
  c.fillRect(x-sz*.45, y-sz*.2, sz*.9, sz*.4);
  // flamme double couche
  c.shadowColor = col; c.shadowBlur = sz*(3.5+f*5);
  c.fillStyle = col;
  c.beginPath(); c.ellipse(x, y-sz*3.4, sz*.85, sz*(1.8+f*.9), 0, 0, Math.PI*2); c.fill();
  c.fillStyle = 'rgba(255,255,180,.6)';
  c.beginPath(); c.ellipse(x, y-sz*3.8, sz*.42, sz*(.9+f*.35), 0, 0, Math.PI*2); c.fill();
  // scintille
  if (f > .7) {
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.beginPath(); c.arc(x+sz*.15, y-sz*3.9, sz*.12, 0, Math.PI*2); c.fill();
  }
  c.shadowBlur = 0; c.restore();
}

function isoSpire(c, d, wallH, h, fill, glowCol, f) {
  const cx = d.top.x + (d.bottom.x-d.top.x)*.5;
  const cy = d.top.y + (d.bottom.y-d.top.y)*.5;
  const bw = d.hw*.28;
  c.save();
  // Ombre de la spire
  c.globalAlpha = .25;
  c.fillStyle = '#000';
  c.beginPath();
  c.moveTo(cx-bw*1.1, cy-wallH*.1);
  c.lineTo(cx+d.hw*.3, cy-wallH*.1-h*.4);
  c.lineTo(cx+bw*1.1, cy-wallH*.1);
  c.closePath(); c.fill();
  c.globalAlpha = 1;
  // Corps
  if (glowCol) { c.shadowColor = glowCol; c.shadowBlur = 14+f*14; }
  // Gradiant sur la spire
  const grad = c.createLinearGradient(cx-bw, cy-wallH*.1-h, cx+bw, cy-wallH*.1);
  grad.addColorStop(0, fill);
  grad.addColorStop(.5, glowCol ?? fill);
  grad.addColorStop(1, fill);
  c.fillStyle = grad;
  c.beginPath();
  c.moveTo(cx-bw,  cy-wallH*.1);
  c.lineTo(cx,     cy-wallH*.1-h);
  c.lineTo(cx+bw,  cy-wallH*.1);
  c.closePath(); c.fill();
  c.strokeStyle = C.void0; c.lineWidth = 1.4; c.stroke();
  // Stries de maçonnerie
  c.globalAlpha = .18; c.strokeStyle = '#fff'; c.lineWidth = .6;
  for (let i = 1; i < 4; i++) {
    const yt = cy - wallH*.1 - h*(i/4);
    const xt = bw*(1 - i/4);
    c.beginPath(); c.moveTo(cx-xt, yt); c.lineTo(cx+xt, yt); c.stroke();
  }
  c.globalAlpha = 1;
  // Orbe sommet
  if (glowCol) {
    const or = Math.max(3, h*.065);
    c.shadowColor = glowCol; c.shadowBlur = 16+f*16;
    c.fillStyle = glowCol;
    c.beginPath(); c.arc(cx, cy-wallH*.1-h, or, 0, Math.PI*2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(cx-or*.3, cy-wallH*.1-h-or*.3, or*.3, 0, Math.PI*2); c.fill();
  }
  c.shadowBlur = 0; c.restore();
}

function orb(c, x, y, r, col, blur, innerCol) {
  c.save();
  c.shadowColor = col; c.shadowBlur = blur;
  // Halo dégradé
  const g = c.createRadialGradient(x-r*.3, y-r*.3, r*.1, x, y, r);
  g.addColorStop(0, innerCol ?? '#fff');
  g.addColorStop(.4, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r*1.4, 0, Math.PI*2); c.fill();
  c.shadowBlur = 0; c.restore();
}

function isoBanner(c, d, wallH, h, col, runeCol, rune) {
  const cx = (d.top.x+d.right.x)/2;
  const cy = (d.top.y+d.right.y)/2 - wallH*.05;
  const bw = d.hw*.13;
  // hampe
  c.strokeStyle = C.bone; c.lineWidth = bw*.22;
  c.beginPath(); c.moveTo(cx, cy-wallH*.1); c.lineTo(cx, cy-wallH*.1-h*1.15); c.stroke();
  // tissu
  c.beginPath();
  c.moveTo(cx-bw, cy-wallH*.1);
  c.lineTo(cx+bw, cy-wallH*.1);
  c.lineTo(cx+bw, cy-wallH*.1-h*.82);
  c.lineTo(cx,    cy-wallH*.1-h);
  c.lineTo(cx-bw, cy-wallH*.1-h*.82);
  c.closePath();
  c.fillStyle = col; c.fill();
  c.strokeStyle = C.void0; c.lineWidth = 1.2; c.stroke();
  // bordure
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = .8;
  c.beginPath();
  c.moveTo(cx-bw+.8, cy-wallH*.1+.5);
  c.lineTo(cx+bw-.8, cy-wallH*.1+.5);
  c.lineTo(cx+bw-.8, cy-wallH*.1-h*.82+.5);
  c.lineTo(cx-.5,    cy-wallH*.1-h+1);
  c.lineTo(cx-bw+.8, cy-wallH*.1-h*.82+.5);
  c.stroke();
  // rune
  c.save(); c.fillStyle = runeCol; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${Math.max(7, h*.42)}px serif`; c.globalAlpha = .9;
  c.fillText(rune ?? '᛭', cx, cy-wallH*.1-h*.48); c.restore();
}

function stoneBrick(c, x0, y0, x1, y1, col) {
  c.save(); c.globalAlpha = .12; c.strokeStyle = C.void0; c.lineWidth = .7;
  const dx = x1-x0, dy = y1-y0, n = 5;
  for (let i=1; i<n; i++) {
    const t=i/n;
    c.beginPath();
    c.moveTo(x0+dx*t, y0+dy*t);
    c.lineTo(x0+dx*t, y0+dy*t+15);
    c.stroke();
  }
  c.restore();
}

function smoke(c, cx, cy, t, col, n, spread) {
  for (let i=0; i<n; i++) {
    const ph = t*1.1+i*1.4, rise = (ph%3)/3;
    c.save(); c.globalAlpha = .28*(1-rise);
    c.fillStyle = col;
    c.beginPath();
    c.arc(
      cx + Math.sin(ph*2+i)*spread*.5,
      cy - rise*spread*3.5,
      spread*(.35+i*.15+rise*.5), 0, Math.PI*2
    );
    c.fill(); c.restore();
  }
}

function chainEffect(c, x0, y0, x1, y1, col, f) {
  c.save();
  c.shadowColor = col; c.shadowBlur = 4+f*4;
  c.strokeStyle = col; c.lineWidth = 1.2;
  c.setLineDash([3,3]);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.setLineDash([]); c.shadowBlur = 0; c.restore();
}

function runeCircle(c, cx, cy, r, t, col, f) {
  c.save();
  c.shadowColor = col; c.shadowBlur = 8+f*10;
  c.strokeStyle = col; c.lineWidth = .9;
  c.globalAlpha = .45+f*.25;
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.stroke();
  for (let i=0; i<6; i++) {
    const a = i/6*Math.PI*2+t*.4;
    c.beginPath(); c.arc(cx+Math.cos(a)*r, cy+Math.sin(a)*r*.35, r*.07, 0, Math.PI*2);
    c.fillStyle = col; c.fill();
  }
  c.shadowBlur = 0; c.restore();
}

// ───────────────────────────────────────────────────────────────────────────
// EXPORT
// ───────────────────────────────────────────────────────────────────────────
export const DRAW_FN = {};

// ═══════════════════════════════════════════════════════════════════════════
// 1. TRÔNE CORROMPU  4×4   — bâtiment principal
// Style : forteresse néo-gothique, tons violet intense, couronne de spires
// ═══════════════════════════════════════════════════════════════════════════
DRAW_FN.townHall = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  // ── Murs principaux ──
  const fL = '#2a1c42', fR = '#1c1230';
  drawFaceLeft( c, d, wallH, fL);
  drawFaceRight(c, d, wallH, fR);

  // Appareillage pierre : lignes horizontales
  c.save(); c.globalAlpha = .13; c.strokeStyle = '#fff'; c.lineWidth = .7;
  for (let i=1; i<=5; i++) {
    const yi = i/6;
    // face gauche
    const lx0=d.left.x+(d.bottom.x-d.left.x)*0,   ly0=d.left.y+(d.bottom.y-d.left.y)*0+wallH*yi;
    const lx1=d.left.x+(d.bottom.x-d.left.x)*1,   ly1=d.left.y+(d.bottom.y-d.left.y)*1+wallH*yi;
    c.beginPath(); c.moveTo(lx0, ly0); c.lineTo(lx1, ly1); c.stroke();
    // face droite
    const rx0=d.right.x+(d.bottom.x-d.right.x)*0,  ry0=d.right.y+(d.bottom.y-d.right.y)*0+wallH*yi;
    const rx1=d.right.x+(d.bottom.x-d.right.x)*1,  ry1=d.right.y+(d.bottom.y-d.right.y)*1+wallH*yi;
    c.beginPath(); c.moveTo(rx0, ry0); c.lineTo(rx1, ry1); c.stroke();
  }
  c.restore();

  // Joints verticaux
  for (let i=1; i<=3; i++) {
    const ti = i/4;
    const lx = d.left.x+(d.bottom.x-d.left.x)*ti, ly = d.left.y+(d.bottom.y-d.left.y)*ti;
    const rx = d.right.x+(d.bottom.x-d.right.x)*ti, ry = d.right.y+(d.bottom.y-d.right.y)*ti;
    stoneBrick(c, lx, ly, lx, ly+wallH, fL);
    stoneBrick(c, rx, ry, rx, ry+wallH, fR);
  }

  // ── Toit ──
  drawRoof(c, d, C.roofD, C.void0);
  // Motif de losanges sur le toit
  c.save(); c.globalAlpha = .08; c.strokeStyle = C.glow; c.lineWidth = .6;
  for (let i=1; i<4; i++) {
    const sub = diamond(iso.sw*(1-i*.22), iso.sh*(1-i*.22), tileW, tileH);
    c.beginPath();
    c.moveTo(sub.top.x, sub.top.y); c.lineTo(sub.right.x, sub.right.y);
    c.lineTo(sub.bottom.x, sub.bottom.y); c.lineTo(sub.left.x, sub.left.y);
    c.closePath(); c.stroke();
  }
  c.restore();

  // ── Créneaux ──
  const cH = wallH*.24;
  crenelsLeft( c, d, 8, cH, '#42306a');
  crenelsRight(c, d, 8, cH, '#42306a');

  // ── Tours d'angle en lv2+ ──
  if (level >= 2) {
    // Mini-tour coin gauche
    const tD = diamond(.7, .7, tileW, tileH);
    c.save(); c.translate(d.left.x, d.left.y+wallH*.12);
    drawFaceLeft(c, tD, wallH*.7, '#1e143a');
    drawFaceRight(c, tD, wallH*.7, '#140e28');
    drawRoof(c, tD, '#2c2048', C.void0);
    crenelsLeft(c, tD, 3, wallH*.18, '#382a58');
    crenelsRight(c, tD, 3, wallH*.18, '#382a58');
    c.restore();
    // Mini-tour coin droit
    c.save(); c.translate(d.right.x, d.right.y+wallH*.12);
    drawFaceLeft(c, tD, wallH*.7, '#1e143a');
    drawFaceRight(c, tD, wallH*.7, '#140e28');
    drawRoof(c, tD, '#2c2048', C.void0);
    crenelsLeft(c, tD, 3, wallH*.18, '#382a58');
    crenelsRight(c, tD, 3, wallH*.18, '#382a58');
    c.restore();
  }

  // ── Spires ──
  const cx = d.top.x+(d.bottom.x-d.top.x)*.5;
  const cy = d.top.y+(d.bottom.y-d.top.y)*.5;
  isoSpire(c, d, wallH, wallH*(1.5+level*.22), '#4a2070', C.glow, f);

  if (level >= 2) {
    // Petites spires aux coins
    const sp = { ...d, hw: d.hw*.35, hh: d.hh*.35,
                  top:   { x: d.left.x,  y: d.left.y },
                  right: { x: cx,        y: cy },
                  bottom:{ x: d.left.x,  y: d.left.y+d.hh*.35*2 },
                  left:  { x: d.left.x-d.hw*.35, y: d.left.y+d.hh*.35 } };
    c.save(); c.translate(d.left.x, -wallH*.35);
    isoSpire(c, d, 0, wallH*.85, '#38186a', '#aa70ff', f*.75); c.restore();
    c.save(); c.translate(d.right.x, -wallH*.35);
    isoSpire(c, d, 0, wallH*.85, '#38186a', '#aa70ff', f*.75); c.restore();
    c.save(); c.translate(d.top.x, -wallH*.5);
    isoSpire(c, d, 0, wallH*.65, '#38186a', '#c090ff', f*.6); c.restore();
  }

  // ── Couronne d'orbes Lv3 ──
  if (level >= 3) {
    const n = 8, r = d.hw*.38;
    for (let i=0; i<n; i++) {
      const a = i/n*Math.PI*2+t*.55;
      const px = cx + r*Math.cos(a);
      const py = cy - wallH*.65 + d.hh*.16*Math.sin(a);
      orb(c, px, py, tileW*.042, '#e0b8ff', 12+f*11, '#fff');
    }
    // anneau magique
    runeCircle(c, cx, cy-wallH*.65, d.hw*.42, t, '#c880ff', f);
  }

  // ── Torches ──
  torchOnEdge(c, d, wallH, .22, 'L', f, C.glow);
  torchOnEdge(c, d, wallH, .22, 'R', f, C.glow);
  if (level >= 2) {
    torchOnEdge(c, d, wallH, .68, 'L', f, '#aa70ff');
    torchOnEdge(c, d, wallH, .68, 'R', f, '#aa70ff');
  }

  // ── Fenêtres ──
  windowLeft(c, d, wallH, .44, C.glow, f);
  if (level >= 2) windowRight(c, d, wallH, .44, C.glow, f);

  // ── Bannière ──
  isoBanner(c, d, wallH, wallH*(.7+level*.1), '#5a1898', '#e0b8ff', '᛭');

  // ── Effet portail sous le trône (Lv3) ──
  if (level >= 3) {
    const portalY = cy + wallH*.2;
    c.save();
    c.shadowColor = '#b060ff'; c.shadowBlur = 20+f*18;
    const pg = c.createRadialGradient(cx, portalY, 0, cx, portalY, d.hw*.22);
    pg.addColorStop(0, 'rgba(120,40,200,.55)');
    pg.addColorStop(.6, 'rgba(80,20,140,.3)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = pg;
    c.beginPath(); c.ellipse(cx, portalY, d.hw*.22, d.hh*.16, 0, 0, Math.PI*2); c.fill();
    c.shadowBlur = 0; c.restore();
    // particules
    for (let i=0; i<5; i++) {
      const a = t*1.8+i*1.26, rs = .55+Math.sin(t*2.5+i)*.35;
      orb(c, cx+d.hw*.18*Math.cos(a), portalY+d.hh*.12*Math.sin(a), tileW*.028, '#d0a0ff', 8+f*6);
    }
  }

  if (sel) selDiamond(c, d, wallH, C.glow);
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. MINE D'OR  2×2
// Style : carrière de pierre, chariot rouillé, lueur or profonde
// ═══════════════════════════════════════════════════════════════════════════
DRAW_FN.goldMine = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  drawFaceLeft( c, d, wallH, '#2e1e10');
  drawFaceRight(c, d, wallH, '#1e1208');

  // Stries de rocher
  c.save(); c.globalAlpha = .15; c.strokeStyle = '#fff'; c.lineWidth = .7;
  for (let i=1; i<=4; i++) {
    const y = wallH*i/5;
    c.beginPath();
    c.moveTo(d.left.x+(d.bottom.x-d.left.x)*0, d.left.y+(d.bottom.y-d.left.y)*0+y);
    c.lineTo(d.left.x+(d.bottom.x-d.left.x)*1, d.left.y+(d.bottom.y-d.left.y)*1+y);
    c.stroke();
    c.beginPath();
    c.moveTo(d.right.x+(d.bottom.x-d.right.x)*0, d.right.y+(d.bottom.y-d.right.y)*0+y);
    c.lineTo(d.right.x+(d.bottom.x-d.right.x)*1, d.right.y+(d.bottom.y-d.right.y)*1+y);
    c.stroke();
  }
  c.restore();

  // Toit rocher
  drawRoof(c, d, '#301e0a', C.void0);

  // Portique bois
  c.save(); c.strokeStyle = C.woodD; c.lineWidth = tileW*.05;
  c.beginPath();
  c.moveTo(d.left.x,  d.left.y -wallH*.08);
  c.lineTo(d.top.x,   d.top.y  -wallH*.42);
  c.lineTo(d.right.x, d.right.y-wallH*.08);
  c.stroke();
  // poutre transversale
  c.strokeStyle = C.wood; c.lineWidth = tileW*.04;
  c.beginPath();
  c.moveTo(d.left.x + (d.top.x-d.left.x)*.38, d.left.y+(d.top.y-d.left.y)*.38-wallH*.06);
  c.lineTo(d.right.x+(d.top.x-d.right.x)*.38, d.right.y+(d.top.y-d.right.y)*.38-wallH*.06);
  c.stroke();
  c.restore();

  // Ouverture de mine (face gauche)
  const mx = d.left.x+(d.bottom.x-d.left.x)*.5;
  const my = d.left.y+(d.bottom.y-d.left.y)*.5+wallH*.12;
  const mw = d.hw*.3, mh = wallH*.65;
  c.fillStyle = 'rgba(0,0,0,.92)';
  c.beginPath();
  c.moveTo(mx-mw, my+mh); c.lineTo(mx-mw, my+mh*.38);
  c.arc(mx, my+mh*.38, mw, Math.PI, 0);
  c.lineTo(mx+mw, my+mh); c.closePath(); c.fill();
  // Pourtour arche en bois
  c.strokeStyle = C.wood; c.lineWidth = tileW*.035; c.stroke();
  // Lueur intérieure
  c.save();
  c.shadowColor = C.gold; c.shadowBlur = 10+f*14;
  const gg = c.createRadialGradient(mx, my+mh*.55, mw*.05, mx, my+mh*.55, mw*.8);
  gg.addColorStop(0, `rgba(255,200,60,${.32+f*.2})`);
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gg;
  c.beginPath(); c.arc(mx, my+mh*.55, mw*.8, 0, Math.PI*2); c.fill();
  c.shadowBlur = 0; c.restore();

  // Chariot (Lv2+)
  if (level >= 2) {
    const cartX = d.bottom.x+d.hw*.15;
    const cartY = d.bottom.y+wallH*.28;
    const cw = tileW*.2, ch = tileH*.32;
    // caisse
    drawFaceLeft(c, { top:{x:cartX-cw,y:cartY-ch}, right:{x:cartX,y:cartY-ch*.5}, bottom:{x:cartX,y:cartY}, left:{x:cartX-cw,y:cartY-ch*.5}, hw:cw,hh:ch*.5 }, ch*.4, '#5a3818');
    c.fillStyle = '#6a4828'; c.strokeStyle = C.void0; c.lineWidth = 1;
    c.fillRect(cartX-cw, cartY-ch, cw*2, ch); c.strokeRect(cartX-cw, cartY-ch, cw*2, ch);
    // roues
    for (const [wx, wy] of [[cartX-cw*.6, cartY], [cartX+cw*.6, cartY]]) {
      const wr = tileW*.065;
      c.fillStyle = C.woodD; c.beginPath(); c.arc(wx, wy, wr, 0, Math.PI*2); c.fill();
      c.strokeStyle = C.void0; c.lineWidth = 1; c.stroke();
      c.strokeStyle = '#8a6040'; c.lineWidth = .9;
      for (let i=0; i<6; i++) {
        const a = i/6*Math.PI*2+t*.4;
        c.beginPath(); c.moveTo(wx,wy); c.lineTo(wx+Math.cos(a)*wr*.85, wy+Math.sin(a)*wr*.85); c.stroke();
      }
    }
    // minerai d'or
    for (let i=0; i<4; i++) {
      const gx = cartX+(i-1.5)*cw*.38, gy = cartY-ch*.72+Math.sin(i*1.4)*ch*.1;
      c.save(); c.shadowColor = C.gold; c.shadowBlur = 5+f*7;
      c.fillStyle = C.gold;
      c.beginPath();
      c.moveTo(gx, gy-ch*.22); c.lineTo(gx+cw*.08, gy); c.lineTo(gx, gy+ch*.1); c.lineTo(gx-cw*.08, gy); c.closePath();
      c.fill(); c.shadowBlur = 0; c.restore();
    }
  }

  // Pièce flottante Lv3
  if (level >= 3) {
    const bob = Math.sin(t*2.2)*tileH*.18;
    const cx = d.top.x, cy = d.top.y-wallH*.55+bob;
    c.save();
    c.shadowColor = C.gold; c.shadowBlur = 14+f*12;
    // Pièce en forme de losange iso
    c.fillStyle = C.gold;
    c.beginPath();
    c.moveTo(cx, cy-tileW*.1); c.lineTo(cx+tileW*.08, cy);
    c.lineTo(cx, cy+tileW*.1); c.lineTo(cx-tileW*.08, cy);
    c.closePath(); c.fill();
    c.strokeStyle = '#ffa820'; c.lineWidth = 1.2; c.stroke();
    // signe $ ou ᚷ (rune de richesse)
    c.fillStyle = C.void0; c.textAlign='center'; c.textBaseline='middle';
    c.font=`bold ${tileW*.12}px serif`; c.fillText('ᚷ', cx, cy);
    // reflet
    c.globalAlpha = .5; c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(cx-tileW*.03, cy-tileW*.04, tileW*.02, tileW*.01, -Math.PI/5, 0, Math.PI*2); c.fill();
    c.shadowBlur = 0; c.restore();
    // particules de poussière d'or
    for (let i=0; i<3; i++) {
      const px = cx+(Math.sin(t*2+i*2.1))*tileW*.12;
      const py = cy+Math.cos(t*1.8+i*1.7)*tileH*.1;
      orb(c, px, py, tileW*.018, C.gold, 5+f*4);
    }
  }

  if (sel) selDiamond(c, d, wallH, C.gold);
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. SCIERIE MAUDITE  2×2
// Style : grange sombre, rondins empilés, lame de scie tourboyante
// ═══════════════════════════════════════════════════════════════════════════
DRAW_FN.lumberMill = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  drawFaceLeft( c, d, wallH, '#2e1e0e');
  drawFaceRight(c, d, wallH, '#1e1208');

  // Planches de bois verticales
  c.save(); c.globalAlpha = .14; c.strokeStyle = '#fff'; c.lineWidth = .6;
  for (let i=1; i<=5; i++) {
    const ti=i/6;
    const lx=d.left.x+(d.bottom.x-d.left.x)*ti, ly=d.left.y+(d.bottom.y-d.left.y)*ti;
    c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx, ly+wallH); c.stroke();
    const rx=d.right.x+(d.bottom.x-d.right.x)*ti, ry=d.right.y+(d.bottom.y-d.right.y)*ti;
    c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx, ry+wallH); c.stroke();
  }
  c.restore();

  // Toit
  drawRoof(c, d, '#3a2410', C.void0);
  // Faîtière
  c.save(); c.strokeStyle = '#6a4020'; c.lineWidth = tileW*.045;
  c.beginPath(); c.moveTo(d.top.x, d.top.y); c.lineTo(d.right.x, d.right.y); c.stroke();
  c.beginPath(); c.moveTo(d.top.x, d.top.y); c.lineTo(d.left.x, d.left.y); c.stroke();
  c.restore();

  // Rondins empilés sur le toit
  for (let i=0; i<4; i++) {
    const ti = .15+i*.18;
    const lx = d.top.x+(d.left.x-d.top.x)*ti;
    const ly = d.top.y+(d.left.y-d.top.y)*ti;
    const hue = 22+i*6, lum = 22+i*3;
    c.save();
    c.shadowColor = C.woodD; c.shadowBlur = 3;
    c.strokeStyle = `hsl(${hue},50%,${lum}%)`; c.lineWidth = tileH*.19;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(lx-tileW*.06, ly+tileH*.07);
    c.lineTo(lx+tileW*.24, ly+tileH*.17);
    c.stroke();
    // Tranche du rondin
    c.fillStyle = `hsl(${hue+5},45%,${lum+8}%)`;
    c.beginPath(); c.arc(lx+tileW*.24, ly+tileH*.13, tileH*.09, 0, Math.PI*2); c.fill();
    c.strokeStyle = C.void0; c.lineWidth = .7; c.stroke();
    c.shadowBlur = 0; c.restore();
  }

  // Fenêtre
  windowLeft(c, d, wallH, .42, '#cc9050', f);

  // Lame de scie (face droite, Lv2+)
  if (level >= 2) {
    const spd = level >= 3 ? 3.2 : 1.9;
    const a = t*spd;
    const bx = d.right.x+(d.bottom.x-d.right.x)*.38;
    const by = d.right.y+(d.bottom.y-d.right.y)*.38+wallH*.22;
    const r  = tileW*.16;
    c.save(); c.translate(bx, by); c.rotate(a);
    // Corps de lame
    c.shadowColor = '#c0c0c0'; c.shadowBlur = level>=3 ? 12+f*10 : 4;
    c.fillStyle = '#b0b0c0'; c.strokeStyle = C.void0; c.lineWidth = .8;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI*2); c.fill(); c.stroke();
    // Hub
    c.fillStyle = '#808090'; c.beginPath(); c.arc(0, 0, r*.22, 0, Math.PI*2); c.fill();
    // Dents
    for (let i=0; i<12; i++) {
      const a2 = i/12*Math.PI*2;
      c.fillStyle = i%2===0 ? '#d0d0e0' : '#909090';
      c.beginPath()