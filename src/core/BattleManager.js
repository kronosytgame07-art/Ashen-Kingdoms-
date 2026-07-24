import { UNITS } from '../data/units.js';
import { BATTLE_CONFIG, ENEMY_BUILDINGS } from '../data/battle.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class BattleManager {
  constructor() { this.state = null; }

  start(playerState) {
    const available = Object.fromEntries(Object.keys(UNITS).map((type) => [type, playerState.army?.[type] ?? 0]));
    if (Object.values(available).every((count) => count <= 0)) return { ok: false, reason: 'Votre armée est vide' };
    this.state = {
      active: true,
      startedAt: performance.now(),
      elapsed: 0,
      timeLeft: BATTLE_CONFIG.durationSeconds,
      available,
      deployed: [],
      buildings: ENEMY_BUILDINGS.map((building) => ({ ...building, cooldownLeft: 0 })),
      effects: [],
      selectedUnit: Object.keys(available).find((type) => available[type] > 0) ?? null,
      result: null
    };
    return { ok: true };
  }

  selectUnit(type) {
    if (!this.state?.active || (this.state.available[type] ?? 0) <= 0) return false;
    this.state.selectedUnit = type;
    return true;
  }

  deploy(x, y, bounds) {
    const battle = this.state;
    const type = battle?.selectedUnit;
    if (!battle?.active || !type || battle.available[type] <= 0) return false;
    const unit = UNITS[type];
    battle.available[type] -= 1;
    battle.deployed.push({
      id: `${type}-${Date.now()}-${Math.random()}`,
      type,
      x: clamp(x, 24, bounds.width - 24),
      y: clamp(y, 24, bounds.height - 24),
      hp: unit.hp,
      maxHp: unit.hp,
      attackCooldown: 0,
      dead: false
    });
    return true;
  }

  update(dt, bounds) {
    const battle = this.state;
    if (!battle?.active) return null;
    battle.elapsed += dt;
    battle.timeLeft = Math.max(0, BATTLE_CONFIG.durationSeconds - battle.elapsed);

    for (const unit of battle.deployed) {
      if (unit.dead) continue;
      const target = this.closestBuilding(unit);
      if (!target) continue;
      const stats = UNITS[unit.type];
      const stopDistance = target.radius + 12;
      const d = distance(unit, target);
      unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
      if (d > stopDistance) {
        const speed = (stats.speed ?? 1) * 42;
        unit.x += ((target.x - unit.x) / d) * speed * dt;
        unit.y += ((target.y - unit.y) / d) * speed * dt;
      } else if (unit.attackCooldown <= 0) {
        const damage = stats.damage ?? 10;
        target.hp -= damage;
        unit.attackCooldown = 0.8;
        battle.effects.push({ x: target.x, y: target.y, life: 0.28, kind: 'hit' });
      }
    }

    for (const building of battle.buildings) {
      if (building.hp <= 0 || !building.defense) continue;
      building.cooldownLeft = Math.max(0, building.cooldownLeft - dt);
      if (building.cooldownLeft > 0) continue;
      const target = battle.deployed.filter((unit) => !unit.dead).sort((a, b) => distance(a, building) - distance(b, building))[0];
      if (!target || distance(target, building) > building.defense.range) continue;
      target.hp -= building.defense.damage;
      if (target.hp <= 0) target.dead = true;
      building.cooldownLeft = building.defense.cooldown;
      battle.effects.push({ x: target.x, y: target.y, life: 0.35, kind: 'shot' });
    }

    battle.effects.forEach((effect) => { effect.life -= dt; });
    battle.effects = battle.effects.filter((effect) => effect.life > 0);

    const remainingBuildings = battle.buildings.filter((building) => building.hp > 0);
    const hasAvailable = Object.values(battle.available).some((count) => count > 0);
    const hasLivingUnits = battle.deployed.some((unit) => !unit.dead);
    if (remainingBuildings.length === 0 || battle.timeLeft <= 0 || (!hasAvailable && !hasLivingUnits)) return this.finish();
    return null;
  }

  finish() {
    const battle = this.state;
    if (!battle?.active) return battle?.result ?? null;
    battle.active = false;
    const totalHp = battle.buildings.reduce((sum, building) => sum + building.maxHp, 0);
    const remainingHp = battle.buildings.reduce((sum, building) => sum + Math.max(0, building.hp), 0);
    const destruction = Math.round((1 - remainingHp / totalHp) * 100);
    const throneDestroyed = battle.buildings.find((building) => building.id === 'enemy-throne')?.hp <= 0;
    const stars = destruction === 100 ? 3 : throneDestroyed ? 2 : destruction >= 50 ? 1 : 0;
    const ratio = destruction / 100;
    const loot = Object.fromEntries(Object.entries(BATTLE_CONFIG.loot).map(([key, value]) => [key, Math.round(value * ratio)]));
    battle.result = { destruction, stars, loot };
    return battle.result;
  }

  closestBuilding(unit) {
    return this.state.buildings.filter((building) => building.hp > 0).sort((a, b) => distance(unit, a) - distance(unit, b))[0] ?? null;
  }
}
