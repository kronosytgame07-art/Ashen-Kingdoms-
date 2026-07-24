export const RESOURCE_LABELS = { gold: 'Or corrompu', wood: 'Bois noir', essence: 'Âmes' };

export const BUILDINGS = {
  townHall: {
    name: 'Trône corrompu',
    description: 'Cœur du royaume. Son niveau limite celui des autres bâtiments et agrandit le domaine constructible.',
    size: { w: 4, h: 4 }, cost: {}, buildTime: 0, maxLevel: 5, production: null,
    storage: { gold: 1200, wood: 1200, essence: 300 },
    colors: ['#29222f', '#18151d', '#a66cff'], sprite: 'assets/buildings/hdv1.png', category: 'core'
  },
  goldMine: {
    name: 'Mine d’or corrompu', description: 'Extrait de l’or souillé des profondeurs.',
    size: { w: 2, h: 2 }, cost: { wood: 120 }, buildTime: 8, maxLevel: 5,
    production: null,
    extractor: { resource: 'gold', perSecond: 2.2, capacity: 180, collectThreshold: 12 },
    storage: null,
    colors: ['#41362d', '#211b18', '#e7bb55'], sprite: null, category: 'resource'
  },
  lumberMill: {
    name: 'Scierie maudite', description: 'Transforme les arbres morts en bois noir.',
    size: { w: 2, h: 2 }, cost: { gold: 100 }, buildTime: 8, maxLevel: 5,
    production: null,
    extractor: { resource: 'wood', perSecond: 2.2, capacity: 180, collectThreshold: 12 },
    storage: null,
    colors: ['#3b2c24', '#251b18', '#bc8a50'], sprite: null, category: 'resource'
  },
  essenceWell: {
    name: 'Puits d’âmes', description: 'Condense les murmures des défunts.',
    size: { w: 2, h: 2 }, cost: { gold: 160 }, buildTime: 10, maxLevel: 5,
    production: null,
    extractor: { resource: 'essence', perSecond: 0.45, capacity: 70, collectThreshold: 5 },
    storage: null,
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
    size: { w: 2, h: 2 }, cost: { wood: 220 }, buildTime: 12, maxLevel: 5,
    production: null, storage: null,
    colors: ['#30272b', '#1d171b', '#b4424e'], sprite: null, category: 'army', panel: 'barracks'
  },
  campfire: {
    name: 'Brasier rituel', description: 'Rassemble les troupes autour de flammes maudites et augmente la capacité d’armée.',
    size: { w: 2, h: 2 }, cost: { gold: 180, wood: 140 }, buildTime: 14, maxLevel: 5,
    production: null, storage: null, housing: { base: 12, perLevel: 6 },
    colors: ['#2b2228', '#171216', '#9dff7a'], sprite: null, category: 'army', panel: 'campfire'
  },
  clanCastle: {
    name: 'Château de Clan', description: 'Reçoit les renforts donnés par les membres du clan et les conserve pour la défense.',
    size: { w: 3, h: 3 }, cost: { gold: 850, wood: 700, essence: 120 }, buildTime: 40, maxLevel: 5,
    production: null, storage: null,
    reinforcementHousing: { base: 8, perLevel: 4 },
    colors: ['#31273a', '#17121c', '#d3a6ff'], sprite: null, category: 'army', panel: 'clanCastle', buildLimit: 1
  },
  runeTower: {
    name: 'Tour runique', description: 'Tire rapidement sur la cible la plus proche.',
    size: { w: 1, h: 1 }, cost: { gold: 320, essence: 35 }, buildTime: 22, maxLevel: 5,
    production: null, storage: null,
    defense: { damage: 18, range: 4.5, cooldown: 1.1, attackType: 'single', targetPriority: 'nearest', targets: ['ground','air'] },
    colors: ['#25232d', '#131118', '#c16eff'], sprite: null, category: 'defense'
  },
  boneCatapult: {
    name: 'Catapulte d’ossements', description: 'Projette des charges d’os qui blessent les groupes ennemis.',
    size: { w: 2, h: 2 }, cost: { gold: 520, wood: 340 }, buildTime: 28, maxLevel: 5,
    production: null, storage: null,
    defense: { damage: 34, range: 5.3, cooldown: 2.4, attackType: 'splash', splashRadius: 1.25, targetPriority: 'cluster', targets: ['ground'] },
    colors: ['#3c332f', '#1a1515', '#d66c5f'], sprite: null, category: 'defense'
  },
  soulSpire: {
    name: 'Flèche des âmes', description: 'Défense spécialisée contre les créatures volantes.',
    size: { w: 1, h: 1 }, cost: { gold: 420, essence: 95 }, buildTime: 26, maxLevel: 5,
    production: null, storage: null,
    defense: { damage: 29, range: 6.2, cooldown: 1.5, attackType: 'single', targetPriority: 'highestHp', targets: ['air'] },
    colors: ['#202531', '#10131b', '#79b7ff'], sprite: null, category: 'defense'
  },
  cursedTrap: {
    name: 'Piège maudit', description: 'Reste caché jusqu’à ce qu’une troupe marche dessus.',
    size: { w: 1, h: 1 }, cost: { gold: 120 }, buildTime: 5, maxLevel: 5,
    production: null, storage: null,
    trap: { damage: 80, triggerRadius: 0.65, splashRadius: 1.15, targets: ['ground'] },
    colors: ['#2d2328', '#140f12', '#ff596f'], sprite: null, category: 'trap'
  },
  wall: {
    name: 'Rempart d’ossements', description: 'Segment défensif qui se raccorde à ses voisins.',
    size: { w: 1, h: 1 }, cost: { gold: 25 }, buildTime: 0, maxLevel: 5,
    production: null, storage: null,
    colors: ['#47414c', '#242029', '#887796'], sprite: null, category: 'defense'
  }
};

export function upgradeCost(building) {
  const base = building.type === 'townHall' ? 240 : building.type === 'wall' ? 45 : building.type === 'cursedTrap' ? 70 : building.type === 'clanCastle' ? 220 : 90;
  const factor = Math.pow(building.type === 'townHall' ? 1.75 : 1.55, building.level - 1);
  return { gold: Math.round(base * factor), wood: Math.round(base * 0.78 * factor) };
}

export function upgradeTime(building) {
  const base = building.type === 'townHall' ? 18 : building.type === 'wall' ? 4 : building.type === 'cursedTrap' ? 5 : building.type === 'clanCastle' ? 18 : 7;
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