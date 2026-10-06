// Patients get worse when nobody treats them (01 §4.5). Each stage starts afterSeconds
// (with seeded jitter) after the one before, the first counting from arrival, and a
// finished slowedBy task holds its clock still (partial treatment buys time). A stage
// can add tasks (a breathing tube) and can end in an outcome: leaving, a rescue transfer,
// or a code. Levels before codes are taught turn codes into rescue transfers, and so does
// every level until codes are built (M3).
import type { EscalationStage } from '../../data';
import { secondsToTicks } from '../clock';
import { jitter } from '../rng';
import type { Patient, SimContext, World } from '../types';
import { removePatient } from './roster';

// The tick a stage starts, counting from now.
export function stageDue(world: World, stage: EscalationStage): number {
  return (
    world.tick +
    secondsToTicks(Math.max(0, jitter(world.rng, stage.afterSeconds, stage.jitterSeconds ?? 0)))
  );
}

export function escalationSystem(world: World, ctx: SimContext): void {
  for (const patient of [...world.patients]) {
    const stages = ctx.content.conditions.get(patient.condition)?.escalation ?? [];
    const next = stages[patient.escalation.stage];
    if (!next) continue;
    if (slowed(patient, next)) {
      patient.escalation.dueTick += 1;
      continue;
    }
    if (world.tick < patient.escalation.dueTick) continue;

    patient.escalation.stage += 1;
    for (const ref of next.addTasks ?? []) {
      if (patient.tasks.some((entry) => entry.task === ref.task)) continue;
      patient.tasks.push({
        task: ref.task,
        remaining: ref.count ?? 1,
        after: [...(ref.after ?? [])],
        phase: 'main',
        optional: ref.optional ?? false,
        params: { ...ref.params },
        stepIndex: 0,
        step: null,
        stage: 'start',
        dueTick: 0,
      });
    }
    world.events.push({
      type: 'patientEscalated',
      patient: patient.id,
      stage: patient.escalation.stage,
      badge: next.badge ?? null,
    });
    if (next.outcome) {
      resolve(world, patient, next.outcome);
      continue;
    }
    const following = stages[patient.escalation.stage];
    if (following) patient.escalation.dueTick = stageDue(world, following);
  }
}

function slowed(patient: Patient, stage: EscalationStage): boolean {
  return (stage.slowedBy ?? []).some((task) =>
    patient.tasks.some((entry) => entry.task === task && entry.remaining === 0),
  );
}

function resolve(
  world: World,
  patient: Patient,
  outcome: NonNullable<EscalationStage['outcome']>,
): void {
  removePatient(world, patient.id);
  if (outcome === 'leave') {
    world.events.push({ type: 'patientLeft', patient: patient.id, condition: patient.condition });
    return;
  }
  world.events.push({
    type: 'patientTransferred',
    patient: patient.id,
    condition: patient.condition,
    reason: 'rescue',
  });
}
