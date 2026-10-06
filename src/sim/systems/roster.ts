import type { ItemInstance, World } from '../types';

// Takes a patient out of the level, frees their bed, and counts them as resolved. Their
// ordered meds and samples go with them.
export function removePatient(world: World, patientId: number): void {
  world.patients = world.patients.filter((p) => p.id !== patientId);
  for (const bed of world.beds) if (bed.patient === patientId) bed.patient = null;
  discardItems(world, (item) => item.for?.patient === patientId);
  world.resolved += 1;
}

// Removes items from the world, and from the hands of whoever held them.
export function discardItems(world: World, discard: (item: ItemInstance) => boolean): void {
  const gone = new Set(world.items.filter(discard).map((item) => item.id));
  if (gone.size === 0) return;
  world.items = world.items.filter((item) => !gone.has(item.id));
  for (const player of world.players) {
    if (player.holding !== null && gone.has(player.holding)) player.holding = null;
  }
}
