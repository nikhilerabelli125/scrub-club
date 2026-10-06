import type { MechanicStep, TaskDef } from '../../data';
import { startStandIn, startStep, stepMinigame } from '../../minigames';
import type { Patient, PatientTask, Player, SimContext, TickInput, World } from '../types';
import { controlsFor } from './controls';
import { carriedItem, stopTask } from './interactions';
import { finishSteps, placeOrder } from './orders';
import { discardItems } from './patients';

// Advances every player's task by one tick through its mechanic steps (docs/07 §6), and
// finishes the task after the last one. Placing an order is a short hold at the order
// station. Progress lives on the patient's task, so a hold another player walked away
// from picks up where it stopped.
export function workSystem(world: World, ctx: SimContext, input: TickInput): void {
  const { standInSeconds, orderSeconds } = ctx.content.rules.interaction;
  const orderStep: MechanicStep = { type: 'hold', params: { seconds: orderSeconds } };
  for (const player of world.players) {
    const activity = player.activity;
    if (!activity) continue;
    const patient = world.patients.find((p) => p.id === activity.patient);
    const entry = patient?.tasks.find((t) => t.task === activity.task && t.remaining > 0);
    const task = ctx.content.tasks.get(activity.task);
    if (!patient || !entry || !task) {
      player.activity = null;
      continue;
    }

    const step = activity.ordering ? orderStep : task.steps[entry.stepIndex];
    entry.step ??= step
      ? startStep(step, standInSeconds)
      : startStandIn(task.interaction ?? 'interaction', standInSeconds);
    const use = controlsFor(input, player.slot).use;
    if (stepMinigame(entry.step, { use }) === 'running') {
      // Letting go of a hold pauses it and frees the player; the progress stays (docs/03 §2).
      if (entry.step.kind === 'hold' && use !== 'pressed' && use !== 'held') {
        stopTask(world, player, entry);
      }
      continue;
    }

    entry.step = null;
    if (activity.ordering) {
      endActivity(player);
      placeOrder(world, player, patient, entry, task);
      continue;
    }
    entry.stepIndex += 1;
    if (entry.stepIndex < task.steps.length) continue;
    finishTask(world, ctx, player, patient, entry, task);
  }
}

// Uses up the carried item the task needed, frees the player, and moves the task on: done,
// or a sample to take to the lab, or a result to wait for.
function finishTask(
  world: World,
  ctx: SimContext,
  player: Player,
  patient: Patient,
  entry: PatientTask,
  task: TaskDef,
): void {
  const carried = carriedItem(world, player);
  if (task.needsItem && carried?.item === task.needsItem) {
    discardItems(world, (item) => item.id === carried.id);
    world.events.push({
      type: 'itemUsed',
      player: player.slot,
      itemId: carried.id,
      item: carried.item,
      task: task.id,
    });
  }
  endActivity(player);
  finishSteps(world, ctx, player, patient, entry, task);
}

function endActivity(player: Player): void {
  player.activity = null;
  player.walkAwayTicks = 0;
}
