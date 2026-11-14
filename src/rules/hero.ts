import { Health } from './health';
import { BOLT, DODGE, HERO } from './tuning';

export type HitResult = 'ignored' | 'hurt' | 'dead';

/**
 * The Hero's combat state: health, the Dodge, and how often bolts can be
 * fired. It knows nothing about the screen; callers pass in the current
 * time in milliseconds.
 */
export class HeroState {
  readonly health = new Health(HERO.maxHealth);

  private graceEndsAt = -Infinity;
  private dodgeEndsAt = -Infinity;
  private dodgeReadyAt = -Infinity;
  private nextBoltAt = -Infinity;

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
    this.dodgeReadyAt = this.dodgeEndsAt + DODGE.recoveryMs;
    return true;
  }

  /** 0 just after a Dodge, rising to 1 when the Dodge can be used again. */
  dodgeReadiness(now: number): number {
    if (now >= this.dodgeReadyAt) return 1;
    const total = DODGE.durationMs + DODGE.recoveryMs;
    return Math.max(0, 1 - (this.dodgeReadyAt - now) / total);
  }

  /** Fires a bolt if the cooldown has passed. Returns whether it fired. */
  tryFire(now: number): boolean {
    if (this.health.isDead || now < this.nextBoltAt) return false;
    this.nextBoltAt = now + BOLT.cooldownMs;
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
