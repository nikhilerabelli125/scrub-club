import type { SimContext, World } from '../types';

// Patients walk into free beds in map order, first come, first served. Beds named by
// scripted spawns stay free for those arrivals (ED-E's resus bay). Letting players
// choose who goes first, by escorting patients to beds, arrives with escorts in M2.
export function seatingSystem(world: World, ctx: SimContext): void {
  for (const patient of world.patients) {
    if (patient.location.kind !== 'waiting') continue;
    const bed = world.beds.find((b) => b.patient === null && !ctx.reservedBeds.includes(b.id));
    if (!bed) return;
    bed.patient = patient.id;
    patient.location = { kind: 'bed', bed: bed.id };
    world.events.push({ type: 'patientSeated', patient: patient.id, bed: bed.id });
  }
}
