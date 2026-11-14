import { cellDistance, type Cell, type Layout } from './layout';
import type { Rng } from './rng';
import { ENCOUNTER } from './tuning';

export type EnemyKind = 'rusher';

export interface EnemySpawn {
  readonly kind: EnemyKind;
  readonly cell: Cell;
}

/** How many enemies a Room holds at a given Depth (the first Room is Depth 1). */
export function enemyCountAtDepth(depth: number): number {
  const count = ENCOUNTER.baseEnemies + (Math.max(1, depth) - 1) * ENCOUNTER.extraEnemiesPerDepth;
  return Math.min(ENCOUNTER.maxEnemies, count);
}

/**
 * Chooses the group of enemies for a Room and where each one starts.
 * No two enemies share a cell, and none starts close to the Hero.
 */
export function rollEncounter(layout: Layout, depth: number, rng: Rng): EnemySpawn[] {
  const candidates = layout.floorCells.filter(
    (cell) => cellDistance(cell, layout.heroStart) >= ENCOUNTER.minSpawnDistanceTiles,
  );
  const count = Math.min(enemyCountAtDepth(depth), candidates.length);
  return rng
    .shuffle(candidates)
    .slice(0, count)
    .map((cell) => ({ kind: 'rusher', cell }));
}
