// Default keyboard layouts (docs/02 §4), as KeyboardEvent.code values so they work on
// any keyboard language. Remapping arrives in M7 and will be stored in the save.
export interface KeyboardLayout {
  name: string;
  up: string;
  down: string;
  left: string;
  right: string;
  pickUp: string;
  use: string;
  dash: string;
  ability: string;
  swap: string | null; // solo character swap
  emote: string | null; // optional, bound in the remap screen
}

export const KEYBOARD_LEFT: KeyboardLayout = {
  name: 'Keyboard left',
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  pickUp: 'KeyF',
  use: 'KeyG',
  dash: 'ShiftLeft',
  ability: 'KeyR',
  swap: 'Tab',
  emote: null,
};

export const KEYBOARD_RIGHT: KeyboardLayout = {
  name: 'Keyboard right',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  pickUp: 'KeyK',
  use: 'KeyL',
  dash: 'ShiftRight',
  ability: 'KeyO',
  swap: null,
  emote: null,
};

// Every key a layout uses, so the page can stop arrows from scrolling and Tab from
// moving focus while the game runs.
export function layoutKeys(layout: KeyboardLayout): string[] {
  const keys = [
    layout.up,
    layout.down,
    layout.left,
    layout.right,
    layout.pickUp,
    layout.use,
    layout.dash,
    layout.ability,
    layout.swap,
    layout.emote,
  ];
  return keys.filter((key): key is string => key !== null);
}
