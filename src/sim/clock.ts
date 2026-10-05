// Fixed-step timing (docs/07 §3.2). The sim always advances in 1/60 s ticks however
// fast the screen refreshes; the host loop feeds in real frame time and runs the ticks
// it gets back. All sim timers count whole ticks, so runs replay exactly.
export const TICK_RATE = 60;
export const TICK_SECONDS = 1 / TICK_RATE;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

export function ticksToSeconds(ticks: number): number {
  return ticks / TICK_RATE;
}

// Real time the host has seen but not simulated yet. Lives in the host loop, not the world.
export interface FixedClock {
  accumulator: number;
}

export function createClock(): FixedClock {
  return { accumulator: 0 };
}

// How many ticks to run for this frame. After a long stall (a background tab, a
// breakpoint) it runs at most `maxTicks` and drops the backlog, so the game resumes
// instead of freezing while it catches up.
export function takeTicks(clock: FixedClock, elapsedSeconds: number, maxTicks = 5): number {
  clock.accumulator += Math.max(0, elapsedSeconds);
  // The epsilon absorbs float error, so 1/60 + 1/60 counts as two full ticks.
  const due = Math.floor(clock.accumulator / TICK_SECONDS + 1e-9);
  if (due > maxTicks) {
    clock.accumulator = 0;
    return maxTicks;
  }
  clock.accumulator = Math.max(0, clock.accumulator - due * TICK_SECONDS);
  return due;
}

// How far the screen is between the last tick and the next (0 to 1), for smooth motion.
export function interpolationAlpha(clock: FixedClock): number {
  return Math.min(1, clock.accumulator / TICK_SECONDS);
}
