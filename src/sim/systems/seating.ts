import { pickOne } from '../rng';
import type { SimContext, World } from '../types';

// Waiting patients are roomed first come, first served, each in a random free bed, like a
// real ED where you never know which room is next (M1 playtest, issue #7). The seeded RNG
// keeps replays exact. Beds named by scripted spawns stay free for those arrivals (ED-E's
// resus bay). Who rooms patients, and the waiting room's job, is still open (issue #10).
export function seatingSystem(world: World, ctx: SimContext): void {
  for (const patient of world.patients) {
    if (patient.location.kind !== 'waiting') continue;
    const free = world.beds.filter((b) => b.patient === null && !ctx.reservedBeds.includes(b.id));
    if (free.length === 0) return;
    const bed = pickOne(world.rng, free);
    bed.patient = patient.id;
    patient.location = { kind: 'bed', bed: bed.id };
    world.events.push({ type: 'patientSeated', patient: patient.id, bed: bed.id });
  }
}
