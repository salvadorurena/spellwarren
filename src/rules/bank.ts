import {
  nextLevelPrice,
  noPermanentUpgrades,
  PERMANENT_UPGRADE_IDS,
  PERMANENT_UPGRADE_MAX_LEVEL,
  type PermanentUpgradeId,
  type PermanentUpgradeLevels,
} from './upgrade';

/** Everything the Bank holds, in a form that can be saved and read back. */
export interface BankState {
  readonly gold: number;
  readonly upgrades: Partial<Record<PermanentUpgradeId, number>>;
}

/**
 * Everything the player keeps between Runs: banked Gold and the Permanent
 * Upgrades bought with it. Nothing in a Run can take Gold out of it, and a
 * new Run starts with whatever is already here.
 *
 * This is the one object that holds progress between Runs, so it is the
 * one object that is saved. Listeners hear about every change, so a save
 * can be written the moment Gold is Banked or spent.
 */
export class Bank {
  private total = 0;
  private levels: Record<PermanentUpgradeId, number> = { ...noPermanentUpgrades() };
  private readonly listeners: (() => void)[] = [];

  /** Starts from a saved state. Anything that does not make sense is treated as nothing. */
  constructor(state: Partial<BankState> = {}) {
    this.total = wholeAtLeastZero(state.gold);
    for (const id of PERMANENT_UPGRADE_IDS) {
      this.levels[id] = Math.min(PERMANENT_UPGRADE_MAX_LEVEL, wholeAtLeastZero(state.upgrades?.[id]));
    }
  }

  /** All the Gold the player has Banked and not yet spent. */
  get gold(): number {
    return this.total;
  }

  /** The level of every Permanent Upgrade. */
  get upgradeLevels(): PermanentUpgradeLevels {
    return { ...this.levels };
  }

  level(id: PermanentUpgradeId): number {
    return this.levels[id];
  }

  /** What the next level of a Permanent Upgrade costs, or null if it is at its highest level. */
  priceOf(id: PermanentUpgradeId): number | null {
    return nextLevelPrice(this.levels[id]);
  }

  canBuy(id: PermanentUpgradeId): boolean {
    const price = this.priceOf(id);
    return price !== null && price <= this.total;
  }

  /** Banking: from this moment the Gold is permanently the player's. */
  bankGold(amount: number): void {
    const gold = wholeAtLeastZero(amount);
    if (gold === 0) return;
    this.total += gold;
    this.changed();
  }

  /** Buys the next level of a Permanent Upgrade with banked Gold. */
  buy(id: PermanentUpgradeId): void {
    const price = this.priceOf(id);
    if (price === null) throw new Error(`${id} is already at its highest level`);
    if (price > this.total) throw new Error(`${id} costs ${price} Gold, but only ${this.total} is banked`);
    this.total -= price;
    this.levels[id] += 1;
    this.changed();
  }

  /** Forgets all Gold and every Permanent Upgrade, as if the game had never been played. */
  reset(): void {
    this.total = 0;
    this.levels = { ...noPermanentUpgrades() };
    this.changed();
  }

  /** What would be saved right now. */
  get state(): BankState {
    return { gold: this.total, upgrades: this.upgradeLevels };
  }

  /** Calls the listener after every change to the Bank. */
  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}

function wholeAtLeastZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
