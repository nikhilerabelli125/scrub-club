import { describe, expect, it } from 'vitest';
import {
  bedBox,
  boxAround,
  cartBox,
  distanceToBox,
  equipmentAt,
  patientArea,
  secondsToTicks,
  stepWorld,
  type EquipmentInstance,
  type SimCommand,
  type World,
} from '../../src/sim';
import {
  commands,
  eventsOf,
  parkBeside,
  playerIn,
  players,
  press,
  run,
  startLevel,
  standNextTo,
} from './helpers';

function first(world: World, equipment: string): EquipmentInstance {
  const cart = world.equipment.find((e) => e.equipment === equipment);
  if (!cart) throw new Error(`no ${equipment}`);
  return cart;
}

const pickUp = () => players(press(1, { pickUp: 'pressed' }));
const walk = (x: number, z: number) => () => players(press(1, { move: { x, z } }));

describe('wheeled equipment', () => {
  it('starts on its homes: two vitals carts in the ED, as decided in issue #8', () => {
    const { world } = startLevel('ed-a');
    expect(world.equipment.filter((e) => e.equipment === 'equipment.vitals-cart')).toHaveLength(2);
    expect(world.equipment.map((e) => e.pushedBy)).toEqual(world.equipment.map(() => null));
  });

  it('Pick up beside it grabs it, and it rolls along in front, a little slower than walking', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    const cart = first(world, 'equipment.vitals-cart');
    standNextTo(world, ctx, 1, cartBox(cart.pos, cart.facing));
    stepWorld(world, ctx, pickUp());
    expect(world.events).toContainEqual({
      type: 'equipmentGrabbed',
      player: 1,
      equipmentId: cart.id,
      equipment: 'equipment.vitals-cart',
    });

    const [x, z] = playerIn(world, 1).pos;
    run(world, ctx, 30, walk(0, -1)); // half a second toward the bays
    const player = playerIn(world, 1);
    // 4.2 m/s × 0.85 (rules.json movement.pushSpeed) × 0.5 s
    expect(z - player.pos[1]).toBeCloseTo(4.2 * 0.85 * 0.5, 6);
    expect(player.pos[0]).toBeCloseTo(x, 6);
    expect(cart.pos[0]).toBeCloseTo(player.pos[0], 6);
    expect(cart.pos[1]).toBeCloseTo(player.pos[1] - 0.75, 6);
  });

  it('stops short of walls instead of passing through them', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    const cart = first(world, 'equipment.vitals-cart');
    cart.pos = [3, 10];
    playerIn(world, 1).pos = [3.8, 10];
    stepWorld(world, ctx, pickUp());
    run(world, ctx, secondsToTicks(1.5), walk(-1, 0)); // into the map's left wall
    // The wall's inner face is at x = 0.1.
    expect(cartBox(cart.pos, cart.facing).x0).toBeGreaterThanOrEqual(0.1 - 1e-9);
    expect(playerIn(world, 1).pos[0]).toBeCloseTo(0.52, 6);
  });

  it('Pick up again parks it, clear of beds and of other parked equipment', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    const bay = ctx.map.beds.find((b) => b.id === 'bay-1');
    if (!bay) throw new Error('no bay-1');
    const [a, b] = world.equipment.filter((e) => e.equipment === 'equipment.vitals-cart');
    if (!a || !b) throw new Error('need two vitals carts');
    for (const cart of [a, b]) {
      standNextTo(world, ctx, 1, cartBox(cart.pos, cart.facing));
      stepWorld(world, ctx, pickUp());
      standNextTo(world, ctx, 1, bedBox(bay)); // facing the bed, so the cart overlaps it
      stepWorld(world, ctx, pickUp());
      expect(world.events).toContainEqual(expect.objectContaining({ type: 'equipmentParked' }));
      expect(distanceToBox(bedBox(bay), cart.pos)).toBeGreaterThanOrEqual(0.4 - 1e-6);
    }
    expect(distanceToBox(cartBox(a.pos, a.facing), b.pos)).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });

  it('a task that needs it starts only once it is beside the bed; Use parks it and starts', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    stepWorld(world, ctx, commands({ type: 'spawn', condition: 'ed.chest-pain' }));
    const tasks = ['task.ask-questions', 'task.check-vitals'];
    stepWorld(
      world,
      ctx,
      commands(...tasks.map((task): SimCommand => ({ type: 'completeTask', patient: 1, task }))),
    );
    const patient = world.patients[0];
    if (!patient) throw new Error('no patient');
    const bedside = () => standNextTo(world, ctx, 1, patientArea(world, ctx, patient));

    bedside();
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(playerIn(world, 1).activity).toBeNull(); // the EKG machine is still at home

    const ekg = first(world, 'equipment.ekg');
    standNextTo(world, ctx, 1, cartBox(ekg.pos, ekg.facing));
    stepWorld(world, ctx, pickUp());
    bedside();
    stepWorld(world, ctx, players(press(1, { use: 'pressed' })));
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'equipmentParked', equipmentId: ekg.id }),
    );
    expect(playerIn(world, 1).activity).toEqual({
      patient: 1,
      task: 'task.ekg',
      equipment: ekg.id,
    });
    const log = run(world, ctx, secondsToTicks(3), () => players(press(1, { use: 'held' })));
    expect(eventsOf(log, 'taskCompleted').map(({ event }) => event.task)).toContain('task.ekg');
  });

  it('serves one task at a time, so a second cart lets a second player start', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 2 });
    // Five critical patients fill the beds; two bad cuts wait side by side.
    const spawns = Array.from({ length: 5 }, (): SimCommand => ({
      type: 'spawn',
      condition: 'ed.chest-pain',
    }));
    stepWorld(
      world,
      ctx,
      commands(
        ...spawns,
        { type: 'spawn', condition: 'ed.bad-cut' },
        { type: 'spawn', condition: 'ed.bad-cut' },
      ),
    );
    stepWorld(
      world,
      ctx,
      commands(
        { type: 'completeTask', patient: 6, task: 'task.ask-questions' },
        { type: 'completeTask', patient: 7, task: 'task.ask-questions' },
      ),
    );
    const [six, seven] = [6, 7].map((id) => world.patients.find((p) => p.id === id));
    if (!six || !seven) throw new Error('no waiting patients');
    const [a, b] = world.equipment.filter((e) => e.equipment === 'equipment.vitals-cart');
    if (!a || !b) throw new Error('need two vitals carts');
    // One cart within reach of both seats.
    const seats = [patientArea(world, ctx, six), patientArea(world, ctx, seven)];
    a.pos = [(seats[0]!.x1 + seats[1]!.x0) / 2, seats[0]!.z1 + 0.8];
    standNextTo(world, ctx, 1, seats[0]!);
    standNextTo(world, ctx, 2, seats[1]!);

    const both = () => players(press(1, { use: 'pressed' }), press(2, { use: 'pressed' }));
    stepWorld(world, ctx, both());
    expect(playerIn(world, 1).activity).toMatchObject({
      task: 'task.check-vitals',
      equipment: a.id,
    });
    expect(playerIn(world, 2).activity).toBeNull();

    parkBeside(world, 'equipment.vitals-cart', seats[1]!);
    stepWorld(world, ctx, players(press(2, { use: 'pressed' })));
    expect(playerIn(world, 2).activity).toMatchObject({
      task: 'task.check-vitals',
      equipment: b.id,
    });
  });

  it('counts the crash cart as the defibrillator it carries', () => {
    const { ctx, world } = startLevel('ed-a');
    const crash = first(world, 'equipment.crash-cart');
    expect(equipmentAt(world, ctx, 'equipment.defib', boxAround(crash.pos, [1, 1]))).toBe(crash);
    expect(equipmentAt(world, ctx, 'equipment.ekg', boxAround(crash.pos, [0.1, 0.1]))).toBeNull();
  });
});
