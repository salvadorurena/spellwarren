import type { Rng } from './rng';
import { BOLT, BOON, DODGE, HERO, TILE } from './tuning';

/** The Boons in the pool. See GLOSSARY.md. */
export const BOON_IDS = [
  'swiftCasting',
  'heavyBolts',
  'piercingBolts',
  'splitBolt',
  'ricochet',
  'chainSpark',
  'burningBolts',
  'frostBolts',
  'farReach',
  'fleetFoot',
  'quickRecovery',
  'dodgeBlast',
] as const;

export type BoonId = (typeof BOON_IDS)[number];

export interface BoonInfo {
  readonly name: string;
  /** One line saying what the Boon does. */
  readonly description: string;
}

export const BOON_INFO: Record<BoonId, BoonInfo> = {
  swiftCasting: { name: 'Swift Casting', description: 'Bolts fire faster.' },
  heavyBolts: { name: 'Heavy Bolts', description: 'Bolts do more damage.' },
  piercingBolts: { name: 'Piercing Bolts', description: 'Bolts pass through one more enemy.' },
  splitBolt: { name: 'Split Bolt', description: 'Fire one more bolt in a narrow spread.' },
  ricochet: { name: 'Ricochet', description: 'Bolts bounce off walls one more time.' },
  chainSpark: { name: 'Chain Spark', description: 'A hit jumps to a nearby enemy.' },
  burningBolts: { name: 'Burning Bolts', description: 'Hit enemies burn for a few seconds.' },
  frostBolts: { name: 'Frost Bolts', description: 'Hit enemies are slowed for a moment.' },
  farReach: { name: 'Far Reach', description: 'Bolts fly faster, further and a little harder.' },
  fleetFoot: { name: 'Fleet Foot', description: 'The Hero moves faster.' },
  quickRecovery: { name: 'Quick Recovery', description: 'The Dodge is ready sooner.' },
  dodgeBlast: { name: 'Dodge Blast', description: 'Ending a Dodge damages enemies close by.' },
};

/**
 * Every number of the Hero's that a Boon or a Permanent Upgrade can change.
 * Distances are in Room pixels, times in milliseconds.
 */
export interface CombatNumbers {
  readonly heroSpeed: number;
  readonly dodgeRecoveryMs: number;
  readonly boltDamage: number;
  readonly boltCooldownMs: number;
  readonly boltSpeed: number;
  readonly boltLifetimeMs: number;
  /** How many bolts leave the Hero at once. */
  readonly boltsPerVolley: number;
  /** The angle between neighbouring bolts of a volley. */
  readonly volleySpreadDegrees: number;
  /** How many enemies a bolt passes through before the one that stops it. */
  readonly pierce: number;
  /** How many times a bolt bounces off a wall. */
  readonly ricochets: number;
  /** The share of a hit's damage that jumps to one nearby enemy; 0 for none. */
  readonly chainDamageShare: number;
  readonly chainRange: number;
  readonly burnDamagePerSecond: number;
  readonly burnDurationMs: number;
  /** A hit enemy moves at this share of its speed; 1 for no slowing. */
  readonly slowSpeedMultiplier: number;
  readonly slowDurationMs: number;
  /** Damage done around the Hero when a Dodge ends; 0 for none. */
  readonly dodgeBlastDamage: number;
  readonly dodgeBlastRadius: number;
}

/** The Hero's numbers with no Boons. */
export function baseCombatNumbers(): CombatNumbers {
  return {
    heroSpeed: HERO.speed,
    dodgeRecoveryMs: DODGE.recoveryMs,
    boltDamage: BOLT.damage,
    boltCooldownMs: BOLT.cooldownMs,
    boltSpeed: BOLT.speed,
    boltLifetimeMs: BOLT.lifetimeMs,
    boltsPerVolley: 1,
    volleySpreadDegrees: BOON.splitBolt.spreadDegrees,
    pierce: 0,
    ricochets: 0,
    chainDamageShare: 0,
    chainRange: BOON.chainSpark.rangeTiles * TILE,
    burnDamagePerSecond: 0,
    burnDurationMs: BOON.burningBolts.durationMs,
    slowSpeedMultiplier: 1,
    slowDurationMs: 0,
    dodgeBlastDamage: 0,
    dodgeBlastRadius: BOON.dodgeBlast.radiusTiles * TILE,
  };
}

/** A Boon on offer, with the level the Hero holds now (0 if none). */
export interface BoonOffer {
  readonly id: BoonId;
  readonly level: number;
}

/**
 * The Boons the Hero holds during one Run. Taking a Boon already held
 * makes it stronger, up to a highest level. A new Run starts with none.
 */
export class Boons {
  private levels = new Map<BoonId, number>();

  level(id: BoonId): number {
    return this.levels.get(id) ?? 0;
  }

  /** The Boons held, in the order they were first taken. */
  get held(): readonly BoonOffer[] {
    return [...this.levels].map(([id, level]) => ({ id, level }));
  }

  /**
   * Three different Boons to choose from. A Boon at its highest level is
   * never offered, so late in a Run there may be fewer than three, or none.
   */
  rollOffer(rng: Rng): BoonOffer[] {
    const open = BOON_IDS.filter((id) => this.level(id) < BOON.maxLevel);
    return rng
      .shuffle(open)
      .slice(0, BOON.offerSize)
      .map((id) => ({ id, level: this.level(id) }));
  }

  /** Takes a Boon, or raises it by one level if it is already held. */
  take(id: BoonId): void {
    const level = this.level(id);
    if (level >= BOON.maxLevel) throw new Error(`${BOON_INFO[id].name} is already at its highest level`);
    this.levels.set(id, level + 1);
  }

  /** The given numbers with every held Boon applied. */
  apply(base: CombatNumbers): CombatNumbers {
    const l = (id: BoonId) => this.level(id);
    const split = l('splitBolt');
    const far = l('farReach');
    const damage =
      (base.boltDamage + l('heavyBolts') * BOON.heavyBolts.damage + far * BOON.farReach.damage) *
      (split > 0 ? BOON.splitBolt.damageMultiplier : 1);

    return {
      ...base,
      heroSpeed: base.heroSpeed * (1 + l('fleetFoot') * BOON.fleetFoot.speedMultiplier),
      dodgeRecoveryMs:
        base.dodgeRecoveryMs * BOON.quickRecovery.recoveryMultiplier ** l('quickRecovery'),
      boltDamage: damage,
      boltCooldownMs: base.boltCooldownMs * BOON.swiftCasting.cooldownMultiplier ** l('swiftCasting'),
      boltSpeed: base.boltSpeed * (1 + far * BOON.farReach.speedMultiplier),
      boltLifetimeMs: base.boltLifetimeMs * (1 + far * BOON.farReach.lifetimeMultiplier),
      boltsPerVolley: base.boltsPerVolley + split * BOON.splitBolt.extraBolts,
      pierce: base.pierce + l('piercingBolts') * BOON.piercingBolts.pierce,
      ricochets: base.ricochets + l('ricochet') * BOON.ricochet.bounces,
      chainDamageShare: base.chainDamageShare + l('chainSpark') * BOON.chainSpark.damageShare,
      burnDamagePerSecond:
        base.burnDamagePerSecond + l('burningBolts') * BOON.burningBolts.damagePerSecond,
      slowSpeedMultiplier: l('frostBolts') > 0 ? BOON.frostBolts.speedMultiplier : 1,
      slowDurationMs: base.slowDurationMs + l('frostBolts') * BOON.frostBolts.durationMs,
      dodgeBlastDamage: base.dodgeBlastDamage + l('dodgeBlast') * BOON.dodgeBlast.damage,
    };
  }
}

/** The directions of a volley's bolts, in degrees either side of the aim. */
export function volleyAngles(bolts: number, spreadDegrees: number): number[] {
  return Array.from({ length: bolts }, (_, i) => (i - (bolts - 1) / 2) * spreadDegrees);
}
