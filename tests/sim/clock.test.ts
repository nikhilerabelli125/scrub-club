import { describe, expect, it } from 'vitest';
import {
  createClock,
  interpolationAlpha,
  secondsToTicks,
  takeTicks,
  ticksToSeconds,
  TICK_SECONDS,
} from '../../src/sim';

describe('fixed-step clock', () => {
  it('runs one tick per 1/60 s and carries leftover time to the next frame', () => {
    const clock = createClock();
    expect(takeTicks(clock, TICK_SECONDS / 2)).toBe(0);
    expect(takeTicks(clock, TICK_SECONDS / 2)).toBe(1);
    expect(takeTicks(clock, TICK_SECONDS * 3)).toBe(3);
  });

  it('reports how far the screen is between ticks, for smooth motion', () => {
    const clock = createClock();
    takeTicks(clock, TICK_SECONDS * 1.25);
    expect(interpolationAlpha(clock)).toBeCloseTo(0.25);
  });

  it('drops the backlog after a long stall instead of freezing to catch up', () => {
    const clock = createClock();
    expect(takeTicks(clock, 2)).toBe(5);
    expect(interpolationAlpha(clock)).toBe(0);
    expect(takeTicks(clock, TICK_SECONDS)).toBe(1);
  });

  it('converts between seconds and ticks', () => {
    expect(secondsToTicks(75)).toBe(4500);
    expect(ticksToSeconds(90)).toBe(1.5);
  });
});
