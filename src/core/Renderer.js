export class Renderer {
  constructor(canvas, grid, definitions, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = grid;
    this.definitions = definitions;
    this.assets = assets;
    this.spriteFrameCache = new Map();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }

  polygon(points, fill, stroke, width = 1) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => c.lineTo(point.x, point.y));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }

  tile(col, row, camera, fill, stroke = 'rgba(111,91,128,.28)') {
    const point = this.grid.gridToScreen(col, row, camera, this.viewport());
    const halfWidth = this.grid.tileWidth * camera.zoom / 2;
    const halfHeight = this.grid.tileHeight * camera.zoom / 2;
    this.polygon([
      { x: point.x, y: point.y },
      { x: point.x + halfWidth, y: point.y + halfHeight },
      { x: point.x, y: point.y + halfHeight * 2 },
      { x: point.x - halfWidth, y: point.y + halfHeight }
    ], fill, stroke, Math.max(.7, camera.zoom));
  }

  ground(camera, time) {
    const c = this.ctx;
    const viewport = this.viewport();
    const gradient = c.createLinearGradient(0, 0, 0, viewport.height);
    gradient.addColorStop(0, '#2e2638');
    gradient.addColorStop(.55, '#211b29');
    gradient.addColorStop(1, '#110e16');
    c.fillStyle = gradient;
    c.fillRect(0, 0, viewport.width, viewport.height);
    for (let col = 0; col < this.grid.columns; col += 1) {
      for (let row = 0; row < this.grid.rows; row += 1) {
        this.tile(col, row, camera, (col + row) % 2 ? 'rgba(55,49,60,.86)' : 'rgba(47,42,52,.86)');
      }
    }
    c.save();
    c.globalAlpha = .16;
    for (let index = 0; index < 40; index += 1) {
      const x = (index * 191 + time * .008 * (index % 3 + 1)) % viewport.width;
      const y = (index * 83) % viewport.height;
      c.fillStyle = index % 4 ? '#8d789c' : '#bd88ff';
      c.fillRect(x, y, 1.5, 1.5);
    }
    c.restore();
  }

  footprint(building, camera, selected, valid = null) {
    const definition = this.definitions[building.type];
    for (let x = 0; x < definition.size.w; x += 1) {
      for (let y = 0; y < definition.size.h; y += 1) {
        const fill = valid === true ? 'rgba(93,226,154,.30)' : valid === false ? 'rgba(229,68,85,.36)' : selected ? 'rgba(166,108,255,.22)' : 'rgba(5,4,8,.22)';
        const stroke = valid === true ? '#67e7a3' : valid === false ? '#ff6675' : selected ? '#c08cff' : 'rgba(0,0,0,.2)';
        this.tile(building.col + x, building.row + y, camera, fill, stroke);
      }
    }
  }

  buildingAnchor(building, state) {
    const definition = this.definitions[building.type];
    const camera = state.camera;
    const scale = camera.zoom;
    const point = this.grid.gridToScreen(building.col + definition.size.w / 2, building.row + definition.size.h / 2, camera, this.viewport());
    const baseY = point.y + this.grid.tileHeight * definition.size.h * .48 * scale;
    return { x: point.x, y: baseY, scale, definition };
  }

  drawCollectionBubble(building, state, time) {
    const definition = this.definitions[building.type];
    if (!definition?.extractor || building.readyAt > Date.now()) return;
    const stored = building.storedResource ?? 0;
    const threshold = definition.extractor.collectThreshold ?? 1;
    if (stored < threshold) return;
    const capacity = definition.extractor.capacity * (1 + (building.level - 1) * .5);
    const full = stored >= capacity * .98;
    const { x, y, scale } = this.buildingAnchor(building, state);
    const c = this.ctx;
    const bob = Math.sin(time / 260 + building.col) * 4 * scale;
    c.save();
    c.translate(x, y - 92 * scale + bob);
    c.shadowColor = full ? '#ff6878' : definition.colors[2];
    c.shadowBlur = (full ? 18 : 11) * scale;
    c.fillStyle = full ? 'rgba(85,20,30,.96)' : 'rgba(18,13,25,.96)';
    c.strokeStyle = full ? '#ff6878' : definition.colors[2];
    c.lineWidth = Math.max(1.5, 2 * scale);
    c.beginPath();
    c.arc(0, 0, 18 * scale, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = definition.colors[2];
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `800 ${Math.max(12, 15 * scale)}px sans-serif`;
    const icon = definition.extractor.resource === 'gold' ? '●' : definition.extractor.resource === 'wood' ? '◆' : '✦';
    c.fillText(icon, 0, -1 * scale);
    c.fillStyle = '#fff';
    c.font = `800 ${Math.max(8, 9 * scale)}px sans-serif`;
    c.fillText(full ? '!' : Math.floor(stored), 0, 22 * scale);
    c.restore();
  }

  drawCollectionPopups(interaction, state, time) {
    const c = this.ctx;
    for (const popup of interaction.collectionPopups ?? []) {
      const building = state.buildings.find((item) => item.id === popup.buildingId);
      if (!building) continue;
      const age = Math.max(0, time - popup.createdAt);
      const progress = Math.min(1, age / 1200);
      const { x, y, scale } = this.buildingAnchor(building, state);
      c.save();
      c.globalAlpha = 1 - progress;
      c.translate(x, y - 70 * scale - progress * 42 * scale);
      c.fillStyle = popup.resource === 'gold' ? '#f0c45e' : popup.resource === 'wood' ? '#c08b54' : '#c48cff';
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 12 * scale;
      c.textAlign = 'center';
      c.font = `900 ${Math.max(14, 18 * scale)}px sans-serif`;
      c.fillText(`+${popup.amount}`, 0, 0);
      c.restore();
    }
  }

  drawVillageUnit(x, y, type, scale = 1, alpha = 1) {
    const c = this.ctx;
    const radius = type === 'ghoul' ? 6.5 : type === 'necromancer' ? 5.8 : 5.2;
    const fill = type === 'ghoul' ? '#778267' : type === 'necromancer' ? '#a36fe4' : '#d6d0c4';
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    c.beginPath();
    c.ellipse(0, 3 * scale, 7 * scale, 3.2 * scale, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,.34)';
    c.fill();
    c.beginPath();
    c.arc(0, 0, radius * scale, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = '#16111a';
    c.lineWidth = Math.max(1, 1.5 * scale);
    c.stroke();
    if (type === 'necromancer') {
      c.strokeStyle = '#ca9cff';
      c.beginPath();
      c.moveTo(4 * scale, -2 * scale);
      c.lineTo(7 * scale, -10 * scale);
      c.stroke();
    } else if (type === 'skeleton') {
      c.strokeStyle = '#8a7b6a';
      c.beginPath();
      c.moveTo(4 * scale, -1 * scale);
      c.lineTo(9 * scale, -9 * scale);
      c.stroke();
    }
    c.restore();
  }

  drawCampfireGarrison(building, state, time) {
    if (building.type !== 'campfire' || building.readyAt > Date.now()) return;
    const roster = [];
    for (const [type, count] of Object.entries(building.garrison ?? {})) {
      for (let index = 0; index < count; index += 1) roster.push(type);
    }
    const shown = roster.slice(0, 12);
    const { x, y, scale } = this.buildingAnchor(building, state);
    const c = this.ctx;
    c.save();
    c.translate(x, y - 23 * scale);
    const pulse = .9 + Math.sin(time / 180) * .12;
    c.shadowColor = '#9dff7a';
    c.shadowBlur = 18 * scale;
    c.fillStyle = 'rgba(119,255,105,.9)';
    c.beginPath();
    c.arc(0, 0, 6 * scale * pulse, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(175,118,255,.75)';
    c.beginPath();
    c.arc(0, -6 * scale, 4 * scale * pulse, 0, Math.PI * 2);
    c.fill();
    c.restore();
    shown.forEach((type, index) => {
      const ring = Math.floor(index / 6);
      const slot = index % 6;
      const angle = (Math.PI * 2 / 6) * slot + ring * .4;
      const radius = (28 + ring * 13) * scale;
      const sway = Math.sin(time / 420 + index) * 1.5 * scale;
      this.drawVillageUnit(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * .46 + sway, type, scale * .9, .95);
    });
    if (roster.length > shown.length) {
      c.save();
      c.translate(x, y + 18 * scale);
      c.fillStyle = 'rgba(13,9,17,.9)';
      c.strokeStyle = '#9dff7a';
      c.lineWidth = 1.5 * scale;
      c.beginPath();
      c.arc(0, 0, 12 * scale, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `800 ${Math.max(8, 9 * scale)}px sans-serif`;
      c.fillText(`+${roster.length - shown.length}`, 0, 0);
      c.restore();
    }
  }

  drawTroopTransfers(state, interaction, time) {
    for (const transfer of interaction.troopTransfers ?? []) {
      const from = state.buildings.find((item) => item.id === transfer.fromId);
      const to = state.buildings.find((item) => item.id === transfer.toId);
      if (!from || !to) continue;
      const progress = Math.min(1, Math.max(0, (time - transfer.createdAt) / (transfer.duration ?? 1200)));
      const start = this.buildingAnchor(from, state);
      const end = this.buildingAnchor(to, state);
      const eased = 1 - Math.pow(1 - progress, 3);
      const x = start.x + (end.x - start.x) * eased;
      const y = start.y + (end.y - start.y) * eased - Math.sin(progress * Math.PI) * 18 * state.camera.zoom;
      this.drawVillageUnit(x, y - 18 * state.camera.zoom, transfer.type, state.camera.zoom, 1 - progress * .1);
    }
  }

  createSpriteFrame(sprite, sheet, frameIndex) {
    const columns = Math.max(1, sheet.columns ?? 1);
    const rows = Math.max(1, sheet.rows ?? 1);
    const frameWidth = Math.floor(sprite.width / columns);
    const frameHeight = Math.floor(sprite.height / rows);
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const context = canvas.getContext('2d', { willReadFrequently: Boolean(sheet.removeBackground) });
    const sourceX = frameIndex % columns * frameWidth;
    const sourceY = Math.floor(frameIndex / columns) * frameHeight;
    context.drawImage(sprite, sourceX, sourceY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
    if (sheet.removeBackground) this.removeConnectedBackground(context, frameWidth, frameHeight, sheet.backgroundTolerance ?? 28);
    return canvas;
  }

  removeConnectedBackground(context, width, height, tolerance) {
    try {
      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;
      const samplePoints = [[0,0], [width - 1,0], [0,height - 1], [width - 1,height - 1]];
      const background = samplePoints.reduce((sum, [x,y]) => {
        const index = (y * width + x) * 4;
        sum[0] += data[index]; sum[1] += data[index + 1]; sum[2] += data[index + 2];
        return sum;
      }, [0,0,0]).map((value) => value / samplePoints.length);
      const visited = new Uint8Array(width * height);
      const queue = [];
      const push = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const position = y * width + x;
        if (visited[position]) return;
        const index = position * 4;
        const distance = Math.hypot(data[index] - background[0], data[index + 1] - background[1], data[index + 2] - background[2]);
        if (distance > tolerance) return;
        visited[position] = 1;
        queue.push(position);
      };
      for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
      for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const position = queue[cursor];
        const x = position % width;
        const y = Math.floor(position / width);
        data[position * 4 + 3] = 0;
        push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
      }
      context.putImageData(imageData, 0, 0);
    } catch (error) {
      console.warn('[Renderer] Le détourage du spritesheet a échoué', error);
    }
  }

  getSpriteFrame(type, sprite, sheet, time) {
    if (!sheet) return sprite;
    const frameCount = Math.max(1, Math.min(sheet.frames ?? sheet.columns * sheet.rows, sheet.columns * sheet.rows));
    const frameIndex = Math.floor(time / 1000 * (sheet.fps ?? 2)) % frameCount;
    const cacheKey = `${type}:${frameIndex}`;
    if (!this.spriteFrameCache.has(cacheKey)) this.spriteFrameCache.set(cacheKey, this.createSpriteFrame(sprite, sheet, frameIndex));
    return this.spriteFrameCache.get(cacheKey);
  }

  building(building, state, selected, time, lifted = false) {
    const definition = this.definitions[building.type];
    const camera = state.camera;
    const scale = camera.zoom;
    this.footprint(building, camera, selected);
    const point = this.grid.gridToScreen(building.col + definition.size.w / 2, building.row + definition.size.h / 2, camera, this.viewport());
    const baseY = point.y + this.grid.tileHeight * definition.size.h * .48 * scale;
    const width = this.grid.tileWidth * definition.size.w * .62 * scale;
    const height = (building.type === 'wall' ? 28 : 58 + definition.size.h * 9) * scale;
    const c = this.ctx;
    c.save();
    c.translate(point.x, baseY - (lifted ? 10 * scale : 0));
    if (lifted) c.scale(1.05, 1.05);
    c.globalAlpha = building.readyAt > Date.now() ? .65 : 1;
    c.beginPath();
    c.ellipse(0, 5 * scale, width * (lifted ? .64 : .56), lifted ? 18 * scale : 13 * scale, 0, 0, Math.PI * 2);
    c.fillStyle = lifted ? 'rgba(0,0,0,.62)' : 'rgba(0,0,0,.45)';
    c.fill();
    const sprite = this.assets.get(building.type);
    if (sprite) {
      const frame = this.getSpriteFrame(building.type, sprite, definition.spriteSheet, time);
      const spriteSettings = definition.spriteRender ?? {};
      const footprintWidth = this.grid.tileWidth * (spriteSettings.maxTilesWide ?? definition.size.w) * scale;
      const targetW = Math.min(
        this.grid.tileWidth * definition.size.w * 1.48 * scale,
        footprintWidth
      ) * (spriteSettings.renderScale ?? 1);
      const targetH = targetW * (frame.height / frame.width);
      const offsetX = (spriteSettings.offsetX ?? 0) * scale;
      const offsetY = (spriteSettings.offsetY ?? 0) * scale;
      const anchorY = Math.max(0, Math.min(1, spriteSettings.anchorY ?? 1));
      c.drawImage(
        frame,
        -targetW / 2 + offsetX,
        -targetH * anchorY + offsetY,
        targetW,
        targetH
      );
    } else if (building.type === 'wall') {
      c.fillStyle = definition.colors[0];
      c.fillRect(-width / 2, -height, width, height);
      c.fillStyle = '#756b7c';
      for (let index = -2; index <= 2; index += 1) {
        c.beginPath();
        c.moveTo(index * width / 5, -height);
        c.lineTo(index * width / 5 + width / 10, -height - 12 * scale);
        c.lineTo(index * width / 5 + width / 5, -height);
        c.fill();
      }
    } else {
      const top = -height * .65;
      c.fillStyle = definition.colors[0];
      c.fillRect(-width / 2, top, width, height * .65);
      this.polygon([{ x: -width * .58, y: top }, { x: 0, y: -height }, { x: width * .58, y: top }], definition.colors[1], '#0d0b0f', 2 * scale);
      c.shadowColor = definition.colors[2];
      c.shadowBlur = (8 + Math.sin(time / 550) * 3) * scale;
      c.fillStyle = definition.colors[2];
      c.fillRect(-width * .06, -height * .28, width * .12, height * .11);
      c.shadowBlur = 0;
    }
    if (lifted) {
      c.strokeStyle = '#d7b0ff';
      c.lineWidth = 2 * scale;
      c.strokeRect(-width * .55, -height * 1.08, width * 1.1, height * 1.14);
    }
    if (building.readyAt > Date.now()) {
      c.fillStyle = 'rgba(9,7,12,.9)';
      c.fillRect(-38 * scale, -height - 28 * scale, 76 * scale, 21 * scale);
      c.fillStyle = '#dfc4ff';
      c.textAlign = 'center';
      c.font = `700 ${Math.max(10, 11 * scale)}px sans-serif`;
      c.fillText(`${Math.ceil((building.readyAt - Date.now()) / 1000)}s`, 0, -height - 13 * scale);
    }
    c.restore();
    this.drawCollectionBubble(building, state, time);
    this.drawCampfireGarrison(building, state, time);
  }

  battleGround(time) {
    const c = this.ctx;
    const viewport = this.viewport();
    const gradient = c.createRadialGradient(viewport.width * .5, viewport.height * .48, 20, viewport.width * .5, viewport.height * .5, viewport.width * .7);
    gradient.addColorStop(0, '#35283e');
    gradient.addColorStop(.55, '#211925');
    gradient.addColorStop(1, '#0d0a10');
    c.fillStyle = gradient;
    c.fillRect(0, 0, viewport.width, viewport.height);
    c.save();
    c.globalAlpha = .22;
    for (let index = 0; index < 70; index += 1) {
      const x = (index * 137 + time * .012 * (index % 4 + 1)) % viewport.width;
      const y = (index * 71) % viewport.height;
      c.fillStyle = index % 5 ? '#8f728f' : '#c57bff';
      c.fillRect(x, y, 1.4, 1.4);
    }
    c.restore();
    c.strokeStyle = 'rgba(146,104,164,.16)';
    c.lineWidth = 1;
    for (let x = 40; x < viewport.width; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x - 120, viewport.height); c.stroke(); }
    for (let y = 40; y < viewport.height; y += 50) { c.beginPath(); c.moveTo(0, y); c.lineTo(viewport.width, y + 120); c.stroke(); }
  }

  battleBuilding(building) {
    const c = this.ctx;
    const hpRatio = Math.max(0, building.hp / building.maxHp);
    c.save();
    c.translate(building.x, building.y);
    c.beginPath();
    c.ellipse(0, building.radius * .55, building.radius * 1.15, building.radius * .48, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.fill();
    const body = building.type === 'runeTower' ? '#30243a' : building.type === 'townHall' ? '#241b2c' : '#3a2d35';
    const accent = building.type === 'runeTower' ? '#b982ff' : building.type === 'townHall' ? '#d083ff' : '#b65a69';
    c.fillStyle = body;
    c.strokeStyle = '#0d0a10';
    c.lineWidth = 3;
    c.fillRect(-building.radius * .72, -building.radius, building.radius * 1.44, building.radius * 1.35);
    c.strokeRect(-building.radius * .72, -building.radius, building.radius * 1.44, building.radius * 1.35);
    c.shadowColor = accent;
    c.shadowBlur = 12;
    c.fillStyle = accent;
    c.fillRect(-building.radius * .18, -building.radius * .55, building.radius * .36, building.radius * .4);
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(0,0,0,.72)';
    c.fillRect(-building.radius, -building.radius - 14, building.radius * 2, 6);
    c.fillStyle = hpRatio > .5 ? '#79dc9e' : hpRatio > .25 ? '#e1b65b' : '#d85461';
    c.fillRect(-building.radius, -building.radius - 14, building.radius * 2 * hpRatio, 6);
    c.restore();
  }

  battleUnit(unit) {
    const c = this.ctx;
    const hpRatio = Math.max(0, unit.hp / unit.maxHp);
    c.save();
    c.translate(unit.x, unit.y);
    c.globalAlpha = unit.dead ? .25 : 1;
    c.beginPath();
    c.arc(0, 0, unit.type === 'ghoul' ? 12 : unit.type === 'necromancer' ? 10 : 9, 0, Math.PI * 2);
    c.fillStyle = unit.type === 'ghoul' ? '#806e58' : unit.type === 'necromancer' ? '#9c6dde' : '#d2ced7';
    c.fill();
    c.strokeStyle = '#17121b';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = 'rgba(0,0,0,.7)';
    c.fillRect(-12, -18, 24, 4);
    c.fillStyle = '#6fd69a';
    c.fillRect(-12, -18, 24 * hpRatio, 4);
    c.restore();
  }

  battleEffects(effects) {
    const c = this.ctx;
    for (const effect of effects) {
      c.save();
      c.globalAlpha = Math.max(0, effect.life / .35);
      c.strokeStyle = effect.kind === 'shot' ? '#c88cff' : '#ff9b7a';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(effect.x, effect.y, 18 * (1 - effect.life / .35) + 4, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  renderBattle(battle, time) {
    this.battleGround(time);
    battle.buildings.filter((building) => building.hp > 0).forEach((building) => this.battleBuilding(building));
    battle.deployed.forEach((unit) => this.battleUnit(unit));
    this.battleEffects(battle.effects);
  }

  render(state, interaction, time, battle = null) {
    if (battle?.active || battle?.result) { this.renderBattle(battle, time); return; }
    this.ground(state.camera, time);
    if (interaction.preview) this.footprint(interaction.preview, state.camera, false, interaction.preview.valid);
    [...state.buildings]
      .sort((a, b) => (a.col + a.row) - (b.col + b.row))
      .forEach((building) => this.building(building, state, building.id === interaction.selectedId, time, building.id === interaction.liftedId));
    this.drawTroopTransfers(state, interaction, time);
    this.drawCollectionPopups(interaction, state, time);
  }
}
