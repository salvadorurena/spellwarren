import type { RoomOutcome } from './rules/room';
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
} as const;

/** What the Room tells the heads-up display each frame. */
export interface HudSnapshot {
  health: number;
  maxHealth: number;
  dodgeReadiness: number;
  depth: number;
  enemiesLeft: number;
  outcome: RoomOutcome;
}

export const HUD_KEY = 'hud';
