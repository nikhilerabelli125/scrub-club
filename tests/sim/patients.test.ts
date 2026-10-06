import { describe, expect, it } from 'vitest';
import { secondsToTicks, stepWorld, type SimCommand } from '../../src/sim';
import { commands, eventsOf, IDLE, keepStable, run, startLevel, treatEveryone } from './helpers';

// Critical patients never leave (01 §4.5); with keepStable they hold their beds for good.
const critical = (count: number): SimCommand[] =>
  Array.from({ length: count }, () => ({ type: 'spawn', condition: 'ed.chest-pain' }));

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

  it('critical patients never walk out, even with no patience left', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.chest-pain' }));
    keepStable(world);
    run(world, ctx, secondsToTicks(120));
    expect(world.patients.find((p) => p.id === 1)?.patienceTicks).toBe(0);
  });
});

describe('getting worse', () => {
  it('an untreated chest pain shows a sign, then a badge, then goes to another team', () => {
    // ED-A caps escalation at a rescue transfer (levels 1 to 9 come before codes).
    const { ctx, world } = startLevel('ed-a');
    const log = run(world, ctx, secondsToTicks(90), (w) =>
      w.tick === 0 ? commands({ type: 'spawn', condition: 'ed.chest-pain' }) : IDLE,
    );
    const stages = eventsOf(log, 'patientEscalated').filter(({ event }) => event.patient === 1);
    expect(stages.map(({ event }) => [event.stage, event.badge])).toEqual([
      [1, null],
      [2, 'Heart attack'],
      [3, null],
    ]);
    // 30 s ±8, then 15 s, then 15 s (data/conditions/ed.json).
    const [first, second, third] = stages.map(({ tick }) => tick);
    expect(first).toBeGreaterThanOrEqual(1 + secondsToTicks(22));
    expect(first).toBeLessThanOrEqual(1 + secondsToTicks(38));
    expect((second ?? 0) - (first ?? 0)).toBe(secondsToTicks(15));
    expect((third ?? 0) - (second ?? 0)).toBe(secondsToTicks(15));
    expect(eventsOf(log, 'patientTransferred')).toEqual([
      {
        tick: third,
        event: {
          type: 'patientTransferred',
          patient: 1,
          condition: 'ed.chest-pain',
          reason: 'rescue',
        },
      },
    ]);
    expect(eventsOf(log, 'scored')).toContainEqual({
      tick: third,
      event: { type: 'scored', points: -20, reason: 'rescue', patient: 1 },
    });
    expect(eventsOf(log, 'patientLeft').some(({ event }) => event.patient === 1)).toBe(false);
  });

  it('treatment that slows the illness holds its clock, like oxygen for wheezing', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.wheezing' }));
    const done = ['task.ask-questions', 'task.check-vitals', 'task.oxygen'];
    stepWorld(
      world,
      ctx,
      commands(...done.map((task): SimCommand => ({ type: 'completeTask', patient: 1, task }))),
    );
    const log = run(world, ctx, secondsToTicks(55));
    expect(eventsOf(log, 'patientEscalated').some(({ event }) => event.patient === 1)).toBe(false);
  });

  it('a later stage can add a task, like a breathing tube for wheezing', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.wheezing' }));
    const patient = world.patients.find((p) => p.id === 1);
    if (!patient) throw new Error('no patient');
    patient.patienceTicks = secondsToTicks(600); // so they don't walk out first
    for (let i = 0; i < secondsToTicks(90) && patient.escalation.stage < 2; i++) {
      stepWorld(world, ctx, IDLE);
    }
    expect(world.events).toContainEqual({
      type: 'patientEscalated',
      patient: 1,
      stage: 2,
      badge: 'Not enough oxygen',
    });
    expect(patient.tasks.map((t) => t.task)).toContain('task.intubate');
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
    // Six critical patients: five fill ED-A's five beds, and none leave on their own.
    // Pool patients can't jump the queue: none is sicker, and all arrive later.
    stepWorld(world, ctx, commands(...critical(6)));
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

  it('gives free beds to known sick patients first, then unknown ones, then mild ones', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands(...critical(5))); // they take the five beds
    keepStable(world);
    stepWorld(
      world,
      ctx,
      commands(
        { type: 'spawn', condition: 'ed.bad-cut' }, // 6: asked, so known green
        { type: 'spawn', condition: 'ed.wheezing' }, // 7: nobody has asked yet
        { type: 'spawn', condition: 'ed.wheezing' }, // 8: asked, so known yellow
        { type: 'spawn', condition: 'ed.headache' }, // 9: nobody has asked yet
        { type: 'completeTask', patient: 6, task: 'task.ask-questions' },
        { type: 'completeTask', patient: 8, task: 'task.ask-questions' },
      ),
    );
    const roomOf = (id: number) => world.patients.find((p) => p.id === id)?.location;
    const finish = (id: number) => {
      const tasks = ['task.ask-questions', 'task.check-vitals', 'task.ekg', 'task.aspirin'];
      stepWorld(
        world,
        ctx,
        commands(...tasks.map((task): SimCommand => ({ type: 'completeTask', patient: id, task }))),
      );
    };
    finish(1);
    expect(roomOf(8)).toMatchObject({ kind: 'bed' }); // known yellow beats everyone waiting
    finish(2);
    expect(roomOf(7)).toMatchObject({ kind: 'bed' }); // unknown beats known green
    expect(roomOf(6)).toEqual({ kind: 'waiting' });
  });

  it('keeps beds named by scripted spawns free for those arrivals', () => {
    // ED-E's collapsed patient rolls into resus, so walk-ins never take it.
    const { ctx, world } = startLevel('ed-e');
    stepWorld(world, ctx, commands(...critical(6)));
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
