import type { LevelDef, RulesFile } from '../../data';
import { secondsToTicks, ticksToSeconds } from '../clock';
import type { LevelOutcome, LevelResult, PlayerCount, SimContext, World } from '../types';

// Ends the level when the strike limit is hit (no stars), the clock runs out, or an
// untimed level has resolved all its patients (01 §3, §9).
export function endSystem(world: World, ctx: SimContext): void {
  const outcome = levelOutcome(world, ctx.level);
  if (!outcome) return;
  const seconds = ticksToSeconds(world.tick);
  const result: LevelResult = {
    outcome,
    score: world.score,
    strikes: world.strikes,
    seconds,
    stars:
      outcome === 'strikeOut'
        ? 0
        : starsFor(ctx.level, ctx.content.rules, world.playerCount, world.score, seconds),
  };
  world.status = 'ended';
  world.result = result;
  world.events.push({ type: 'levelEnded', result });
}

function levelOutcome(world: World, level: LevelDef): LevelOutcome | null {
  if (level.strikeLimit !== null && world.strikes >= level.strikeLimit) return 'strikeOut';
  if (level.lengthSeconds !== null) {
    return world.tick >= secondsToTicks(level.lengthSeconds) ? 'timeUp' : null;
  }
  const target = level.endAfterPatients;
  return target !== undefined && world.resolved >= target ? 'completed' : null;
}

// Stars from the level's one-player thresholds, scaled by player count (01 §9): points
// to reach, or in time mode seconds to beat, where 0 means "just finish".
export function starsFor(
  level: LevelDef,
  rules: RulesFile,
  playerCount: PlayerCount,
  score: number,
  seconds: number,
): 0 | 1 | 2 | 3 {
  const factor = rules.playerScaling.find((s) => s.players === playerCount)?.stars ?? 1;
  const earned = level.stars.filter((threshold) =>
    level.starMode === 'points'
      ? score >= threshold * factor
      : threshold === 0 || seconds <= threshold * factor,
  ).length;
  return earned === 0 ? 0 : earned === 1 ? 1 : earned === 2 ? 2 : 3;
}
