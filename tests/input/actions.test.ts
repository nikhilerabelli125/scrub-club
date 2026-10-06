import { describe, expect, it } from 'vitest';
import { emptyMemory, readKeyboard, type KeySnapshot } from '../../src/input/actions';
import { KEYBOARD_LEFT, KEYBOARD_RIGHT } from '../../src/input/layouts';
import type { ButtonState } from '../../src/sim/types';

const keys = (down: string[] = [], tapped: string[] = []): KeySnapshot => ({
  down: new Set(down),
  tapped: new Set(tapped),
});

describe('keyboard input', () => {
  it('goes up, pressed, held, released, up', () => {
    let memory = emptyMemory();
    const states: ButtonState[] = [];
    for (const snapshot of [keys(), keys(['KeyE'], ['KeyE']), keys(['KeyE']), keys(), keys()]) {
      const result = readKeyboard(1, KEYBOARD_LEFT, snapshot, memory);
      states.push(result.input.use);
      memory = result.memory;
    }
    expect(states).toEqual(['up', 'pressed', 'held', 'released', 'up']);
  });

  it('counts a tap shorter than one tick as a press', () => {
    const first = readKeyboard(1, KEYBOARD_LEFT, keys([], ['KeyF']), emptyMemory());
    expect(first.input.pickUp).toBe('pressed');
    expect(readKeyboard(1, KEYBOARD_LEFT, keys(), first.memory).input.pickUp).toBe('released');
  });

  it('walks diagonally at full speed, not faster', () => {
    const { input } = readKeyboard(1, KEYBOARD_LEFT, keys(['KeyW', 'KeyD']), emptyMemory());
    expect(Math.hypot(input.move.x, input.move.z)).toBeCloseTo(1);
    expect(input.move.x).toBeGreaterThan(0);
    expect(input.move.z).toBeLessThan(0); // up the screen is away from the camera
  });

  it('cancels opposite keys', () => {
    const { input } = readKeyboard(1, KEYBOARD_LEFT, keys(['KeyA', 'KeyD']), emptyMemory());
    expect(input.move.x).toBe(0);
  });

  it('keeps two players on one keyboard apart', () => {
    const shared = keys(['KeyW', 'ArrowDown', 'KeyL'], ['KeyL']);
    const left = readKeyboard(1, KEYBOARD_LEFT, shared, emptyMemory()).input;
    const right = readKeyboard(2, KEYBOARD_RIGHT, shared, emptyMemory()).input;
    expect(left.move).toEqual({ x: 0, z: -1 });
    expect(left.use).toBe('up');
    expect(right.move).toEqual({ x: 0, z: 1 });
    expect(right.use).toBe('pressed');
  });

  it('swaps characters only on the tick Tab goes down', () => {
    expect(readKeyboard(1, KEYBOARD_LEFT, keys(['Tab'], ['Tab']), emptyMemory()).input.swap).toBe(
      true,
    );
    expect(readKeyboard(1, KEYBOARD_LEFT, keys(['Tab']), emptyMemory()).input.swap).toBe(false);
  });
});
