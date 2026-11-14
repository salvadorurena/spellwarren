import type { CombatNumbers } from './boon';
import { PERMANENT_UPGRADE } from './tuning';

/** The Permanent Upgrades sold in the Shop, in the order the Shop shows them. See GLOSSARY.md. */
export const PERMANENT_UPGRADE_IDS = [
  'toughness',
  'sharperBolts',
  'practisedCasting',
  'lightStep',
  'steadyBreath',
  'goldSense',
] as const;

export type PermanentUpgradeId = (typeof PERMANENT_UPGRADE_IDS)[number];

/** How many levels each Permanent Upgrade has. */
export const PERMANENT_UPGRADE_MAX_LEVEL = PERMANENT_UPGRADE.prices.length;

/** The level of every Permanent Upgrade, 0 for one not bought. */
export type PermanentUpgradeLevels = Readonly<Record<PermanentUpgradeId, number>>;

export interface PermanentUpgradeInfo {
  readonly name: string;
  /** One line saying what each level does. */
  readonly description: string;
}

export const PERMANENT_UPGRADE_INFO: Record<PermanentUpgradeId, PermanentUpgradeInfo> = {
  toughness: { name: 'Toughness', description: 'The Hero starts every Run with 1 more health.' },
  sharperBolts: { name: 'Sharper Bolts', description: 'Bolts do 2 more damage.' },
  practisedCasting: { name: 'Practised Casting', description: 'Bolts fire 6% faster.' },
  lightStep: { name: 'Light Step', description: 'The Hero moves 5% faster.' },
  steadyBreath: { name: 'Steady Breath', description: 'The Dodge is ready 8% sooner.' },
  goldSense: { name: 'Gold Sense', description: 'Gold Rewards are worth 15% more.' },
};

/** Every Permanent Upgrade at level 0. */
export function noPermanentUpgrades(): PermanentUpgradeLevels {
  return Object.fromEntries(PERMANENT_UPGRADE_IDS.map((id) => [id, 0])) as Record<PermanentUpgradeId, number>;
}

/** What the next level costs for a Permanent Upgrade at the given level, or null at the highest level. */
export function nextLevelPrice(level: number): number | null {
  return PERMANENT_UPGRADE.prices[level] ?? null;
}

/** The given numbers with the Permanent Upgrades applied. Boons are applied on top of these. */
export function applyPermanentUpgrades(levels: PermanentUpgradeLevels, base: CombatNumbers): CombatNumbers {
  const u = PERMANENT_UPGRADE;
  return {
    ...base,
    maxHealth: base.maxHealth + levels.toughness * u.toughness.maxHealth,
    boltDamage: base.boltDamage + levels.sharperBolts * u.sharperBolts.damage,
    boltCooldownMs: base.boltCooldownMs * u.practisedCasting.cooldownMultiplier ** levels.practisedCasting,
    heroSpeed: base.heroSpeed * (1 + levels.lightStep * u.lightStep.speedMultiplier),
    dodgeRecoveryMs: base.dodgeRecoveryMs * u.steadyBreath.recoveryMultiplier ** levels.steadyBreath,
  };
}

/** A Gold Reward with Gold Sense at the given level, rounded to whole Gold. */
export function goldWithGoldSense(gold: number, level: number): number {
  return Math.round(gold * (1 + level * PERMANENT_UPGRADE.goldSense.goldMultiplier));
}
