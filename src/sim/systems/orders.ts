// Order, wait, deliver (issue #9, docs/01 §7). A med is ordered at the computer; when it's
// ready it shoots out of a random tube station, labeled for its patient (issue #21). A lab
// sample is carried to the lab; a scan or the observation chairs wait for a result. The
// waits are when players go help someone else.
import type { TaskDef } from '../../data';
import { secondsToTicks } from '../clock';
import { canReach, stationBox } from '../geometry';
import { pickOne } from '../rng';
import type { ItemInstance, Patient, PatientTask, Player, SimContext, World } from '../types';
import { launch } from './flight';
import { discardItems } from './roster';
import { completeTask } from './tasks';

// How far a delivered med flies out of its tube.
const TUBE_SHOT = 1.2;

// Whether a task has to be ordered before it's given. Tutorials skip the waits, and in
// the field (a map without the order station, like a marathon tent) meds come straight
// from the kit, as they would under a standing order.
export function needsOrder(ctx: SimContext, task: TaskDef): boolean {
  const order = task.order;
  if (!order || ctx.level.skipWaits === true) return false;
  return ctx.map.stations.some((s) => s.type === order.at);
}

// The order hold is done: the med is prepared while the team does something else.
export function placeOrder(
  world: World,
  player: Player,
  patient: Patient,
  entry: PatientTask,
  task: TaskDef,
): void {
  entry.step = null;
  entry.stage = 'ordered';
  entry.dueTick = world.tick + secondsToTicks(task.order?.readySeconds ?? 0);
  world.events.push({
    type: 'orderPlaced',
    player: player.slot,
    patient: patient.id,
    task: task.id,
  });
}

// A task's minigame steps (or its walk) are done. A lab test's sample goes into the
// player's hands, a scan or observation starts waiting for its result, and anything else
// is complete.
export function finishSteps(
  world: World,
  ctx: SimContext,
  player: Player,
  patient: Patient,
  entry: PatientTask,
  task: TaskDef,
): void {
  entry.step = null;
  entry.stepIndex = 0;
  if (task.producesItem) {
    const sample = task.result !== undefined;
    giveItem(
      world,
      player,
      task.producesItem,
      sample ? { patient: patient.id, task: task.id } : null,
    );
    if (sample) {
      entry.stage = 'sample';
      return;
    }
  }
  if (task.result) {
    awaitResult(world, ctx, patient, entry, task);
    return;
  }
  completeTask(world, ctx, patient.id, task.id, player.slot);
}

// Hands a sample in at its task's result station (the lab), which starts the wait for the
// result. Returns false when this isn't a sample, or its station isn't within reach.
export function deliverSample(
  world: World,
  ctx: SimContext,
  player: Player,
  item: ItemInstance,
): boolean {
  const owner = item.for;
  if (!owner) return false;
  const task = ctx.content.tasks.get(owner.task);
  const patient = world.patients.find((p) => p.id === owner.patient);
  const entry = patient?.tasks.find((t) => t.task === owner.task);
  if (!task?.result || !patient || entry?.stage !== 'sample') return false;
  const { reach } = ctx.content.rules.movement;
  const resultAt = task.result.at;
  const station = ctx.map.stations.find(
    (s) => s.type === resultAt && canReach(ctx.walls, player.pos, stationBox(s), reach),
  );
  if (!station) return false;
  discardItems(world, (i) => i.id === item.id);
  world.events.push({
    type: 'sampleDelivered',
    player: player.slot,
    patient: patient.id,
    task: task.id,
    station: station.id,
  });
  awaitResult(world, ctx, patient, entry, task);
  return true;
}

// Orders being prepared become ready, and results on their way arrive, on their due tick.
export function ordersSystem(world: World, ctx: SimContext): void {
  for (const patient of [...world.patients]) {
    for (const entry of patient.tasks) {
      if (entry.stage !== 'ordered' && entry.stage !== 'result') continue;
      if (world.tick < entry.dueTick) continue;
      if (entry.stage === 'ordered') {
        entry.stage = 'ready';
        const item = ctx.content.tasks.get(entry.task)?.needsItem ?? '';
        world.events.push({ type: 'orderReady', patient: patient.id, task: entry.task, item });
        deliver(world, ctx, patient, entry);
        continue;
      }
      world.events.push({ type: 'resultArrived', patient: patient.id, task: entry.task });
      completeTask(world, ctx, patient.id, entry.task, null);
      // Their last result can finish a patient, who then leaves.
      if (!world.patients.includes(patient)) break;
    }
  }
}

// The ready med shoots out of a random delivery station (seeded, so replays match), toward
// the open floor, labeled for its patient.
function deliver(world: World, ctx: SimContext, patient: Patient, entry: PatientTask): void {
  const task = ctx.content.tasks.get(entry.task);
  const tubes = ctx.map.stations.filter((s) => s.type === task?.order?.deliveredTo);
  if (!task?.needsItem || tubes.length === 0) return;
  const tube = pickOne(world.rng, tubes);
  const box = stationBox(tube);
  const [cx, cz] = [(box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2];
  const [width, depth] = ctx.map.size;
  // Out of the side facing the middle of the map.
  const toMiddle = [width / 2 - cx, depth / 2 - cz] as const;
  const dir: [number, number] =
    Math.abs(toMiddle[0]) >= Math.abs(toMiddle[1])
      ? [Math.sign(toMiddle[0]) || 1, 0]
      : [0, Math.sign(toMiddle[1]) || 1];
  const mouth: [number, number] = [
    cx + dir[0] * ((box.x1 - box.x0) / 2 + 0.05),
    cz + dir[1] * ((box.z1 - box.z0) / 2 + 0.05),
  ];
  const item: ItemInstance = {
    id: world.nextItemId,
    item: task.needsItem,
    place: { kind: 'floor', pos: mouth },
    for: { patient: patient.id, task: task.id },
  };
  world.nextItemId += 1;
  launch(item, mouth, dir, TUBE_SHOT, null);
  world.items.push(item);
  world.events.push({
    type: 'orderDelivered',
    patient: patient.id,
    task: task.id,
    itemId: item.id,
    station: tube.id,
  });
}

function awaitResult(
  world: World,
  ctx: SimContext,
  patient: Patient,
  entry: PatientTask,
  task: TaskDef,
): void {
  const ticks = ctx.level.skipWaits === true ? 0 : secondsToTicks(task.result?.delaySeconds ?? 0);
  if (ticks === 0) {
    completeTask(world, ctx, patient.id, task.id, null);
    return;
  }
  entry.stage = 'result';
  entry.dueTick = world.tick + ticks;
}

// Into the player's free hands, or onto the floor at their feet.
function giveItem(world: World, player: Player, item: string, owner: ItemInstance['for']): void {
  const handsFree = player.holding === null && player.pushing === null;
  const instance: ItemInstance = {
    id: world.nextItemId,
    item,
    place: handsFree
      ? { kind: 'held', player: player.slot }
      : { kind: 'floor', pos: [player.pos[0], player.pos[1]] },
    for: owner,
  };
  world.nextItemId += 1;
  world.items.push(instance);
  if (handsFree) player.holding = instance.id;
}
