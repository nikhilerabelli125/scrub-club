import { describe, expect, it } from 'vitest';
import {
  patientArea,
  patientSpot,
  stationBox,
  stepWorld,
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

// A headache patient (ED-A) with everything done but the walk to the dark room.
function readyForDarkRoom(): { ctx: SimContext; world: World } {
  const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
  stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.headache' }));
  const done = ['task.ask-questions', 'task.check-vitals', 'task.headache-med'];
  stepWorld(
    world,
    ctx,
    commands(...done.map((task): SimCommand => ({ type: 'completeTask', patient: 1, task }))),
  );
  return { ctx, world };
}

function patientOne(world: World) {
  const found = world.patients.find((p) => p.id === 1);
  if (!found) throw new Error('patient 1 is gone');
  return found;
}

function startWalk(world: World, ctx: SimContext): void {
  standNextTo(world, ctx, 1, patientArea(world, ctx, patientOne(world)));
  stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
}

describe('walking a patient to a station', () => {
  it('Use beside them starts the walk, and they follow a step behind on your path', () => {
    const { ctx, world } = readyForDarkRoom();
    startWalk(world, ctx);
    expect(world.events).toContainEqual({
      type: 'escortStarted',
      player: 1,
      patient: 1,
      task: 'task.dark-room',
    });
    expect(playerIn(world, 1).activity).toBeNull(); // free to walk

    const path: [number, number][] = [];
    run(world, ctx, 40, (w) => {
      path.push([...playerIn(w, 1).pos]);
      return players(press(1, { move: { x: 0, z: 1 } }));
    });
    const [x, z] = patientSpot(world, ctx, patientOne(world));
    const player = playerIn(world, 1).pos;
    const behind = Math.hypot(player[0] - x, player[1] - z);
    expect(behind).toBeGreaterThan(0.75);
    expect(behind).toBeLessThan(1.4);
    // They stand where the player has been, so they never cut through walls.
    expect(path.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1e-9)).toBe(true);
  });

  it('reaching the dark room finishes the walk, frees the bed, and sends them home', () => {
    const { ctx, world } = readyForDarkRoom();
    const bed = world.beds.find((b) => b.patient === 1)?.id;
    startWalk(world, ctx);
    const darkRoom = ctx.map.stations.find((s) => s.type === 'station.dark-room');
    if (!darkRoom) throw new Error('no dark room');
    standNextTo(world, ctx, 1, stationBox(darkRoom));
    const log = run(world, ctx, 1, () => IDLE);
    expect(eventsOf(log, 'escortArrived').map(({ event }) => event.station)).toEqual(['dark-room']);
    expect(eventsOf(log, 'patientFinished').map(({ event }) => event.patient)).toEqual([1]);
    expect(world.beds.find((b) => b.id === bed)?.patient).toBeNull();
  });

  it('one walk at a time, and nobody starts a task on a patient mid-walk', () => {
    const { ctx, world } = readyForDarkRoom();
    startWalk(world, ctx);
    standNextTo(world, ctx, 1, patientArea(world, ctx, patientOne(world)));
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(world.events).toEqual([]);
  });
});
