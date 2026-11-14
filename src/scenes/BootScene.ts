import Phaser from 'phaser';
import { TILE } from '../rules/tuning';

/** Loads the art, then hands over to the first Room. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.spritesheet('tiles', 'assets/tiles.png', { frameWidth: TILE, frameHeight: TILE });
  }

  create(): void {
    // The Hero's bolt is drawn in code: a pale blue orb with a white core.
    const orb = this.make.graphics({ x: 0, y: 0 }, false);
    orb.fillStyle(0x3fa9f5).fillCircle(4, 4, 4);
    orb.fillStyle(0x9be7ff).fillCircle(4, 4, 3);
    orb.fillStyle(0xffffff).fillCircle(4, 4, 1.5);
    orb.generateTexture('bolt', 8, 8);
    orb.destroy();

    this.scene.start('Room');
  }
}
