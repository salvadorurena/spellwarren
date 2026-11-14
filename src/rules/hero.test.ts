import { describe, expect, it } from 'vitest';
import { Health } from './health';
import { HeroState } from './hero';
import { BOLT, DODGE, HERO } from './tuning';

describe('Health', () => {
  it('never drops below zero or rises above its maximum', () => {
    const health = new Health(5);
    health.damage(99);
    expect(health.current).toBe(0);
    expect(health.isDead).toBe(true);

    const other = new Health(5);
    other.damage(2);
    other.heal(99);
    expect(other.current).toBe(5);
  });

  it('cannot be healed back from death', () => {
    const health = new Health(3);
    health.damage(3);
    health.heal(2);
    expect(health.isDead).toBe(true);
  });
});

describe('the Hero being hit', () => {
  it('loses health and gets a grace period', () => {
    const hero = new HeroState();
    expect(hero.takeHit(1, 1000)).toBe('hurt');
    expect(hero.health.current).toBe(HERO.maxHealth - 1);

    expect(hero.takeHit(1, 1000 + HERO.hurtGraceMs - 1)).toBe('ignored');
    expect(hero.health.current).toBe(HERO.maxHealth - 1);

    expect(hero.takeHit(1, 1000 + HERO.hurtGraceMs)).toBe('hurt');
  });

  it('dies when health runs out, and ignores hits afterwards', () => {
    const hero = new HeroState();
    expect(hero.takeHit(HERO.maxHealth, 0)).toBe('dead');
    expect(hero.takeHit(1, 99999)).toBe('ignored');
  });
});

describe('the Dodge', () => {
  it('makes the Hero invulnerable for its duration only', () => {
    const hero = new HeroState();
    expect(hero.tryDodge(0)).toBe(true);
    expect(hero.takeHit(1, DODGE.durationMs - 1)).toBe('ignored');
    expect(hero.takeHit(1, DODGE.durationMs)).toBe('hurt');
  });

  it('cannot be used again until it has recovered', () => {
    const hero = new HeroState();
    const ready = DODGE.durationMs + DODGE.recoveryMs;
    hero.tryDodge(0);
    expect(hero.tryDodge(ready - 1)).toBe(false);
    expect(hero.dodgeReadiness(ready - 1)).toBeLessThan(1);
    expect(hero.dodgeReadiness(ready)).toBe(1);
    expect(hero.tryDodge(ready)).toBe(true);
  });
});

describe('firing bolts', () => {
  it('is limited by the cooldown', () => {
    const hero = new HeroState();
    expect(hero.tryFire(0)).toBe(true);
    expect(hero.tryFire(BOLT.cooldownMs - 1)).toBe(false);
    expect(hero.tryFire(BOLT.cooldownMs)).toBe(true);
  });

  it('stops when the Hero is dead', () => {
    const hero = new HeroState();
    hero.takeHit(HERO.maxHealth, 0);
    expect(hero.tryFire(5000)).toBe(false);
    expect(hero.tryDodge(5000)).toBe(false);
  });
});
