export const RESOURCE_LABELS = { gold: 'Or corrompu', wood: 'Bois noir', essence: 'Âmes' };

export const BUILDINGS = {
  townHall: { name: 'Hôtel de Ville', description: 'Cœur du royaume maudit.', size: { w: 3, h: 3 }, cost: {}, buildTime: 0, maxLevel: 10, production: null, storage: { gold: 1000, wood: 1000, essence: 250 }, colors: ['#29222f', '#18151d', '#a66cff'], sprite: null },
  goldMine: { name: 'Mine d’or', description: 'Extrait de l’or corrompu des profondeurs.', size: { w: 2, h: 2 }, cost: { wood: 120 }, buildTime: 8, maxLevel: 10, production: { resource: 'gold', perSecond: 3 }, storage: null, colors: ['#41362d', '#211b18', '#e7bb55'] },
  lumberMill: { name: 'Scierie', description: 'Transforme les arbres morts en bois noir.', size: { w: 2, h: 2 }, cost: { gold: 100 }, buildTime: 8, maxLevel: 10, production: { resource: 'wood', perSecond: 3 }, storage: null, colors: ['#3b2c24', '#251b18', '#bc8a50'] },
  essenceWell: { name: 'Puits d’âmes', description: 'Condense les murmures des défunts.', size: { w: 2, h: 2 }, cost: { gold: 160 }, buildTime: 10, maxLevel: 10, production: { resource: 'essence', perSecond: 1 }, storage: null, colors: ['#25202c', '#17131c', '#b982ff'] },
  barracks: { name: 'Caserne', description: 'Prépare les légions du royaume.', size: { w: 3, h: 3 }, cost: { wood: 220 }, buildTime: 12, maxLevel: 10, production: null, storage: null, colors: ['#30272b', '#1d171b', '#b4424e'] },
  wall: { name: 'Rempart d’ossements', description: 'Segment défensif qui se raccorde à ses voisins.', size: { w: 1, h: 1 }, cost: { gold: 25 }, buildTime: 0, maxLevel: 10, production: null, storage: null, colors: ['#47414c', '#242029', '#887796'] }
};

export function upgradeCost(building) {
  const factor = Math.pow(1.55, building.level - 1);
  return { gold: Math.round(90 * factor), wood: Math.round(70 * factor) };
}

export function upgradeTime(building) {
  return Math.round(7 + building.level * 3.5);
}
