export class Grid {
  constructor({ columns = 18, rows = 18, tileWidth = 92, tileHeight = 46 } = {}) {
    this.columns = columns;
    this.rows = rows;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
  }

  gridToScreen(col, row, camera, viewport) {
    const originX = viewport.width / 2 + camera.x;
    const originY = viewport.height * 0.18 + camera.y;
    return {
      x: originX + (col - row) * (this.tileWidth / 2) * camera.zoom,
      y: originY + (col + row) * (this.tileHeight / 2) * camera.zoom
    };
  }

  screenToGrid(x, y, camera, viewport) {
    const originX = viewport.width / 2 + camera.x;
    const originY = viewport.height * 0.18 + camera.y;
    const worldX = (x - originX) / camera.zoom;
    const worldY = (y - originY) / camera.zoom;
    return {
      col: Math.floor((worldY / (this.tileHeight / 2) + worldX / (this.tileWidth / 2)) / 2),
      row: Math.floor((worldY / (this.tileHeight / 2) - worldX / (this.tileWidth / 2)) / 2)
    };
  }

  cellsFor(building, definition) {
    const cells = [];
    for (let dx = 0; dx < definition.size.w; dx += 1) {
      for (let dy = 0; dy < definition.size.h; dy += 1) cells.push(`${building.col + dx},${building.row + dy}`);
    }
    return cells;
  }

  canPlace(type, col, row, definitions, buildings, ignoreId = null) {
    const definition = definitions[type];
    if (!definition) return false;
    if (col < 0 || row < 0 || col + definition.size.w > this.columns || row + definition.size.h > this.rows) return false;
    const occupied = new Set();
    for (const building of buildings) {
      if (building.id === ignoreId) continue;
      this.cellsFor(building, definitions[building.type]).forEach((cell) => occupied.add(cell));
    }
    for (let dx = 0; dx < definition.size.w; dx += 1) {
      for (let dy = 0; dy < definition.size.h; dy += 1) {
        if (occupied.has(`${col + dx},${row + dy}`)) return false;
      }
    }
    return true;
  }

  buildingAt(col, row, definitions, buildings) {
    return [...buildings].reverse().find((building) => {
      const size = definitions[building.type].size;
      return col >= building.col && row >= building.row && col < building.col + size.w && row < building.row + size.h;
    }) || null;
  }
}
