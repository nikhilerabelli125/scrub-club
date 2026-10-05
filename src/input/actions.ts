// Turns raw key state into the per-tick PlayerInput the sim consumes (docs/07 §5). Pure,
// so the button logic is tested in Node; keyboard.ts feeds it from the browser.
import type { ButtonState, PlayerInput, PlayerSlot } from '../sim/types';
import type { KeyboardLayout } from './layouts';

// Keys held right now, plus every key pressed since the last tick, so a tap shorter than
// a tick still counts as a press.
export interface KeySnapshot {
  down: ReadonlySet<string>;
  tapped: ReadonlySet<string>;
}

const BUTTONS = ['pickUp', 'use', 'dash', 'ability'] as const;
type Button = (typeof BUTTONS)[number];

// Which buttons were down last tick, to tell a press from a hold.
export type ButtonMemory = Record<Button, boolean>;

export function emptyMemory(): ButtonMemory {
  return { pickUp: false, use: false, dash: false, ability: false };
}

export function buttonState(wasDown: boolean, isDown: boolean): ButtonState {
  if (isDown) return wasDown ? 'held' : 'pressed';
  return wasDown ? 'released' : 'up';
}

export function readKeyboard(
  slot: PlayerSlot,
  layout: KeyboardLayout,
  keys: KeySnapshot,
  memory: ButtonMemory,
): { input: PlayerInput; memory: ButtonMemory } {
  const isDown = (code: string) => keys.down.has(code) || keys.tapped.has(code);
  const axis = (negative: string, positive: string) =>
    (isDown(positive) ? 1 : 0) - (isDown(negative) ? 1 : 0);

  // z grows toward the camera, so "down" on screen is +z.
  let x = axis(layout.left, layout.right);
  let z = axis(layout.up, layout.down);
  const length = Math.hypot(x, z);
  if (length > 1) {
    x /= length;
    z /= length;
  }

  const next = emptyMemory();
  const states = {} as Record<Button, ButtonState>;
  for (const button of BUTTONS) {
    next[button] = isDown(layout[button]);
    states[button] = buttonState(memory[button], next[button]);
  }
  return {
    input: {
      slot,
      move: { x, z },
      ...states,
      swap: layout.swap !== null && keys.tapped.has(layout.swap),
      emote: null,
    },
    memory: next,
  };
}
