/** A pool of health that never goes below zero or above its maximum. */
export class Health {
  private value: number;

  constructor(readonly max: number) {
    if (max <= 0) throw new Error('Maximum health must be positive');
    this.value = max;
  }

  get current(): number {
    return this.value;
  }

  get isDead(): boolean {
    return this.value <= 0;
  }

  damage(amount: number): void {
    this.value = Math.max(0, this.value - Math.max(0, amount));
  }

  /** Restores health, never above the maximum. Returns how much was actually restored. */
  heal(amount: number): number {
    if (this.isDead) return 0;
    const before = this.value;
    this.value = Math.min(this.max, this.value + Math.max(0, amount));
    return this.value - before;
  }
}
