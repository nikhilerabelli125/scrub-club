// Keyboard and gamepad devices, slot assignment, and the per-tick action stream the sim
// consumes (docs/07 §5). Lane B. Gamepads and lobby join arrive in M2.
export {
  buttonState,
  emptyMemory,
  readKeyboard,
  type ButtonMemory,
  type KeySnapshot,
} from './actions';
export { createKeyboard, type KeyboardDevice } from './keyboard';
export { KEYBOARD_LEFT, KEYBOARD_RIGHT, layoutKeys, type KeyboardLayout } from './layouts';
