// Finding out what's wrong (01 §4.1, issue #19). A new patient is a question mark until
// someone asks questions: then their complaint, acuity color, and timer show. Patients
// plainly in trouble (they need a shot before they can talk, arrive in a code, or come
// for something with no triage) are known at once. A hidden condition shows its milder
// cover story until its revealing tasks are done (01 §4.4).
import type { Acuity, ConditionDef } from '../../data';
import type { Knowledge, Patient, SimContext, World } from '../types';

export function knownOnArrival(condition: ConditionDef): Knowledge {
  const plain =
    condition.arrivesInCode !== undefined ||
    !condition.baseTasks ||
    condition.tasks.some((ref) => ref.before === 'base');
  if (!plain) return 'nothing';
  return condition.hidden ? 'complaint' : 'all';
}

// Called after each completed task: asking questions reveals the complaint, and a hidden
// condition's revealing tasks reveal the real problem.
export function learn(world: World, ctx: SimContext, patient: Patient, taskId: string): void {
  const condition = ctx.content.conditions.get(patient.condition);
  if (!condition) return;
  let known = patient.known;
  if (known === 'nothing' && ctx.content.tasks.get(taskId)?.reveals === true) {
    known = condition.hidden ? 'complaint' : 'all';
  }
  const hidden = condition.hidden;
  if (known !== 'all' && hidden) {
    const done = (task: string) =>
      patient.tasks.every((entry) => entry.task !== task || entry.remaining === 0);
    if (hidden.revealedBy.every(done)) known = 'all';
  }
  if (known === patient.known) return;
  patient.known = known;
  world.events.push({ type: 'patientRevealed', patient: patient.id, known });
}

// The acuity the team believes the patient has, or null before anyone has asked.
export function shownAcuity(ctx: SimContext, patient: Patient): Acuity | null {
  if (patient.known === 'nothing') return null;
  if (patient.known === 'all') return patient.acuity;
  return ctx.content.conditions.get(patient.condition)?.hidden?.showsAs.acuity ?? patient.acuity;
}
