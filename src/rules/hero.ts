import { baseCombatNumbers, type CombatNumbers } from './boon';
import { Health } from './health';
import { DODGE, HERO } from './tuning';

export type HitResult = 'ignored' | 'hurt' | 'dead';

/**
 * The Hero's combat state: health, the Dodge, and how often bolts can be
 * fired. It knows nothing about the screen; callers pass in the current
 * time in milliseconds.
 */
export class HeroState {
  readonly health: Health;

  private graceEndsAt = -Infinity;
  private dodgeEndsAt = -Infinity;
  private dodgeReadyAt = -Infinity;
  private nextBoltAt = -Infinity;

  /**
   * @param numbers Reads the Hero's current combat numbers, which change
   *   during a Run as Boons are taken. Maximum health is read once, at the
   *   start, because only Permanent Upgrades change it.
   */
  constructor(private readonly numbers: () => CombatNumbers = baseCombatNumbers) {
    this.health = new Health(numbers().maxHealth);
  }

  /** The Hero's combat numbers right now. */
  get combat(): CombatNumbers {
    return this.numbers();
  }

  isDodging(now: number): boolean {
    return now < this.dodgeEndsAt;
  }

  /** True while nothing can hurt the Hero: mid-Dodge, or just after being hurt. */
  isInvulnerable(now: number): boolean {
    return this.isDodging(now) || now < this.graceEndsAt;
  }

  /** Starts a Dodge if it has recovered. Returns whether it started. */
  tryDodge(now: number): boolean {
    if (this.health.isDead || now < this.dodgeReadyAt) return false;
    this.dodgeEndsAt = now + DODGE.durationMs;
    this.dodgeReadyAt = this.dodgeEndsAt + this.combat.dodgeRecoveryMs;
    return true;
  }

  /** 0 just after a Dodge, rising to 1 when the Dodge can be used again. */
  dodgeReadiness(now: number): number {
    if (now >= this.dodgeReadyAt) return 1;
    const total = DODGE.durationMs + this.combat.dodgeRecoveryMs;
    return Math.max(0, 1 - (this.dodgeReadyAt - now) / total);
  }

  /** Fires a bolt if the cooldown has passed. Returns whether it fired. */
  tryFire(now: number): boolean {
    if (this.health.isDead || now < this.nextBoltAt) return false;
    this.nextBoltAt = now + this.combat.boltCooldownMs;
    return true;
  }

  takeHit(damage: number, now: number): HitResult {
    if (this.health.isDead || this.isInvulnerable(now)) return 'ignored';
    this.health.damage(damage);
    if (this.health.isDead) return 'dead';
    this.graceEndsAt = now + HERO.hurtGraceMs;
    return 'hurt';
  }
}
