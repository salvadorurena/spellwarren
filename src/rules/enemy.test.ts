import { describe, expect, it } from 'vitest';
import { Enemy, type EnemyAction, type EnemySenses } from './enemy';
import { Rng } from './rng';
import { BOON, CHARGER, RUSHER, SHOOTER, SPAWNER, SPAWNLING, TILE } from './tuning';

const HERE = { x: 100, y: 100 };

function senses(now: number, tilesAway: number, extra: Partial<EnemySenses> = {}): EnemySenses {
  return {
    now,
    position: HERE,
    hero: { x: HERE.x + tilesAway * TILE, y: HERE.y },
    heroInView: true,
    hitWall: false,
    ...extra,
  };
}

/** Lets an enemy act every 16 ms over a span of time and returns every action. */
function watch(enemy: Enemy, from: number, to: number, tilesAway: number, extra: Partial<EnemySenses> = {}): EnemyAction[] {
  const actions: EnemyAction[] = [];
  for (let now = from; now <= to; now += 16) actions.push(enemy.act(senses(now, tilesAway, extra)));
  return actions;
}

describe('a rusher', () => {
  it('always chases the Hero at its own speed', () => {
    const rusher = new Enemy('rusher', 0, new Rng(1));
    for (const action of watch(rusher, 0, 3000, 5)) {
      expect(action.motion).toEqual({ kind: 'chase' });
      expect(action.speed).toBe(RUSHER.speed);
      expect(action.fire).toBeNull();
      expect(action.spawn).toBe(false);
    }
    expect(rusher.contactDamage).toBe(RUSHER.contactDamage);
  });
});

describe('a shooter', () => {
  it('closes in when far, backs away when close, and holds at its preferred range', () => {
    const far = SHOOTER.preferredRangeTiles + SHOOTER.rangeSlackTiles + 3;
    const near = SHOOTER.preferredRangeTiles - SHOOTER.rangeSlackTiles - 1;
    const shooter = () => new Enemy('shooter', 0, new Rng(1));
    expect(shooter().act(senses(0, far)).motion.kind).toBe('chase');
    expect(shooter().act(senses(0, near)).motion.kind).toBe('retreat');
    expect(shooter().act(senses(0, SHOOTER.preferredRangeTiles)).motion.kind).toBe('hold');
  });

  it('comes looking for a Hero it cannot see, and does not shoot', () => {
    const shooter = new Enemy('shooter', 0, new Rng(1));
    const actions = watch(shooter, 0, 3 * SHOOTER.shotCooldownMs, SHOOTER.preferredRangeTiles, { heroInView: false });
    expect(actions.every((a) => a.motion.kind === 'chase' && a.fire === null && a.mood === 'calm')).toBe(true);
  });

  it('stands still in warning before every shot, then fires at the Hero', () => {
    const shooter = new Enemy('shooter', 0, new Rng(1));
    const actions = watch(shooter, 0, 4 * SHOOTER.shotCooldownMs, SHOOTER.preferredRangeTiles);
    const shots = actions.flatMap((a, i) => (a.fire ? [i] : []));
    expect(shots.length).toBeGreaterThanOrEqual(3);
    for (const i of shots) {
      expect(actions[i]?.fire).toEqual({ x: 1, y: 0 });
      // The frames of aiming before the shot.
      const aiming = Math.floor(SHOOTER.aimMs / 16) - 1;
      for (let back = 1; back <= aiming; back++) {
        expect(actions[i - back]?.mood).toBe('warning');
        expect(actions[i - back]?.motion.kind).toBe('hold');
      }
    }
  });

  it('waits out its cooldown between shots', () => {
    const shooter = new Enemy('shooter', 0, new Rng(1));
    const actions = watch(shooter, 0, 4 * SHOOTER.shotCooldownMs, SHOOTER.preferredRangeTiles);
    const times = actions.flatMap((a, i) => (a.fire ? [i * 16] : []));
    for (let i = 1; i < times.length; i++) {
      expect((times[i] as number) - (times[i - 1] as number)).toBeGreaterThanOrEqual(SHOOTER.shotCooldownMs);
    }
  });
});

describe('a charger', () => {
  const close = CHARGER.triggerRangeTiles - 1;

  /** A charger that has just begun its warning at time 0, aimed along +x. */
  function warned(): Enemy {
    const charger = new Enemy('charger', 0, new Rng(1));
    expect(charger.act(senses(0, close)).mood).toBe('warning');
    return charger;
  }

  it('walks up to a Hero who is far away or out of view', () => {
    const charger = new Enemy('charger', 0, new Rng(1));
    expect(charger.act(senses(0, CHARGER.triggerRangeTiles + 2)).motion.kind).toBe('chase');
    expect(charger.act(senses(16, close, { heroInView: false })).motion.kind).toBe('chase');
  });

  it('shows a warning of fixed length, standing still, before it charges', () => {
    const charger = warned();
    const actions = watch(charger, 16, CHARGER.warningMs - 16, close);
    for (const action of actions) {
      expect(action.mood).toBe('warning');
      expect(action.motion.kind).toBe('hold');
      expect(action.warningDirection).toEqual({ x: 1, y: 0 });
    }
    expect(charger.act(senses(CHARGER.warningMs, close)).motion.kind).toBe('dash');
  });

  it('charges where the Hero was when the warning began, not where the Hero went', () => {
    const charger = warned();
    const elsewhere = { hero: { x: HERE.x, y: HERE.y - 80 } };
    const action = charger.act(senses(CHARGER.warningMs, close, elsewhere));
    expect(action.motion).toEqual({ kind: 'dash', direction: { x: 1, y: 0 } });
    expect(action.speed).toBe(CHARGER.chargeSpeed);
  });

  it('hits harder while charging', () => {
    const charger = warned();
    expect(charger.contactDamage).toBe(CHARGER.contactDamage);
    charger.act(senses(CHARGER.warningMs, close));
    expect(charger.contactDamage).toBe(CHARGER.chargeDamage);
  });

  it('is stunned and harmless after charging into a wall, then walks again', () => {
    const charger = warned();
    const start = CHARGER.warningMs;
    charger.act(senses(start, close));
    const crash = charger.act(senses(start + 100, close, { hitWall: true }));
    expect(crash.mood).toBe('stunned');
    expect(charger.contactDamage).toBe(0);

    const stunned = watch(charger, start + 116, start + 100 + CHARGER.stunMs - 16, close);
    expect(stunned.every((a) => a.mood === 'stunned' && a.motion.kind === 'hold')).toBe(true);
    expect(charger.act(senses(start + 100 + CHARGER.stunMs, close)).motion.kind).toBe('chase');
  });

  it('stops after a while if it meets no wall, pauses, and is not stunned', () => {
    const charger = warned();
    const start = CHARGER.warningMs;
    const actions = watch(charger, start, start + CHARGER.chargeMaxMs + CHARGER.recoverMs - 32, close);
    const dashes = actions.filter((a) => a.motion.kind === 'dash').length;
    expect(dashes * 16).toBeGreaterThan(CHARGER.chargeMaxMs - 32);
    expect(dashes * 16).toBeLessThanOrEqual(CHARGER.chargeMaxMs + 16);
    expect(actions.some((a) => a.mood === 'stunned')).toBe(false);
    expect(actions[actions.length - 1]?.motion.kind).toBe('hold');
  });
});

describe('a spawner', () => {
  it('plods after the Hero and makes spawnlings at intervals', () => {
    const spawner = new Enemy('spawner', 0, new Rng(1));
    const actions = watch(spawner, 0, 3.5 * SPAWNER.spawnEveryMs, 5);
    expect(actions.every((a) => a.motion.kind === 'chase' && a.speed === SPAWNER.speed)).toBe(true);
    const times = actions.flatMap((a, i) => (a.spawn ? [i * 16] : []));
    expect(times.length).toBe(3);
    expect((times[1] as number) - (times[0] as number)).toBeGreaterThanOrEqual(SPAWNER.spawnEveryMs);
  });

  it('stops at a full brood and starts again when a spawnling is defeated', () => {
    const spawner = new Enemy('spawner', 0, new Rng(1));
    const longTime = (SPAWNER.maxBrood + 4) * SPAWNER.spawnEveryMs;
    const made = watch(spawner, 0, longTime, 5).filter((a) => a.spawn).length;
    expect(made).toBe(SPAWNER.maxBrood);

    spawner.broodLost();
    const more = watch(spawner, longTime + 16, longTime + 3 * SPAWNER.spawnEveryMs, 5);
    expect(more.filter((a) => a.spawn).length).toBe(1);
  });

  it('makes spawnlings that are weak, quick rushers', () => {
    const spawnling = new Enemy('spawnling', 0, new Rng(1));
    expect(spawnling.health.max).toBe(SPAWNLING.health);
    expect(spawnling.act(senses(0, 5))).toMatchObject({ motion: { kind: 'chase' }, speed: SPAWNLING.speed });
  });
});

describe('an enemy hit by Frost Bolts', () => {
  it('moves slower for a while, then at full speed again', () => {
    const rusher = new Enemy('rusher', 0, new Rng(1));
    rusher.slow(1000, 0.5, 700);
    expect(rusher.act(senses(1100, 5)).speed).toBe(RUSHER.speed * 0.5);
    expect(rusher.isSlowed(1100)).toBe(true);
    expect(rusher.act(senses(1700, 5)).speed).toBe(RUSHER.speed);
  });

  it('does not slow a charge already under way', () => {
    const charger = new Enemy('charger', 0, new Rng(1));
    charger.act(senses(0, 3));
    charger.slow(100, 0.5, 5000);
    expect(charger.act(senses(CHARGER.warningMs, 3)).speed).toBe(CHARGER.chargeSpeed);
  });
});

describe('an enemy hit by Burning Bolts', () => {
  const { tickMs } = BOON.burningBolts;

  it('takes the burn damage over the burn time, and no more', () => {
    const spawner = new Enemy('spawner', 0, new Rng(1));
    spawner.burn(0, 4, 3000);
    expect(spawner.sufferBurn(tickMs - 1)).toBe(0);
    expect(spawner.isBurning(tickMs)).toBe(true);

    let total = 0;
    for (let now = 0; now <= 10000; now += 16) total += spawner.sufferBurn(now);
    expect(total).toBeCloseTo(12);
    expect(spawner.health.current).toBeCloseTo(SPAWNER.health - 12);
    expect(spawner.isBurning(10000)).toBe(false);
  });

  it('burns for longer when hit again, without the damage stacking', () => {
    const spawner = new Enemy('spawner', 0, new Rng(1));
    spawner.burn(0, 4, 3000);
    spawner.burn(2000, 4, 3000);
    let total = 0;
    for (let now = 0; now <= 10000; now += 16) total += spawner.sufferBurn(now);
    expect(total).toBeCloseTo(20);
  });

  it('can die of it', () => {
    const spawnling = new Enemy('spawnling', 0, new Rng(1));
    spawnling.burn(0, 100, 3000);
    spawnling.sufferBurn(tickMs);
    expect(spawnling.health.isDead).toBe(true);
  });
});
