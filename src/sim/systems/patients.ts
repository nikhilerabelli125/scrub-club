import type { Acuity, ConditionDef } from '../../data';
import { secondsToTicks } from '../clock';
import type { Patient, PatientTask, SimContext, World } from '../types';

// Brings a patient into the level: into the waiting room, or straight into a bed when
// one is named and free (an ambulance rolling into the resus bay). Returns null for an
// unknown condition.
export function admitPatient(
  world: World,
  ctx: SimContext,
  conditionId: string,
  arrival: { via?: string; bed?: string } = {},
): Patient | null {
  const condition = ctx.content.conditions.get(conditionId);
  if (!condition) return null;
  const patience = secondsToTicks(patienceSeconds(ctx, condition));
  const bed = world.beds.find((b) => b.id === arrival.bed && b.patient === null);
  const patient: Patient = {
    id: world.nextPatientId,
    condition: condition.id,
    acuity: condition.acuity,
    entrance: arrival.via ?? ctx.map.entrances[0]?.id ?? 'entrance',
    arrivedTick: world.tick,
    location: bed ? { kind: 'bed', bed: bed.id } : { kind: 'waiting' },
    patienceTicks: patience,
    patienceMaxTicks: patience,
    tasks: buildTasks(condition, ctx.content.baseTasks.get(condition.setting) ?? []),
  };
  world.nextPatientId += 1;
  if (bed) bed.patient = patient.id;
  world.patients.push(patient);
  world.events.push({
    type: 'patientArrived',
    patient: patient.id,
    condition: condition.id,
    entrance: patient.entrance,
    bed: bed?.id ?? null,
  });
  return patient;
}

// The acuity the patient's ticket shows: a hidden condition looks as mild as its cover
// story (01 §4.4) until reveals arrive in M2.
export function shownAcuity(ctx: SimContext, patient: Patient): Acuity {
  return ctx.content.conditions.get(patient.condition)?.hidden?.showsAs.acuity ?? patient.acuity;
}

function patienceSeconds(ctx: SimContext, condition: ConditionDef): number {
  const byAcuity = ctx.content.rules.acuity.find((rule) => rule.acuity === condition.acuity);
  // validate-data guarantees an entry for every acuity, so the fallback never applies.
  return condition.patienceSeconds ?? byAcuity?.patienceSeconds ?? 60;
}

function buildTasks(condition: ConditionDef, baseTasks: readonly string[]): PatientTask[] {
  const base = condition.baseTasks
    ? baseTasks.map((task): PatientTask => ({
        task,
        remaining: 1,
        after: [],
        phase: 'base',
        optional: false,
        params: {},
        stepIndex: 0,
        step: null,
      }))
    : [];
  const rest = condition.tasks.map((ref): PatientTask => ({
    task: ref.task,
    remaining: ref.count ?? 1,
    after: [...(ref.after ?? [])],
    phase: ref.before === 'base' ? 'first' : 'main',
    optional: ref.optional ?? false,
    params: { ...ref.params },
    stepIndex: 0,
    step: null,
  }));
  return [...base, ...rest];
}

// Moves a patient into a free bed (the escort interaction will call this in M2).
// Returns why it was refused, or null when it worked.
export function seatPatient(world: World, patientId: number, bedId: string): string | null {
  const patient = world.patients.find((p) => p.id === patientId);
  if (!patient) return `no patient ${patientId}`;
  const bed = world.beds.find((b) => b.id === bedId);
  if (!bed) return `no bed "${bedId}"`;
  if (bed.patient === patient.id) return null;
  if (bed.patient !== null) return `bed "${bedId}" is taken`;
  for (const other of world.beds) if (other.patient === patient.id) other.patient = null;
  bed.patient = patient.id;
  patient.location = { kind: 'bed', bed: bed.id };
  world.events.push({ type: 'patientSeated', patient: patient.id, bed: bed.id });
  return null;
}

// Takes a patient out of the level, frees their bed, and counts them as resolved.
export function removePatient(world: World, patientId: number): void {
  world.patients = world.patients.filter((p) => p.id !== patientId);
  for (const bed of world.beds) if (bed.patient === patientId) bed.patient = null;
  world.resolved += 1;
}

// Patience drains until a patient is finished. Low-acuity patients who run out leave;
// critical patients (acuity 1 to 2) never leave (01 §4.5). They escalate instead,
// which arrives in M2, so for now they wait at zero.
export function patienceSystem(world: World): void {
  for (const patient of [...world.patients]) {
    // A patient's first tick is their arrival, so everyone gets exactly their full patience.
    if (patient.arrivedTick === world.tick) continue;
    if (patient.patienceTicks > 0) patient.patienceTicks -= 1;
    if (patient.patienceTicks > 0 || patient.acuity <= 2) continue;
    removePatient(world, patient.id);
    world.events.push({ type: 'patientLeft', patient: patient.id, condition: patient.condition });
  }
}
