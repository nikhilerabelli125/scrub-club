import type { TaskDef } from '../../src/data';
import {
  availableTasks,
  boxAround,
  cartBox,
  distanceToBox,
  equipmentAt,
  needsOrder,
  patientArea,
  shownAcuity,
  stationBox,
  type Box,
  type EquipmentInstance,
  type Patient,
  type PlayerInput,
  type PlayerSlot,
  type SimContext,
  type TickInput,
  type World,
} from '../../src/sim';
import { IDLE, idle, playerIn, players, press, spotsNextTo } from './helpers';
import { buildGrid, findPath, type PathGrid } from './paths';

// Test bots that only press buttons, for start-to-finish level tests and balance checks.
// Both plan the same way: triage first (see `urgency`), make each task's trip
// (fetch items, wheel equipment to the bed, walk patients to stations, order meds, take
// samples to the lab), and while an order or result is on its way, help the next patient.
// buttonOnlyTeam teleports; walkingTeam walks there like a person.

// What a bot does next: get within reach of `target`, then press `button`. With no target,
// press it right where you are (to set something down); with no button, getting there is
// the point (walking a patient to a station).
export interface Goal {
  target: Box | null;
  button: 'use' | 'pickUp' | null;
  key: string; // the patient task it's for, so teammates pick something else
  cart?: EquipmentInstance; // stand where this cart is nearer than any other
}

export type Plan = Goal | 'work' | null;

export function plan(
  world: World,
  ctx: SimContext,
  slot: PlayerSlot,
  taken: ReadonlySet<string> = new Set(),
): Plan {
  const player = playerIn(world, slot);
  if (player.activity) return 'work';

  // Walking a patient somewhere: head for the destination, where they go in.
  const walking = world.patients.find(
    (p) => p.location.kind === 'escorted' && p.location.by === slot,
  );
  if (walking?.location.kind === 'escorted') {
    const type = ctx.content.tasks.get(walking.location.task)?.station;
    const station = ctx.map.stations.find((s) => s.type === type);
    if (!station) return null;
    return { target: stationBox(station), button: null, key: `${walking.id}:walk` };
  }

  // Triage, as ED-A's briefing teaches: anyone visibly getting worse first, then the known
  // sick (red and orange), then whoever nobody has asked about yet, then the rest, each
  // longest waiting first.
  const urgency = (p: Patient) => {
    if (p.escalation.stage > 0) return 0;
    const acuity = shownAcuity(ctx, p);
    if (acuity === null) return 2;
    return acuity <= 2 ? 1 : 3;
  };
  const queue = [...world.patients]
    .filter((p) => p.location.kind !== 'escorted')
    .sort((a, b) => urgency(a) - urgency(b) || a.arrivedTick - b.arrivedTick || a.id - b.id);
  const tasksOf = (patient: Patient): TaskDef[] =>
    availableTasks(patient).flatMap((entry) => {
      const task = ctx.content.tasks.get(entry.task);
      return task ? [task] : [];
    });
  const bed = (patient: Patient, key: string): Goal => ({
    target: patientArea(world, ctx, patient),
    button: 'use',
    key,
  });
  const putDown: Goal = { target: null, button: 'pickUp', key: `${slot}:drop` };
  const missingEquipment = (patient: Patient, task: TaskDef) =>
    task.needsEquipment !== undefined &&
    !equipmentAt(world, ctx, task.needsEquipment, patientArea(world, ctx, patient));

  // Deliver what's in hand first: a sample to the lab, a labeled med to its patient, or a
  // supply to whoever needs it. Set it down if nobody can use it now.
  const carried = world.items.find((i) => i.id === player.holding);
  if (carried) {
    const owner = carried.for;
    if (owner) {
      const task = ctx.content.tasks.get(owner.task);
      const patient = queue.find((p) => p.id === owner.patient);
      const entry = patient?.tasks.find((t) => t.task === owner.task);
      const key = `${owner.patient}:${owner.task}`;
      if (entry?.stage === 'sample' && task?.result) {
        const lab = ctx.map.stations.find((s) => s.type === task.result?.at);
        return lab ? { target: stationBox(lab), button: 'pickUp', key } : putDown;
      }
      return patient ? bed(patient, key) : putDown;
    }
    for (const patient of queue) {
      const task = tasksOf(patient).find(
        (t) => t.needsItem === carried.item && !needsOrder(ctx, t),
      );
      if (task) return bed(patient, `${patient.id}:${task.id}`);
    }
    return putDown;
  }
  const pushed = world.equipment.find((e) => e.id === player.pushing);
  if (pushed) {
    for (const patient of queue) {
      const task = tasksOf(patient).find(
        (t) =>
          t.needsEquipment !== undefined &&
          counts(ctx, pushed.equipment, t.needsEquipment) &&
          missingEquipment(patient, t),
      );
      if (task) return bed(patient, `${patient.id}:${task.id}`);
    }
    return putDown;
  }

  for (const patient of queue) {
    for (const task of tasksOf(patient)) {
      const key = `${patient.id}:${task.id}`;
      if (taken.has(key)) continue;
      const stage = patient.tasks.find((t) => t.task === task.id)?.stage ?? 'start';
      if (stage === 'ordered' || stage === 'result') continue; // something else meanwhile
      if (stage === 'sample') {
        // Hands were full when the sample came out, so it's on the floor.
        const sample = world.items.find(
          (i) => i.for?.patient === patient.id && i.for.task === task.id,
        );
        if (sample?.place.kind !== 'floor') continue;
        return { target: pointBox(sample.place.pos), button: 'pickUp', key };
      }
      if (needsOrder(ctx, task) && stage === 'start') {
        const desk = ctx.map.stations.find((s) => s.type === task.order?.at);
        if (!desk) continue;
        return { target: stationBox(desk), button: 'use', key };
      }
      if (task.needsItem) {
        const needed = task.needsItem;
        // A med that came by tube, labeled for this patient: go and pick it up.
        const labeled = world.items.find(
          (i) => i.for?.patient === patient.id && i.for.task === task.id,
        );
        if (labeled) {
          if (labeled.place.kind !== 'floor') continue; // still in the air
          return { target: pointBox(labeled.place.pos), button: 'pickUp', key };
        }
        if (stage === 'ready') continue;
        // A tool lying around, like a stethoscope: the nearest one.
        if (ctx.content.items.get(needed)?.tool === true) {
          const tool = world.items
            .flatMap((i) => (i.item === needed && i.place.kind === 'floor' ? [i.place.pos] : []))
            .sort((a, b) => distance(a, player.pos) - distance(b, player.pos))[0];
          if (!tool) continue;
          return { target: pointBox(tool), button: 'pickUp', key };
        }
        const sources = ctx.content.items.get(needed)?.sources ?? [];
        const shelf = ctx.map.stations.find((s) => sources.includes(s.type));
        if (!shelf) continue;
        return { target: stationBox(shelf), button: 'pickUp', key };
      }
      if (task.needsEquipment && missingEquipment(patient, task)) {
        const cart = nearestFree(world, ctx, slot, task.needsEquipment);
        if (!cart || !spotClosestTo(world, ctx, cart)) continue;
        return { target: cartBox(cart.pos, cart.facing), button: 'pickUp', key, cart };
      }
      if (task.station && !task.interaction) {
        const station = ctx.map.stations.find((s) => s.type === task.station);
        if (!station) continue;
        return { target: stationBox(station), button: 'use', key };
      }
      return bed(patient, key);
    }
  }
  return null;
}

// A one-player team that teleports to each goal.
export function buttonOnlyTeam(world: World, ctx: SimContext, slot: PlayerSlot = 1): TickInput {
  const next = plan(world, ctx, slot);
  if (next === 'work') return players(press(slot, { use: 'held' }));
  if (next === null) return IDLE;
  if (next.target) {
    const spot = next.cart
      ? spotClosestTo(world, ctx, next.cart)
      : spotsNextTo(ctx, next.target)[0];
    if (!spot) return IDLE;
    const player = playerIn(world, slot);
    player.pos = spot;
    player.facing = facing(spot, next.target);
  }
  return next.button ? players(press(slot, { [next.button]: 'pressed' })) : IDLE;
}

// --- Walking at human speed --------------------------------------------------------------

// How long a walking bot takes to decide on a new goal (reading tickets, finding their way)
// and to react after pressing a button. A practiced player decides quickly; someone new
// to the game takes much longer.
export const SKILL = {
  practiced: { thinkTicks: 24, reactTicks: 9 }, // 0.4 s, 0.15 s
  new: { thinkTicks: 90, reactTicks: 24 }, // 1.5 s, 0.4 s
} as const;
export type Skill = keyof typeof SKILL;
const ARRIVED = 0.04; // m

interface Walker {
  slot: PlayerSlot;
  goal: Goal | null;
  // Goals it couldn't find a way to, and the tick to try them again.
  skipped: Map<string, number>;
  spot: [number, number] | null;
  path: [number, number][];
  pause: number;
  still: number; // ticks without moving while trying to
  stuck: number; // times it got stuck on the way to this goal
  sidestep: { ticks: number; dir: [number, number] } | null;
  last: [number, number];
}

export interface WalkingTeam {
  walkers: Walker[];
  grid: PathGrid;
  skill: Skill;
}

export function createWalkingTeam(
  world: World,
  ctx: SimContext,
  skill: Skill = 'practiced',
): WalkingTeam {
  return {
    skill,
    grid: buildGrid(ctx),
    walkers: world.players.map((p) => ({
      slot: p.slot,
      goal: null,
      skipped: new Map(),
      spot: null,
      path: [],
      pause: 0,
      still: 0,
      stuck: 0,
      sidestep: null,
      last: [p.pos[0], p.pos[1]],
    })),
  };
}

// One tick of input for every walking bot.
export function walkingTeam(world: World, ctx: SimContext, team: WalkingTeam): TickInput {
  const inputs: PlayerInput[] = [];
  for (const walker of team.walkers) {
    // Whatever a teammate is heading for or already doing.
    const taken = new Set([
      ...team.walkers.flatMap((w) => (w !== walker && w.goal ? [w.goal.key] : [])),
      ...world.players.flatMap((p) =>
        p.slot !== walker.slot && p.activity ? [`${p.activity.patient}:${p.activity.task}`] : [],
      ),
    ]);
    inputs.push(stepWalker(world, ctx, team, walker, taken));
  }
  return { players: inputs };
}

function stepWalker(
  world: World,
  ctx: SimContext,
  team: WalkingTeam,
  walker: Walker,
  taken: ReadonlySet<string>,
): PlayerInput {
  const { grid } = team;
  const { slot } = walker;
  const player = playerIn(world, slot);
  if (player.activity) {
    walker.goal = null;
    return press(slot, { use: 'held' });
  }
  if (walker.pause > 0) {
    walker.pause -= 1;
    return idle(slot);
  }

  if (!walker.goal) {
    for (const [key, until] of walker.skipped) if (world.tick >= until) walker.skipped.delete(key);
    const next = plan(world, ctx, slot, new Set([...taken, ...walker.skipped.keys()]));
    if (next === null || next === 'work') return idle(slot);
    walker.goal = next;
    walker.spot = null;
    walker.path = [];
    walker.stuck = 0;
    walker.sidestep = null;
    walker.pause = SKILL[team.skill].thinkTicks;
    if (next.target) {
      // Not where a teammate is standing or heading: players bump.
      const crowded = (spot: [number, number]) =>
        world.players.some((p) => p.slot !== slot && distance(p.pos, spot) < 0.9) ||
        team.walkers.some((w) => w !== walker && w.spot !== null && distance(w.spot, spot) < 0.9);
      const options = (
        next.cart
          ? [spotClosestTo(world, ctx, next.cart)].flatMap((s) => (s ? [s] : []))
          : spotsNextTo(ctx, next.target)
      ).filter((spot) => !crowded(spot));
      // Path-find to the few nearest spots only; that's plenty, and pathfinding is slow.
      const reachable = options
        .sort((a, b) => distance(player.pos, a) - distance(player.pos, b))
        .slice(0, 4)
        .map((spot) => ({ spot, path: findPath(ctx, grid, player.pos, spot) }))
        .filter((option): option is { spot: [number, number]; path: [number, number][] } =>
          Boolean(option.path),
        )
        .sort((a, b) => length(player.pos, a.path) - length(player.pos, b.path))[0];
      if (!reachable) {
        // No way there for now (every spot taken, or walled off): try something else.
        walker.skipped.set(next.key, world.tick + SKILL[team.skill].thinkTicks * 3);
        walker.goal = null;
        return idle(slot);
      }
      walker.spot = reachable.spot;
      walker.path = reachable.path;
    }
    return idle(slot);
  }

  const goal = walker.goal;
  const spot = walker.spot;
  if (spot && distance(player.pos, spot) > ARRIVED) {
    const moved = distance(player.pos, walker.last) > 0.01;
    walker.last = [player.pos[0], player.pos[1]];
    walker.still = moved ? 0 : walker.still + 1;
    if (walker.sidestep) {
      walker.sidestep.ticks -= 1;
      const [x, z] = walker.sidestep.dir;
      if (walker.sidestep.ticks <= 0) {
        walker.sidestep = null;
        walker.path = findPath(ctx, grid, player.pos, spot) ?? [];
      }
      return press(slot, { move: { x, z } });
    }
    if (walker.still > 15) {
      // Bumped head-on, as people do in a doorway: step to your own left, then find a new
      // way. After a few tries, give up on this goal for a while.
      walker.still = 0;
      walker.stuck += 1;
      if (walker.stuck > 3) {
        if (goal) walker.skipped.set(goal.key, world.tick + SKILL[team.skill].thinkTicks * 3);
        walker.goal = null;
        walker.stuck = 0;
        return idle(slot);
      }
      const ahead = walker.path[0] ?? spot;
      const dx = ahead[0] - player.pos[0];
      const dz = ahead[1] - player.pos[1];
      const d = Math.hypot(dx, dz) || 1;
      walker.sidestep = { ticks: 15, dir: [dz / d, -dx / d] };
      return idle(slot);
    }
    while (walker.path.length > 1 && distance(player.pos, walker.path[0] ?? spot) < ARRIVED) {
      walker.path.shift();
    }
    const waypoint = walker.path[0] ?? spot;
    const dx = waypoint[0] - player.pos[0];
    const dz = waypoint[1] - player.pos[1];
    const d = Math.hypot(dx, dz);
    // Slow down for the last few centimeters so the bot doesn't overshoot its spot.
    const pace = Math.min(1, d / (ctx.content.rules.movement.speed / 60));
    return press(slot, { move: { x: (dx / d) * pace, z: (dz / d) * pace } });
  }

  // Wheeling equipment to a bed: turn to face it first, so the cart parks beside it.
  if (goal.target && player.pushing !== null) {
    const want = facing(player.pos, goal.target);
    const off = Math.abs(
      Math.atan2(Math.sin(want - player.facing), Math.cos(want - player.facing)),
    );
    if (off > 0.5)
      return press(slot, { move: { x: Math.sin(want) * 0.2, z: Math.cos(want) * 0.2 } });
  }
  // Arrived: press the button (once), then think about what's next.
  walker.goal = null;
  walker.pause = SKILL[team.skill].reactTicks;
  return goal.button ? press(slot, { [goal.button]: 'pressed' }) : idle(slot);
}

// --- Shared helpers -----------------------------------------------------------------------

// Pick up grabs the nearest equipment, so stand where this cart is nearer than any other.
function spotClosestTo(
  world: World,
  ctx: SimContext,
  cart: EquipmentInstance,
): [number, number] | undefined {
  const { reach } = ctx.content.rules.movement;
  const box = cartBox(cart.pos, cart.facing);
  return spotsNextTo(ctx, box).find((pos) => {
    const mine = distanceToBox(box, pos);
    return (
      mine <= reach &&
      world.equipment.every(
        (other) => other === cart || distanceToBox(cartBox(other.pos, other.facing), pos) > mine,
      ) &&
      // A small item within reach wins over equipment, so stand clear of floor items too.
      world.items.every(
        (i) =>
          i.place.kind !== 'floor' || distance(i.place.pos, pos) > ctx.content.rules.movement.reach,
      )
    );
  });
}

// Equipment that nobody is pushing or working with, nearest to the player first.
function nearestFree(
  world: World,
  ctx: SimContext,
  slot: PlayerSlot,
  needed: string,
): EquipmentInstance | undefined {
  const player = playerIn(world, slot);
  return world.equipment
    .filter(
      (cart) =>
        cart.pushedBy === null &&
        counts(ctx, cart.equipment, needed) &&
        !world.players.some((p) => p.activity?.equipment === cart.id),
    )
    .sort(
      (a, b) =>
        distanceToBox(cartBox(a.pos, a.facing), player.pos) -
        distanceToBox(cartBox(b.pos, b.facing), player.pos),
    )[0];
}

function counts(ctx: SimContext, equipment: string, needed: string): boolean {
  return (
    equipment === needed || (ctx.content.equipment.get(equipment)?.provides ?? []).includes(needed)
  );
}

function pointBox(pos: readonly [number, number]): Box {
  return boxAround(pos, [0, 0]);
}

function facing(spot: readonly [number, number], box: Box): number {
  return Math.atan2((box.x0 + box.x1) / 2 - spot[0], (box.z0 + box.z1) / 2 - spot[1]);
}

function distance(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function length(from: readonly [number, number], path: readonly [number, number][]): number {
  let total = 0;
  let at = from;
  for (const point of path) {
    total += distance(at, point);
    at = point;
  }
  return total;
}
