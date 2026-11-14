export type RoomOutcome = 'fighting' | 'cleared' | 'heroDead';

/**
 * Tracks whether a Room is still being fought. A Room is cleared when all
 * its enemies are defeated. Once decided, the outcome never changes.
 */
export class RoomState {
  private enemies: number;
  private result: RoomOutcome;

  constructor(enemyCount: number) {
    this.enemies = Math.max(0, enemyCount);
    this.result = this.enemies === 0 ? 'cleared' : 'fighting';
  }

  get enemiesLeft(): number {
    return this.enemies;
  }

  get outcome(): RoomOutcome {
    return this.result;
  }

  /** An enemy that appears during the fight must be defeated too. */
  enemyAdded(): void {
    if (this.result === 'fighting') this.enemies += 1;
  }

  enemyDefeated(): void {
    if (this.result !== 'fighting') return;
    this.enemies = Math.max(0, this.enemies - 1);
    if (this.enemies === 0) this.result = 'cleared';
  }

  heroDied(): void {
    if (this.result === 'fighting') this.result = 'heroDead';
  }
}
