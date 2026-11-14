import { describe, expect, it } from 'vitest';
import { Bank } from './bank';
import { PERMANENT_UPGRADE } from './tuning';
import { PERMANENT_UPGRADE_IDS, PERMANENT_UPGRADE_MAX_LEVEL } from './upgrade';

const [FIRST_PRICE, SECOND_PRICE, THIRD_PRICE] = PERMANENT_UPGRADE.prices;

describe('the Bank', () => {
  it('starts empty, or with the Gold it is given', () => {
    expect(new Bank().gold).toBe(0);
    expect(new Bank({ gold: 120 }).gold).toBe(120);
  });

  it('adds up Banked Gold', () => {
    const bank = new Bank();
    bank.bankGold(12);
    bank.bankGold(30);
    expect(bank.gold).toBe(42);
  });

  it('never loses Gold to Banking', () => {
    const bank = new Bank({ gold: 10 });
    bank.bankGold(-5);
    expect(bank.gold).toBe(10);
  });

  it('starts with no Permanent Upgrades', () => {
    const bank = new Bank();
    for (const id of PERMANENT_UPGRADE_IDS) expect(bank.level(id)).toBe(0);
  });

  it('ignores saved numbers that make no sense', () => {
    const bank = new Bank({ gold: -40, upgrades: { toughness: 99, lightStep: -2, goldSense: 1.7 } });
    expect(bank.gold).toBe(0);
    expect(bank.level('toughness')).toBe(PERMANENT_UPGRADE_MAX_LEVEL);
    expect(bank.level('lightStep')).toBe(0);
    expect(bank.level('goldSense')).toBe(1);
  });
});

describe('buying a Permanent Upgrade', () => {
  it('spends its price and raises it one level', () => {
    const bank = new Bank({ gold: 100 });
    bank.buy('toughness');
    expect(bank.gold).toBe(100 - (FIRST_PRICE as number));
    expect(bank.level('toughness')).toBe(1);
  });

  it('costs more at each level', () => {
    const bank = new Bank({ gold: 1000 });
    expect(bank.priceOf('sharperBolts')).toBe(FIRST_PRICE);
    bank.buy('sharperBolts');
    expect(bank.priceOf('sharperBolts')).toBe(SECOND_PRICE);
    bank.buy('sharperBolts');
    expect(bank.priceOf('sharperBolts')).toBe(THIRD_PRICE);
  });

  it('is refused without enough Gold, and nothing is spent', () => {
    const bank = new Bank({ gold: (FIRST_PRICE as number) - 1 });
    expect(bank.canBuy('lightStep')).toBe(false);
    expect(() => bank.buy('lightStep')).toThrow(/costs/);
    expect(bank.gold).toBe((FIRST_PRICE as number) - 1);
    expect(bank.level('lightStep')).toBe(0);
  });

  it('stops at the highest level', () => {
    const bank = new Bank({ gold: 10_000 });
    for (let i = 0; i < PERMANENT_UPGRADE_MAX_LEVEL; i++) bank.buy('goldSense');
    expect(bank.priceOf('goldSense')).toBeNull();
    expect(bank.canBuy('goldSense')).toBe(false);
    expect(() => bank.buy('goldSense')).toThrow(/highest level/);
  });

  it('leaves the other Permanent Upgrades alone', () => {
    const bank = new Bank({ gold: 100 });
    bank.buy('steadyBreath');
    expect(bank.level('practisedCasting')).toBe(0);
  });
});

describe('resetting progress', () => {
  it('forgets all Gold and every Permanent Upgrade', () => {
    const bank = new Bank({ gold: 500, upgrades: { toughness: 2, goldSense: 3 } });
    bank.reset();
    expect(bank.gold).toBe(0);
    for (const id of PERMANENT_UPGRADE_IDS) expect(bank.level(id)).toBe(0);
  });
});

describe('a change to the Bank', () => {
  it('is announced on Banking, buying and resetting, so it can be saved at once', () => {
    const bank = new Bank({ gold: 100 });
    let changes = 0;
    bank.onChange(() => (changes += 1));
    bank.bankGold(12);
    bank.buy('toughness');
    bank.reset();
    expect(changes).toBe(3);
  });

  it('is not announced when nothing was Banked', () => {
    const bank = new Bank();
    let changes = 0;
    bank.onChange(() => (changes += 1));
    bank.bankGold(0);
    expect(changes).toBe(0);
  });
});
