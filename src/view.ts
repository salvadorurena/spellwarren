import type { Reward } from './rules/reward';
import type { RunSummary } from './rules/run';
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

export const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const GOLD_COLOUR = '#ffd35a';

/** How each Reward is shown on a Door and when it is granted. */
export const REWARD_LOOK: Record<Reward, { frame: number; label: string; colour: string }> = {
  gold: { frame: FRAME.chest, label: 'Gold', colour: GOLD_COLOUR },
  healing: { frame: FRAME.redFlask, label: 'Healing', colour: '#ff8a8a' },
  // A stand-in until Boons exist.
  boon: { frame: FRAME.blueFlask, label: 'Boon', colour: '#9be7ff' },
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
  /** Set once the Run has ended and its summary should be on screen. */
  summary: RunSummary | null;
}

export const HUD_KEY = 'hud';

/** Where the game registry keeps the Bank, which outlives every Run. */
export const BANK_KEY = 'bank';
