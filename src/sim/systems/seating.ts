import { pickOne } from '../rng';
import type { SimContext, World } from '../types';
import { shownAcuity } from './patients';

// Rooming is automatic (issue #10): the sickest waiting patient, by the acuity their
// ticket shows, takes the next free bed, then first come, first served. The bed is a
// random free one, like a real ED where you never know which room is next (issue #7);
// the seeded RNG keeps replays exact. Beds named by scripted spawns stay free for those
// arrivals (ED-E's resus bay). When every bed is taken, the waiting room holds the rest.
export function seatingSystem(world: World, ctx: SimContext): void {
  const queue = world.patients
    .filter((p) => p.location.kind === 'waiting')
    .sort(
      (a, b) =>
        shownAcuity(ctx, a) - shownAcuity(ctx, b) || a.arrivedTick - b.arrivedTick || a.id - b.id,
    );
  for (const patient of queue) {
    const free = world.beds.filter((b) => b.patient === null && !ctx.reservedBeds.includes(b.id));
    if (free.length === 0) return;
    const bed = pickOne(world.rng, free);
    bed.patient = patient.id;
    patient.location = { kind: 'bed', bed: bed.id };
    world.events.push({ type: 'patientSeated', patient: patient.id, bed: bed.id });
  }
}
