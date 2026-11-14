/**
 * Every number a playtester might want to change lives here.
 * Distances are in pixels of the Room (one tile is 16), speeds in pixels
 * per second, times in milliseconds.
 */

export const TILE = 16;
export const ROOM_COLS = 27;
export const ROOM_ROWS = 15;

export const HERO = {
  maxHealth: 6,
  speed: 95,
  /** Grace period after being hurt, so one enemy cannot drain all health at once. */
  hurtGraceMs: 800,
} as const;

export const BOLT = {
  damage: 10,
  speed: 260,
  cooldownMs: 260,
  lifetimeMs: 1200,
} as const;

export const DODGE = {
  durationMs: 170,
  speedMultiplier: 3.2,
  recoveryMs: 800,
} as const;

export const RUSHER = {
  health: 30,
  speed: 48,
  contactDamage: 1,
} as const;

export const ENCOUNTER = {
  baseEnemies: 4,
  extraEnemiesPerDepth: 1,
  maxEnemies: 12,
  /** Enemies never start closer to the Hero than this many tiles. */
  minSpawnDistanceTiles: 6,
} as const;
