import type { Bank } from './bank';
import { baseCombatNumbers, Boons, type BoonId, type BoonOffer, type CombatNumbers } from './boon';
import { HeroState } from './hero';
import { LAYOUTS, type Layout } from './layout';
import { AVAILABLE_REWARDS, goldAtDepth, rollDoorRewards, type Reward } from './reward';
import type { Rng } from './rng';
import { DOOR_COLUMNS, REWARD, RUN } from './tuning';

/** The Boss Room sits one Depth past the last Room of the chain. */
export const BOSS_DEPTH = RUN.rooms + 1;

/** What is settled about a Room before it is fought. */
export interface RoomPlan {
  /** Position in the chain; the first Room is Depth 1. */
  readonly depth: number;
  readonly layout: Layout;
  /** What clearing this Room gives. The Boss Room has no Reward. */
  readonly reward: Reward | null;
  readonly isBossRoom: boolean;
}

/** An exit from a cleared Room. It shows the Reward of the Room it leads to. */
export interface Door {
  /** Which column of the top wall the Door sits in. */
  readonly column: number;
  readonly leadsTo: RoomPlan;
}

export type RunOutcome = 'underway' | 'death' | 'victory';

/** What clearing a Room actually gave, for showing to the player. */
export interface RewardGrant {
  readonly reward: Reward | null;
  /** Gold Banked by this clear. */
  readonly gold: number;
  /** Health actually restored, which is less than the Healing if the Hero was nearly full. */
  readonly health: number;
}

export interface RunSummary {
  readonly outcome: Exclude<RunOutcome, 'underway'>;
  readonly depthReached: number;
  /** Gold Banked during this Run alone. */
  readonly goldBanked: number;
  /** All the player's banked Gold, this Run included. */
  readonly totalGold: number;
}

export interface RunOptions {
  /** Where Gold is Banked. It is shared by every Run. */
  readonly bank: Bank;
  readonly rng: Rng;
  /** The Rewards that can appear behind Doors. */
  readonly rewards?: readonly Reward[];
  readonly layouts?: readonly Layout[];
}

/**
 * Picks the Layout for the next Room, avoiding the Layout of the Room
 * before it whenever there is another to choose.
 */
export function pickLayout(
  layouts: readonly Layout[],
  previous: Layout | undefined,
  rng: Rng,
): Layout {
  const others = layouts.filter((layout) => layout !== previous);
  const choices = others.length > 0 ? others : layouts;
  const picked = choices[rng.int(0, choices.length - 1)];
  if (!picked) throw new Error('There are no Layouts to build a Room on');
  return picked;
}

/**
 * Picks which Door columns are used, left to right. A single Door takes
 * the middle; otherwise the columns are chosen at random.
 */
export function rollDoorColumns(count: number, rng: Rng): number[] {
  if (count > DOOR_COLUMNS.length) {
    throw new Error(`${count} Doors do not fit in ${DOOR_COLUMNS.length} Door columns`);
  }
  if (count === 1) return [DOOR_COLUMNS[Math.floor(DOOR_COLUMNS.length / 2)] as number];
  return rng
    .shuffle(DOOR_COLUMNS)
    .slice(0, count)
    .sort((a, b) => a - b);
}

/**
 * One attempt at the game: a chain of Rooms joined by Doors, ending in
 * death or in victory over the Boss Room. See GLOSSARY.md.
 *
 * The Run decides what each Room gives and where its Doors lead. It does
 * not fight the Room: callers tell it when the Room is cleared, when the
 * Hero dies and which Door the Hero walks into.
 */
export class Run {
  /** The Boons taken during this Run. They are lost when it ends. */
  readonly boons = new Boons();
  /** The Hero for this Run. Health carries from Room to Room. */
  readonly hero = new HeroState(() => this.combat);
  /** The source of all randomness in this Run. */
  readonly rng: Rng;

  private readonly bank: Bank;
  private readonly rewards: readonly Reward[];
  private readonly layouts: readonly Layout[];

  private current: RoomPlan;
  private exits: readonly Door[];
  private cleared = false;
  private result: RunOutcome = 'underway';
  private banked = 0;
  private offer: readonly BoonOffer[] | null = null;

  constructor(options: RunOptions) {
    this.bank = options.bank;
    this.rng = options.rng;
    this.rewards = options.rewards ?? AVAILABLE_REWARDS;
    this.layouts = options.layouts ?? LAYOUTS;

    // The first Room's Reward is always Gold.
    this.current = this.planRoom(1, 'gold', undefined);
    this.exits = this.rollDoors();
  }

  /** The Hero's combat numbers with this Run's Boons applied. */
  get combat(): CombatNumbers {
    return this.boons.apply(baseCombatNumbers());
  }

  /** The Room the Hero is in. */
  get room(): RoomPlan {
    return this.current;
  }

  get depth(): number {
    return this.current.depth;
  }

  get outcome(): RunOutcome {
    return this.result;
  }

  /**
   * The Doors out of the current Room. They are known from the moment the
   * Room is entered but stay shut until it is cleared. The Boss Room has none.
   */
  get doors(): readonly Door[] {
    return this.exits;
  }

  /**
   * True once the current Room is cleared and the Hero may pick a Door.
   * After a Boon Reward the Doors wait until a Boon has been chosen.
   */
  get doorsOpen(): boolean {
    return this.cleared && this.result === 'underway' && this.offer === null;
  }

  /** The Boons to choose one from, while a Boon Reward is waiting to be taken. */
  get boonOffer(): readonly BoonOffer[] | null {
    return this.offer;
  }

  /** Takes one of the offered Boons, which lets the Doors open. */
  chooseBoon(id: BoonId): void {
    if (!this.offer?.some((boon) => boon.id === id)) {
      throw new Error('That Boon is not on offer');
    }
    this.boons.take(id);
    this.offer = null;
  }

  /** Gold Banked during this Run alone. */
  get goldBanked(): number {
    return this.banked;
  }

  /** All the player's banked Gold. */
  get totalGold(): number {
    return this.bank.gold;
  }

  /** The Run's summary once it has ended, and null while it is underway. */
  get summary(): RunSummary | null {
    if (this.result === 'underway') return null;
    return {
      outcome: this.result,
      depthReached: this.depth,
      goldBanked: this.banked,
      totalGold: this.bank.gold,
    };
  }

  /**
   * Call when every enemy in the current Room is defeated. Grants the
   * Room's Reward on the spot: Gold is Banked and Healing restores health.
   * A Boon Reward puts three Boons on offer, to be taken with `chooseBoon`.
   * Clearing the Boss Room wins the Run; any other Room opens its Doors.
   * Returns what was granted, or null if there was nothing to clear.
   */
  roomCleared(): RewardGrant | null {
    if (this.result !== 'underway' || this.cleared) return null;
    this.cleared = true;

    const { reward, depth, isBossRoom } = this.current;
    let gold = 0;
    let health = 0;
    if (reward === 'gold') gold = goldAtDepth(depth);
    if (reward === 'healing') health = this.hero.health.heal(REWARD.healing);
    if (reward === 'boon') {
      const offer = this.boons.rollOffer(this.rng);
      // With every Boon at its highest level there is nothing to offer, so the Room pays Gold.
      if (offer.length > 0) this.offer = offer;
      else gold = goldAtDepth(depth);
    }
    if (isBossRoom) gold += REWARD.bossRoomGold;

    if (gold > 0) {
      this.bank.bankGold(gold);
      this.banked += gold;
    }
    if (isBossRoom) this.result = 'victory';
    this.exits = this.withoutWastedHealing(this.exits);
    return { reward, gold, health };
  }

  /** Call when the Hero's health reaches zero. Death ends the Run for good. */
  heroDied(): void {
    if (this.result === 'underway') this.result = 'death';
  }

  /** The Hero walks into one of the open Doors and the next Room begins. */
  enter(door: Door): void {
    if (!this.doorsOpen) throw new Error('The Doors are shut until the Room is cleared');
    if (!this.exits.includes(door)) throw new Error('That Door does not lead out of this Room');
    this.current = door.leadsTo;
    this.cleared = false;
    this.exits = this.rollDoors();
  }

  /**
   * A Door offering Healing to a Hero at full health is a wasted choice.
   * If a kind of Reward is not on any Door, it takes that Door instead.
   */
  private withoutWastedHealing(doors: readonly Door[]): readonly Door[] {
    if (this.hero.health.current < this.hero.health.max) return doors;
    const shown = new Set(doors.map((door) => door.leadsTo.reward));
    const spare = this.rewards.find((reward) => reward !== 'healing' && !shown.has(reward));
    if (!spare) return doors;
    return doors.map((door) =>
      door.leadsTo.reward === 'healing' ? { ...door, leadsTo: { ...door.leadsTo, reward: spare } } : door,
    );
  }

  private planRoom(depth: number, reward: Reward | null, previous: Layout | undefined): RoomPlan {
    return {
      depth,
      layout: pickLayout(this.layouts, previous, this.rng),
      reward,
      isBossRoom: depth === BOSS_DEPTH,
    };
  }

  private rollDoors(): Door[] {
    const { depth, layout } = this.current;
    if (depth >= BOSS_DEPTH) return [];

    const next = depth + 1;
    // The last Room of the chain has one Door, to the Boss Room, with no Reward.
    const rewards: (Reward | null)[] =
      next === BOSS_DEPTH ? [null] : rollDoorRewards(this.rewards, this.rng);
    const columns = rollDoorColumns(rewards.length, this.rng);
    return rewards.map((reward, i) => ({
      column: columns[i] as number,
      leadsTo: this.planRoom(next, reward, layout),
    }));
  }
}
