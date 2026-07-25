/**
 * BattleManager — Ashen Kingdoms
 *
 * - Village ennemi en cases iso via generateEnemyBase()
 * - Positions px calculées via Grid.gridToScreen()
 * - Spawn des troupes AUTOUR du village (bord de la grille iso, comme CoC)
 * - Zone anti-spawn par bâtiment :
 *     bâtiment normal : buffer = 2 cases
 *     mur             : buffer = 1 case
 * - Détection de collision basée sur la distance px
 */
import { UNITS }                        from '../data/units.js';
import { BATTLE_CONFIG, generateEnemyBase } from '../data/battle.js';
import { Grid }                         from './Grid.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Distance euclidienne px
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class BattleManager {
  constructor() {
    this.state = null;
    this._grid = new Grid({
      columns:    BATTLE_CONFIG.gridCols,
      rows:       BATTLE_CONFIG.gridRows,
      tileWidth:  BATTLE_CONFIG.tileWidth,
      tileHeight: BATTLE_CONFIG.tileHeight,
    });
  }

  /**
   * @param {object} playerState   game state (.army, .buildings)
   * @param {{ width, height }} viewport
   */
  start(playerState, viewport = { width: 800, height: 600 }) {
    const available = Object.fromEntries(
      Object.keys(UNITS).map(t => [t, playerState.army?.[t] ?? 0])
    );
    if (Object.values(available).every(n => n <= 0))
      return { ok: false, reason: 'Votre armée est vide' };

    const playerHdvLevel = playerState.buildings
      ?.find(b => b.type === 'townHall')?.level ?? 1;

    // Génère le village ennemi adaptatif
    const rawBuildings = generateEnemyBase(playerHdvLevel);

    // BUG-FIX #1 : la caméra de combat est calculée dynamiquement par
    // BattleRenderer.camera(vp) — on stocke zoom=1 comme référence de base
    // pour les positions px, mais on stocke aussi le viewport initial.
    const camera   = { x: 0, y: 0, zoom: 1 };

    const buildings = rawBuildings.map(b => {
      const ptSouth = this._grid.gridToScreen(
        b.col + b.size.w,
        b.row + b.size.h,
        camera, viewport
      );
      const tileW       = this._grid.tileWidth;
      const tileH       = this._grid.tileHeight;
      const radiusCases = (b.size.w + b.size.h) / 2;
      const radiusPx    = radiusCases * (tileW + tileH) / 4;
      return {
        ...b,
        // positions en CASES (col/row déjà présents via rawBuildings)
        // positions px de référence (zoom=1) pour la physique
        x:              ptSouth.x,
        y:              ptSouth.y,
        radius:         radiusPx,
        spawnBufferPx:  (b.isWall ? 1 : 2) * (tileW + tileH) / 4,
      };
    });

    // Calcule les zones de spawn valides (bord de grille, hors buffer)
    // BUG-FIX #2 : on stocke les cellules iso (col, row) et non les px
    // pour pouvoir les reprojeter au rendu avec le zoom courant
    const spawnCells = this._buildSpawnCells(buildings, viewport, camera);

    this.state = {
      active:       true,
      startedAt:    performance.now(),
      elapsed:      0,
      timeLeft:     BATTLE_CONFIG.durationSeconds,
      available,
      deployed:     [],
      buildings,
      spawnCells,   // [{col, row}] — reProjectés au rendu
      spawnZone:    [],   // [{x,y}] rempli au rendu via projectSpawnZone()
      effects:      [],
      selectedUnit: Object.keys(available).find(t => available[t] > 0) ?? null,
      result:       null,
      rewardApplied:false,
      viewport,
      camera,
    };
    return { ok: true };
  }

  /**
   * Construit la liste des CELLULES de spawn valides :
   * - Sur le périmètre externe de la grille iso
   * - À distance > spawnBuffer de tout bâtiment (coords px zoom=1)
   */
  _buildSpawnCells(buildings, viewport, camera) {
    const cols  = BATTLE_CONFIG.gridCols;
    const rows  = BATTLE_CONFIG.gridRows;
    const cells = [];

    const borderCells = [];
    for (let c = 0; c < cols; c++) {
      borderCells.push({ c, r: 0 });
      borderCells.push({ c, r: rows - 1 });
    }
    for (let r = 1; r < rows - 1; r++) {
      borderCells.push({ c: 0,        r });
      borderCells.push({ c: cols - 1, r });
    }

    for (const { c, r } of borderCells) {
      const pt = this._grid.gridToScreen(c + 0.5, r + 0.5, camera, viewport);
      const blocked = buildings.some(b =>
        dist(pt, b) < b.spawnBufferPx + b.radius
      );
      if (!blocked) cells.push({ col: c + 0.5, row: r + 0.5 });
    }
    return cells;
  }

  selectUnit(type) {
    if (!this.state?.active || (this.state.available[type] ?? 0) <= 0) return false;
    this.state.selectedUnit = type;
    return true;
  }

  /**
   * Déploie une unité.
   * BUG-FIX #3 : deploy() accepte maintenant (x, y, viewport) pour
   * pouvoir trouver le point de spawn le plus proche avec le zoom courant.
   * On stocke la position de l'unité en px PHYSIQUES (zoom=1) pour que
   * la physique soit indépendante du zoom de rendu.
   */
  deploy(x, y, viewport) {
    const battle = this.state;
    const type   = battle?.selectedUnit;
    if (!battle?.active || !type || battle.available[type] <= 0) return false;

    const vp  = viewport ?? battle.viewport;
    // Le rendu utilise un zoom = min(vp.w,vp.h)/900
    const renderZoom = Math.min(vp.width, vp.height) / 900;
    // Convertit le clic (px rendu) en px physiques (zoom=1)
    const scale = 1 / renderZoom;
    const cx    = x * scale + (battle.camera.x ?? 0) * (scale - 1);
    const cy    = y * scale + (battle.camera.y ?? 0) * (scale - 1);

    // Trouve le point de spawn (en px physiques) le plus proche
    const camZ1 = { ...battle.camera, zoom: 1 };
    const spawnPt = battle.spawnCells
      .map(cell => battle._grid
        ? battle._grid.gridToScreen(cell.col, cell.row, camZ1, battle.viewport)
        : this._grid.gridToScreen(cell.col, cell.row, camZ1, battle.viewport)
      )
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];

    if (!spawnPt) return false;

    const unit = UNITS[type];
    battle.available[type] -= 1;
    battle.deployed.push({
      id:             `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      movementType:   unit.movementType ?? 'ground',
      // BUG-FIX #3 suite : position en px physiques (zoom=1)
      x:              spawnPt.x,
      y:              spawnPt.y,
      hp:             unit.hp ?? unit.stats?.hp ?? 120,
      maxHp:          unit.hp ?? unit.stats?.hp ?? 120,
      attackCooldown: 0,
      dead:           false,
    });
    return true;
  }

  update(dt) {
    const battle = this.state;
    if (!battle?.active) return null;
    battle.elapsed  += dt;
    battle.timeLeft  = Math.max(0, BATTLE_CONFIG.durationSeconds - battle.elapsed);

    // Mouvement + attaque des unités (coords px physiques zoom=1)
    for (const unit of battle.deployed) {
      if (unit.dead) continue;
      const target = this._closestBuilding(unit);
      if (!target) continue;
      const stats    = UNITS[unit.type]?.stats ?? UNITS[unit.type] ?? {};
      const stopDist = target.radius + 12;
      const d        = dist(unit, target);
      unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
      if (d > stopDist) {
        const speed = (stats.speed ?? 1) * 42;
        unit.x += ((target.x - unit.x) / d) * speed * dt;
        unit.y += ((target.y - unit.y) / d) * speed * dt;
      } else if (unit.attackCooldown <= 0) {
        target.hp -= stats.damage ?? 10;
        unit.attackCooldown = 0.8;
        battle.effects.push({ x: target.x, y: target.y, life: 0.28, kind: 'hit' });
      }
    }

    // Pièges
    for (const b of battle.buildings) {
      if (!b.trap || b.triggered) continue;
      const tileW = this._grid.tileWidth;
      const tileH = this._grid.tileHeight;
      const trigR = b.trap.triggerRadius * (tileW + tileH) / 4;
      const splR  = b.trap.splashRadius  * (tileW + tileH) / 4;
      const victims = battle.deployed.filter(
        u => !u.dead && b.trap.targets.includes(u.movementType) && dist(u, b) <= trigR
      );
      if (!victims.length) continue;
      b.triggered = true; b.hidden = false;
      for (const u of battle.deployed) {
        if (u.dead || !b.trap.targets.includes(u.movementType) || dist(u, b) > splR) continue;
        u.hp -= b.trap.damage;
        if (u.hp <= 0) u.dead = true;
      }
      battle.effects.push({ x: b.x, y: b.y, life: 0.5, kind: 'trap' });
    }

    // Défenses
    for (const b of battle.buildings) {
      if (b.hp <= 0 || !b.defense) continue;
      b.cooldownLeft = Math.max(0, b.cooldownLeft - dt);
      if (b.cooldownLeft > 0) continue;
      const rangePx    = b.defense.range * (this._grid.tileWidth + this._grid.tileHeight) / 4;
      const splashPx   = (b.defense.splashRadius ?? 2.5) * (this._grid.tileWidth + this._grid.tileHeight) / 4;
      const candidates = battle.deployed.filter(
        u => !u.dead && b.defense.targets.includes(u.movementType) && dist(u, b) <= rangePx
      );
      const target = this._pickTarget(b, candidates);
      if (!target) continue;
      if (b.defense.attackType === 'splash') {
        for (const u of candidates) {
          if (dist(u, target) > splashPx) continue;
          u.hp -= b.defense.damage;
          if (u.hp <= 0) u.dead = true;
        }
      } else {
        target.hp -= b.defense.damage;
        if (target.hp <= 0) target.dead = true;
      }
      b.cooldownLeft = b.defense.cooldown;
      battle.effects.push({
        x: target.x, y: target.y, life: 0.35,
        kind: b.defense.attackType === 'splash' ? 'splash' : 'shot'
      });
    }

    battle.effects.forEach(fx => { fx.life -= dt; });
    battle.effects = battle.effects.filter(fx => fx.life > 0);

    const remaining    = battle.buildings.filter(b => b.hp > 0 && !b.trap);
    const hasAvailable = Object.values(battle.available).some(n => n > 0);
    const hasLiving    = battle.deployed.some(u => !u.dead);
    if (remaining.length === 0 || battle.timeLeft <= 0 || (!hasAvailable && !hasLiving))
      return this.finish();
    return null;
  }

  _pickTarget(building, candidates) {
    if (!candidates.length) return null;
    if (building.defense.targetPriority === 'highestHp')
      return [...candidates].sort((a, b) => b.hp - a.hp)[0];
    if (building.defense.targetPriority === 'cluster')
      return [...candidates].sort((a, b) =>
        this._clusterScore(b, candidates) - this._clusterScore(a, candidates)
      )[0];
    return [...candidates].sort((a, b) => dist(a, building) - dist(b, building))[0];
  }

  _clusterScore(unit, units) {
    return units.reduce((s, other) => s + (dist(unit, other) <= 58 ? 1 : 0), 0);
  }

  finish() {
    const battle = this.state;
    // BUG-FIX #8 : guard contre double appel (finish() appelé automatiquement + via UI)
    if (!battle?.active) return battle?.result ?? null;
    battle.active = false;
    const scoring     = battle.buildings.filter(b => !b.trap);
    const totalHp     = scoring.reduce((s, b) => s + b.maxHp, 0);
    const remainHp    = scoring.reduce((s, b) => s + Math.max(0, b.hp), 0);
    const destruction = Math.round((1 - remainHp / totalHp) * 100);
    const throneDown  = battle.buildings.find(b => b.id === 'enemy-th')?.hp <= 0;
    const stars       = destruction === 100 ? 3 : throneDown ? 2 : destruction >= 50 ? 1 : 0;
    const ratio       = destruction / 100;
    const loot        = Object.fromEntries(
      Object.entries(BATTLE_CONFIG.loot).map(([k, v]) => [k, Math.round(v * ratio)])
    );
    battle.result = { destruction, stars, loot };
    return battle.result;
  }

  _closestBuilding(unit) {
    return this.state.buildings
      .filter(b => b.hp > 0 && !b.trap)
      .sort((a, b) => dist(unit, a) - dist(unit, b))[0] ?? null;
  }
}
