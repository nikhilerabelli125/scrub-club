import { describe, expect, it } from 'vitest';
import {
  patientArea,
  secondsToTicks,
  stationBox,
  stepWorld,
  type PlayerSlot,
  type SimContext,
  type SimEvent,
  type World,
} from '../../src/sim';
import { buttonOnlyTeam } from './bot';
import {
  commands,
  eventsOf,
  hand,
  IDLE,
  parkBeside,
  playerIn,
  players,
  press,
  run,
  startLevel,
  standNextTo,
} from './helpers';

// Patient 1 with the given condition, auto-seated in bay 1 of ED-A.
function withPatient(condition: string, levelId = 'ed-a') {
  const { ctx, world } = startLevel(levelId, { playerCount: 2 });
  stepWorld(world, ctx, commands({ type: 'spawn', condition }));
  return { ctx, world };
}

function patient(world: World, id = 1) {
  const found = world.patients.find((p) => p.id === id);
  if (!found) throw new Error(`no patient ${id}`);
  return found;
}

// Completes tasks instantly, as a dev command, to skip to the part a test is about.
function skip(world: World, ctx: SimContext, ...tasks: string[]): void {
  stepWorld(
    world,
    ctx,
    commands(...tasks.map((task) => ({ type: 'completeTask' as const, patient: 1, task }))),
  );
}

function besidePatient(world: World, ctx: SimContext, slot: PlayerSlot = 1, id = 1): void {
  standNextTo(world, ctx, slot, patientArea(world, ctx, patient(world, id)));
}

function besideStation(world: World, ctx: SimContext, slot: PlayerSlot, type: string): void {
  const station = ctx.map.stations.find((s) => s.type === type);
  if (!station) throw new Error(`no ${type} on map ${ctx.map.id}`);
  standNextTo(world, ctx, slot, stationBox(station));
}

const holdUse = (slot: PlayerSlot) => () => players(press(slot, { use: 'held' }));
const tapped = (world: World): SimEvent[] => world.events;

describe('working on a patient', () => {
  it('holding Use beside a patient does their next task, here 3 s of questions', () => {
    const { ctx, world } = withPatient('ed.bad-cut');
    besidePatient(world, ctx);
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(tapped(world)).toContainEqual({
      type: 'taskStarted',
      player: 1,
      patient: 1,
      task: 'task.ask-questions',
    });
    const startTick = world.tick;
    const log = run(world, ctx, secondsToTicks(5), holdUse(1));
    const done = eventsOf(log, 'taskCompleted').find(
      ({ event }) => event.task === 'task.ask-questions',
    );
    // The press counts as the first tick of holding.
    expect(done?.tick).toBe(startTick + secondsToTicks(3) - 1);
    expect(done?.event.player).toBe(1);
  });

  it('letting go pauses a hold and keeps its progress for later', () => {
    const { ctx, world } = withPatient('ed.bad-cut');
    besidePatient(world, ctx);
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    run(world, ctx, 59, holdUse(1));
    stepWorld(world, ctx, players(press(1, { use: 'released' })));
    expect(tapped(world)).toContainEqual(
      expect.objectContaining({
        type: 'taskStopped',
        task: 'task.ask-questions',
        progressKept: true,
      }),
    );
    expect(playerIn(world, 1).activity).toBeNull();
    expect(patient(world).tasks[0]?.step).toMatchObject({ kind: 'hold', progressTicks: 60 });

    // Coming back finishes the remaining 2 s.
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    const log = run(world, ctx, secondsToTicks(2), holdUse(1));
    expect(eventsOf(log, 'taskCompleted').map(({ event }) => event.task)).toContain(
      'task.ask-questions',
    );
  });

  it('pushing a direction for 0.3 s walks away from a task; until then the player stays put', () => {
    const { ctx, world } = withPatient('ed.bad-cut');
    besidePatient(world, ctx);
    const start = [...playerIn(world, 1).pos];
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    const walkingAway = () => players(press(1, { use: 'held', move: { x: 1, z: 0 } }));
    run(world, ctx, secondsToTicks(0.3) - 1, walkingAway);
    expect(playerIn(world, 1).activity).not.toBeNull();
    expect(playerIn(world, 1).pos).toEqual(start);
    stepWorld(world, ctx, walkingAway());
    expect(playerIn(world, 1).activity).toBeNull();
    expect(tapped(world)).toContainEqual(
      expect.objectContaining({ type: 'taskStopped', progressKept: true }),
    );
    stepWorld(world, ctx, walkingAway());
    expect(playerIn(world, 1).pos[0]).toBeGreaterThan(start[0] ?? 0);
  });

  it('a tap-and-wait needs one press, then locks the player in place until it drains', () => {
    const { ctx, world } = withPatient('ed.wheezing');
    skip(world, ctx, 'task.ask-questions', 'task.check-vitals', 'task.oxygen');
    besidePatient(world, ctx);
    hand(world, 1, 'item.nebulizer');
    const start = [...playerIn(world, 1).pos];
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(playerIn(world, 1).activity?.task).toBe('task.breathing-treatment');
    // Let go and push away: the 4 s treatment keeps draining and the player can't leave.
    const log = run(world, ctx, secondsToTicks(4), () =>
      players(press(1, { move: { x: 1, z: 0 } })),
    );
    expect(eventsOf(log, 'taskCompleted').map(({ event }) => event.task)).toContain(
      'task.breathing-treatment',
    );
    expect(eventsOf(log, 'taskStopped')).toEqual([]);
    expect(playerIn(world, 1).pos).not.toEqual(start); // free to walk once it finished
  });
});

describe('items', () => {
  it('Pick up at a station takes what a patient needs, and the task uses it up', () => {
    // The allergy shot is given first, straight from the med cabinet: no order.
    const { ctx, world } = withPatient('ed.allergic-reaction');
    besidePatient(world, ctx);
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(playerIn(world, 1).activity).toBeNull(); // it needs medicine in hand

    besideStation(world, ctx, 1, 'station.med-cabinet');
    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    expect(tapped(world)).toContainEqual(
      expect.objectContaining({ type: 'itemPickedUp', item: 'item.med', from: 'station' }),
    );

    besidePatient(world, ctx);
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(playerIn(world, 1).activity?.task).toBe('task.allergy-shot');
    const log = run(world, ctx, secondsToTicks(2), () => IDLE);
    expect(eventsOf(log, 'itemUsed').map(({ event }) => event.item)).toEqual(['item.med']);
    expect(playerIn(world, 1).holding).toBeNull();
    expect(world.items).toEqual([]);
    expect(eventsOf(log, 'taskCompleted').map(({ event }) => event.task)).toEqual([
      'task.allergy-shot',
    ]);
  });

  it('Pick up again sets an item down, picks it back up, or returns it to its shelf', () => {
    const { ctx, world } = withPatient('ed.bad-cut');
    besideStation(world, ctx, 1, 'station.supply');
    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    expect(tapped(world)).toContainEqual(
      expect.objectContaining({ type: 'itemPickedUp', item: 'item.wound-kit' }),
    );
    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    expect(tapped(world)).toContainEqual(
      expect.objectContaining({ type: 'itemReturned', item: 'item.wound-kit' }),
    );
    expect(world.items).toEqual([]);

    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    playerIn(world, 1).pos = [12, 11.5]; // open floor, nowhere near a shelf
    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    expect(tapped(world)).toContainEqual(expect.objectContaining({ type: 'itemDropped' }));
    expect(world.items[0]?.place.kind).toBe('floor');
    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    expect(tapped(world)).toContainEqual(
      expect.objectContaining({ type: 'itemPickedUp', from: 'floor' }),
    );
  });
});

describe('what stations hand out', () => {
  it('the supply closet gives what a patient needs, skipping what is already carried', () => {
    const { ctx, world } = withPatient('ed.wheezing');
    skip(world, ctx, 'task.ask-questions', 'task.check-vitals');
    besideStation(world, ctx, 1, 'station.supply');
    besideStation(world, ctx, 2, 'station.supply');
    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    stepWorld(world, ctx, players(press(2, { pickUp: 'pressed' })));
    const held = (slot: PlayerSlot) =>
      world.items.find((i) => i.id === playerIn(world, slot).holding)?.item;
    expect(held(1)).toBe('item.oxygen-mask');
    expect(held(2)).toBe('item.nebulizer');
  });

  it("gives your own patient's needs first: the one you last started a task on", () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    stepWorld(
      world,
      ctx,
      commands(
        { type: 'spawn', condition: 'ed.bad-cut' }, // patient 1 has waited longest
        { type: 'spawn', condition: 'ed.wheezing' },
      ),
    );
    // Player 1 starts questions with patient 2, then lets go.
    besidePatient(world, ctx, 1, 2);
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    stepWorld(world, ctx, players(press(1, { use: 'released' })));
    const base = ['task.ask-questions', 'task.check-vitals'];
    stepWorld(
      world,
      ctx,
      commands(
        ...[1, 2].flatMap((id) =>
          base.map((task) => ({ type: 'completeTask' as const, patient: id, task })),
        ),
      ),
    );
    besideStation(world, ctx, 1, 'station.supply');
    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    expect(world.items[0]?.item).toBe('item.oxygen-mask'); // not patient 1's wound kit
  });
});

describe('sharing a patient', () => {
  it('two players never do the same task: the second gets the next one', () => {
    const { ctx, world } = withPatient('ed.bad-cut');
    parkBeside(world, 'equipment.vitals-cart', patientArea(world, ctx, patient(world)));
    besidePatient(world, ctx, 1);
    besidePatient(world, ctx, 2);
    stepWorld(world, ctx, players(press(1, { use: 'pressed' }), press(2, { use: 'pressed' })));
    expect(playerIn(world, 1).activity?.task).toBe('task.ask-questions');
    expect(playerIn(world, 2).activity?.task).toBe('task.check-vitals');
  });

  it('two players never use the same bed spot at once', () => {
    // Oxygen and the breathing treatment both happen at the head.
    const { ctx, world } = withPatient('ed.wheezing');
    skip(world, ctx, 'task.ask-questions', 'task.check-vitals');
    besidePatient(world, ctx, 1);
    besidePatient(world, ctx, 2);
    hand(world, 1, 'item.oxygen-mask');
    hand(world, 2, 'item.nebulizer');
    stepWorld(world, ctx, players(press(1, { use: 'pressed' }), press(2, { use: 'pressed' })));
    expect(playerIn(world, 1).activity?.task).toBe('task.oxygen');
    expect(playerIn(world, 2).activity).toBeNull();
  });
});

describe("mechanics that aren't built yet", () => {
  it('run as a short stand-in hold, like the stitches until timing bars arrive in M3', () => {
    const { ctx, world } = withPatient('ed.bad-cut');
    skip(world, ctx, 'task.ask-questions', 'task.check-vitals', 'task.clean-wound');
    besidePatient(world, ctx);
    hand(world, 1, 'item.stitch-kit');
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(patient(world).tasks.find((t) => t.task === 'task.stitches')?.step).toMatchObject({
      kind: 'hold',
      standIn: 'timingBar',
    });
    const log = run(world, ctx, secondsToTicks(2), holdUse(1));
    expect(eventsOf(log, 'patientFinished').map(({ event }) => event.patient)).toEqual([1]);
  });

  it('station tasks start from the station, like a prescription at the computer', () => {
    const { ctx, world } = withPatient('cl.cough', 'cl-a');
    skip(world, ctx, 'task.ask-questions', 'task.check-vitals', 'task.listen-lungs');
    besideStation(world, ctx, 1, 'station.computer');
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(playerIn(world, 1).activity).toMatchObject({ patient: 1, task: 'task.prescription' });
  });
});

describe('ED-A start to finish', () => {
  it('can be played with button presses alone: no strikes, and stars at the end', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1, seed: 3 });
    const log = run(world, ctx, secondsToTicks(301), (w) => buttonOnlyTeam(w, ctx));
    expect(world.result?.outcome).toBe('timeUp');
    expect(world.strikes).toBe(0);
    expect(eventsOf(log, 'patientFinished').length).toBeGreaterThanOrEqual(6);
    expect(eventsOf(log, 'taskCompleted').every(({ event }) => event.player === 1)).toBe(true);
    expect(world.result?.stars).toBeGreaterThanOrEqual(2);
  });
});
