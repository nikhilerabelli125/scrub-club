import { describe, expect, it } from 'vitest';
import { secondsToTicks, stepWorld, type PlayerCount } from '../../src/sim';
import { createWalkingTeam, walkingTeam, type Skill } from './bot';
import { startLevel } from './helpers';

// Balance checks with bots that walk like people (tests/sim/bot.ts), on the levels' real
// maps. They guard against changes that would make a level unwinnable; the numbers come
// from playtest #20.
function play(levelId: string, playerCount: PlayerCount, skill: Skill, seed: number) {
  const { ctx, world } = startLevel(levelId, { playerCount, seed });
  const team = createWalkingTeam(world, ctx, skill);
  const outcomes = { arrived: 0, finished: 0, left: 0, transferred: 0 };
  const limit = secondsToTicks((ctx.level.lengthSeconds ?? 900) + 1);
  for (let i = 0; i < limit && world.status === 'running'; i++) {
    stepWorld(world, ctx, walkingTeam(world, ctx, team));
    for (const event of world.events) {
      if (event.type === 'patientArrived') outcomes.arrived += 1;
      if (event.type === 'patientFinished') outcomes.finished += 1;
      if (event.type === 'patientLeft') outcomes.left += 1;
      if (event.type === 'patientTransferred') outcomes.transferred += 1;
    }
  }
  return { ...outcomes, stars: world.result?.stars ?? 0 };
}

describe('ED-A balance', () => {
  it('lets a new player alone keep up: nobody walks out or goes to another team', () => {
    for (const seed of [1, 2, 3]) {
      const result = play('ed-a', 1, 'new', seed);
      // The last patient or two arrive too late to finish before the clock runs out.
      expect(result.finished).toBeGreaterThanOrEqual(result.arrived - 3);
      expect(result.left + result.transferred).toBe(0);
      expect(result.stars).toBeGreaterThanOrEqual(1);
    }
  });

  it('lets a practiced pair earn two stars or more without losing anyone', () => {
    const result = play('ed-a', 2, 'practiced', 1);
    expect(result.stars).toBeGreaterThanOrEqual(2);
    expect(result.left + result.transferred).toBe(0);
  });
});

describe('CL-A balance', () => {
  it('can be finished by a new player alone', () => {
    const result = play('cl-a', 1, 'new', 1);
    expect(result.finished).toBe(5);
    expect(result.stars).toBeGreaterThanOrEqual(1);
  });
});
