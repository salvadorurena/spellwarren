import Phaser from 'phaser';
import { HUD_KEY, SCREEN_HEIGHT, SCREEN_WIDTH, type HudSnapshot } from '../view';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  fontStyle: 'bold',
  fontSize: '26px',
  color: '#f4e9d8',
  stroke: '#2b1d14',
  strokeThickness: 6,
};

const PIP = { size: 24, gap: 6, left: 24, top: 22 };

/** Draws health, the Dodge meter and messages on top of the Room. */
export class HudScene extends Phaser.Scene {
  private bars!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.bars = this.add.graphics();
    this.status = this.add.text(SCREEN_WIDTH - 24, 18, '', TEXT_STYLE).setOrigin(1, 0);
    this.message = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, '', { ...TEXT_STYLE, fontSize: '44px', align: 'center' })
      .setOrigin(0.5);
    this.hint = this.add
      .text(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 20,
        'W A S D move   ·   Mouse aim   ·   Hold click to fire   ·   Space to Dodge',
        { ...TEXT_STYLE, fontSize: '20px' },
      )
      .setOrigin(0.5, 1);
  }

  update(): void {
    const hud = this.registry.get(HUD_KEY) as HudSnapshot | undefined;
    if (!hud) return;

    this.drawBars(hud);
    const enemies = hud.enemiesLeft === 1 ? '1 enemy' : `${hud.enemiesLeft} enemies`;
    this.status.setText(`Depth ${hud.depth}   ·   ${enemies}`);
    this.hint.setVisible(hud.depth === 1 && hud.outcome === 'fighting');

    if (hud.outcome === 'cleared') {
      this.message.setText('Room cleared\nPress Enter for the next Room');
    } else if (hud.outcome === 'heroDead') {
      this.message.setText(`You died at Depth ${hud.depth}\nPress Enter to start again`);
    } else {
      this.message.setText('');
    }
  }

  private drawBars(hud: HudSnapshot): void {
    const g = this.bars;
    g.clear();

    for (let i = 0; i < hud.maxHealth; i++) {
      const x = PIP.left + i * (PIP.size + PIP.gap);
      g.fillStyle(0x2b1d14).fillRoundedRect(x - 3, PIP.top - 3, PIP.size + 6, PIP.size + 6, 8);
      g.fillStyle(i < hud.health ? 0xe04848 : 0x5a463a).fillRoundedRect(x, PIP.top, PIP.size, PIP.size, 6);
    }

    const width = hud.maxHealth * (PIP.size + PIP.gap) - PIP.gap;
    const top = PIP.top + PIP.size + 12;
    g.fillStyle(0x2b1d14).fillRoundedRect(PIP.left - 3, top - 3, width + 6, 14, 6);
    g.fillStyle(0x5a463a).fillRoundedRect(PIP.left, top, width, 8, 4);
    const filled = Math.max(8, width * hud.dodgeReadiness);
    g.fillStyle(hud.dodgeReadiness >= 1 ? 0x9be7ff : 0x4f8fb0).fillRoundedRect(PIP.left, top, filled, 8, 4);
  }
}
