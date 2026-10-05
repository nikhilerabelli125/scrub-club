import { describe, expect, it } from 'vitest';
import { secondsToTicks, stepWorld } from '../../src/sim';
import { commands, eventsOf, IDLE, run, startLevel } from './helpers';

describe('patience', () => {
  it('a low-acuity patient leaves when patience runs out: 1 strike, -10 points', () => {
    const { ctx, world } = startLevel('ed-a');
    // The command runs before the pool spawns, so this bad cut (acuity 4, 75 s) is patient 1.
    const log = run(world, ctx, secondsToTicks(80), (w) => {
      if (w.tick === 0) return commands({ type: 'spawn', condition: 'ed.bad-cut' });
      if (w.tick === 1) return commands({ type: 'seat', patient: 1, bed: 'bay-2' });
      return IDLE;
    });
    const left = eventsOf(log, 'patientLeft').find(({ event }) => event.patient === 1);
    expect(left?.tick).toBe(1 + secondsToTicks(75));
    expect(eventsOf(log, 'scored')).toContainEqual({
      tick: left?.tick,
      event: { type: 'scored', points: -10, reason: 'left', patient: 1 },
    });
    expect(eventsOf(log, 'strike').some(({ tick }) => tick === left?.tick)).toBe(true);
    expect(world.beds.find((b) => b.id === 'bay-2')?.patient).toBeNull();
  });

  it('critical patients never leave, even with no patience left', () => {
    const { ctx, world } = startLevel('ed-a');
    const log = run(world, ctx, secondsToTicks(120), (w) =>
      w.tick === 0 ? commands({ type: 'spawn', condition: 'ed.chest-pain' }) : IDLE,
    );
    expect(eventsOf(log, 'patientLeft').some(({ event }) => event.patient === 1)).toBe(false);
    expect(world.patients.find((p) => p.id === 1)?.patienceTicks).toBe(0);
  });
});

describe('seating', () => {
  it('moves a waiting patient into a free bed and refuses a taken one', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(
      world,
      ctx,
      commands(
        { type: 'spawn', condition: 'ed.bad-cut' },
        { type: 'spawn', condition: 'ed.headache' },
      ),
    );
    stepWorld(
      world,
      ctx,
      commands(
        { type: 'seat', patient: 1, bed: 'bay-1' },
        { type: 'seat', patient: 2, bed: 'bay-1' },
      ),
    );
    expect(world.patients.find((p) => p.id === 1)?.location).toEqual({ kind: 'bed', bed: 'bay-1' });
    expect(world.beds.find((b) => b.id === 'bay-1')?.patient).toBe(1);
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'commandRejected', reason: 'bed "bay-1" is taken' }),
    );
  });

  it('lets a spawn go straight into a named bed, like an ambulance into resus', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.chest-pain', bed: 'resus' }));
    expect(world.patients[0]?.location).toEqual({ kind: 'bed', bed: 'resus' });
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'patientArrived', patient: 1, bed: 'resus' }),
    );
  });

  it('turns unknown conditions into rejected commands instead of errors', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.not-a-thing' }));
    expect(world.events).toContainEqual(
      expect.objectContaining({
        type: 'commandRejected',
        reason: 'unknown condition "ed.not-a-thing"',
      }),
    );
  });
});
