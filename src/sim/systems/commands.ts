import type { SimCommand, SimContext, World } from '../types';
import { admitPatient, seatPatient } from './patients';
import { completeTask } from './tasks';

// Runs this tick's dev and test commands. Refusals become events instead of errors, so
// a bad debug click can't crash a run.
export function commandSystem(
  world: World,
  ctx: SimContext,
  commands: readonly SimCommand[],
): void {
  for (const command of commands) {
    const reason = runCommand(world, ctx, command);
    if (reason) world.events.push({ type: 'commandRejected', command, reason });
  }
}

function runCommand(world: World, ctx: SimContext, command: SimCommand): string | null {
  switch (command.type) {
    case 'spawn': {
      const arrival = { via: command.via, bed: command.bed };
      return admitPatient(world, ctx, command.condition, arrival)
        ? null
        : `unknown condition "${command.condition}"`;
    }
    case 'seat':
      return seatPatient(world, command.patient, command.bed);
    case 'completeTask':
      return completeTask(world, ctx, command.patient, command.task);
  }
}
