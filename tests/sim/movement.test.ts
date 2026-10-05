import { describe, expect, it } from 'vitest';
import { secondsToTicks } from '../../src/sim';
import { playerIn, players, press, run, startLevel } from './helpers';

const walk = (x: number, z: number) => () => players(press(1, { move: { x, z } }));

describe('movement', () => {
  it('walks at the speed in data/rules.json on open floor', () => {
    const { ctx, world } = startLevel('ed-a');
    const player = playerIn(world, 1);
    player.pos = [12, 11.5];
    run(world, ctx, secondsToTicks(0.5), walk(1, 0));
    expect(player.pos[0]).toBeCloseTo(12 + 4.2 * 0.5, 5);
    expect(player.facing).toBeCloseTo(Math.PI / 2);
  });

  it('is no faster on a diagonal', () => {
    const { ctx, world } = startLevel('ed-a');
    const player = playerIn(world, 1);
    player.pos = [10.5, 6.6]; // the hallway in front of the bays, clear in this direction
    run(world, ctx, secondsToTicks(0.5), walk(1, -1));
    expect(Math.hypot(player.pos[0] - 10.5, player.pos[1] - 6.6)).toBeCloseTo(4.2 * 0.5, 5);
  });

  it('stops at the edge of a bed instead of walking through it', () => {
    const { ctx, world } = startLevel('ed-a');
    const player = playerIn(world, 1);
    player.pos = [10.5, 6]; // in the hallway below bay 2, whose bed ends at z = 3.6
    run(world, ctx, secondsToTicks(2), walk(0, -1));
    expect(player.pos[1]).toBeCloseTo(3.6 + ctx.content.rules.movement.radius, 5);
  });

  it('stays inside the outer walls', () => {
    const { ctx, world } = startLevel('ed-a');
    const player = playerIn(world, 1);
    player.pos = [3, 12.5];
    run(world, ctx, secondsToTicks(2), walk(-1, 0));
    // The left wall is 0.2 m thick and centered on x = 0.
    expect(player.pos[0]).toBeCloseTo(0.1 + ctx.content.rules.movement.radius, 5);
  });
});
