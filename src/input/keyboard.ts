import type { KeySnapshot } from './actions';

export interface KeyboardDevice {
  // Returns the keys down now and those tapped since the last read, then starts a new tick.
  read(): KeySnapshot;
  dispose(): void;
}

// Tracks the keyboard for the game loop. Game keys don't scroll the page or move focus,
// and losing window focus releases everything so no key gets stuck down.
export function createKeyboard(target: Window, gameKeys: readonly string[]): KeyboardDevice {
  const blocked = new Set(gameKeys);
  const down = new Set<string>();
  let tapped = new Set<string>();

  const onKeyDown = (event: KeyboardEvent) => {
    if (blocked.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    down.add(event.code);
    tapped.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    down.delete(event.code);
  };
  const onBlur = () => {
    down.clear();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    read() {
      const snapshot = { down: new Set(down), tapped };
      tapped = new Set();
      return snapshot;
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
