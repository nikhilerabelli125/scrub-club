import { describe, expect, it } from 'vitest';
import { patientArea, secondsToTicks, stepWorld, type World } from '../../src/sim';
import {
  commands,
  eventsOf,
  hand,
  IDLE,
  playerIn,
  players,
  press,
  run,
  startLevel,
  standNextTo,
} from './helpers';

const EAST = Math.PI / 2; // facing +x
const WEST = -Math.PI / 2;

function itemNamed(world: World, item: string) {
  const found = world.items.find((i) => i.item === item);
  if (!found) throw new Error(`no ${item}`);
  return found;
}

describe('stethoscopes', () => {
  it('two start on the ED map, and checking vitals keeps yours in hand', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    const stethoscopes = world.items.filter((i) => i.item === 'item.stethoscope');
    expect(stethoscopes).toHaveLength(2);
    expect(stethoscopes.every((i) => i.place.kind === 'floor')).toBe(true);

    stepWorld(
      world,
      ctx,
      commands(
        { type: 'spawn', condition: 'ed.bad-cut' },
        { type: 'completeTask', patient: 1, task: 'task.ask-questions' },
      ),
    );
    const [first] = stethoscopes;
    if (first?.place.kind !== 'floor') throw new Error('no stethoscope on the floor');
    const [x, z] = first.place.pos;
    standNextTo(world, ctx, 1, { x0: x, x1: x, z0: z, z1: z });
    stepWorld(world, ctx, players(press(1, { pickUp: 'pressed' })));
    expect(playerIn(world, 1).holding).toBe(first.id);

    const patient = world.patients.find((p) => p.id === 1);
    if (!patient) throw new Error('no patient');
    standNextTo(world, ctx, 1, patientArea(world, ctx, patient));
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(playerIn(world, 1).activity?.task).toBe('task.check-vitals');
    const log = run(world, ctx, secondsToTicks(2.5), () => players(press(1, { use: 'held' })));
    expect(eventsOf(log, 'taskCompleted').map(({ event }) => event.task)).toContain(
      'task.check-vitals',
    );
    expect(playerIn(world, 1).holding).toBe(first.id); // still yours
  });
});

describe('throwing', () => {
  it('Use with nothing to use it on throws what you hold, about 5 m', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    const player = playerIn(world, 1);
    player.pos = [3, 10]; // an open hallway
    player.facing = EAST;
    hand(world, 1, 'item.wound-kit');
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(world.events).toContainEqual(expect.objectContaining({ type: 'itemThrown' }));
    expect(player.holding).toBeNull();
    const log = run(world, ctx, secondsToTicks(1), () => IDLE);
    const landed = eventsOf(log, 'itemLanded')[0]?.event.pos ?? [0, 0];
    // rules.json throwing.distance
    expect(landed[0]).toBeCloseTo(3 + 5, 1);
    expect(landed[1]).toBeCloseTo(10, 6);
  });

  it('walls stop a throw', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    const player = playerIn(world, 1);
    player.pos = [1.5, 10];
    player.facing = WEST;
    hand(world, 1, 'item.wound-kit');
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    run(world, ctx, secondsToTicks(1), () => IDLE);
    const kit = itemNamed(world, 'item.wound-kit');
    if (kit.place.kind !== 'floor') throw new Error('it should have landed');
    expect(kit.place.pos[0]).toBeGreaterThanOrEqual(0.1); // the wall's inner face
  });

  it('a teammate with free hands catches it on the way', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 2 });
    const thrower = playerIn(world, 1);
    thrower.pos = [3, 10];
    thrower.facing = EAST;
    playerIn(world, 2).pos = [6, 10];
    hand(world, 1, 'item.wound-kit');
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    const log = run(world, ctx, secondsToTicks(1), () => IDLE);
    expect(eventsOf(log, 'itemCaught').map(({ event }) => event.player)).toEqual([2]);
    expect(playerIn(world, 2).holding).toBe(itemNamed(world, 'item.wound-kit').id);
  });
});

describe('bumping', () => {
  it("players can't walk through each other", () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 2 });
    playerIn(world, 1).pos = [4, 10];
    playerIn(world, 2).pos = [5.5, 10];
    run(world, ctx, secondsToTicks(1), () => players(press(1, { move: { x: 1, z: 0 } })));
    const [a, b] = [playerIn(world, 1).pos, playerIn(world, 2).pos];
    // Two player radii (rules.json movement.radius).
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(0.84 - 1e-6);
    expect(b[0]).toBeGreaterThan(5.5); // pushed along
  });

  it('nobody can shove a player who is working', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 2 });
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.bad-cut' }));
    const patient = world.patients.find((p) => p.id === 1);
    if (!patient) throw new Error('no patient');
    standNextTo(world, ctx, 2, patientArea(world, ctx, patient));
    stepWorld(world, ctx, players(press(2, { use: 'pressed' })));
    expect(playerIn(world, 2).activity?.task).toBe('task.ask-questions');
    const spot = [...playerIn(world, 2).pos];
    const [x, z] = spot;
    playerIn(world, 1).pos = [(x ?? 0) - 1.2, z ?? 0];
    run(world, ctx, 30, () =>
      players(press(1, { move: { x: 1, z: 0 } }), press(2, { use: 'held' })),
    );
    expect(playerIn(world, 2).pos).toEqual(spot);
  });
});
