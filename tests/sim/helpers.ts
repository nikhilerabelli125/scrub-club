import { fileURLToPath } from 'node:url';
import { loadContent, type Content } from '../../src/data';
import {
  availableTasks,
  createContext,
  createWorld,
  distanceToBox,
  idleControls,
  stepWorld,
  type Box,
  type EquipmentInstance,
  type Player,
  type PlayerCount,
  type PlayerInput,
  type PlayerSlot,
  type SimCommand,
  type SimContext,
  type SimEvent,
  type TickInput,
  type World,
} from '../../src/sim';
import { buildColliders, canReach, wallBox } from '../../src/sim/geometry';
import { loadDataDir } from '../../tools/load-data';

let cached: Content | undefined;

// The real data/ folder, validated and indexed, loaded once per test file.
export function content(): Content {
  if (cached) return cached;
  const { files, issues } = loadDataDir(fileURLToPath(new URL('../../data/', import.meta.url)));
  const result = loadContent(files);
  if (issues.length > 0 || !result.ok) {
    const problems = result.ok ? issues : [...issues, ...result.issues];
    throw new Error(problems.map((i) => `${i.file} ${i.at}: ${i.message}`).join('\n'));
  }
  cached = result.content;
  return cached;
}

export function startLevel(
  levelId: string,
  options: { seed?: number; playerCount?: PlayerCount; map?: string } = {},
): { ctx: SimContext; world: World } {
  let ctx = createContext(content(), levelId);
  if (options.map !== undefined) {
    // The level's rules on another map, for tests about rules rather than layout.
    const map = content().maps.get(options.map);
    if (!map) throw new Error(`no map ${options.map}`);
    ctx = {
      ...ctx,
      level: { ...ctx.level, map: map.id },
      map,
      colliders: buildColliders(map),
      walls: map.walls.map(wallBox),
    };
  }
  const world = createWorld(ctx, {
    seed: options.seed ?? 1,
    playerCount: options.playerCount ?? 2,
  });
  return { ctx, world };
}

// ED-A's rules on the full ED map, which has every ED station. Most sim tests use it, so
// they test rules and not ED-A's own small layout (data/maps/ed-a.json).
export function startED(options: { seed?: number; playerCount?: PlayerCount } = {}): {
  ctx: SimContext;
  world: World;
} {
  return startLevel('ed-a', { ...options, map: 'ed-main' });
}

export const IDLE: TickInput = { players: [] };

export function commands(...list: SimCommand[]): TickInput {
  return { players: [], commands: list };
}

export interface Logged {
  tick: number;
  event: SimEvent;
}

// Steps up to `ticks` times (stopping early if the level ends) and logs every event.
export function run(
  world: World,
  ctx: SimContext,
  ticks: number,
  inputFor: (world: World) => TickInput = () => IDLE,
): Logged[] {
  const log: Logged[] = [];
  for (let i = 0; i < ticks && world.status === 'running'; i++) {
    stepWorld(world, ctx, inputFor(world));
    for (const event of world.events) log.push({ tick: world.tick, event });
  }
  return log;
}

export function eventsOf<T extends SimEvent['type']>(
  log: readonly Logged[],
  type: T,
): { tick: number; event: Extract<SimEvent, { type: T }> }[] {
  return log.filter(
    (entry): entry is { tick: number; event: Extract<SimEvent, { type: T }> } =>
      entry.event.type === type,
  );
}

// A perfect, instant team: each tick, complete every task each patient can start.
export function treatEveryone(world: World): TickInput {
  return {
    players: [],
    commands: world.patients.flatMap((patient) =>
      availableTasks(patient).map((task): SimCommand => ({
        type: 'completeTask',
        patient: patient.id,
        task: task.task,
      })),
    ),
  };
}

// One player's controls for a tick: idle except for what's given.
export function press(slot: PlayerSlot, controls: Partial<Omit<PlayerInput, 'slot'>>): PlayerInput {
  return { ...idleControls(slot), ...controls };
}

// One player's controls for a tick: nothing pressed.
export function idle(slot: PlayerSlot): PlayerInput {
  return idleControls(slot);
}

export function players(...inputs: PlayerInput[]): TickInput {
  return { players: inputs };
}

export function playerIn(world: World, slot: PlayerSlot): Player {
  const player = world.players.find((p) => p.slot === slot);
  if (!player) throw new Error(`no player ${slot}`);
  return player;
}

// Free floor within reach of a bed, station, or item where a player could stand: straight
// out from each side first (below, right, left, above), then the diagonals, closest rings
// first. The farthest ring keeps a margin inside reach, for bots that stop a little short.
export function spotsNextTo(ctx: SimContext, box: Box): [number, number][] {
  const { radius, reach } = ctx.content.rules.movement;
  const cx = (box.x0 + box.x1) / 2;
  const cz = (box.z0 + box.z1) / 2;
  const [width, depth] = ctx.map.size;
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
    ...[1, 3, 5, 7, 9, 11, 13, 15].map((k): [number, number] => {
      const angle = (k * Math.PI) / 8;
      return [Math.sin(angle), Math.cos(angle)];
    }),
    ...[1, 3, 5, 7].map((k): [number, number] => {
      const angle = (k * Math.PI) / 4;
      return [Math.sin(angle), Math.cos(angle)];
    }),
  ];
  const gaps = [radius + 0.05, radius + 0.2, radius + 0.35, reach - 0.07];
  const candidates = gaps.flatMap((gap) =>
    directions.map(([dx, dz]): [number, number] => {
      // Out of the box along this direction, then `gap` farther.
      const exitX = dx === 0 ? Infinity : Math.abs((dx > 0 ? box.x1 : box.x0) - cx) / Math.abs(dx);
      const exitZ = dz === 0 ? Infinity : Math.abs((dz > 0 ? box.z1 : box.z0) - cz) / Math.abs(dz);
      const exit = Math.min(exitX, exitZ);
      const out = (Number.isFinite(exit) ? exit : 0) + gap;
      return [cx + dx * out, cz + dz * out];
    }),
  );
  return candidates.filter(
    ([x, z]) =>
      x > radius &&
      x < width - radius &&
      z > radius &&
      z < depth - radius &&
      ctx.colliders.every((collider) => distanceToBox(collider, [x, z]) >= radius - 1e-9) &&
      canReach(ctx.walls, [x, z], box, reach - 0.05),
  );
}

// Puts a player on free floor within reach of a bed or station, facing it, as a stand-in
// for walking there (movement has its own tests).
export function standNextTo(world: World, ctx: SimContext, slot: PlayerSlot, box: Box): void {
  const spot = spotsNextTo(ctx, box)[0];
  if (!spot) throw new Error('no free floor next to that box');
  const player = playerIn(world, slot);
  player.pos = spot;
  player.facing = Math.atan2((box.x0 + box.x1) / 2 - spot[0], (box.z0 + box.z1) / 2 - spot[1]);
}

// Test setup: puts an item straight into a player's hands, as if fetched.
export function hand(world: World, slot: PlayerSlot, item: string): void {
  const player = playerIn(world, slot);
  world.items.push({
    id: world.nextItemId,
    item,
    place: { kind: 'held', player: slot },
    for: null,
  });
  player.holding = world.nextItemId;
  world.nextItemId += 1;
}

// Test setup: parks a piece of equipment just past the foot of a bed (or in front of a
// seat), as if wheeled there.
export function parkBeside(world: World, equipment: string, box: Box): EquipmentInstance {
  const cart = world.equipment.find(
    (e) =>
      e.equipment === equipment &&
      e.pushedBy === null &&
      !world.players.some((p) => p.activity?.equipment === e.id),
  );
  if (!cart) throw new Error(`no free ${equipment}`);
  cart.pos = [(box.x0 + box.x1) / 2 + 0.9, box.z1 + 0.5];
  return cart;
}

// Test setup: the patients here now never get worse, so they hold their beds and seats
// for as long as a test needs. (Untreated, a chest pain goes to another team in about a
// minute.)
export function keepStable(world: World): void {
  for (const patient of world.patients) patient.escalation.dueTick = Number.MAX_SAFE_INTEGER;
}

// Input for `run`: spawns these patients on the first tick, then keeps them stable.
export function spawnStable(...list: SimCommand[]): (world: World) => TickInput {
  return (world) => {
    if (world.tick === 1) keepStable(world);
    return world.tick === 0 ? commands(...list) : IDLE;
  };
}
