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
  options: { seed?: number; playerCount?: PlayerCount } = {},
): { ctx: SimContext; world: World } {
  const ctx = createContext(content(), levelId);
  const world = createWorld(ctx, {
    seed: options.seed ?? 1,
    playerCount: options.playerCount ?? 2,
  });
  return { ctx, world };
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

export function players(...inputs: PlayerInput[]): TickInput {
  return { players: inputs };
}

export function playerIn(world: World, slot: PlayerSlot): Player {
  const player = world.players.find((p) => p.slot === slot);
  if (!player) throw new Error(`no player ${slot}`);
  return player;
}

// Puts a player on free floor within reach of a bed or station, facing it, as a stand-in
// for walking there (movement has its own tests).
export function standNextTo(world: World, ctx: SimContext, slot: PlayerSlot, box: Box): void {
  const { radius, reach } = ctx.content.rules.movement;
  const midX = (box.x0 + box.x1) / 2;
  const midZ = (box.z0 + box.z1) / 2;
  const [width, depth] = ctx.map.size;
  // Close in first, then farther out, for seats tucked inside a station.
  const candidates = [radius + 0.05, radius + 0.3, reach].flatMap((gap): [number, number][] => [
    [midX, box.z1 + gap],
    [box.x1 + gap, midZ],
    [box.x0 - gap, midZ],
    [midX, box.z0 - gap],
  ]);
  const spot = candidates.find(
    ([x, z]) =>
      x > radius &&
      x < width - radius &&
      z > radius &&
      z < depth - radius &&
      ctx.colliders.every((collider) => distanceToBox(collider, [x, z]) >= radius) &&
      distanceToBox(box, [x, z]) <= reach,
  );
  if (!spot) throw new Error('no free floor next to that box');
  const player = playerIn(world, slot);
  player.pos = spot;
  player.facing = Math.atan2(midX - spot[0], midZ - spot[1]);
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
