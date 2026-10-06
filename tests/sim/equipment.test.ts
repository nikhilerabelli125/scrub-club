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
  it('starts parked on its homes', () => {
    const { ctx, world } = startLevel('ed-a');
    expect(world.equipment.map((e) => [e.equipment, e.pos])).toEqual(
      ctx.map.equipmentHomes.map((home) => [home.equipment, home.pos]),
    );
    expect(world.equipment.every((e) => e.pushedBy === null)).toBe(true);
  });

  it('Pick up beside it grabs it, and it rolls along in front, a little slower than walking', () => {
    const { ctx, world } = startLevel('ed-a', { playerCount: 1 });
    const cart = first(world, 'equipment.ekg');
    standNextTo(world, ctx, 1, cartBox(cart.pos, cart.facing));
    stepWorld(world, ctx, pickUp());
    expect(world.events).toContainEqual({
      type: 'equipmentGrabbed',
      player: 1,
      equipmentId: cart.id,
      equipment: 'equipment.ekg',
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
    const cart = first(world, 'equipment.ekg');
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
    const [a, b] = [first(world, 'equipment.ekg'), first(world, 'equipment.ultrasound')];
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
      ordering: false,
    });
    const log = run(world, ctx, secondsToTicks(3), () => players(press(1, { use: 'held' })));
    expect(eventsOf(log, 'taskCompleted').map(({ event }) => event.task)).toContain('task.ekg');
  });

  it('serves one task at a time', () => {
    // Two chest pains in neighboring bays, with the EKG machine parked between them.
    const { ctx, world } = startLevel('ed-a', { playerCount: 2 });
    const done = ['task.ask-questions', 'task.check-vitals'];
    stepWorld(
      world,
      ctx,
      commands(
        { type: 'spawn', condition: 'ed.chest-pain', bed: 'bay-1' },
        { type: 'spawn', condition: 'ed.chest-pain', bed: 'bay-2' },
        ...[1, 2].flatMap((patient) =>
          done.map((task): SimCommand => ({ type: 'completeTask', patient, task })),
        ),
      ),
    );
    const ekg = first(world, 'equipment.ekg');
    ekg.pos = [8.75, 4.4]; // within reach of both beds
    const bay = (id: string) => {
      const bed = ctx.map.beds.find((b) => b.id === id);
      if (!bed) throw new Error(`no ${id}`);
      return bedBox(bed);
    };
    standNextTo(world, ctx, 1, bay('bay-1'));
    standNextTo(world, ctx, 2, bay('bay-2'));
    stepWorld(world, ctx, players(press(1, { use: 'pressed' }), press(2, { use: 'pressed' })));
    expect(playerIn(world, 1).activity).toMatchObject({ task: 'task.ekg', equipment: ekg.id });
    expect(playerIn(world, 2).activity).toBeNull();

    // Once the first EKG is done, the second can start.
    run(world, ctx, secondsToTicks(3), () => players(press(1, { use: 'held' })));
    stepWorld(world, ctx, players(press(2, { use: 'pressed' })));
    expect(playerIn(world, 2).activity).toMatchObject({ task: 'task.ekg', equipment: ekg.id });
  });

  it('counts the crash cart as the defibrillator it carries', () => {
    const { ctx, world } = startLevel('ed-a');
    const crash = first(world, 'equipment.crash-cart');
    expect(equipmentAt(world, ctx, 'equipment.defib', boxAround(crash.pos, [1, 1]))).toBe(crash);
    expect(equipmentAt(world, ctx, 'equipment.ekg', boxAround(crash.pos, [0.1, 0.1]))).toBeNull();
  });
});
