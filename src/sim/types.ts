// Sim state is plain, serializable data (docs/07 §3.5): no classes, functions, Maps, or
// undefined values, so a world survives a JSON round trip for saves, replays, and online
// play. Timers count whole ticks (see clock.ts).
import type { Acuity, Content, LevelDef, MapDef } from '../data';
import type { Rng } from './rng';

export type PlayerSlot = 1 | 2 | 3 | 4;
export type PlayerCount = 1 | 2 | 3 | 4;

// --- Input ---------------------------------------------------------------------------

export type ButtonState = 'up' | 'pressed' | 'held' | 'released';

// One player's input for one tick (docs/07 §5). Lane B's input code produces these.
export interface PlayerInput {
  slot: PlayerSlot;
  move: { x: number; z: number }; // normalized, length at most 1
  pickUp: ButtonState;
  use: ButtonState;
  dash: ButtonState;
  ability: ButtonState;
  swap: boolean; // solo character swap
  emote: number | null;
}

// Dev and test commands ride in the same per-tick input as players, so the debug panel
// and tests can't break "same input + same seed = same result" (docs/07 §3.4).
export type SimCommand =
  | { type: 'spawn'; condition: string; via?: string; bed?: string }
  | { type: 'seat'; patient: number; bed: string }
  | { type: 'completeTask'; patient: number; task: string };

export interface TickInput {
  players: readonly PlayerInput[];
  commands?: readonly SimCommand[];
}

// --- World ---------------------------------------------------------------------------

export interface PatientTask {
  task: string;
  remaining: number; // repeats still to do (TaskStepRef.count)
  after: string[];
  // first: given before the base tasks (01 §4.3); base: the setting's base tasks, which
  // gate everything else; main: the rest.
  phase: 'first' | 'base' | 'main';
  optional: boolean;
  params: Record<string, string>; // e.g. { drink: 'juice' }
}

export type PatientLocation = { kind: 'waiting' } | { kind: 'bed'; bed: string };

export interface Patient {
  id: number;
  condition: string;
  acuity: Acuity;
  entrance: string;
  arrivedTick: number;
  location: PatientLocation;
  patienceTicks: number;
  patienceMaxTicks: number;
  tasks: PatientTask[];
}

export interface Bed {
  id: string;
  patient: number | null;
}

export interface Player {
  slot: PlayerSlot;
  pos: [number, number]; // meters from the map's top-left corner (x right, z toward the camera)
  facing: number; // radians; 0 faces the camera
}

// A level event with its jitter already rolled. `index` points into the level's events.
export interface ScheduledEvent {
  index: number;
  atTick: number;
  done: boolean;
}

export type LevelOutcome = 'timeUp' | 'completed' | 'strikeOut';

export interface LevelResult {
  outcome: LevelOutcome;
  score: number;
  strikes: number;
  stars: 0 | 1 | 2 | 3;
  seconds: number;
}

// What happened during a tick. Render, UI, and audio read these; they never write back.
export type SimEvent =
  | {
      type: 'patientArrived';
      patient: number;
      condition: string;
      entrance: string;
      bed: string | null;
    }
  | { type: 'patientSeated'; patient: number; bed: string }
  | { type: 'taskCompleted'; patient: number; task: string; remaining: number }
  | {
      type: 'patientFinished';
      patient: number;
      condition: string;
      acuity: Acuity;
      exit: string;
      patienceTicks: number;
      patienceMaxTicks: number;
    }
  | { type: 'patientLeft'; patient: number; condition: string }
  | { type: 'scored'; points: number; reason: 'finished' | 'left'; patient: number }
  | { type: 'strike'; strikes: number; reason: 'left' }
  | { type: 'levelEnded'; result: LevelResult }
  | { type: 'commandRejected'; command: SimCommand; reason: string };

export interface World {
  level: string;
  seed: number;
  playerCount: PlayerCount;
  tick: number;
  rng: Rng;
  status: 'running' | 'ended';
  result: LevelResult | null;
  score: number;
  strikes: number;
  resolved: number; // patients finished or gone; untimed levels end on this
  nextPatientId: number;
  patients: Patient[];
  beds: Bed[];
  players: Player[];
  spawn: { timerTicks: number; sequenceIndex: number };
  scheduled: ScheduledEvent[];
  events: SimEvent[]; // this tick's events, cleared at the start of the next tick
}

// Read-only lookups for one level run. Not part of the saved state: rebuild it from the
// content and the level id.
export interface SimContext {
  content: Content;
  level: LevelDef;
  map: MapDef;
}
