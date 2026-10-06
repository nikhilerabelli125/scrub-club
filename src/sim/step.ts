import { commandSystem } from './systems/commands';
import { endSystem } from './systems/end';
import { flightSystem } from './systems/flight';
import { escalationSystem } from './systems/escalation';
import { escortSystem } from './systems/escort';
import { interactionSystem } from './systems/interactions';
import { levelEventsSystem } from './systems/level-events';
import { movementSystem } from './systems/movement';
import { ordersSystem } from './systems/orders';
import { patienceSystem } from './systems/patients';
import { scoringSystem } from './systems/scoring';
import { seatingSystem } from './systems/seating';
import { spawnSystem } from './systems/spawn';
import { workSystem } from './systems/work';
import type { SimContext, TickInput, World } from './types';

// Advances the world by one fixed tick. Systems run in the docs/07 §3.6 order, with
// escorts right after movement (patients follow their player), orders and results after
// work (docs' "items"), and seating right after spawning so new arrivals take a bed the
// tick they arrive. Systems
// that don't exist yet (abilities, items, escalation, codes, chores, gimmicks) slot into
// their places as their milestones land.
export function stepWorld(world: World, ctx: SimContext, input: TickInput): void {
  if (world.status === 'ended') return;
  world.events = [];
  world.tick += 1;
  commandSystem(world, ctx, input.commands ?? []);
  movementSystem(world, ctx, input);
  escortSystem(world, ctx);
  interactionSystem(world, ctx, input);
  workSystem(world, ctx, input);
  ordersSystem(world, ctx);
  flightSystem(world, ctx);
  patienceSystem(world);
  escalationSystem(world, ctx);
  levelEventsSystem(world, ctx);
  spawnSystem(world, ctx);
  seatingSystem(world, ctx);
  scoringSystem(world, ctx);
  endSystem(world, ctx);
}
