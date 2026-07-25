import { VillageRenderer } from './VillageRenderer.js';
import { BUILDINGS } from '../data/buildings.js';

// Le Trône garde une empreinte logique 5×5, mais son corps visuel reste compact.
BUILDINGS.townHall.size = { w: 5, h: 5 };
BUILDINGS.townHall.spriteRender = {
  maxTilesWide: 4.45,
  anchorY: 0.965,
  offsetX: 0,
  offsetY: 0
};

const originalDrawBuilding = VillageRenderer.prototype.drawBuilding;

function drawFlame(ctx, x, y, size, time, phase = 0) {
  const pulse = 0.88 + Math.sin(time * 8 + phase) * 0.12;
  const sway = Math.sin(time * 5.7 + phase * 1.9) * size * 0.18;

  ctx.save();
  ctx.translate(x + sway, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = '#a94cff';
  ctx.shadowBlur = size * (1.5 + pulse);

  ctx.fillStyle = `rgba(151,55,255,${0.72 + pulse * 0.18})`;
  ctx.beginPath();
  ctx.moveTo(0, -size * (2.2 + pulse * 0.35));
  ctx.bezierCurveTo(size * .8, -size * 1.15, size * .72, -size * .25, 0, 0);
  ctx.bezierCurveTo(-size * .72, -size * .25, -size * .8, -size * 1.15, 0, -size * (2.2 + pulse * .35));
  ctx.fill();

  ctx.fillStyle = 'rgba(245,210,255,.88)';
  ctx.beginPath();
  ctx.moveTo(0, -size * (1.45 + pulse * .2));
  ctx.bezierCurveTo(size * .35, -size * .72, size * .25, -size * .2, 0, 0);
  ctx.bezierCurveTo(-size * .25, -size * .2, -size * .35, -size * .72, 0, -size * (1.45 + pulse * .2));
  ctx.fill();
  ctx.restore();
}

function drawSmoke(ctx, x, y, size, time) {
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const cycle = (time * .24 + i * .19) % 1;
    const drift = Math.sin(time * 1.2 + i * 1.7) * size * .75;
    const radius = size * (.42 + cycle * .82);
    ctx.globalAlpha = (1 - cycle) * .24;
    ctx.fillStyle = '#b7a9c2';
    ctx.beginPath();
    ctx.arc(x + drift, y - cycle * size * 7.5, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCrystalPulse(ctx, x, y, size, time) {
  const pulse = .5 + .5 * Math.sin(time * 2.8);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = '#ba63ff';
  ctx.shadowBlur = size * (1.2 + pulse * 1.8);
  ctx.fillStyle = `rgba(190,91,255,${.1 + pulse * .16})`;
  ctx.beginPath();
  ctx.arc(x, y, size * (1.05 + pulse * .22), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBannerMotion(ctx, x, y, width, height, time) {
  const wave = Math.sin(time * 2.1) * width * .08;
  ctx.save();
  ctx.globalAlpha = .38;
  ctx.fillStyle = '#6d1a91';
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.quadraticCurveTo(x + wave, y + height * .35, x + width / 2, y + height * .52);
  ctx.lineTo(x + width * .32, y + height);
  ctx.quadraticCurveTo(x + wave * .35, y + height * .84, x - width * .32, y + height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

VillageRenderer.prototype.drawBuilding = function drawSpriteTownHall(building, state, selected, time, lifted = false) {
  if (building.type !== 'townHall') {
    return originalDrawBuilding.call(this, building, state, selected, time, lifted);
  }

  const image = this.assets.get('townHall');
  if (!image) {
    return originalDrawBuilding.call(this, building, state, selected, time, lifted);
  }

  const def = this.definitions.townHall;
  const cam = state.camera;
  const anc = this.buildingAnchor(building, state);
  const { x, y, tileW, tileH } = anc;
  const ctx = this.ctx;
  const t = time / 1000;
  const underConstruction = building.readyAt > Date.now();
  const render = def.spriteRender ?? {};

  this.footprint(building, cam, selected);

  const targetWidth = tileW * (render.maxTilesWide ?? 4.45);
  const ratio = image.naturalHeight / Math.max(1, image.naturalWidth);
  const targetHeight = targetWidth * ratio;
  const drawX = -targetWidth / 2 + tileW * (render.offsetX ?? 0);
  const drawY = -targetHeight * (render.anchorY ?? .965) + tileH * (render.offsetY ?? 0);
  const liftY = lifted ? tileH * .25 : 0;

  ctx.save();
  ctx.translate(x, y - liftY);
  if (lifted) ctx.scale(1.055, 1.055);
  ctx.globalAlpha = underConstruction ? .55 : 1;

  // Ombre collée au sol, séparée du sprite.
  ctx.save();
  ctx.globalAlpha *= .34;
  ctx.filter = `blur(${Math.max(2, tileH * .08)}px)`;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, -tileH * .28, targetWidth * .37, tileH * .7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, drawX, drawY, targetWidth, targetHeight);

  // Détails animés indépendants : le bâtiment lui-même reste parfaitement fixe.
  const leftTorchX = -targetWidth * .335;
  const rightTorchX = targetWidth * .335;
  const frontTorchX = 0;
  const torchY = -tileH * .62;
  const torchSize = Math.max(3.2, tileH * .15);
  drawFlame(ctx, leftTorchX, torchY - tileH * .52, torchSize, t, .2);
  drawFlame(ctx, rightTorchX, torchY - tileH * .52, torchSize, t, 2.1);
  drawFlame(ctx, frontTorchX, -tileH * .26, torchSize * 1.05, t, 4.3);

  drawSmoke(ctx, targetWidth * .19, drawY + targetHeight * .18, Math.max(3, tileH * .13), t);
  drawCrystalPulse(ctx, 0, drawY + targetHeight * .075, Math.max(7, tileH * .28), t);
  drawBannerMotion(ctx, -targetWidth * .08, drawY + targetHeight * .43, targetWidth * .13, targetHeight * .18, t);

  if (selected || lifted) {
    ctx.save();
    ctx.strokeStyle = lifted ? '#f0dcff' : '#c47aff';
    ctx.lineWidth = Math.max(1.5, cam.zoom * 2);
    ctx.setLineDash([7, 5]);
    ctx.shadowColor = '#b87cff';
    ctx.shadowBlur = 12;
    ctx.strokeRect(drawX + targetWidth * .08, drawY + targetHeight * .05, targetWidth * .84, targetHeight * .89);
    ctx.restore();
  }

  ctx.restore();
};
