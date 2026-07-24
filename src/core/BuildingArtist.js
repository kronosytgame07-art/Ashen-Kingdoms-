/**
 * BuildingArtist.js  — Ashen Kingdoms
 * Taille de chaque bâtiment = multiple de tileW (88*zoom).
 * Chaque draw_fn reçoit :
 *   c       CanvasRenderingContext2D (origin = ancre bas-centre du bâtiment)
 *   tileW   largeur d'une tuile en pixels écran (88 * camera.zoom)
 *   tileH   hauteur d'une tuile en pixels écran (44 * camera.zoom)
 *   sw, sh  empreinte en tuiles (size.w, size.h)
 *   level   1 | 2 | 3
 *   t       secondes continues
 *   flicker sin pulsé 0..1 par bâtiment
 *   sel     boolean sélectionné
 */

// ── Palette ────────────────────────────────────────────────────────────────
const P = {
  black:  '#07050d',
  stone0: '#1e1828', stone1: '#2a2236', stone2: '#3a3050', stone3: '#4e4268',
  glow:   '#b87cff', glowDim:'#7c3fcf',
  amber:  '#e8a630', amberDim:'#a07020',
  green:  '#62dca0',
  blood:  '#d84858',
  blue:   '#58b8ff',
  white:  '#f0eaf8',
  bone:   '#c8b898',
  wood:   '#8a5a30',
  gold:   '#f0c458',
  lava:   '#e03810',
};

// ── Primitives ──────────────────────────────────────────────────────────────
function rrect(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function poly(c,...pts){c.beginPath();c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);c.closePath();}
function linGrad(c,x0,y0,x1,y1,stops){const g=c.createLinearGradient(x0,y0,x1,y1);stops.forEach(([p,col])=>g.addColorStop(p,col));return g;}
function glowFill(c,col,blur){c.shadowColor=col;c.shadowBlur=blur;}
function noGlow(c){c.shadowBlur=0;}

/** Ombre portée sous un bâtiment */
function dropShadow(c,w,h){c.save();c.globalAlpha=.4;c.fillStyle='#000';c.beginPath();c.ellipse(0,4,w*.54,h*.18,0,0,Math.PI*2);c.fill();c.restore();}

/** Corps de tour */
function towerBody(c,w,h,top,bot){
  const g=linGrad(c,-w/2,-h,w/2,0,[[0,top],[1,bot]]);
  c.fillStyle=g;c.strokeStyle=P.black;c.lineWidth=2;
  c.fillRect(-w/2,-h,w,h);c.strokeRect(-w/2,-h,w,h);
  // joints horizontaux
  c.save();c.globalAlpha=.18;c.strokeStyle='#000';c.lineWidth=.8;
  for(let i=1;i<4;i++){c.beginPath();c.moveTo(-w/2,-h*i/4);c.lineTo(w/2,-h*i/4);c.stroke();}
  c.restore();
}

/** Créneaux sur le haut d'un corps de tour */
function battlements(c,w,topY,crenW,crenH,col){
  const n=Math.max(2,Math.round(w/crenW));
  const step=w/n;
  c.fillStyle=col;c.strokeStyle=P.black;c.lineWidth=1.2;
  for(let i=0;i<n;i+=2){c.fillRect(-w/2+i*step,topY-crenH,step,crenH);c.strokeRect(-w/2+i*step,topY-crenH,step,crenH);}
}

/** Flèche/spire pointue */
function spire(c,bw,baseY,tip,fill,stroke='#07050d'){
  poly(c,-bw/2,baseY,0,tip,bw/2,baseY);
  c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=1.8;c.stroke();
}

/** Torche animée */
function torch(c,x,y,sz,f,col=P.amber){
  c.save();
  glowFill(c,col,(8+f*10)*sz);
  c.fillStyle=col;
  c.beginPath();c.ellipse(x,y-(3+f*2)*sz,2.2*sz,(5+f*3)*sz,0,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(255,255,200,.5)';
  c.beginPath();c.ellipse(x,y-(4+f*2)*sz,1*sz,(2.5+f)*sz,0,0,Math.PI*2);c.fill();
  noGlow(c);c.restore();
}

/** Fenêtre-fente lumineuse */
function windowSlit(c,cx,cy,sw,sh,col,f){
  c.save();glowFill(c,col,6+f*8);
  rrect(c,cx-sw/2,cy-sh/2,sw,sh,sw*.4);
  c.fillStyle=col;c.fill();noGlow(c);c.restore();
}

/** Orbe lumineux */
function orb(c,x,y,r,col,blur){
  c.save();glowFill(c,col,blur);
  c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();noGlow(c);c.restore();
}

/** Sélection outline */
function selBox(c,w,h,col){
  c.save();glowFill(c,col,18);c.strokeStyle=col;c.lineWidth=2.2;
  c.setLineDash([5,3]);c.strokeRect(-w/2-3,-h-3,w+6,h+6);c.setLineDash([]);noGlow(c);c.restore();
}

// ── Dispatch ────────────────────────────────────────────────────────────────
export const DRAW_FN = {};

// ============================================================
// 1. TRÔNE CORROMPU   (4×4 tuiles)
// ============================================================
DRAW_FN.townHall = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.9,  H=tileH*sh*1.8*(1+level*.08);
  dropShadow(c,W,tileH*sh*.5);

  // Corps central
  const kw=W*.52,kh=H*.75;
  towerBody(c,kw,kh,'#3e2a52','#221836');

  // Tours latérales
  const tw=W*.22, th=H*.60;
  for(const sx of[-1,1]){
    c.save();c.translate(sx*W*.34,0);
    towerBody(c,tw,th,'#312040','#1a1228');
    battlements(c,tw,-th,tw*.48,tileH*.25,'#3e2850');
    if(level>=2) windowSlit(c,0,-th*.55,tileW*.07,tileH*.35,'#aa60ff',f);
    c.restore();
  }

  // Créneaux keep
  battlements(c,kw,-kh,kw*.35,tileH*.3,'#502e68');

  // Spire centrale
  c.save();glowFill(c,'#d07aff',(14+f*12));
  spire(c,kw*.55,-kh,-H-tileH*.4,'#5a2878');
  noGlow(c);c.restore();
  orb(c,0,-H-tileH*.38,tileW*.06,'#d07aff',(16+f*14));

  // Level 2 : spires secondaires
  if(level>=2)for(const sx of[-1,1]){
    c.save();c.translate(sx*W*.34,0);
    c.save();glowFill(c,'#aa60ff',8);spire(c,tw*.5,-th,-th-tileH*.25,'#3a1e5a');noGlow(c);c.restore();
    c.restore();
  }

  // Level 3 : couronne d'orbes
  if(level>=3)for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2+t*.6;
    orb(c,kw*.4*Math.cos(a),-kh*1.05+kw*.15*Math.sin(a),tileW*.04,'#e0b0ff',(10+f*8));
  }

  // Torches
  torch(c,-kw*.4,-kh*.4,tileW*.07,f);
  torch(c, kw*.4,-kh*.4,tileW*.07,f);
  if(level>=2){torch(c,-W*.45,-th*.45,tileW*.06,f);torch(c,W*.45,-th*.45,tileW*.06,f);}

  // Fenêtre centrale
  windowSlit(c,0,-kh*.55,tileW*.10,tileH*.5,'#d07aff',f);
  if(level>=3) windowSlit(c,0,-kh*.82,tileW*.10,tileH*.22,'#e0b0ff',f);

  // Bannière
  const bh=tileH*(.8+level*.1);
  poly(c,-tileW*.11,-kh*.8, tileW*.11,-kh*.8, tileW*.11,-kh*.8+bh*.85, 0,-kh*.8+bh, -tileW*.11,-kh*.8+bh*.85);
  c.fillStyle='#5a1888';c.fill();c.strokeStyle=P.black;c.lineWidth=1.5;c.stroke();
  c.save();c.fillStyle='#e0b0ff';c.textAlign='center';c.textBaseline='middle';
  c.font=`${tileW*.18}px serif`;c.globalAlpha=.75;c.fillText('᛭',0,-kh*.8+bh*.46);c.restore();

  if(sel)selBox(c,W,H,'#d07aff');
};

// ============================================================
// 2. MINE D'OR CORROMPU   (2×2)
// ============================================================
DRAW_FN.goldMine = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.85, H=tileH*sh*1.6;
  dropShadow(c,W,tileH*sh*.4);

  // Portique bois
  c.strokeStyle=P.wood;c.lineWidth=tileW*.06;
  c.beginPath();c.moveTo(-W*.38,-H*.72);c.lineTo(0,-H);c.lineTo(W*.38,-H*.72);c.stroke();
  c.beginPath();c.moveTo(-W*.28,-H*.52);c.lineTo(W*.28,-H*.52);c.stroke();

  // Arcade pierre
  towerBody(c,W*.76,H*.68,'#2e2218','#1a140e');
  // Ouverture
  c.fillStyle='rgba(0,0,0,.85)';
  rrect(c,-W*.22,-H*.62,W*.44,H*.55,tileW*.06);c.fill();

  // Veine or
  c.save();glowFill(c,P.gold,(7+f*9));
  c.fillStyle=`rgba(240,196,88,${.22+f*.18})`;
  rrect(c,-W*.22,-H*.62,W*.44,H*.55,tileW*.06);c.fill();noGlow(c);c.restore();

  // Chariot (Lv2+)
  if(level>=2){
    c.save();c.translate(-tileW*.04,-tileH*.1);
    const cw=tileW*.22,ch=tileH*.28;
    c.fillStyle='#5a4030';c.strokeStyle=P.black;c.lineWidth=1.5;
    c.fillRect(-cw/2,-ch,cw,ch);c.strokeRect(-cw/2,-ch,cw,ch);
    for(let i=0;i<3;i++){c.fillStyle=P.gold;c.beginPath();c.arc((-cw*.35+i*cw*.35),-ch*.5,tileW*.04,0,Math.PI*2);c.fill();}
    for(const wx of[-cw*.35,cw*.35]){c.fillStyle=P.wood;c.beginPath();c.arc(wx,0,tileW*.06,0,Math.PI*2);c.fill();c.strokeStyle=P.black;c.lineWidth=1;c.stroke();}
    c.restore();
  }
  // Pièce flottante (Lv3)
  if(level>=3){const bob=Math.sin(t*2.1)*tileH*.12;orb(c,W*.36,-H*.82+bob,tileW*.07,P.gold,(9+f*7));}

  if(sel)selBox(c,W,H,P.gold);
};

// ============================================================
// 3. SCIERIE MAUDITE   (2×2)
// ============================================================
DRAW_FN.lumberMill = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.88, H=tileH*sh*1.5;
  dropShadow(c,W,tileH*sh*.4);

  // Pile de rondins
  for(let i=0;i<3;i++){
    c.fillStyle=`hsl(25,${40+i*8}%,${22+i*5}%)`;c.strokeStyle=P.black;c.lineWidth=1.2;
    c.beginPath();c.ellipse(-W*.15+(i-1)*W*.18,-tileH*.15-i*tileH*.22,W*.19,tileH*.18,.15*(i-1),0,Math.PI*2);c.fill();c.stroke();
  }

  // Cabanon
  towerBody(c,W*.86,H*.52,'#342818','#1e180e');

  // Toit incliné
  poly(c,-W*.46,-H*.52, 0,-H, W*.46,-H*.52);
  c.fillStyle='#3a2c1e';c.fill();c.strokeStyle=P.black;c.lineWidth=1.8;c.stroke();
  c.save();c.globalAlpha=.14;c.strokeStyle='#000';c.lineWidth=.7;
  for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*W*.13,-H*.52);c.lineTo(i*W*.09,-H);c.stroke();}c.restore();

  // Lame de scie tournante (Lv2+)
  if(level>=2){
    const a=t*(level>=3?2.8:1.8);
    const r=tileW*.18;
    c.save();c.translate(W*.3,-H*.4);c.rotate(a);
    c.fillStyle='#909090';c.strokeStyle=P.black;c.lineWidth=.8;
    c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.stroke();
    for(let i=0;i<10;i++){const a2=i/10*Math.PI*2;poly(c,Math.cos(a2)*r*.85,Math.sin(a2)*r*.85,Math.cos(a2+.26)*r*1.28,Math.sin(a2+.26)*r*1.28,Math.cos(a2+.12)*r*.85,Math.sin(a2+.12)*r*.85);c.fillStyle='#aaa';c.fill();}
    c.restore();
  }

  // Fumée maléfique (Lv3)
  if(level>=3){c.save();c.globalAlpha=.28;
    for(let i=0;i<3;i++){const bob2=Math.sin(t*1.4+i*1.2)*tileH*.15;
      c.fillStyle='rgba(140,100,200,.5)';
      c.beginPath();c.arc(-W*.06+(i-1)*W*.14,-H-tileH*.2+bob2,(tileW*.07+i*tileW*.04),0,Math.PI*2);c.fill();
    }c.restore();
  }
  if(sel)selBox(c,W,H,'#bc8a50');
};

// ============================================================
// 4. PUITS D'ÂMES   (2×2)
// ============================================================
DRAW_FN.essenceWell = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.8, H=tileH*sh*1.7;
  dropShadow(c,W,tileH*sh*.35);

  // Margelle cylindrique
  c.fillStyle=P.stone1;c.strokeStyle=P.black;c.lineWidth=1.8;
  c.beginPath();c.ellipse(0,-tileH*sh*.28,W*.42,W*.17,0,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle='rgba(0,0,0,.88)';
  c.beginPath();c.ellipse(0,-tileH*sh*.28,W*.25,W*.10,0,0,Math.PI*2);c.fill();

  // Corps de puits
  towerBody(c,W*.84,tileH*sh*.3,'#2a1e30','#16121c');

  // Cadre bois
  c.strokeStyle='#7a5030';c.lineWidth=tileW*.055;
  c.beginPath();c.moveTo(-W*.38,-tileH*sh*.28);c.lineTo(-W*.34,-H);c.stroke();
  c.beginPath();c.moveTo( W*.38,-tileH*sh*.28);c.lineTo( W*.34,-H);c.stroke();
  c.strokeStyle='#5a3820';c.lineWidth=tileW*.07;
  c.beginPath();c.moveTo(-W*.38,-H);c.lineTo(W*.38,-H);c.stroke();

  // Brume d'âmes
  for(let i=0;i<4;i++){
    const phase=t*1.2+i*1.5;const rise=(phase%3)/3;
    c.save();c.globalAlpha=.32-rise*.28;
    c.fillStyle=i%2?'#b870ff':'#7840df';
    c.beginPath();c.arc(Math.sin(phase*2.1+i)*tileW*.08,-tileH*sh*.28-rise*H*.65,(tileW*.06+i*tileW*.03+rise*tileW*.08),0,Math.PI*2);c.fill();
    c.restore();
  }

  // Seau (Lv2+)
  if(level>=2){const bob=Math.sin(t*1.8)*tileH*.12;
    c.save();c.translate(0,-H*.5+bob);
    rrect(c,-tileW*.08,-tileH*.15,tileW*.16,tileH*.18,tileW*.03);c.fillStyle='#5a4030';c.fill();c.strokeStyle=P.black;c.lineWidth=1.2;c.stroke();
    orb(c,0,-tileH*.06,tileW*.05,'#b870ff',(7+f*5));c.restore();
  }

  // Orbes orbitaux (Lv3)
  if(level>=3){const a=t*1.2;const rx=W*.38,ry=W*.15;
    orb(c,rx*Math.cos(a),-H*.4+ry*Math.sin(a),tileW*.045,'#e0b0ff',(9+f*7));
    orb(c,rx*Math.cos(a+Math.PI),-H*.4+ry*Math.sin(a+Math.PI),tileW*.045,'#b060ff',(7+f*5));
  }
  if(sel)selBox(c,W,H,'#b982ff');
};

// ============================================================
// 5. CAVEAU D'ÂMES   (2×2)
// ============================================================
DRAW_FN.soulVault = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.9, H=tileH*sh*1.75;
  dropShadow(c,W,tileH*sh*.4);

  towerBody(c,W*.86,H*.68,'#2c2240','#18152a');

  // Arche de porte
  const dw=W*.38,dh=H*.42;
  c.fillStyle='rgba(0,0,0,.88)';
  c.beginPath();c.moveTo(-dw/2,0);c.lineTo(-dw/2,-dh*.62);
  c.arc(0,-dh*.62,dw/2,Math.PI,0);c.lineTo(dw/2,0);c.closePath();c.fill();
  c.strokeStyle='#5a4870';c.lineWidth=tileW*.04;c.stroke();

  // Halo intérieur
  c.save();glowFill(c,'#8b62cf',(11+f*13));
  c.fillStyle=`rgba(139,98,207,${.16+f*.12})`;
  c.beginPath();c.arc(0,-H*.36,W*.18,0,Math.PI*2);c.fill();noGlow(c);c.restore();

  // Toit en gradins
  const steps=1+level;
  for(let i=0;i<steps;i++){
    const bw2=W*.86*(1-i/(steps+1)),topY=-H*.68-i*tileH*.2;
    c.fillStyle=`hsl(265,${28+i*8}%,${17+i*5}%)`;c.strokeStyle=P.black;c.lineWidth=1.2;
    c.fillRect(-bw2/2,topY-tileH*.16,bw2,tileH*.16);c.strokeRect(-bw2/2,topY-tileH*.16,bw2,tileH*.16);
  }
  orb(c,0,-H*.68-steps*tileH*.2-tileH*.1,(3+level)*tileW*.03,'#8b62cf',(12+f*11));

  if(level>=2){
    c.save();c.globalAlpha=.45;c.strokeStyle='#5a4870';c.lineWidth=tileW*.022;
    for(let i=0;i<5;i++){const y=-H*.56+i*tileH*.22;const ox=W*.46+Math.sin(t*.8+i)*.4;c.beginPath();c.arc(ox,y,tileW*.025,0,Math.PI*2);c.stroke();c.beginPath();c.arc(-ox,y,tileW*.025,0,Math.PI*2);c.stroke();}
    c.restore();
  }
  if(sel)selBox(c,W,H,'#8b62cf');
};

// ============================================================
// 6. CASERNE MAUDITE   (2×2)
// ============================================================
DRAW_FN.barracks = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.9, H=tileH*sh*1.65;
  dropShadow(c,W,tileH*sh*.4);

  towerBody(c,W*.88,H*.65,'#3a2828','#221818');
  battlements(c,W*.88,-H*.65,W*.16,tileH*.28,'#482e2e');

  for(const sx of[-1,1]){
    c.save();c.translate(sx*W*.35,0);
    towerBody(c,W*.22,H*.52,'#402a2a','#281818');
    battlements(c,W*.22,-H*.52,W*.10,tileH*.22,'#502e2e');
    c.restore();
  }

  // Portail en arc
  c.fillStyle='rgba(0,0,0,.9)';
  c.beginPath();c.arc(0,0,W*.19,Math.PI,0);c.lineTo(W*.19,0);c.lineTo(-W*.19,0);c.closePath();c.fill();
  c.strokeStyle='#6a3030';c.lineWidth=tileW*.035;c.stroke();
  c.save();glowFill(c,P.blood,(7+f*9));
  c.fillStyle=`rgba(216,72,88,${.12+f*.1})`;
  c.beginPath();c.arc(0,-tileH*.1,W*.13,0,Math.PI*2);c.fill();noGlow(c);c.restore();

  if(level>=2){c.fillStyle=P.bone;c.textAlign='center';c.textBaseline='middle';
    c.font=`${tileW*.22}px serif`;c.fillText('☠',0,-tileH*.15);}

  if(level>=3){c.save();c.globalAlpha=.6;c.fillStyle='#c03040';
    for(let i=0;i<4;i++){const drip=(t*22+i*14)%(H*.62);c.beginPath();c.arc((-W*.28+i*W*.18),-H*.65+drip,tileW*.025,0,Math.PI*2);c.fill();}c.restore();}

  torch(c,-W*.48,-H*.38,tileW*.07,f,P.blood);
  torch(c, W*.48,-H*.38,tileW*.07,f,P.blood);
  windowSlit(c,0,-H*.52,tileW*.1,tileH*.38,P.blood,f);
  if(sel)selBox(c,W,H,P.blood);
};

// ============================================================
// 7. BRASIER RITUEL   (2×2)
// ============================================================
DRAW_FN.campfire = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.8, H=tileH*sh*1.4;
  dropShadow(c,W,tileH*sh*.35);

  // Cercle de pierres
  c.fillStyle=P.stone1;c.strokeStyle=P.black;c.lineWidth=1.6;
  c.beginPath();c.ellipse(0,-tileH*.12,W*.44,W*.18,0,0,Math.PI*2);c.fill();c.stroke();

  // Bûches
  c.strokeStyle='#6a3818';c.lineWidth=tileW*.08;
  [-.45,.45,Math.PI/2].forEach(a=>{
    c.beginPath();c.moveTo(Math.cos(a)*W*.28,-tileH*.12+Math.sin(a)*W*.11);
    c.lineTo(-Math.cos(a)*W*.28,-tileH*.12-Math.sin(a)*W*.11);c.stroke();
  });

  // Flammes multi-couches
  const layers=[
    {fw:W*.18,fh:H*.5,col:'#e03010',a:.7},
    {fw:W*.13,fh:H*.64,col:'#f07820',a:.82},
    {fw:W*.09,fh:H*.72,col:'#f8c040',a:.9},
    {fw:W*.05,fh:H*.62,col:'#ffffc0',a:.96},
  ];
  layers.forEach(({fw,fh,col,a})=>{
    const sw2=Math.sin(t*3.2+(a*10))*tileW*.04;
    c.save();c.globalAlpha=a;glowFill(c,col,(9+f*11));
    c.fillStyle=col;
    c.beginPath();c.moveTo(-fw/2+sw2,-tileH*.12);
    c.bezierCurveTo(-fw/2+sw2,-tileH*.12-fh*.4,sw2-fw*.3,-tileH*.12-fh*.8,sw2,-tileH*.12-fh);
    c.bezierCurveTo(sw2+fw*.3,-tileH*.12-fh*.8,fw/2+sw2,-tileH*.12-fh*.4,fw/2+sw2,-tileH*.12);
    c.closePath();c.fill();noGlow(c);c.restore();
  });

  if(level>=2)for(let i=0;i<2;i++){
    const ox=(i*2-1)*W*.28,ff=Math.sin(t*2.8+i*2)*.5+.5;
    c.save();c.globalAlpha=.7;glowFill(c,'#f07820',(7+ff*7));
    c.fillStyle='#f07820';
    c.beginPath();c.ellipse(ox,-tileH*.12-(tileH*.25+ff*tileH*.22),(tileW*.05+ff*tileW*.025),(tileH*.22+ff*tileH*.11),0,0,Math.PI*2);c.fill();noGlow(c);c.restore();
  }

  if(level>=3){c.textAlign='center';c.textBaseline='middle';c.font=`${tileW*.14}px serif`;
    for(let i=0;i<3;i++){const a2=t*1.8+i*2.1;c.save();c.globalAlpha=.42+Math.sin(a2)*.18;
      c.fillText('💀',Math.cos(a2)*tileW*.18,-H*.5+Math.sin(a2)*tileH*.1);c.restore();}}

  if(sel)selBox(c,W,H,P.green);
};

// ============================================================
// 8. CHÂTEAU DE CLAN   (3×3)
// ============================================================
DRAW_FN.clanCastle = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.9, H=tileH*sh*1.9;
  dropShadow(c,W,tileH*sh*.5);

  // Courtine basse
  c.fillStyle=P.stone1;c.strokeStyle=P.black;c.lineWidth=1.8;
  c.fillRect(-W*.5,-tileH*.2,W,tileH*.22);c.strokeRect(-W*.5,-tileH*.2,W,tileH*.22);

  // Tours latérales
  for(const sx of[-1,1]){
    c.save();c.translate(sx*W*.34,0);
    towerBody(c,W*.24,H*.58,'#362844','#221a30');
    battlements(c,W*.24,-H*.58,W*.11,tileH*.22,'#402e52');
    windowSlit(c,0,-H*.36,tileW*.07,tileH*.3,'#c080f0',f);
    c.restore();
  }

  // Tour centrale
  towerBody(c,W*.36,H*.78,'#3e2c52','#261e38');
  battlements(c,W*.36,-H*.78,W*.13,tileH*.28,'#4e3862');

  // Herse
  c.fillStyle='rgba(0,0,0,.86)';
  c.beginPath();c.arc(0,0,W*.14,Math.PI,0);c.lineTo(W*.14,0);c.lineTo(-W*.14,0);c.closePath();c.fill();
  c.save();c.globalAlpha=.5;c.strokeStyle='#6a5080';c.lineWidth=tileW*.022;
  for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*W*.048,0);c.lineTo(i*W*.048,-W*.14);c.stroke();}c.restore();

  // Bannière
  const bh=tileH*(1+level*.12);
  poly(c,-tileW*.13,-H*.74, tileW*.13,-H*.74, tileW*.13,-H*.74+bh*.82, 0,-H*.74+bh, -tileW*.13,-H*.74+bh*.82);
  c.fillStyle='#60209a';c.fill();c.strokeStyle=P.black;c.lineWidth=1.5;c.stroke();
  c.save();c.fillStyle='#e0b0ff';c.textAlign='center';c.textBaseline='middle';
  c.font=`${tileW*.15}px serif`;c.globalAlpha=.75;c.fillText('᛭',0,-H*.74+bh*.46);c.restore();

  // Spire
  c.save();glowFill(c,'#d3a6ff',(13+f*11));spire(c,W*.28,-H*.78,-H-tileH*.4,'#3a1a60');noGlow(c);c.restore();
  orb(c,0,-H-tileH*.38,tileW*.055,'#d3a6ff',(14+f*11));

  if(level>=2)for(const sx of[-1,1]){
    c.save();c.translate(sx*W*.34,0);
    c.save();glowFill(c,'#b080e0',7);spire(c,W*.2,-H*.58,-H*.58-tileH*.22,'#2a1848');noGlow(c);c.restore();
    c.restore();
  }

  if(level>=3)for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2+t*.4;
    orb(c,W*.26*Math.cos(a),-H-tileH*.06+W*.1*Math.sin(a),tileW*.035,'#d3a6ff',(9+f*7));
  }

  torch(c,-W*.52,-H*.32,tileW*.075,f,'#c080f0');
  torch(c, W*.52,-H*.32,tileW*.075,f,'#c080f0');
  if(sel)selBox(c,W,H,'#d3a6ff');
};

// ============================================================
// 9. TOUR RUNIQUE   (1×1)
// ============================================================
DRAW_FN.runeTower = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.8, H=tileH*sh*3.2;
  dropShadow(c,W,tileH*sh*.4);

  // Socle octogonal
  const nb=8,rb=W*.52;
  c.beginPath();
  for(let i=0;i<nb;i++){const a=i/nb*Math.PI*2;i===0?c.moveTo(rb*Math.cos(a),rb*Math.sin(a)*.4+tileH*.06):c.lineTo(rb*Math.cos(a),rb*Math.sin(a)*.4+tileH*.06);}
  c.closePath();c.fillStyle=P.stone2;c.fill();c.strokeStyle=P.black;c.lineWidth=1.6;c.stroke();

  // Corps
  towerBody(c,W*.68,H*.76,'#262038','#161028');

  // Runes gravées
  c.save();c.globalAlpha=.25+f*.14;c.fillStyle='#c070ff';c.textAlign='center';c.textBaseline='middle';
  c.font=`${tileW*.18}px serif`;
  ['ᚱ','ᚢ','ᚾ','ᚦ'].forEach((r,i)=>c.fillText(r,0,-H*.22-i*H*.14));
  c.restore();

  // Créneaux
  battlements(c,W*.68,-H*.76,W*.3,tileH*.25,'#302648');

  // Anneau d'orbes rotatif
  for(let i=0;i<(3+level);i++){
    const a=i/(3+level)*Math.PI*2+t*.8;
    c.save();glowFill(c,'#c070ff',(7+f*7));
    c.fillStyle='#c070ff';
    c.beginPath();c.arc(W*.3*Math.cos(a),-H*.78+W*.12*Math.sin(a),(2.2+level*.4)*tileW*.022,0,Math.PI*2);c.fill();
    noGlow(c);c.restore();
  }
  orb(c,0,-H*.82,(5+level)*tileW*.028,'#c870ff',(14+f*16));

  if(level>=2)for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2-t*.6;
    orb(c,W*.22*Math.cos(a),-H*.96+W*.08*Math.sin(a),tileW*.018,'#9040d0',(5+f*4));
  }

  if(level>=3&&Math.sin(t*4)>.7){
    c.save();c.globalAlpha=.55;c.strokeStyle='#e0b0ff';c.lineWidth=tileW*.02;
    for(let i=0;i<3;i++){const a=i/3*Math.PI*2+t*2;
      c.beginPath();c.moveTo(0,-H*.82);c.lineTo(Math.cos(a)*W*.62,-H*.82+Math.sin(a)*W*.3);c.stroke();}c.restore();
  }

  windowSlit(c,0,-H*.5,tileW*.07,tileH*.28,'#c870ff',f);
  if(sel)selBox(c,W,H,'#c870ff');
};

// ============================================================
// 10. CATAPULTE D'OSSEMENTS   (2×2)
// ============================================================
DRAW_FN.boneCatapult = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.9, H=tileH*sh*1.6;
  dropShadow(c,W,tileH*sh*.4);

  // Plateforme
  c.fillStyle='#3e2e20';c.strokeStyle=P.black;c.lineWidth=1.8;
  c.fillRect(-W*.48,-tileH*.15,W*.96,tileH*.16);c.strokeRect(-W*.48,-tileH*.15,W*.96,tileH*.16);

  // Roues
  for(const wx of[-W*.3,W*.3]){
    c.fillStyle='#5a3a20';c.beginPath();c.arc(wx,0,tileW*.12,0,Math.PI*2);c.fill();
    c.strokeStyle=P.black;c.lineWidth=1.4;c.stroke();
    c.fillStyle='#3a2010';c.beginPath();c.arc(wx,0,tileW*.06,0,Math.PI*2);c.fill();
    c.strokeStyle='#8a6040';c.lineWidth=tileW*.022;
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2+t*.3;c.beginPath();c.moveTo(wx,0);c.lineTo(wx+Math.cos(a)*tileW*.11,Math.sin(a)*tileW*.11);c.stroke();}
  }

  // Châssis
  c.strokeStyle='#7a5030';c.lineWidth=tileW*.07;
  c.beginPath();c.moveTo(-W*.22,-tileH*.14);c.lineTo(-W*.18,-H*.58);c.stroke();
  c.beginPath();c.moveTo( W*.22,-tileH*.14);c.lineTo( W*.18,-H*.58);c.stroke();
  c.beginPath();c.moveTo(-W*.2,-H*.58);c.lineTo(W*.2,-H*.58);c.stroke();

  // Bras pivotant
  const armA=-Math.PI*.5+Math.sin(t*.9)*(level>=2?.28:.18);
  c.save();c.translate(0,-H*.28);c.rotate(armA);
  c.strokeStyle='#8a5028';c.lineWidth=tileW*.07;
  c.beginPath();c.moveTo(0,0);c.lineTo(0,-H*.44);c.stroke();
  // Seau
  c.fillStyle=P.bone;c.strokeStyle=P.black;c.lineWidth=1.3;
  c.beginPath();c.arc(0,-H*.45,tileW*.1,0,Math.PI*2);c.fill();c.stroke();
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2;
    c.fillStyle='#e0d0b0';c.beginPath();c.arc(Math.cos(a)*tileW*.06,-H*.45+Math.sin(a)*tileW*.06,tileW*.028,0,Math.PI*2);c.fill();}
  c.restore();

  if(level>=3) orb(c,0,-H*.58,tileW*.06,'#ff9840',(11+f*9));

  if(sel)selBox(c,W,H,'#d66c5f');
};

// ============================================================
// 11. FLÈCHE DES ÂMES   (1×1)
// ============================================================
DRAW_FN.soulSpire = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.7, H=tileH*sh*3.4;
  dropShadow(c,W,tileH*sh*.35);

  // Corps élancé
  towerBody(c,W*.64,H*.72,'#1e2840','#101830');

  // Contreforts
  for(const sx of[-1,1]){
    c.save();c.translate(sx*W*.32,0);
    c.fillStyle='#181c2c';c.strokeStyle=P.black;c.lineWidth=1.3;
    poly(c,0,0,sx*W*.24,0,sx*W*.08,-H*.22,0,-H*.22);
    c.fill();c.stroke();c.restore();
  }

  // Aiguille
  c.save();glowFill(c,'#79b7ff',(11+f*13));spire(c,W*.52,-H*.72,-H-tileH*.6,'#1a2e50','#79b7ff');noGlow(c);c.restore();
  orb(c,0,-H-tileH*.58,(4+level)*tileW*.028,'#79b7ff',(14+f*14));

  // Wisps orbitaux
  for(let i=0;i<(2+level);i++){
    const a=i/(2+level)*Math.PI*2+t*.7;
    c.save();glowFill(c,'#9ad4ff',(5+f*5));
    c.fillStyle='#9ad4ff';
    c.beginPath();c.arc(W*.44*Math.cos(a),-H*.5+W*.18*Math.sin(a),(1.8+level*.3)*tileW*.022,0,Math.PI*2);c.fill();
    noGlow(c);c.restore();
  }

  windowSlit(c,0,-H*.38,tileW*.07,tileH*.24,'#79b7ff',f);
  if(level>=2) windowSlit(c,0,-H*.6,tileW*.07,tileH*.2,'#9ad4ff',f);

  if(level>=3){
    c.save();c.globalAlpha=.16;
    const bg=c.createLinearGradient(0,-H-tileH*.6,0,-H-tileH*2.5);
    bg.addColorStop(0,'#79b7ff');bg.addColorStop(1,'rgba(121,183,255,0)');
    c.fillStyle=bg;c.fillRect(-tileW*.035,-H-tileH*2.5,tileW*.07,tileH*1.9);
    c.restore();
  }
  if(sel)selBox(c,W,H,'#79b7ff');
};

// ============================================================
// 12. PIÈGE MAUDIT   (1×1)
// ============================================================
DRAW_FN.cursedTrap = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.7, H=tileH*sh*.6;
  dropShadow(c,W,tileH*sh*.2);

  // Plaque
  c.fillStyle='#2a1a1e';c.strokeStyle=P.black;c.lineWidth=1.4;
  c.beginPath();c.ellipse(0,0,W*.42,W*.17,0,0,Math.PI*2);c.fill();c.stroke();

  // Rune
  c.save();c.globalAlpha=.28+f*.24;c.fillStyle=P.blood;c.textAlign='center';c.textBaseline='middle';
  c.font=`${tileW*.2}px serif`;c.fillText('ᛝ',0,-tileH*.04);c.restore();

  // Piques
  const spikeH=(tileH*.12+level*tileH*.12);
  const nSpikes=2+level;
  for(let i=0;i<nSpikes;i++){
    const sx=-W*.32+i*(W*.64/(nSpikes-1||1));
    const bob=Math.sin(t*1.4+i*.8)*tileH*.025*(level>=3?.7:0);
    c.fillStyle='#8a7060';c.strokeStyle=P.black;c.lineWidth=.9;
    poly(c,sx-tileW*.03,0,sx,-spikeH-bob,sx+tileW*.03,0);
    c.fill();c.stroke();
  }

  c.save();glowFill(c,P.blood,(4+f*5));
  c.beginPath();c.ellipse(0,-tileH*.04,W*.22,tileH*.06,0,0,Math.PI*2);
  c.fillStyle=`rgba(216,72,88,${.07+f*.07})`;c.fill();noGlow(c);c.restore();

  if(sel)selBox(c,W,H,P.blood);
};

// ============================================================
// 13. REMPART D'OSSEMENTS   (1×1)
// ============================================================
DRAW_FN.wall = function(c,tileW,tileH,sw,sh,level,t,f,sel){
  const W=tileW*sw*.94, H=tileH*sh*(1+level*.28);
  dropShadow(c,W,tileH*sh*.3);

  c.fillStyle=`hsl(270,${12+level*4}%,${20+level*3}%)`;c.strokeStyle=P.black;c.lineWidth=1.8;
  c.fillRect(-W/2,-H,W,H);c.strokeRect(-W/2,-H,W,H);

  // Joints
  c.save();c.globalAlpha=.16;c.strokeStyle='#000';c.lineWidth=.7;
  for(let i=1;i<3;i++){c.beginPath();c.moveTo(-W/2,-H*i/3);c.lineTo(W/2,-H*i/3);c.stroke();}c.restore();

  // Créneaux
  const n=2+level,cw2=W/n,ch2=tileH*(.18+level*.08);
  for(let i=0;i<n;i+=2){
    c.fillStyle=`hsl(270,${14+level*5}%,${24+level*4}%)`;
    c.strokeStyle=P.black;c.lineWidth=1.3;
    c.fillRect(-W/2+i*cw2,-H-ch2,cw2,ch2);c.strokeRect(-W/2+i*cw2,-H-ch2,cw2,ch2);
  }

  if(level>=2){c.fillStyle=P.bone;c.textAlign='center';c.textBaseline='middle';
    c.font=`${tileW*.2}px serif`;c.globalAlpha=.55;c.fillText('☠',0,-H*.55);c.globalAlpha=1;}
  if(level>=3){c.save();c.globalAlpha=.28+f*.22;c.fillStyle=P.blood;
    c.textAlign='center';c.textBaseline='middle';c.font=`${tileW*.16}px serif`;c.fillText('ᚻ',0,-H*.25);c.restore();}

  if(sel)selBox(c,W,H,'#887796');
};
