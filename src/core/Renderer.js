/**
 * Renderer.js — thin facade
 * Delegates village rendering to VillageRenderer and battle rendering to BattleRenderer.
 * Keeps resize() and viewport() here so Game.js has a single point of entry.
 */
import { VillageRenderer } from './VillageRenderer.js';
import { BattleRenderer } from './BattleRenderer.js';

// Applique le remplacement visuel du Trône après le chargement de VillageRenderer.
// Ce module surcharge uniquement drawBuilding() pour townHall et laisse tous les
// autres bâtiments utiliser leur rendu procédural actuel.
import './SpriteTownHallPatch.js';

export class Renderer {
  constructor(canvas, grid, definitions, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this._dpr = dpr;
    this.village = new VillageRenderer(canvas, grid, definitions, assets);
    this.battle = new BattleRenderer(canvas);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this._dpr = dpr;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }

  render(state, interaction, time, battleState = null) {
    if (battleState?.active || battleState?.result) {
      this.battle.render(battleState, time);
    } else {
      this.village.render(state, interaction, time);
    }
  }
}
