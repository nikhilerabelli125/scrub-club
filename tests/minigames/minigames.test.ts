import { describe, expect, it } from 'vitest';
import {
  keepsProgress,
  locksPlayer,
  startStandIn,
  startStep,
  stepMinigame,
} from '../../src/minigames';

describe('hold', () => {
  it('fills only while Use is down, and keeps its progress when let go', () => {
    const state = startStep({ type: 'hold', params: { seconds: 0.05 } }, 2); // 3 ticks
    const statuses = (['pressed', 'released', 'up', 'held'] as const).map((use) =>
      stepMinigame(state, { use }),
    );
    expect(statuses).toEqual(['running', 'running', 'running', 'running']);
    expect(state.progressTicks).toBe(2);
    expect(stepMinigame(state, { use: 'held' })).toBe('done');
    expect(keepsProgress(state)).toBe(true);
  });
});

describe('tap and wait', () => {
  it('starts with one fresh press, then drains by itself while locking the player', () => {
    const state = startStep({ type: 'tapWait', params: { seconds: 0.05 } }, 2);
    expect(stepMinigame(state, { use: 'held' })).toBe('running'); // a key held from before doesn't start it
    expect(locksPlayer(state)).toBe(false);
    expect(stepMinigame(state, { use: 'pressed' })).toBe('running');
    expect(locksPlayer(state)).toBe(true);
    expect(stepMinigame(state, { use: 'up' })).toBe('running');
    expect(stepMinigame(state, { use: 'up' })).toBe('done');
    expect(keepsProgress(state)).toBe(false);
  });
});

describe('stand-ins', () => {
  it("runs mechanics that aren't built yet as a short, labeled hold", () => {
    const stitches = startStep(
      { type: 'timingBar', params: { hits: 5, zoneWidth: 0.2, sweepSeconds: 0.9 } },
      2,
    );
    expect(stitches).toEqual({
      kind: 'hold',
      progressTicks: 0,
      totalTicks: 120,
      standIn: 'timingBar',
    });
    expect(startStandIn('escort', 2)).toMatchObject({ kind: 'hold', standIn: 'escort' });
  });
});
