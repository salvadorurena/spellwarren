import { describe, expect, it } from 'vitest';
import { Bank } from './bank';
import { parseLayout, type Layout } from './layout';
import { goldAtDepth, type Reward } from './reward';
import { Rng } from './rng';
import { BOSS_DEPTH, pickLayout, rollDoorColumns, Run, type Door } from './run';
import { DOOR_COLUMNS, HERO, REWARD, ROOM_COLS, ROOM_ROWS, RUN } from './tuning';

function testLayout(name: string): Layout {
  const wallRow = '#'.repeat(ROOM_COLS);
  const openRow = `#${'.'.repeat(ROOM_COLS - 2)}#`;
  const rows = Array.from({ length: ROOM_ROWS }, (_, row) =>
    row === 0 || row === ROOM_ROWS - 1 ? wallRow : openRow,
  );
  rows[ROOM_ROWS - 2] = `#H${'.'.repeat(ROOM_COLS - 3)}#`;
  return parseLayout(name, rows);
}

const THREE_LAYOUTS = [testLayout('A'), testLayout('B'), testLayout('C')];

function startRun(seed = 1, bank = new Bank(), rewards?: readonly Reward[]): Run {
  return new Run({ bank, rng: new Rng(seed), rewards, layouts: THREE_LAYOUTS });
}

/** Picks the Door showing the wanted Reward, or the first Door if none does. */
function doorWith(run: Run, wanted: Reward): Door {
  const door = run.doors.find((d) => d.leadsTo.reward === wanted) ?? run.doors[0];
  if (!door) throw new Error('The Room has no Doors');
  return door;
}

/** Clears Rooms, always taking the Door with the wanted Reward, until the Run is at the given Depth. */
function advanceTo(run: Run, depth: number, wanted: Reward = 'gold'): void {
  while (run.depth < depth) {
    run.roomCleared();
    run.enter(doorWith(run, wanted));
  }
}

describe('a new Run', () => {
  it('starts at Depth 1 with full health and a Gold Reward', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = startRun(seed);
      expect(run.depth).toBe(1);
      expect(run.room.reward).toBe('gold');
      expect(run.room.isBossRoom).toBe(false);
      expect(run.hero.health.current).toBe(HERO.maxHealth);
      expect(run.outcome).toBe('underway');
      expect(run.summary).toBeNull();
      expect(run.goldBanked).toBe(0);
    }
  });

  it('keeps its Doors shut until the Room is cleared', () => {
    const run = startRun();
    expect(run.doorsOpen).toBe(false);
    expect(() => run.enter(run.doors[0] as Door)).toThrow(/shut/);
    run.roomCleared();
    expect(run.doorsOpen).toBe(true);
  });

  it('plays out the same way from the same seed', () => {
    const describeRun = (run: Run): unknown[] => {
      const seen: unknown[] = [];
      while (run.outcome === 'underway') {
        seen.push(run.room.layout.name, run.doors.map((d) => [d.column, d.leadsTo.reward]));
        run.roomCleared();
        if (run.doorsOpen) run.enter(run.doors[0] as Door);
      }
      return seen;
    };
    expect(describeRun(startRun(42))).toEqual(describeRun(startRun(42)));
    expect(describeRun(startRun(42))).not.toEqual(describeRun(startRun(43)));
  });
});

describe('Doors', () => {
  it('lead to the next Depth and show different Rewards', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = startRun(seed);
      while (run.depth < RUN.rooms) {
        expect(run.doors).toHaveLength(2);
        const rewards = run.doors.map((d) => d.leadsTo.reward);
        expect([...rewards].sort()).toEqual(['gold', 'healing']);
        for (const door of run.doors) {
          expect(door.leadsTo.depth).toBe(run.depth + 1);
          expect(door.leadsTo.isBossRoom).toBe(false);
        }
        run.roomCleared();
        run.enter(run.doors[seed % 2] as Door);
      }
    }
  });

  it('number two or three once Boons are available, each with its own Reward', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const run = startRun(seed, new Bank(), ['gold', 'healing', 'boon']);
      counts.add(run.doors.length);
      const rewards = run.doors.map((d) => d.leadsTo.reward);
      expect(new Set(rewards).size).toBe(rewards.length);
    }
    expect([...counts].sort()).toEqual([2, 3]);
  });

  it('sit in different Door columns, left to right', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = startRun(seed, new Bank(), ['gold', 'healing', 'boon']);
      const columns = run.doors.map((d) => d.column);
      expect(new Set(columns).size).toBe(columns.length);
      expect([...columns].sort((a, b) => a - b)).toEqual(columns);
      for (const column of columns) expect(DOOR_COLUMNS).toContain(column);
    }
  });

  it('take the Hero to the Room whose Reward they showed', () => {
    const run = startRun(5);
    run.roomCleared();
    const door = doorWith(run, 'healing');
    run.enter(door);
    expect(run.room).toBe(door.leadsTo);
    expect(run.room.reward).toBe('healing');
    expect(run.depth).toBe(2);
    expect(run.doorsOpen).toBe(false);
  });

  it('cannot be entered from another Room', () => {
    const run = startRun(5);
    const stale = run.doors[0] as Door;
    run.roomCleared();
    run.enter(stale);
    run.roomCleared();
    expect(() => run.enter(stale)).toThrow(/does not lead out/);
  });

  it('out of the last Room are a single Door to the Boss Room, with no Reward', () => {
    const run = startRun(8);
    advanceTo(run, RUN.rooms);
    expect(run.doors).toHaveLength(1);
    const door = run.doors[0] as Door;
    expect(door.column).toBe(13);
    expect(door.leadsTo.depth).toBe(BOSS_DEPTH);
    expect(door.leadsTo.isBossRoom).toBe(true);
    expect(door.leadsTo.reward).toBeNull();
  });

  it('are chosen from the Door columns', () => {
    expect(rollDoorColumns(1, new Rng(1))).toEqual([13]);
    expect(rollDoorColumns(3, new Rng(1))).toEqual([...DOOR_COLUMNS]);
    const pairs = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) pairs.add(rollDoorColumns(2, new Rng(seed)).join(','));
    expect([...pairs].sort()).toEqual(['13,20', '6,13', '6,20']);
    expect(() => rollDoorColumns(4, new Rng(1))).toThrow(/do not fit/);
  });
});

describe('clearing a Room', () => {
  it('Banks Gold that grows with Depth', () => {
    const bank = new Bank();
    const run = startRun(3, bank);
    expect(run.roomCleared()).toEqual({ reward: 'gold', gold: goldAtDepth(1), health: 0 });
    expect(bank.gold).toBe(goldAtDepth(1));

    run.enter(doorWith(run, 'gold'));
    expect(run.roomCleared()).toEqual({ reward: 'gold', gold: goldAtDepth(2), health: 0 });
    expect(bank.gold).toBe(goldAtDepth(1) + goldAtDepth(2));
    expect(run.goldBanked).toBe(bank.gold);
  });

  it('grants its Reward only once', () => {
    const bank = new Bank();
    const run = startRun(3, bank);
    run.roomCleared();
    expect(run.roomCleared()).toBeNull();
    expect(bank.gold).toBe(goldAtDepth(1));
  });

  it('restores health with Healing, and Banks no Gold', () => {
    const bank = new Bank();
    const run = startRun(4, bank);
    run.hero.takeHit(4, 0);
    run.roomCleared();
    const goldBefore = bank.gold;

    run.enter(doorWith(run, 'healing'));
    expect(run.roomCleared()).toEqual({ reward: 'healing', gold: 0, health: REWARD.healing });
    expect(run.hero.health.current).toBe(HERO.maxHealth - 4 + REWARD.healing);
    expect(bank.gold).toBe(goldBefore);
  });

  it('never heals above maximum health', () => {
    const run = startRun(4);
    run.hero.takeHit(1, 0);
    run.roomCleared();
    run.enter(doorWith(run, 'healing'));
    expect(run.roomCleared()).toEqual({ reward: 'healing', gold: 0, health: 1 });
    expect(run.hero.health.current).toBe(HERO.maxHealth);

    run.enter(doorWith(run, 'healing'));
    expect(run.roomCleared()).toEqual({ reward: 'healing', gold: 0, health: 0 });
    expect(run.hero.health.current).toBe(HERO.maxHealth);
  });

  it('carries health from Room to Room', () => {
    const run = startRun(6);
    run.hero.takeHit(2, 0);
    advanceTo(run, 4, 'gold');
    expect(run.hero.health.current).toBe(HERO.maxHealth - 2);
  });
});

describe('the end of a Run', () => {
  it('is victory when the Boss Room is cleared, with a Gold bonus', () => {
    const bank = new Bank();
    const run = startRun(11, bank);
    advanceTo(run, BOSS_DEPTH);
    expect(run.room.isBossRoom).toBe(true);
    expect(run.doors).toHaveLength(0);
    const before = bank.gold;

    expect(run.roomCleared()).toEqual({ reward: null, gold: REWARD.bossRoomGold, health: 0 });
    expect(run.outcome).toBe('victory');
    expect(run.doorsOpen).toBe(false);
    expect(run.summary).toEqual({
      outcome: 'victory',
      depthReached: BOSS_DEPTH,
      goldBanked: before + REWARD.bossRoomGold,
      totalGold: before + REWARD.bossRoomGold,
    });
  });

  it('is death when the Hero dies, and nothing can be cleared afterwards', () => {
    const bank = new Bank();
    const run = startRun(2, bank);
    advanceTo(run, 3);
    const banked = bank.gold;

    expect(run.hero.takeHit(HERO.maxHealth, 0)).toBe('dead');
    run.heroDied();
    expect(run.outcome).toBe('death');
    expect(run.roomCleared()).toBeNull();
    expect(run.doorsOpen).toBe(false);
    expect(run.summary).toEqual({
      outcome: 'death',
      depthReached: 3,
      goldBanked: banked,
      totalGold: banked,
    });
  });

  it('stays victory once won', () => {
    const run = startRun(11);
    advanceTo(run, BOSS_DEPTH);
    run.roomCleared();
    run.heroDied();
    expect(run.outcome).toBe('victory');
  });

  it('keeps banked Gold for the next Run, which starts afresh', () => {
    const bank = new Bank();
    const first = startRun(2, bank);
    advanceTo(first, 3);
    first.hero.takeHit(HERO.maxHealth, 0);
    first.heroDied();
    const carried = bank.gold;
    expect(carried).toBe(goldAtDepth(1) + goldAtDepth(2));

    const second = startRun(3, bank);
    expect(second.depth).toBe(1);
    expect(second.hero.health.current).toBe(HERO.maxHealth);
    expect(second.goldBanked).toBe(0);
    expect(second.totalGold).toBe(carried);

    second.roomCleared();
    expect(second.goldBanked).toBe(goldAtDepth(1));
    expect(second.totalGold).toBe(carried + goldAtDepth(1));
  });
});

describe('choosing a Layout', () => {
  it('never repeats the previous Room when there is another Layout', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = startRun(seed);
      while (run.doors.length > 0) {
        for (const door of run.doors) expect(door.leadsTo.layout).not.toBe(run.room.layout);
        run.roomCleared();
        run.enter(run.doors[0] as Door);
      }
    }
  });

  it('uses every Layout sooner or later', () => {
    const used = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const run = startRun(seed);
      while (run.doors.length > 0) {
        used.add(run.room.layout.name);
        run.roomCleared();
        run.enter(run.doors[0] as Door);
      }
    }
    expect(used.size).toBe(THREE_LAYOUTS.length);
  });

  it('repeats the only Layout when there is just one', () => {
    const only = THREE_LAYOUTS[0] as Layout;
    expect(pickLayout([only], only, new Rng(1))).toBe(only);
    const run = new Run({ bank: new Bank(), rng: new Rng(1), layouts: [only] });
    run.roomCleared();
    run.enter(run.doors[0] as Door);
    expect(run.room.layout).toBe(only);
  });

  it('cannot be done with no Layouts', () => {
    expect(() => pickLayout([], undefined, new Rng(1))).toThrow(/no Layouts/);
  });
});
