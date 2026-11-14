import { ROOM_COLS, ROOM_ROWS } from './tuning';

export interface Cell {
  readonly col: number;
  readonly row: number;
}

/**
 * A hand-designed arrangement of walls that a Room is built on.
 * See GLOSSARY.md.
 */
export interface Layout {
  readonly name: string;
  /** walls[row][col] is true where a wall stands. */
  readonly walls: readonly (readonly boolean[])[];
  readonly floorCells: readonly Cell[];
  readonly heroStart: Cell;
}

/**
 * Builds a Layout from rows of text: `#` is wall, `.` is floor and `H` is
 * the floor cell where the Hero starts. Throws if the drawing is not a
 * playable Room, so a design mistake is caught by the tests rather than
 * by a player.
 */
export function parseLayout(name: string, rows: readonly string[]): Layout {
  const fail = (problem: string): never => {
    throw new Error(`Layout "${name}": ${problem}`);
  };

  if (rows.length !== ROOM_ROWS) fail(`expected ${ROOM_ROWS} rows, got ${rows.length}`);

  const walls: boolean[][] = [];
  const floorCells: Cell[] = [];
  let heroStart: Cell | undefined;

  rows.forEach((text, row) => {
    if (text.length !== ROOM_COLS) {
      fail(`row ${row} has ${text.length} columns, expected ${ROOM_COLS}`);
    }
    const wallRow: boolean[] = [];
    [...text].forEach((symbol, col) => {
      if (symbol !== '#' && symbol !== '.' && symbol !== 'H') {
        fail(`unknown symbol "${symbol}" at row ${row}, column ${col}`);
      }
      const isWall = symbol === '#';
      const onEdge = row === 0 || col === 0 || row === ROOM_ROWS - 1 || col === ROOM_COLS - 1;
      if (onEdge && !isWall) fail(`the outer edge is open at row ${row}, column ${col}`);
      wallRow.push(isWall);
      if (!isWall) floorCells.push({ col, row });
      if (symbol === 'H') {
        if (heroStart) fail('more than one Hero start');
        heroStart = { col, row };
      }
    });
    walls.push(wallRow);
  });

  if (!heroStart) return fail('no Hero start');

  const reachable = countReachable(walls, heroStart);
  if (reachable !== floorCells.length) {
    fail(`${floorCells.length - reachable} floor cells cannot be reached from the Hero start`);
  }

  return { name, walls, floorCells, heroStart };
}

function countReachable(walls: readonly (readonly boolean[])[], start: Cell): number {
  const seen = new Set<string>();
  const queue: Cell[] = [start];
  seen.add(`${start.col},${start.row}`);
  while (queue.length > 0) {
    const { col, row } = queue.pop() as Cell;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { col: col + dc, row: row + dr };
      const key = `${next.col},${next.row}`;
      if (seen.has(key) || walls[next.row]?.[next.col] !== false) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen.size;
}

/** Distance between two cells in tiles, measured in a straight line. */
export function cellDistance(a: Cell, b: Cell): number {
  return Math.hypot(a.col - b.col, a.row - b.row);
}

export const LAYOUTS: readonly Layout[] = [
  parseLayout('Four Pillars', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.....##...........##.....#',
    '#.....##...........##.....#',
    '#.........................#',
    '#............H............#',
    '#.........................#',
    '#.....##...........##.....#',
    '#.....##...........##.....#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '###########################',
  ]),
];
