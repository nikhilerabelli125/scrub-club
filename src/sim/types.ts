// Sim state is plain, serializable data (docs/07 §3.5): no classes, functions, Maps, or
// undefined values, so a world survives a JSON round trip for saves, replays, and online
// play. Timers count whole ticks (see clock.ts).
import type { Acuity, Content, LevelDef, MapDef } from '../data';
import type { MinigameState } from '../minigames';
import type { Box } from './geometry';
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
  stepIndex: number; // which of the task's mechanic steps is next
  step: MinigameState | null; // that step's progress; a hold keeps it when its player walks away
  stage: TaskStage; // where this repeat is, beyond its minigame steps
  dueTick: number; // while 'ordered', the tick it's ready; while 'result', the tick it arrives
}

// Order, wait, deliver (issue #9). A med is ordered at the computer, prepared, then picked
// up and given; a lab sample goes to the lab; a scan or observation waits for its result.
// - start: nothing done yet (an ordered task needs ordering first)
// - ordered: being prepared; ready at dueTick
// - ready: waiting at its station to be picked up and given
// - sample: the sample is out; deliver it to the task's result station
// - result: waiting for the result; the task completes at dueTick
export type TaskStage = 'start' | 'ordered' | 'ready' | 'sample' | 'result';

export type PatientLocation =
  | { kind: 'waiting' }
  | { kind: 'bed'; bed: string }
  // Walking behind a player to a station (the escort interaction). The patient stands on
  // the oldest breadcrumb of the player's path, so they follow around corners, not
  // through walls. Their bed stays theirs until they arrive.
  | { kind: 'escorted'; by: PlayerSlot; task: string; trail: [number, number][] }
  // Delivered to a station by an escort, like the observation chairs.
  | { kind: 'station'; station: string };

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
  known: Knowledge;
  // Getting worse (01 §4.5): how many escalation stages they've entered, the tick the next
  // one starts (partial treatment pushes it back), and how long the first stage took to
  // arrive after its seeded jitter, which the timer bar measures against.
  escalation: { stage: number; dueTick: number; firstTicks: number };
}

// What the team knows about a patient (01 §4.1): nothing until someone asks questions,
// unless they're plainly in trouble; then their complaint, acuity, and timer; and for a
// hidden condition, the real problem once its revealing tasks are done (01 §4.4).
export type Knowledge = 'nothing' | 'complaint' | 'all';

export interface Bed {
  id: string;
  patient: number | null;
}

export interface Player {
  slot: PlayerSlot;
  pos: [number, number]; // meters from the map's top-left corner (x right, z toward the camera)
  facing: number; // radians; 0 faces the camera
  holding: number | null; // id of the carried item
  pushing: number | null; // id of the equipment being wheeled; hands are full either way
  // The patient this player last started a task on. Stations hand out what they need first.
  lastPatient: number | null;
  activity: Activity | null; // the task this player is working on
  walkAwayTicks: number; // how long they have pushed a direction mid-task (docs/03 §1)
}

export interface Activity {
  patient: number;
  task: string;
  equipment: number | null; // the equipment this task is using, so nobody else can
  ordering: boolean; // placing the task's order at a station, not doing it at the bedside
}

export interface ItemInstance {
  id: number;
  item: string;
  place: { kind: 'held'; player: PlayerSlot } | { kind: 'floor'; pos: [number, number] };
  // An ordered med or a lab sample belongs to one patient's task; supplies belong to nobody.
  for: { patient: number; task: string } | null;
}

// A piece of wheeled equipment (docs/01 §7): a vitals cart, the EKG machine, the crash cart.
export interface EquipmentInstance {
  id: number;
  equipment: string;
  pos: [number, number];
  facing: number; // radians, the way it was last pushed
  pushedBy: PlayerSlot | null;
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
  | {
      type: 'taskCompleted';
      patient: number;
      task: string;
      remaining: number;
      player: PlayerSlot | null; // null when a result arrived or a dev or test command did it
    }
  | { type: 'orderPlaced'; player: PlayerSlot; patient: number; task: string }
  | { type: 'orderReady'; patient: number; task: string; item: string }
  | { type: 'sampleDelivered'; player: PlayerSlot; patient: number; task: string; station: string }
  | { type: 'resultArrived'; patient: number; task: string }
  | { type: 'taskStarted'; player: PlayerSlot; patient: number; task: string }
  | {
      type: 'taskStopped';
      player: PlayerSlot;
      patient: number;
      task: string;
      progressKept: boolean;
    }
  | {
      type: 'itemPickedUp';
      player: PlayerSlot;
      itemId: number;
      item: string;
      from: 'station' | 'floor';
    }
  | {
      type: 'itemDropped';
      player: PlayerSlot;
      itemId: number;
      item: string;
      pos: [number, number];
    }
  | { type: 'itemReturned'; player: PlayerSlot; itemId: number; item: string }
  | { type: 'itemUsed'; player: PlayerSlot; itemId: number; item: string; task: string }
  | { type: 'equipmentGrabbed'; player: PlayerSlot; equipmentId: number; equipment: string }
  | {
      type: 'equipmentParked';
      player: PlayerSlot;
      equipmentId: number;
      equipment: string;
      pos: [number, number];
    }
  | { type: 'escortStarted'; player: PlayerSlot; patient: number; task: string }
  | { type: 'escortArrived'; player: PlayerSlot; patient: number; task: string; station: string }
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
  | { type: 'patientRevealed'; patient: number; known: Knowledge }
  | {
      type: 'patientEscalated';
      patient: number;
      stage: number; // 1 for the first warning
      badge: string | null;
    }
  // Neglected and taken away by another team (01 §4.7): points off and 2 strikes.
  | { type: 'patientTransferred'; patient: number; condition: string; reason: 'rescue' }
  | { type: 'scored'; points: number; reason: 'finished' | 'left' | 'rescue'; patient: number }
  | { type: 'strike'; strikes: number; reason: 'left' | 'rescue' }
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
  items: ItemInstance[];
  nextItemId: number;
  equipment: EquipmentInstance[];
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
  colliders: Box[]; // walls, stations, and beds players can't walk through
  walls: Box[]; // just the walls, which stop wheeled equipment
  reservedBeds: string[]; // beds named by scripted spawns, kept free for them
}
