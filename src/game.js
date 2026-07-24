(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  const GRID = 18;
  const TILE_W = 92;
  const TILE_H = 46;
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 1.65;
  const SAVE_KEY = 'ashen-kingdoms-save-v1';

  const BUILDINGS = {
    townHall: { name: 'Hôtel de Ville', size: 3, cost: {}, color: '#29222f', roof: '#18151d', accent: '#a66cff', production: null },
    goldMine: { name: 'Mine d’or', size: 2, cost: { wood: 120 }, color: '#41362d', roof: '#211b18', accent: '#e7bb55', production: { resource: 'gold', rate: 3 } },
    lumberMill: { name: 'Scierie', size: 2, cost: { gold: 100 }, color: '#3b2c24', roof: '#251b18', accent: '#bc8a50', production: { resource: 'wood', rate: 3 } },
    essenceWell: { name: 'Puits d’essence', size: 2, cost: { gold: 160 }, color: '#25202c', roof: '#17131c', accent: '#b982ff', production: { resource: 'essence', rate: 1 } },
    barracks: { name: 'Caserne', size: 3, cost: { wood: 220 }, color: '#30272b', roof: '#1d171b', accent: '#b4424e', production: null },
    wall: { name: 'Rempart d’ossements', size: 1, cost: { gold: 25 }, color: '#47414c', roof: '#242029', accent: '#887796', production: null }
  };

  const makeId = () => globalThis.crypto?.randomUUID?.() || `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const defaultState = () => ({
    resources: { gold: 650, wood: 520, essence: 80 },
    buildings: [{ id: makeId(), type: 'townHall', x: 7, y: 7, level: 1, readyAt: 0 }],
    camera: { x: 0, y: -20, zoom: 1 },
    tutorialStep: 0,
    lastTick: Date.now()
  });

  let state = loadState();
  let selectedId = null;
  let placementType = null;
  let movingId = null;
  let hoverCell = null;
  let toastTimer = null;
  let hintTimer = null;
  let lastFrame = performance.now();
  let wallDragActive = false;
  let lastWallCellKey = null;

  const activePointers = new Map();
  let singleGesture = null;
  let pinchGesture = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const fresh = defaultState();
      return {
        ...fresh,
        ...parsed,
        resources: { ...fresh.resources, ...parsed.resources },
        camera: { ...fresh.camera, ...parsed.camera }
      };
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

  function screenToWorld(sx, sy, zoom = state.camera.zoom, cameraX = state.camera.x, cameraY = state.camera.y) {
    return {
      x: (sx - (canvas.clientWidth / 2 + cameraX)) / zoom,
      y: (sy - (canvas.clientHeight * 0.18 + cameraY)) / zoom
    };
  }

  function screenToGrid(sx, sy) {
    const world = screenToWorld(sx, sy);
    return {
      x: Math.floor((world.y / (TILE_H / 2) + world.x / (TILE_W / 2)) / 2),
      y: Math.floor((world.y / (TILE_H / 2) - world.x / (TILE_W / 2)) / 2)
    };
  }

  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
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
    for (const building of state.buildings) {
      if (building.id === ignoreId) continue;
      const size = BUILDINGS[building.type].size;
      for (let dx = 0; dx < size; dx += 1) {
        for (let dy = 0; dy < size; dy += 1) cells.add(`${building.x + dx},${building.y + dy}`);
      }
    }
    return cells;
  }

  function canPlace(type, x, y, ignoreId = null) {
    const size = BUILDINGS[type].size;
    if (x < 0 || y < 0 || x + size > GRID || y + size > GRID) return false;
    const occupied = occupiedCells(ignoreId);
    for (let dx = 0; dx < size; dx += 1) {
      for (let dy = 0; dy < size; dy += 1) {
        if (occupied.has(`${x + dx},${y + dy}`)) return false;
      }
    }
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
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 173) % canvas.clientWidth;
      const y = (i * 97) % canvas.clientHeight;
      ctx.fillStyle = i % 3 ? '#7d6790' : '#b982ff';
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();

    for (let x = 0; x < GRID; x += 1) {
      for (let y = 0; y < GRID; y += 1) {
        const checker = (x + y) % 2;
        drawTile(x, y, checker ? 'rgba(54,48,60,.78)' : 'rgba(48,42,54,.78)');
      }
    }
  }

  function drawFootprint(building, selected = false) {
    const def = BUILDINGS[building.type];
    for (let dx = 0; dx < def.size; dx += 1) {
      for (let dy = 0; dy < def.size; dy += 1) {
        drawTile(building.x + dx, building.y + dy, selected ? 'rgba(166,108,255,.2)' : 'rgba(9,7,12,.25)', selected ? '#c08cff' : 'rgba(0,0,0,.18)');
      }
    }
  }

  function wallNeighbours(building) {
    const positions = new Set(state.buildings.filter((item) => item.type === 'wall').map((item) => `${item.x},${item.y}`));
    return {
      north: positions.has(`${building.x},${building.y - 1}`),
      south: positions.has(`${building.x},${building.y + 1}`),
      west: positions.has(`${building.x - 1},${building.y}`),
      east: positions.has(`${building.x + 1},${building.y}`)
    };
  }

  function drawWall(building, width, height, scale) {
    const links = wallNeighbours(building);
    ctx.fillStyle = BUILDINGS.wall.color;
    ctx.strokeStyle = '#17141a';
    ctx.lineWidth = 2 * scale;
    ctx.fillRect(-width / 2, -height, width, height);
    ctx.strokeRect(-width / 2, -height, width, height);

    if (links.west || links.east) {
      ctx.fillStyle = '#5d5664';
      ctx.fillRect(-width * 0.72, -height * 0.72, width * 1.44, height * 0.46);
    }
    if (links.north || links.south) {
      ctx.fillStyle = '#665e6d';
      ctx.fillRect(-width * 0.32, -height * 1.08, width * 0.64, height * 1.02);
    }

    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * width / 5, -height);
      ctx.lineTo(i * width / 5 + width / 10, -height - 12 * scale);
      ctx.lineTo(i * width / 5 + width / 5, -height);
      ctx.fillStyle = '#756b7c';
      ctx.fill();
    }
  }

  function drawBuilding(building) {
    const def = BUILDINGS[building.type];
    drawFootprint(building, building.id === selectedId);
    const size = def.size;
    const front = gridToScreen(building.x + size / 2, building.y + size / 2);
    const scale = state.camera.zoom;
    const width = TILE_W * size * 0.62 * scale;
    const height = (building.type === 'wall' ? 28 : 58 + size * 9) * scale;
    const baseY = front.y + TILE_H * size * 0.48 * scale;

    ctx.save();
    ctx.translate(front.x, baseY);
    ctx.globalAlpha = building.readyAt > Date.now() ? 0.72 : 1;

    ctx.beginPath();
    ctx.ellipse(0, 4 * scale, width * .56, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fill();

    if (building.type === 'wall') {
      drawWall(building, width, height, scale);
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
      ctx.fillText(building.type === 'townHall' ? '☠' : building.type === 'goldMine' ? '⛏' : building.type === 'lumberMill' ? '♣' : building.type === 'essenceWell' ? '✦' : '⚔', 0, -height * .7);
    }

    if (building.level > 1) {
      ctx.fillStyle = '#f4eaff';
      ctx.strokeStyle = '#2a1d34';
      ctx.lineWidth = 3 * scale;
      ctx.font = `700 ${Math.max(9, 12 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeText(`Niv. ${building.level}`, 0, 19 * scale);
      ctx.fillText(`Niv. ${building.level}`, 0, 19 * scale);
    }

    if (building.readyAt > Date.now()) {
      const remaining = Math.ceil((building.readyAt - Date.now()) / 1000);
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
    return [...state.buildings].reverse().find((building) => {
      const size = BUILDINGS[building.type].size;
      return cell.x >= building.x && cell.y >= building.y && cell.x < building.x + size && cell.y < building.y + size;
    });
  }

  function drawPlacement() {
    if (!hoverCell || (!placementType && !movingId)) return;
    const type = movingId ? state.buildings.find((building) => building.id === movingId)?.type : placementType;
    if (!type) return;
    const valid = canPlace(type, hoverCell.x, hoverCell.y, movingId);
    const size = BUILDINGS[type].size;
    for (let dx = 0; dx < size; dx += 1) {
      for (let dy = 0; dy < size; dy += 1) {
        drawTile(hoverCell.x + dx, hoverCell.y + dy, valid ? 'rgba(85,210,142,.28)' : 'rgba(221,73,86,.32)', valid ? '#69e1a5' : '#ff6675');
      }
    }
  }

  function render() {
    drawGround();
    drawPlacement();
    [...state.buildings].sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(drawBuilding);
  }

  function hasResources(cost) {
    return Object.entries(cost).every(([key, amount]) => state.resources[key] >= amount);
  }

  function pay(cost) {
    Object.entries(cost).forEach(([key, amount]) => { state.resources[key] -= amount; });
  }

  function deselectBuildButtons() {
    document.querySelectorAll('.build-button').forEach((button) => button.classList.remove('active'));
  }

  function placeWallSegment(cell, silent = false) {
    const def = BUILDINGS.wall;
    const key = `${cell.x},${cell.y}`;
    if (key === lastWallCellKey) return false;
    lastWallCellKey = key;
    if (!canPlace('wall', cell.x, cell.y)) return false;
    if (!hasResources(def.cost)) {
      placementType = null;
      wallDragActive = false;
      deselectBuildButtons();
      showToast('Plus assez d’or pour continuer les remparts');
      updateUI();
      return false;
    }
    pay(def.cost);
    const wall = { id: makeId(), type: 'wall', x: cell.x, y: cell.y, level: 1, readyAt: 0 };
    state.buildings.push(wall);
    selectedId = wall.id;
    if (!silent) showToast('Rempart posé — continuez à glisser');
    saveState();
    updateUI();
    return true;
  }

  function placeAt(cell) {
    const type = movingId ? state.buildings.find((building) => building.id === movingId)?.type : placementType;
    if (!type) return;

    if (type === 'wall' && !movingId) {
      placeWallSegment(cell);
      return;
    }

    if (!canPlace(type, cell.x, cell.y, movingId)) {
      showToast('Emplacement impossible');
      return;
    }

    if (movingId) {
      const building = state.buildings.find((item) => item.id === movingId);
      building.x = cell.x;
      building.y = cell.y;
      movingId = null;
      selectedId = building.id;
      showToast('Bâtiment déplacé');
    } else {
      const def = BUILDINGS[type];
      if (!hasResources(def.cost)) {
        showToast('Ressources insuffisantes');
        return;
      }
      pay(def.cost);
      const building = { id: makeId(), type, x: cell.x, y: cell.y, level: 1, readyAt: Date.now() + 8000 };
      state.buildings.push(building);
      selectedId = building.id;
      placementType = null;
      deselectBuildButtons();
      updateTutorial(type);
      showToast(`${def.name} en construction`);
    }
    saveState();
    updateUI();
  }

  function upgradeSelected() {
    const building = state.buildings.find((item) => item.id === selectedId);
    if (!building || building.readyAt > Date.now()) return;
    const cost = building.type === 'wall'
      ? { gold: 50 * building.level }
      : { gold: 90 * building.level, wood: 70 * building.level };
    if (!hasResources(cost)) {
      const readable = Object.entries(cost).map(([resource, amount]) => `${amount} ${resource}`).join(' et ');
      showToast(`Il faut ${readable}`);
      return;
    }
    pay(cost);
    building.level += 1;
    building.readyAt = building.type === 'wall' ? 0 : Date.now() + 7000 + building.level * 2000;
    showToast(`${BUILDINGS[building.type].name} passe niveau ${building.level}`);
    saveState();
    updateUI();
  }

  function removeSelected() {
    const building = state.buildings.find((item) => item.id === selectedId);
    if (!building || building.type === 'townHall') return;
    const def = BUILDINGS[building.type];
    Object.entries(def.cost).forEach(([key, amount]) => { state.resources[key] += Math.floor(amount * .5); });
    state.buildings = state.buildings.filter((item) => item.id !== building.id);
    selectedId = null;
    showToast('Bâtiment retiré — 50 % remboursés');
    saveState();
    updateUI();
  }

  function collectProduction(dtSeconds) {
    for (const building of state.buildings) {
      const def = BUILDINGS[building.type];
      if (!def.production || building.readyAt > Date.now()) continue;
      const bonus = 1 + (building.level - 1) * .35;
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

    const building = state.buildings.find((item) => item.id === selectedId);
    const panel = $('selectionPanel');
    if (!building) {
      panel.classList.add('hidden');
      return;
    }
    const def = BUILDINGS[building.type];
    panel.classList.remove('hidden');
    $('selectionType').textContent = building.readyAt > Date.now() ? 'CONSTRUCTION' : building.type === 'wall' ? 'REMPART' : 'BÂTIMENT';
    $('selectionName').textContent = def.name;
    const production = def.production ? ` · +${Math.round(def.production.rate * (1 + (building.level - 1) * .35) * 60)} ${def.production.resource}/min` : '';
    $('selectionInfo').textContent = `Niveau ${building.level}${production}`;
    $('upgradeButton').disabled = building.readyAt > Date.now();
    $('removeButton').disabled = building.type === 'townHall';
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function showGestureHint() {
    const hint = $('gestureHint');
    hint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('show'), 2200);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pointerMidpoint() {
    const points = [...activePointers.values()];
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  function pointerDistance() {
    const points = [...activePointers.values()];
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  }

  function beginPinch() {
    if (activePointers.size !== 2) return;
    const midpoint = pointerMidpoint();
    pinchGesture = {
      startDistance: Math.max(1, pointerDistance()),
      startZoom: state.camera.zoom,
      worldAtMidpoint: screenToWorld(midpoint.x, midpoint.y),
      midpoint
    };
    singleGesture = null;
    wallDragActive = false;
    showGestureHint();
  }

  function updatePinch() {
    if (!pinchGesture || activePointers.size !== 2) return;
    const midpoint = pointerMidpoint();
    const zoom = clamp(pinchGesture.startZoom * (pointerDistance() / pinchGesture.startDistance), MIN_ZOOM, MAX_ZOOM);
    state.camera.zoom = zoom;
    state.camera.x = midpoint.x - canvas.clientWidth / 2 - pinchGesture.worldAtMidpoint.x * zoom;
    state.camera.y = midpoint.y - canvas.clientHeight * 0.18 - pinchGesture.worldAtMidpoint.y * zoom;
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const pos = pointerPosition(event);
    activePointers.set(event.pointerId, pos);
    hoverCell = screenToGrid(pos.x, pos.y);

    if (activePointers.size === 2) {
      beginPinch();
      return;
    }

    if (activePointers.size === 1) {
      singleGesture = {
        pointerId: event.pointerId,
        startX: pos.x,
        startY: pos.y,
        camX: state.camera.x,
        camY: state.camera.y,
        dragged: false
      };
      lastWallCellKey = null;
      wallDragActive = placementType === 'wall' && !movingId;
      if (wallDragActive) placeWallSegment(hoverCell, true);
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!activePointers.has(event.pointerId)) return;
    const pos = pointerPosition(event);
    activePointers.set(event.pointerId, pos);
    hoverCell = screenToGrid(pos.x, pos.y);

    if (activePointers.size === 2) {
      updatePinch();
      return;
    }

    if (!singleGesture || singleGesture.pointerId !== event.pointerId) return;
    const dx = pos.x - singleGesture.startX;
    const dy = pos.y - singleGesture.startY;
    if (Math.hypot(dx, dy) > 7) singleGesture.dragged = true;

    if (wallDragActive && placementType === 'wall') {
      placeWallSegment(hoverCell, true);
    } else if (singleGesture.dragged && !placementType && !movingId) {
      state.camera.x = singleGesture.camX + dx;
      state.camera.y = singleGesture.camY + dy;
    }
  });

  function finishPointer(event) {
    const pos = pointerPosition(event);
    const wasPinching = Boolean(pinchGesture);
    const wasWallDragging = wallDragActive;
    const gesture = singleGesture;

    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchGesture = null;

    if (!wasPinching && gesture?.pointerId === event.pointerId && !gesture.dragged && !wasWallDragging) {
      const cell = screenToGrid(pos.x, pos.y);
      if (placementType || movingId) placeAt(cell);
      else {
        const hit = buildingAt(cell);
        selectedId = hit?.id || null;
        updateUI();
      }
    }

    if (activePointers.size === 1) {
      const [pointerId, remaining] = [...activePointers.entries()][0];
      singleGesture = {
        pointerId,
        startX: remaining.x,
        startY: remaining.y,
        camX: state.camera.x,
        camY: state.camera.y,
        dragged: false
      };
    } else {
      singleGesture = null;
    }

    wallDragActive = false;
    lastWallCellKey = null;
    saveState();
  }

  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const world = screenToWorld(point.x, point.y);
    const zoom = clamp(state.camera.zoom - Math.sign(event.deltaY) * .08, MIN_ZOOM, MAX_ZOOM);
    state.camera.zoom = zoom;
    state.camera.x = point.x - canvas.clientWidth / 2 - world.x * zoom;
    state.camera.y = point.y - canvas.clientHeight * 0.18 - world.y * zoom;
  }, { passive: false });

  document.querySelectorAll('.build-button').forEach((button) => {
    button.addEventListener('click', () => {
      placementType = button.dataset.building;
      movingId = null;
      selectedId = null;
      document.querySelectorAll('.build-button').forEach((item) => item.classList.toggle('active', item === button));
      showToast(placementType === 'wall' ? 'Touchez puis glissez pour tracer vos remparts' : `Placez : ${BUILDINGS[placementType].name}`);
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
    deselectBuildButtons();
    showToast('Choisissez le nouvel emplacement');
    updateUI();
  });
  $('centerCamera').addEventListener('click', () => {
    state.camera.x = 0;
    state.camera.y = -20;
    state.camera.zoom = 1;
    saveState();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 160));
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
  setTimeout(showGestureHint, 700);
  requestAnimationFrame(loop);
})();