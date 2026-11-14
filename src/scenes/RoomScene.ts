import Phaser from 'phaser';
import { rollEncounter } from '../rules/encounter';
import { Health } from '../rules/health';
import type { HeroState } from '../rules/hero';
import type { Bank } from '../rules/bank';
import type { Cell, Layout } from '../rules/layout';
import { Rng } from '../rules/rng';
import { RoomState } from '../rules/room';
import { Run, type Door, type RewardGrant } from '../rules/run';
import { BOLT, DODGE, HERO, RUN, RUSHER, TILE } from '../rules/tuning';
import {
  BANK_KEY,
  FONT_FAMILY,
  FRAME,
  GOLD_COLOUR,
  HUD_KEY,
  REWARD_LOOK,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  VIEW_SCALE,
  type HudSnapshot,
} from '../view';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Bolt = Phaser.Physics.Arcade.Image;
type Body = Phaser.Physics.Arcade.Body;

export interface RoomSceneData {
  /** The Run this Room belongs to. Left out to start a new Run. */
  run?: Run;
}

interface EnemyInfo {
  health: Health;
  /** Enemies fade in and cannot move or hurt until this time. */
  activeAt: number;
  /** While knocked back, an enemy does not steer. */
  stunnedUntil: number;
  /** Which way this enemy prefers to go around an obstacle: 1 or -1. */
  side: number;
}

const SPAWN_FADE_MS = 700;
const KNOCKBACK_MS = 110;
const KNOCKBACK_SPEED = 130;

/** After a Room is cleared its Reward is shown for this long before the Doors open. */
const DOORS_OPEN_DELAY_MS = 700;
const DOOR_SWING_MS = 130;
/** How long the Hero takes to step through a Door while the Room fades out. */
const LEAVE_MS = 240;
const ENTER_FADE_MS = 200;
/** The Run summary waits this long, so the last moment of the Run can be seen. */
const SUMMARY_DELAY_MS = { death: 700, victory: 1300 } as const;

/** Every tile that stands in the way, whichever way a Door is hanging. */
const SOLID_FRAMES = [FRAME.wall, FRAME.doorShut, FRAME.doorAjar, FRAME.doorOpen];

/** One Room of a Run: the Hero fights a group of enemies, then leaves by a Door. */
export class RoomScene extends Phaser.Scene {
  private run!: Run;
  private heroState!: HeroState;
  private room!: RoomState;
  /** True once the open Doors can be walked into. */
  private doorsReady = false;
  /** True while the Hero is stepping through a Door. */
  private leaving = false;
  private summaryVisible = false;

  private hero!: Sprite;
  private walls!: Phaser.Tilemaps.TilemapLayer;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bolts!: Phaser.Physics.Arcade.Group;
  private enemyInfo = new Map<Sprite, EnemyInfo>();
  private boltExpiry = new Map<Bolt, number>();

  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'dodge' | 'confirm', Phaser.Input.Keyboard.Key>;
  private dodgeDirection = new Phaser.Math.Vector2(1, 0);

  constructor() {
    super('Room');
  }

  init(data: RoomSceneData): void {
    this.run = data.run ?? this.startRun();
    this.heroState = this.run.hero;
    this.doorsReady = false;
    this.leaving = false;
    this.summaryVisible = false;
    this.enemyInfo.clear();
    this.boltExpiry.clear();
  }

  /** A new Run: Depth 1 and full health, with the banked Gold of every Run before it. */
  private startRun(): Run {
    const bank = this.registry.get(BANK_KEY) as Bank;
    return new Run({ bank, rng: new Rng(Date.now()) });
  }

  create(): void {
    const layout = this.run.room.layout;
    const rng = this.run.rng;

    this.cameras.main.setZoom(VIEW_SCALE).centerOn(ROOM_WIDTH / 2, ROOM_HEIGHT / 2);
    this.cameras.main.fadeIn(ENTER_FADE_MS);
    this.input.mouse?.disableContextMenu();

    this.buildWalls(layout, rng);
    this.createHero(layout.heroStart);
    this.createBolts();
    this.createEnemies(layout, rng);

    const keyboard = this.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin;
    this.keys = {
      up: keyboard.addKey('W'),
      down: keyboard.addKey('S'),
      left: keyboard.addKey('A'),
      right: keyboard.addKey('D'),
      dodge: keyboard.addKey('SPACE'),
      confirm: keyboard.addKey('ENTER'),
    };

    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    if (this.room.outcome === 'cleared') this.roomCleared();
    this.publishHud();
  }

  update(): void {
    const now = this.time.now;

    if (this.summaryVisible && Phaser.Input.Keyboard.JustDown(this.keys.confirm)) {
      this.scene.restart({});
      return;
    }

    if (!this.leaving) {
      this.updateHero(now);
      this.checkDoors();
    }
    this.updateBolts(now);
    this.updateEnemies(now);
    this.publishHud();
  }

  // ---- Building the Room -------------------------------------------------

  private buildWalls(layout: Layout, rng: Rng): void {
    const doorColumns = new Set(this.run.doors.map((door) => door.column));
    const data = layout.walls.map((row, rowIndex) =>
      row.map((isWall, col) => {
        if (rowIndex === 0 && doorColumns.has(col)) return FRAME.doorShut;
        if (isWall) return FRAME.wall;
        const roll = rng.next();
        if (roll < 0.08) return FRAME.floorSpeckled;
        if (roll < 0.12) return FRAME.floorFlagstones;
        return FRAME.floor;
      }),
    );
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    if (!tileset) throw new Error('The tile sheet failed to load');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!(layer instanceof Phaser.Tilemaps.TilemapLayer)) {
      throw new Error('The Room could not be drawn');
    }
    layer.setCollision(SOLID_FRAMES);
    this.walls = layer;
  }

  private createHero(start: Cell): void {
    const { x, y } = cellCentre(start);
    this.hero = this.physics.add.sprite(x, y, 'tiles', FRAME.hero).setDepth(10);
    this.hero.setCircle(5, 3, 5);
    this.physics.add.collider(this.hero, this.walls);
  }

  private createBolts(): void {
    this.bolts = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image });
    this.physics.add.collider(this.bolts, this.walls, (bolt) => this.removeBolt(bolt as Bolt));
  }

  private createEnemies(layout: Layout, rng: Rng): void {
    const spawns = rollEncounter(layout, this.run.depth, rng);
    this.room = new RoomState(spawns.length);
    this.enemies = this.physics.add.group();

    const now = this.time.now;
    for (const spawn of spawns) {
      const { x, y } = cellCentre(spawn.cell);
      const enemy = this.enemies.create(x, y, 'tiles', FRAME.rusher) as Sprite;
      enemy.setCircle(5, 3, 5).setDepth(5).setAlpha(0);
      this.tweens.add({ targets: enemy, alpha: 1, duration: SPAWN_FADE_MS });
      this.enemyInfo.set(enemy, {
        health: new Health(RUSHER.health),
        activeAt: now + SPAWN_FADE_MS,
        stunnedUntil: 0,
        side: rng.next() < 0.5 ? 1 : -1,
      });
    }

    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.bolts, this.enemies, (bolt, enemy) =>
      this.boltHitsEnemy(bolt as Bolt, enemy as Sprite),
    );
    this.physics.add.overlap(this.hero, this.enemies, (_hero, enemy) =>
      this.enemyTouchesHero(enemy as Sprite),
    );
  }

  // ---- The Hero ------------------------------------------------------------

  private updateHero(now: number): void {
    const body = this.hero.body as Body;
    if (this.heroState.health.isDead) {
      body.setVelocity(0, 0);
      return;
    }

    const aim = this.aimDirection();
    this.hero.setFlipX(aim.x < 0);

    const move = new Phaser.Math.Vector2(
      Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
      Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
    ).normalize();

    if (Phaser.Input.Keyboard.JustDown(this.keys.dodge) && this.heroState.tryDodge(now)) {
      // Dodge the way the Hero is moving, or towards the cursor if standing still.
      this.dodgeDirection.copy(move.lengthSq() > 0 ? move : aim);
    }

    if (this.heroState.isDodging(now)) {
      const speed = HERO.speed * DODGE.speedMultiplier;
      body.setVelocity(this.dodgeDirection.x * speed, this.dodgeDirection.y * speed);
    } else {
      body.setVelocity(move.x * HERO.speed, move.y * HERO.speed);
    }

    if (this.input.activePointer.isDown && this.heroState.tryFire(now)) {
      this.fireBolt(aim, now);
    }

    this.showHeroState(now);
  }

  private aimDirection(): Phaser.Math.Vector2 {
    const pointer = this.input.activePointer;
    const target = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const aim = new Phaser.Math.Vector2(target.x - this.hero.x, target.y - this.hero.y);
    return aim.lengthSq() > 0 ? aim.normalize() : aim.set(1, 0);
  }

  private showHeroState(now: number): void {
    if (this.heroState.isDodging(now)) {
      this.hero.setTint(0x9be7ff).setTintMode(Phaser.TintModes.FILL).setAlpha(0.8);
    } else if (this.heroState.isInvulnerable(now)) {
      // Blink during the grace period after being hurt.
      this.hero.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      this.hero.setAlpha(Math.floor(now / 80) % 2 === 0 ? 0.35 : 1);
    } else {
      this.hero.clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
    }
  }

  private enemyTouchesHero(enemy: Sprite): void {
    const now = this.time.now;
    const info = this.enemyInfo.get(enemy);
    if (!info || now < info.activeAt || this.room.outcome !== 'fighting') return;

    const result = this.heroState.takeHit(RUSHER.contactDamage, now);
    if (result === 'ignored') return;

    // Phaser multiplies shake by the camera zoom, so this is about 2 Room pixels.
    this.cameras.main.shake(140, 0.0015);
    if (result === 'dead') {
      this.room.heroDied();
      this.run.heroDied();
      this.showSummaryAfter(SUMMARY_DELAY_MS.death);
      this.hero.setTint(0x555555).setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
      this.hero.setAngle(90);
    }
  }

  // ---- Bolts -------------------------------------------------------------

  private fireBolt(direction: Phaser.Math.Vector2, now: number): void {
    // Bolts start at the Hero's centre, so an enemy pressed right up against
    // the Hero is still hit rather than skipped over.
    const x = this.hero.x;
    const y = this.hero.y;
    const bolt = this.bolts.get(x, y, 'bolt') as Bolt | null;
    if (!bolt) return;
    bolt.enableBody(true, x, y, true, true);
    bolt.setCircle(3, 1, 1).setDepth(8);
    bolt.setVelocity(direction.x * BOLT.speed, direction.y * BOLT.speed);
    this.boltExpiry.set(bolt, now + BOLT.lifetimeMs);
  }

  private updateBolts(now: number): void {
    for (const [bolt, expiresAt] of this.boltExpiry) {
      if (now >= expiresAt) this.removeBolt(bolt);
    }
  }

  private removeBolt(bolt: Bolt): void {
    this.boltExpiry.delete(bolt);
    bolt.disableBody(true, true);
  }

  private boltHitsEnemy(bolt: Bolt, enemy: Sprite): void {
    const info = this.enemyInfo.get(enemy);
    if (!bolt.active || !info) return;

    const now = this.time.now;
    const boltBody = bolt.body as Body;
    const push = boltBody.velocity.clone().normalize().scale(KNOCKBACK_SPEED);
    this.removeBolt(bolt);

    // Enemies that are still fading in cannot be hurt either.
    if (now < info.activeAt) return;

    info.health.damage(BOLT.damage);
    if (info.health.isDead) {
      this.defeatEnemy(enemy);
      return;
    }

    info.stunnedUntil = now + KNOCKBACK_MS;
    (enemy.body as Body).setVelocity(push.x, push.y);
    enemy.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(70, () => {
      if (enemy.active) enemy.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  // ---- Enemies -------------------------------------------------------------

  private updateEnemies(now: number): void {
    const fighting = this.room.outcome === 'fighting';
    for (const [enemy, info] of this.enemyInfo) {
      const body = enemy.body as Body;
      if (!fighting || now < info.activeAt) {
        body.setVelocity(0, 0);
        continue;
      }
      if (now < info.stunnedUntil) continue;

      const dx = this.hero.x - enemy.x;
      const dy = this.hero.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      let vx = (dx / distance) * RUSHER.speed;
      let vy = (dy / distance) * RUSHER.speed;

      // When pressed against a wall, slide along it instead of pushing into it.
      if (body.blocked.left || body.blocked.right) {
        vy = (Math.abs(dy) > 4 ? Math.sign(dy) : info.side) * RUSHER.speed;
      } else if (body.blocked.up || body.blocked.down) {
        vx = (Math.abs(dx) > 4 ? Math.sign(dx) : info.side) * RUSHER.speed;
      }

      body.setVelocity(vx, vy);
      enemy.setFlipX(dx < 0);
    }
  }

  private defeatEnemy(enemy: Sprite): void {
    this.enemyInfo.delete(enemy);
    this.room.enemyDefeated();

    // A white ghost of the enemy that puffs outward and fades.
    const puff = this.add
      .image(enemy.x, enemy.y, 'tiles', FRAME.rusher)
      .setTint(0xffffff)
      .setTintMode(Phaser.TintModes.FILL)
      .setDepth(6);
    this.tweens.add({
      targets: puff,
      scale: 1.8,
      alpha: 0,
      duration: 200,
      onComplete: () => puff.destroy(),
    });
    enemy.destroy();

    if (this.room.outcome === 'cleared') this.roomCleared();
  }

  // ---- Rewards and Doors ---------------------------------------------------

  /** The Room's Reward is granted the moment it is cleared; then the Doors open. */
  private roomCleared(): void {
    const grant = this.run.roomCleared();
    if (!grant) return;

    this.showGrant(grant);
    if (this.run.outcome === 'victory') {
      this.showSummaryAfter(SUMMARY_DELAY_MS.victory);
    } else {
      this.time.delayedCall(DOORS_OPEN_DELAY_MS, () => this.openDoors());
    }
  }

  private showGrant(grant: RewardGrant): void {
    const lines: { text: string; colour: string }[] = [];
    if (grant.gold > 0) lines.push({ text: `+${grant.gold} Gold`, colour: GOLD_COLOUR });
    if (grant.reward === 'healing') {
      const text = grant.health > 0 ? `+${grant.health} health` : 'Health already full';
      lines.push({ text, colour: REWARD_LOOK.healing.colour });
    }
    lines.forEach((line, i) => {
      // Keep the words inside the Room when the Hero is against a wall.
      const x = Phaser.Math.Clamp(this.hero.x, 40, ROOM_WIDTH - 40);
      const y = Math.max(TILE + 18, this.hero.y - 12) + i * 10;
      const label = this.addLabel(x, y, line.text, line.colour, 9);
      this.tweens.add({
        targets: label,
        y: y - 16,
        alpha: { from: 1, to: 0 },
        duration: 1500,
        ease: 'Cubic.easeIn',
        onComplete: () => label.destroy(),
      });
    });
  }

  private openDoors(): void {
    for (const door of this.run.doors) {
      this.walls.putTileAt(FRAME.doorAjar, door.column, 0);
    }
    this.time.delayedCall(DOOR_SWING_MS, () => {
      for (const door of this.run.doors) {
        this.walls.putTileAt(FRAME.doorOpen, door.column, 0);
        this.showDoorReward(door);
      }
      this.doorsReady = true;
    });
  }

  /** Under each open Door: an icon and a word for the Reward of the Room behind it. */
  private showDoorReward(door: Door): void {
    const x = door.column * TILE + TILE / 2;
    const reward = door.leadsTo.reward;
    const shown: Phaser.GameObjects.GameObject[] = [];

    if (reward) {
      const look = REWARD_LOOK[reward];
      const icon = this.add.image(x, TILE + 9, 'tiles', look.frame).setDepth(3);
      this.tweens.add({ targets: icon, y: icon.y + 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      shown.push(icon, this.addLabel(x, TILE + 23, look.label, look.colour, 7));
    } else {
      shown.push(this.addLabel(x, TILE + 8, 'Boss Room', '#ff9d5c', 8));
    }
    this.tweens.add({ targets: shown, alpha: { from: 0, to: 1 }, duration: 200 });
  }

  /** The Hero picks a Door by walking up into it. */
  private checkDoors(): void {
    if (!this.doorsReady || !this.run.doorsOpen || this.heroState.health.isDead) return;

    const body = this.hero.body as Body;
    const pushingUp = this.keys.up.isDown || body.blocked.up;
    // Standing against the top wall puts the Hero's middle 3 pixels below it.
    if (!pushingUp || this.hero.y > TILE + 6) return;

    const door = this.run.doors.find(
      (d) => Math.abs(this.hero.x - (d.column * TILE + TILE / 2)) <= TILE / 2,
    );
    if (door) this.leaveThrough(door);
  }

  private leaveThrough(door: Door): void {
    this.leaving = true;
    const body = this.hero.body as Body;
    body.setVelocity(0, 0);
    body.enable = false;

    this.hero.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.tweens.add({
      targets: this.hero,
      x: door.column * TILE + TILE / 2,
      y: TILE / 2 + 2,
      alpha: 0,
      duration: LEAVE_MS,
    });
    this.cameras.main.fadeOut(LEAVE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.run.enter(door);
      this.scene.restart({ run: this.run });
    });
  }

  private showSummaryAfter(delayMs: number): void {
    this.time.delayedCall(delayMs, () => {
      this.summaryVisible = true;
    });
  }

  /** Words drawn in the Room. They are rendered finely enough to stay sharp when scaled up. */
  private addLabel(x: number, y: number, text: string, colour: string, size: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontStyle: 'bold',
        fontSize: `${size}px`,
        color: colour,
        stroke: '#2b1d14',
        strokeThickness: 2,
        resolution: VIEW_SCALE,
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  // ---- Heads-up display --------------------------------------------------

  private publishHud(): void {
    const snapshot: HudSnapshot = {
      health: this.heroState.health.current,
      maxHealth: this.heroState.health.max,
      dodgeReadiness: this.heroState.dodgeReadiness(this.time.now),
      depth: this.run.depth,
      roomCount: RUN.rooms,
      isBossRoom: this.run.room.isBossRoom,
      enemiesLeft: this.room.enemiesLeft,
      gold: this.run.totalGold,
      doorsOpen: this.doorsReady && !this.leaving,
      summary: this.summaryVisible ? this.run.summary : null,
    };
    this.registry.set(HUD_KEY, snapshot);
  }
}

function cellCentre(cell: Cell): { x: number; y: number } {
  return { x: cell.col * TILE + TILE / 2, y: cell.row * TILE + TILE / 2 };
}
