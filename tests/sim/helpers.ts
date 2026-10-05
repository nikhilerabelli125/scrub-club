import { fileURLToPath } from 'node:url';
import { loadContent, type Content } from '../../src/data';
import {
  availableTasks,
  createContext,
  createWorld,
  stepWorld,
  type PlayerCount,
  type SimCommand,
  type SimContext,
  type SimEvent,
  type TickInput,
  type World,
} from '../../src/sim';
import { loadDataDir } from '../../tools/load-data';

let cached: Content | undefined;

// The real data/ folder, validated and indexed, loaded once per test file.
export function content(): Content {
  if (cached) return cached;
  const { files, issues } = loadDataDir(fileURLToPath(new URL('../../data/', import.meta.url)));
  const result = loadContent(files);
  if (issues.length > 0 || !result.ok) {
    const problems = result.ok ? issues : [...issues, ...result.issues];
    throw new Error(problems.map((i) => `${i.file} ${i.at}: ${i.message}`).join('\n'));
  }
  cached = result.content;
  return cached;
}

export function startLevel(
  levelId: string,
  options: { seed?: number; playerCount?: PlayerCount } = {},
): { ctx: SimContext; world: World } {
  const ctx = createContext(content(), levelId);
  const world = createWorld(ctx, {
    seed: options.seed ?? 1,
    playerCount: options.playerCount ?? 2,
  });
  return { ctx, world };
}

export const IDLE: TickInput = { players: [] };

export function commands(...list: SimCommand[]): TickInput {
  return { players: [], commands: list };
}

export interface Logged {
  tick: number;
  event: SimEvent;
}

// Steps up to `ticks` times (stopping early if the level ends) and logs every event.
export function run(
  world: World,
  ctx: SimContext,
  ticks: number,
  inputFor: (world: World) => TickInput = () => IDLE,
): Logged[] {
  const log: Logged[] = [];
  for (let i = 0; i < ticks && world.status === 'running'; i++) {
    stepWorld(world, ctx, inputFor(world));
    for (const event of world.events) log.push({ tick: world.tick, event });
  }
  return log;
}

export function eventsOf<T extends SimEvent['type']>(
  log: readonly Logged[],
  type: T,
): { tick: number; event: Extract<SimEvent, { type: T }> }[] {
  return log.filter(
    (entry): entry is { tick: number; event: Extract<SimEvent, { type: T }> } =>
      entry.event.type === type,
  );
}

// A perfect, instant team: each tick, complete every task each patient can start.
export function treatEveryone(world: World): TickInput {
  return {
    players: [],
    commands: world.patients.flatMap((patient) =>
      availableTasks(patient).map((task): SimCommand => ({
        type: 'completeTask',
        patient: patient.id,
        task: task.task,
      })),
    ),
  };
}
