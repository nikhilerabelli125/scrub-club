import { describe, expect, it } from 'vitest';
import {
  distanceToBox,
  needsOrder,
  patientArea,
  secondsToTicks,
  stationBox,
  stepWorld,
  type PlayerSlot,
  type SimCommand,
  type SimContext,
  type World,
} from '../../src/sim';
import {
  commands,
  eventsOf,
  IDLE,
  playerIn,
  players,
  press,
  run,
  startLevel,
  standNextTo,
} from './helpers';

// Patients 1 (and on) with these conditions, with the named tasks already done.
function setUp(levelId: string, conditions: string[], done: string[], playerCount: 1 | 2 = 1) {
  const { ctx, world } = startLevel(levelId, {
    playerCount,
    ...(levelId === 'ed-a' ? { map: 'ed-main' } : {}),
  });
  stepWorld(
    world,
    ctx,
    commands(...conditions.map((condition): SimCommand => ({ type: 'spawn', condition }))),
  );
  stepWorld(
    world,
    ctx,
    commands(
      ...conditions.flatMap((_, i) =>
        done.map((task): SimCommand => ({ type: 'completeTask', patient: i + 1, task })),
      ),
    ),
  );
  return { ctx, world };
}

function entryOf(world: World, patient: number, task: string) {
  const entry = world.patients.find((p) => p.id === patient)?.tasks.find((t) => t.task === task);
  if (!entry) throw new Error(`patient ${patient} has no ${task}`);
  return entry;
}

function besideStation(world: World, ctx: SimContext, slot: PlayerSlot, type: string): void {
  const station = ctx.map.stations.find((s) => s.type === type);
  if (!station) throw new Error(`no ${type} on map ${ctx.map.id}`);
  standNextTo(world, ctx, slot, stationBox(station));
}

function besidePatient(world: World, ctx: SimContext, slot: PlayerSlot, id: number): void {
  const patient = world.patients.find((p) => p.id === id);
  if (!patient) throw new Error(`no patient ${id}`);
  standNextTo(world, ctx, slot, patientArea(world, ctx, patient));
}

const use = (slot: PlayerSlot = 1) => players(press(slot, { use: 'pressed' }));
const holdUse =
  (slot: PlayerSlot = 1) =>
  () =>
    players(press(slot, { use: 'held' }));
const pickUp = (slot: PlayerSlot = 1) => players(press(slot, { pickUp: 'pressed' }));
const held = (world: World, slot: PlayerSlot = 1) =>
  world.items.find((i) => i.id === playerIn(world, slot).holding);

const AFTER_EKG = ['task.ask-questions', 'task.check-vitals', 'task.ekg'];

// Walks player 1 to an item on the floor and picks it up.
function pickUpItem(world: World, ctx: SimContext, id: number): void {
  const item = world.items.find((i) => i.id === id);
  if (item?.place.kind !== 'floor') throw new Error(`item ${id} isn't on the floor`);
  const [x, z] = item.place.pos;
  standNextTo(world, ctx, 1, { x0: x, x1: x, z0: z, z1: z });
  stepWorld(world, ctx, pickUp());
}

describe('ordering meds', () => {
  it('Use at the computer orders the aspirin; 8 s later it is ready', () => {
    const { ctx, world } = setUp('ed-a', ['ed.chest-pain'], AFTER_EKG);
    besideStation(world, ctx, 1, 'station.computer');
    stepWorld(world, ctx, use());
    expect(playerIn(world, 1).activity).toMatchObject({ task: 'task.aspirin', ordering: true });
    // A 1 s hold (rules.json interaction.orderSeconds); the press counts as its first tick.
    const log = run(world, ctx, secondsToTicks(1) - 1, holdUse());
    expect(eventsOf(log, 'orderPlaced').map(({ event }) => event.task)).toEqual(['task.aspirin']);
    expect(entryOf(world, 1, 'task.aspirin').stage).toBe('ordered');
    expect(playerIn(world, 1).activity).toBeNull();

    const wait = run(world, ctx, secondsToTicks(8), () => IDLE);
    expect(eventsOf(wait, 'orderReady')).toHaveLength(1);
    expect(eventsOf(wait, 'orderReady')[0]?.tick).toBe(
      (eventsOf(log, 'orderPlaced')[0]?.tick ?? 0) + secondsToTicks(8),
    );
    expect(entryOf(world, 1, 'task.aspirin').stage).toBe('ready');
  });

  it('when ready it shoots out of a tube station, labeled for its patient alone', () => {
    const { ctx, world } = setUp('ed-a', ['ed.chest-pain', 'ed.chest-pain'], AFTER_EKG);
    const aspirin = entryOf(world, 1, 'task.aspirin');
    aspirin.stage = 'ordered';
    aspirin.dueTick = world.tick + secondsToTicks(8);
    // Ready in 8 s, then a short flight out of the tube.
    const log = run(world, ctx, secondsToTicks(8.5), () => IDLE);
    const delivered = eventsOf(log, 'orderDelivered')[0]?.event;
    const tube = ctx.map.stations.find((s) => s.id === delivered?.station);
    expect(tube?.type).toBe('station.tube');
    const med = world.items.find((i) => i.id === delivered?.itemId);
    expect(med).toMatchObject({ item: 'item.med', for: { patient: 1, task: 'task.aspirin' } });
    if (med?.place.kind !== 'floor' || !tube) throw new Error('the med should have landed');
    expect(distanceToBox(stationBox(tube), med.place.pos)).toBeLessThan(1.5);

    pickUpItem(world, ctx, med.id);
    expect(held(world)?.id).toBe(med.id);
    besidePatient(world, ctx, 1, 2); // patient 2 needs aspirin too, but this one isn't theirs
    stepWorld(world, ctx, use());
    expect(playerIn(world, 1).activity).toBeNull();
    // With nothing to do with it here, Use throws it (docs/02 §3). Fetch it back.
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'itemThrown', itemId: med.id }),
    );
    run(world, ctx, 30, () => IDLE);
    pickUpItem(world, ctx, med.id);
    besidePatient(world, ctx, 1, 1);
    stepWorld(world, ctx, use());
    expect(playerIn(world, 1).activity).toMatchObject({ patient: 1, task: 'task.aspirin' });
    const given = run(world, ctx, secondsToTicks(1), () => IDLE);
    expect(eventsOf(given, 'patientFinished').map(({ event }) => event.patient)).toEqual([1]);
  });

  it('emergency shots given before questions need no order', () => {
    const { ctx, world } = setUp('ed-a', ['ed.allergic-reaction'], []);
    const shot = ctx.content.tasks.get('task.allergy-shot');
    const aspirin = ctx.content.tasks.get('task.aspirin');
    if (!shot || !aspirin) throw new Error('missing tasks');
    expect(needsOrder(ctx, shot)).toBe(false);
    expect(needsOrder(ctx, aspirin)).toBe(true);
    besideStation(world, ctx, 1, 'station.med-cabinet');
    stepWorld(world, ctx, pickUp());
    expect(held(world)).toMatchObject({ item: 'item.med', for: null });
  });

  it('ordering at the computer takes no bed spot, so a teammate can work at the bed', () => {
    // Belly pain: the blood test and the pain med both use the arm, and come together.
    const { ctx, world } = setUp(
      'ed-a',
      ['ed.belly-pain'],
      ['task.ask-questions', 'task.check-vitals'],
      2,
    );
    besideStation(world, ctx, 1, 'station.computer');
    stepWorld(world, ctx, use(1));
    expect(playerIn(world, 1).activity).toMatchObject({ task: 'task.pain-med', ordering: true });
    besidePatient(world, ctx, 2, 1);
    stepWorld(world, ctx, players(press(1, { use: 'held' }), press(2, { use: 'pressed' })));
    expect(playerIn(world, 2).activity).toMatchObject({ task: 'task.blood-draw' });
  });
});

describe('waiting for results', () => {
  it('an X-ray is ordered at the computer and done when its result arrives 10 s later', () => {
    const { ctx, world } = setUp(
      'ed-a',
      ['ed.broken-arm'],
      ['task.ask-questions', 'task.check-vitals'],
    );
    besideStation(world, ctx, 1, 'station.computer');
    stepWorld(world, ctx, use());
    expect(playerIn(world, 1).activity).toMatchObject({ task: 'task.xray', ordering: false });
    run(world, ctx, secondsToTicks(1.5) - 1, holdUse());
    expect(entryOf(world, 1, 'task.xray').stage).toBe('result');
    // The pain med waits for the X-ray, so it can't be ordered yet.
    stepWorld(world, ctx, use());
    expect(playerIn(world, 1).activity).toBeNull();

    const log = run(world, ctx, secondsToTicks(10), () => IDLE);
    expect(eventsOf(log, 'resultArrived').map(({ event }) => event.task)).toEqual(['task.xray']);
    const done = eventsOf(log, 'taskCompleted').find(({ event }) => event.task === 'task.xray');
    expect(done?.event.player).toBeNull(); // the result did it, not a player
    expect(entryOf(world, 1, 'task.pain-med').stage).toBe('start');
  });

  it('a blood test hands you the tube; take it to the lab, and the result comes 18 s later', () => {
    const { ctx, world } = setUp(
      'ed-a',
      ['ed.belly-pain'],
      ['task.ask-questions', 'task.check-vitals'],
    );
    besidePatient(world, ctx, 1, 1);
    stepWorld(world, ctx, use());
    expect(playerIn(world, 1).activity).toMatchObject({ task: 'task.blood-draw' });
    run(world, ctx, secondsToTicks(3), () => IDLE); // a 3 s tap-and-wait
    expect(held(world)).toMatchObject({
      item: 'item.blood-tube',
      for: { patient: 1, task: 'task.blood-draw' },
    });
    expect(entryOf(world, 1, 'task.blood-draw').stage).toBe('sample');

    besideStation(world, ctx, 1, 'station.lab');
    const log = run(world, ctx, 1 + secondsToTicks(18), (w) =>
      w.tick === world.tick ? pickUp() : IDLE,
    );
    expect(eventsOf(log, 'sampleDelivered').map(({ event }) => event.station)).toEqual([
      'lab-tube',
    ]);
    expect(held(world)).toBeUndefined();
    const delivered = eventsOf(log, 'sampleDelivered')[0]?.tick ?? 0;
    expect(eventsOf(log, 'resultArrived')[0]?.tick).toBe(delivered + secondsToTicks(18));
  });

  it('the observation chairs keep a patient for 20 s, with their bed already free', () => {
    const { ctx, world } = setUp(
      'ed-a',
      ['ed.allergic-reaction'],
      ['task.allergy-shot', 'task.ask-questions', 'task.check-vitals', 'task.iv-fluids'],
    );
    const bed = world.beds.find((b) => b.patient === 1)?.id;
    besidePatient(world, ctx, 1, 1);
    stepWorld(world, ctx, use());
    besideStation(world, ctx, 1, 'station.observation');
    const log = run(world, ctx, 1 + secondsToTicks(20), () => IDLE);
    const arrived = eventsOf(log, 'escortArrived')[0]?.tick ?? 0;
    expect(arrived).toBeGreaterThan(0);
    expect(world.beds.find((b) => b.id === bed)?.patient).toBeNull();
    const finished = eventsOf(log, 'patientFinished')[0]?.tick;
    expect(finished).toBe(arrived + secondsToTicks(20));
  });
});

describe('the tutorial (CL-A) skips the waits', () => {
  it('meds come straight from the cabinet, and results arrive at once', () => {
    // CL-A's first patient is a sore throat: a throat swab, then antibiotics.
    const { ctx, world } = startLevel('cl-a', { playerCount: 1 });
    stepWorld(world, ctx, IDLE);
    stepWorld(
      world,
      ctx,
      commands(
        { type: 'completeTask', patient: 1, task: 'task.ask-questions' },
        { type: 'completeTask', patient: 1, task: 'task.check-vitals' },
      ),
    );
    const antibiotics = ctx.content.tasks.get('task.antibiotics');
    if (!antibiotics) throw new Error('no antibiotics');
    expect(needsOrder(ctx, antibiotics)).toBe(false);

    besidePatient(world, ctx, 1, 1);
    stepWorld(world, ctx, use());
    run(world, ctx, secondsToTicks(2), () => IDLE); // the swab
    besideStation(world, ctx, 1, 'station.lab');
    stepWorld(world, ctx, pickUp());
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'taskCompleted', task: 'task.throat-swab' }),
    );
  });
});

describe('leaving', () => {
  it("a patient who leaves takes their ordered med out of a player's hands", () => {
    // A headache (75 s of patience) whose med has just come by tube.
    const { ctx, world } = setUp(
      'ed-a',
      ['ed.headache'],
      ['task.ask-questions', 'task.check-vitals'],
    );
    const med = entryOf(world, 1, 'task.headache-med');
    med.stage = 'ordered';
    med.dueTick = world.tick + 1;
    run(world, ctx, 30, () => IDLE);
    const delivered = world.items.find((i) => i.for?.patient === 1);
    pickUpItem(world, ctx, delivered?.id ?? 0);
    expect(held(world)?.for).toEqual({ patient: 1, task: 'task.headache-med' });
    const log = run(world, ctx, secondsToTicks(80), () => IDLE);
    expect(eventsOf(log, 'patientLeft').map(({ event }) => event.patient)).toEqual([1]);
    expect(playerIn(world, 1).holding).toBeNull();
    expect(world.items.some((i) => i.for !== null)).toBe(false);
  });
});
