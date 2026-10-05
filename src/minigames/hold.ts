import { secondsToTicks } from '../sim/clock';
import type { HoldState, MinigameInput, MinigameStatus } from './types';

// Hold Use until the bar fills. Letting go pauses, and the progress is kept (docs/03 §2).
export function startHold(seconds: number, standIn: string | null = null): HoldState {
  return {
    kind: 'hold',
    progressTicks: 0,
    totalTicks: Math.max(1, secondsToTicks(seconds)),
    standIn,
  };
}

export function stepHold(state: HoldState, input: MinigameInput): MinigameStatus {
  if (input.use === 'pressed' || input.use === 'held') state.progressTicks += 1;
  return state.progressTicks >= state.totalTicks ? 'done' : 'running';
}
