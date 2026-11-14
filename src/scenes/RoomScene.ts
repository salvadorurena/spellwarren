import Phaser from 'phaser';
import { BOON_INFO, volleyAngles, type BoonId } from '../rules/boon';
import { rollEncounter } from '../rules/encounter';
import { Enemy, type EnemyAction, type EnemyKind } from '../rules/enemy';
import { cellAt, cellCentre, FlowField, isWall, lineIsClear, type Point } from '../rules/flow';
import type { HeroState } from '../rules/hero';
import type { Bank } from '../rules/bank';
import type { Cell, Layout } from '../rules/layout';
import { Rng } from '../rules/rng';
import { RoomState } from '../rules/room';
import { Run, type Door, type RewardGrant } from '../rules/run';
import { CHARGER, DODGE, RUN, SHOOTER, TILE } from '../rules/tuning';
import {
  BANK_KEY,
  BOON_CHOSEN_EVENT,
  BOON_COLOUR,
  ENEMY_LOOK,
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
  brain: Enemy;
  /** Enemies fade in and cannot move or hurt until this time. */
  activeAt: number;
  /** While knocked back, an enemy does not steer. */
  knockedUntil: number;
  /** An enemy flashes white until this time after being hit. */
  flashUntil: number;
  /** The spawner that made this spawnling, if any. */
  parent: Sprite | null;
}

interface BoltInfo {
  expiresAt: number;
  damage: number;
  /** How many more enemies this bolt passes through. */
  pierceLeft: number;
  /** How many more walls this bolt bounces off. */
  bouncesLeft: number;
  /** Enemies this bolt has already hit, so a piercing bolt hits each once. */
  hit: Set<Sprite>;
}

const SPAWN_FADE_MS = 700;
/** A spawnling appears faster than the enemies a Room starts with. */
const SPAWNLING_FADE_MS = 350;
const KNOCKBACK_MS = 110;
const KNOCKBACK_SPEED = 130;
const HIT_FLASH_MS = 70;
/** Only small enemies are pushed back by a bolt. */
const PUSHED_BY_BOLTS: Record<EnemyKind, boolean> = {
  rusher: true,
  spawnling: true,
  shooter: true,
  charger: false,
  spawner: false,
};
/** How wide an enemy is, when checking that it can walk a straight line. */
const ENEMY_HALF_WIDTH = 6;
/** After a Boon Room is cleared, the choice of Boons appears this long afterwards. */
const BOON_OFFER_DELAY_MS = 600;

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
  /** True while the game is paused to ask whether to abandon the Run. */
  private askingToAbandon = false;
  /** When the current pause began, on the scene's clock. */
  private pausedAt = 0;
  /** All the time spent paused in this Room, which the Room's own clock leaves out. */
  private pausedMs = 0;
  /** True while the Boon cards are on screen and the Room waits for a choice. */
  private choosingBoon = false;
  private wasDodging = false;

  private hero!: Sprite;
  private walls!: Phaser.Tilemaps.TilemapLayer;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bolts!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;
  private enemyInfo = new Map<Sprite, EnemyInfo>();
  private boltInfo = new Map<Bolt, BoltInfo>();
  private shotExpiry = new Map<Bolt, number>();
  private layout!: Layout;
  private flow!: FlowField;
  /** Warnings drawn on the floor, such as the line a charger is about to take. */
  private warnings!: Phaser.GameObjects.Graphics;

  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'dodge', Phaser.Input.Keyboard.Key>;
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
    this.askingToAbandon = false;
    this.pausedAt = 0;
    this.pausedMs = 0;
    this.choosingBoon = false;
    this.wasDodging = false;
    this.enemyInfo.clear();
    this.boltInfo.clear();
    this.shotExpiry.clear();
  }

  /** A new Run: Depth 1 and full health, with the banked Gold of every Run before it. */
  private startRun(): Run {
    const bank = this.registry.get(BANK_KEY) as Bank;
    return new Run({ bank, rng: new Rng(Date.now()) });
  }

  create(): void {
    const layout = this.run.room.layout;
    const rng = this.run.rng;
    this.layout = layout;
    this.flow = new FlowField(layout);

    this.cameras.main.setZoom(VIEW_SCALE).centerOn(ROOM_WIDTH / 2, ROOM_HEIGHT / 2);
    this.cameras.main.fadeIn(ENTER_FADE_MS);
    this.input.mouse?.disableContextMenu();

    this.buildWalls(layout, rng);
    this.warnings = this.add.graphics().setDepth(2);
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
    };
    // Enter and Esc answer questions, so they act on the press itself rather
    // than being checked each frame, where a very quick tap could be missed.
    keyboard.on('keydown-ENTER', (event: KeyboardEvent) => {
      if (!event.repeat) this.enterPressed();
    });
    keyboard.on('keydown-ESC', (event: KeyboardEvent) => {
      if (!event.repeat) this.escPressed();
    });

    this.game.events.on(BOON_CHOSEN_EVENT, this.boonChosen, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(BOON_CHOSEN_EVENT, this.boonChosen, this);
    });

    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    if (this.room.outcome === 'cleared') this.roomCleared();
    this.publishHud();
  }

  /**
   * The Room's clock in milliseconds. It stands still while the game is
   * paused, so cooldowns and enemy timers carry on where they left off.
   */
  private get now(): number {
    // Phaser's own clock keeps counting while paused, so stop at the moment the pause began.
    const sceneNow = this.askingToAbandon ? this.pausedAt : this.time.now;
    return sceneNow - this.pausedMs;
  }

  update(): void {
    if (this.askingToAbandon) {
      this.publishHud();
      return;
    }

    const now = this.now;

    if (!this.leaving) {
      this.updateHero(now);
      this.checkDoors();
    }
    this.updateBolts(now);
    this.updateShots(now);
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
    this.physics.add.collider(this.bolts, this.walls, (bolt) => this.boltHitsWall(bolt as Bolt));

    this.shots = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image });
    this.physics.add.collider(this.shots, this.walls, (shot) => this.removeShot(shot as Bolt));
    this.physics.add.overlap(this.hero, this.shots, (_hero, shot) => this.shotHitsHero(shot as Bolt));
  }

  private createEnemies(layout: Layout, rng: Rng): void {
    const spawns = rollEncounter(layout, this.run.depth, rng);
    this.room = new RoomState(spawns.length);
    this.enemies = this.physics.add.group();

    for (const spawn of spawns) {
      this.addEnemy(spawn.kind, cellCentre(spawn.cell), SPAWN_FADE_MS, null);
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

  private addEnemy(kind: EnemyKind, at: Point, fadeMs: number, parent: Sprite | null): Sprite {
    const now = this.now;
    const look = ENEMY_LOOK[kind];
    const enemy = this.enemies.create(at.x, at.y, 'tiles', look.frame) as Sprite;
    enemy.setScale(look.scale).setCircle(5, 3, 5).setDepth(5).setAlpha(0);
    this.tweens.add({ targets: enemy, alpha: 1, duration: fadeMs });
    this.enemyInfo.set(enemy, {
      brain: new Enemy(kind, now + fadeMs, this.run.rng),
      activeAt: now + fadeMs,
      knockedUntil: 0,
      flashUntil: 0,
      parent,
    });
    return enemy;
  }

  // ---- The Hero ------------------------------------------------------------

  private updateHero(now: number): void {
    const body = this.hero.body as Body;
    if (this.heroState.health.isDead || this.choosingBoon) {
      body.setVelocity(0, 0);
      return;
    }

    const combat = this.heroState.combat;
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

    const dodging = this.heroState.isDodging(now);
    if (dodging) {
      const speed = combat.heroSpeed * DODGE.speedMultiplier;
      body.setVelocity(this.dodgeDirection.x * speed, this.dodgeDirection.y * speed);
    } else {
      body.setVelocity(move.x * combat.heroSpeed, move.y * combat.heroSpeed);
    }
    if (this.wasDodging && !dodging && combat.dodgeBlastDamage > 0) this.dodgeBlast();
    this.wasDodging = dodging;

    if (this.input.activePointer.isDown && this.heroState.tryFire(now)) {
      this.fireVolley(aim, now);
    }

    this.showHeroState(now);
  }

  /** Dodge Blast: a ring bursts from the Hero and damages every enemy inside it. */
  private dodgeBlast(): void {
    const { dodgeBlastDamage, dodgeBlastRadius } = this.heroState.combat;
    const ring = this.add.circle(this.hero.x, this.hero.y, dodgeBlastRadius).setDepth(4);
    ring.setStrokeStyle(2, 0x9be7ff, 0.9).setFillStyle(0x9be7ff, 0.18).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 260, onComplete: () => ring.destroy() });

    for (const enemy of [...this.enemyInfo.keys()]) {
      const reach = dodgeBlastRadius + enemy.displayWidth / 3;
      if (Phaser.Math.Distance.Between(this.hero.x, this.hero.y, enemy.x, enemy.y) <= reach) {
        this.damageEnemy(enemy, dodgeBlastDamage, null);
      }
    }
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
    const info = this.enemyInfo.get(enemy);
    if (!info || this.now < info.activeAt) return;
    this.hurtHero(info.brain.contactDamage);
  }

  /** Returns false if the Hero took nothing: mid-Dodge, in the grace period, or the fight is over. */
  private hurtHero(damage: number): boolean {
    if (damage <= 0 || this.room.outcome !== 'fighting') return false;
    const result = this.heroState.takeHit(damage, this.now);
    if (result === 'ignored') return false;

    // Phaser multiplies shake by the camera zoom, so this is about 2 Room pixels.
    this.cameras.main.shake(140, 0.0015);
    if (result === 'dead') {
      this.room.heroDied();
      this.run.heroDied();
      this.showSummaryAfter(SUMMARY_DELAY_MS.death);
      this.hero.setTint(0x555555).setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
      this.hero.setAngle(90);
    }
    return true;
  }

  // ---- Bolts -------------------------------------------------------------

  /** One press of the trigger: a single bolt, or several spread about the aim. */
  private fireVolley(aim: Phaser.Math.Vector2, now: number): void {
    const combat = this.heroState.combat;
    for (const degrees of volleyAngles(combat.boltsPerVolley, combat.volleySpreadDegrees)) {
      const direction = aim.clone().rotate(Phaser.Math.DegToRad(degrees));
      // Bolts start at the Hero's centre, so an enemy pressed right up against
      // the Hero is still hit rather than skipped over.
      const x = this.hero.x;
      const y = this.hero.y;
      const bolt = this.bolts.get(x, y, 'bolt') as Bolt | null;
      if (!bolt) continue;
      bolt.enableBody(true, x, y, true, true);
      bolt.setCircle(3, 1, 1).setDepth(8).setBounce(1);
      bolt.setVelocity(direction.x * combat.boltSpeed, direction.y * combat.boltSpeed);
      this.boltInfo.set(bolt, {
        expiresAt: now + combat.boltLifetimeMs,
        damage: combat.boltDamage,
        pierceLeft: combat.pierce,
        bouncesLeft: combat.ricochets,
        hit: new Set(),
      });
    }
  }

  private updateBolts(now: number): void {
    for (const [bolt, info] of this.boltInfo) {
      if (now >= info.expiresAt) this.removeBolt(bolt);
    }
  }

  private removeBolt(bolt: Bolt): void {
    this.boltInfo.delete(bolt);
    bolt.disableBody(true, true);
  }

  /** The physics has already bounced the bolt; it only survives if it has a bounce left. */
  private boltHitsWall(bolt: Bolt): void {
    const info = this.boltInfo.get(bolt);
    if (info && info.bouncesLeft > 0) {
      info.bouncesLeft -= 1;
      // After a bounce a bolt may hit the same enemy again.
      info.hit.clear();
    } else {
      this.removeBolt(bolt);
    }
  }

  private boltHitsEnemy(bolt: Bolt, enemy: Sprite): void {
    const bolted = this.boltInfo.get(bolt);
    const info = this.enemyInfo.get(enemy);
    if (!bolt.active || !bolted || !info || bolted.hit.has(enemy)) return;

    const now = this.now;
    // Enemies that are still fading in stop a bolt but cannot be hurt.
    if (now < info.activeAt) {
      this.removeBolt(bolt);
      return;
    }

    const combat = this.heroState.combat;
    const push = (bolt.body as Body).velocity.clone().normalize();
    if (bolted.pierceLeft > 0) {
      bolted.pierceLeft -= 1;
      bolted.hit.add(enemy);
    } else {
      this.removeBolt(bolt);
    }

    info.brain.burn(now, combat.burnDamagePerSecond, combat.burnDurationMs);
    info.brain.slow(now, combat.slowSpeedMultiplier, combat.slowDurationMs);
    if (combat.chainDamageShare > 0) this.chainSpark(enemy, bolted.damage * combat.chainDamageShare);
    this.damageEnemy(enemy, bolted.damage, push);
  }

  /** Chain Spark: part of a hit's damage jumps to the nearest other enemy in range. */
  private chainSpark(from: Sprite, damage: number): void {
    const range = this.heroState.combat.chainRange;
    const now = this.now;
    let nearest: Sprite | null = null;
    let nearestDistance = range;
    for (const [other, info] of this.enemyInfo) {
      if (other === from || now < info.activeAt) continue;
      const distance = Phaser.Math.Distance.Between(from.x, from.y, other.x, other.y);
      if (distance <= nearestDistance) {
        nearest = other;
        nearestDistance = distance;
      }
    }
    if (!nearest) return;

    const spark = this.add.graphics().setDepth(9);
    spark.lineStyle(1.5, 0xfff3a0, 1).lineBetween(from.x, from.y, nearest.x, nearest.y);
    this.tweens.add({ targets: spark, alpha: 0, duration: 160, onComplete: () => spark.destroy() });
    this.damageEnemy(nearest, damage, null);
  }

  /** Hurts an enemy. A push direction knocks a small enemy back. */
  private damageEnemy(enemy: Sprite, amount: number, push: Phaser.Math.Vector2 | null): void {
    const info = this.enemyInfo.get(enemy);
    if (!info) return;

    const now = this.now;
    info.brain.health.damage(amount);
    if (info.brain.health.isDead) {
      this.defeatEnemy(enemy);
      return;
    }
    info.flashUntil = now + HIT_FLASH_MS;
    if (push && PUSHED_BY_BOLTS[info.brain.kind] && !info.brain.isCommitted) {
      info.knockedUntil = now + KNOCKBACK_MS;
      (enemy.body as Body).setVelocity(push.x * KNOCKBACK_SPEED, push.y * KNOCKBACK_SPEED);
    }
  }

  // ---- Enemy shots -------------------------------------------------------

  private fireShot(from: Sprite, direction: Point, now: number): void {
    const shot = this.shots.get(from.x, from.y, 'shot') as Bolt | null;
    if (!shot) return;
    shot.enableBody(true, from.x, from.y, true, true);
    shot.setCircle(3, 2, 2).setDepth(7);
    shot.setVelocity(direction.x * SHOOTER.shotSpeed, direction.y * SHOOTER.shotSpeed);
    this.shotExpiry.set(shot, now + SHOOTER.shotLifetimeMs);
  }

  private updateShots(now: number): void {
    const fighting = this.room.outcome === 'fighting';
    for (const [shot, expiresAt] of this.shotExpiry) {
      if (!fighting || now >= expiresAt) this.removeShot(shot);
    }
  }

  private removeShot(shot: Bolt): void {
    this.shotExpiry.delete(shot);
    shot.disableBody(true, true);
  }

  /** A shot is spent on the Hero it hurts; a Dodging Hero lets it fly past. */
  private shotHitsHero(shot: Bolt): void {
    if (!shot.active) return;
    if (this.hurtHero(SHOOTER.shotDamage)) this.removeShot(shot);
  }

  // ---- Enemies -------------------------------------------------------------

  private updateEnemies(now: number): void {
    const fighting = this.room.outcome === 'fighting';
    const hero: Point = { x: this.hero.x, y: this.hero.y };
    this.flow.retarget(cellAt(hero));
    this.warnings.clear();

    for (const [enemy, info] of this.enemyInfo) {
      const body = enemy.body as Body;
      if (!fighting || now < info.activeAt) {
        body.setVelocity(0, 0);
        continue;
      }

      if (info.brain.sufferBurn(now) > 0 && info.brain.health.isDead) {
        this.defeatEnemy(enemy);
        continue;
      }

      const position: Point = { x: enemy.x, y: enemy.y };
      const action = info.brain.act({
        now,
        position,
        hero,
        heroInView: lineIsClear(this.layout, position, hero),
        hitWall: !body.blocked.none,
      });

      if (action.fire) this.fireShot(enemy, action.fire, now);
      if (action.spawn) this.spawnFrom(enemy);
      if (action.warningDirection) this.drawChargeWarning(position, action.warningDirection);
      this.showEnemyState(enemy, info, action, now);

      if (now < info.knockedUntil) continue;
      const velocity = this.steer(position, hero, action);
      body.setVelocity(velocity.x, velocity.y);
      if (action.motion.kind !== 'hold') enemy.setFlipX(hero.x < enemy.x);
    }
  }

  /** Turns what an enemy wants to do into a velocity. */
  private steer(position: Point, hero: Point, action: EnemyAction): Point {
    const { motion, speed } = action;
    if (motion.kind === 'hold') return { x: 0, y: 0 };
    if (motion.kind === 'dash') return { x: motion.direction.x * speed, y: motion.direction.y * speed };

    let target = hero;
    if (motion.kind === 'chase' && !lineIsClear(this.layout, position, hero, ENEMY_HALF_WIDTH)) {
      // Something is in the way: make for the next cell on the way round it.
      const next = this.flow.next(cellAt(position));
      if (next) target = cellCentre(next);
    }
    const dx = target.x - position.x;
    const dy = target.y - position.y;
    const distance = Math.hypot(dx, dy) || 1;
    const sign = motion.kind === 'retreat' ? -1 : 1;
    return { x: (dx / distance) * speed * sign, y: (dy / distance) * speed * sign };
  }

  /** A spawner makes a spawnling beside itself, on the side nearer the Hero. */
  private spawnFrom(spawner: Sprite): void {
    const cell = cellAt({ x: spawner.x, y: spawner.y });
    const at = cellCentre(this.flow.next(cell) ?? cell);
    this.addEnemy('spawnling', at, SPAWNLING_FADE_MS, spawner);
    this.room.enemyAdded();
  }

  /** A red line on the floor along the path a charger is about to take. */
  private drawChargeWarning(from: Point, direction: Point): void {
    const reach = (CHARGER.chargeSpeed * CHARGER.chargeMaxMs) / 1000;
    let length = 0;
    while (length < reach) {
      const point = { x: from.x + direction.x * (length + 4), y: from.y + direction.y * (length + 4) };
      if (isWall(this.layout, cellAt(point))) break;
      length += 4;
    }
    this.warnings
      .lineStyle(10, 0xff4a3d, 0.22)
      .lineBetween(from.x, from.y, from.x + direction.x * length, from.y + direction.y * length);
  }

  /** Colours an enemy by what is happening to it, most urgent first. */
  private showEnemyState(enemy: Sprite, info: EnemyInfo, action: EnemyAction, now: number): void {
    enemy.setAngle(action.mood === 'stunned' ? 90 : 0);
    if (now < info.flashUntil) {
      enemy.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    } else if (action.mood === 'warning' && Math.floor(now / 90) % 2 === 0) {
      enemy.setTint(0xff5a4a).setTintMode(Phaser.TintModes.FILL);
    } else if (action.mood === 'stunned') {
      enemy.setTint(0x8f8fb5).setTintMode(Phaser.TintModes.MULTIPLY);
    } else if (info.brain.isBurning(now)) {
      enemy.setTint(0xff9a55).setTintMode(Phaser.TintModes.MULTIPLY);
    } else if (info.brain.isSlowed(now)) {
      enemy.setTint(0x86c8ff).setTintMode(Phaser.TintModes.MULTIPLY);
    } else {
      enemy.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  private defeatEnemy(enemy: Sprite): void {
    const info = this.enemyInfo.get(enemy);
    if (!info) return;
    this.enemyInfo.delete(enemy);
    this.room.enemyDefeated();
    if (info.parent) this.enemyInfo.get(info.parent)?.brain.broodLost();

    // A white ghost of the enemy that puffs outward and fades.
    const puff = this.add
      .image(enemy.x, enemy.y, 'tiles', enemy.frame.name)
      .setScale(enemy.scale)
      .setTint(0xffffff)
      .setTintMode(Phaser.TintModes.FILL)
      .setDepth(6);
    this.tweens.add({
      targets: puff,
      scale: enemy.scale * 1.8,
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
    } else if (this.run.boonOffer) {
      // The Doors stay shut until the player has chosen a Boon.
      this.time.delayedCall(BOON_OFFER_DELAY_MS, () => {
        this.choosingBoon = this.run.outcome === 'underway';
      });
    } else {
      this.time.delayedCall(DOORS_OPEN_DELAY_MS, () => this.openDoors());
    }
  }

  /** The player picked a Boon card. */
  private boonChosen(id: BoonId): void {
    if (!this.choosingBoon || !this.run.boonOffer?.some((boon) => boon.id === id)) return;
    this.run.chooseBoon(id);
    this.choosingBoon = false;

    const text = `${BOON_INFO[id].name}  Lv ${this.run.boons.level(id)}`;
    this.floatLabel(text, BOON_COLOUR, 0);
    this.time.delayedCall(DOOR_SWING_MS, () => this.openDoors());
  }

  private showGrant(grant: RewardGrant): void {
    const lines: { text: string; colour: string }[] = [];
    if (grant.gold > 0) lines.push({ text: `+${grant.gold} Gold`, colour: GOLD_COLOUR });
    if (grant.reward === 'healing') {
      const text = grant.health > 0 ? `+${grant.health} health` : 'Health already full';
      lines.push({ text, colour: REWARD_LOOK.healing.colour });
    }
    lines.forEach((line, i) => this.floatLabel(line.text, line.colour, i));
  }

  /** Words that rise from the Hero and fade. */
  private floatLabel(text: string, colour: string, line: number): void {
    // Keep the words inside the Room when the Hero is against a wall.
    const x = Phaser.Math.Clamp(this.hero.x, 50, ROOM_WIDTH - 50);
    const y = Math.max(TILE + 18, this.hero.y - 12) + line * 10;
    const label = this.addLabel(x, y, text, colour, 9);
    this.tweens.add({
      targets: label,
      y: y - 16,
      alpha: { from: 1, to: 0 },
      duration: 1500,
      ease: 'Cubic.easeIn',
      onComplete: () => label.destroy(),
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

  // ---- Leaving a Run early -----------------------------------------------

  /** Enter leaves the Run summary for the Menu, or confirms abandoning the Run. */
  private enterPressed(): void {
    if (this.summaryVisible) this.backToMenu();
    else if (this.askingToAbandon) this.abandonRun();
  }

  /** Esc asks whether to abandon the Run, or takes the question back. */
  private escPressed(): void {
    if (this.askingToAbandon) this.unpause();
    else if (this.canAbandon()) this.pause();
  }

  /** A Run can be left while it is being played, but not while a Boon is being chosen or a Door taken. */
  private canAbandon(): boolean {
    return this.run.outcome === 'underway' && !this.leaving && !this.choosingBoon;
  }

  /** Freezes the Room (physics, tweens, timers and its clock) while the question is on screen. */
  private pause(): void {
    this.askingToAbandon = true;
    this.pausedAt = this.time.now;
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
  }

  private unpause(): void {
    this.askingToAbandon = false;
    this.pausedMs += this.time.now - this.pausedAt;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
  }

  /** The Run ends here, as if the Hero had died; Gold already Banked is kept. */
  private abandonRun(): void {
    this.unpause();
    this.room.heroDied();
    this.run.abandon();
    (this.hero.body as Body).setVelocity(0, 0);
    this.summaryVisible = true;
  }

  private backToMenu(): void {
    this.scene.stop('Hud');
    this.scene.start('Menu');
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
      dodgeReadiness: this.heroState.dodgeReadiness(this.now),
      depth: this.run.depth,
      roomCount: RUN.rooms,
      isBossRoom: this.run.room.isBossRoom,
      enemiesLeft: this.room.enemiesLeft,
      gold: this.run.totalGold,
      doorsOpen: this.doorsReady && !this.leaving,
      boons: this.run.boons.held,
      boonOffer: this.choosingBoon ? this.run.boonOffer : null,
      summary: this.summaryVisible ? this.run.summary : null,
      askingToAbandon: this.askingToAbandon,
    };
    this.registry.set(HUD_KEY, snapshot);
  }
}
