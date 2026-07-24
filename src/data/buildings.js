export const RESOURCE_LABELS = { gold: 'Or corrompu', wood: 'Bois noir', essence: 'Âmes' };

export const BUILDINGS = {
  townHall: {
    name: 'Trône corrompu',
    description: 'Cœur du royaume. Son niveau limite celui des autres bâtiments.',
    size: { w: 3, h: 3 }, cost: {}, buildTime: 0, maxLevel: 5, production: null,
    storage: { gold: 1200, wood: 1200, essence: 300 },
    colors: ['#29222f', '#18151d', '#a66cff'], sprite: 'assets/buildings/hdv1.png', category: 'core'
  },
  goldMine: {
    name: 'Mine d’or corrompu', description: 'Extrait de l’or souillé des profondeurs.',
    size: { w: 2, h: 2 }, cost: { wood: 120 }, buildTime: 8, maxLevel: 5,
    production: { resource: 'gold', perSecond: 2.2 }, storage: null,
    colors: ['#41362d', '#211b18', '#e7bb55'], sprite: null, category: 'resource'
  },
  lumberMill: {
    name: 'Scierie maudite', description: 'Transforme les arbres morts en bois noir.',
    size: { w: 2, h: 2 }, cost: { gold: 100 }, buildTime: 8, maxLevel: 5,
    production: { resource: 'wood', perSecond: 2.2 }, storage: null,
    colors: ['#3b2c24', '#251b18', '#bc8a50'], sprite: null, category: 'resource'
  },
  essenceWell: {
    name: 'Puits d’âmes', description: 'Condense les murmures des défunts.',
    size: { w: 2, h: 2 }, cost: { gold: 160 }, buildTime: 10, maxLevel: 5,
    production: { resource: 'essence', perSecond: 0.45 }, storage: null,
    colors: ['#25202c', '#17131c', '#b982ff'], sprite: null, category: 'resource'
  },
  soulVault: {
    name: 'Caveau d’âmes', description: 'Augmente fortement la capacité de stockage du royaume.',
    size: { w: 2, h: 2 }, cost: { gold: 260, wood: 220 }, buildTime: 18, maxLevel: 5,
    production: null, storage: { gold: 900, wood: 900, essence: 450 },
    colors: ['#2b2632', '#17131d', '#8b62cf'], sprite: null, category: 'storage'
  },
  barracks: {
    name: 'Caserne maudite', description: 'Prépare les légions du royaume.',
    size: { w: 3, h: 3 }, cost: { wood: 220 }, buildTime: 12, maxLevel: 5,
    production: null, storage: null,
    colors: ['#30272b', '#1d171b', '#b4424e'], sprite: null, category: 'army'
  },
  runeTower: {
    name: 'Tour runique', description: 'Défense automatique alimentée par des runes instables.',
    size: { w: 2, h: 2 }, cost: { gold: 320, essence: 35 }, buildTime: 22, maxLevel: 5,
    production: null, storage: null,
    defense: { damage: 18, range: 4.5, cooldown: 1.1 },
    colors: ['#25232d', '#131118', '#c16eff'], sprite: null, category: 'defense'
  },
  wall: {
    name: 'Rempart d’ossements', description: 'Segment défensif qui se raccorde à ses voisins.',
    size: { w: 1, h: 1 }, cost: { gold: 25 }, buildTime: 0, maxLevel: 5,
    production: null, storage: null,
    colors: ['#47414c', '#242029', '#887796'], sprite: null, category: 'defense'
  }
};

export function upgradeCost(building) {
  const base = building.type === 'townHall' ? 240 : building.type === 'wall' ? 45 : 90;
  const factor = Math.pow(building.type === 'townHall' ? 1.75 : 1.55, building.level - 1);
  return { gold: Math.round(base * factor), wood: Math.round(base * 0.78 * factor) };
}

export function upgradeTime(building) {
  const base = building.type === 'townHall' ? 18 : building.type === 'wall' ? 4 : 7;
  return Math.round(base + building.level * (building.type === 'townHall' ? 8 : 3.5));
}

export function resourceCaps(state) {
  const caps = { gold: 0, wood: 0, essence: 0 };
  for (const building of state.buildings) {
    if (building.readyAt > Date.now()) continue;
    const storage = BUILDINGS[building.type]?.storage;
    if (!storage) continue;
    const multiplier = 1 + (building.level - 1) * 0.55;
    for (const [resource, value] of Object.entries(storage)) caps[resource] += Math.round(value * multiplier);
  }
  return {
    gold: Math.max(650, caps.gold),
    wood: Math.max(650, caps.wood),
    essence: Math.max(120, caps.essence)
  };
}
