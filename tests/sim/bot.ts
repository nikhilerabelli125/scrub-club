import type { TaskDef } from '../../src/data';
import {
  availableTasks,
  cartBox,
  distanceToBox,
  equipmentAt,
  patientArea,
  stationBox,
  type EquipmentInstance,
  type Patient,
  type PlayerSlot,
  type SimContext,
  type TickInput,
  type World,
} from '../../src/sim';
import { IDLE, playerIn, players, press, standNextTo } from './helpers';

// A one-player team that only presses buttons, for start-to-finish level tests. It
// teleports instead of walking (movement has its own tests), faces whatever it walks up
// to, and works on the longest-waiting patient first, making each task's trip: fetching
// items, wheeling equipment to the bed, and walking patients to stations.
export function buttonOnlyTeam(world: World, ctx: SimContext, slot: PlayerSlot = 1): TickInput {
  const player = playerIn(world, slot);
  const use = () => players(press(slot, { use: 'pressed' }));
  const pickUp = () => players(press(slot, { pickUp: 'pressed' }));
  if (player.activity) return players(press(slot, { use: 'held' }));

  // Walking a patient somewhere: head for the destination, where they go in.
  const walking = world.patients.find(
    (p) => p.location.kind === 'escorted' && p.location.by === slot,
  );
  if (walking?.location.kind === 'escorted') {
    const type = ctx.content.tasks.get(walking.location.task)?.station;
    const station = ctx.map.stations.find((s) => s.type === type);
    if (station) standNextTo(world, ctx, slot, stationBox(station));
    return IDLE;
  }

  const queue = [...world.patients]
    .filter((p) => p.location.kind !== 'escorted')
    .sort((a, b) => a.arrivedTick - b.arrivedTick || a.id - b.id);
  const tasksOf = (patient: Patient): TaskDef[] =>
    availableTasks(patient).flatMap((entry) => {
      const task = ctx.content.tasks.get(entry.task);
      return task ? [task] : [];
    });
  const atBed = (patient: Patient) => {
    standNextTo(world, ctx, slot, patientArea(world, ctx, patient));
    return use();
  };
  const missingEquipment = (patient: Patient, task: TaskDef) =>
    task.needsEquipment !== undefined &&
    !equipmentAt(world, ctx, task.needsEquipment, patientArea(world, ctx, patient));

  // Deliver what's in hand first, or let go of it if nobody can use it now.
  const carried = world.items.find((i) => i.id === player.holding)?.item;
  if (carried !== undefined) {
    const patient = queue.find((p) => tasksOf(p).some((t) => t.needsItem === carried));
    return patient ? atBed(patient) : pickUp();
  }
  const pushed = world.equipment.find((e) => e.id === player.pushing);
  if (pushed) {
    const patient = queue.find((p) =>
      tasksOf(p).some(
        (t) =>
          t.needsEquipment !== undefined &&
          counts(ctx, pushed.equipment, t.needsEquipment) &&
          missingEquipment(p, t),
      ),
    );
    return patient ? atBed(patient) : pickUp();
  }

  for (const patient of queue) {
    for (const task of tasksOf(patient)) {
      if (task.needsItem) {
        const sources = ctx.content.items.get(task.needsItem)?.sources ?? [];
        const shelf = ctx.map.stations.find((s) => sources.includes(s.type));
        if (!shelf) continue;
        standNextTo(world, ctx, slot, stationBox(shelf));
        return pickUp();
      }
      if (task.needsEquipment && missingEquipment(patient, task)) {
        const cart = nearestFree(world, ctx, slot, task.needsEquipment);
        if (!cart || !standClosestTo(world, ctx, slot, cart)) continue;
        return pickUp();
      }
      if (task.station && !task.interaction) {
        const station = ctx.map.stations.find((s) => s.type === task.station);
        if (!station) continue;
        standNextTo(world, ctx, slot, stationBox(station));
        return use();
      }
      return atBed(patient);
    }
  }
  return IDLE;
}

// Pick up grabs the nearest equipment, so stand where this cart is nearer than any other.
function standClosestTo(
  world: World,
  ctx: SimContext,
  slot: PlayerSlot,
  cart: EquipmentInstance,
): boolean {
  const { radius, reach } = ctx.content.rules.movement;
  const box = cartBox(cart.pos, cart.facing);
  const gap = radius + 0.05;
  const midX = (box.x0 + box.x1) / 2;
  const midZ = (box.z0 + box.z1) / 2;
  const spots: [number, number][] = [
    [midX, box.z1 + gap],
    [box.x1 + gap, midZ],
    [box.x0 - gap, midZ],
    [midX, box.z0 - gap],
  ];
  const spot = spots.find((pos) => {
    const mine = distanceToBox(box, pos);
    return (
      mine <= reach &&
      ctx.colliders.every((c) => distanceToBox(c, pos) >= radius) &&
      world.equipment.every(
        (other) => other === cart || distanceToBox(cartBox(other.pos, other.facing), pos) > mine,
      )
    );
  });
  if (!spot) return false;
  const player = playerIn(world, slot);
  player.pos = spot;
  player.facing = Math.atan2(midX - spot[0], midZ - spot[1]);
  return true;
}

// Equipment that nobody is pushing or working with, nearest to the player first.
function nearestFree(
  world: World,
  ctx: SimContext,
  slot: PlayerSlot,
  needed: string,
): EquipmentInstance | undefined {
  const player = playerIn(world, slot);
  return world.equipment
    .filter(
      (cart) =>
        cart.pushedBy === null &&
        counts(ctx, cart.equipment, needed) &&
        !world.players.some((p) => p.activity?.equipment === cart.id),
    )
    .sort(
      (a, b) =>
        distanceToBox(cartBox(a.pos, a.facing), player.pos) -
        distanceToBox(cartBox(b.pos, b.facing), player.pos),
    )[0];
}

function counts(ctx: SimContext, equipment: string, needed: string): boolean {
  return (
    equipment === needed || (ctx.content.equipment.get(equipment)?.provides ?? []).includes(needed)
  );
}
