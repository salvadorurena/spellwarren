import type { Cell, Layout } from './layout';
import { ROOM_COLS, ROOM_ROWS, TILE } from './tuning';

/** A position in the Room, in Room pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export function cellAt(point: Point): Cell {
  return { col: Math.floor(point.x / TILE), row: Math.floor(point.y / TILE) };
}

export function cellCentre(cell: Cell): Point {
  return { x: cell.col * TILE + TILE / 2, y: cell.row * TILE + TILE / 2 };
}

/** True for a wall cell and for anywhere outside the Room. */
export function isWall(layout: Layout, cell: Cell): boolean {
  return layout.walls[cell.row]?.[cell.col] !== false;
}

/**
 * True if nothing stands between two points. With a half-width, the check
 * is for something that wide walking the line, not just seeing along it.
 */
export function lineIsClear(layout: Layout, from: Point, to: Point, halfWidth = 0): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return !isWall(layout, cellAt(from));

  // Sideways offsets: the middle of the line, and each edge of the walker.
  const nx = (-dy / length) * halfWidth;
  const ny = (dx / length) * halfWidth;
  const offsets = halfWidth > 0 ? [0, 1, -1] : [0];

  const steps = Math.ceil(length / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    for (const side of offsets) {
      const point = { x: from.x + dx * t + nx * side, y: from.y + dy * t + ny * side };
      if (isWall(layout, cellAt(point))) return false;
    }
  }
  return true;
}

const STEPS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * For every floor cell of a Layout, how far it is to walk to a target cell
 * (the Hero's), and which neighbouring cell is the next step on the way.
 * Enemies follow it to get round walls.
 */
export class FlowField {
  private distances: number[] = [];
  private target: Cell | null = null;

  constructor(private readonly layout: Layout) {}

  /** Points the field at a new target. Does nothing if the target cell is unchanged. */
  retarget(target: Cell): void {
    if (this.target && this.target.col === target.col && this.target.row === target.row) return;
    this.target = target;
    this.distances = new Array<number>(ROOM_COLS * ROOM_ROWS).fill(Infinity);
    if (isWall(this.layout, target)) return;

    // Dijkstra over a few hundred cells; a plain list is fast enough.
    const open: Cell[] = [target];
    this.distances[index(target)] = 0;
    while (open.length > 0) {
      let best = 0;
      for (let i = 1; i < open.length; i++) {
        if (this.distance(open[i] as Cell) < this.distance(open[best] as Cell)) best = i;
      }
      const cell = open.splice(best, 1)[0] as Cell;
      const here = this.distance(cell);
      for (const [dc, dr] of STEPS) {
        const next = { col: cell.col + dc, row: cell.row + dr };
        if (!this.canStep(cell, dc, dr)) continue;
        const cost = here + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
        if (cost < this.distance(next)) {
          if (this.distance(next) === Infinity) open.push(next);
          this.distances[index(next)] = cost;
        }
      }
    }
  }

  /** Walking distance in tiles from a cell to the target; Infinity if there is no way. */
  distance(cell: Cell): number {
    if (cell.col < 0 || cell.row < 0 || cell.col >= ROOM_COLS || cell.row >= ROOM_ROWS) {
      return Infinity;
    }
    return this.distances[index(cell)] ?? Infinity;
  }

  /**
   * The neighbouring cell to walk to next. Null when already at the target
   * or when there is no way to it.
   */
  next(cell: Cell): Cell | null {
    let best: Cell | null = null;
    let bestDistance = this.distance(cell);
    for (const [dc, dr] of STEPS) {
      if (!this.canStep(cell, dc, dr)) continue;
      const neighbour = { col: cell.col + dc, row: cell.row + dr };
      const distance = this.distance(neighbour);
      if (distance < bestDistance) {
        best = neighbour;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** A step is allowed onto floor, and diagonally only if it does not cut a wall's corner. */
  private canStep(from: Cell, dc: number, dr: number): boolean {
    if (isWall(this.layout, { col: from.col + dc, row: from.row + dr })) return false;
    if (dc === 0 || dr === 0) return true;
    return (
      !isWall(this.layout, { col: from.col + dc, row: from.row }) &&
      !isWall(this.layout, { col: from.col, row: from.row + dr })
    );
  }
}

function index(cell: Cell): number {
  return cell.row * ROOM_COLS + cell.col;
}
