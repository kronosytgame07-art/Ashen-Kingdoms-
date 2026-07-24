export const TOWN_HALL_UNLOCKS = {
  1: ['goldMine', 'lumberMill', 'essenceWell', 'barracks', 'wall'],
  2: ['soulVault'],
  3: ['runeTower']
};

export const QUESTS = [
  { id: 'build-gold', text: 'Construisez une Mine d’or corrompu', type: 'build', target: 'goldMine', reward: { gold: 120 } },
  { id: 'build-barracks', text: 'Élevez une Caserne maudite', type: 'build', target: 'barracks', reward: { wood: 150 } },
  { id: 'train-skeleton', text: 'Entraînez votre premier Squelette-lancier', type: 'train', target: 'skeleton', value: 1, reward: { essence: 60 } },
  { id: 'upgrade-throne', text: 'Améliorez le Trône corrompu au niveau 2', type: 'level', target: 'townHall', value: 2, reward: { essence: 40 } },
  { id: 'build-vault', text: 'Construisez un Caveau d’âmes', type: 'build', target: 'soulVault', reward: { gold: 250, wood: 200 } }
];

export function townHallLevel(state) {
  return state.buildings.find((building) => building.type === 'townHall')?.level ?? 1;
}

export function isBuildingUnlocked(type, state) {
  if (type === 'townHall') return true;
  const level = townHallLevel(state);
  return Object.entries(TOWN_HALL_UNLOCKS).some(([required, types]) => Number(required) <= level && types.includes(type));
}

export function maxLevelFor(type, state, definitions) {
  if (type === 'townHall') return definitions[type].maxLevel;
  return Math.min(definitions[type].maxLevel, townHallLevel(state));
}
