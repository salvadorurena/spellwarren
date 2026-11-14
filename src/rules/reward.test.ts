import { describe, expect, it } from 'vitest';
import { AVAILABLE_REWARDS, goldAtDepth, rollDoorRewards, type Reward } from './reward';
import { Rng } from './rng';
import { DOOR_OFFER, REWARD } from './tuning';

describe('Gold Rewards', () => {
  it('grow with Depth', () => {
    expect(goldAtDepth(1)).toBe(REWARD.goldBase + REWARD.goldPerDepth);
    expect(goldAtDepth(7)).toBe(REWARD.goldBase + 7 * REWARD.goldPerDepth);
    expect(goldAtDepth(10)).toBeGreaterThan(goldAtDepth(9));
  });
});

describe('the Rewards behind a set of Doors', () => {
  it('can be any of the three kinds', () => {
    expect([...AVAILABLE_REWARDS].sort()).toEqual(['boon', 'gold', 'healing']);
  });

  it('are exactly two different ones when two kinds are available', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rewards = rollDoorRewards(['gold', 'healing'], new Rng(seed));
      expect([...rewards].sort()).toEqual(['gold', 'healing']);
    }
  });

  it('are two or three, all different, when three kinds are available', () => {
    const all: Reward[] = ['gold', 'healing', 'boon'];
    const counts = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const rewards = rollDoorRewards(all, new Rng(seed));
      counts.add(rewards.length);
      expect(new Set(rewards).size).toBe(rewards.length);
      for (const reward of rewards) expect(all).toContain(reward);
    }
    expect([...counts].sort()).toEqual([DOOR_OFFER.minDoors, DOOR_OFFER.maxDoors]);
  });

  it('come in both orders, so no Reward always sits on the same side', () => {
    const firsts = new Set<Reward | undefined>();
    for (let seed = 1; seed <= 50; seed++) {
      firsts.add(rollDoorRewards(['gold', 'healing'], new Rng(seed))[0]);
    }
    expect(firsts.size).toBe(2);
  });

  it('repeat a Reward only when it is the single kind available', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rewards = rollDoorRewards(['gold'], new Rng(seed));
      expect(rewards.length).toBeGreaterThanOrEqual(DOOR_OFFER.minDoors);
      expect(rewards.length).toBeLessThanOrEqual(DOOR_OFFER.maxDoors);
      expect(new Set(rewards)).toEqual(new Set(['gold']));
    }
  });

  it('ignore a kind listed twice', () => {
    const rewards = rollDoorRewards(['gold', 'gold', 'healing'], new Rng(3));
    expect([...rewards].sort()).toEqual(['gold', 'healing']);
  });

  it('cannot be chosen from nothing', () => {
    expect(() => rollDoorRewards([], new Rng(1))).toThrow(/No Rewards/);
  });

  it('are the same for the same seed', () => {
    const all: Reward[] = ['gold', 'healing', 'boon'];
    expect(rollDoorRewards(all, new Rng(9))).toEqual(rollDoorRewards(all, new Rng(9)));
  });
});
