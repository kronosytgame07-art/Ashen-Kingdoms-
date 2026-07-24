/**
 * BuildingArtist.js
 * Procedural pixel-art for every building in Ashen Kingdoms.
 * Style: Dark Souls atmosphere × Supercell polish.
 *
 * Each building has a dedicated draw function that reads:
 *   ctx      — CanvasRenderingContext2D (already translated to building anchor)
 *   level    — 1 | 2 | 3  (visual tier)
 *   scale    — camera zoom
 *   t        — normalised time (seconds, continuous)
 *   sel      — boolean, building is selected
 *
 * Level differences are ALWAYS visible:
 *   Lv1 → base silhouette, minimal ornament
 *   Lv2 → added element (extra tower / extra window / banner / bigger glow)
 *   Lv3 → crown element + rune / extra spike / dual torch + richer palette
 *
 * All helpers expect ctx to be in building-local space (0,0 = anchor).
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Shared palette
// ─────────────────────────────────────────────────────────────────────────────
const P = {
  black:  '#07050d',
  stone0: '#1e1828',
  stone1: '#2a2236',
  stone2: '#3a3050',
  stone3: '#4e4268',
  glow:   '#b87cff',
  glowDim:'#7c3fcf',
  amber:  '#e8a630',
  amberDim:'#a07020',
  green:  '#62dca0',
  blood:  '#d84858',
  blue:   '#58b8ff',
  white:  '#f0eaf8',
  bone:   '#c8b898',
  wood:   '#8a5a30',
  gold:   '#f0c458',
  lava:   '#e03810',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Low-level primitives
// ─────────────────────────────────────────────────────────────────────────────

function outline(c, stroke = P.black, lw = 2) {
  c.strokeStyle = stroke; c.lineWidth = lw; c.stroke();
}

function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  c.beginPath();
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);  c.arcTo(x,y,x+w,y,r); c.closePath();
}

function poly(c, pts) {
  c.beginPath(); c.moveTo(pts[0],pts[1]);
  for (let i=2;i<pts.length;i+=2) c.lineTo(pts[i],pts[i+1]);
  c.closePath();
}

/** Radial gradient helper */
function radGrad(c, cx, cy, r0, r1, inner, outer) {
  const g = c.createRadialGradient(cx,cy,r0,cx,cy,r1);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  return g;
}

/** Linear gradient helper */
function linGrad(c, x0,y0,x1,y1, stops) {
  const g = c.createLinearGradient(x0,y0,x1,y1);
  stops.forEach(([pos,col]) => g.addColorStop(pos, col));
  return g;
}

/** Draw glow circle */
function glowCircle(c, x, y, r, col, blur) {
  c.save(); c.shadowColor=col; c.shadowBlur=blur;
  c.fillStyle=col; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
  c.shadowBlur=0; c.restore();
}

/** Torch flame at (x,y) — size s, flicker f∈[0..1] */
function torch(c, x, y, s, f, col=P.amber) {
  c.save();
  c.shadowColor=col; c.shadowBlur=(8+f*10)*s;
  c.fillStyle=col;
  c.beginPath(); c.ellipse(x, y-(3+f*2)*s, 2.5*s, (5+f*3)*s, 0, 0, Math.PI*2); c.fill();
  c.fillStyle='rgba(255,255,200,.55)';
  c.beginPath(); c.ellipse(x, y-(4+f*2)*s, 1.2*s, (2.5+f)*s, 0, 0, Math.PI*2); c.fill();
  c.shadowBlur=0; c.restore();
}

/** Rune symbol drawn at centre */
function rune(c, x, y, sz, col, alpha=.6) {
  c.save(); c.globalAlpha=alpha;
  c.fillStyle=col; c.textAlign='center'; c.textBaseline='middle';
  c.font=`${sz}px serif`; c.fillText('᛭',x,y);
  c.restore();
}

/** Stone-slab base  */
function slab(c, w, h, col1, col2) {
  const g = linGrad(c, -w/2,0, w/2,h, [[0,col1],[1,col2]]);
  c.fillStyle=g; c.strokeStyle=P.black; c.lineWidth=2;
  c.fillRect(-w/2, 0, w, h); c.strokeRect(-w/2, 0, w, h);
}

/** Wall segment of a tower body */
function towerBody(c, bw, bh, col1, col2) {
  const g = linGrad(c, -bw/2,-bh, bw/2,0, [[0,col1],[1,col2]]);
  c.fillStyle=g; c.strokeStyle=P.black; c.lineWidth=2;
  c.fillRect(-bw/2,-bh,bw,bh); c.strokeRect(-bw/2,-bh,bw,bh);
}

/** Row of battlements along the top of a rect */
function battlements(c, bw, top, crenW, crenH, col) {
  const n = Math.max(2, Math.round(bw/crenW));
  const step = bw/n;
  c.fillStyle=col; c.strokeStyle=P.black; c.lineWidth=1.5;
  for (let i=0;i<n;i+=2) {
    const x = -bw/2 + i*step;
    c.fillRect(x, top-crenH, step, crenH); c.strokeRect(x, top-crenH, step, crenH);
  }
}

/** Pointed spire at (0, apex) with base at baseY spanning bw */
function spire(c, bw, baseY, apex, col, borderCol=P.black) {
  poly(c, [-bw/2,baseY, 0,apex, bw/2,baseY]);
  c.fillStyle=col; c.fill();
  c.strokeStyle=borderCol; c.lineWidth=2; c.stroke();
}

/** Window slit rectangle centred at (cx, cy) */
function windowSlit(c, cx, cy, sw, sh, glowCol, f) {
  c.save(); c.shadowColor=glowCol; c.shadowBlur=(6+f*8);
  rrect(c, cx-sw/2, cy-sh/2, sw, sh, sw*.4);
  c.fillStyle=glowCol; c.fill();
  c.shadowBlur=0; c.restore();
}

/** Drop shadow ellipse under a building */
function shadow(c, rx, ry) {
  c.beginPath(); c.ellipse(0,5,rx,ry,0,0,Math.PI*2);
  c.fillStyle='rgba(0,0,0,.45)'; c.fill();
}

/** Mortar lines (horizontal stone joints) */
function mortarLines(c, bw, bh, rows) {
  c.save(); c.globalAlpha=.2; c.strokeStyle=P.black; c.lineWidth=.8;
  for (let i=1;i<rows;i++) {
    const y = -bh + i*bh/rows;
    c.beginPath(); c.moveTo(-bw/2,y); c.lineTo(bw/2,y); c.stroke();
  }
  c.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Per-building draw functions
//  Signature: drawXxx(c, scale, level, t, flicker, sel)
//  where flicker = sin(t*freq + phase)*0.5+0.5  ∈ [0..1]
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. TRÔNE CORROMPU (townHall) ─────────────────────────────────────────────
export function drawTownHall(c, s, level, t, flicker, sel) {
  const w = 68*s, h = (72 + level*10)*s;
  shadow(c, w*.58, 14*s);

  // Keep (central round tower)
  const kw = w*.56, kh = h*.82;
  towerBody(c, kw, kh, '#3a2848', '#261d33');
  mortarLines(c, kw, kh, 4);

  // Left flanking tower
  const lw=w*.26, lh=h*.65;
  c.save(); c.translate(-w*.3,0);
  towerBody(c, lw, lh, '#312240', '#1e1630');
  mortarLines(c, lw, lh, 3);
  battlements(c, lw, -lh, lw*.48, 7*s, '#3a2848');
  c.restore();

  // Right flanking tower
  c.save(); c.translate(w*.3,0);
  towerBody(c, lw, lh, '#312240', '#1e1630');
  mortarLines(c, lw, lh, 3);
  battlements(c, lw, -lh, lw*.48, 7*s, '#3a2848');
  c.restore();

  // Central keep battlements
  battlements(c, kw, -kh, kw*.4, 10*s, '#452e58');

  // Spire
  c.shadowColor='#d07aff'; c.shadowBlur=(16+flicker*14)*s;
  spire(c, kw*.6, -kh, -h-20*s, '#5a2878');
  c.shadowBlur=0;
  // Spire gem
  glowCircle(c, 0, -h-18*s, 5*s, '#d07aff', (18+flicker*16)*s);

  // Level-specific ornaments
  if (level >= 2) {
    // Second mini-spire on each flanking tower
    c.save(); c.translate(-w*.3,0);
    c.shadowColor='#aa60ff'; c.shadowBlur=8*s;
    spire(c, lw*.55, -lh, -lh-10*s, '#3a1e5a'); c.shadowBlur=0; c.restore();
    c.save(); c.translate(w*.3,0);
    c.shadowColor='#aa60ff'; c.shadowBlur=8*s;
    spire(c, lw*.55, -lh, -lh-10*s, '#3a1e5a'); c.shadowBlur=0; c.restore();
  }
  if (level >= 3) {
    // Crown ring of rune orbs
    for (let i=0;i<6;i++) {
      const a = i/6*Math.PI*2 + t*.6;
      const rx=kw*.36*Math.cos(a), ry=kw*.18*Math.sin(a);
      glowCircle(c, rx, -kh-8*s+ry*.6, 3.5*s, '#e0b0ff', (12+flicker*8)*s);
    }
  }

  // Dual torches flanking entrance
  torch(c, -kw*.38, -kh*.35, s, flicker);
  torch(c,  kw*.38, -kh*.35, s, flicker);
  if (level >= 2) {
    torch(c, -w*.44, -lh*.42, s*.8, flicker);
    torch(c,  w*.44, -lh*.42, s*.8, flicker);
  }

  // Window slits
  windowSlit(c, 0, -kh*.52, 10*s, 18*s, '#d07aff', flicker);
  if (level >= 2) { windowSlit(c, -kw*.22, -kh*.40, 7*s, 13*s, '#aa60ff', flicker); windowSlit(c, kw*.22, -kh*.40, 7*s, 13*s, '#aa60ff', flicker); }
  if (level >= 3) { windowSlit(c, 0, -kh*.78, 10*s, 8*s, '#e0b0ff', flicker); }

  // Banner
  const bh2 = 28*s*(1+level*.12);
  poly(c, [-10*s,-kh*.75, 10*s,-kh*.75, 10*s,-kh*.75+bh2*.82, 0,-kh*.75+bh2, -10*s,-kh*.75+bh2*.82]);
  c.fillStyle='#5a1888'; c.fill(); outline(c);
  rune(c, 0, -kh*.75+bh2*.46, 10*s, '#e0b0ff', .7);

  if (sel) { c.save(); c.shadowColor='#d07aff'; c.shadowBlur=22*s; c.strokeStyle='#d07aff'; c.lineWidth=2.5*s; c.strokeRect(-w/2*.9,-h-.08*h,w*.9*1,h*1.1); c.restore(); }
}

// ── 2. MINE D'OR CORROMPU (goldMine) ─────────────────────────────────────────
export function drawGoldMine(c, s, level, t, flicker, sel) {
  const w=40*s, h=(36+level*6)*s;
  shadow(c, w*.5, 10*s);

  // Wooden support frame A-shape
  c.strokeStyle=P.wood; c.lineWidth=4*s;
  c.beginPath(); c.moveTo(-w*.4,-h*.7); c.lineTo(0,-h); c.lineTo(w*.4,-h*.7); c.stroke();
  c.beginPath(); c.moveTo(-w*.3,-h*.5); c.lineTo(w*.3,-h*.5); c.stroke();

  // Stone entrance arch
  c.save();
  c.fillStyle=P.stone1; c.strokeStyle=P.black; c.lineWidth=2;
  rrect(c,-w*.38,-h*.68,w*.76,h*.7,4*s); c.fill(); c.stroke();
  // Arch opening (dark hole)
  c.fillStyle='rgba(0,0,0,.82)';
  rrect(c,-w*.22,-h*.62,w*.44,h*.55,3*s); c.fill();
  c.restore();

  // Gold vein glow inside arch
  c.save(); c.shadowColor=P.gold; c.shadowBlur=(8+flicker*10)*s;
  c.fillStyle=`rgba(240,196,88,${.25+flicker*.2})`;
  rrect(c,-w*.22,-h*.62,w*.44,h*.55,3*s); c.fill();
  c.shadowBlur=0; c.restore();

  // Ore cart (Lv2+)
  if (level >= 2) {
    c.save(); c.translate(-w*.04, -4*s);
    c.fillStyle='#5a4030'; c.strokeStyle=P.black; c.lineWidth=1.5;
    c.fillRect(-8*s,-7*s,16*s,7*s); c.strokeRect(-8*s,-7*s,16*s,7*s);
    c.fillStyle=P.gold; c.beginPath();
    for (let i=0;i<3;i++) { c.arc((-4+i*4)*s,-4*s,2*s,0,Math.PI*2); c.fill(); }
    // Wheels
    c.fillStyle=P.wood;
    c.beginPath(); c.arc(-6*s,0,3*s,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc( 6*s,0,3*s,0,Math.PI*2); c.fill();
    c.restore();
  }

  // Floating gold coin (Lv3)
  if (level >= 3) {
    const bob=Math.sin(t*2.1)*3*s;
    glowCircle(c, w*.35, -h*.8+bob, 5*s, P.gold, (10+flicker*8)*s);
  }

  // Level number badge
  if (level >= 2) {
    c.save(); c.fillStyle='rgba(10,7,16,.9)'; c.strokeStyle=P.gold; c.lineWidth=1.5;
    rrect(c,-9*s,-h-14*s,18*s,13*s,5*s); c.fill(); c.stroke();
    c.fillStyle=P.gold; c.textAlign='center'; c.textBaseline='middle';
    c.font=`700 ${Math.max(8,9*s)}px 'Cinzel',serif`;
    c.fillText(`Lv${level}`,0,-h-7.5*s); c.restore();
  }

  if (sel) { c.save(); c.shadowColor=P.gold; c.shadowBlur=16*s; c.strokeStyle=P.gold; c.lineWidth=2*s; c.strokeRect(-w/2,-h-4*s,w,h+6*s); c.restore(); }
}

// ── 3. SCIERIE MAUDITE (lumberMill) ──────────────────────────────────────────
export function drawLumberMill(c, s, level, t, flicker, sel) {
  const w=42*s, h=(34+level*5)*s;
  shadow(c, w*.52, 10*s);

  // Log pile
  for (let i=0;i<3;i++) {
    c.fillStyle=`hsl(25,${40+i*8}%,${22+i*4}%)`;
    c.strokeStyle=P.black; c.lineWidth=1.5;
    c.beginPath();
    c.ellipse(-w*.2+(i-1)*w*.14, -5*s - i*7*s, w*.18, 5*s, .15*(i-1), 0, Math.PI*2);
    c.fill(); c.stroke();
  }

  // Shed body
  c.fillStyle=P.stone1; c.strokeStyle=P.black; c.lineWidth=2;
  c.fillRect(-w*.42,-h*.55,w*.84,h*.58); c.strokeRect(-w*.42,-h*.55,w*.84,h*.58);

  // Slanted roof
  poly(c, [-w*.46,-h*.55, 0,-h, w*.46,-h*.55]);
  c.fillStyle='#3a2c1e'; c.fill(); outline(c);
  // Roof planks
  c.save(); c.globalAlpha=.15; c.strokeStyle=P.black; c.lineWidth=.8;
  for (let i=-2;i<=2;i++) { c.beginPath(); c.moveTo(i*w*.12,-h*.55); c.lineTo(i*w*.08,-h); c.stroke(); }
  c.restore();

  // Saw blade (spinning Lv2+)
  if (level >= 2) {
    const bladeAngle = t * (level>=3?2.5:1.5);
    c.save(); c.translate(w*.28,-h*.36);
    c.rotate(bladeAngle);
    c.fillStyle='#8a8a8a'; c.strokeStyle=P.black; c.lineWidth=1;
    c.beginPath(); c.arc(0,0,9*s,0,Math.PI*2); c.fill(); c.stroke();
    for (let i=0;i<10;i++) {
      const a=i/10*Math.PI*2;
      poly(c, [Math.cos(a)*7*s,Math.sin(a)*7*s, Math.cos(a+.25)*11*s,Math.sin(a+.25)*11*s, Math.cos(a+.1)*7*s,Math.sin(a+.1)*7*s]);
      c.fillStyle='#aaaaaa'; c.fill();
    }
    c.restore();
  }

  // Cursed smoke (Lv3)
  if (level >= 3) {
    c.save(); c.globalAlpha=.3;
    for (let i=0;i<3;i++) {
      const bob=Math.sin(t*1.4+i*1.2)*4*s;
      c.fillStyle='rgba(140,100,200,.5)';
      c.beginPath(); c.arc(-w*.08+(i-1)*8*s, -h-8*s+bob, (5+i*3)*s, 0, Math.PI*2); c.fill();
    }
    c.restore();
  }

  if (sel) { c.save(); c.shadowColor='#bc8a50'; c.shadowBlur=16*s; c.strokeStyle='#bc8a50'; c.lineWidth=2*s; c.strokeRect(-w*.52,-h-4*s,w*1.04,h+6*s); c.restore(); }
}

// ── 4. PUITS D'ÂMES (essenceWell) ────────────────────────────────────────────
export function drawEssenceWell(c, s, level, t, flicker, sel) {
  const w=38*s, h=(42+level*7)*s;
  shadow(c, w*.52, 10*s);

  // Stone well wall
  c.fillStyle=P.stone1; c.strokeStyle=P.black; c.lineWidth=2;
  c.beginPath();
  c.ellipse(0,-h*.22,w*.46,h*.28,0,0,Math.PI*2);
  c.fill(); c.stroke();
  // Well opening (dark)
  c.fillStyle='rgba(0,0,0,.9)';
  c.beginPath(); c.ellipse(0,-h*.22,w*.28,h*.16,0,0,Math.PI*2); c.fill();

  // Soul mist rising from well
  c.save();
  for (let i=0;i<4;i++) {
    const phase = t*1.2 + i*1.5;
    const rise = ((phase % 3) / 3); // 0..1
    const a = .35 - rise*.35;
    const sz = (4+i*2+rise*8)*s;
    const ox = Math.sin(phase*2.1+i)*6*s;
    c.globalAlpha=a;
    c.fillStyle=i%2?'#b870ff':'#7840df';
    c.beginPath(); c.arc(ox,-h*.22-rise*h*.7,sz,0,Math.PI*2); c.fill();
  }
  c.restore();

  // Wooden frame / roof
  c.strokeStyle=P.wood; c.lineWidth=3.5*s;
  c.beginPath(); c.moveTo(-w*.4,-h*.22); c.lineTo(-w*.36,-h); c.stroke();
  c.beginPath(); c.moveTo( w*.4,-h*.22); c.lineTo( w*.36,-h); c.stroke();
  c.strokeStyle='#6a4828'; c.lineWidth=5*s;
  c.beginPath(); c.moveTo(-w*.4,-h); c.lineTo(w*.4,-h); c.stroke();

  // Bucket (Lv2+)
  if (level >= 2) {
    const bob = Math.sin(t*1.8)*5*s;
    c.fillStyle='#5a4030'; c.strokeStyle=P.black; c.lineWidth=1.5;
    rrect(c,-6*s,-h*.5+bob,12*s,10*s,2*s); c.fill(); c.stroke();
    // Essence glow in bucket
    glowCircle(c,0,-h*.46+bob,4*s,'#b870ff',(8+flicker*6)*s);
  }

  // Orbiting rune (Lv3)
  if (level >= 3) {
    const a = t*1.2;
    const rx=16*s,ry=7*s;
    glowCircle(c, rx*Math.cos(a), -h*.4+ry*Math.sin(a), 4*s, '#e0b0ff', (10+flicker*8)*s);
    glowCircle(c, rx*Math.cos(a+Math.PI), -h*.4+ry*Math.sin(a+Math.PI), 4*s, '#b060ff', (8+flicker*6)*s);
  }

  if (sel) { c.save(); c.shadowColor='#b982ff'; c.shadowBlur=16*s; c.strokeStyle='#b982ff'; c.lineWidth=2*s; c.strokeRect(-w*.5,-h-4*s,w,h+6*s); c.restore(); }
}

// ── 5. CAVEAU D'ÂMES (soulVault) ─────────────────────────────────────────────
export function drawSoulVault(c, s, level, t, flicker, sel) {
  const w=44*s, h=(48+level*8)*s;
  shadow(c, w*.55, 12*s);

  // Vault body
  towerBody(c, w*.85, h*.72, '#2c2240', '#18152a');
  mortarLines(c, w*.85, h*.72, 4);

  // Vaulted door arch
  c.save();
  const dw=w*.38, dh=h*.44;
  c.translate(0, -h*.02);
  c.fillStyle='rgba(0,0,0,.88)';
  c.beginPath();
  c.moveTo(-dw/2, 0);
  c.lineTo(-dw/2,-dh*.65);
  c.arc(0,-dh*.65,dw/2,Math.PI,0);
  c.lineTo(dw/2,0);
  c.closePath(); c.fill();
  // Door frame
  c.strokeStyle='#5a4870'; c.lineWidth=2*s;
  c.stroke();
  c.restore();

  // Glow inside vault (soul light)
  c.save(); c.shadowColor='#8b62cf'; c.shadowBlur=(12+flicker*14)*s;
  c.fillStyle=`rgba(139,98,207,${.18+flicker*.12})`;
  c.beginPath();
  c.arc(0,-h*.38,w*.2,0,Math.PI*2); c.fill();
  c.shadowBlur=0; c.restore();

  // Pyramid-style stepped roof
  const steps = 1 + level;
  for (let i=0;i<steps;i++) {
    const bw2=w*.85*(1-i/(steps+1)), top=-h*.72-i*8*s;
    c.fillStyle=`hsl(265,${30+i*8}%,${18+i*5}%)`;
    c.strokeStyle=P.black; c.lineWidth=1.5;
    c.fillRect(-bw2/2,top-6*s,bw2,6*s); c.strokeRect(-bw2/2,top-6*s,bw2,6*s);
  }
  // Capstone gem
  const capY = -h*.72 - steps*8*s - 4*s;
  glowCircle(c, 0, capY, (4+level)*s, '#8b62cf', (14+flicker*12)*s);

  // Lv2: side pillar chains
  if (level >= 2) {
    c.save(); c.globalAlpha=.5; c.strokeStyle='#5a4870'; c.lineWidth=1.8*s;
    const cx=w*.48;
    for (let i=0;i<5;i++) { const y=-h*.6+i*10*s; c.beginPath(); c.arc(cx+Math.sin(t*.8+i)*.5*s,y,2*s,0,Math.PI*2); c.stroke(); }
    for (let i=0;i<5;i++) { const y=-h*.6+i*10*s; c.beginPath(); c.arc(-cx+Math.sin(t*.8+i+2)*.5*s,y,2*s,0,Math.PI*2); c.stroke(); }
    c.restore();
  }

  if (sel) { c.save(); c.shadowColor='#8b62cf'; c.shadowBlur=18*s; c.strokeStyle='#8b62cf'; c.lineWidth=2*s; c.strokeRect(-w*.48,-h-4*s,w*.96,h+6*s); c.restore(); }
}

// ── 6. CASERNE MAUDITE (barracks) ────────────────────────────────────────────
export function drawBarracks(c, s, level, t, flicker, sel) {
  const w=44*s, h=(42+level*6)*s;
  shadow(c, w*.55, 11*s);

  // Main building
  towerBody(c, w*.88, h*.7, '#3a2828', '#221818');
  mortarLines(c, w*.88, h*.7, 3);
  battlements(c, w*.88, -h*.7, w*.16, 8*s, '#482e2e');

  // Left watchtower
  c.save(); c.translate(-w*.34,0);
  towerBody(c, w*.22, h*.55, '#402a2a', '#281818');
  battlements(c, w*.22, -h*.55, w*.10, 6*s, '#4a2e2e');
  c.restore();

  // Right watchtower
  c.save(); c.translate(w*.34,0);
  towerBody(c, w*.22, h*.55, '#402a2a', '#281818');
  battlements(c, w*.22, -h*.55, w*.10, 6*s, '#4a2e2e');
  c.restore();

  // Gate
  c.fillStyle='rgba(0,0,0,.9)';
  c.beginPath(); c.arc(0,0,w*.2,Math.PI,0); c.lineTo(w*.2,0); c.lineTo(-w*.2,0); c.closePath(); c.fill();
  c.strokeStyle='#6a3030'; c.lineWidth=2*s; c.stroke();
  // Gate glow
  c.save(); c.shadowColor=P.blood; c.shadowBlur=(8+flicker*10)*s;
  c.fillStyle=`rgba(216,72,88,${.15+flicker*.1})`;
  c.beginPath(); c.arc(0,-5*s,w*.14,0,Math.PI*2); c.fill();
  c.shadowBlur=0; c.restore();

  // Skull motif on gate (Lv2+)
  if (level >= 2) {
    c.fillStyle=P.bone; c.textAlign='center'; c.textBaseline='middle';
    c.font=`${12*s}px serif`; c.fillText('☠',0,-8*s);
  }

  // Blood drips (Lv3)
  if (level >= 3) {
    c.save(); c.globalAlpha=.65; c.fillStyle='#c03040';
    for (let i=0;i<4;i++) {
      const drip=(t*18+i*13)%((h*.68+8)*s);
      c.beginPath(); c.arc((-w*.28+i*w*.18),-h*.7+drip,1.8*s,0,Math.PI*2); c.fill();
    }
    c.restore();
  }

  // Torches
  torch(c,-w*.48,-h*.35,s,flicker,P.blood);
  torch(c, w*.48,-h*.35,s,flicker,P.blood);
  windowSlit(c,0,-h*.52,8*s,14*s,P.blood,flicker);

  if (sel) { c.save(); c.shadowColor=P.blood; c.shadowBlur=16*s; c.strokeStyle=P.blood; c.lineWidth=2*s; c.strokeRect(-w*.5,-h-4*s,w,h+6*s); c.restore(); }
}

// ── 7. BRASIER RITUEL (campfire) ──────────────────────────────────────────────
export function drawCampfire(c, s, level, t, flicker, sel) {
  const w=36*s, h=(28+level*4)*s;
  shadow(c, w*.48, 9*s);

  // Stone circle
  c.fillStyle=P.stone1; c.strokeStyle=P.black; c.lineWidth=2;
  c.beginPath(); c.ellipse(0,-5*s,w*.46,w*.2,0,0,Math.PI*2); c.fill(); c.stroke();

  // Logs (3 logs in X)
  c.strokeStyle='#6a3818'; c.lineWidth=6*s;
  const logAngles=[-.45, .45, Math.PI/2];
  logAngles.forEach(a => {
    c.beginPath(); c.moveTo(Math.cos(a)*w*.3,-5*s+Math.sin(a)*w*.12); c.lineTo(-Math.cos(a)*w*.3,-5*s-Math.sin(a)*w*.12); c.stroke();
  });

  // Main flame (multi-layer)
  const fr = flicker;
  const layers=[
    {w:w*.18,h:h*.5,col:'#e03010',a:.7},
    {w:w*.13,h:h*.65,col:'#f07820',a:.8},
    {w:w*.09,h:h*.72,col:'#f8c040',a:.9},
    {w:w*.05,h:h*.62,col:'#ffffc0',a:.95},
  ];
  layers.forEach(({w:fw,h:fh,col,a}) => {
    const sway=Math.sin(t*3.2+(a*10))*3*s;
    c.save(); c.globalAlpha=a;
    c.shadowColor=col; c.shadowBlur=(10+fr*12)*s;
    c.fillStyle=col;
    c.beginPath();
    c.moveTo(-fw/2+sway,-5*s);
    c.bezierCurveTo(-fw/2+sway,-5*s-fh*.4, sway-fw*.3,-5*s-fh*.8, sway,-5*s-fh);
    c.bezierCurveTo(sway+fw*.3,-5*s-fh*.8, fw/2+sway,-5*s-fh*.4, fw/2+sway,-5*s);
    c.closePath(); c.fill();
    c.shadowBlur=0; c.restore();
  });

  // Extra flames (Lv2+)
  if (level >= 2) {
    for (let i=0;i<2;i++) {
      const ox = (i*2-1)*w*.28;
      const ff=Math.sin(t*2.8+i*2)*.5+.5;
      c.save(); c.globalAlpha=.7;
      c.shadowColor='#f07820'; c.shadowBlur=(8+ff*8)*s;
      c.fillStyle='#f07820';
      c.beginPath(); c.ellipse(ox,-5*s-(10+ff*8)*s,(4+ff*2)*s,(8+ff*4)*s,0,0,Math.PI*2); c.fill();
      c.shadowBlur=0; c.restore();
    }
  }

  // Skull embers (Lv3)
  if (level >= 3) {
    c.fillStyle='rgba(255,220,100,.6)'; c.textAlign='center'; c.textBaseline='middle';
    c.font=`${8*s}px serif`;
    for (let i=0;i<3;i++) {
      const a2=t*1.8+i*2.1;
      c.save(); c.globalAlpha=.45+Math.sin(a2)*.2;
      c.fillText('💀', Math.cos(a2)*12*s, -h*.5+Math.sin(a2)*4*s); c.restore();
    }
  }

  if (sel) { c.save(); c.shadowColor=P.green; c.shadowBlur=16*s; c.strokeStyle=P.green; c.lineWidth=2*s; c.strokeRect(-w*.52,-h-4*s,w*1.04,h+6*s); c.restore(); }
}

// ── 8. CHÂTEAU DE CLAN (clanCastle) ──────────────────────────────────────────
export function drawClanCastle(c, s, level, t, flicker, sel) {
  const w=62*s, h=(66+level*10)*s;
  shadow(c, w*.6, 14*s);

  // Curtain wall (wide base)
  c.fillStyle=P.stone1; c.strokeStyle=P.black; c.lineWidth=2;
  c.fillRect(-w*.5,-h*.18,w,h*.2); c.strokeRect(-w*.5,-h*.18,w,h*.2);

  // Two side towers
  for (const sx of [-1,1]) {
    c.save(); c.translate(sx*w*.34,0);
    towerBody(c, w*.26, h*.62, '#362844', '#221a30');
    mortarLines(c, w*.26, h*.62, 3);
    battlements(c, w*.26,-h*.62, w*.12, 7*s, '#402e52');
    // Arrow slit
    windowSlit(c,0,-h*.38,6*s,12*s,'#c080f0',flicker);
    c.restore();
  }

  // Central main tower (taller)
  towerBody(c, w*.36, h*.82, '#3e2c52', '#261e38');
  mortarLines(c, w*.36, h*.82, 4);
  battlements(c, w*.36,-h*.82, w*.14, 9*s, '#4e3862');

  // Gate (portcullis bars)
  c.fillStyle='rgba(0,0,0,.85)';
  c.beginPath(); c.arc(0,-1*s,w*.14,Math.PI,0); c.lineTo(w*.14,-1*s); c.lineTo(-w*.14,-1*s); c.closePath(); c.fill();
  c.save(); c.globalAlpha=.55; c.strokeStyle='#6a5080'; c.lineWidth=1.8*s;
  for (let i=-2;i<=2;i++) { c.beginPath(); c.moveTo(i*w*.05,-1*s); c.lineTo(i*w*.05,-w*.14); c.stroke(); }
  c.restore();

  // Clan banner
  const bh3=32*s*(1+level*.15);
  poly(c,[-12*s,-h*.76, 12*s,-h*.76, 12*s,-h*.76+bh3*.82, 0,-h*.76+bh3, -12*s,-h*.76+bh3*.82]);
  c.fillStyle='#60209a'; c.fill(); outline(c);
  rune(c,0,-h*.76+bh3*.46,12*s,'#e0b0ff',.75);

  // Central spire
  c.shadowColor='#d3a6ff'; c.shadowBlur=(14+flicker*12)*s;
  spire(c, w*.3, -h*.82, -h-18*s, '#3a1a60');
  c.shadowBlur=0;
  glowCircle(c,0,-h-16*s,5*s,'#d3a6ff',(16+flicker*12)*s);

  // Lv2: side spires
  if (level >= 2) {
    for (const sx of [-1,1]) {
      c.save(); c.translate(sx*w*.34,0);
      c.shadowColor='#b080e0'; c.shadowBlur=8*s;
      spire(c,w*.22,-h*.62,-h*.62-12*s,'#2a1848');
      c.shadowBlur=0; c.restore();
    }
  }

  // Lv3: floating rune crown
  if (level >= 3) {
    for (let i=0;i<8;i++) {
      const a=i/8*Math.PI*2+t*.4;
      glowCircle(c, w*.25*Math.cos(a), -h-2*s+w*.1*Math.sin(a), 3*s,'#d3a6ff',(10+flicker*8)*s);
    }
  }

  // Torches
  torch(c,-w*.52,-h*.34,s,flicker,'#c080f0');
  torch(c, w*.52,-h*.34,s,flicker,'#c080f0');

  if (sel) { c.save(); c.shadowColor='#d3a6ff'; c.shadowBlur=20*s; c.strokeStyle='#d3a6ff'; c.lineWidth=2.5*s; c.strokeRect(-w*.55,-h-6*s,w*1.1,h+8*s); c.restore(); }
}

// ── 9. TOUR RUNIQUE (runeTower) ───────────────────────────────────────────────
export function drawRuneTower(c, s, level, t, flicker, sel) {
  const w=28*s, h=(52+level*8)*s;
  shadow(c, w*.55, 9*s);

  // Octagonal base
  const nb=8, rb=w*.52;
  c.beginPath();
  for (let i=0;i<nb;i++) {
    const a=i/nb*Math.PI*2; const x=rb*Math.cos(a),y=rb*Math.sin(a)*.4+2*s;
    i===0?c.moveTo(x,y):c.lineTo(x,y);
  }
  c.closePath();
  c.fillStyle=P.stone2; c.fill(); outline(c);

  // Tower shaft
  towerBody(c, w*.7, h*.78, '#262038', '#161028');
  mortarLines(c, w*.7, h*.78, 5);

  // Rune engravings on shaft
  const runeSyms=['ᚱ','ᚢ','ᚾ','ᛖ'];
  c.save(); c.globalAlpha=.28+flicker*.15; c.fillStyle='#c070ff';
  c.textAlign='center'; c.textBaseline='middle';
  const fs=Math.max(7,8*s);
  c.font=`${fs}px serif`;
  runeSyms.forEach((r,i) => { c.fillText(r, 0, -h*.2-i*h*.14); });
  c.restore();

  // Crenellations
  battlements(c, w*.7, -h*.78, w*.3, 8*s, '#302648');

  // Rotating rune ring (top)
  const glowColor = '#c070ff';
  for (let i=0;i<(3+level);i++) {
    const a = i/(3+level)*Math.PI*2 + t*.8;
    const rx=w*.3,ry=w*.12;
    c.save(); c.shadowColor=glowColor; c.shadowBlur=(8+flicker*8)*s;
    c.fillStyle=glowColor;
    c.beginPath(); c.arc(rx*Math.cos(a),-h*.78+ry*Math.sin(a),(2.5+level*.5)*s,0,Math.PI*2); c.fill();
    c.shadowBlur=0; c.restore();
  }

  // Charged orb at top
  glowCircle(c,0,-h*.82,(6+level*2)*s,'#c870ff',(16+flicker*18)*s);

  // Lv2: secondary ring
  if (level >= 2) {
    for (let i=0;i<6;i++) {
      const a=i/6*Math.PI*2 - t*.6;
      glowCircle(c, w*.22*Math.cos(a),-h*.96+w*.08*Math.sin(a),2*s,'#9040d0',(6+flicker*4)*s);
    }
  }

  // Lv3: lightning arc flashes
  if (level >= 3 && Math.sin(t*4)>0.7) {
    c.save(); c.globalAlpha=.6; c.strokeStyle='#e0b0ff'; c.lineWidth=1.5*s;
    for (let i=0;i<3;i++) {
      const a2=i/3*Math.PI*2+t*2;
      c.beginPath(); c.moveTo(0,-h*.82); c.lineTo(Math.cos(a2)*w*.6,-h*.82+Math.sin(a2)*w*.3); c.stroke();
    }
    c.restore();
  }

  windowSlit(c,0,-h*.5,6*s,10*s,'#c870ff',flicker);

  if (sel) { c.save(); c.shadowColor='#c870ff'; c.shadowBlur=18*s; c.strokeStyle='#c870ff'; c.lineWidth=2*s; c.strokeRect(-w*.42,-h-4*s,w*.84,h+6*s); c.restore(); }
}

// ── 10. CATAPULTE D'OSSEMENTS (boneCatapult) ─────────────────────────────────
export function drawBoneCatapult(c, s, level, t, flicker, sel) {
  const w=46*s, h=(38+level*5)*s;
  shadow(c, w*.58, 11*s);

  // Platform
  c.fillStyle='#3e2e20'; c.strokeStyle=P.black; c.lineWidth=2;
  c.fillRect(-w*.48,-6*s,w*.96,6*s); c.strokeRect(-w*.48,-6*s,w*.96,6*s);
  // Wheels
  for (const wx of [-w*.3,w*.3]) {
    c.fillStyle='#5a3a20'; c.beginPath(); c.arc(wx,0,8*s,0,Math.PI*2); c.fill(); outline(c);
    c.fillStyle='#3a2010'; c.beginPath(); c.arc(wx,0,4*s,0,Math.PI*2); c.fill();
    c.strokeStyle='#8a6040'; c.lineWidth=1.5*s;
    for (let i=0;i<6;i++) { const a=i/6*Math.PI*2+t*.3; c.beginPath(); c.moveTo(wx,0); c.lineTo(wx+Math.cos(a)*7*s,Math.sin(a)*7*s); c.stroke(); }
  }

  // Frame
  c.strokeStyle='#7a5030'; c.lineWidth=5*s;
  c.beginPath(); c.moveTo(-w*.22,-6*s); c.lineTo(-w*.18,-h*.62); c.stroke();
  c.beginPath(); c.moveTo( w*.22,-6*s); c.lineTo( w*.18,-h*.62); c.stroke();
  c.beginPath(); c.moveTo(-w*.2,-h*.62); c.lineTo(w*.2,-h*.62); c.stroke();

  // Arm (pivoting)
  const armAngle = -Math.PI*.5 + Math.sin(t*.9)*(level>=2?.28:.18);
  c.save(); c.translate(0,-h*.3); c.rotate(armAngle);
  c.strokeStyle='#8a5028'; c.lineWidth=5*s;
  c.beginPath(); c.moveTo(0,0); c.lineTo(0,-h*.46); c.stroke();
  // Bucket with bone pile
  c.fillStyle=P.bone; c.strokeStyle=P.black; c.lineWidth=1.5;
  c.beginPath(); c.arc(0,-h*.47,7*s,0,Math.PI*2); c.fill(); c.stroke();
  // Bone chunks
  c.fillStyle='#e0d0b0';
  for (let i=0;i<3;i++) { const a=i/3*Math.PI*2; c.beginPath(); c.arc(Math.cos(a)*4*s,-h*.47+Math.sin(a)*4*s,2*s,0,Math.PI*2); c.fill(); }
  c.restore();

  // Lv2: second catapult arm shadow
  if (level >= 2) {
    c.save(); c.globalAlpha=.35; c.translate(w*.08,0); c.translate(0,-h*.3); c.rotate(armAngle-.2);
    c.strokeStyle='#6a3818'; c.lineWidth=3*s;
    c.beginPath(); c.moveTo(0,0); c.lineTo(0,-h*.42); c.stroke();
    c.restore();
  }

  // Lv3: Glowing rune on frame
  if (level >= 3) {
    glowCircle(c,0,-h*.6,5*s,'#ff9840',(12+flicker*10)*s);
  }

  if (sel) { c.save(); c.shadowColor='#d66c5f'; c.shadowBlur=16*s; c.strokeStyle='#d66c5f'; c.lineWidth=2*s; c.strokeRect(-w*.52,-h-4*s,w*1.04,h+6*s); c.restore(); }
}

// ── 11. FLÈCHE DES ÂMES (soulSpire) ──────────────────────────────────────────
export function drawSoulSpire(c, s, level, t, flicker, sel) {
  const w=24*s, h=(56+level*9)*s;
  shadow(c, w*.5, 8*s);

  // Thin elegant tower
  towerBody(c, w*.65, h*.75, '#1e2840', '#101830');
  mortarLines(c, w*.65, h*.75, 6);

  // Buttresses at base
  for (const sx of [-1,1]) {
    c.save(); c.translate(sx*w*.32,0);
    c.fillStyle='#181c2c'; c.strokeStyle=P.black; c.lineWidth=1.5;
    poly(c,[0,0, sx*w*.24,0, sx*w*.08,-h*.22, 0,-h*.22]);
    c.fill(); c.stroke();
    c.restore();
  }

  // Tall needle spire
  c.shadowColor='#79b7ff'; c.shadowBlur=(12+flicker*14)*s;
  spire(c, w*.55, -h*.75, -h-22*s, '#1a2e50','#79b7ff');
  c.shadowBlur=0;

  // Soul orb at tip
  glowCircle(c,0,-h-20*s,(5+level)*s,'#79b7ff',(16+flicker*16)*s);

  // Orbiting soul wisps
  for (let i=0;i<(2+level);i++) {
    const a = i/(2+level)*Math.PI*2 + t*.7;
    const rx=w*.45, ry=w*.18;
    c.save(); c.shadowColor='#9ad4ff'; c.shadowBlur=(6+flicker*6)*s;
    c.fillStyle='#9ad4ff';
    c.beginPath(); c.arc(rx*Math.cos(a),-h*.5+ry*Math.sin(a),(2+level*.5)*s,0,Math.PI*2); c.fill();
    c.shadowBlur=0; c.restore();
  }

  // Window slits
  windowSlit(c,0,-h*.4,5*s,9*s,'#79b7ff',flicker);
  if (level>=2) { windowSlit(c,0,-h*.62,5*s,8*s,'#9ad4ff',flicker); }

  // Lv3: beam of light upward
  if (level >= 3) {
    c.save(); c.globalAlpha=.18;
    const bgrad=linGrad(c,0,-h-20*s,0,-h-80*s,[[0,'#79b7ff'],[1,'rgba(121,183,255,0)']]);
    c.fillStyle=bgrad;
    c.fillRect(-3*s,-h-80*s,6*s,60*s);
    c.restore();
  }

  if (sel) { c.save(); c.shadowColor='#79b7ff'; c.shadowBlur=16*s; c.strokeStyle='#79b7ff'; c.lineWidth=2*s; c.strokeRect(-w*.4,-h-4*s,w*.8,h+6*s); c.restore(); }
}

// ── 12. PIÈGE MAUDIT (cursedTrap) ────────────────────────────────────────────
export function drawCursedTrap(c, s, level, t, flicker, sel) {
  const w=20*s, h=12*s;
  shadow(c, w*.4, 6*s);

  // Ground plate
  c.fillStyle='#2a1a1e'; c.strokeStyle=P.black; c.lineWidth=1.5;
  c.beginPath(); c.ellipse(0,0,w*.4,w*.16,0,0,Math.PI*2); c.fill(); c.stroke();

  // Rune on plate
  const alpha=.3+flicker*.25;
  c.save(); c.globalAlpha=alpha; c.fillStyle=P.blood;
  c.textAlign='center'; c.textBaseline='middle';
  c.font=`${10*s}px serif`; c.fillText('ᛝ',0,-2*s);
  c.restore();

  // Spikes (retracted at Lv1, partially out at Lv2, fully up at Lv3)
  const spikeH = (4+level*3.5)*s;
  const nSpikes = 2+level;
  c.fillStyle='#8a7060'; c.strokeStyle=P.black; c.lineWidth=1;
  for (let i=0;i<nSpikes;i++) {
    const sx=-w*.3+i*(w*.6/(nSpikes-1||1));
    const bob=Math.sin(t*1.4+i*.8)*1.5*s*(level>=3?.6:0);
    poly(c,[sx-2*s,0, sx,-(spikeH+bob), sx+2*s,0]);
    c.fill(); c.stroke();
  }

  // Glow
  c.save(); c.shadowColor=P.blood; c.shadowBlur=(4+flicker*6)*s;
  c.beginPath(); c.ellipse(0,-2*s,w*.22,3*s,0,0,Math.PI*2);
  c.fillStyle=`rgba(216,72,88,${.08+flicker*.08})`; c.fill();
  c.shadowBlur=0; c.restore();

  if (sel) { c.save(); c.shadowColor=P.blood; c.shadowBlur=12*s; c.strokeStyle=P.blood; c.lineWidth=1.5*s; c.strokeRect(-w*.45,-h-2*s,w*.9,h+4*s); c.restore(); }
}

// ── 13. REMPART D'OSSEMENTS (wall) ───────────────────────────────────────────
export function drawWall(c, s, level, t, flicker, sel, neighbours={n:false,e:false,s:false,w:false}) {
  const w=32*s, h=(18+level*4)*s;
  shadow(c, w*.42, 7*s);

  // Wall body height grows with level
  const bodyH=h;
  c.fillStyle=`hsl(270,${12+level*4}%,${20+level*3}%)`;
  c.strokeStyle=P.black; c.lineWidth=2;
  c.fillRect(-w/2,-bodyH,w,bodyH); c.strokeRect(-w/2,-bodyH,w,bodyH);
  mortarLines(c, w, bodyH, 2+level);

  // Crenellations — more elaborate per level
  const nCren=2+level;
  const cw2=w/nCren, ch2=(6+level*2)*s;
  for (let i=0;i<nCren;i+=2) {
    c.fillStyle=`hsl(270,${14+level*5}%,${24+level*4}%)`;
    c.strokeStyle=P.black; c.lineWidth=1.5;
    c.fillRect(-w/2+i*cw2,-bodyH-ch2,cw2,ch2); c.strokeRect(-w/2+i*cw2,-bodyH-ch2,cw2,ch2);
  }

  // Skull ornament (Lv2+)
  if (level >= 2) {
    c.fillStyle=P.bone; c.textAlign='center'; c.textBaseline='middle';
    c.font=`${Math.max(7,8*s)}px serif`; c.globalAlpha=.6; c.fillText('☠',0,-bodyH*.55); c.globalAlpha=1;
  }

  // Blood rune (Lv3)
  if (level >= 3) {
    c.save(); c.globalAlpha=.3+flicker*.25; c.fillStyle=P.blood;
    c.textAlign='center'; c.textBaseline='middle';
    c.font=`${Math.max(6,7*s)}px serif`; c.fillText('ᚻ',0,-bodyH*.25); c.restore();
  }

  if (sel) { c.save(); c.shadowColor='#887796'; c.shadowBlur=12*s; c.strokeStyle='#887796'; c.lineWidth=1.5*s; c.strokeRect(-w*.52,-bodyH-ch2-2*s,w*1.04,bodyH+ch2+4*s); c.restore(); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dispatch table
// ─────────────────────────────────────────────────────────────────────────────
export const DRAW_FN = {
  townHall:     drawTownHall,
  goldMine:     drawGoldMine,
  lumberMill:   drawLumberMill,
  essenceWell:  drawEssenceWell,
  soulVault:    drawSoulVault,
  barracks:     drawBarracks,
  campfire:     drawCampfire,
  clanCastle:   drawClanCastle,
  runeTower:    drawRuneTower,
  boneCatapult: drawBoneCatapult,
  soulSpire:    drawSoulSpire,
  cursedTrap:   drawCursedTrap,
  wall:         drawWall,
};
