import { describe, expect, it } from 'vitest';
import {
  availableTasks,
  stepWorld,
  type Patient,
  type SimContext,
  type World,
} from '../../src/sim';
import { commands, startLevel } from './helpers';

function admit(condition: string): { ctx: SimContext; world: World; patient: Patient } {
  const { ctx, world } = startLevel('ed-a');
  stepWorld(world, ctx, commands({ type: 'spawn', condition }));
  const patient = world.patients.find((p) => p.id === 1);
  if (!patient) throw new Error(`${condition} did not spawn`);
  return { ctx, world, patient };
}

const startable = (patient: Patient) => availableTasks(patient).map((t) => t.task);

function complete(world: World, ctx: SimContext, ...tasks: string[]): void {
  stepWorld(
    world,
    ctx,
    commands(...tasks.map((task) => ({ type: 'completeTask' as const, patient: 1, task }))),
  );
}

describe('task order', () => {
  it('starts with the base tasks, which gate the rest, then follows `after`', () => {
    const { ctx, world, patient } = admit('ed.chest-pain');
    expect(startable(patient)).toEqual(['task.ask-questions', 'task.check-vitals']);

    complete(world, ctx, 'task.ekg');
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'commandRejected', reason: "task.ekg isn't available yet" }),
    );

    complete(world, ctx, 'task.ask-questions', 'task.check-vitals');
    expect(startable(patient)).toEqual(['task.ekg']);
    complete(world, ctx, 'task.ekg');
    expect(startable(patient)).toEqual(['task.aspirin']);
  });

  it('gives "first" tasks before the base tasks, like the allergy shot', () => {
    const { ctx, world, patient } = admit('ed.allergic-reaction');
    expect(startable(patient)).toEqual(['task.allergy-shot']);
    complete(world, ctx, 'task.allergy-shot');
    expect(startable(patient)).toEqual(['task.ask-questions', 'task.check-vitals']);
    complete(world, ctx, 'task.ask-questions', 'task.check-vitals');
    expect(startable(patient)).toEqual(['task.iv-fluids']);
  });

  it("waits for every repeat of a counted task, like the car crash's two IVs", () => {
    const { ctx, world, patient } = admit('ed.car-crash');
    expect(startable(patient)).toEqual([
      'task.intubate',
      'task.iv',
      'task.xray',
      'task.ultrasound',
    ]);
    complete(world, ctx, 'task.iv');
    expect(startable(patient)).not.toContain('task.transfusion');
    complete(world, ctx, 'task.iv');
    expect(startable(patient)).toContain('task.transfusion');
    expect(startable(patient)).not.toContain('task.iv');
  });

  it("refuses tasks that are not on the patient's list", () => {
    const { ctx, world } = admit('ed.chest-pain');
    complete(world, ctx, 'task.cast');
    expect(world.events).toContainEqual(
      expect.objectContaining({ reason: "task.cast isn't on this patient's list" }),
    );
  });
});

describe('finishing a patient', () => {
  it('pays acuity points plus the speed bonus, and the patient heads for their exit', () => {
    const { ctx, world } = admit('ed.chest-pain');
    // Each command sees the tasks the previous ones unlocked, so one tick finishes everything.
    complete(world, ctx, 'task.ask-questions', 'task.check-vitals', 'task.ekg', 'task.aspirin');
    // Acuity 2 is worth 60, plus up to 50% for patience left (all of it here).
    expect(world.events).toContainEqual({
      type: 'scored',
      points: 90,
      reason: 'finished',
      patient: 1,
    });
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'patientFinished', patient: 1, exit: 'heart-lab' }),
    );
    expect(world.patients.some((p) => p.id === 1)).toBe(false);
    expect(world.resolved).toBe(1);
  });
});
