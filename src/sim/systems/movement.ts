import { TICK_SECONDS } from '../clock';
import { resolveCircle } from '../geometry';
import type { SimContext, TickInput, World } from '../types';
import { controlsFor } from './controls';

// Moves each player by their stick or keys, then pushes them out of walls, stations,
// and beds. Players working on a task stay rooted; walking away is handled in
// interactions (docs/03 §1). Dashing arrives in a later milestone.
export function movementSystem(world: World, ctx: SimContext, input: TickInput): void {
  const { speed, radius } = ctx.content.rules.movement;
  for (const player of world.players) {
    if (player.activity) continue;
    const { x, z } = controlsFor(input, player.slot).move;
    const length = Math.hypot(x, z);
    if (length < 0.01) continue;
    // A half-pushed stick walks at half speed; anything past full counts as full.
    const distance = (speed * TICK_SECONDS * Math.min(1, length)) / length;
    player.facing = Math.atan2(x, z);
    player.pos = resolveCircle(
      [player.pos[0] + x * distance, player.pos[1] + z * distance],
      radius,
      ctx.colliders,
      ctx.map.size,
    );
  }
}
