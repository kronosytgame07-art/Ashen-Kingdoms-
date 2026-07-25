import { DRAW_FN } from './BuildingArtist.js';

/*
 * Empêche les bâtiments de devenir visuellement plus hauts que leur empreinte
 * isométrique. BuildingArtist ajoute tours, flèches et créneaux à partir de
 * wallH : réduire cette valeur conserve le dessin complet sans énorme toit.
 */
for (const [type, draw] of Object.entries(DRAW_FN)) {
  if (typeof draw !== 'function' || draw.__heightLimited) continue;

  const limitedDraw = function(ctx, iso, level, time, flicker, selected) {
    const footprintHeight = Math.max(1, (iso.sw + iso.sh) * iso.tileH / 2);
    const wallRatio = type === 'townHall' ? 0.20 : 0.28;
    const limitedIso = {
      ...iso,
      wallH: Math.min(iso.wallH, footprintHeight * wallRatio)
    };
    return draw(ctx, limitedIso, level, time, flicker, selected);
  };

  Object.defineProperty(limitedDraw, '__heightLimited', { value: true });
  DRAW_FN[type] = limitedDraw;
}
