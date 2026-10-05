import { secondsToTicks } from '../sim/clock';
import type { MinigameInput, MinigameStatus, TapWaitState } from './types';

// Press Use once; the bar then drains by itself while the player is locked in place
// (docs/03 §2).
export function startTapWait(seconds: number): TapWaitState {
  return {
    kind: 'tapWait',
    started: false,
    progressTicks: 0,
    totalTicks: Math.max(1, secondsToTicks(seconds)),
  };
}

export function stepTapWait(state: TapWaitState, input: MinigameInput): MinigameStatus {
  if (!state.started) {
    if (input.use !== 'pressed') return 'running';
    state.started = true;
  }
  state.progressTicks += 1;
  return state.progressTicks >= state.totalTicks ? 'done' : 'running';
}
