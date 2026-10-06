import { describe, expect, it } from 'vitest';
import { secondsToTicks, stepWorld, type SimCommand } from '../../src/sim';
import { commands, eventsOf, IDLE, run, startLevel, treatEveryone } from './helpers';

describe('patience', () => {
  it('a low-acuity patient leaves when patience runs out: 1 strike, -10 points', () => {
    const { ctx, world } = startLevel('ed-a');
    // The command runs before the pool spawns, so this bad cut (acuity 4, 75 s) is patient 1.
    const log = run(world, ctx, secondsToTicks(80), (w) =>
      w.tick === 0 ? commands({ type: 'spawn', condition: 'ed.bad-cut' }) : IDLE,
    );
    const left = eventsOf(log, 'patientLeft').find(({ event }) => event.patient === 1);
    expect(left?.tick).toBe(1 + secondsToTicks(75));
    expect(eventsOf(log, 'scored')).toContainEqual({
      tick: left?.tick,
      event: { type: 'scored', points: -10, reason: 'left', patient: 1 },
    });
    expect(eventsOf(log, 'strike').some(({ tick }) => tick === left?.tick)).toBe(true);
    expect(world.beds.some((b) => b.patient === 1)).toBe(false);
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

describe('beds', () => {
  it('arriving patients each get a random free bed, the same one on every replay', () => {
    const rooms = (seed: number) => {
      const { ctx, world } = startLevel('ed-a', { seed });
      stepWorld(
        world,
        ctx,
        commands(
          { type: 'spawn', condition: 'ed.bad-cut' },
          { type: 'spawn', condition: 'ed.headache' },
        ),
      );
      // Patients 1 and 2 come from the commands; 3 is ED-A's first pool spawn.
      return world.patients.map((p) => (p.location.kind === 'bed' ? p.location.bed : 'waiting'));
    };
    expect(new Set(rooms(1)).size).toBe(3);
    expect(rooms(1)).not.toContain('waiting');
    expect(rooms(1)).toEqual(rooms(1));
    // Not always left to right (playtest issue #7).
    const leftToRight = ['bay-1', 'bay-2', 'bay-3'].join();
    const seeds = Array.from({ length: 10 }, (_, i) => rooms(i + 1).join());
    expect(seeds.some((order) => order !== leftToRight)).toBe(true);
  });

  it('when every bed is taken, the next patient waits and gets the first bed that frees up', () => {
    const { ctx, world } = startLevel('ed-a');
    // Five critical patients fill ED-A's five beds and never leave on their own.
    const five: SimCommand[] = Array.from({ length: 5 }, () => ({
      type: 'spawn',
      condition: 'ed.chest-pain',
    }));
    stepWorld(world, ctx, commands(...five, { type: 'spawn', condition: 'ed.bad-cut' }));
    expect(world.patients.find((p) => p.id === 6)?.location).toEqual({ kind: 'waiting' });
    const firstBed = world.beds.find((b) => b.patient === 1)?.id;

    // Finish patient 1; patient 6 moves into their bed.
    for (let i = 0; i < 4; i++) {
      const input = treatEveryone(world);
      stepWorld(world, ctx, {
        ...input,
        commands: input.commands?.filter((c) => 'patient' in c && c.patient === 1),
      });
    }
    expect(world.patients.some((p) => p.id === 1)).toBe(false);
    expect(world.patients.find((p) => p.id === 6)?.location).toEqual({
      kind: 'bed',
      bed: firstBed,
    });
  });

  it('keeps beds named by scripted spawns free for those arrivals', () => {
    // ED-E's collapsed patient rolls into resus, so walk-ins never take it.
    const { ctx, world } = startLevel('ed-e');
    const six: SimCommand[] = Array.from({ length: 6 }, () => ({
      type: 'spawn',
      condition: 'ed.chest-pain',
    }));
    stepWorld(world, ctx, commands(...six));
    expect(world.beds.find((b) => b.id === 'resus')?.patient).toBeNull();
  });

  it('can move a patient to another free bed, and refuses a taken one', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(
      world,
      ctx,
      commands(
        { type: 'spawn', condition: 'ed.bad-cut' },
        { type: 'spawn', condition: 'ed.headache' },
      ),
    );
    const oldBed = world.beds.find((b) => b.patient === 1)?.id;
    const free = world.beds.find((b) => b.patient === null)?.id ?? 'none free';
    stepWorld(
      world,
      ctx,
      commands({ type: 'seat', patient: 1, bed: free }, { type: 'seat', patient: 2, bed: free }),
    );
    expect(world.patients.find((p) => p.id === 1)?.location).toEqual({ kind: 'bed', bed: free });
    expect(world.beds.find((b) => b.id === oldBed)?.patient).toBeNull();
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'commandRejected', reason: `bed "${free}" is taken` }),
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
