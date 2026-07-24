export const BATTLE_CONFIG = {
  durationSeconds: 90,
  loot: { gold: 420, wood: 360, essence: 110 }
};

export const ENEMY_BUILDINGS = [
  { id: 'enemy-throne', type: 'townHall', x: 0.50, y: 0.45, hp: 900, maxHp: 900, radius: 42, lootWeight: 3 },
  { id: 'enemy-mine', type: 'goldMine', x: 0.32, y: 0.38, hp: 360, maxHp: 360, radius: 30, lootWeight: 1 },
  { id: 'enemy-vault', type: 'soulVault', x: 0.68, y: 0.38, hp: 420, maxHp: 420, radius: 32, lootWeight: 1 },
  { id: 'enemy-barracks', type: 'barracks', x: 0.37, y: 0.60, hp: 480, maxHp: 480, radius: 34, lootWeight: 1 },
  { id: 'enemy-tower-a', type: 'runeTower', x: 0.62, y: 0.61, hp: 340, maxHp: 340, radius: 28, lootWeight: 1, defense: { range: 150, damage: 24, cooldown: 1.2 } },
  { id: 'enemy-tower-b', type: 'runeTower', x: 0.50, y: 0.26, hp: 340, maxHp: 340, radius: 28, lootWeight: 1, defense: { range: 150, damage: 24, cooldown: 1.2 } }
];
