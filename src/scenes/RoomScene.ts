import Phaser from 'phaser';
import { rollEncounter } from '../rules/encounter';
import { Health } from '../rules/health';
import { HeroState } from '../rules/hero';
import { LAYOUTS, type Cell, type Layout } from '../rules/layout';
import { Rng } from '../rules/rng';
import { RoomState } from '../rules/room';
import { BOLT, DODGE, HERO, RUSHER, TILE } from '../rules/tuning';
import { FRAME, HUD_KEY, ROOM_HEIGHT, ROOM_WIDTH, VIEW_SCALE, type HudSnapshot } from '../view';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Bolt = Phaser.Physics.Arcade.Image;
type Body = Phaser.Physics.Arcade.Body;

export interface RoomSceneData {
  /** Position of this Room in the chain; the first Room is Depth 1. */
  depth?: number;
  /** The Hero carried over from the previous Room, with whatever health is left. */
  hero?: HeroState;
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

/** One Room: the Hero fights a group of enemies until one side is gone. */
export class RoomScene extends Phaser.Scene {
  private depth = 1;
  private heroState!: HeroState;
  private room!: RoomState;

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
    this.depth = data.depth ?? 1;
    this.heroState = data.hero ?? new HeroState();
    this.enemyInfo.clear();
    this.boltExpiry.clear();
  }

  create(): void {
    const layout = LAYOUTS[0] as Layout;
    const rng = new Rng(Date.now());

    this.cameras.main.setZoom(VIEW_SCALE).centerOn(ROOM_WIDTH / 2, ROOM_HEIGHT / 2);
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
    this.publishHud();
  }

  update(): void {
    const now = this.time.now;
    const outcome = this.room.outcome;

    if (outcome !== 'fighting' && Phaser.Input.Keyboard.JustDown(this.keys.confirm)) {
      this.scene.restart(
        outcome === 'cleared' ? { depth: this.depth + 1, hero: this.heroState } : {},
      );
      return;
    }

    this.updateHero(now);
    this.updateBolts(now);
    this.updateEnemies(now);
    this.publishHud();
  }

  // ---- Building the Room -------------------------------------------------

  private buildWalls(layout: Layout, rng: Rng): void {
    const data = layout.walls.map((row) =>
      row.map((isWall) => {
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
    layer.setCollision(FRAME.wall);
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
    const spawns = rollEncounter(layout, this.depth, rng);
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
      this.hero.setTint(0x555555).setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
      this.hero.setAngle(90);
    }
  }

  // ---- Bolts -------------------------------------------------------------

  private fireBolt(direction: Phaser.Math.Vector2, now: number): void {
    const x = this.hero.x + direction.x * 8;
    const y = this.hero.y + direction.y * 8;
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
  }

  // ---- Heads-up display --------------------------------------------------

  private publishHud(): void {
    const snapshot: HudSnapshot = {
      health: this.heroState.health.current,
      maxHealth: this.heroState.health.max,
      dodgeReadiness: this.heroState.dodgeReadiness(this.time.now),
      depth: this.depth,
      enemiesLeft: this.room.enemiesLeft,
      outcome: this.room.outcome,
    };
    this.registry.set(HUD_KEY, snapshot);
  }
}

function cellCentre(cell: Cell): { x: number; y: number } {
  return { x: cell.col * TILE + TILE / 2, y: cell.row * TILE + TILE / 2 };
}
