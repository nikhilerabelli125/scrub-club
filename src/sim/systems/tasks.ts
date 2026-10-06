import type { Patient, PatientTask, PlayerSlot, SimContext, World } from '../types';
import { learn } from './knowledge';
import { discardItems, removePatient } from './roster';

// The tasks a player can start right now. Tasks marked "first" (like the allergy shot)
// come before the base tasks, the base tasks gate everything else (01 §4.3), and
// `after` waits for every repeat of the named tasks. The waiting room only gets triage,
// the first and base tasks; the rest of a patient's care waits for a bed (issue #10).
export function availableTasks(patient: Patient): PatientTask[] {
  const pending = (phase: PatientTask['phase']) =>
    patient.tasks.some((t) => t.phase === phase && t.remaining > 0);
  const firstPending = pending('first');
  const basePending = pending('base');
  const waiting = patient.location.kind === 'waiting';
  const done = (taskId: string) => {
    const entries = patient.tasks.filter((t) => t.task === taskId);
    return entries.length > 0 && entries.every((t) => t.remaining === 0);
  };
  return patient.tasks.filter((t) => {
    if (t.remaining === 0) return false;
    if (t.phase === 'main' && waiting) return false;
    if (t.phase === 'base' && firstPending) return false;
    if (t.phase === 'main' && (firstPending || basePending)) return false;
    return t.after.every(done);
  });
}

// Records one completion of a task, by a player's finished minigame or a dev/test
// command (`by` null). Returns why it was refused, or null when it counted.
export function completeTask(
  world: World,
  ctx: SimContext,
  patientId: number,
  taskId: string,
  by: PlayerSlot | null = null,
): string | null {
  const patient = world.patients.find((p) => p.id === patientId);
  if (!patient) return `no patient ${patientId}`;
  const entry = availableTasks(patient).find((t) => t.task === taskId);
  if (!entry) {
    return patient.tasks.some((t) => t.task === taskId)
      ? `${taskId} isn't available yet`
      : `${taskId} isn't on this patient's list`;
  }
  entry.remaining -= 1;
  // A repeated task (two IVs) starts each repeat from scratch.
  entry.stepIndex = 0;
  entry.step = null;
  entry.stage = 'start';
  entry.dueTick = 0;
  // A dev command can skip a task midway; a med or sample left over from it goes away.
  discardItems(world, (item) => item.for?.patient === patient.id && item.for.task === taskId);
  world.events.push({
    type: 'taskCompleted',
    patient: patient.id,
    task: taskId,
    remaining: entry.remaining,
    player: by,
  });
  learn(world, ctx, patient, taskId);
  if (patient.tasks.every((t) => t.optional || t.remaining === 0)) {
    finishPatient(world, ctx, patient);
  }
  return null;
}

// Every disposition mode works like `auto` (the patient walks out) until M2 adds
// signing out and transport (01 §4.7).
function finishPatient(world: World, ctx: SimContext, patient: Patient): void {
  const exit = ctx.content.conditions.get(patient.condition)?.disposition.exit ?? 'home';
  removePatient(world, patient.id);
  world.events.push({
    type: 'patientFinished',
    patient: patient.id,
    condition: patient.condition,
    acuity: patient.acuity,
    exit,
    patienceTicks: patient.patienceTicks,
    patienceMaxTicks: patient.patienceMaxTicks,
  });
}
