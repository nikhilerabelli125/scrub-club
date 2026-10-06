import { TICK_SECONDS } from '../clock';
import { resolveCircle } from '../geometry';
import type { Player, SimContext, TickInput, World } from '../types';
import { controlsFor } from './controls';
import { placePushedEquipment } from './equipment';

// Moves each player by their stick or keys, then pushes them out of walls, stations,
// and beds, and out of each other: players bump, so cramped spots slow a team down
// (issue #21). Wheeling equipment slows a player to movement.pushSpeed, and the
// equipment rolls along in front. Players working on a task stay rooted, and nobody can
// shove them; walking away is handled in interactions (docs/03 §1). Dashing arrives in a
// later milestone.
export function movementSystem(world: World, ctx: SimContext, input: TickInput): void {
  const { speed, radius, pushSpeed } = ctx.content.rules.movement;
  for (const player of world.players) {
    if (player.activity) continue;
    const { x, z } = controlsFor(input, player.slot).move;
    const length = Math.hypot(x, z);
    if (length < 0.01) continue;
    // A half-pushed stick walks at half speed; anything past full counts as full.
    const top = player.pushing === null ? speed : speed * pushSpeed;
    const distance = (top * TICK_SECONDS * Math.min(1, length)) / length;
    player.facing = Math.atan2(x, z);
    player.pos = resolveCircle(
      [player.pos[0] + x * distance, player.pos[1] + z * distance],
      radius,
      ctx.colliders,
      ctx.map.size,
    );
  }
  bump(world, ctx);
  for (const player of world.players) placePushedEquipment(world, ctx, player);
}

// Pushes overlapping players apart, half each, or all onto whoever isn't rooted. In slot
// order, so replays match.
function bump(world: World, ctx: SimContext): void {
  const { radius } = ctx.content.rules.movement;
  const players = world.players;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (!a || !b) continue;
      const dx = b.pos[0] - a.pos[0];
      const dz = b.pos[1] - a.pos[1];
      const gap = Math.hypot(dx, dz);
      const overlap = radius * 2 - gap;
      if (overlap <= 0) continue;
      // Exactly on top of each other: part them along x.
      const [nx, nz] = gap > 1e-9 ? [dx / gap, dz / gap] : [1, 0];
      const aMoves = a.activity === null;
      const bMoves = b.activity === null;
      if (!aMoves && !bMoves) continue;
      const share = aMoves && bMoves ? overlap / 2 : overlap;
      if (aMoves) shove(ctx, a, -nx * share, -nz * share);
      if (bMoves) shove(ctx, b, nx * share, nz * share);
    }
  }
}

function shove(ctx: SimContext, player: Player, dx: number, dz: number): void {
  const { radius } = ctx.content.rules.movement;
  player.pos = resolveCircle(
    [player.pos[0] + dx, player.pos[1] + dz],
    radius,
    ctx.colliders,
    ctx.map.size,
  );
}
