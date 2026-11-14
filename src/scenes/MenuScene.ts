import Phaser from 'phaser';
import type { Bank } from '../rules/bank';
import { BANK_KEY, FRAME, GOLD_COLOUR, SCREEN_HEIGHT, SCREEN_WIDTH, TEXT_STYLE } from '../view';
import { drawBackdrop } from './backdrop';

const WARNING_COLOUR = '#ff8a8a';
const QUIET_COLOUR = '#c9b79c';

/** The first screen and the one between Runs: start a Run, visit the Shop or reset progress. */
export class MenuScene extends Phaser.Scene {
  private bank!: Bank;
  private gold!: Phaser.GameObjects.Text;
  private resetLine!: Phaser.GameObjects.Text;
  /** True after one press of R, while the reset waits to be confirmed. */
  private resetAsked = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.bank = this.registry.get(BANK_KEY) as Bank;
    this.resetAsked = false;
    const centreX = SCREEN_WIDTH / 2;

    drawBackdrop(this);
    this.add.text(centreX, 120, 'Spellwarren', { ...TEXT_STYLE, fontSize: '84px', strokeThickness: 10 }).setOrigin(0.5);
    this.add.image(centreX, 245, 'tiles', FRAME.hero).setScale(6);

    this.add.image(centreX - 120, 345, 'tiles', FRAME.chest).setScale(2.5);
    this.gold = this.add.text(centreX - 92, 345, '', { ...TEXT_STYLE, color: GOLD_COLOUR }).setOrigin(0, 0.5);

    this.option(centreX, 430, 'Enter', 'Start a Run', () => this.startRun());
    this.option(centreX, 485, 'S', 'Shop', () => this.openShop());
    this.resetLine = this.option(centreX, 540, 'R', 'Reset progress', () => this.askReset());

    this.add
      .text(centreX, SCREEN_HEIGHT - 80, 'Gold and Permanent Upgrades are saved in this browser', {
        ...TEXT_STYLE,
        fontSize: '18px',
        color: QUIET_COLOUR,
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin;
    // A held key repeats; ignoring repeats means holding R can never confirm a reset by itself.
    keyboard.on('keydown', (event: KeyboardEvent) => {
      if (!event.repeat) this.keyPressed(event.code);
    });
    this.showGold();
    this.cameras.main.fadeIn(200);
  }

  private keyPressed(code: string): void {
    if (code === 'KeyR') {
      this.askReset();
      return;
    }
    this.cancelReset();
    if (code === 'Enter' || code === 'NumpadEnter') this.startRun();
    if (code === 'KeyS') this.openShop();
  }

  /** One line of the menu, which can also be clicked. */
  private option(x: number, y: number, key: string, label: string, act: () => void): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, `${key}  ·  ${label}`, { ...TEXT_STYLE, fontSize: '30px' }).setOrigin(0.5);
    text.setInteractive({ useHandCursor: true });
    text.on('pointerover', () => text.setScale(1.06));
    text.on('pointerout', () => text.setScale(1));
    text.on('pointerdown', act);
    return text;
  }

  private showGold(): void {
    this.gold.setText(`${this.bank.gold} Gold Banked`);
  }

  private startRun(): void {
    this.scene.start('Room', {});
  }

  private openShop(): void {
    this.scene.start('Shop');
  }

  /** Resetting cannot be undone, so it takes a second press to confirm. */
  private askReset(): void {
    if (!this.resetAsked) {
      this.resetAsked = true;
      this.resetLine
        .setText('Press R again to forget all Gold and Permanent Upgrades')
        .setFontSize(24)
        .setColor(WARNING_COLOUR);
      return;
    }
    this.bank.reset();
    this.resetAsked = false;
    this.resetLine.setText('Progress reset').setFontSize(30).setColor(QUIET_COLOUR);
    this.showGold();
  }

  private cancelReset(): void {
    if (!this.resetAsked) return;
    this.resetAsked = false;
    this.resetLine.setText('R  ·  Reset progress').setFontSize(30).setColor(TEXT_STYLE.color);
  }
}
