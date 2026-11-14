import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { RoomScene } from './scenes/RoomScene';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './view';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: '#1a1410',
  // Art is drawn scaled up, so keep its pixels blocky but with clean edges.
  smoothPixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 } },
  },
  scene: [BootScene, RoomScene, HudScene],
});

if (import.meta.env.DEV) {
  // Lets the game be inspected from the browser console while developing.
  (window as unknown as { game: Phaser.Game }).game = game;
}
