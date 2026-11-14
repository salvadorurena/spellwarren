import { describe, expect, it } from 'vitest';
import { Bank } from './bank';

describe('the Bank', () => {
  it('starts empty, or with the Gold it is given', () => {
    expect(new Bank().gold).toBe(0);
    expect(new Bank(120).gold).toBe(120);
  });

  it('adds up Banked Gold', () => {
    const bank = new Bank();
    bank.bankGold(12);
    bank.bankGold(30);
    expect(bank.gold).toBe(42);
  });

  it('never loses Gold', () => {
    const bank = new Bank(10);
    bank.bankGold(-5);
    expect(bank.gold).toBe(10);
  });
});
