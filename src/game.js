(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  const GRID = 18;
  const TILE_W = 92;
  const TILE_H = 46;
  const SAVE_KEY = 'ashen-kingdoms-save-v1';

  const BUILDINGS = {
    townHall: { name: 'Hôtel de Ville', size: 3, cost: {}, color: '#29222f', roof: '#18151d', accent: '#a66cff', production: null },
    goldMine: { name: 'Mine d’or', size: 2, cost: { wood: 120 }, color: '#41362d', roof: '#211b18', accent: '#e7bb55', production: { resource: 'gold', rate: 3 } },
    lumberMill: { name: 'Scierie', size: 2, cost: { gold: 100 }, color: '#3b2c24', roof: '#251b18', accent: '#bc8a50', production: { resource: 'wood', rate: 3 } },
    essenceWell: { name: 'Puits d’essence', size: 2, cost: { gold: 160 }, color: '#25202c', roof: '#17131c', accent: '#b982ff', production: { resource: 'essence', rate: 1 } },
    barracks: { name: 'Caserne', size: 3, cost: { wood: 220 }, color: '#30272b', roof: '#1d171b', accent: '#b4424e', production: null },
    wall: { name: 'Mur d’ossements', size: 1, cost: { gold: 25 }, color: '#47414c', roof: '#242029', accent: '#887796', production: null }
  };

  const defaultState = () => ({
    resources: { gold: 650, wood: 520, essence: 80 },
    buildings: [
      { id: crypto.randomUUID(), type: 'townHall', x: 7, y: 7, level: 1, readyAt: 0 }
    ],
    camera: { x: 0, y: -20, zoom: 1 },
    tutorialStep: 0,
    lastTick: Date.now()
  });

  let state = loadState();
  let selectedId = null;
  let placementType = null;
  let movingId = null;
  let hoverCell = null;
  let pointer = { down: false, x: 0, y: 0, startX: 0, startY: 0, camX: 0, camY: 0, dragged: false };
  let toastTimer = null;
  let lastFrame = performance.now();

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, resources: { ...defaultState().resources, ...parsed.resources } };
    } catch (error) {
      console.warn('Sauvegarde illisible, nouvelle partie.', error);
      return defaultState();
    }
  }

  function saveState() {
    state.lastTick = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function worldOrigin() {
    return {
      x: canvas.clientWidth / 2 + state.camera.x,
      y: canvas.clientHeight * 0.18 + state.camera.y
    };
  }

  function gridToScreen(x, y) {
    const o = worldOrigin();
    return {
      x: o.x + (x - y) * (TILE_W / 2) * state.camera.zoom,
      y: o.y + (x + y) * (TILE_H / 2) * state.camera.zoom
    };
  }

  function screenToGrid(sx, sy) {
    const o = worldOrigin();
    const x = (sx - o.x) / state.camera.zoom;
    const y = (sy - o.y) / state.camera.zoom;
    return {
      x: Math.floor((y / (TILE_H / 2) + x / (TILE_W / 2)) / 2),
      y: Math.floor((y / (TILE_H / 2) - x / (TILE_W / 2)) / 2)
    };
  }

  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function drawTile(x, y, fill = null, stroke = 'rgba(104,85,118,.34)') {
    const p = gridToScreen(x, y);
    const hw = TILE_W * state.camera.zoom / 2;
    const hh = TILE_H * state.camera.zoom / 2;
    polygon([
      { x: p.x, y: p.y }, { x: p.x + hw, y: p.y + hh },
      { x: p.x, y: p.y + hh * 2 }, { x: p.x - hw, y: p.y + hh }
    ], fill, stroke, Math.max(0.6, state.camera.zoom));
  }

  function occupiedCells(ignoreId = null) {
    const cells = new Set();
    for (const b of state.buildings) {
      if (b.id === ignoreId) continue;
      const size = BUILDINGS[b.type].size;
      for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) cells.add(`${b.x + dx},${b.y + dy}`);
    }
    return cells;
  }

  function canPlace(type, x, y, ignoreId = null) {
    const size = BUILDINGS[type].size;
    if (x < 0 || y < 0 || x + size > GRID || y + size > GRID) return false;
    const occupied = occupiedCells(ignoreId);
    for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) if (occupied.has(`${x + dx},${y + dy}`)) return false;
    return true;
  }

  function drawGround() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight);
    grad.addColorStop(0, '#34293d');
    grad.addColorStop(0.52, '#251e2c');
    grad.addColorStop(1, '#17131d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 90; i++) {
      const x = (i * 173) % canvas.clientWidth;
      const y = (i * 97) % canvas.clientHeight;
      ctx.fillStyle = i % 3 ? '#7d6790' : '#b982ff';
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();

    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        const checker = (x + y) % 2;
        drawTile(x, y, checker ? 'rgba(54,48,60,.78)' : 'rgba(48,42,54,.78)');
      }
    }
  }

  function drawFootprint(b, selected = false) {
    const def = BUILDINGS[b.type];
    for (let dx = 0; dx < def.size; dx++) {
      for (let dy = 0; dy < def.size; dy++) {
        drawTile(b.x + dx, b.y + dy, selected ? 'rgba(166,108,255,.2)' : 'rgba(9,7,12,.25)', selected ? '#c08cff' : 'rgba(0,0,0,.18)');
      }
    }
  }

  function drawBuilding(b) {
    const def = BUILDINGS[b.type];
    drawFootprint(b, b.id === selectedId);
    const size = def.size;
    const front = gridToScreen(b.x + size / 2, b.y + size / 2);
    const scale = state.camera.zoom;
    const width = TILE_W * size * 0.62 * scale;
    const height = (b.type === 'wall' ? 28 : 58 + size * 9) * scale;
    const baseY = front.y + TILE_H * size * 0.48 * scale;

    ctx.save();
    ctx.translate(front.x, baseY);
    ctx.globalAlpha = b.readyAt > Date.now() ? 0.72 : 1;

    ctx.beginPath();
    ctx.ellipse(0, 4 * scale, width * .56, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fill();

    if (b.type === 'wall') {
      ctx.fillStyle = def.color;
      ctx.strokeStyle = '#17141a';
      ctx.lineWidth = 2 * scale;
      ctx.fillRect(-width / 2, -height, width, height);
      ctx.strokeRect(-width / 2, -height, width, height);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * width / 5, -height);
        ctx.lineTo(i * width / 5 + width / 10, -height - 12 * scale);
        ctx.lineTo(i * width / 5 + width / 5, -height);
        ctx.fillStyle = '#655c6b';
        ctx.fill();
      }
    } else {
      const bodyTop = -height * .65;
      ctx.fillStyle = def.color;
      ctx.strokeStyle = '#100d13';
      ctx.lineWidth = 2 * scale;
      ctx.fillRect(-width / 2, bodyTop, width, height * .65);
      ctx.strokeRect(-width / 2, bodyTop, width, height * .65);

      polygon([
        { x: -width * .58, y: bodyTop + 3 * scale },
        { x: 0, y: -height },
        { x: width * .58, y: bodyTop + 3 * scale },
        { x: width * .48, y: bodyTop + 15 * scale },
        { x: 0, y: -height + 14 * scale },
        { x: -width * .48, y: bodyTop + 15 * scale }
      ], def.roof, '#0d0b0f', 2 * scale);

      ctx.fillStyle = '#171219';
      ctx.fillRect(-width * .12, -height * .38, width * .24, height * .38);
      ctx.strokeStyle = '#6e6572';
      ctx.strokeRect(-width * .12, -height * .38, width * .24, height * .38);

      ctx.shadowColor = def.accent;
      ctx.shadowBlur = 12 * scale;
      ctx.fillStyle = def.accent;
      ctx.fillRect(-width * .055, -height * .27, width * .11, height * .1);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#aaa0ad';
      ctx.font = `${Math.max(11, 17 * scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(b.type === 'townHall' ? '☠' : b.type === 'goldMine' ? '⛏' : b.type === 'lumberMill' ? '♣' : b.type === 'essenceWell' ? '✦' : '⚔', 0, -height * .7);
    }

    if (b.level > 1) {
      ctx.fillStyle = '#f4eaff';
      ctx.strokeStyle = '#2a1d34';
      ctx.lineWidth = 3 * scale;
      ctx.font = `700 ${Math.max(9, 12 * scale)}px sans-serif`;
      ctx.strokeText(`Niv. ${b.level}`, 0, 19 * scale);
      ctx.fillText(`Niv. ${b.level}`, 0, 19 * scale);
    }

    if (b.readyAt > Date.now()) {
      const remaining = Math.ceil((b.readyAt - Date.now()) / 1000);
      ctx.fillStyle = 'rgba(10,8,13,.86)';
      ctx.fillRect(-34 * scale, -height - 30 * scale, 68 * scale, 22 * scale);
      ctx.fillStyle = '#d5b4ff';
      ctx.font = `700 ${Math.max(9, 11 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${remaining}s`, 0, -height - 15 * scale);
    }
    ctx.restore();
  }

  function buildingAt(cell) {
    return [...state.buildings].reverse().find((b) => {
      const size = BUILDINGS[b.type].size;
      return cell.x >= b.x && cell.y >= b.y && cell.x < b.x + size && cell.y < b.y + size;
    });
  }

  function drawPlacement() {
    if (!hoverCell || (!placementType && !movingId)) return;
    const type = movingId ? state.buildings.find((b) => b.id === movingId)?.type : placementType;
    if (!type) return;
    const valid = canPlace(type, hoverCell.x, hoverCell.y, movingId);
    const size = BUILDINGS[type].size;
    for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) drawTile(hoverCell.x + dx, hoverCell.y + dy, valid ? 'rgba(85,210,142,.28)' : 'rgba(221,73,86,.32)', valid ? '#69e1a5' : '#ff6675');
  }

  function render() {
    drawGround();
    drawPlacement();
    const ordered = [...state.buildings].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    ordered.forEach(drawBuilding);
  }

  function hasResources(cost) {
    return Object.entries(cost).every(([key, amount]) => state.resources[key] >= amount);
  }

  function pay(cost) {
    Object.entries(cost).forEach(([key, amount]) => { state.resources[key] -= amount; });
  }

  function placeAt(cell) {
    const type = movingId ? state.buildings.find((b) => b.id === movingId)?.type : placementType;
    if (!type || !canPlace(type, cell.x, cell.y, movingId)) {
      showToast('Emplacement impossible');
      return;
    }

    if (movingId) {
      const b = state.buildings.find((item) => item.id === movingId);
      b.x = cell.x; b.y = cell.y;
      movingId = null;
      selectedId = b.id;
      showToast('Bâtiment déplacé');
    } else {
      const def = BUILDINGS[type];
      if (!hasResources(def.cost)) {
        showToast('Ressources insuffisantes');
        return;
      }
      pay(def.cost);
      const b = { id: crypto.randomUUID(), type, x: cell.x, y: cell.y, level: 1, readyAt: Date.now() + (type === 'wall' ? 3000 : 8000) };
      state.buildings.push(b);
      selectedId = b.id;
      placementType = null;
      document.querySelectorAll('.build-button').forEach((button) => button.classList.remove('active'));
      updateTutorial(type);
      showToast(`${def.name} en construction`);
    }
    saveState();
    updateUI();
  }

  function upgradeSelected() {
    const b = state.buildings.find((item) => item.id === selectedId);
    if (!b || b.readyAt > Date.now()) return;
    const cost = { gold: 90 * b.level, wood: 70 * b.level };
    if (!hasResources(cost)) return showToast(`Il faut ${cost.gold} or et ${cost.wood} bois`);
    pay(cost);
    b.level += 1;
    b.readyAt = Date.now() + 7000 + b.level * 2000;
    showToast(`${BUILDINGS[b.type].name} passe niveau ${b.level}`);
    saveState(); updateUI();
  }

  function removeSelected() {
    const b = state.buildings.find((item) => item.id === selectedId);
    if (!b || b.type === 'townHall') return;
    const def = BUILDINGS[b.type];
    Object.entries(def.cost).forEach(([key, amount]) => { state.resources[key] += Math.floor(amount * .5); });
    state.buildings = state.buildings.filter((item) => item.id !== b.id);
    selectedId = null;
    showToast('Bâtiment retiré — 50 % remboursés');
    saveState(); updateUI();
  }

  function collectProduction(dtSeconds) {
    for (const b of state.buildings) {
      const def = BUILDINGS[b.type];
      if (!def.production || b.readyAt > Date.now()) continue;
      const bonus = 1 + (b.level - 1) * .35;
      state.resources[def.production.resource] += def.production.rate * bonus * dtSeconds;
    }
    for (const key of Object.keys(state.resources)) state.resources[key] = Math.min(999999, state.resources[key]);
  }

  function updateTutorial(type) {
    const goals = ['goldMine', 'lumberMill', 'barracks'];
    if (goals[state.tutorialStep] === type) state.tutorialStep += 1;
  }

  function updateUI() {
    $('goldValue').textContent = Math.floor(state.resources.gold).toLocaleString('fr-FR');
    $('woodValue').textContent = Math.floor(state.resources.wood).toLocaleString('fr-FR');
    $('essenceValue').textContent = Math.floor(state.resources.essence).toLocaleString('fr-FR');

    const objectives = ['Construisez une mine d’or', 'Construisez une scierie', 'Élevez une caserne', 'Développez librement votre royaume'];
    $('objectiveText').textContent = objectives[Math.min(state.tutorialStep, objectives.length - 1)];

    document.querySelectorAll('.build-button').forEach((button) => {
      const def = BUILDINGS[button.dataset.building];
      button.disabled = !hasResources(def.cost);
    });

    const b = state.buildings.find((item) => item.id === selectedId);
    const panel = $('selectionPanel');
    if (!b) {
      panel.classList.add('hidden');
      return;
    }
    const def = BUILDINGS[b.type];
    panel.classList.remove('hidden');
    $('selectionType').textContent = b.readyAt > Date.now() ? 'CONSTRUCTION' : 'BÂTIMENT';
    $('selectionName').textContent = def.name;
    const production = def.production ? ` · +${Math.round(def.production.rate * (1 + (b.level - 1) * .35) * 60)} ${def.production.resource}/min` : '';
    $('selectionInfo').textContent = `Niveau ${b.level}${production}`;
    $('upgradeButton').disabled = b.readyAt > Date.now();
    $('removeButton').disabled = b.type === 'townHall';
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    const pos = pointerPosition(event);
    pointer = { down: true, x: pos.x, y: pos.y, startX: pos.x, startY: pos.y, camX: state.camera.x, camY: state.camera.y, dragged: false };
  });

  canvas.addEventListener('pointermove', (event) => {
    const pos = pointerPosition(event);
    hoverCell = screenToGrid(pos.x, pos.y);
    if (!pointer.down) return;
    const dx = pos.x - pointer.startX;
    const dy = pos.y - pointer.startY;
    if (Math.hypot(dx, dy) > 7) pointer.dragged = true;
    if (pointer.dragged && !placementType && !movingId) {
      state.camera.x = pointer.camX + dx;
      state.camera.y = pointer.camY + dy;
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    const pos = pointerPosition(event);
    const cell = screenToGrid(pos.x, pos.y);
    if (!pointer.dragged) {
      if (placementType || movingId) placeAt(cell);
      else {
        const hit = buildingAt(cell);
        selectedId = hit?.id || null;
        updateUI();
      }
    }
    pointer.down = false;
    saveState();
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.camera.zoom = Math.max(.55, Math.min(1.55, state.camera.zoom - Math.sign(event.deltaY) * .08));
  }, { passive: false });

  document.querySelectorAll('.build-button').forEach((button) => {
    button.addEventListener('click', () => {
      placementType = button.dataset.building;
      movingId = null;
      selectedId = null;
      document.querySelectorAll('.build-button').forEach((item) => item.classList.toggle('active', item === button));
      showToast(`Placez : ${BUILDINGS[placementType].name}`);
      updateUI();
    });
  });

  $('upgradeButton').addEventListener('click', upgradeSelected);
  $('removeButton').addEventListener('click', removeSelected);
  $('moveButton').addEventListener('click', () => {
    if (!selectedId) return;
    movingId = selectedId;
    placementType = null;
    selectedId = null;
    showToast('Choisissez le nouvel emplacement');
    updateUI();
  });
  $('zoomIn').addEventListener('click', () => { state.camera.zoom = Math.min(1.55, state.camera.zoom + .12); });
  $('zoomOut').addEventListener('click', () => { state.camera.zoom = Math.max(.55, state.camera.zoom - .12); });
  $('centerCamera').addEventListener('click', () => { state.camera.x = 0; state.camera.y = -20; state.camera.zoom = 1; });

  window.addEventListener('resize', resize);
  window.addEventListener('beforeunload', saveState);
  setInterval(saveState, 5000);

  function loop(now) {
    const dt = Math.min(.1, (now - lastFrame) / 1000);
    lastFrame = now;
    collectProduction(dt);
    render();
    updateUI();
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
