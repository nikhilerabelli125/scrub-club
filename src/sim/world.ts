import type { Content } from '../data';
import { secondsToTicks } from './clock';
import { buildColliders, wallBox } from './geometry';
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
  return {
    content,
    level,
    map,
    colliders: buildColliders(map),
    walls: map.walls.map(wallBox),
    reservedBeds,
  };
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
      pushing: null,
      lastPatient: null,
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
    // Tools like the stethoscopes start where the map puts them.
    items: (ctx.map.items ?? []).map((placed, i) => ({
      id: i + 1,
      item: placed.item,
      place: { kind: 'floor' as const, pos: [placed.pos[0], placed.pos[1]] as [number, number] },
      for: null,
    })),
    nextItemId: (ctx.map.items ?? []).length + 1,
    // Each equipment home starts with its piece of equipment parked on it.
    equipment: ctx.map.equipmentHomes.map((home, i) => ({
      id: i + 1,
      equipment: home.equipment,
      pos: [home.pos[0], home.pos[1]],
      facing: 0,
      pushedBy: null,
    })),
    spawn: { timerTicks: 0, sequenceIndex: 0 },
    scheduled,
    events: [],
  };
}
