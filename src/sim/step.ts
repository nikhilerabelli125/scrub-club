import { commandSystem } from './systems/commands';
import { endSystem } from './systems/end';
import { levelEventsSystem } from './systems/level-events';
import { patienceSystem } from './systems/patients';
import { scoringSystem } from './systems/scoring';
import { spawnSystem } from './systems/spawn';
import type { SimContext, TickInput, World } from './types';

// Advances the world by one fixed tick. Systems run in the docs/07 §3.6 order; the ones
// that don't exist yet (abilities, movement, interactions, minigames, items, escalation,
// codes, chores, gimmicks) slot into their places as their milestones land.
export function stepWorld(world: World, ctx: SimContext, input: TickInput): void {
  if (world.status === 'ended') return;
  world.events = [];
  world.tick += 1;
  commandSystem(world, ctx, input.commands ?? []);
  patienceSystem(world);
  levelEventsSystem(world, ctx);
  spawnSystem(world, ctx);
  scoringSystem(world, ctx);
  endSystem(world, ctx);
}
