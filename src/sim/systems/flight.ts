// Items in the air (issue #21): thrown by players, or shot out of a tube station when an
// order is ready. They fly straight at rules.json throwing.speed and stop at walls; counters
// and beds don't stop them, so a throw can cross the nurses' station to a teammate. A
// player with free hands close to the item catches it (never the thrower); otherwise it
// lands where it runs out of distance, which can be on a counter or a bed.
import { TICK_SECONDS } from '../clock';
import { stationBox, bedBox, type Box } from '../geometry';
import type { ItemInstance, Player, PlayerSlot, SimContext, World } from '../types';

export function throwItem(world: World, ctx: SimContext, player: Player, item: ItemInstance): void {
  const { distance } = ctx.content.rules.throwing;
  player.holding = null;
  launch(
    item,
    player.pos,
    [Math.sin(player.facing), Math.cos(player.facing)],
    distance,
    player.slot,
  );
  world.events.push({ type: 'itemThrown', player: player.slot, itemId: item.id, item: item.item });
}

export function launch(
  item: ItemInstance,
  from: readonly [number, number],
  dir: readonly [number, number],
  distance: number,
  by: PlayerSlot | null,
): void {
  item.place = {
    kind: 'flying',
    pos: [from[0], from[1]],
    dir: [dir[0], dir[1]],
    left: distance,
    total: distance,
    by,
  };
}

export function flightSystem(world: World, ctx: SimContext): void {
  const { speed, catchRadius } = ctx.content.rules.throwing;
  for (const item of world.items) {
    const place = item.place;
    if (place.kind !== 'flying') continue;
    const move = Math.min(speed * TICK_SECONDS, place.left);
    const next: [number, number] = [
      place.pos[0] + place.dir[0] * move,
      place.pos[1] + place.dir[1] * move,
    ];
    const [width, depth] = ctx.map.size;
    const blocked =
      next[0] < 0.2 ||
      next[1] < 0.2 ||
      next[0] > width - 0.2 ||
      next[1] > depth - 0.2 ||
      ctx.walls.some((wall) => inside(wall, next));
    if (!blocked) {
      place.pos = next;
      place.left -= move;
    }

    const catcher = world.players
      .filter((p) => p.slot !== place.by && handsFree(p))
      .map((p) => ({ p, d: Math.hypot(p.pos[0] - place.pos[0], p.pos[1] - place.pos[1]) }))
      .filter(({ d }) => d <= catchRadius)
      .sort((a, b) => a.d - b.d || a.p.slot - b.p.slot)[0]?.p;
    if (catcher) {
      item.place = { kind: 'held', player: catcher.slot };
      catcher.holding = item.id;
      world.events.push({
        type: 'itemCaught',
        player: catcher.slot,
        itemId: item.id,
        item: item.item,
      });
      continue;
    }
    if (!blocked && place.left > 1e-9) continue;
    const pos = restingSpot(ctx, place.pos);
    item.place = { kind: 'floor', pos };
    world.events.push({ type: 'itemLanded', itemId: item.id, item: item.item, pos });
  }
}

function handsFree(player: Player): boolean {
  return player.holding === null && player.pushing === null && player.activity === null;
}

function inside(box: Box, [x, z]: readonly [number, number]): boolean {
  return x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1;
}

// An item landing deep inside a big station or a bed comes to rest near its edge, so
// someone standing beside it can still reach it.
function restingSpot(ctx: SimContext, pos: readonly [number, number]): [number, number] {
  let [x, z] = pos;
  const inset = 0.45;
  const boxes = [...ctx.map.stations.map(stationBox), ...ctx.map.beds.map(bedBox)];
  for (const box of boxes) {
    if (!inside(box, [x, z])) continue;
    const edges = [
      { d: x - box.x0, move: () => (x = box.x0 + inset) },
      { d: box.x1 - x, move: () => (x = box.x1 - inset) },
      { d: z - box.z0, move: () => (z = box.z0 + inset) },
      { d: box.z1 - z, move: () => (z = box.z1 - inset) },
    ];
    const nearest = edges.sort((a, b) => a.d - b.d)[0];
    if (nearest && nearest.d > inset) nearest.move();
  }
  return [x, z];
}
