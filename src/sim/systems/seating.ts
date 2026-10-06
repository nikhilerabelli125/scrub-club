import { pickOne } from '../rng';
import type { Patient, SimContext, World } from '../types';
import { shownAcuity } from './knowledge';

// Rooming is automatic (issue #10). Waiting patients the team knows are sick (red,
// orange, yellow) take free beds first, sickest first; then those nobody has asked about
// yet (issue #19); then green and blue; first come, first served within each. The bed
// is a random free one, like a real ED where you never know which room is next (issue
// #7); the seeded RNG keeps replays exact. Beds named by scripted spawns stay free for
// those arrivals (ED-E's resus bay). When every bed is taken, the waiting room holds the
// rest.
export function seatingSystem(world: World, ctx: SimContext): void {
  const priority = (patient: Patient) => {
    const acuity = shownAcuity(ctx, patient);
    if (acuity === null) return 4;
    return acuity <= 3 ? acuity : acuity + 10;
  };
  const queue = world.patients
    .filter((p) => p.location.kind === 'waiting')
    .sort((a, b) => priority(a) - priority(b) || a.arrivedTick - b.arrivedTick || a.id - b.id);
  for (const patient of queue) {
    const free = world.beds.filter((b) => b.patient === null && !ctx.reservedBeds.includes(b.id));
    if (free.length === 0) return;
    const bed = pickOne(world.rng, free);
    bed.patient = patient.id;
    patient.location = { kind: 'bed', bed: bed.id };
    world.events.push({ type: 'patientSeated', patient: patient.id, bed: bed.id });
  }
}
