import type Phaser from 'phaser';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../rules/tuning';
import { FRAME, PANEL_COLOUR, SCREEN_HEIGHT, SCREEN_WIDTH, VIEW_SCALE } from '../view';

/** An empty, dimmed Room drawn behind the Menu and the Shop, so they feel part of the same dungeon. */
export function drawBackdrop(scene: Phaser.Scene): void {
  const size = TILE * VIEW_SCALE;
  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLS; col++) {
      const edge = row === 0 || col === 0 || row === ROOM_ROWS - 1 || col === ROOM_COLS - 1;
      // A fixed sprinkle of speckled floor, so the backdrop is the same every time.
      const speckled = (row * 7 + col * 13) % 11 === 0;
      const frame = edge ? FRAME.wall : speckled ? FRAME.floorSpeckled : FRAME.floor;
      scene.add.image(col * size, row * size, 'tiles', frame).setOrigin(0).setScale(VIEW_SCALE);
    }
  }
  scene.add.graphics().fillStyle(PANEL_COLOUR.dim, 0.72).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}
