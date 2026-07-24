import { UNITS } from '../data/units.js';
import { BATTLE_CONFIG, ENEMY_BUILDINGS } from '../data/battle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class BattleManager {
  constructor() { this.state = null; }

  start(playerState) {
    const available = Object.fromEntries(Object.keys(UNITS).map((t) => [t, playerState.army?.[t] ?? 0]));
    if (Object.values(available).every((n) => n <= 0)) return { ok: false, reason: 'Votre armée est vide' };
    this.state = {
      active: true,
      startedAt: performance.now(),
      elapsed: 0,
      timeLeft: BATTLE_CONFIG.durationSeconds,
      available,
      deployed: [],
      buildings: ENEMY_BUILDINGS.map((b) => ({ ...b, cooldownLeft: 0 })),
      effects: [],
      selectedUnit: Object.keys(available).find((t) => available[t] > 0) ?? null,
      result: null,
      rewardApplied: false,
    };
    return { ok: true };
  }

  selectUnit(type) {
    if (!this.state?.active || (this.state.available[type] ?? 0) <= 0) return false;
    this.state.selectedUnit = type;
    return true;
  }

  /** Deploy a unit at screen (x,y) within viewport bounds. */
  deploy(x, y, viewport) {
    const battle = this.state;
    const type = battle?.selectedUnit;
    if (!battle?.active || !type || battle.available[type] <= 0) return false;
    const unit = UNITS[type];
    battle.available[type] -= 1;
    battle.deployed.push({
      id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      movementType: unit.movementType ?? 'ground',
      x: clamp(x, 24, (viewport?.width ?? 800) - 24),
      y: clamp(y, 24, (viewport?.height ?? 600) - 24),
      hp: unit.hp ?? unit.stats?.hp ?? 120,
      maxHp: unit.hp ?? unit.stats?.hp ?? 120,
      attackCooldown: 0,
      dead: false,
    });
    return true;
  }

  update(dt) {
    const battle = this.state;
    if (!battle?.active) return null;
    battle.elapsed += dt;
    battle.timeLeft = Math.max(0, BATTLE_CONFIG.durationSeconds - battle.elapsed);

    // — unit AI
    for (const unit of battle.deployed) {
      if (unit.dead) continue;
      const target = this._closestBuilding(unit);
      if (!target) continue;
      const stats = UNITS[unit.type]?.stats ?? UNITS[unit.type] ?? {};
      const stopDist = target.radius + 12;
      const d = dist(unit, target);
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

    // — trap triggers
    for (const b of battle.buildings) {
      if (!b.trap || b.triggered) continue;
      const victims = battle.deployed.filter(
        (u) => !u.dead && b.trap.targets.includes(u.movementType) && dist(u, b) <= b.trap.triggerRadius
      );
      if (!victims.length) continue;
      b.triggered = true; b.hidden = false;
      for (const u of battle.deployed) {
        if (u.dead || !b.trap.targets.includes(u.movementType) || dist(u, b) > b.trap.splashRadius) continue;
        u.hp -= b.trap.damage;
        if (u.hp <= 0) u.dead = true;
      }
      battle.effects.push({ x: b.x, y: b.y, life: 0.5, kind: 'trap' });
    }

    // — defense towers shoot
    for (const b of battle.buildings) {
      if (b.hp <= 0 || !b.defense) continue;
      b.cooldownLeft = Math.max(0, b.cooldownLeft - dt);
      if (b.cooldownLeft > 0) continue;
      const candidates = battle.deployed.filter(
        (u) => !u.dead && b.defense.targets.includes(u.movementType) && dist(u, b) <= b.defense.range
      );
      const target = this._pickTarget(b, candidates);
      if (!target) continue;
      if (b.defense.attackType === 'splash') {
        for (const u of candidates) {
          if (dist(u, target) > (b.defense.splashRadius ?? 42)) continue;
          u.hp -= b.defense.damage;
          if (u.hp <= 0) u.dead = true;
        }
      } else {
        target.hp -= b.defense.damage;
        if (target.hp <= 0) target.dead = true;
      }
      b.cooldownLeft = b.defense.cooldown;
      battle.effects.push({ x: target.x, y: target.y, life: 0.35, kind: b.defense.attackType === 'splash' ? 'splash' : 'shot' });
    }

    battle.effects.forEach((fx) => { fx.life -= dt; });
    battle.effects = battle.effects.filter((fx) => fx.life > 0);

    const remaining = battle.buildings.filter((b) => b.hp > 0 && !b.trap);
    const hasAvailable = Object.values(battle.available).some((n) => n > 0);
    const hasLiving = battle.deployed.some((u) => !u.dead);
    if (remaining.length === 0 || battle.timeLeft <= 0 || (!hasAvailable && !hasLiving)) return this.finish();
    return null;
  }

  _pickTarget(building, candidates) {
    if (!candidates.length) return null;
    if (building.defense.targetPriority === 'highestHp') return [...candidates].sort((a,b)=>b.hp-a.hp)[0];
    if (building.defense.targetPriority === 'cluster') {
      return [...candidates].sort((a,b)=>this._clusterScore(b,candidates)-this._clusterScore(a,candidates))[0];
    }
    return [...candidates].sort((a,b)=>dist(a,building)-dist(b,building))[0];
  }

  _clusterScore(unit, units) {
    return units.reduce((s,other)=>s+(dist(unit,other)<=58?1:0),0);
  }

  finish() {
    const battle = this.state;
    if (!battle?.active) return battle?.result ?? null;
    battle.active = false;
    const scoring = battle.buildings.filter((b) => !b.trap);
    const totalHp = scoring.reduce((s,b)=>s+b.maxHp, 0);
    const remainHp = scoring.reduce((s,b)=>s+Math.max(0,b.hp), 0);
    const destruction = Math.round((1 - remainHp / totalHp) * 100);
    const throneDown = battle.buildings.find((b)=>b.id==='enemy-throne')?.hp <= 0;
    const stars = destruction === 100 ? 3 : throneDown ? 2 : destruction >= 50 ? 1 : 0;
    const ratio = destruction / 100;
    const loot = Object.fromEntries(Object.entries(BATTLE_CONFIG.loot).map(([k,v])=>[k,Math.round(v*ratio)]));
    battle.result = { destruction, stars, loot };
    return battle.result;
  }

  _closestBuilding(unit) {
    return this.state.buildings
      .filter((b) => b.hp > 0 && !b.trap)
      .sort((a,b) => dist(unit,a) - dist(unit,b))[0] ?? null;
  }
}
