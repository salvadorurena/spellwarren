import { describe, expect, it } from 'vitest';
import { baseCombatNumbers, BOON_IDS, BOON_INFO, Boons, volleyAngles } from './boon';
import { Rng } from './rng';
import { BOLT, BOON, DODGE, HERO } from './tuning';

function maxed(...ids: (typeof BOON_IDS)[number][]): Boons {
  const boons = new Boons();
  for (const id of ids) {
    for (let level = 0; level < BOON.maxLevel; level++) boons.take(id);
  }
  return boons;
}

describe('the pool of Boons', () => {
  it('holds about twelve, each with a name and a line saying what it does', () => {
    expect(BOON_IDS.length).toBe(12);
    const names = BOON_IDS.map((id) => BOON_INFO[id].name);
    expect(new Set(names).size).toBe(names.length);
    for (const id of BOON_IDS) expect(BOON_INFO[id].description.length).toBeGreaterThan(10);
  });
});

describe('a Boon offer', () => {
  it('is three different Boons', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const offer = new Boons().rollOffer(new Rng(seed));
      expect(offer).toHaveLength(BOON.offerSize);
      expect(new Set(offer.map((boon) => boon.id)).size).toBe(BOON.offerSize);
    }
  });

  it('shows the level the Hero already holds', () => {
    const boons = new Boons();
    for (const id of BOON_IDS) boons.take(id);
    boons.take('ricochet');
    for (const boon of boons.rollOffer(new Rng(3))) {
      expect(boon.level).toBe(boon.id === 'ricochet' ? 2 : 1);
    }
  });

  it('never includes a Boon at its highest level', () => {
    const boons = maxed('heavyBolts', 'splitBolt', 'fleetFoot');
    for (let seed = 1; seed <= 100; seed++) {
      const ids = boons.rollOffer(new Rng(seed)).map((boon) => boon.id);
      expect(ids).not.toContain('heavyBolts');
      expect(ids).not.toContain('splitBolt');
      expect(ids).not.toContain('fleetFoot');
    }
  });

  it('shrinks, then empties, as the last Boons reach their highest level', () => {
    const boons = maxed(...BOON_IDS.slice(2));
    expect(boons.rollOffer(new Rng(1))).toHaveLength(2);
    expect(maxed(...BOON_IDS).rollOffer(new Rng(1))).toEqual([]);
  });

  it('is the same for the same seed', () => {
    expect(new Boons().rollOffer(new Rng(9))).toEqual(new Boons().rollOffer(new Rng(9)));
  });
});

describe('taking a Boon', () => {
  it('starts it at level 1 and makes it stronger each time, up to the highest level', () => {
    const boons = new Boons();
    for (let level = 1; level <= BOON.maxLevel; level++) {
      boons.take('heavyBolts');
      expect(boons.level('heavyBolts')).toBe(level);
    }
    expect(() => boons.take('heavyBolts')).toThrow(/highest level/);
  });

  it('lists the Boons held in the order they were first taken', () => {
    const boons = new Boons();
    boons.take('frostBolts');
    boons.take('ricochet');
    boons.take('frostBolts');
    expect(boons.held).toEqual([
      { id: 'frostBolts', level: 2 },
      { id: 'ricochet', level: 1 },
    ]);
  });
});

describe("the Hero's combat numbers", () => {
  const base = baseCombatNumbers();

  it('are the tuning values with no Boons', () => {
    expect(new Boons().apply(base)).toEqual(base);
    expect(base.boltDamage).toBe(BOLT.damage);
    expect(base.heroSpeed).toBe(HERO.speed);
    expect(base.dodgeRecoveryMs).toBe(DODGE.recoveryMs);
    expect(base.boltsPerVolley).toBe(1);
  });

  it('are changed by every Boon, and more at each level', () => {
    for (const id of BOON_IDS) {
      const boons = new Boons();
      let previous = base;
      for (let level = 1; level <= BOON.maxLevel; level++) {
        boons.take(id);
        const now = boons.apply(base);
        expect(now, `${id} level ${level}`).not.toEqual(previous);
        previous = now;
      }
    }
  });

  it('get better, not worse', () => {
    const all = maxed(...BOON_IDS).apply(base);
    expect(all.boltCooldownMs).toBeLessThan(base.boltCooldownMs);
    expect(all.dodgeRecoveryMs).toBeLessThan(base.dodgeRecoveryMs);
    expect(all.heroSpeed).toBeGreaterThan(base.heroSpeed);
    expect(all.boltSpeed).toBeGreaterThan(base.boltSpeed);
    expect(all.boltLifetimeMs).toBeGreaterThan(base.boltLifetimeMs);
    expect(all.pierce).toBe(BOON.maxLevel * BOON.piercingBolts.pierce);
    expect(all.ricochets).toBe(BOON.maxLevel * BOON.ricochet.bounces);
    expect(all.boltsPerVolley).toBe(1 + BOON.maxLevel * BOON.splitBolt.extraBolts);
    expect(all.chainDamageShare).toBeGreaterThan(0);
    expect(all.burnDamagePerSecond).toBeGreaterThan(0);
    expect(all.slowSpeedMultiplier).toBeLessThan(1);
    expect(all.dodgeBlastDamage).toBeGreaterThan(0);
  });

  it('give a split volley more damage in total than a single bolt, but less per bolt', () => {
    const split = maxed('splitBolt').apply(base);
    expect(split.boltDamage).toBeLessThan(base.boltDamage);
    expect(split.boltDamage * split.boltsPerVolley).toBeGreaterThan(base.boltDamage);
  });
});

describe('a volley', () => {
  it('is one bolt straight ahead, or several spread evenly about the aim', () => {
    expect(volleyAngles(1, 9)).toEqual([0]);
    expect(volleyAngles(2, 9)).toEqual([-4.5, 4.5]);
    expect(volleyAngles(3, 9)).toEqual([-9, 0, 9]);
  });
});
