import type { Rng } from './rng';
import { DOOR_OFFER, REWARD } from './tuning';

/**
 * What the player receives for clearing a Room, known in advance from the
 * Door that led to it. See GLOSSARY.md.
 */
export type Reward = 'gold' | 'healing' | 'boon';

/**
 * The Rewards a Run can currently give. Boons do not exist yet; when they
 * do, add 'boon' to this list.
 */
export const AVAILABLE_REWARDS: readonly Reward[] = ['gold', 'healing'];

/** How much Gold a Gold Reward is worth in a Room at the given Depth. */
export function goldAtDepth(depth: number): number {
  return REWARD.goldBase + REWARD.goldPerDepth * Math.max(1, depth);
}

/**
 * Chooses the Rewards shown on the Doors out of a cleared Room, one per
 * Door. There are two or three Doors, and they all show different Rewards
 * whenever enough kinds are available: with only two kinds there are
 * exactly two Doors. Only if a single kind is available do Doors repeat it.
 */
export function rollDoorRewards(available: readonly Reward[], rng: Rng): Reward[] {
  const kinds = [...new Set(available)];
  const only = kinds[0];
  if (only === undefined) throw new Error('No Rewards are available to put behind the Doors');

  const wanted = rng.int(DOOR_OFFER.minDoors, DOOR_OFFER.maxDoors);
  if (kinds.length < DOOR_OFFER.minDoors) {
    return Array.from({ length: wanted }, () => only);
  }
  return rng.shuffle(kinds).slice(0, Math.min(wanted, kinds.length));
}
