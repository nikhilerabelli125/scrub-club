// Order, wait, deliver (issue #9, docs/01 §7). A med is ordered at the computer and is
// ready to pick up after a wait; a lab sample is carried to the lab; a scan or the
// observation chairs wait for a result. The waits are when players go help someone else.
import type { TaskDef } from '../../data';
import { secondsToTicks } from '../clock';
import { distanceToBox, stationBox } from '../geometry';
import type { ItemInstance, Patient, PatientTask, Player, SimContext, World } from '../types';
import { discardItems } from './patients';
import { completeTask } from './tasks';

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
    (s) => s.type === resultAt && distanceToBox(stationBox(s), player.pos) <= reach,
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
        continue;
      }
      world.events.push({ type: 'resultArrived', patient: patient.id, task: entry.task });
      completeTask(world, ctx, patient.id, entry.task, null);
      // Their last result can finish a patient, who then leaves.
      if (!world.patients.includes(patient)) break;
    }
  }
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
