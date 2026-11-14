import Phaser from 'phaser';
import { TILE } from '../rules/tuning';
import { openSavedBank } from '../storage';
import { BANK_KEY } from '../view';

/** Loads the art and opens the saved Bank, then hands over to the Menu. */
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

    // An enemy's shot: a hot orange orb, so it is never mistaken for a bolt.
    const shot = this.make.graphics({ x: 0, y: 0 }, false);
    shot.fillStyle(0x7a1f1f).fillCircle(5, 5, 5);
    shot.fillStyle(0xff6a3d).fillCircle(5, 5, 4);
    shot.fillStyle(0xffe08a).fillCircle(5, 5, 2);
    shot.generateTexture('shot', 10, 10);
    shot.destroy();

    // Banked Gold outlives every Run, so it is kept by the game rather than by a Room.
    this.registry.set(BANK_KEY, openSavedBank());

    this.scene.start('Menu');
  }
}
