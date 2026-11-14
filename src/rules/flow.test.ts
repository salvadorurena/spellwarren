import { describe, expect, it } from 'vitest';
import { cellAt, cellCentre, FlowField, isWall, lineIsClear } from './flow';
import { LAYOUTS, type Cell, type Layout } from './layout';

function layoutNamed(name: string): Layout {
  const layout = LAYOUTS.find((l) => l.name === name);
  if (!layout) throw new Error(`No Layout called ${name}`);
  return layout;
}

/** Follows the field from a cell until it reaches the target; returns the cells walked. */
function walk(field: FlowField, from: Cell): Cell[] {
  const path = [from];
  let cell = from;
  for (let step = 0; step < 500; step++) {
    const next = field.next(cell);
    if (!next) return path;
    path.push(next);
    cell = next;
  }
  throw new Error('The walk never arrived');
}

describe('the way to the Hero', () => {
  it('leads from every floor cell of every Layout to the Hero, never through a wall', () => {
    for (const layout of LAYOUTS) {
      const field = new FlowField(layout);
      // The Hero start, and a far corner of the Room.
      for (const target of [layout.heroStart, layout.floorCells[0] as Cell]) {
        field.retarget(target);
        for (const cell of layout.floorCells) {
          const path = walk(field, cell);
          expect(path[path.length - 1], `${layout.name} from ${cell.col},${cell.row}`).toEqual(target);
          for (const step of path) expect(isWall(layout, step)).toBe(false);
        }
      }
    }
  });

  it('never cuts across the corner of a wall', () => {
    for (const layout of LAYOUTS) {
      const field = new FlowField(layout);
      field.retarget(layout.heroStart);
      for (const cell of layout.floorCells) {
        const next = field.next(cell);
        if (!next || next.col === cell.col || next.row === cell.row) continue;
        expect(isWall(layout, { col: next.col, row: cell.row })).toBe(false);
        expect(isWall(layout, { col: cell.col, row: next.row })).toBe(false);
      }
    }
  });

  it('goes round The Monolith and not into it', () => {
    const layout = layoutNamed('The Monolith');
    const field = new FlowField(layout);
    const above = { col: 13, row: 3 };
    field.retarget({ col: 13, row: 10 });
    // Straight down is 7 tiles, but the block is in the way.
    expect(field.distance(above)).toBeGreaterThan(12);
    expect(walk(field, above).length).toBeGreaterThan(12);
  });

  it('counts distance in tiles, with nothing at the target and no way into a wall', () => {
    const layout = layoutNamed('Echoing Hall');
    const field = new FlowField(layout);
    field.retarget({ col: 10, row: 7 });
    expect(field.distance({ col: 10, row: 7 })).toBe(0);
    expect(field.next({ col: 10, row: 7 })).toBeNull();
    expect(field.distance({ col: 14, row: 7 })).toBe(4);
    expect(field.distance({ col: 11, row: 8 })).toBeCloseTo(Math.SQRT2);
    expect(field.distance({ col: 0, row: 0 })).toBe(Infinity);
    expect(field.distance({ col: -1, row: 99 })).toBe(Infinity);
  });

  it('follows the Hero when the Hero changes cell', () => {
    const layout = layoutNamed('Echoing Hall');
    const field = new FlowField(layout);
    field.retarget({ col: 5, row: 7 });
    expect(field.next({ col: 10, row: 7 })).toEqual({ col: 9, row: 7 });
    field.retarget({ col: 20, row: 7 });
    expect(field.next({ col: 10, row: 7 })).toEqual({ col: 11, row: 7 });
  });
});

describe('a clear line', () => {
  const monolith = layoutNamed('The Monolith');
  const above = cellCentre({ col: 13, row: 3 });
  const below = cellCentre({ col: 13, row: 10 });
  const beside = cellCentre({ col: 3, row: 3 });

  it('is blocked by a wall and open across floor', () => {
    expect(lineIsClear(monolith, above, below)).toBe(false);
    expect(lineIsClear(monolith, above, beside)).toBe(true);
    expect(lineIsClear(monolith, above, above)).toBe(true);
  });

  it('can be too narrow to walk even when it can be seen along', () => {
    // Skimming the corner of the block on rows 6 and 7, column 8.
    const from = { x: 8 * 16 - 2, y: 3 * 16 };
    const to = { x: 8 * 16 - 2, y: 10 * 16 };
    expect(lineIsClear(monolith, from, to)).toBe(true);
    expect(lineIsClear(monolith, from, to, 6)).toBe(false);
  });

  it('maps points to cells and back', () => {
    expect(cellAt({ x: 35, y: 17 })).toEqual({ col: 2, row: 1 });
    expect(cellCentre({ col: 2, row: 1 })).toEqual({ x: 40, y: 24 });
  });
});
