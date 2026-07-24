/**
 * BuildingArtist.js  —  Ashen Kingdoms
 *
 * Chaque bâtiment est rendu comme un PRISME ISOMÉTRIQUE vu de coin :
 *   - la base EST le losange de l'empreinte (sw × sh tuiles)
 *   - la facade gauche (face col+) descend vers la gauche
 *   - la facade droite (face row+) descend vers la droite
 *   - le toit porte les détails (créneaux, spires, toiture…)
 *
 * Système de coordonnées transmis par VillageRenderer :
 *   origin = centre-BAS du losange (point le plus bas du losange = point "sud")
 *   hw  = (sw * tileW) / 2   demi-largeur horizontale
 *   hd  = (sh * tileH) / 2 * (sw/sh)  correction aspect
 *   Les 4 coins du losange (en coords locales, origin=sud) :
 *     S  = (0,      0)
 *     W  = (-hw*sw, -hd*sw)   point ouest
 *     N  = (0,      -hd*(sw+sh))  point nord
 *     E  = (+hw*sh, -hd*sh)   point est
 *
 * En pratique on passe directement :
 *   iso.S, iso.W, iso.N, iso.E  — les 4 coins du losange en px
 *   iso.hw, iso.hh               — demi-largeur et demi-diagonale verticale
 *   iso.wallH                    — hauteur des murs en px (réglable par bâtiment)
 *
 * Signature de chaque drawFn :
 *   drawFn(c, iso, level, t, f, sel)
 *     c     CanvasRenderingContext2D
 *     iso   { S,W,N,E, hw,hh, wallH, sw,sh, tileW,tileH }
 *     level 1|2|3
 *     t     secondes
 *     f     flicker 0..1
 *     sel   bool
 */

// ── Palette ───────────────────────────────────────────────────────
const C = {
  black:   '#07050d',
  stone0:  '#1e1828', stone1: '#2a2236', stone2: '#3a3050', stone3: '#4e4268',
  sideL:   '#1a1528', // face gauche (plus sombre)
  sideR:   '#251e38', // face droite
  roofD:   '#3a3050', // toit sombre
  roofL:   '#4e4268', // toit clair
  glow:    '#b87cff',
  amber:   '#e8a630',
  green:   '#62dca0',
  blood:   '#d84858',
  blue:    '#58b8ff',
  white:   '#f0eaf8',
  bone:    '#c8b898',
  wood:    '#8a5a30',
  gold:    '#f0c458',
  lava:    '#e03810',
  purple:  '#6a1eaa',
};

// ── Helpers isométriques ───────────────────────────────────────────────

/**
 * Calcule les 4 coins d'un losange isométrique.
 * Origin = point SUD (bas du losange).
 * sw, sh = taille en tuiles
 * tileW, tileH = taille d'une tuile en px
 */
function isoCorners(sw, sh, tileW, tileH) {
  // demi-vecteurs iso
  const ex = tileW / 2;  // vecteur unitaire est X
  const ey = tileH / 2;  // vecteur unitaire est Y (descend)
  // Dans l'espace iso, une tuile (dc, dr) donne un déplacement :
  //   dx = (dc - dr) * tileW/2
  //   dy = (dc + dr) * tileH/2
  // Coin sud   = origine (col+sw, row+sh) -> (0,0) relatif
  // Coin ouest = (col+0,  row+sh)
  // Coin nord  = (col+0,  row+0)
  // Coin est   = (col+sw, row+0)
  // En coordonnées locales (sud = 0,0) :
  const S = { x: 0,                                  y: 0 };
  const W = { x: -(sw * ex + sh * ex),                y: -(sw * ey - sh * ey) }; // (-sw+sh)*ex, (-sw-sh)*ey ... recalc
  const N = { x: 0,                                  y: -(sw * ey + sh * ey) };
  const E = { x:  (sw * ex + sh * ex),                y: -(sw * ey - sh * ey) };
  // Correction : en iso 2:1 :
  //   S = bas du losange
  //   W = gauche
  //   N = haut
  //   E = droite
  const Sx = 0,  Sy = 0;
  const Wx = -(sw * ex), Wy = sw * ey;
  const Ex = (sh * ex),  Ey = sh * ey;
  // Recalcul propre :
  // S = W + E  (vecteur)
  const rS = { x: 0, y: 0 };
  const rW = { x: -sw * ex, y: -sw * ey }; // haut-gauche relatif
  const rE = { x:  sh * ex, y: -sh * ey }; // haut-droite relatif
  // W_corner = S + rW  = rW
  // E_corner = S + rE  = rE
  // N_corner = rW + rE
  return {
    S: { x: 0,         y: 0 },
    W: { x: -sw * ex,  y:  sw * ey },   // ATTENTION : en iso le coin W est en bas-gauche
    N: { x: (sh - sw) * ex, y: -(sw + sh) * ey }, // recalc below
    E: { x:  sh * ex,  y:  sh * ey },
  };
  // NOTE : ce n'est pas le bon calcul direct, on le remplace ci-dessous.
}

/**
 * Renvoie les 4 coins du losange d'empreinte en coordonnées locales
 * avec origin = centre du losange.
 * hw = sw * tileW/2,  hh = sh * tileH/2
 * Les coins isométriques standard 2:1 (carré sw=sh=1) :
 *   TOP    = (0, -hh)     point nord
 *   RIGHT  = (+hw, 0)     point est
 *   BOTTOM = (0, +hh)     point sud
 *   LEFT   = (-hw, 0)     point ouest
 * Pour sw != sh on étire.
 */
function diamond(sw, sh, tileW, tileH) {
  const hw = sw * tileW / 2;  // demi-largeur
  const hh = sh * tileH / 2;  // demi-hauteur verticale
  // En iso 2:1, pour un carré de N tuiles :
  //   hw = N * tileW/2 = N*44
  //   hh = N * tileH/2 = N*22
  // On centre sur le milieu du losange
  return {
    top:    { x: 0,    y: -hh },   // nord
    right:  { x: hw,   y: 0 },     // est
    bottom: { x: 0,    y:  hh },   // sud
    left:   { x: -hw,  y: 0 },     // ouest
    hw, hh,
  };
}

/** Dessine le losange de toit (face top d'un prisme) */
function drawRoof(c, d, fill, strokeCol) {
  c.beginPath();
  c.moveTo(d.top.x,    d.top.y);
  c.lineTo(d.right.x,  d.right.y);
  c.lineTo(d.bottom.x, d.bottom.y);
  c.lineTo(d.left.x,   d.left.y);
  c.closePath();
  c.fillStyle = fill; c.fill();
  if (strokeCol) { c.strokeStyle = strokeCol; c.lineWidth = 1.5; c.stroke(); }
}

/** Face gauche du prisme (col+) : bottom-left + top-left + wall down */
function drawFaceLeft(c, d, wallH, fill) {
  // Face gauche = entre left et bottom, qui descend de wallH
  c.beginPath();
  c.moveTo(d.left.x,          d.left.y);
  c.lineTo(d.bottom.x,        d.bottom.y);
  c.lineTo(d.bottom.x,        d.bottom.y + wallH);
  c.lineTo(d.left.x,          d.left.y   + wallH);
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = C.black; c.lineWidth = 1.2; c.stroke();
}

/** Face droite du prisme (row+) : bottom-right + top-right + wall down */
function drawFaceRight(c, d, wallH, fill) {
  c.beginPath();
  c.moveTo(d.right.x,  d.right.y);
  c.lineTo(d.bottom.x, d.bottom.y);
  c.lineTo(d.bottom.x, d.bottom.y + wallH);
  c.lineTo(d.right.x,  d.right.y  + wallH);
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = C.black; c.lineWidth = 1.2; c.stroke();
}

/** Outline de sélection autour du losange */
function selDiamond(c, d, wallH, col) {
  c.save();
  c.shadowColor = col; c.shadowBlur = 18;
  c.strokeStyle = col; c.lineWidth = 2.2;
  c.setLineDash([5, 3]);
  c.beginPath();
  c.moveTo(d.top.x,    d.top.y - 2);
  c.lineTo(d.right.x + 2, d.right.y);
  c.lineTo(d.bottom.x, d.bottom.y + wallH + 2);
  c.lineTo(d.left.x - 2, d.left.y + wallH);
  c.closePath(); c.stroke();
  c.setLineDash([]); c.shadowBlur = 0; c.restore();
}

/** Ligne de créneaux isométriques sur le bord gauche du toit */
function crenelsLeft(c, d, n, cH, col, strokeCol) {
  const step = 1 / n;
  for (let i = 0; i < n; i += 2) {
    const t0 = i * step, t1 = (i + 1) * step;
    const x0 = d.left.x  + (d.bottom.x - d.left.x)  * t0;
    const y0 = d.left.y  + (d.bottom.y - d.left.y)  * t0;
    const x1 = d.left.x  + (d.bottom.x - d.left.x)  * t1;
    const y1 = d.left.y  + (d.bottom.y - d.left.y)  * t1;
    c.beginPath();
    c.moveTo(x0, y0); c.lineTo(x0, y0 - cH);
    c.lineTo(x1, y1 - cH); c.lineTo(x1, y1);
    c.closePath();
    c.fillStyle = col; c.fill();
    c.strokeStyle = strokeCol ?? C.black; c.lineWidth = 1; c.stroke();
  }
}

function crenelsRight(c, d, n, cH, col, strokeCol) {
  const step = 1 / n;
  for (let i = 0; i < n; i += 2) {
    const t0 = i * step, t1 = (i + 1) * step;
    const x0 = d.right.x + (d.bottom.x - d.right.x) * t0;
    const y0 = d.right.y + (d.bottom.y - d.right.y) * t0;
    const x1 = d.right.x + (d.bottom.x - d.right.x) * t1;
    const y1 = d.right.y + (d.bottom.y - d.right.y) * t1;
    c.beginPath();
    c.moveTo(x0, y0); c.lineTo(x0, y0 - cH);
    c.lineTo(x1, y1 - cH); c.lineTo(x1, y1);
    c.closePath();
    c.fillStyle = col; c.fill();
    c.strokeStyle = strokeCol ?? C.black; c.lineWidth = 1; c.stroke();
  }
}

/** Fenêtre-fente sur la face gauche */
function windowLeft(c, d, wallH, tx, col, f) {
  const ex = d.left.x  + (d.bottom.x - d.left.x)  * tx;
  const ey = d.left.y  + (d.bottom.y - d.left.y)  * tx;
  const wx = (d.bottom.x - d.left.x) * .04;
  const wy = wallH * .35;
  c.save(); c.shadowColor = col; c.shadowBlur = 5 + f * 7;
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(ex - wx, ey + wallH * .2);
  c.lineTo(ex,      ey + wallH * .2 - wy * .5);
  c.lineTo(ex + wx, ey + wallH * .2);
  c.lineTo(ex + wx, ey + wallH * .7);
  c.lineTo(ex,      ey + wallH * .7 + wy * .5);
  c.lineTo(ex - wx, ey + wallH * .7);
  c.closePath(); c.fill(); c.shadowBlur = 0; c.restore();
}

/** Torche iso : pos en tx (0..1) le long du bord gauche ou droit */
function torchOnEdge(c, d, wallH, tx, side, f, col) {
  col = col ?? C.amber;
  const edge = side === 'L'
    ? { ax: d.left.x,  ay: d.left.y,  bx: d.bottom.x, by: d.bottom.y }
    : { ax: d.right.x, ay: d.right.y, bx: d.bottom.x,  by: d.bottom.y };
  const x = edge.ax + (edge.bx - edge.ax) * tx;
  const y = edge.ay + (edge.by - edge.ay) * tx + wallH * .3;
  const sz = Math.max(2, wallH * .08);
  // tige
  c.save(); c.strokeStyle = C.bone; c.lineWidth = sz * .5;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - sz * 2.5); c.stroke();
  // flamme
  c.shadowColor = col; c.shadowBlur = sz * (3 + f * 4);
  c.fillStyle = col;
  c.beginPath(); c.ellipse(x, y - sz * 3.2, sz * .8, sz * (1.6 + f * .8), 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,200,.55)';
  c.beginPath(); c.ellipse(x, y - sz * 3.6, sz * .4, sz * (.8 + f * .3), 0, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0; c.restore();
}

/** Spire isométrique centrée sur le toit */
function isoSpire(c, d, wallH, h, fill, glowCol, f) {
  const cx = d.top.x, cy = d.top.y + (d.bottom.y - d.top.y) * .5; // centre toit
  const bw = d.hw * .3;
  c.save();
  if (glowCol) { c.shadowColor = glowCol; c.shadowBlur = 12 + f * 12; }
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(cx - bw, cy - wallH * .1);
  c.lineTo(cx, cy - wallH * .1 - h);
  c.lineTo(cx + bw, cy - wallH * .1);
  c.closePath(); c.fill();
  c.strokeStyle = C.black; c.lineWidth = 1.4; c.stroke();
  if (glowCol) {
    // orbe au sommet
    const or = Math.max(3, h * .06);
    c.fillStyle = glowCol;
    c.beginPath(); c.arc(cx, cy - wallH * .1 - h, or, 0, Math.PI * 2); c.fill();
  }
  c.shadowBlur = 0; c.restore();
}

/** Orbe glow */
function orb(c, x, y, r, col, blur) {
  c.save(); c.shadowColor = col; c.shadowBlur = blur;
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0; c.restore();
}

/** Bannière iso au bord nord du toit */
function isoBanner(c, d, wallH, h, col, runeCol) {
  const cx = (d.top.x + d.right.x) / 2;
  const cy = (d.top.y + d.right.y) / 2 - wallH * .05;
  const bw = d.hw * .12;
  c.beginPath();
  c.moveTo(cx - bw, cy - wallH * .1);
  c.lineTo(cx + bw, cy - wallH * .1);
  c.lineTo(cx + bw, cy - wallH * .1 - h * .82);
  c.lineTo(cx,      cy - wallH * .1 - h);
  c.lineTo(cx - bw, cy - wallH * .1 - h * .82);
  c.closePath();
  c.fillStyle = col; c.fill(); c.strokeStyle = C.black; c.lineWidth = 1.2; c.stroke();
  c.save(); c.fillStyle = runeCol; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${Math.max(7, h * .4)}px serif`; c.globalAlpha = .8;
  c.fillText('᛭', cx, cy - wallH * .1 - h * .5); c.restore();
}

/** Ombre au sol */
function groundShadow(c, d) {
  c.save(); c.globalAlpha = .35;
  c.beginPath();
  c.moveTo(d.top.x, d.top.y + 5);
  c.lineTo(d.right.x + 3, d.right.y + 5);
  c.lineTo(d.bottom.x, d.bottom.y + 5);
  c.lineTo(d.left.x - 3, d.left.y + 5);
  c.closePath(); c.fillStyle = '#000'; c.fill();
  c.restore();
}

// ───────────────────────────────────────────────────────────────────────────
//  BÂTIMENTS
//  Signature : drawFn(c, iso, level, t, f, sel)
//  iso = { d, wallH, tileW, tileH, sw, sh }
//  d   = diamond(sw, sh, tileW, tileH)
// ───────────────────────────────────────────────────────────────────────────

export const DRAW_FN = {};

// helpers locaux
function mkIso(sw, sh, tileW, tileH, wallFactor) {
  const d = diamond(sw, sh, tileW, tileH);
  const wallH = tileH * sh * wallFactor;
  return { d, wallH, tileW, tileH, sw, sh };
}

// ───────────────────────────────────────────────────────────────────────────
// 1. TRÔNE CORROMPU  4×4
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.townHall = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  // Murs
  drawFaceLeft( c, d, wallH, '#2a1e3a');
  drawFaceRight(c, d, wallH, '#1e1530');
  // Toit
  drawRoof(c, d, '#3a2a52', C.black);

  // Créneaux
  const cH = wallH * .22;
  crenelsLeft( c, d, 6, cH, '#4a3462', C.black);
  crenelsRight(c, d, 6, cH, '#4a3462', C.black);

  // Murs : joints de pierre
  c.save(); c.globalAlpha = .15; c.strokeStyle = C.black; c.lineWidth = .7;
  for (let i = 1; i < 4; i++) {
    const ti = i / 4;
    // gauche
    const lx0 = d.left.x  + (d.bottom.x - d.left.x) * ti,  ly0 = d.left.y  + (d.bottom.y - d.left.y) * ti;
    c.beginPath(); c.moveTo(lx0, ly0); c.lineTo(lx0, ly0 + wallH); c.stroke();
    // droite
    const rx0 = d.right.x + (d.bottom.x - d.right.x) * ti, ry0 = d.right.y + (d.bottom.y - d.right.y) * ti;
    c.beginPath(); c.moveTo(rx0, ry0); c.lineTo(rx0, ry0 + wallH); c.stroke();
  }
  c.restore();

  // Spires  — une centrale + deux latérales (Lv2)
  const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
  const cy = d.top.y + (d.bottom.y - d.top.y) * .5;
  isoSpire(c, d, wallH, wallH * (1.4 + level * .2), '#5a2878', '#d07aff', f);

  if (level >= 2) {
    // spires sur coins gauche et droite
    const sdL = diamond(1, 1, tileW, tileH);
    c.save(); c.translate(d.left.x, d.left.y);
    isoSpire(c, { ...iso, d: sdL }, 0, wallH * .8, '#3a1e5a', '#aa60ff', f * .7);
    c.restore();
    c.save(); c.translate(d.right.x, d.right.y);
    isoSpire(c, { ...iso, d: sdL }, 0, wallH * .8, '#3a1e5a', '#aa60ff', f * .7);
    c.restore();
  }

  if (level >= 3) {
    // couronne d'orbes rotatifs
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + t * .6;
      orb(c, cx + d.hw * .35 * Math.cos(a), cy - wallH * .6 + d.hh * .18 * Math.sin(a), tileW * .04, '#e0b0ff', 10 + f * 9);
    }
  }

  // Torches
  torchOnEdge(c, d, wallH, .25, 'L', f);
  torchOnEdge(c, d, wallH, .25, 'R', f);
  if (level >= 2) { torchOnEdge(c, d, wallH, .72, 'L', f); torchOnEdge(c, d, wallH, .72, 'R', f); }

  // Fenêtres
  windowLeft(c, d, wallH, .45, '#d07aff', f);

  // Bannière
  isoBanner(c, d, wallH, wallH * (.7 + level * .1), '#5a1888', '#e0b0ff');

  if (sel) selDiamond(c, d, wallH, '#d07aff');
};

// ───────────────────────────────────────────────────────────────────────────
// 2. MINE D'OR  2×2
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.goldMine = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  // Corps de mine (façade pierre brute)
  drawFaceLeft( c, d, wallH, '#2a1c10');
  drawFaceRight(c, d, wallH, '#1e1408');
  drawRoof(c, d, '#302010', C.black);

  // Ouverture de mine sur la face gauche
  const mx = d.left.x  + (d.bottom.x - d.left.x) * .5;
  const my = d.left.y  + (d.bottom.y - d.left.y) * .5 + wallH * .15;
  const mw = d.hw * .28, mh = wallH * .62;
  c.save();
  // Arche
  c.fillStyle = 'rgba(0,0,0,.88)';
  c.beginPath();
  c.moveTo(mx - mw, my + mh);
  c.lineTo(mx - mw, my + mh * .4);
  c.arc(mx, my + mh * .4, mw, Math.PI, 0);
  c.lineTo(mx + mw, my + mh);
  c.closePath(); c.fill();
  // Lueur or
  c.shadowColor = C.gold; c.shadowBlur = 8 + f * 10;
  c.fillStyle = `rgba(240,196,88,${.18 + f * .15})`;
  c.beginPath(); c.arc(mx, my + mh * .55, mw * .6, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0;
  c.restore();

  // Portique bois sur le toit
  c.save();
  c.strokeStyle = C.wood; c.lineWidth = tileW * .045;
  c.beginPath();
  c.moveTo(d.left.x,  d.left.y  - wallH * .05);
  c.lineTo(d.top.x,   d.top.y   - wallH * .35);
  c.lineTo(d.right.x, d.right.y - wallH * .05);
  c.stroke();
  c.restore();

  // Chariot (Lv2)
  if (level >= 2) {
    const cartX = d.bottom.x + d.hw * .12;
    const cartY = d.bottom.y + wallH * .3;
    const cw = tileW * .18, ch = tileH * .3;
    c.fillStyle = '#5a4030'; c.strokeStyle = C.black; c.lineWidth = 1.3;
    c.fillRect(cartX - cw, cartY - ch, cw * 2, ch); c.strokeRect(cartX - cw, cartY - ch, cw * 2, ch);
    for (const wx of [cartX - cw * .6, cartX + cw * .6]) {
      c.fillStyle = C.wood; c.beginPath(); c.arc(wx, cartY, tileW * .055, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    // paillettes d'or
    for (let i = 0; i < 3; i++) {
      c.fillStyle = C.gold; c.beginPath();
      c.arc(cartX + (i - 1) * cw * .5, cartY - ch * .6, tileW * .03, 0, Math.PI * 2); c.fill();
    }
  }

  // Pièce flottante (Lv3)
  if (level >= 3) {
    const bob = Math.sin(t * 2.1) * tileH * .15;
    orb(c, d.top.x, d.top.y - wallH * .5 + bob, tileW * .07, C.gold, 10 + f * 8);
  }

  if (sel) selDiamond(c, d, wallH, C.gold);
};

// ───────────────────────────────────────────────────────────────────────────
// 3. SCIERIE MAUDITE  2×2
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.lumberMill = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  drawFaceLeft( c, d, wallH, '#2a1c10');
  drawFaceRight(c, d, wallH, '#1c1208');

  // Toit en pente = losange + arête faitière
  drawRoof(c, d, '#3a2410', C.black);
  // Bande faitière
  c.beginPath();
  c.moveTo(d.top.x, d.top.y);
  c.lineTo(d.right.x, d.right.y);
  c.strokeStyle = '#5a3818'; c.lineWidth = tileW * .04; c.stroke();
  c.beginPath();
  c.moveTo(d.top.x, d.top.y);
  c.lineTo(d.left.x, d.left.y);
  c.strokeStyle = '#4a2c12'; c.lineWidth = tileW * .04; c.stroke();

  // Rondins sur le toit
  for (let i = 0; i < 3; i++) {
    const ti = .2 + i * .22;
    const lx = d.top.x + (d.left.x - d.top.x) * ti;
    const ly = d.top.y + (d.left.y - d.top.y) * ti;
    c.save(); c.strokeStyle = `hsl(22,${48+i*8}%,${22+i*4}%)`; c.lineWidth = tileH * .18;
    c.beginPath(); c.moveTo(lx - tileW * .04, ly + tileH * .05); c.lineTo(lx + tileW * .22, ly + tileH * .15); c.stroke();
    c.restore();
  }

  // Fenêtre face gauche
  windowLeft(c, d, wallH, .4, '#bc8a50', f);

  // Lame tournante (Lv2+)
  if (level >= 2) {
    const a = t * (level >= 3 ? 2.8 : 1.8);
    const bx = d.right.x + (d.bottom.x - d.right.x) * .35;
    const by = d.right.y + (d.bottom.y - d.right.y) * .35 + wallH * .25;
    const r  = tileW * .14;
    c.save(); c.translate(bx, by); c.rotate(a);
    c.fillStyle = '#909090'; c.strokeStyle = C.black; c.lineWidth = .7;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
    for (let i = 0; i < 8; i++) {
      const a2 = i / 8 * Math.PI * 2;
      c.beginPath();
      c.moveTo(Math.cos(a2) * r * .78, Math.sin(a2) * r * .78);
      c.lineTo(Math.cos(a2 + .22) * r * 1.25, Math.sin(a2 + .22) * r * 1.25);
      c.lineTo(Math.cos(a2 + .1)  * r * .78,  Math.sin(a2 + .1)  * r * .78);
      c.fillStyle = '#bbb'; c.fill();
    }
    c.restore();
  }

  // Fumée (Lv3)
  if (level >= 3) {
    for (let i = 0; i < 3; i++) {
      const bob = ((t * 1.2 + i * 1.1) % 3) / 3;
      c.save(); c.globalAlpha = .3 * (1 - bob);
      c.fillStyle = 'rgba(140,100,200,.6)';
      c.beginPath(); c.arc(d.top.x + (i - 1) * tileW * .08, d.top.y - wallH * .2 - bob * tileH * .8, tileW * (.04 + bob * .06), 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  if (sel) selDiamond(c, d, wallH, '#bc8a50');
};

// ───────────────────────────────────────────────────────────────────────────
// 4. PUITS D'ÂMES  2×2
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.essenceWell = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  // Base cylindrique : faces iso
  drawFaceLeft( c, d, wallH * .6, '#252030');
  drawFaceRight(c, d, wallH * .6, '#1a1824');

  // Toit = margelle du puits
  drawRoof(c, d, '#2e2840', C.black);

  // Ouverture sombre au centre du toit
  const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
  const cy = d.top.y + (d.bottom.y - d.top.y) * .5;
  c.save(); c.fillStyle = 'rgba(0,0,0,.9)';
  c.beginPath(); c.ellipse(cx, cy, d.hw * .28, d.hh * .28, 0, 0, Math.PI * 2); c.fill();
  c.restore();

  // Brume d'âmes montante
  for (let i = 0; i < 4; i++) {
    const ph = t * 1.2 + i * 1.5, rise = (ph % 3) / 3;
    c.save(); c.globalAlpha = .32 - rise * .28;
    c.fillStyle = i % 2 ? '#b870ff' : '#7840df';
    c.beginPath(); c.arc(cx + Math.sin(ph * 2 + i) * tileW * .06, cy - rise * wallH * 1.2,
      (tileW * .04 + i * tileW * .02 + rise * tileW * .06), 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // Cadre bois
  c.save(); c.strokeStyle = C.wood; c.lineWidth = tileW * .05;
  c.beginPath(); c.moveTo(d.left.x, d.left.y); c.lineTo(d.top.x, d.top.y - wallH * .45); c.stroke();
  c.beginPath(); c.moveTo(d.right.x, d.right.y); c.lineTo(d.top.x, d.top.y - wallH * .45); c.stroke();
  c.strokeStyle = '#5a3820'; c.lineWidth = tileW * .065;
  c.beginPath(); c.moveTo(d.left.x - tileW * .04, d.left.y - wallH * .01); c.lineTo(d.right.x + tileW * .04, d.right.y - wallH * .01); c.stroke();
  c.restore();

  // Seau (Lv2+)
  if (level >= 2) {
    const bob = Math.sin(t * 1.8) * tileH * .1;
    c.fillStyle = '#5a4030'; c.strokeStyle = C.black; c.lineWidth = 1.2;
    c.fillRect(cx - tileW * .07, cy - wallH * .55 + bob - tileH * .12, tileW * .14, tileH * .2);
    c.strokeRect(cx - tileW * .07, cy - wallH * .55 + bob - tileH * .12, tileW * .14, tileH * .2);
    orb(c, cx, cy - wallH * .55 + bob, tileW * .045, '#b870ff', 7 + f * 5);
  }

  // Orbes orbitaux (Lv3)
  if (level >= 3) {
    const a = t * 1.2;
    orb(c, cx + d.hw * .3 * Math.cos(a),     cy - wallH * .4 + d.hh * .12 * Math.sin(a),     tileW * .04, '#e0b0ff', 9 + f * 7);
    orb(c, cx + d.hw * .3 * Math.cos(a + Math.PI), cy - wallH * .4 + d.hh * .12 * Math.sin(a + Math.PI), tileW * .04, '#b060ff', 7 + f * 5);
  }

  if (sel) selDiamond(c, d, wallH, '#b982ff');
};

// ───────────────────────────────────────────────────────────────────────────
// 5. CAVEAU D'ÂMES  2×2
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.soulVault = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  drawFaceLeft( c, d, wallH, '#20183a');
  drawFaceRight(c, d, wallH, '#16102c');
  drawRoof(c, d, '#2c2248', C.black);

  // Toit en gradins (stepped pyramid)
  const steps = 1 + level;
  for (let i = 1; i <= steps; i++) {
    const r = 1 - i / (steps + 1);
    const sd = diamond(iso.sw * r, iso.sh * r, tileW, tileH);
    const off = -wallH * .06 * i;
    c.save(); c.translate(0, off);
    drawRoof(c, sd, `hsl(265,${26+i*7}%,${17+i*5}%)`, C.black);
    c.restore();
  }

  // Capstone
  const capY = d.top.y - wallH * .06 * steps - wallH * .12;
  orb(c, d.top.x, capY, tileW * .055, '#8b62cf', 13 + f * 11);

  // Porte arquée sur la face gauche
  const px = d.left.x  + (d.bottom.x - d.left.x) * .5;
  const py = d.left.y  + (d.bottom.y - d.left.y) * .5 + wallH * .12;
  const pw = d.hw * .22, ph = wallH * .6;
  c.fillStyle = 'rgba(0,0,0,.88)';
  c.beginPath();
  c.moveTo(px - pw, py + ph); c.lineTo(px - pw, py + ph * .42);
  c.arc(px, py + ph * .42, pw, Math.PI, 0);
  c.lineTo(px + pw, py + ph); c.closePath(); c.fill();
  c.strokeStyle = '#5a4870'; c.lineWidth = tileW * .03; c.stroke();
  // halo int
  c.save(); c.shadowColor = '#8b62cf'; c.shadowBlur = 10 + f * 12;
  c.fillStyle = `rgba(139,98,207,${.15 + f * .12})`;
  c.beginPath(); c.arc(px, py + ph * .62, pw * .5, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0; c.restore();

  if (level >= 2) torchOnEdge(c, d, wallH, .72, 'L', f, '#8b62cf');

  if (sel) selDiamond(c, d, wallH, '#8b62cf');
};

// ───────────────────────────────────────────────────────────────────────────
// 6. CASERNE MAUDITE  2×2
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.barracks = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  drawFaceLeft( c, d, wallH, '#2e1e1e');
  drawFaceRight(c, d, wallH, '#1e1414');
  drawRoof(c, d, '#3a2828', C.black);

  crenelsLeft( c, d, 6, wallH * .2, '#482e2e');
  crenelsRight(c, d, 6, wallH * .2, '#482e2e');

  // Portail arqué sur la face droite
  const gx = d.right.x + (d.bottom.x - d.right.x) * .45;
  const gy = d.right.y + (d.bottom.y - d.right.y) * .45 + wallH * .1;
  const gw = d.hw * .18, gh = wallH * .65;
  c.fillStyle = 'rgba(0,0,0,.9)';
  c.beginPath();
  c.moveTo(gx - gw, gy + gh); c.lineTo(gx - gw, gy + gh * .38);
  c.arc(gx, gy + gh * .38, gw, Math.PI, 0);
  c.lineTo(gx + gw, gy + gh); c.closePath(); c.fill();
  c.strokeStyle = '#6a3030'; c.lineWidth = tileW * .03; c.stroke();
  c.save(); c.shadowColor = C.blood; c.shadowBlur = 7 + f * 9;
  c.fillStyle = `rgba(216,72,88,${.12 + f * .1})`;
  c.beginPath(); c.arc(gx, gy + gh * .55, gw * .55, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0; c.restore();

  if (level >= 2) {
    c.fillStyle = C.bone; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${tileW * .2}px serif`;
    c.fillText('☠', gx, gy + gh * .48);
  }

  if (level >= 3) {
    c.save(); c.globalAlpha = .55; c.fillStyle = '#c03040';
    for (let i = 0; i < 4; i++) {
      const drip = (t * 24 + i * 12) % (wallH * .9);
      c.beginPath(); c.arc(d.left.x + (d.bottom.x - d.left.x) * (.15 + i * .2), d.left.y + (d.bottom.y - d.left.y) * (.15 + i * .2) + drip, tileW * .02, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  torchOnEdge(c, d, wallH, .22, 'L', f, C.blood);
  torchOnEdge(c, d, wallH, .22, 'R', f, C.blood);
  windowLeft(c, d, wallH, .6, C.blood, f);

  if (sel) selDiamond(c, d, wallH, C.blood);
};

// ───────────────────────────────────────────────────────────────────────────
// 7. BRASIER RITUEL  2×2
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.campfire = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  // Cercle de pierres (plat sur le losange)
  drawRoof(c, d, '#1e1828', C.black);

  // Pierres individuelles sur le bord du toit
  c.fillStyle = C.stone2; c.strokeStyle = C.black; c.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const ti = i / 8;
    const px = d.top.x + (d.right.x - d.top.x) * (ti < .5 ? ti * 2 : 0)
              + (d.left.x + (d.bottom.x - d.left.x) * Math.max(0, ti * 2 - 1)) * (ti >= .5 ? 1 : 0);
    // simpler: lerp around all 4 edges
    let ex, ey;
    if (ti < .25)      { const r = ti / .25; ex = d.top.x + (d.right.x - d.top.x) * r; ey = d.top.y + (d.right.y - d.top.y) * r; }
    else if (ti < .5)  { const r = (ti - .25) / .25; ex = d.right.x + (d.bottom.x - d.right.x) * r; ey = d.right.y + (d.bottom.y - d.right.y) * r; }
    else if (ti < .75) { const r = (ti - .5) / .25; ex = d.bottom.x + (d.left.x - d.bottom.x) * r; ey = d.bottom.y + (d.left.y - d.bottom.y) * r; }
    else               { const r = (ti - .75) / .25; ex = d.left.x + (d.top.x - d.left.x) * r; ey = d.left.y + (d.top.y - d.left.y) * r; }
    c.beginPath(); c.ellipse(ex, ey, tileW * .05, tileH * .05, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  }

  // Bûches
  const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
  const cy = d.top.y + (d.bottom.y - d.top.y) * .5;
  c.save(); c.strokeStyle = '#6a3818'; c.lineWidth = tileW * .07;
  [-.45, .45, Math.PI / 2].forEach(a => {
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * d.hw * .28, cy + Math.sin(a) * d.hh * .28);
    c.lineTo(cx - Math.cos(a) * d.hw * .28, cy - Math.sin(a) * d.hh * .28);
    c.stroke();
  });
  c.restore();

  // Flammes
  const fh = wallH * 1.2;
  const layers = [
    { w: d.hw * .14, h: fh * .55, col: '#e03010', a: .72 },
    { w: d.hw * .10, h: fh * .7,  col: '#f07820', a: .84 },
    { w: d.hw * .07, h: fh * .78, col: '#f8c040', a: .92 },
    { w: d.hw * .04, h: fh * .68, col: '#ffffc0', a: .97 },
  ];
  layers.forEach(({ w, h, col, a }) => {
    const sw2 = Math.sin(t * 3.2 + a * 10) * d.hw * .035;
    c.save(); c.globalAlpha = a;
    c.shadowColor = col; c.shadowBlur = 8 + f * 11;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(cx - w + sw2, cy);
    c.bezierCurveTo(cx - w + sw2, cy - h * .4, cx + sw2 - w * .3, cy - h * .85, cx + sw2, cy - h);
    c.bezierCurveTo(cx + sw2 + w * .3, cy - h * .85, cx + w + sw2, cy - h * .4, cx + w + sw2, cy);
    c.closePath(); c.fill(); c.shadowBlur = 0; c.restore();
  });

  if (level >= 2) {
    for (let i = 0; i < 2; i++) {
      const ox = (i * 2 - 1) * d.hw * .38;
      const ff = Math.sin(t * 2.8 + i * 2) * .5 + .5;
      c.save(); c.globalAlpha = .68;
      c.shadowColor = '#f07820'; c.shadowBlur = 6 + ff * 7;
      c.fillStyle = '#f07820';
      c.beginPath(); c.ellipse(cx + ox, cy - fh * (.22 + ff * .2), d.hw * (.04 + ff * .02), fh * (.18 + ff * .1), 0, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0; c.restore();
    }
  }

  if (sel) selDiamond(c, d, 0, C.green);
};

// ───────────────────────────────────────────────────────────────────────────
// 8. CHÂTEAU DE CLAN  3×3
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.clanCastle = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  drawFaceLeft( c, d, wallH, '#2a1e40');
  drawFaceRight(c, d, wallH, '#1e1630');
  drawRoof(c, d, '#362852', C.black);

  const cH = wallH * .2;
  crenelsLeft( c, d, 8, cH, '#402e62');
  crenelsRight(c, d, 8, cH, '#402e62');

  // Spire centrale
  isoSpire(c, iso, wallH, wallH * (1.2 + level * .18), '#3a1a60', '#d3a6ff', f);

  // Bannière
  isoBanner(c, d, wallH, wallH * (.6 + level * .1), '#60209a', '#e0b0ff');

  // Fenêtres
  windowLeft(c, d, wallH, .35, '#c080f0', f);
  windowLeft(c, d, wallH, .65, '#c080f0', f);

  // Torches
  torchOnEdge(c, d, wallH, .18, 'L', f, '#c080f0');
  torchOnEdge(c, d, wallH, .18, 'R', f, '#c080f0');

  if (level >= 2) {
    // 2 spires aux coins gauche/droite
    const sdm = diamond(1.2, 1.2, tileW, tileH);
    c.save(); c.translate(d.left.x, d.left.y);
    isoSpire(c, { ...iso, d: sdm }, 0, wallH * .7, '#2a1848', '#b080e0', f * .7); c.restore();
    c.save(); c.translate(d.right.x, d.right.y);
    isoSpire(c, { ...iso, d: sdm }, 0, wallH * .7, '#2a1848', '#b080e0', f * .7); c.restore();
  }

  if (level >= 3) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + t * .4;
      const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
      const cy = d.top.y + (d.bottom.y - d.top.y) * .5 - wallH * 1.1;
      orb(c, cx + d.hw * .3 * Math.cos(a), cy + d.hh * .12 * Math.sin(a), tileW * .035, '#d3a6ff', 9 + f * 7);
    }
  }

  if (sel) selDiamond(c, d, wallH, '#d3a6ff');
};

// ───────────────────────────────────────────────────────────────────────────
// 9. TOUR RUNIQUE  1×1
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.runeTower = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  // Tour étroite centrée sur le losange 1×1
  drawFaceLeft( c, d, wallH, '#1e1a32');
  drawFaceRight(c, d, wallH, '#16122a');
  drawRoof(c, d, '#282042', C.black);

  // Créneaux
  crenelsLeft( c, d, 4, wallH * .25, '#30284e');
  crenelsRight(c, d, 4, wallH * .25, '#30284e');

  // Runes gravées sur la face gauche
  c.save(); c.globalAlpha = .28 + f * .14; c.fillStyle = '#c070ff';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${tileW * .22}px serif`;
  ['ᚱ', 'ᚢ', 'ᚾ'].forEach((r, i) => {
    const ti = .2 + i * .25;
    const rx = d.left.x + (d.bottom.x - d.left.x) * ti;
    const ry = d.left.y + (d.bottom.y - d.left.y) * ti + wallH * .5;
    c.fillText(r, rx, ry);
  });
  c.restore();

  // Spire avec anneau d'orbes
  isoSpire(c, iso, wallH, wallH * (1.6 + level * .22), '#20183c', '#c870ff', f);

  // Orbes rotatifs
  const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
  const cy = d.top.y + (d.bottom.y - d.top.y) * .5 - wallH * 1.0;
  for (let i = 0; i < 3 + level; i++) {
    const a = i / (3 + level) * Math.PI * 2 + t * .9;
    orb(c, cx + d.hw * .45 * Math.cos(a), cy + d.hh * .2 * Math.sin(a), tileW * .04, '#c070ff', 7 + f * 7);
  }

  if (level >= 3 && Math.sin(t * 4) > .7) {
    c.save(); c.globalAlpha = .55; c.strokeStyle = '#e0b0ff'; c.lineWidth = tileW * .02;
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + t * 2;
      c.beginPath(); c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * d.hw * .7, cy + Math.sin(a) * d.hh * .35); c.stroke();
    }
    c.restore();
  }

  windowLeft(c, d, wallH, .5, '#c870ff', f);
  if (sel) selDiamond(c, d, wallH, '#c870ff');
};

// ───────────────────────────────────────────────────────────────────────────
// 10. CATAPULTE D'OSSEMENTS  2×2
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.boneCatapult = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  // Plateforme basse
  drawFaceLeft( c, d, wallH * .3, '#2e2010');
  drawFaceRight(c, d, wallH * .3, '#201608');
  drawRoof(c, d, '#382818', C.black);

  // Châssis central
  const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
  const cy = d.top.y + (d.bottom.y - d.top.y) * .5;
  c.save(); c.strokeStyle = '#7a5030'; c.lineWidth = tileW * .065;
  c.beginPath(); c.moveTo(d.left.x, d.left.y + wallH * .28); c.lineTo(cx, cy - wallH * .08); c.stroke();
  c.beginPath(); c.moveTo(d.right.x, d.right.y + wallH * .28); c.lineTo(cx, cy - wallH * .08); c.stroke();
  c.beginPath(); c.moveTo(d.left.x, d.left.y + wallH * .28); c.lineTo(d.right.x, d.right.y + wallH * .28); c.stroke();
  c.restore();

  // Bras pivotant
  const armA = -Math.PI * .5 + Math.sin(t * .9) * (level >= 2 ? .3 : .18);
  c.save(); c.translate(cx, cy - wallH * .08);
  c.rotate(armA);
  c.strokeStyle = '#8a5028'; c.lineWidth = tileW * .07;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -wallH * .9); c.stroke();
  // Seau
  c.fillStyle = C.bone; c.strokeStyle = C.black; c.lineWidth = 1.2;
  c.beginPath(); c.arc(0, -wallH * .92, tileW * .1, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();

  // Roues (sur les façades)
  for (const [wx, wy] of [[d.left.x, d.left.y + wallH * .28], [d.right.x, d.right.y + wallH * .28]]) {
    c.fillStyle = '#5a3a20'; c.beginPath(); c.arc(wx, wy, tileW * .1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = C.black; c.lineWidth = 1.3; c.stroke();
    c.fillStyle = '#3a2010'; c.beginPath(); c.arc(wx, wy, tileW * .05, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#8a6040'; c.lineWidth = tileW * .02;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * .3; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * tileW * .09, wy + Math.sin(a) * tileW * .09); c.stroke(); }
  }

  if (level >= 3) orb(c, cx, cy - wallH * .08, tileW * .055, '#ff9840', 11 + f * 9);
  if (sel) selDiamond(c, d, wallH * .3, '#d66c5f');
};

// ───────────────────────────────────────────────────────────────────────────
// 11. FLÈCHE DES ÂMES  1×1
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.soulSpire = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  drawFaceLeft( c, d, wallH, '#161c2e');
  drawFaceRight(c, d, wallH, '#0e1420');
  drawRoof(c, d, '#1c2438', C.black);

  // Tour élancée = aiguille très haute
  isoSpire(c, iso, wallH, wallH * (2.2 + level * .3), '#1a2e50', '#79b7ff', f);

  // Wisps orbitaux
  const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
  const cy = d.top.y + (d.bottom.y - d.top.y) * .5 - wallH * 1.2;
  for (let i = 0; i < 2 + level; i++) {
    const a = i / (2 + level) * Math.PI * 2 + t * .7;
    orb(c, cx + d.hw * .55 * Math.cos(a), cy + d.hh * .22 * Math.sin(a), tileW * .038, '#9ad4ff', 6 + f * 5);
  }

  windowLeft(c, d, wallH, .42, '#79b7ff', f);
  if (level >= 2) windowLeft(c, d, wallH, .68, '#9ad4ff', f);

  if (level >= 3) {
    c.save(); c.globalAlpha = .16;
    const bg = c.createLinearGradient(cx, cy, cx, cy - wallH * 2);
    bg.addColorStop(0, '#79b7ff'); bg.addColorStop(1, 'rgba(121,183,255,0)');
    c.fillStyle = bg; c.fillRect(cx - tileW * .03, cy - wallH * 2, tileW * .06, wallH * 1.5);
    c.restore();
  }

  if (sel) selDiamond(c, d, wallH, '#79b7ff');
};

// ───────────────────────────────────────────────────────────────────────────
// 12. PIÈGE MAUDIT  1×1
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.cursedTrap = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;

  // Plaque au sol = toit plat (quasi pas de murs)
  drawRoof(c, d, '#2a1a1e', C.black);

  // Rune gravée dans la plaque
  const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
  const cy = d.top.y + (d.bottom.y - d.top.y) * .5;
  c.save(); c.globalAlpha = .3 + f * .22; c.fillStyle = C.blood;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${tileW * .28}px serif`; c.fillText('ᛝ', cx, cy); c.restore();

  // Piques
  const nSpikes = 2 + level;
  const spikeH  = wallH * (.55 + level * .22);
  for (let i = 0; i < nSpikes; i++) {
    const ti = (i + .5) / nSpikes;
    const sx = d.top.x + (d.bottom.x - d.top.x) * ti;
    const sy = d.top.y + (d.bottom.y - d.top.y) * ti;
    const bob = Math.sin(t * 1.4 + i * .8) * tileH * .025 * (level >= 3 ? .8 : 0);
    c.fillStyle = '#8a7060'; c.strokeStyle = C.black; c.lineWidth = .9;
    c.beginPath();
    c.moveTo(sx - tileW * .025, sy);
    c.lineTo(sx, sy - spikeH - bob);
    c.lineTo(sx + tileW * .025, sy);
    c.closePath(); c.fill(); c.stroke();
  }

  c.save(); c.shadowColor = C.blood; c.shadowBlur = 4 + f * 6;
  c.beginPath(); c.ellipse(cx, cy, d.hw * .22, d.hh * .22, 0, 0, Math.PI * 2);
  c.fillStyle = `rgba(216,72,88,${.07 + f * .07})`; c.fill(); c.shadowBlur = 0; c.restore();

  if (sel) selDiamond(c, d, spikeH, C.blood);
};

// ───────────────────────────────────────────────────────────────────────────
// 13. REMPART D'OSSEMENTS  1×1
// ───────────────────────────────────────────────────────────────────────────
DRAW_FN.wall = function(c, iso, level, t, f, sel) {
  const { d, wallH, tileW, tileH } = iso;
  groundShadow(c, d);

  const lc = `hsl(270,${12+level*4}%,${16+level*4}%)`;
  const rc = `hsl(270,${10+level*3}%,${11+level*3}%)`;
  const tc = `hsl(270,${14+level*5}%,${20+level*4}%)`;

  drawFaceLeft( c, d, wallH, lc);
  drawFaceRight(c, d, wallH, rc);
  drawRoof(c, d, tc, C.black);

  const cH = wallH * (.22 + level * .06);
  crenelsLeft( c, d, 2 + level, cH, `hsl(270,${16+level*5}%,${24+level*4}%)`);
  crenelsRight(c, d, 2 + level, cH, `hsl(270,${16+level*5}%,${24+level*4}%)`);

  if (level >= 2) {
    const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
    const cy = d.top.y + (d.bottom.y - d.top.y) * .5 - wallH * .1;
    c.fillStyle = C.bone; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${tileW * .24}px serif`; c.globalAlpha = .55; c.fillText('☠', cx, cy); c.globalAlpha = 1;
  }
  if (level >= 3) {
    const cx = d.top.x + (d.bottom.x - d.top.x) * .5;
    const cy = d.top.y + (d.bottom.y - d.top.y) * .5 - wallH * .1;
    c.save(); c.globalAlpha = .28 + f * .2; c.fillStyle = C.blood;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${tileW * .18}px serif`; c.fillText('ᚻ', cx - tileW * .18, cy); c.restore();
  }

  if (sel) selDiamond(c, d, wallH, '#887796');
};
