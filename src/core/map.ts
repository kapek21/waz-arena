import { COLS, ROWS, type Cell } from './types.js';
import { mulberry32, pickInt } from './rng.js';

export function emptyGrid(): boolean[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false));
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

export function isBorder(x: number, y: number): boolean {
  return x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
}

export function buildWalls(seed: number): boolean[][] {
  const walls = emptyGrid();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (isBorder(x, y)) walls[y]![x] = true;
    }
  }
  const rand = mulberry32(seed ^ 0xa5a5a5a5);
  const count = pickInt(rand, 8, 12);
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 400) {
    guard += 1;
    const x = pickInt(rand, 2, COLS - 3);
    const y = pickInt(rand, 2, ROWS - 3);
    if (y >= 6 && y <= 9 && x >= 2 && x <= 8) continue;
    if (walls[y]![x]) continue;
    walls[y]![x] = true;
    placed += 1;
  }
  return walls;
}

export function occupiedSet(body: Cell[], orbs: Cell[]): Set<string> {
  const set = new Set<string>();
  for (const c of body) set.add(`${c.x},${c.y}`);
  for (const c of orbs) set.add(`${c.x},${c.y}`);
  return set;
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function freeCells(walls: boolean[][], blocked: Set<string>): Cell[] {
  const out: Cell[] = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (walls[y]![x]) continue;
      if (blocked.has(key(x, y))) continue;
      out.push({ x, y });
    }
  }
  return out;
}
