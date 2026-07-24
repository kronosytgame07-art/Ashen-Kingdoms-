/**
 * battle.js — Ashen Kingdoms
 *
 * Le village ennemi est défini en CASES ISO (col, row) sur une grille 20×20.
 * BattleManager convertit ces cases en px via Grid.gridToScreen().
 *
 * generateEnemyBase(playerTownHallLevel) crée un village adaptatif :
 *   - HDV niveau = playerLevel ± 1 (aléatoire)
 *   - Bâtiments défensifs, ressources, pièges proportionnels
 *
 * Chaque bâtiment a :
 *   col, row   : position iso (coin nord-ouest de l'empreinte)
 *   size       : { w, h } en cases (même que buildings.js)
 *   spawnBuffer: cases autour interdites au spawn (2 par défaut, 1 pour murs)
 */

export const BATTLE_CONFIG = {
  durationSeconds: 180,
  gridCols: 20,
  gridRows: 20,
  tileWidth: 88,
  tileHeight: 44,
  loot: { gold: 420, wood: 360, essence: 110 },
};

// ─ Templates de village par niveau HDV ─────────────────────────────────────
// Chaque entrée = liste de bâtiments avec position cas-iso
const BASE_TEMPLATES = {
  1: [
    { id:'th',   type:'townHall',     col:8,  row:8,  size:{w:2,h:2}, hp:600,  maxHp:600,  lootWeight:3 },
    { id:'gm1',  type:'goldMine',     col:4,  row:5,  size:{w:2,h:2}, hp:280,  maxHp:280,  lootWeight:1 },
    { id:'sv1',  type:'soulVault',    col:12, row:5,  size:{w:2,h:2}, hp:300,  maxHp:300,  lootWeight:1 },
    { id:'bar1', type:'barracks',     col:5,  row:12, size:{w:2,h:2}, hp:320,  maxHp:320,  lootWeight:1 },
    { id:'rt1',  type:'runeTower',    col:13, row:12, size:{w:1,h:1}, hp:240,  maxHp:240,  lootWeight:1,
      defense:{ range:7, damage:18, cooldown:1.4, attackType:'single', targetPriority:'nearest', targets:['ground','air'] } },
    { id:'w1',   type:'wall',         col:6,  row:7,  size:{w:1,h:1}, hp:200,  maxHp:200,  lootWeight:0, isWall:true },
    { id:'w2',   type:'wall',         col:7,  row:7,  size:{w:1,h:1}, hp:200,  maxHp:200,  lootWeight:0, isWall:true },
    { id:'w3',   type:'wall',         col:10, row:7,  size:{w:1,h:1}, hp:200,  maxHp:200,  lootWeight:0, isWall:true },
    { id:'w4',   type:'wall',         col:11, row:7,  size:{w:1,h:1}, hp:200,  maxHp:200,  lootWeight:0, isWall:true },
    { id:'w5',   type:'wall',         col:6,  row:11, size:{w:1,h:1}, hp:200,  maxHp:200,  lootWeight:0, isWall:true },
    { id:'w6',   type:'wall',         col:11, row:11, size:{w:1,h:1}, hp:200,  maxHp:200,  lootWeight:0, isWall:true },
    { id:'tr1',  type:'cursedTrap',   col:8,  row:6,  size:{w:1,h:1}, hp:1, maxHp:1, lootWeight:0,
      hidden:true, triggered:false, trap:{ damage:70, triggerRadius:1.5, splashRadius:2, targets:['ground'] } },
  ],
  2: [
    { id:'th',   type:'townHall',     col:8,  row:8,  size:{w:2,h:2}, hp:800,  maxHp:800,  lootWeight:3 },
    { id:'gm1',  type:'goldMine',     col:4,  row:5,  size:{w:2,h:2}, hp:320,  maxHp:320,  lootWeight:1 },
    { id:'gm2',  type:'goldMine',     col:13, row:5,  size:{w:2,h:2}, hp:320,  maxHp:320,  lootWeight:1 },
    { id:'sv1',  type:'soulVault',    col:6,  row:13, size:{w:2,h:2}, hp:380,  maxHp:380,  lootWeight:1 },
    { id:'bar1', type:'barracks',     col:12, row:13, size:{w:2,h:2}, hp:380,  maxHp:380,  lootWeight:1 },
    { id:'rt1',  type:'runeTower',    col:3,  row:10, size:{w:1,h:1}, hp:300,  maxHp:300,  lootWeight:1,
      defense:{ range:7, damage:22, cooldown:1.3, attackType:'single', targetPriority:'nearest', targets:['ground','air'] } },
    { id:'rt2',  type:'runeTower',    col:15, row:10, size:{w:1,h:1}, hp:300,  maxHp:300,  lootWeight:1,
      defense:{ range:7, damage:22, cooldown:1.3, attackType:'single', targetPriority:'nearest', targets:['ground','air'] } },
    { id:'bc1',  type:'boneCatapult', col:9,  row:4,  size:{w:2,h:2}, hp:360,  maxHp:360,  lootWeight:1,
      defense:{ range:9, damage:28, cooldown:2.2, attackType:'splash', splashRadius:2.5, targetPriority:'cluster', targets:['ground'] } },
    { id:'w1',   type:'wall', col:6, row:7,  size:{w:1,h:1}, hp:300, maxHp:300, lootWeight:0, isWall:true },
    { id:'w2',   type:'wall', col:7, row:7,  size:{w:1,h:1}, hp:300, maxHp:300, lootWeight:0, isWall:true },
    { id:'w3',   type:'wall', col:8, row:7,  size:{w:1,h:1}, hp:300, maxHp:300, lootWeight:0, isWall:true },
    { id:'w4',   type:'wall', col:9, row:7,  size:{w:1,h:1}, hp:300, maxHp:300, lootWeight:0, isWall:true },
    { id:'w5',   type:'wall', col:10, row:7, size:{w:1,h:1}, hp:300, maxHp:300, lootWeight:0, isWall:true },
    { id:'w6',   type:'wall', col:11, row:7, size:{w:1,h:1}, hp:300, maxHp:300, lootWeight:0, isWall:true },
    { id:'w7',   type:'wall', col:6, row:11, size:{w:1,h:1}, hp:300, maxHp:300, lootWeight:0, isWall:true },
    { id:'w8',   type:'wall', col:11, row:11,size:{w:1,h:1}, hp:300, maxHp:300, lootWeight:0, isWall:true },
    { id:'tr1',  type:'cursedTrap', col:9, row:10, size:{w:1,h:1}, hp:1, maxHp:1, lootWeight:0,
      hidden:true, triggered:false, trap:{ damage:80, triggerRadius:1.5, splashRadius:2, targets:['ground'] } },
    { id:'tr2',  type:'cursedTrap', col:5, row:9,  size:{w:1,h:1}, hp:1, maxHp:1, lootWeight:0,
      hidden:true, triggered:false, trap:{ damage:80, triggerRadius:1.5, splashRadius:2.2, targets:['ground'] } },
  ],
  3: [
    { id:'th',   type:'townHall',     col:8,  row:8,  size:{w:3,h:3}, hp:1100, maxHp:1100, lootWeight:3 },
    { id:'gm1',  type:'goldMine',     col:3,  row:4,  size:{w:2,h:2}, hp:380,  maxHp:380,  lootWeight:1 },
    { id:'gm2',  type:'goldMine',     col:14, row:4,  size:{w:2,h:2}, hp:380,  maxHp:380,  lootWeight:1 },
    { id:'sv1',  type:'soulVault',    col:3,  row:12, size:{w:2,h:2}, hp:440,  maxHp:440,  lootWeight:1 },
    { id:'sv2',  type:'soulVault',    col:14, row:12, size:{w:2,h:2}, hp:440,  maxHp:440,  lootWeight:1 },
    { id:'bar1', type:'barracks',     col:8,  row:14, size:{w:2,h:2}, hp:460,  maxHp:460,  lootWeight:1 },
    { id:'rt1',  type:'runeTower',    col:2,  row:8,  size:{w:1,h:1}, hp:380,  maxHp:380,  lootWeight:1,
      defense:{ range:8, damage:26, cooldown:1.2, attackType:'single', targetPriority:'nearest', targets:['ground','air'] } },
    { id:'rt2',  type:'runeTower',    col:17, row:8,  size:{w:1,h:1}, hp:380,  maxHp:380,  lootWeight:1,
      defense:{ range:8, damage:26, cooldown:1.2, attackType:'single', targetPriority:'nearest', targets:['ground','air'] } },
    { id:'rt3',  type:'runeTower',    col:9,  row:3,  size:{w:1,h:1}, hp:380,  maxHp:380,  lootWeight:1,
      defense:{ range:8, damage:26, cooldown:1.2, attackType:'single', targetPriority:'nearest', targets:['ground','air'] } },
    { id:'bc1',  type:'boneCatapult', col:4,  row:7,  size:{w:2,h:2}, hp:480,  maxHp:480,  lootWeight:1,
      defense:{ range:9, damage:35, cooldown:2.0, attackType:'splash', splashRadius:3, targetPriority:'cluster', targets:['ground'] } },
    { id:'bc2',  type:'boneCatapult', col:13, row:7,  size:{w:2,h:2}, hp:480,  maxHp:480,  lootWeight:1,
      defense:{ range:9, damage:35, cooldown:2.0, attackType:'splash', splashRadius:3, targetPriority:'cluster', targets:['ground'] } },
    { id:'ss1',  type:'soulSpire',    col:9,  row:16, size:{w:1,h:1}, hp:340,  maxHp:340,  lootWeight:1,
      defense:{ range:10, damage:30, cooldown:1.5, attackType:'single', targetPriority:'highestHp', targets:['air'] } },
    { id:'w1',  type:'wall', col:6,  row:7,  size:{w:1,h:1}, hp:420, maxHp:420, lootWeight:0, isWall:true },
    { id:'w2',  type:'wall', col:7,  row:7,  size:{w:1,h:1}, hp:420, maxHp:420, lootWeight:0, isWall:true },
    { id:'w3',  type:'wall', col:11, row:7,  size:{w:1,h:1}, hp:420, maxHp:420, lootWeight:0, isWall:true },
    { id:'w4',  type:'wall', col:12, row:7,  size:{w:1,h:1}, hp:420, maxHp:420, lootWeight:0, isWall:true },
    { id:'w5',  type:'wall', col:6,  row:12, size:{w:1,h:1}, hp:420, maxHp:420, lootWeight:0, isWall:true },
    { id:'w6',  type:'wall', col:12, row:12, size:{w:1,h:1}, hp:420, maxHp:420, lootWeight:0, isWall:true },
    { id:'w7',  type:'wall', col:7,  row:12, size:{w:1,h:1}, hp:420, maxHp:420, lootWeight:0, isWall:true },
    { id:'w8',  type:'wall', col:11, row:12, size:{w:1,h:1}, hp:420, maxHp:420, lootWeight:0, isWall:true },
    { id:'tr1', type:'cursedTrap', col:9,  row:11, size:{w:1,h:1}, hp:1, maxHp:1, lootWeight:0,
      hidden:true, triggered:false, trap:{ damage:90, triggerRadius:1.5, splashRadius:2.5, targets:['ground'] } },
    { id:'tr2', type:'cursedTrap', col:6,  row:9,  size:{w:1,h:1}, hp:1, maxHp:1, lootWeight:0,
      hidden:true, triggered:false, trap:{ damage:90, triggerRadius:1.5, splashRadius:2.5, targets:['ground'] } },
    { id:'tr3', type:'cursedTrap', col:13, row:9,  size:{w:1,h:1}, hp:1, maxHp:1, lootWeight:0,
      hidden:true, triggered:false, trap:{ damage:90, triggerRadius:1.5, splashRadius:2.5, targets:['ground'] } },
  ],
};

/**
 * Génère le village ennemi adapté au niveau HDV du joueur.
 * enemyLevel = playerLevel + random(-1, +1), clampé 1–3.
 */
export function generateEnemyBase(playerTownHallLevel = 1) {
  const delta     = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
  const lvl       = Math.max(1, Math.min(3, playerTownHallLevel + delta));
  const template  = BASE_TEMPLATES[lvl] ?? BASE_TEMPLATES[1];
  // Deep-clone + tag du niveau
  return template.map(b => ({ ...b,
    id: `enemy-${b.id}`,
    enemyLevel: lvl,
    cooldownLeft: 0,
  }));
}

// Export legacy pour compatibilité (non utilisé si generateEnemyBase est appelé)
export const ENEMY_BUILDINGS = BASE_TEMPLATES[1].map(b => ({ ...b, id:`enemy-${b.id}`, cooldownLeft:0 }));

export { BATTLE_CONFIG };
