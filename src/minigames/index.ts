// One pure state machine per mechanic type (docs/03 §2, docs/07 §6). Same purity rules as
// src/sim/. Lane B.
//
// M1 builds hold and tapWait. Every other mechanic type, and the carry, escort, push, and
// two-person-carry interactions, runs as a short stand-in hold (rules.json
// interaction.standInSeconds) until its milestone, so every level stays playable.
import type { MechanicStep } from '../data';
import { startHold, stepHold } from './hold';
import { startTapWait, stepTapWait } from './tap-wait';
import type { MinigameInput, MinigameState, MinigameStatus } from './types';

export type {
  HoldState,
  MinigameInput,
  MinigameState,
  MinigameStatus,
  TapWaitState,
} from './types';

export function startStep(step: MechanicStep, standInSeconds: number): MinigameState {
  const seconds = step.params.seconds;
  if (step.type === 'hold' && typeof seconds === 'number') return startHold(seconds);
  if (step.type === 'tapWait' && typeof seconds === 'number') return startTapWait(seconds);
  return startHold(standInSeconds, step.type);
}

export function startStandIn(label: string, standInSeconds: number): MinigameState {
  return startHold(standInSeconds, label);
}

export function stepMinigame(state: MinigameState, input: MinigameInput): MinigameStatus {
  return state.kind === 'hold' ? stepHold(state, input) : stepTapWait(state, input);
}

// A running tap-wait roots the player in place until it finishes (docs/03 §2).
export function locksPlayer(state: MinigameState | null): boolean {
  return state?.kind === 'tapWait' && state.started;
}

// Walking away keeps a hold's progress; every other minigame starts over (docs/03 §1).
export function keepsProgress(state: MinigameState | null): boolean {
  return state?.kind === 'hold';
}
