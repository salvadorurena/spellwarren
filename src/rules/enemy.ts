import type { Point } from './flow';
import { Health } from './health';
import type { Rng } from './rng';
import { BOON, CHARGER, RUSHER, SHOOTER, SPAWNER, SPAWNLING, TILE } from './tuning';

export type EnemyKind = 'rusher' | 'shooter' | 'charger' | 'spawner' | 'spawnling';

const STATS: Record<EnemyKind, { health: number; speed: number; contactDamage: number }> = {
  rusher: RUSHER,
  shooter: SHOOTER,
  charger: CHARGER,
  spawner: SPAWNER,
  spawnling: SPAWNLING,
};

/** What an enemy can tell about the Room at one moment. */
export interface EnemySenses {
  readonly now: number;
  readonly position: Point;
  readonly hero: Point;
  /** True if no wall stands between the enemy and the Hero. */
  readonly heroInView: boolean;
  /** True if the enemy ran into a wall since it last acted. */
  readonly hitWall: boolean;
}

export type Motion =
  /** Make for the Hero, going round walls. */
  | { readonly kind: 'chase' }
  /** Back away from the Hero. */
  | { readonly kind: 'retreat' }
  | { readonly kind: 'hold' }
  /** Go in a fixed direction, whatever is in the way. */
  | { readonly kind: 'dash'; readonly direction: Point };

/** What an enemy wants to do now. The caller moves it and carries out the rest. */
export interface EnemyAction {
  readonly motion: Motion;
  readonly speed: number;
  /** 'warning' is shown to the player before a charge or a shot; 'stunned' means helpless. */
  readonly mood: 'calm' | 'warning' | 'stunned';
  /** During a charger's warning, the direction the charge will take. */
  readonly warningDirection: Point | null;
  /** Set on the moment a shot is fired: the direction it flies. */
  readonly fire: Point | null;
  /** True on the moment a spawner makes a spawnling. */
  readonly spawn: boolean;
}

type Phase = 'roam' | 'warning' | 'charge' | 'stunned' | 'recover';

/**
 * One enemy: its health, what is burning or slowing it, and how its kind
 * behaves. It knows nothing about the screen.
 *
 * - A rusher (and a spawnling) runs at the Hero.
 * - A shooter keeps its distance, and stops to aim before each slow shot.
 * - A charger walks up, shows a warning, then charges in the direction it
 *   fixed when the warning began. Charging into a wall stuns it.
 * - A spawner plods after the Hero and makes spawnlings.
 */
export class Enemy {
  readonly health: Health;

  private phase: Phase = 'roam';
  private phaseEndsAt = 0;
  private direction: Point = { x: 1, y: 0 };
  /** When the next shot, charge or spawnling may begin. */
  private readyAt: number;
  private brood = 0;

  private slowedUntil = -Infinity;
  private slowMultiplier = 1;
  private burnUntil = -Infinity;
  private burnPerSecond = 0;
  private nextBurnAt = Infinity;

  constructor(readonly kind: EnemyKind, now: number, rng: Rng) {
    this.health = new Health(STATS[kind].health);
    // Stagger first actions so a group does not act as one.
    const wait = kind === 'shooter' ? SHOOTER.shotCooldownMs : kind === 'spawner' ? SPAWNER.spawnEveryMs : 0;
    this.readyAt = now + wait * (0.4 + 0.6 * rng.next());
  }

  /** Damage for touching the Hero right now; a stunned enemy does none. */
  get contactDamage(): number {
    if (this.phase === 'stunned') return 0;
    if (this.phase === 'charge') return CHARGER.chargeDamage;
    return STATS[this.kind].contactDamage;
  }

  /** True while the enemy cannot be pushed about: mid-warning or mid-charge. */
  get isCommitted(): boolean {
    return this.phase === 'warning' || this.phase === 'charge';
  }

  // ---- Burning and slowing ---------------------------------------------------

  slow(now: number, speedMultiplier: number, durationMs: number): void {
    if (durationMs <= 0) return;
    this.slowMultiplier = speedMultiplier;
    this.slowedUntil = Math.max(this.slowedUntil, now + durationMs);
  }

  isSlowed(now: number): boolean {
    return now < this.slowedUntil;
  }

  burn(now: number, damagePerSecond: number, durationMs: number): void {
    if (damagePerSecond <= 0 || durationMs <= 0) return;
    if (!this.isBurning(now)) this.nextBurnAt = now + BOON.burningBolts.tickMs;
    this.burnPerSecond = Math.max(this.burnPerSecond, damagePerSecond);
    this.burnUntil = now + durationMs;
  }

  isBurning(now: number): boolean {
    return now < this.burnUntil || this.nextBurnAt <= this.burnUntil;
  }

  /** Takes any burn damage that has come due. Returns how much was taken. */
  sufferBurn(now: number): number {
    let total = 0;
    while (this.nextBurnAt <= now && this.nextBurnAt <= this.burnUntil) {
      total += (this.burnPerSecond * BOON.burningBolts.tickMs) / 1000;
      this.nextBurnAt += BOON.burningBolts.tickMs;
    }
    if (this.nextBurnAt > this.burnUntil) this.burnPerSecond = 0;
    this.health.damage(total);
    return total;
  }

  /** Call when one of this spawner's spawnlings is defeated. */
  broodLost(): void {
    this.brood = Math.max(0, this.brood - 1);
  }

  // ---- Behaviour -------------------------------------------------------------

  act(senses: EnemySenses): EnemyAction {
    const pace = this.isSlowed(senses.now) ? this.slowMultiplier : 1;
    const speed = STATS[this.kind].speed * pace;
    switch (this.kind) {
      case 'shooter':
        return this.actShooter(senses, speed);
      case 'charger':
        return this.actCharger(senses, speed);
      case 'spawner':
        return this.actSpawner(senses, speed);
      default:
        return action({ kind: 'chase' }, speed);
    }
  }

  private actShooter(senses: EnemySenses, speed: number): EnemyAction {
    const { now } = senses;
    if (this.phase === 'warning') {
      if (now < this.phaseEndsAt) return action({ kind: 'hold' }, 0, { mood: 'warning' });
      this.phase = 'roam';
      this.readyAt = now + SHOOTER.shotCooldownMs;
      return action({ kind: 'hold' }, 0, { fire: towards(senses.position, senses.hero) });
    }

    const tiles = distance(senses.position, senses.hero) / TILE;
    const near = SHOOTER.preferredRangeTiles - SHOOTER.rangeSlackTiles;
    const far = SHOOTER.preferredRangeTiles + SHOOTER.rangeSlackTiles;

    if (senses.heroInView && now >= this.readyAt && tiles <= far + 2) {
      this.phase = 'warning';
      this.phaseEndsAt = now + SHOOTER.aimMs;
      return action({ kind: 'hold' }, 0, { mood: 'warning' });
    }
    if (!senses.heroInView || tiles > far) return action({ kind: 'chase' }, speed);
    if (tiles < near) return action({ kind: 'retreat' }, speed);
    return action({ kind: 'hold' }, 0);
  }

  private actCharger(senses: EnemySenses, speed: number): EnemyAction {
    const { now } = senses;
    switch (this.phase) {
      case 'warning':
        if (now < this.phaseEndsAt) {
          return action({ kind: 'hold' }, 0, { mood: 'warning', warningDirection: this.direction });
        }
        this.phase = 'charge';
        this.phaseEndsAt = now + CHARGER.chargeMaxMs;
        return action({ kind: 'dash', direction: this.direction }, CHARGER.chargeSpeed);

      case 'charge':
        if (senses.hitWall) {
          this.phase = 'stunned';
          this.phaseEndsAt = now + CHARGER.stunMs;
          return action({ kind: 'hold' }, 0, { mood: 'stunned' });
        }
        if (now >= this.phaseEndsAt) {
          this.phase = 'recover';
          this.phaseEndsAt = now + CHARGER.recoverMs;
          return action({ kind: 'hold' }, 0);
        }
        return action({ kind: 'dash', direction: this.direction }, CHARGER.chargeSpeed);

      case 'stunned':
      case 'recover':
        if (now < this.phaseEndsAt) {
          return action({ kind: 'hold' }, 0, { mood: this.phase === 'stunned' ? 'stunned' : 'calm' });
        }
        this.phase = 'roam';
        return action({ kind: 'chase' }, speed);

      default: {
        const tiles = distance(senses.position, senses.hero) / TILE;
        if (senses.heroInView && tiles <= CHARGER.triggerRangeTiles && now >= this.readyAt) {
          this.phase = 'warning';
          this.phaseEndsAt = now + CHARGER.warningMs;
          this.direction = towards(senses.position, senses.hero);
          return action({ kind: 'hold' }, 0, { mood: 'warning', warningDirection: this.direction });
        }
        return action({ kind: 'chase' }, speed);
      }
    }
  }

  private actSpawner(senses: EnemySenses, speed: number): EnemyAction {
    if (senses.now >= this.readyAt && this.brood < SPAWNER.maxBrood) {
      this.readyAt = senses.now + SPAWNER.spawnEveryMs;
      this.brood += 1;
      return action({ kind: 'chase' }, speed, { spawn: true });
    }
    return action({ kind: 'chase' }, speed);
  }
}

function action(
  motion: Motion,
  speed: number,
  extra: Partial<Pick<EnemyAction, 'mood' | 'warningDirection' | 'fire' | 'spawn'>> = {},
): EnemyAction {
  return { motion, speed, mood: 'calm', warningDirection: null, fire: null, spawn: false, ...extra };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The direction from one point to another, one unit long. */
function towards(from: Point, to: Point): Point {
  const length = distance(from, to);
  if (length === 0) return { x: 1, y: 0 };
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}
