export class Grid {
  constructor({ columns = 24, rows = 24, tileWidth = 88, tileHeight = 44 } = {}) {
    this.columns = columns;
    this.rows = rows;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
  }

  unlockedBounds(state) {
    const throneLevel = state?.buildings?.find((building) => building.type === 'townHall')?.level ?? 1;
    const sizeByLevel = { 1: 18, 2: 20, 3: 22, 4: 24, 5: 24 };
    const unlockedSize = sizeByLevel[throneLevel] ?? 24;
    const marginCol = Math.floor((this.columns - unlockedSize) / 2);
    const marginRow = Math.floor((this.rows - unlockedSize) / 2);
    return {
      minCol: marginCol,
      minRow: marginRow,
      maxCol: marginCol + unlockedSize,
      maxRow: marginRow + unlockedSize
    };
  }

  gridToScreen(col, row, camera, viewport) {
    const originX = viewport.width / 2 + camera.x;
    const originY = viewport.height * 0.14 + camera.y;
    return {
      x: originX + (col - row) * (this.tileWidth / 2) * camera.zoom,
      y: originY + (col + row) * (this.tileHeight / 2) * camera.zoom
    };
  }

  screenToGrid(x, y, camera, viewport) {
    const originX = viewport.width / 2 + camera.x;
    const originY = viewport.height * 0.14 + camera.y;
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

  canPlace(type, col, row, definitions, buildings, ignoreId = null, state = null) {
    const definition = definitions[type];
    if (!definition) return false;
    const bounds = state ? this.unlockedBounds(state) : { minCol: 0, minRow: 0, maxCol: this.columns, maxRow: this.rows };
    if (col < bounds.minCol || row < bounds.minRow || col + definition.size.w > bounds.maxCol || row + definition.size.h > bounds.maxRow) return false;
    const occupied = new Set();
    for (const building of buildings) {
      if (building.id === ignoreId) continue;
      const otherDefinition = definitions[building.type];
      if (!otherDefinition) continue;
      this.cellsFor(building, otherDefinition).forEach((cell) => occupied.add(cell));
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
      const size = definitions[building.type]?.size;
      if (!size) return false;
      return col >= building.col && row >= building.row && col < building.col + size.w && row < building.row + size.h;
    }) || null;
  }
}
