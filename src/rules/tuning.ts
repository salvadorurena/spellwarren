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

/** The spawner's small enemy. */
export const SPAWNLING = {
  health: 10,
  speed: 62,
  contactDamage: 1,
} as const;

/** Keeps its distance and fires slow shots. */
export const SHOOTER = {
  health: 20,
  speed: 40,
  contactDamage: 1,
  /** It tries to stand this far from the Hero. */
  preferredRangeTiles: 6,
  /** How far either side of that range it tolerates before moving. */
  rangeSlackTiles: 1.5,
  /** It stands still and glows for this long before each shot. */
  aimMs: 500,
  shotCooldownMs: 2400,
  shotSpeed: 85,
  shotDamage: 1,
  shotLifetimeMs: 4000,
} as const;

/** Walks up, shows a warning, then charges in a straight line. */
export const CHARGER = {
  health: 50,
  speed: 36,
  contactDamage: 1,
  /** Damage dealt by touching the Hero mid-charge. */
  chargeDamage: 2,
  /** It begins its warning once the Hero is this close and in plain view. */
  triggerRangeTiles: 7,
  warningMs: 700,
  chargeSpeed: 230,
  /** A charge that meets no wall ends after this long. */
  chargeMaxMs: 900,
  /** How long it is helpless after charging into a wall. */
  stunMs: 1200,
  /** The pause after a charge that hit nothing. */
  recoverMs: 600,
} as const;

/** Slow and tough; makes spawnlings until it is defeated. */
export const SPAWNER = {
  health: 110,
  speed: 16,
  contactDamage: 1,
  spawnEveryMs: 4500,
  /** It stops spawning while this many of its spawnlings are alive. */
  maxBrood: 4,
} as const;

/**
 * A Room's enemies are bought from a budget that grows with Depth. Each
 * kind has a cost, a Depth at which it first appears, a weight (how often
 * it is picked) and a limit per Room.
 */
export const ENCOUNTER = {
  baseBudget: 4,
  extraBudgetPerDepth: 1,
  /** High enough that the Boss Room, one Depth past the last Room, is the toughest. */
  maxBudget: 14,
  /** Enemies never start closer to the Hero than this many tiles. */
  minSpawnDistanceTiles: 6,
  kinds: {
    rusher: { cost: 1, firstDepth: 1, weight: 5, maxPerRoom: 14 },
    shooter: { cost: 2, firstDepth: 3, weight: 3, maxPerRoom: 4 },
    charger: { cost: 3, firstDepth: 5, weight: 2, maxPerRoom: 3 },
    spawner: { cost: 4, firstDepth: 7, weight: 1, maxPerRoom: 2 },
  },
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

/**
 * Permanent Upgrades, bought in the Shop between Runs. Each is weaker than
 * the matching Boon, so the Boons taken still decide how a Run goes. The
 * numbers below are what one level adds.
 */
export const PERMANENT_UPGRADE = {
  /** The price of each level in turn; there are as many levels as prices. */
  prices: [30, 70, 140],
  toughness: { maxHealth: 1 },
  sharperBolts: { damage: 2 },
  practisedCasting: { cooldownMultiplier: 0.94 },
  lightStep: { speedMultiplier: 0.05 },
  steadyBreath: { recoveryMultiplier: 0.92 },
  /** Extra share of every Gold Reward. */
  goldSense: { goldMultiplier: 0.15 },
} as const;

/**
 * Boons. Every Boon has the same number of levels; the numbers below are
 * what one level adds.
 */
export const BOON = {
  maxLevel: 3,
  /** How many Boons are offered at a time. */
  offerSize: 3,
  swiftCasting: { cooldownMultiplier: 0.82 },
  heavyBolts: { damage: 4 },
  piercingBolts: { pierce: 1 },
  splitBolt: {
    extraBolts: 1,
    spreadDegrees: 9,
    /** Each bolt of a split volley does this share of normal damage. */
    damageMultiplier: 0.75,
  },
  ricochet: { bounces: 1 },
  chainSpark: { damageShare: 0.3, rangeTiles: 3.5 },
  burningBolts: { damagePerSecond: 4, durationMs: 3000, tickMs: 500 },
  frostBolts: { speedMultiplier: 0.55, durationMs: 700 },
  farReach: { speedMultiplier: 0.2, lifetimeMultiplier: 0.3, damage: 2 },
  fleetFoot: { speedMultiplier: 0.1 },
  quickRecovery: { recoveryMultiplier: 0.75 },
  dodgeBlast: { damage: 12, radiusTiles: 2.2 },
} as const;
