import { secondsToTicks } from '../clock';
import { nextRange, pickWeighted } from '../rng';
import type { SimContext, World } from '../types';
import { admitPatient } from './patients';

// Inflow spawning (docs/05): a fixed sequence or a weighted pool, one patient per
// interval (scaled by player count), with at most `maxWaiting` active patients. The
// first patient arrives at the start. At the cap the timer pauses, so a freed slot
// fills after the rest of the interval rather than instantly. Scripted spawn events
// ignore the cap, so "guaranteed" patients always arrive.
export function spawnSystem(world: World, ctx: SimContext): void {
  const spawn = ctx.level.spawn;
  if (!spawn) return;
  const sequence = spawn.sequence ?? [];
  if (sequence.length > 0 && world.spawn.sequenceIndex >= sequence.length) return;
  if (world.patients.length >= spawn.maxWaiting) return;

  world.spawn.timerTicks -= 1;
  if (world.spawn.timerTicks > 0) return;

  const condition =
    sequence.length > 0
      ? sequence[world.spawn.sequenceIndex]
      : pickWeighted(world.rng, spawn.pool, (entry) => entry.weight).condition;
  world.spawn.sequenceIndex += sequence.length > 0 ? 1 : 0;
  if (condition) admitPatient(world, ctx, condition);

  const scaling = ctx.content.rules.playerScaling.find((s) => s.players === world.playerCount);
  const [shortest, longest] = spawn.intervalSeconds;
  const seconds = nextRange(world.rng, shortest, longest) * (scaling?.spawnInterval ?? 1);
  world.spawn.timerTicks = secondsToTicks(seconds);
}
