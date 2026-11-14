import { describe, expect, it } from 'vitest';
import { enemyCountAtDepth, rollEncounter } from './encounter';
import { cellDistance, LAYOUTS, parseLayout } from './layout';
import { Rng } from './rng';
import { RoomState } from './room';
import { ENCOUNTER, ROOM_COLS, ROOM_ROWS } from './tuning';

const wallRow = '#'.repeat(ROOM_COLS);
const openRow = `#${'.'.repeat(ROOM_COLS - 2)}#`;

/** The Hero enters from the bottom, so the test Room starts the Hero on a low row. */
const HERO_ROW = ROOM_ROWS - 3;
const heroRow = `#H${'.'.repeat(ROOM_COLS - 3)}#`;

function drawing(overrides: Record<number, string> = {}): string[] {
  const rows = Array.from({ length: ROOM_ROWS }, (_, row) =>
    row === 0 || row === ROOM_ROWS - 1 ? wallRow : openRow,
  );
  rows[HERO_ROW] = heroRow;
  for (const [row, text] of Object.entries(overrides)) rows[Number(row)] = text;
  return rows;
}

describe('Layouts', () => {
  it('ships at least one Layout, and every one is playable', () => {
    expect(LAYOUTS.length).toBeGreaterThan(0);
    for (const layout of LAYOUTS) {
      expect(layout.walls).toHaveLength(ROOM_ROWS);
      expect(layout.walls[layout.heroStart.row]?.[layout.heroStart.col]).toBe(false);
    }
  });

  it('accepts a simple enclosed Room', () => {
    const layout = parseLayout('test', drawing());
    expect(layout.heroStart).toEqual({ col: 1, row: HERO_ROW });
    expect(layout.floorCells).toHaveLength((ROOM_COLS - 2) * (ROOM_ROWS - 2));
  });

  it('rejects a Room with a gap in its outer wall', () => {
    expect(() => parseLayout('test', drawing({ 3: `.${'.'.repeat(ROOM_COLS - 2)}#` }))).toThrow(
      /outer edge is open/,
    );
  });

  it('rejects a Room with no Hero start, or two', () => {
    expect(() => parseLayout('test', drawing({ [HERO_ROW]: openRow }))).toThrow(/no Hero start/);
    expect(() => parseLayout('test', drawing({ [HERO_ROW + 1]: heroRow }))).toThrow(
      /more than one Hero start/,
    );
  });

  it('rejects floor the Hero could never reach', () => {
    const sealed = drawing({ 10: wallRow });
    expect(() => parseLayout('test', sealed)).toThrow(/cannot be reached/);
  });

  it('rejects the wrong size', () => {
    expect(() => parseLayout('test', drawing().slice(1))).toThrow(/expected 15 rows/);
    expect(() => parseLayout('test', drawing({ 2: '#..#' }))).toThrow(/columns/);
  });
});

describe('encounters', () => {
  it('grow with Depth up to a cap', () => {
    expect(enemyCountAtDepth(1)).toBe(ENCOUNTER.baseEnemies);
    expect(enemyCountAtDepth(3)).toBe(ENCOUNTER.baseEnemies + 2 * ENCOUNTER.extraEnemiesPerDepth);
    expect(enemyCountAtDepth(999)).toBe(ENCOUNTER.maxEnemies);
  });

  it('never place an enemy near the Hero, in a wall, or on another enemy', () => {
    for (const layout of LAYOUTS) {
      for (let seed = 1; seed <= 50; seed++) {
        const spawns = rollEncounter(layout, 10, new Rng(seed));
        expect(spawns).toHaveLength(enemyCountAtDepth(10));

        const cells = new Set(spawns.map((s) => `${s.cell.col},${s.cell.row}`));
        expect(cells.size).toBe(spawns.length);

        for (const { cell } of spawns) {
          expect(layout.walls[cell.row]?.[cell.col]).toBe(false);
          expect(cellDistance(cell, layout.heroStart)).toBeGreaterThanOrEqual(
            ENCOUNTER.minSpawnDistanceTiles,
          );
        }
      }
    }
  });

  it('are the same for the same seed and differ between seeds', () => {
    const layout = LAYOUTS[0]!;
    expect(rollEncounter(layout, 1, new Rng(7))).toEqual(rollEncounter(layout, 1, new Rng(7)));
    expect(rollEncounter(layout, 1, new Rng(7))).not.toEqual(rollEncounter(layout, 1, new Rng(8)));
  });
});

describe('a Room', () => {
  it('is cleared when the last enemy is defeated', () => {
    const room = new RoomState(2);
    room.enemyDefeated();
    expect(room.outcome).toBe('fighting');
    room.enemyDefeated();
    expect(room.outcome).toBe('cleared');
    expect(room.enemiesLeft).toBe(0);
  });

  it('ends when the Hero dies, and stays ended', () => {
    const room = new RoomState(2);
    room.heroDied();
    room.enemyDefeated();
    room.enemyDefeated();
    expect(room.outcome).toBe('heroDead');
  });

  it('stays cleared even if the Hero dies afterwards', () => {
    const room = new RoomState(1);
    room.enemyDefeated();
    room.heroDied();
    expect(room.outcome).toBe('cleared');
  });
});
