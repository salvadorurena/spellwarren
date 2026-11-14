/**
 * The player's banked Gold. It outlives any one Run: nothing in a Run can
 * take Gold out of it, and a new Run starts with whatever is already here.
 *
 * This is the one object that holds progress between Runs, so that a later
 * step can write it to disk and read it back whole.
 */
export class Bank {
  private total: number;

  constructor(gold = 0) {
    this.total = Math.max(0, Math.floor(gold));
  }

  /** All the Gold the player has Banked, across every Run. */
  get gold(): number {
    return this.total;
  }

  /** Banking: from this moment the Gold is permanently the player's. */
  bankGold(amount: number): void {
    this.total += Math.max(0, Math.floor(amount));
  }
}
