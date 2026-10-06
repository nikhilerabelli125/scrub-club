import { describe, expect, it } from 'vitest';
import { secondsToTicks, type SimCommand } from '../../src/sim';
import { eventsOf, run, spawnStable, startLevel, treatEveryone } from './helpers';

const walkIns = (log: Parameters<typeof eventsOf>[0]) =>
  eventsOf(log, 'patientArrived').filter(({ event }) => event.entrance === 'walk-in');

// Critical patients never leave (01 §4.5), and spawnStable stops them getting worse, so
// they hold beds and waiting-room seats for good. ED-A has five beds and room for four to
// wait (maxWaiting).
const critical = (count: number): SimCommand[] =>
  Array.from({ length: count }, () => ({ type: 'spawn', condition: 'ed.chest-pain' }));

describe('spawning: ED-A pool', () => {
  it('admits the first patient at the start, then one per player-scaled interval', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 2, seed: 5 });
    const arrivals = walkIns(run(world, ctx, secondsToTicks(300), treatEveryone));
    expect(arrivals[0]?.tick).toBe(1);

    // Two players stretch ED-A's 22 to 30 s interval by 1.25 (data/rules.json).
    const gaps = arrivals.slice(1).map((entry, i) => entry.tick - (arrivals[i]?.tick ?? 0));
    expect(gaps.length).toBeGreaterThan(5);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(secondsToTicks(22 * 1.25));
      expect(gap).toBeLessThanOrEqual(secondsToTicks(30 * 1.25));
    }
    const pool = new Set(ctx.level.spawn?.pool.map((entry) => entry.condition));
    for (const { event } of arrivals) expect(pool.has(event.condition)).toBe(true);
  });

  it('keeps admitting patients into the waiting room while every bed is taken', () => {
    const { ctx, world } = startLevel('ed-a');
    const log = run(world, ctx, secondsToTicks(100), spawnStable(...critical(5)));
    // Patients 1 to 5 hold the beds, so every pool patient after them waits.
    const pool = walkIns(log).filter(({ event }) => event.patient > 5);
    expect(pool.length).toBeGreaterThanOrEqual(2);
    expect(eventsOf(log, 'patientSeated').some(({ event }) => event.patient > 5)).toBe(false);
  });

  it('pauses the spawn timer while the waiting room is full', () => {
    const { ctx, world } = startLevel('ed-a');
    const log = run(world, ctx, secondsToTicks(100), spawnStable(...critical(9)));
    // Patients 1 to 9 are the fillers; any later walk-in would be a pool spawn.
    expect(walkIns(log).map(({ event }) => event.patient)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('still delivers scripted patients when the waiting room is full', () => {
    const { ctx, world } = startLevel('ed-a');
    const log = run(world, ctx, secondsToTicks(100), spawnStable(...critical(9)));
    const ambulance = eventsOf(log, 'patientArrived').filter(
      ({ event }) => event.entrance === 'ambulance',
    );
    expect(ambulance).toHaveLength(1);
    expect(ambulance[0]?.event.condition).toBe('ed.chest-pain');
    // Scheduled for 1:00 ±15 s in data/levels/02-ed-a.json.
    expect(ambulance[0]?.tick).toBeGreaterThanOrEqual(secondsToTicks(45));
    expect(ambulance[0]?.tick).toBeLessThanOrEqual(secondsToTicks(75));
  });
});

describe('spawning: CL-A sequence', () => {
  it('brings patients one at a time in the scripted order', () => {
    const { ctx, world } = startLevel('cl-a', { playerCount: 1 });
    let mostAtOnce = 0;
    const log = run(world, ctx, secondsToTicks(600), (w) => {
      mostAtOnce = Math.max(mostAtOnce, w.patients.length);
      return treatEveryone(w);
    });
    expect(eventsOf(log, 'patientArrived').map(({ event }) => event.condition)).toEqual([
      'cl.sore-throat',
      'cl.cough',
      'cl.twisted-ankle',
      'cl.sore-throat',
      'cl.bp-check',
    ]);
    expect(mostAtOnce).toBe(1);
  });
});
