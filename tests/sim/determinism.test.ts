import { describe, expect, it } from 'vitest';
import { secondsToTicks, type World } from '../../src/sim';
import { eventsOf, run, startLevel, treatEveryone } from './helpers';

// Same seed + same input = same result (docs/07 §3.4). Replays and online play depend on it.
describe('determinism', () => {
  it('replays exactly: the same seed and input give the same world', () => {
    const a = startLevel('ed-a', { seed: 1234 });
    const b = startLevel('ed-a', { seed: 1234 });
    run(a.world, a.ctx, secondsToTicks(300), treatEveryone);
    run(b.world, b.ctx, secondsToTicks(300), treatEveryone);
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world));
  });

  it('plays out differently with a different seed', () => {
    const arrivals = (seed: number) => {
      const { ctx, world } = startLevel('ed-a', { seed });
      return eventsOf(run(world, ctx, secondsToTicks(300), treatEveryone), 'patientArrived').map(
        ({ tick, event }) => `${tick}:${event.condition}`,
      );
    };
    expect(arrivals(1)).not.toEqual(arrivals(2));
  });

  it('keeps all state in the world, so a JSON copy carries on identically', () => {
    const { ctx, world } = startLevel('ed-a', { seed: 77 });
    run(world, ctx, secondsToTicks(90), treatEveryone);
    const copy = JSON.parse(JSON.stringify(world)) as World;
    expect(copy).toEqual(world);

    run(world, ctx, secondsToTicks(120), treatEveryone);
    run(copy, ctx, secondsToTicks(120), treatEveryone);
    expect(copy).toEqual(world);
  });
});
