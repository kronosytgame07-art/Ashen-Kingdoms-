import { Game } from './core/Game.js';

const canvas = document.getElementById('gameCanvas');
if (!canvas) throw new Error('Canvas #gameCanvas introuvable');

const game = new Game(canvas);
game.start().catch((error) => {
  console.error('[Ashen Kingdoms] Échec du démarrage :', error);
  const toast = document.getElementById('toast');
  if (toast) { toast.textContent = 'Erreur de chargement du jeu'; toast.classList.add('show'); }
});
