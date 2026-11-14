import { describe, expect, it } from 'vitest';
import { Bank } from './bank';
import { readSave, SAVE_VERSION, writeSave } from './save';

describe('a save', () => {
  it('gives back the same Bank it was written from', () => {
    const bank = new Bank({ gold: 230, upgrades: { toughness: 2, sharperBolts: 1, goldSense: 3 } });
    expect(readSave(writeSave(bank)).state).toEqual(bank.state);
  });

  it('is a fresh start when there is none', () => {
    expect(readSave(null).state).toEqual(new Bank().state);
  });

  it('is a fresh start when it is damaged', () => {
    for (const text of ['', '{', 'null', '42', '"gold"', '[]']) {
      expect(readSave(text).state, text).toEqual(new Bank().state);
    }
  });

  it('is a fresh start when it comes from another version', () => {
    const text = JSON.stringify({ version: SAVE_VERSION + 1, gold: 500, upgrades: {} });
    expect(readSave(text).gold).toBe(0);
  });

  it('keeps what it can when some of it makes no sense', () => {
    const text = JSON.stringify({ version: SAVE_VERSION, gold: 75, upgrades: { toughness: 'lots', lightStep: 2, wings: 3 } });
    const bank = readSave(text);
    expect(bank.gold).toBe(75);
    expect(bank.level('toughness')).toBe(0);
    expect(bank.level('lightStep')).toBe(2);
  });
});
