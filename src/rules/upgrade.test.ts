import { describe, expect, it } from 'vitest';
import { Bank } from './bank';
import { baseCombatNumbers } from './boon';
import { goldAtDepth } from './reward';
import { Rng } from './rng';
import { Run } from './run';
import { BOLT, BOON, HERO } from './tuning';
import {
  applyPermanentUpgrades,
  goldWithGoldSense,
  noPermanentUpgrades,
  PERMANENT_UPGRADE_IDS,
  PERMANENT_UPGRADE_MAX_LEVEL,
  type PermanentUpgradeId,
} from './upgrade';

function withLevel(id: PermanentUpgradeId, level: number) {
  return { ...noPermanentUpgrades(), [id]: level };
}

describe('the Permanent Upgrades', () => {
  it('change nothing when none are bought', () => {
    expect(applyPermanentUpgrades(noPermanentUpgrades(), baseCombatNumbers())).toEqual(baseCombatNumbers());
  });

  it('each change the combat numbers more at every level, except Gold Sense', () => {
    for (const id of PERMANENT_UPGRADE_IDS.filter((id) => id !== 'goldSense')) {
      let previous = baseCombatNumbers();
      for (let level = 1; level <= PERMANENT_UPGRADE_MAX_LEVEL; level++) {
        const now = applyPermanentUpgrades(withLevel(id, level), baseCombatNumbers());
        expect(now, `${id} level ${level}`).not.toEqual(previous);
        previous = now;
      }
    }
  });

  it('only ever make the Hero stronger', () => {
    const base = baseCombatNumbers();
    const all = Object.fromEntries(PERMANENT_UPGRADE_IDS.map((id) => [id, PERMANENT_UPGRADE_MAX_LEVEL]));
    const best = applyPermanentUpgrades(all as ReturnType<typeof noPermanentUpgrades>, base);
    expect(best.maxHealth).toBeGreaterThan(base.maxHealth);
    expect(best.boltDamage).toBeGreaterThan(base.boltDamage);
    expect(best.boltCooldownMs).toBeLessThan(base.boltCooldownMs);
    expect(best.heroSpeed).toBeGreaterThan(base.heroSpeed);
    expect(best.dodgeRecoveryMs).toBeLessThan(base.dodgeRecoveryMs);
  });
});

describe('Gold Sense', () => {
  it('makes a Gold Reward worth more at every level, in whole Gold', () => {
    for (let depth = 1; depth <= 10; depth++) {
      let previous = goldAtDepth(depth);
      expect(goldWithGoldSense(previous, 0)).toBe(previous);
      for (let level = 1; level <= PERMANENT_UPGRADE_MAX_LEVEL; level++) {
        const gold = goldWithGoldSense(goldAtDepth(depth), level);
        expect(Number.isInteger(gold)).toBe(true);
        expect(gold).toBeGreaterThan(previous);
        previous = gold;
      }
    }
  });
});

describe('a Run with Permanent Upgrades', () => {
  it('starts the Hero with more health after Toughness', () => {
    const run = new Run({ bank: new Bank({ upgrades: { toughness: 2 } }), rng: new Rng(1) });
    expect(run.hero.health.max).toBe(HERO.maxHealth + 2);
    expect(run.hero.health.current).toBe(HERO.maxHealth + 2);
  });

  it('pays more for its first Room after Gold Sense', () => {
    const bank = new Bank({ upgrades: { goldSense: 3 } });
    const run = new Run({ bank, rng: new Rng(1) });
    expect(run.roomCleared()?.gold).toBe(goldWithGoldSense(goldAtDepth(1), 3));
    expect(bank.gold).toBe(goldWithGoldSense(goldAtDepth(1), 3));
  });

  it('puts Boons on top of the Permanent Upgrades', () => {
    const run = new Run({ bank: new Bank({ upgrades: { sharperBolts: 1 } }), rng: new Rng(1) });
    run.boons.take('heavyBolts');
    expect(run.combat.boltDamage).toBe(BOLT.damage + 2 + BOON.heavyBolts.damage);
  });

  it('keeps the Permanent Upgrades it started with, even if more are bought during it', () => {
    const bank = new Bank({ gold: 1000 });
    const run = new Run({ bank, rng: new Rng(1) });
    bank.buy('sharperBolts');
    expect(run.combat.boltDamage).toBe(BOLT.damage);
  });
});
