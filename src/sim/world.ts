import type { Content } from '../data';
import { secondsToTicks } from './clock';
import { buildColliders } from './geometry';
import { createRng, jitter } from './rng';
import type { Player, PlayerCount, PlayerSlot, SimContext, World } from './types';

export function createContext(content: Content, levelId: string): SimContext {
  const level = content.levels.get(levelId);
  if (!level) throw new Error(`unknown level "${levelId}"`);
  const map = content.maps.get(level.map);
  if (!map) throw new Error(`level "${levelId}" uses unknown map "${level.map}"`);
  const reservedBeds = level.events.flatMap((event) =>
    event.type === 'spawn' && event.bed ? [event.bed] : [],
  );
  return { content, level, map, colliders: buildColliders(map), reservedBeds };
}

export interface WorldOptions {
  seed: number;
  playerCount: PlayerCount;
}

const SLOTS: readonly PlayerSlot[] = [1, 2, 3, 4];

export function createWorld(ctx: SimContext, { seed, playerCount }: WorldOptions): World {
  const rng = createRng(seed);
  // Roll every scripted event's jitter up front, in data order, so event timing
  // depends only on the seed and never on what players do.
  const scheduled = ctx.level.events.map((event, index) => ({
    index,
    atTick: secondsToTicks(Math.max(0, jitter(rng, event.at, event.jitter ?? 0))),
    done: false,
  }));
  const players = SLOTS.slice(0, playerCount).map((slot, i): Player => {
    const spawn = ctx.map.spawns[i];
    if (!spawn) throw new Error(`map "${ctx.map.id}" has no spawn point for player ${slot}`);
    return {
      slot,
      pos: [spawn[0], spawn[1]],
      facing: 0,
      holding: null,
      activity: null,
      walkAwayTicks: 0,
    };
  });

  return {
    level: ctx.level.id,
    seed,
    playerCount,
    tick: 0,
    rng,
    status: 'running',
    result: null,
    score: 0,
    strikes: 0,
    resolved: 0,
    nextPatientId: 1,
    patients: [],
    beds: ctx.map.beds.map((bed) => ({ id: bed.id, patient: null })),
    players,
    items: [],
    nextItemId: 1,
    spawn: { timerTicks: 0, sequenceIndex: 0 },
    scheduled,
    events: [],
  };
}
