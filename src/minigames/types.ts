import type { ButtonState } from '../sim/types';

// What a minigame sees of its player each tick.
export interface MinigameInput {
  use: ButtonState;
}

export type MinigameStatus = 'running' | 'done';

export interface HoldState {
  kind: 'hold';
  progressTicks: number;
  totalTicks: number;
  // The mechanic or interaction this hold stands in for until it's built (null for a real hold).
  standIn: string | null;
}

export interface TapWaitState {
  kind: 'tapWait';
  started: boolean;
  progressTicks: number;
  totalTicks: number;
}

export type MinigameState = HoldState | TapWaitState;
