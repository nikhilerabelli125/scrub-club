import { describe, expect, it } from 'vitest';
import { patientArea, secondsToTicks, stepWorld } from '../../src/sim';
import { activityModels, bedName, formatClock, hudModel, ticketModels } from '../../src/ui/model';
import { commands, players, press, run, startLevel, standNextTo } from '../sim/helpers';

describe('tickets', () => {
  it('show the complaint, bed, and acuity, and which tasks can be done now', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.chest-pain' }));
    const ticket = ticketModels(world, ctx).find((t) => t.patient === 1);
    const bed = world.beds.find((b) => b.patient === 1)?.id ?? '';
    expect(ticket).toMatchObject({
      label: 'Chest pain',
      acuity: 2,
      bed: bedName(bed),
      patience: 1,
    });
    expect(ticket?.chips).toEqual([
      { label: 'Ask questions', state: 'ready', repeats: 1 },
      { label: 'Check vitals', state: 'ready', repeats: 1 },
      { label: 'EKG', state: 'later', repeats: 1 },
      { label: 'Aspirin', state: 'later', repeats: 1 },
    ]);
  });

  it('show a hidden condition as its milder complaint', () => {
    const { ctx, world } = startLevel('cl-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'cl.indigestion' }));
    expect(ticketModels(world, ctx).find((t) => t.patient === 1)).toMatchObject({
      label: 'Indigestion',
      acuity: 4,
    });
  });
});

describe('HUD', () => {
  it('counts a timed level down and an untimed one up', () => {
    const timed = startLevel('ed-a');
    run(timed.world, timed.ctx, secondsToTicks(10));
    expect(hudModel(timed.world, timed.ctx).clock).toBe('4:50');
    const untimed = startLevel('cl-a');
    run(untimed.world, untimed.ctx, secondsToTicks(10));
    expect(hudModel(untimed.world, untimed.ctx).clock).toBe('0:10');
  });

  it('formats clocks as minutes and seconds', () => {
    expect(formatClock(300, true)).toBe('5:00');
    expect(formatClock(59.2, true)).toBe('1:00');
    expect(formatClock(61.9, false)).toBe('1:01');
    expect(formatClock(0, true)).toBe('0:00');
  });

  it('reads bed ids as names', () => {
    expect(bedName('bay-1')).toBe('Bay 1');
    expect(bedName('resus')).toBe('Resus');
  });
});

describe('progress panels', () => {
  it('show what a player is working on and how far along it is', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.bad-cut' }));
    const patient = world.patients.find((p) => p.id === 1);
    if (!patient) throw new Error('no patient');
    standNextTo(world, ctx, 1, patientArea(world, ctx, patient));
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    run(world, ctx, 89, () => players(press(1, { use: 'held' })));
    // 90 of the 180 ticks of questions.
    expect(activityModels(world, ctx)).toEqual([
      { slot: 1, label: 'Ask questions', progress: 0.5, waitingForPress: false },
    ]);
  });
});
