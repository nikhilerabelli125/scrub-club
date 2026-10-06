import { describe, expect, it } from 'vitest';
import { secondsToTicks, starsFor, stepWorld, type SimCommand } from '../../src/sim';
import { commands, content, eventsOf, IDLE, run, startLevel, treatEveryone } from './helpers';

describe('ending a level', () => {
  it('ends when the clock runs out, with stars from the score', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 2, seed: 3 });
    run(world, ctx, secondsToTicks(400), treatEveryone);
    expect(world.result).toMatchObject({ outcome: 'timeUp', seconds: 300, strikes: 0 });
    expect(world.result?.stars).toBe(starsFor(ctx.level, ctx.content.rules, 2, world.score, 300));
    expect(world.result?.stars).toBeGreaterThan(0);
  });

  it('ends at once with no stars when the strike limit is hit', () => {
    const { ctx, world } = startLevel('ed-a');
    // Nine bad cuts (75 s of patience each) all walk out together: ED-A's limit is 9.
    const nine: SimCommand[] = Array.from({ length: 9 }, () => ({
      type: 'spawn',
      condition: 'ed.bad-cut',
    }));
    run(world, ctx, secondsToTicks(300), (w) => (w.tick === 0 ? commands(...nine) : IDLE));
    expect(world.tick).toBe(1 + secondsToTicks(75));
    expect(world.result).toEqual({
      outcome: 'strikeOut',
      score: -90,
      strikes: 9,
      stars: 0,
      seconds: (1 + secondsToTicks(75)) / 60,
    });
  });

  it('ends an untimed level once all its patients are resolved', () => {
    const { ctx, world } = startLevel('cl-a', { playerCount: 1 });
    run(world, ctx, secondsToTicks(600), treatEveryone);
    expect(world.result).toMatchObject({ outcome: 'completed', stars: 3 });
    expect(world.resolved).toBe(5);
  });

  it('without any treatment, patients walk out or go to another team, all with strikes', () => {
    const { ctx, world } = startLevel('ed-a', { seed: 8 });
    const log = run(world, ctx, secondsToTicks(300));
    const left = eventsOf(log, 'patientLeft');
    const transferred = eventsOf(log, 'patientTransferred');
    expect(left.length + transferred.length).toBeGreaterThan(0);
    // A walkout costs 1 strike and 10 points; a rescue transfer 2 and 20 (data/rules.json).
    expect(world.strikes).toBe(left.length + 2 * transferred.length);
    expect(world.score).toBe(-10 * left.length - 20 * transferred.length);
    expect(left.some(({ event }) => event.condition === 'ed.chest-pain')).toBe(false);
    expect(world.status).toBe('ended');
  });

  it('stops changing once the level has ended', () => {
    const { ctx, world } = startLevel('cl-a', { playerCount: 1 });
    run(world, ctx, secondsToTicks(600), treatEveryone);
    const snapshot = JSON.stringify(world);
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'cl.cough' }));
    expect(JSON.stringify(world)).toBe(snapshot);
  });
});

describe('stars', () => {
  const rules = content().rules;

  it('scale point thresholds by player count', () => {
    const { ctx } = startLevel('ed-a'); // 150 / 250 / 350 for one player
    expect(starsFor(ctx.level, rules, 1, 349, 300)).toBe(2);
    expect(starsFor(ctx.level, rules, 1, 350, 300)).toBe(3);
    expect(starsFor(ctx.level, rules, 2, 350, 300)).toBe(2); // two players need 437.5
    expect(starsFor(ctx.level, rules, 4, 149, 300)).toBe(0);
  });

  it('count time thresholds down, where 0 just means finishing', () => {
    const { ctx } = startLevel('cl-a'); // just finish / under 3:00 / under 2:15
    expect(starsFor(ctx.level, rules, 1, 0, 200)).toBe(1);
    expect(starsFor(ctx.level, rules, 1, 0, 179)).toBe(2);
    expect(starsFor(ctx.level, rules, 1, 0, 120)).toBe(3);
    expect(starsFor(ctx.level, rules, 4, 0, 230)).toBe(3); // 2:15 × 1.75 for four players
  });
});
