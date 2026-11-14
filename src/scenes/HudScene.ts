import Phaser from 'phaser';
import type { RunSummary } from '../rules/run';
import {
  FONT_FAMILY,
  FRAME,
  GOLD_COLOUR,
  HUD_KEY,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  type HudSnapshot,
} from '../view';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_FAMILY,
  fontStyle: 'bold',
  fontSize: '26px',
  color: '#f4e9d8',
  stroke: '#2b1d14',
  strokeThickness: 6,
};

const PIP = { size: 24, gap: 6, left: 24, top: 22 };
const DODGE_BAR_TOP = PIP.top + PIP.size + 12;
const GOLD_TOP = DODGE_BAR_TOP + 22;
const PANEL = { width: 620, height: 330 };

const HINT_CONTROLS = 'W A S D move   ·   Mouse aim   ·   Hold click to fire   ·   Space to Dodge';
const HINT_DOORS = 'Walk into a Door to choose the next Room and its Reward';
const HINT_BOSS_DOOR = 'Walk into the Door to face the Boss Room';

/** Draws health, the Dodge meter, banked Gold, progress and the Run summary on top of the Room. */
export class HudScene extends Phaser.Scene {
  private bars!: Phaser.GameObjects.Graphics;
  private gold!: Phaser.GameObjects.Text;
  private progress!: Phaser.GameObjects.Text;
  private enemies!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Graphics;
  private summaryTitle!: Phaser.GameObjects.Text;
  private summaryBody!: Phaser.GameObjects.Text;
  private summaryPrompt!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    const centreX = SCREEN_WIDTH / 2;
    const centreY = SCREEN_HEIGHT / 2;

    this.bars = this.add.graphics();
    this.add.image(PIP.left + 16, GOLD_TOP + 16, 'tiles', FRAME.chest).setScale(2);
    this.gold = this.add
      .text(PIP.left + 40, GOLD_TOP + 17, '', { ...TEXT_STYLE, color: GOLD_COLOUR })
      .setOrigin(0, 0.5);

    this.progress = this.add.text(SCREEN_WIDTH - 24, 14, '', TEXT_STYLE).setOrigin(1, 0);
    this.enemies = this.add
      .text(SCREEN_WIDTH - 24, 50, '', { ...TEXT_STYLE, fontSize: '20px' })
      .setOrigin(1, 0);
    this.hint = this.add
      .text(centreX, SCREEN_HEIGHT - 20, '', { ...TEXT_STYLE, fontSize: '20px' })
      .setOrigin(0.5, 1);

    // The Run summary: a dimmed Room with a panel of words over it.
    this.panel = this.add.graphics().setVisible(false);
    this.panel.fillStyle(0x1a1410, 0.6).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    const left = centreX - PANEL.width / 2;
    const top = centreY - PANEL.height / 2;
    this.panel.fillStyle(0x2b1d14, 0.95).fillRoundedRect(left, top, PANEL.width, PANEL.height, 18);
    this.panel.lineStyle(4, 0x8a6a4a).strokeRoundedRect(left, top, PANEL.width, PANEL.height, 18);

    this.summaryTitle = this.add
      .text(centreX, top + 62, '', { ...TEXT_STYLE, fontSize: '52px' })
      .setOrigin(0.5);
    this.summaryBody = this.add
      .text(centreX, centreY + 14, '', { ...TEXT_STYLE, align: 'center', lineSpacing: 8 })
      .setOrigin(0.5);
    this.summaryPrompt = this.add
      .text(centreX, top + PANEL.height - 44, 'Press Enter for a new Run', { ...TEXT_STYLE, fontSize: '22px' })
      .setOrigin(0.5);
  }

  update(): void {
    const hud = this.registry.get(HUD_KEY) as HudSnapshot | undefined;
    if (!hud) return;

    this.drawBars(hud);
    this.gold.setText(`${hud.gold}`);
    this.progress.setText(hud.isBossRoom ? 'Boss Room' : `Room ${hud.depth} of ${hud.roomCount}`);
    this.enemies.setText(enemiesLabel(hud.enemiesLeft));
    this.hint.setText(hintFor(hud));
    this.showSummary(hud.summary, hud.roomCount);
  }

  private showSummary(summary: RunSummary | null, roomCount: number): void {
    const visible = summary !== null;
    this.panel.setVisible(visible);
    this.summaryTitle.setVisible(visible);
    this.summaryBody.setVisible(visible);
    this.summaryPrompt.setVisible(visible);
    if (!summary) return;

    const won = summary.outcome === 'victory';
    const reachedBoss = summary.depthReached > roomCount;
    this.summaryTitle.setText(won ? 'Victory!' : 'You died').setColor(won ? GOLD_COLOUR : '#ff8a8a');
    this.summaryBody.setText(
      [
        `Depth reached: ${summary.depthReached}${reachedBoss ? ' (Boss Room)' : ''}`,
        `Gold Banked this Run: ${summary.goldBanked}`,
        `Total Gold: ${summary.totalGold}`,
      ].join('\n'),
    );
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
    const top = DODGE_BAR_TOP;
    g.fillStyle(0x2b1d14).fillRoundedRect(PIP.left - 3, top - 3, width + 6, 14, 6);
    g.fillStyle(0x5a463a).fillRoundedRect(PIP.left, top, width, 8, 4);
    const filled = Math.max(8, width * hud.dodgeReadiness);
    g.fillStyle(hud.dodgeReadiness >= 1 ? 0x9be7ff : 0x4f8fb0).fillRoundedRect(PIP.left, top, filled, 8, 4);
  }
}

function enemiesLabel(enemiesLeft: number): string {
  if (enemiesLeft === 0) return 'Room cleared';
  return enemiesLeft === 1 ? '1 enemy' : `${enemiesLeft} enemies`;
}

function hintFor(hud: HudSnapshot): string {
  if (hud.summary) return '';
  if (hud.doorsOpen) return hud.depth === hud.roomCount ? HINT_BOSS_DOOR : HINT_DOORS;
  if (hud.depth === 1 && hud.enemiesLeft > 0 && hud.health > 0) return HINT_CONTROLS;
  return '';
}
