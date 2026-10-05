import type { PlayerInput, PlayerSlot, TickInput } from '../types';

export function idleControls(slot: PlayerSlot): PlayerInput {
  return {
    slot,
    move: { x: 0, z: 0 },
    pickUp: 'up',
    use: 'up',
    dash: 'up',
    ability: 'up',
    swap: false,
    emote: null,
  };
}

// A player with no input this tick (an unplugged pad, a test) stands still.
export function controlsFor(input: TickInput, slot: PlayerSlot): PlayerInput {
  return input.players.find((p) => p.slot === slot) ?? idleControls(slot);
}
