import type { EnemyKind } from './enemy';
import { cellDistance, type Cell, type Layout } from './layout';
import type { Rng } from './rng';
import { ENCOUNTER } from './tuning';

/** The kinds of enemy a Room can start with. Spawnlings only appear during a fight. */
export type StartingKind = keyof typeof ENCOUNTER.kinds;

export interface EnemySpawn {
  readonly kind: EnemyKind;
  readonly cell: Cell;
}

/** How much a Room has to spend on enemies at a given Depth (the first Room is Depth 1). */
export function encounterBudgetAtDepth(depth: number): number {
  const budget = ENCOUNTER.baseBudget + (Math.max(1, depth) - 1) * ENCOUNTER.extraBudgetPerDepth;
  return Math.min(ENCOUNTER.maxBudget, budget);
}

/** What the enemies of an encounter cost in total. */
export function encounterCost(kinds: readonly EnemyKind[]): number {
  return kinds.reduce((sum, kind) => sum + (kind === 'spawnling' ? 0 : ENCOUNTER.kinds[kind].cost), 0);
}

/**
 * Chooses which kinds of enemy a Room at this Depth holds, spending the
 * Depth's budget. A kind is only bought from the Depth at which it first
 * appears, and at that Depth the Room is sure to hold one, so the player
 * meets each kind as it arrives.
 */
export function rollEnemyKinds(depth: number, rng: Rng): StartingKind[] {
  const all = Object.keys(ENCOUNTER.kinds) as StartingKind[];
  const counts = new Map<StartingKind, number>();
  const bought: StartingKind[] = [];
  let budget = encounterBudgetAtDepth(depth);

  const buy = (kind: StartingKind): void => {
    bought.push(kind);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    budget -= ENCOUNTER.kinds[kind].cost;
  };
  const affordable = (kind: StartingKind): boolean => {
    const { cost, firstDepth, maxPerRoom } = ENCOUNTER.kinds[kind];
    return firstDepth <= depth && cost <= budget && (counts.get(kind) ?? 0) < maxPerRoom;
  };

  for (const kind of all) {
    if (ENCOUNTER.kinds[kind].firstDepth === depth && affordable(kind)) buy(kind);
  }

  for (;;) {
    const options = all.filter(affordable);
    const totalWeight = options.reduce((sum, kind) => sum + ENCOUNTER.kinds[kind].weight, 0);
    if (totalWeight === 0) break;
    let roll = rng.next() * totalWeight;
    const picked = options.find((kind) => (roll -= ENCOUNTER.kinds[kind].weight) < 0) ?? options[0];
    if (!picked) break;
    buy(picked);
  }
  return bought;
}

/**
 * Chooses the group of enemies for a Room and where each one starts.
 * No two enemies share a cell, and none starts close to the Hero.
 */
export function rollEncounter(layout: Layout, depth: number, rng: Rng): EnemySpawn[] {
  const candidates = layout.floorCells.filter(
    (cell) => cellDistance(cell, layout.heroStart) >= ENCOUNTER.minSpawnDistanceTiles,
  );
  const kinds = rollEnemyKinds(depth, rng).slice(0, candidates.length);
  const cells = rng.shuffle(candidates);
  return kinds.map((kind, i) => ({ kind, cell: cells[i] as Cell }));
}
