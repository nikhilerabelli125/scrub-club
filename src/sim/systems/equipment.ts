// Wheeled equipment (docs/01 §7): grab it with Pick up, wheel it in front of you, and let
// go to park it. A task that needs a piece of equipment starts only when one is parked
// beside the patient, and each piece serves one task at a time, so scarce equipment
// (one EKG machine) makes players plan, and some (two vitals carts) just makes a trip.
import { cartBox, distanceToBox, freeSpotNear, rayDistance, type Box } from '../geometry';
import type { EquipmentInstance, Player, SimContext, World } from '../types';

// The cart's center sits this far ahead of the pusher's: their radius plus half its depth.
const PUSH_OFFSET = 0.75;
const CART_HALF_DEPTH = 0.3;
// Parked equipment settles at least this far from walls, beds, stations, and other equipment.
const PARKED_RADIUS = 0.4;

// Keeps a pushed cart in front of its pusher, stopping short of walls. It may overlap a
// bed or station while pushed (so the pusher can still reach the patient), and settles
// clear of them when parked.
export function placePushedEquipment(world: World, ctx: SimContext, player: Player): void {
  const cart = pushedBy(world, player);
  if (!cart) return;
  const dir: [number, number] = [Math.sin(player.facing), Math.cos(player.facing)];
  const free = rayDistance(player.pos, dir, PUSH_OFFSET + CART_HALF_DEPTH, ctx.walls);
  const offset = Math.max(0, Math.min(PUSH_OFFSET, free - CART_HALF_DEPTH));
  cart.pos = [player.pos[0] + dir[0] * offset, player.pos[1] + dir[1] * offset];
  cart.facing = player.facing;
}

export function grabEquipment(world: World, player: Player, cart: EquipmentInstance): void {
  cart.pushedBy = player.slot;
  player.pushing = cart.id;
  world.events.push({
    type: 'equipmentGrabbed',
    player: player.slot,
    equipmentId: cart.id,
    equipment: cart.equipment,
  });
}

export function parkEquipment(world: World, ctx: SimContext, player: Player): void {
  const cart = pushedBy(world, player);
  player.pushing = null;
  if (!cart) return;
  cart.pushedBy = null;
  // Clear of other parked equipment too, so each piece can still be picked out.
  const others = world.equipment
    .filter((other) => other !== cart && other.pushedBy === null)
    .map((other) => cartBox(other.pos, other.facing));
  cart.pos = freeSpotNear(cart.pos, PARKED_RADIUS, [...ctx.colliders, ...others], ctx.map.size);
  world.events.push({
    type: 'equipmentParked',
    player: player.slot,
    equipmentId: cart.id,
    equipment: cart.equipment,
    pos: [cart.pos[0], cart.pos[1]],
  });
}

// Equipment within reach that nobody is pushing or working with, nearest first.
export function grabbableEquipment(
  world: World,
  ctx: SimContext,
  player: Player,
): { cart: EquipmentInstance; distance: number }[] {
  const { reach } = ctx.content.rules.movement;
  return world.equipment
    .filter((cart) => cart.pushedBy === null && !inUse(world, cart))
    .map((cart) => ({ cart, distance: distanceToBox(cartBox(cart.pos, cart.facing), player.pos) }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance || a.cart.id - b.cart.id);
}

// The nearest free piece of equipment that counts as `needed` (the crash cart counts as a
// defibrillator) and stands within equipmentRange of the patient, or null.
export function equipmentAt(
  world: World,
  ctx: SimContext,
  needed: string,
  patientArea: Box,
): EquipmentInstance | null {
  const range = ctx.content.rules.interaction.equipmentRange;
  return (
    world.equipment
      .filter((cart) => cart.pushedBy === null && !inUse(world, cart))
      .filter((cart) => provides(ctx, cart.equipment, needed))
      .map((cart) => ({ cart, distance: distanceToBox(patientArea, cart.pos) }))
      .filter(({ distance }) => distance <= range)
      .sort((a, b) => a.distance - b.distance || a.cart.id - b.cart.id)[0]?.cart ?? null
  );
}

export function pushedBy(world: World, player: Player): EquipmentInstance | undefined {
  return player.pushing === null ? undefined : world.equipment.find((e) => e.id === player.pushing);
}

function inUse(world: World, cart: EquipmentInstance): boolean {
  return world.players.some((p) => p.activity?.equipment === cart.id);
}

function provides(ctx: SimContext, equipment: string, needed: string): boolean {
  return (
    equipment === needed || (ctx.content.equipment.get(equipment)?.provides ?? []).includes(needed)
  );
}
