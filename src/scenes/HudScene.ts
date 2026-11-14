import Phaser from 'phaser';
import { BOON_INFO, type BoonId, type BoonOffer } from '../rules/boon';
import type { RunSummary } from '../rules/run';
import { BOON } from '../rules/tuning';
import {
  BOON_CHOSEN_EVENT,
  BOON_COLOUR,
  BOON_FRAME,
  FRAME,
  GOLD_COLOUR,
  HUD_KEY,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TEXT_STYLE,
  type HudSnapshot,
} from '../view';

const PIP = { size: 24, gap: 6, left: 24, top: 22 };
const DODGE_BAR_TOP = PIP.top + PIP.size + 12;
const GOLD_TOP = DODGE_BAR_TOP + 22;
const PANEL = { width: 620, height: 330 };

const CARD = { width: 320, height: 350, gap: 34 };
const CARD_KEYS = ['ONE', 'TWO', 'THREE'] as const;

const HINT_CONTROLS = 'W A S D move   ·   Mouse aim   ·   Hold click to fire   ·   Space to Dodge   ·   Esc to leave';
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
  /** The question asked when Esc is pressed during a Run. */
  private abandonObjects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  /** The offer whose cards are on screen, and everything drawn for it. */
  private shownOffer: readonly BoonOffer[] | null = null;
  private offerObjects: Phaser.GameObjects.GameObject[] = [];
  /** The Boons drawn along the bottom, as a string, so they are redrawn only when they change. */
  private shownBoons = '';
  private heldObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Hud');
  }

  create(): void {
    this.shownOffer = null;
    this.offerObjects = [];
    this.shownBoons = '';
    this.heldObjects = [];

    const keyboard = this.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin;
    CARD_KEYS.forEach((key, i) => {
      keyboard.on(`keydown-${key}`, () => {
        const boon = this.shownOffer?.[i];
        if (boon) this.game.events.emit(BOON_CHOSEN_EVENT, boon.id);
      });
    });

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
      .text(centreX, top + PANEL.height - 44, 'Press Enter to return to the menu', { ...TEXT_STYLE, fontSize: '22px' })
      .setOrigin(0.5);

    const ask = this.add.graphics();
    ask.fillStyle(0x1a1410, 0.6).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ask.fillStyle(0x2b1d14, 0.95).fillRoundedRect(centreX - 300, centreY - 110, 600, 220, 18);
    ask.lineStyle(4, 0x8a6a4a).strokeRoundedRect(centreX - 300, centreY - 110, 600, 220, 18);
    const question = this.add
      .text(centreX, centreY - 50, 'Abandon this Run?', { ...TEXT_STYLE, fontSize: '40px' })
      .setOrigin(0.5);
    const detail = this.add
      .text(centreX, centreY + 4, 'Gold already Banked is kept.', { ...TEXT_STYLE, fontSize: '21px', fontStyle: 'normal', strokeThickness: 4 })
      .setOrigin(0.5);
    const keys = this.add
      .text(centreX, centreY + 56, 'Enter to leave   ·   Esc to keep playing', { ...TEXT_STYLE, fontSize: '22px', color: '#c9b79c' })
      .setOrigin(0.5);
    this.abandonObjects = [ask, question, detail, keys];
    for (const object of this.abandonObjects) object.setVisible(false);
  }

  update(): void {
    const hud = this.registry.get(HUD_KEY) as HudSnapshot | undefined;
    if (!hud) return;

    this.drawBars(hud);
    this.gold.setText(`${hud.gold}`);
    this.progress.setText(hud.isBossRoom ? 'Boss Room' : `Room ${hud.depth} of ${hud.roomCount}`);
    this.enemies.setText(enemiesLabel(hud.enemiesLeft));
    // The hint moves up once the row of held Boons is long enough to reach it.
    this.hint.setText(hintFor(hud)).setY(SCREEN_HEIGHT - (hud.boons.length > 5 ? 82 : 20));
    this.showSummary(hud.summary, hud.roomCount);
    for (const object of this.abandonObjects) object.setVisible(hud.askingToAbandon);
    this.showHeldBoons(hud.boons);
    this.showBoonOffer(hud.boonOffer);
  }

  /** A small picture and level for each Boon held, along the bottom left. */
  private showHeldBoons(boons: readonly BoonOffer[]): void {
    const signature = boons.map((boon) => `${boon.id}${boon.level}`).join(',');
    if (signature === this.shownBoons) return;
    this.shownBoons = signature;
    for (const object of this.heldObjects) object.destroy();

    this.heldObjects = boons.flatMap((boon, i) => {
      const x = 40 + i * 58;
      const y = SCREEN_HEIGHT - 44;
      const back = this.add.graphics();
      back.fillStyle(0x2b1d14, 0.85).fillRoundedRect(x - 24, y - 24, 48, 48, 8);
      back.lineStyle(2, 0x8a6a4a).strokeRoundedRect(x - 24, y - 24, 48, 48, 8);
      const icon = this.add.image(x - 4, y, 'tiles', BOON_FRAME[boon.id]).setScale(2.5);
      const level = this.add
        .text(x + 21, y + 22, `${boon.level}`, { ...TEXT_STYLE, fontSize: '18px', color: BOON_COLOUR, strokeThickness: 5 })
        .setOrigin(1, 1);
      return [back, icon, level];
    });
  }

  /** The Boon cards: shown while a choice is waiting, picked by a click or by a number key. */
  private showBoonOffer(offer: readonly BoonOffer[] | null): void {
    if (offer === this.shownOffer) return;
    this.shownOffer = offer;
    for (const object of this.offerObjects) object.destroy();
    this.offerObjects = [];
    if (!offer) return;

    const centreX = SCREEN_WIDTH / 2;
    const top = (SCREEN_HEIGHT - CARD.height) / 2 + 26;
    const dim = this.add.graphics();
    dim.fillStyle(0x1a1410, 0.6).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    const title = this.add
      .text(centreX, top - 52, 'Choose a Boon', { ...TEXT_STYLE, fontSize: '42px', color: BOON_COLOUR })
      .setOrigin(0.5);
    this.offerObjects.push(dim, title);

    const span = offer.length * CARD.width + (offer.length - 1) * CARD.gap;
    offer.forEach((boon, i) => {
      const left = centreX - span / 2 + i * (CARD.width + CARD.gap);
      this.offerObjects.push(...this.drawCard(boon, i, left, top));
    });
  }

  private drawCard(boon: BoonOffer, index: number, left: number, top: number): Phaser.GameObjects.GameObject[] {
    const info = BOON_INFO[boon.id];
    const middle = left + CARD.width / 2;
    const back = this.add.graphics();
    const paint = (hovered: boolean): void => {
      back.clear();
      back.fillStyle(hovered ? 0x3d2a1d : 0x2b1d14, 0.97).fillRoundedRect(left, top, CARD.width, CARD.height, 16);
      back.lineStyle(4, hovered ? 0x9be7ff : 0x8a6a4a).strokeRoundedRect(left, top, CARD.width, CARD.height, 16);
    };
    paint(false);

    const icon = this.add.image(middle, top + 78, 'tiles', BOON_FRAME[boon.id]).setScale(6);
    const name = this.add
      .text(middle, top + 156, info.name, { ...TEXT_STYLE, fontSize: '30px' })
      .setOrigin(0.5);
    const levelText = boon.level === 0 ? 'New' : `Level ${boon.level}  →  ${boon.level + 1}`;
    const level = this.add
      .text(middle, top + 196, `${levelText}   (highest ${BOON.maxLevel})`, { ...TEXT_STYLE, fontSize: '18px', color: BOON_COLOUR, strokeThickness: 4 })
      .setOrigin(0.5);
    const description = this.add
      .text(middle, top + 252, info.description, {
        ...TEXT_STYLE,
        fontSize: '21px',
        fontStyle: 'normal',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: CARD.width - 44 },
      })
      .setOrigin(0.5);
    const key = this.add
      .text(middle, top + CARD.height - 30, `Press ${index + 1} or click`, { ...TEXT_STYLE, fontSize: '17px', color: '#c9b79c', strokeThickness: 4 })
      .setOrigin(0.5);

    const zone = this.add
      .zone(left, top, CARD.width, CARD.height)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => paint(true));
    zone.on('pointerout', () => paint(false));
    zone.on('pointerdown', () => this.choose(boon.id));

    return [back, icon, name, level, description, key, zone];
  }

  private choose(id: BoonId): void {
    this.game.events.emit(BOON_CHOSEN_EVENT, id);
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
    const title = won ? 'Victory!' : summary.abandoned ? 'Run abandoned' : 'You died';
    this.summaryTitle.setText(title).setColor(won ? GOLD_COLOUR : '#ff8a8a');
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
  if (hud.summary || hud.boonOffer || hud.askingToAbandon) return '';
  if (hud.doorsOpen) return doorHint(hud);
  if (hud.depth === 1 && hud.enemiesLeft > 0 && hud.health > 0) return HINT_CONTROLS;
  return '';
}

function doorHint(hud: HudSnapshot): string {
  return hud.depth === hud.roomCount ? HINT_BOSS_DOOR : HINT_DOORS;
}
