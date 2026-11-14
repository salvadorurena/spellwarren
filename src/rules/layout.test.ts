import { describe, expect, it } from 'vitest';
import { cellDistance, LAYOUTS, parseLayout, type Cell, type Layout } from './layout';
import { DOOR_COLUMNS, ENCOUNTER, ROOM_COLS, ROOM_ROWS } from './tuning';

const wallRow = '#'.repeat(ROOM_COLS);
const openRow = `#${'.'.repeat(ROOM_COLS - 2)}#`;

/** One row of an otherwise open Room, with `symbols` written over it starting at `col`. */
function rowWith(col: number, symbols: string): string {
  return openRow.slice(0, col) + symbols + openRow.slice(col + symbols.length);
}

/**
 * An open Room with the Hero start at the bottom centre, which obeys every
 * rule. Each test spoils it in one way by replacing whole rows.
 */
function drawing(overrides: Record<number, string> = {}): string[] {
  const rows = Array.from({ length: ROOM_ROWS }, (_, row) =>
    row === 0 || row === ROOM_ROWS - 1 ? wallRow : openRow,
  );
  rows[12] = rowWith(13, 'H');
  for (const [row, text] of Object.entries(overrides)) rows[Number(row)] = text;
  return rows;
}

// ---------------------------------------------------------------------------
// The design rules, worked out here from a Layout's walls alone so the sweep
// over LAYOUTS does not lean on the parser it is checking.
// ---------------------------------------------------------------------------

function isFloor(layout: Layout, col: number, row: number): boolean {
  return layout.walls[row]?.[col] === false;
}

/** True where the 2 × 2 block whose top-left cell is (col, row) is all floor. */
function isOpenBlock(layout: Layout, col: number, row: number): boolean {
  return (
    isFloor(layout, col, row) &&
    isFloor(layout, col + 1, row) &&
    isFloor(layout, col, row + 1) &&
    isFloor(layout, col + 1, row + 1)
  );
}

/** Rule 1: the cells beneath a Door column that are walled. */
function blockedDoorCells(layout: Layout): Cell[] {
  return DOOR_COLUMNS.flatMap((col) => [1, 2].map((row) => ({ col, row }))).filter(
    ({ col, row }) => !isFloor(layout, col, row),
  );
}

/** Rule 2: the walled cells, inside the outer wall, of the 3 × 3 block centred on the Hero start. */
function wallsCrowdingHero(layout: Layout): Cell[] {
  const { col, row } = layout.heroStart;
  const crowding: Cell[] = [];
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      const insideOuterWall = r > 0 && c > 0 && r < ROOM_ROWS - 1 && c < ROOM_COLS - 1;
      if (insideOuterWall && !isFloor(layout, c, r)) crowding.push({ col: c, row: r });
    }
  }
  return crowding;
}

/** Rule 3: the floor cells that belong to no 2 × 2 block of floor. */
function narrowCells(layout: Layout): Cell[] {
  return layout.floorCells.filter(
    ({ col, row }) =>
      !isOpenBlock(layout, col, row) &&
      !isOpenBlock(layout, col - 1, row) &&
      !isOpenBlock(layout, col, row - 1) &&
      !isOpenBlock(layout, col - 1, row - 1),
  );
}

/**
 * Rule 3, taken further: the floor cells that something two tiles wide
 * could never stand on, having started on the Hero start and moved one tile
 * at a time. Catches squeezes that the block-per-cell rule misses, such as
 * two wall corners meeting diagonally.
 */
function cellsBeyondASqueeze(layout: Layout): Cell[] {
  const key = (col: number, row: number) => `${col},${row}`;
  const { heroStart } = layout;
  const first = [
    { col: heroStart.col, row: heroStart.row },
    { col: heroStart.col - 1, row: heroStart.row },
    { col: heroStart.col, row: heroStart.row - 1 },
    { col: heroStart.col - 1, row: heroStart.row - 1 },
  ].find(({ col, row }) => isOpenBlock(layout, col, row));
  if (!first) return [...layout.floorCells];

  const visited = new Set<string>([key(first.col, first.row)]);
  const queue: Cell[] = [first];
  for (let block = queue.pop(); block; block = queue.pop()) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { col: block.col + dc, row: block.row + dr };
      if (visited.has(key(next.col, next.row)) || !isOpenBlock(layout, next.col, next.row)) continue;
      visited.add(key(next.col, next.row));
      queue.push(next);
    }
  }
  return layout.floorCells.filter(
    ({ col, row }) =>
      !visited.has(key(col, row)) &&
      !visited.has(key(col - 1, row)) &&
      !visited.has(key(col, row - 1)) &&
      !visited.has(key(col - 1, row - 1)),
  );
}

/** Rule 4: the floor cells far enough from the Hero start for an enemy to start on. */
function enemyStartCells(layout: Layout): Cell[] {
  return layout.floorCells.filter(
    (cell) => cellDistance(cell, layout.heroStart) >= ENCOUNTER.minSpawnDistanceTiles,
  );
}

/** Rule 5: the share of the cells inside the outer wall that are walled. */
function walledShare(layout: Layout): number {
  const interior = (ROOM_COLS - 2) * (ROOM_ROWS - 2);
  return (interior - layout.floorCells.length) / interior;
}

/** Rule 6: the names used by more than one Layout. */
function repeatedNames(layouts: readonly Layout[]): string[] {
  const names = layouts.map((layout) => layout.name);
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

/**
 * Builds a Layout straight from a drawing with none of parseLayout's
 * checks, for drawings the parser would refuse.
 */
function unchecked(name: string, rows: readonly string[]): Layout {
  const cells = rows.flatMap((text, row) => [...text].map((symbol, col) => ({ symbol, col, row })));
  const heroStart = cells.find(({ symbol }) => symbol === 'H');
  if (!heroStart) throw new Error('the test drawing has no Hero start');
  return {
    name,
    walls: rows.map((text) => [...text].map((symbol) => symbol === '#')),
    floorCells: cells.filter(({ symbol }) => symbol !== '#').map(({ col, row }) => ({ col, row })),
    heroStart: { col: heroStart.col, row: heroStart.row },
  };
}

// ---------------------------------------------------------------------------

describe('the test drawing', () => {
  it('is a playable Room that breaks no design rule', () => {
    const layout = parseLayout('test', drawing());
    expect(layout.heroStart).toEqual({ col: 13, row: 12 });
    expect(layout.floorCells).toHaveLength((ROOM_COLS - 2) * (ROOM_ROWS - 2));
    expect(narrowCells(layout)).toEqual([]);
    expect(cellsBeyondASqueeze(layout)).toEqual([]);
    expect(enemyStartCells(layout).length).toBeGreaterThanOrEqual(ENCOUNTER.maxEnemies);
    expect(walledShare(layout)).toBe(0);
  });
});

describe('rule 1: the floor beneath every Door is clear', () => {
  for (const col of DOOR_COLUMNS) {
    for (const row of [1, 2]) {
      it(`rejects a wall beneath the Door at column ${col}, on row ${row}`, () => {
        const walled = drawing({ [row]: rowWith(col, '#') });
        expect(() => parseLayout('test', walled)).toThrow(
          `Layout "test": the floor beneath the Door at column ${col} is walled at row ${row}`,
        );
      });
    }
  }

  it('accepts a wall on the third row beneath a Door, and beside the Door column', () => {
    const column = DOOR_COLUMNS[0];
    const close = drawing({ 1: rowWith(column + 2, '##'), 3: rowWith(column, '##') });
    expect(() => parseLayout('test', close)).not.toThrow();
  });

  it('holds for every Layout', () => {
    for (const layout of LAYOUTS) {
      expect(blockedDoorCells(layout), layout.name).toEqual([]);
    }
  });
});

describe('rule 2: the Hero enters from the bottom, with room to stand', () => {
  it('rejects a Hero start above the three bottom rows', () => {
    const tooHigh = drawing({ 10: rowWith(13, 'H'), 12: openRow });
    expect(() => parseLayout('test', tooHigh)).toThrow(
      'Layout "test": the Hero starts on row 10, expected row 11 to 13',
    );
    const centred = drawing({ 7: rowWith(13, 'H'), 12: openRow });
    expect(() => parseLayout('test', centred)).toThrow(/Hero starts on row 7/);
  });

  it.each([11, 12, 13])('accepts a Hero start on row %i', (row) => {
    const layout = parseLayout('test', drawing({ 12: openRow, [row]: rowWith(13, 'H') }));
    expect(layout.heroStart).toEqual({ col: 13, row });
  });

  it('rejects a wall touching the Hero start, even at a corner', () => {
    const beside = drawing({ 12: rowWith(13, 'H#') });
    expect(() => parseLayout('test', beside)).toThrow(
      'Layout "test": a wall crowds the Hero start at row 12, column 14',
    );
    const above = drawing({ 11: rowWith(13, '#') });
    expect(() => parseLayout('test', above)).toThrow(/crowds the Hero start at row 11, column 13/);
    const corner = drawing({ 13: rowWith(12, '#') });
    expect(() => parseLayout('test', corner)).toThrow(/crowds the Hero start at row 13, column 12/);
  });

  it('accepts a wall two cells from the Hero start', () => {
    const near = drawing({ 10: rowWith(12, '###'), 12: rowWith(11, '#.H.#') });
    expect(() => parseLayout('test', near)).not.toThrow();
  });

  it('accepts a Hero start against the outer wall', () => {
    const inCorner = drawing({ 12: openRow, 13: rowWith(1, 'H') });
    expect(parseLayout('test', inCorner).heroStart).toEqual({ col: 1, row: 13 });
  });

  it('holds for every Layout', () => {
    for (const layout of LAYOUTS) {
      expect([11, 12, 13], layout.name).toContain(layout.heroStart.row);
      expect(wallsCrowdingHero(layout), layout.name).toEqual([]);
    }
  });
});

describe('rule 3: no passage is narrower than two tiles', () => {
  it('finds a gap one tile wide', () => {
    const gap = parseLayout('test', drawing({ 6: `${'#'.repeat(ROOM_COLS - 2)}.#` }));
    expect(narrowCells(gap)).toEqual([{ col: ROOM_COLS - 2, row: 6 }]);
  });

  it('allows a corridor two tiles wide, but not one', () => {
    const corridor = parseLayout('test', drawing({ 5: rowWith(3, '#'), 6: rowWith(3, '#') }));
    expect(narrowCells(corridor)).toEqual([]);
    const tighter = parseLayout('test', drawing({ 5: rowWith(2, '#'), 6: rowWith(2, '#') }));
    expect(narrowCells(tighter)).toEqual([
      { col: 1, row: 5 },
      { col: 1, row: 6 },
    ]);
  });

  it('finds a squeeze between two walls that meet corner to corner', () => {
    // Every floor cell here sits in a 2 × 2 block of floor, yet the only way
    // from the top half to the bottom is the single step from (13, 6) to (13, 7).
    const squeeze = parseLayout(
      'test',
      drawing({ 6: rowWith(1, '#'.repeat(12)), 7: rowWith(14, '#'.repeat(12)) }),
    );
    expect(narrowCells(squeeze)).toEqual([]);
    const cutOff = cellsBeyondASqueeze(squeeze);
    expect(cutOff).toContainEqual({ col: 13, row: 6 });
    expect(cutOff).toContainEqual({ col: 6, row: 1 });
    expect(cutOff).not.toContainEqual({ col: 13, row: 7 });
  });

  it('holds for every Layout', () => {
    for (const layout of LAYOUTS) {
      expect(narrowCells(layout), layout.name).toEqual([]);
      expect(cellsBeyondASqueeze(layout), layout.name).toEqual([]);
    }
  });
});

describe('rule 4: the largest group of enemies has somewhere to start', () => {
  it('finds a Room too cramped for them', () => {
    // A walled-in chamber around the Hero start. The parser would refuse it
    // (the Doors are walled off), and with today's tuning no drawing the
    // parser accepts can break this rule: the floor leading to the Doors is
    // already far enough from the Hero start. The rule guards against
    // ENCOUNTER or the Room's size changing.
    const chamberRow = `${'#'.repeat(9)}${'.'.repeat(ROOM_COLS - 18)}${'#'.repeat(9)}`;
    const rows = Array.from({ length: ROOM_ROWS }, (_, row) =>
      row >= 9 && row <= 13 ? chamberRow : wallRow,
    );
    rows[12] = `${chamberRow.slice(0, 13)}H${chamberRow.slice(14)}`;
    const cramped = unchecked('test', rows);
    expect(cramped.floorCells).toHaveLength(45);
    expect(enemyStartCells(cramped).length).toBeLessThan(ENCOUNTER.maxEnemies);
  });

  it('holds for every Layout', () => {
    for (const layout of LAYOUTS) {
      expect(enemyStartCells(layout).length, layout.name).toBeGreaterThanOrEqual(
        ENCOUNTER.maxEnemies,
      );
    }
  });
});

describe('rule 5: walls cover at most a quarter of the inside of a Room', () => {
  it('finds a Room that is mostly wall', () => {
    const slab = `#..${'#'.repeat(ROOM_COLS - 6)}..#`;
    const crowded = parseLayout('test', drawing({ 4: slab, 5: slab, 6: slab, 7: slab, 8: slab }));
    expect(walledShare(crowded)).toBeGreaterThan(0.25);
  });

  it('holds for every Layout', () => {
    for (const layout of LAYOUTS) {
      expect(walledShare(layout), layout.name).toBeLessThanOrEqual(0.25);
    }
  });
});

describe('rule 6: every Layout has its own name', () => {
  it('finds a name used twice', () => {
    const layouts = ['Vault', 'Crypt', 'Vault'].map((name) => parseLayout(name, drawing()));
    expect(repeatedNames(layouts)).toEqual(['Vault']);
  });

  it('holds for every Layout', () => {
    expect(repeatedNames(LAYOUTS)).toEqual([]);
  });
});

describe('the Layouts', () => {
  it('number at least ten', () => {
    expect(LAYOUTS.length).toBeGreaterThanOrEqual(10);
  });

  it('are all drawn differently', () => {
    const drawings = LAYOUTS.map((layout) =>
      layout.walls.map((row) => row.map((wall) => (wall ? '#' : '.')).join('')).join('\n'),
    );
    expect(new Set(drawings).size).toBe(LAYOUTS.length);
  });
});
