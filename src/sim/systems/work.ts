import type { TaskDef } from '../../data';
import { startStandIn, startStep, stepMinigame } from '../../minigames';
import type { Patient, Player, SimContext, TickInput, World } from '../types';
import { controlsFor } from './controls';
import { carriedItem, stopTask } from './interactions';
import { completeTask } from './tasks';

// Advances every player's task by one tick through its mechanic steps (docs/07 §6), and
// completes the task after the last one. Progress lives on the patient's task, so a hold
// another player walked away from picks up where it stopped.
export function workSystem(world: World, ctx: SimContext, input: TickInput): void {
  const { standInSeconds } = ctx.content.rules.interaction;
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

    const step = task.steps[entry.stepIndex];
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
    entry.stepIndex += 1;
    if (entry.stepIndex < task.steps.length) continue;
    finishTask(world, ctx, player, patient, task);
  }
}

// Uses up the carried item the task needed, frees the player, and records the task.
function finishTask(
  world: World,
  ctx: SimContext,
  player: Player,
  patient: Patient,
  task: TaskDef,
): void {
  const carried = carriedItem(world, player);
  if (task.needsItem && carried?.item === task.needsItem) {
    world.items = world.items.filter((i) => i.id !== carried.id);
    player.holding = null;
    world.events.push({
      type: 'itemUsed',
      player: player.slot,
      itemId: carried.id,
      item: carried.item,
      task: task.id,
    });
  }
  player.activity = null;
  player.walkAwayTicks = 0;
  const refused = completeTask(world, ctx, patient.id, task.id, player.slot);
  const entry = patient.tasks.find((t) => t.task === task.id);
  if (refused && entry) entry.stepIndex = 0;
}
