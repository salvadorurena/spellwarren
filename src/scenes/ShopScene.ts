import Phaser from 'phaser';
import type { Bank } from '../rules/bank';
import {
  PERMANENT_UPGRADE_IDS,
  PERMANENT_UPGRADE_INFO,
  PERMANENT_UPGRADE_MAX_LEVEL,
  type PermanentUpgradeId,
} from '../rules/upgrade';
import {
  BANK_KEY,
  FRAME,
  GOLD_COLOUR,
  PANEL_COLOUR,
  PERMANENT_UPGRADE_FRAME,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TEXT_STYLE,
} from '../view';
import { drawBackdrop } from './backdrop';

const CARD = { width: 370, height: 228, gap: 24, top: 150, columns: 3 };
const CARD_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'] as const;
const UPGRADE_COLOUR = '#b6f0a0';
const QUIET_COLOUR = '#c9b79c';
const WARNING_COLOUR = '#ff8a8a';

/** Between Runs: Banked Gold is spent here on Permanent Upgrades. */
export class ShopScene extends Phaser.Scene {
  private bank!: Bank;
  private gold!: Phaser.GameObjects.Text;
  private cards: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Shop');
  }

  create(): void {
    this.bank = this.registry.get(BANK_KEY) as Bank;
    this.cards = [];
    const centreX = SCREEN_WIDTH / 2;

    drawBackdrop(this);
    this.add.text(centreX, 58, 'Shop', { ...TEXT_STYLE, fontSize: '56px', color: UPGRADE_COLOUR }).setOrigin(0.5);
    this.add.image(centreX - 95, 112, 'tiles', FRAME.chest).setScale(2);
    this.gold = this.add.text(centreX - 72, 112, '', { ...TEXT_STYLE, color: GOLD_COLOUR }).setOrigin(0, 0.5);
    this.add
      .text(centreX, SCREEN_HEIGHT - 36, 'Click a card or press 1 to 6 to buy   ·   Esc to go back', {
        ...TEXT_STYLE,
        fontSize: '20px',
        color: QUIET_COLOUR,
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin;
    // A held key repeats; only a fresh press buys, so holding 1 cannot buy every level at once.
    CARD_KEYS.forEach((key, i) => {
      keyboard.on(`keydown-${key}`, (event: KeyboardEvent) => {
        const id = PERMANENT_UPGRADE_IDS[i];
        if (id && !event.repeat) this.buy(id);
      });
    });
    keyboard.on('keydown-ESC', () => this.leave());
    keyboard.on('keydown-ENTER', () => this.leave());

    this.drawCards();
    this.cameras.main.fadeIn(200);
  }

  private leave(): void {
    this.scene.start('Menu');
  }

  private buy(id: PermanentUpgradeId): void {
    if (!this.bank.canBuy(id)) {
      this.cameras.main.shake(120, 0.003);
      return;
    }
    this.bank.buy(id);
    this.drawCards(id);
  }

  /** Redraws every card; the one just bought from flashes. */
  private drawCards(bought?: PermanentUpgradeId): void {
    for (const object of this.cards) object.destroy();
    this.gold.setText(`${this.bank.gold} Gold`);

    const span = CARD.columns * CARD.width + (CARD.columns - 1) * CARD.gap;
    this.cards = PERMANENT_UPGRADE_IDS.flatMap((id, i) => {
      const left = (SCREEN_WIDTH - span) / 2 + (i % CARD.columns) * (CARD.width + CARD.gap);
      const top = CARD.top + Math.floor(i / CARD.columns) * (CARD.height + CARD.gap);
      return this.drawCard(id, i, left, top, id === bought);
    });
  }

  private drawCard(
    id: PermanentUpgradeId,
    index: number,
    left: number,
    top: number,
    justBought: boolean,
  ): Phaser.GameObjects.GameObject[] {
    const info = PERMANENT_UPGRADE_INFO[id];
    const level = this.bank.level(id);
    const price = this.bank.priceOf(id);
    const affordable = this.bank.canBuy(id);

    const back = this.add.graphics();
    const paint = (hovered: boolean): void => {
      back.clear();
      back.fillStyle(hovered && affordable ? PANEL_COLOUR.hover : PANEL_COLOUR.fill, 0.97);
      back.fillRoundedRect(left, top, CARD.width, CARD.height, 16);
      back.lineStyle(4, hovered && affordable ? 0xb6f0a0 : PANEL_COLOUR.edge);
      back.strokeRoundedRect(left, top, CARD.width, CARD.height, 16);
    };
    paint(false);

    const icon = this.add.image(left + 62, top + 70, 'tiles', PERMANENT_UPGRADE_FRAME[id]).setScale(5);
    const name = this.add
      .text(left + 118, top + 40, info.name, { ...TEXT_STYLE, fontSize: '27px' })
      .setOrigin(0, 0.5);
    const pips = this.add
      .text(left + 118, top + 80, levelPips(level), { ...TEXT_STYLE, fontSize: '22px', color: UPGRADE_COLOUR, strokeThickness: 4 })
      .setOrigin(0, 0.5);
    const description = this.add
      .text(left + 24, top + 140, info.description, {
        ...TEXT_STYLE,
        fontSize: '20px',
        fontStyle: 'normal',
        strokeThickness: 4,
        wordWrap: { width: CARD.width - 48 },
      })
      .setOrigin(0, 0.5);

    const priceText = price === null ? 'Highest level' : `${index + 1}  ·  Buy for ${price} Gold`;
    const priceColour = price === null ? QUIET_COLOUR : affordable ? GOLD_COLOUR : WARNING_COLOUR;
    const buy = this.add
      .text(left + CARD.width / 2, top + CARD.height - 30, priceText, { ...TEXT_STYLE, fontSize: '21px', color: priceColour, strokeThickness: 4 })
      .setOrigin(0.5);

    const zone = this.add
      .zone(left, top, CARD.width, CARD.height)
      .setOrigin(0)
      .setInteractive({ useHandCursor: affordable });
    zone.on('pointerover', () => paint(true));
    zone.on('pointerout', () => paint(false));
    zone.on('pointerdown', () => this.buy(id));

    const objects = [back, icon, name, pips, description, buy, zone];
    if (!affordable && price !== null) {
      for (const object of [icon, name, description]) object.setAlpha(0.55);
    }
    if (justBought) {
      this.tweens.add({ targets: icon, scale: { from: 7, to: 5 }, duration: 260, ease: 'Back.easeOut' });
    }
    return objects;
  }
}

/** Filled and empty marks for the levels bought, like "Level ●●○". */
function levelPips(level: number): string {
  return `Level  ${'●'.repeat(level)}${'○'.repeat(PERMANENT_UPGRADE_MAX_LEVEL - level)}`;
}
