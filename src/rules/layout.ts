import { DOOR_COLUMNS, ROOM_COLS, ROOM_ROWS } from './tuning';

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

/** The floor beneath each Door is kept clear on these rows, so the Hero can walk up into it. */
const DOOR_APPROACH_ROWS = [1, 2] as const;

/** The Hero enters from the bottom: the Hero start lies on one of the three lowest floor rows. */
const FIRST_HERO_ROW = ROOM_ROWS - 4;
const LAST_HERO_ROW = ROOM_ROWS - 2;

/**
 * Builds a Layout from rows of text: `#` is wall, `.` is floor and `H` is
 * the floor cell where the Hero starts. Throws if the drawing is not a
 * playable Room, so a design mistake is caught by the tests rather than
 * by a player.
 *
 * A playable Room is the right size, enclosed by an outer wall, has one
 * Hero start from which all floor can be reached, leaves the floor beneath
 * every Door column clear, and gives the Hero a clear entrance at the
 * bottom. The design rules that make a Layout good to fight in (passage
 * width, room for enemies to start, how much is walled) are checked over
 * `LAYOUTS` in layout.test.ts.
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

  for (const col of DOOR_COLUMNS) {
    for (const row of DOOR_APPROACH_ROWS) {
      if (walls[row]?.[col] !== false) {
        fail(`the floor beneath the Door at column ${col} is walled at row ${row}`);
      }
    }
  }

  if (heroStart.row < FIRST_HERO_ROW || heroStart.row > LAST_HERO_ROW) {
    fail(
      `the Hero starts on row ${heroStart.row}, expected row ${FIRST_HERO_ROW} to ${LAST_HERO_ROW}`,
    );
  }
  for (const row of [heroStart.row - 1, heroStart.row, heroStart.row + 1]) {
    for (const col of [heroStart.col - 1, heroStart.col, heroStart.col + 1]) {
      const insideOuterWall = row > 0 && col > 0 && row < ROOM_ROWS - 1 && col < ROOM_COLS - 1;
      if (insideOuterWall && walls[row]?.[col] !== false) {
        fail(`a wall crowds the Hero start at row ${row}, column ${col}`);
      }
    }
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

/*
 * Column ruler for drawing. Doors (D) sit above columns 6, 13 and 20.
 *
 *   000000000011111111112222222
 *   012345678901234567890123456
 *         D      D      D
 */
export const LAYOUTS: readonly Layout[] = [
  // Light cover at four points; the Hero weaves between them in open ground.
  parseLayout('Four Pillars', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.....##...........##.....#',
    '#.....##...........##.....#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.....##...........##.....#',
    '#.....##...........##.....#',
    '#.........................#',
    '#............H............#',
    '#.........................#',
    '###########################',
  ]),

  // Nothing to hide behind: pure kiting. The cut corners keep the Hero from being pinned in one.
  parseLayout('Echoing Hall', [
    '###########################',
    '####...................####',
    '###.....................###',
    '##.......................##',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '##.......................##',
    '###..........H..........###',
    '####...................####',
    '###########################',
  ]),

  // Many small stones, unevenly strewn: pursuit breaks often but nothing shelters for long.
  parseLayout('Standing Stones', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#...#......#.......##.....#',
    '#..............#..........#',
    '#.......#..............#..#',
    '#.......#...........#.....#',
    '#...#.......##......#.....#',
    '#................#........#',
    '#.......#.................#',
    '#..##.........#.......#...#',
    '#.....................#...#',
    '#............H............#',
    '#.........................#',
    '###########################',
  ]),

  // One great block to circle: enemies trail the Hero around it and never cut across.
  parseLayout('The Monolith', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#........#########........#',
    '#.......###########.......#',
    '#.......###########.......#',
    '#........#########........#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#............H............#',
    '#.........................#',
    '###########################',
  ]),

  // Two long walls make three lanes, one under each Door, with a staggered doorway through each wall.
  parseLayout('Three Aisles', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#.......##.......##.......#',
    '#.......##.......##.......#',
    '#.......##.......##.......#',
    '#................##.......#',
    '#.........................#',
    '#.......##................#',
    '#.......##.......##.......#',
    '#.......##.......##.......#',
    '#.......##.......##.......#',
    '#............H............#',
    '#.........................#',
    '###########################',
  ]),

  // Shallow alcoves down both sides: a place to shoot from with nowhere to retreat. A font to circle.
  parseLayout('Side Chapels', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '####...................####',
    '#.........................#',
    '#...........###...........#',
    '####........###........####',
    '#...........###...........#',
    '#.........................#',
    '####...................####',
    '#.........................#',
    '#............H............#',
    '#.........................#',
    '###########################',
  ]),

  // A walled court with a gate in each side: fight around the ring or slip through it.
  parseLayout('The Cloister', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#......#####...#####......#',
    '#..................#......#',
    '#..................#......#',
    '#......#....###....#......#',
    '#......#..................#',
    '#......#..................#',
    '#......#####...#####......#',
    '#.........................#',
    '#............H............#',
    '#.........................#',
    '###########################',
  ]),

  // Blocks step down across the Room; the Hero starts beneath the stair and enemies sift through it.
  parseLayout("Giant's Stair", [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#..###....................#',
    '#..###....................#',
    '#.......###...............#',
    '#.......###...............#',
    '#............###..........#',
    '#............###..........#',
    '#.................###.....#',
    '#.................###.....#',
    '#......................####',
    '#.....H................####',
    '#......................####',
    '###########################',
  ]),

  // Four walls point at an open middle: four quarters to fight in, and every chase crosses the hub.
  parseLayout('Broken Cross', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#............#............#',
    '#............#............#',
    '#............#............#',
    '#.........................#',
    '#...#######.....#######...#',
    '#.........................#',
    '#............#............#',
    '#............#............#',
    '#............#............#',
    '#.........................#',
    '#............H............#',
    '###########################',
  ]),

  // Two wedges pinch the Room to a waist with a post in it: hold the gap, or be pushed back from it.
  parseLayout('The Narrows', [
    '###########################',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '#.........................#',
    '####...................####',
    '#######.............#######',
    '##########...#...##########',
    '#######.............#######',
    '####...................####',
    '#.........................#',
    '#.........................#',
    '#............H............#',
    '#.........................#',
    '###########################',
  ]),
];
