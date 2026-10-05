import type { SimContext, World } from '../types';
import { admitPatient } from './patients';

// Scripted level events (the docs/05 timelines). Their jitter was rolled when the world
// was created. Spawn events work now; the other event types arrive with their systems
// (escalation in M2, outages and surges in M6).
export function levelEventsSystem(world: World, ctx: SimContext): void {
  for (const scheduled of world.scheduled) {
    if (scheduled.done || scheduled.atTick > world.tick) continue;
    scheduled.done = true;
    const event = ctx.level.events[scheduled.index];
    if (event?.type === 'spawn') {
      admitPatient(world, ctx, event.condition, { via: event.via, bed: event.bed });
    }
  }
}
