export const UNITS = {
  skeleton: {
    name: 'Squelette-lancier',
    description: 'Infanterie rapide et peu coûteuse.',
    cost: { essence: 20 },
    trainTime: 6,
    housing: 1,
    unlockBarracksLevel: 1,
    stats: { hp: 120, damage: 18, speed: 1.2, range: 0.8 },
    colors: ['#c9c1b5', '#5f536b', '#a66cff']
  },
  ghoul: {
    name: 'Goule',
    description: 'Créature robuste conçue pour absorber les dégâts.',
    cost: { essence: 45 },
    trainTime: 12,
    housing: 2,
    unlockBarracksLevel: 2,
    stats: { hp: 240, damage: 32, speed: 0.9, range: 0.7 },
    colors: ['#6f7c66', '#2f382d', '#9bb08f']
  },
  necromancer: {
    name: 'Nécromancien',
    description: 'Mage fragile qui inflige des dégâts à distance.',
    cost: { essence: 90 },
    trainTime: 24,
    housing: 3,
    unlockBarracksLevel: 3,
    stats: { hp: 150, damage: 42, speed: 0.75, range: 3.5 },
    colors: ['#2e2238', '#15111d', '#c28cff']
  }
};

export function barracksLevel(state) {
  return Math.max(0, ...state.buildings.filter((building) => building.type === 'barracks' && building.readyAt <= Date.now()).map((building) => building.level));
}

export function isUnitUnlocked(type, state) {
  const definition = UNITS[type];
  return Boolean(definition && barracksLevel(state) >= definition.unlockBarracksLevel);
}

export function armyCapacity(state) {
  const barracks = state.buildings.filter((building) => building.type === 'barracks' && building.readyAt <= Date.now());
  return barracks.reduce((total, building) => total + 8 + (building.level - 1) * 4, 0);
}

export function armyHousing(state) {
  return Object.entries(state.army ?? {}).reduce((total, [type, amount]) => total + (UNITS[type]?.housing ?? 0) * amount, 0);
}
