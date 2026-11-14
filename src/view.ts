import type { BoonId, BoonOffer } from './rules/boon';
import type { EnemyKind } from './rules/enemy';
import type { Reward } from './rules/reward';
import type { RunSummary } from './rules/run';
import type { PermanentUpgradeId } from './rules/upgrade';
import { ROOM_COLS, ROOM_ROWS, TILE } from './rules/tuning';

/** Size of a Room in its own pixels. */
export const ROOM_WIDTH = ROOM_COLS * TILE;
export const ROOM_HEIGHT = ROOM_ROWS * TILE;

/** Each pixel of art is drawn this many screen pixels wide. */
export const VIEW_SCALE = 3;

export const SCREEN_WIDTH = ROOM_WIDTH * VIEW_SCALE;
export const SCREEN_HEIGHT = ROOM_HEIGHT * VIEW_SCALE;

/** Which picture in the tile sheet is which. */
export const FRAME = {
  hero: 84,
  rusher: 108,
  shooter: 111,
  charger: 109,
  spawner: 122,
  spawnling: 123,
  wall: 40,
  floor: 48,
  floorSpeckled: 49,
  floorFlagstones: 42,
  doorShut: 45,
  doorAjar: 33,
  doorOpen: 21,
  chest: 89,
  redFlask: 115,
  blueFlask: 116,
} as const;

/** How each kind of enemy is drawn: its picture and how large it is beside the Hero. */
export const ENEMY_LOOK: Record<EnemyKind, { frame: number; scale: number }> = {
  rusher: { frame: FRAME.rusher, scale: 1 },
  shooter: { frame: FRAME.shooter, scale: 1 },
  charger: { frame: FRAME.charger, scale: 1.25 },
  spawner: { frame: FRAME.spawner, scale: 1.6 },
  spawnling: { frame: FRAME.spawnling, scale: 0.8 },
};

/** The picture on each Boon's card. */
export const BOON_FRAME: Record<BoonId, number> = {
  swiftCasting: 129,
  heavyBolts: 117,
  piercingBolts: 105,
  splitBolt: 118,
  ricochet: 101,
  chainSpark: 130,
  burningBolts: 115,
  frostBolts: 116,
  farReach: 106,
  fleetFoot: 114,
  quickRecovery: 113,
  dodgeBlast: 119,
};

/** The picture on each Permanent Upgrade's card in the Shop. */
export const PERMANENT_UPGRADE_FRAME: Record<PermanentUpgradeId, number> = {
  toughness: 127,
  sharperBolts: 104,
  practisedCasting: 128,
  lightStep: 126,
  steadyBreath: 102,
  goldSense: 90,
};

export const BOON_COLOUR = '#9be7ff';

export const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Words on the menus, the Shop and the HUD. */
export const TEXT_STYLE = {
  fontFamily: FONT_FAMILY,
  fontStyle: 'bold',
  fontSize: '26px',
  color: '#f4e9d8',
  stroke: '#2b1d14',
  strokeThickness: 6,
} as const;

/** Colours of the panels and cards drawn over the game. */
export const PANEL_COLOUR = { fill: 0x2b1d14, hover: 0x3d2a1d, edge: 0x8a6a4a, dim: 0x1a1410 } as const;

export const GOLD_COLOUR = '#ffd35a';

/** How each Reward is shown on a Door and when it is granted. */
export const REWARD_LOOK: Record<Reward, { frame: number; label: string; colour: string }> = {
  gold: { frame: FRAME.chest, label: 'Gold', colour: GOLD_COLOUR },
  healing: { frame: FRAME.redFlask, label: 'Healing', colour: '#ff8a8a' },
  boon: { frame: 131, label: 'Boon', colour: BOON_COLOUR },
};

/** What the Room tells the heads-up display each frame. */
export interface HudSnapshot {
  health: number;
  maxHealth: number;
  dodgeReadiness: number;
  /** Depth of the current Room; the first Room is Depth 1. */
  depth: number;
  /** How many Rooms the chain has before the Boss Room. */
  roomCount: number;
  isBossRoom: boolean;
  enemiesLeft: number;
  /** All the player's banked Gold. */
  gold: number;
  doorsOpen: boolean;
  /** The Boons the Hero holds this Run. */
  boons: readonly BoonOffer[];
  /** The Boons to choose one from, while the choice is on screen. */
  boonOffer: readonly BoonOffer[] | null;
  /** Set once the Run has ended and its summary should be on screen. */
  summary: RunSummary | null;
  /** True while the game is paused to ask whether to abandon the Run. */
  askingToAbandon: boolean;
}

export const HUD_KEY = 'hud';

/** Where the game registry keeps the Bank, which outlives every Run and is saved in the browser. */
export const BANK_KEY = 'bank';

/** Sent on the game's events, with the Boon's id, when the player picks a Boon card. */
export const BOON_CHOSEN_EVENT = 'boon-chosen';
