/**
 * Every number a playtester might want to change lives here.
 * Distances are in pixels of the Room (one tile is 16), speeds in pixels
 * per second, times in milliseconds.
 */

export const TILE = 16;
export const ROOM_COLS = 27;
export const ROOM_ROWS = 15;

/**
 * Doors sit in the top wall (row 0) at these columns. Every Layout keeps
 * the floor beneath them clear, and the Hero enters from the bottom.
 */
export const DOOR_COLUMNS = [6, 13, 20] as const;

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
  /** High enough that the Boss Room, one Depth past the last Room, is the toughest. */
  maxEnemies: 14,
  /** Enemies never start closer to the Hero than this many tiles. */
  minSpawnDistanceTiles: 6,
} as const;

export const RUN = {
  /** Rooms in the chain before the Boss Room, which sits one Depth deeper. */
  rooms: 10,
} as const;

/** How many Doors lead out of a cleared Room. */
export const DOOR_OFFER = {
  minDoors: 2,
  maxDoors: 3,
} as const;

export const REWARD = {
  /** A Gold Reward is worth goldBase + goldPerDepth x the Room's Depth. */
  goldBase: 10,
  goldPerDepth: 2,
  /** Health restored by a Healing Reward. */
  healing: 2,
  /** Gold Banked for clearing the Boss Room, which has no Reward of its own. */
  bossRoomGold: 50,
} as const;
