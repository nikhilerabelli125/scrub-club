import { describe, expect, it } from 'vitest';
import { patientArea, secondsToTicks, stepWorld } from '../../src/sim';
import {
  activityModels,
  bedName,
  formatClock,
  hudModel,
  placeName,
  readyAt,
  ticketModels,
} from '../../src/ui/model';
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
      place: bedName(bed),
      patience: 1,
    });
    expect(ticket?.chips).toEqual([
      { label: 'Ask questions', state: 'ready', repeats: 1, note: null },
      { label: 'Check vitals', state: 'ready', repeats: 1, note: null },
      { label: 'EKG', state: 'later', repeats: 1, note: null },
      { label: 'Aspirin', state: 'later', repeats: 1, note: null },
    ]);
  });

  it('walk a med through order, wait, and pick up, and count it on the med cabinet', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.chest-pain' }));
    const done = ['task.ask-questions', 'task.check-vitals', 'task.ekg'];
    stepWorld(
      world,
      ctx,
      commands(...done.map((task) => ({ type: 'completeTask' as const, patient: 1, task }))),
    );
    const aspirin = () =>
      ticketModels(world, ctx)
        .find((t) => t.patient === 1)
        ?.chips.find((c) => c.label === 'Aspirin');
    expect(aspirin()).toMatchObject({ state: 'ready', note: 'order' });

    const entry = world.patients[0]?.tasks.find((t) => t.task === 'task.aspirin');
    if (!entry) throw new Error('no aspirin');
    entry.stage = 'ordered';
    entry.dueTick = world.tick + secondsToTicks(7.5);
    expect(aspirin()).toMatchObject({ state: 'waiting', note: '8 s' });
    expect(readyAt(world, ctx, 'station.med-cabinet')).toBe(0);

    entry.stage = 'ready';
    expect(aspirin()).toMatchObject({ state: 'ready', note: 'pick up' });
    expect(readyAt(world, ctx, 'station.med-cabinet')).toBe(1);
  });

  it('send a lab sample to the lab, then count down to its result', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.belly-pain' }));
    const entry = world.patients[0]?.tasks.find((t) => t.task === 'task.blood-draw');
    if (!entry) throw new Error('no blood test');
    const done = ['task.ask-questions', 'task.check-vitals'];
    stepWorld(
      world,
      ctx,
      commands(...done.map((task) => ({ type: 'completeTask' as const, patient: 1, task }))),
    );
    const chip = () =>
      ticketModels(world, ctx)
        .find((t) => t.patient === 1)
        ?.chips.find((c) => c.label === 'Blood test');
    entry.stage = 'sample';
    expect(chip()).toMatchObject({ state: 'ready', note: 'to lab' });
    entry.stage = 'result';
    entry.dueTick = world.tick + secondsToTicks(18);
    expect(chip()).toMatchObject({ state: 'waiting', note: '18 s' });
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

  it('say where the patient is: a bed, the waiting room, a walk, or a station', () => {
    const { ctx, world } = startLevel('ed-a');
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.headache' }));
    const patient = world.patients[0];
    if (!patient) throw new Error('no patient');
    patient.location = { kind: 'waiting' };
    expect(placeName(patient, ctx)).toBe('Waiting room');
    patient.location = { kind: 'escorted', by: 1, task: 'task.dark-room', trail: [[1, 1]] };
    expect(placeName(patient, ctx)).toBe('Walking to dark room');
    patient.location = { kind: 'station', station: 'observation' };
    expect(placeName(patient, ctx)).toBe('Observation chairs');
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
