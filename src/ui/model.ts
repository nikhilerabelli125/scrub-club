// What the overlay shows, worked out from sim state. Pure (no DOM), so it's unit tested
// and the DOM code in overlay.ts only has to draw it.
import type { Acuity } from '../data';
import {
  availableTasks,
  needsOrder,
  starsFor,
  ticksToSeconds,
  type Patient,
  type PatientTask,
  type PlayerSlot,
  type SimContext,
  type World,
} from '../sim';

// Acuity colors from the style lab (docs/06): red, orange, yellow, green, blue.
export const ACUITY_COLORS: Record<Acuity, string> = {
  1: '#D9433B',
  2: '#EE8A2B',
  3: '#E8C21F',
  4: '#3BB273',
  5: '#3E8BD6',
};

// Player identity colors (docs/02 §1).
export const PLAYER_COLORS: Record<PlayerSlot, string> = {
  1: '#E2483D',
  2: '#2F7FE0',
  3: '#E8B321',
  4: '#3BB273',
};

// waiting: an order or result is on its way, so there's nothing to do for it yet.
export type ChipState = 'done' | 'ready' | 'later' | 'waiting';

export interface Chip {
  label: string;
  state: ChipState;
  repeats: number;
  // The next step when it isn't the bedside part: "order", "pick up", "to lab", or the
  // seconds left on a wait.
  note: string | null;
}

export interface TicketModel {
  patient: number;
  label: string;
  acuity: Acuity;
  place: string; // their bed, the waiting room, or where they're walking to
  patience: number; // 0 to 1
  chips: Chip[];
}

export interface HudModel {
  score: number;
  strikes: number;
  strikeLimit: number | null;
  stars: 0 | 1 | 2 | 3;
  clock: string;
}

export interface ActivityModel {
  slot: PlayerSlot;
  label: string;
  progress: number; // 0 to 1 across all the task's steps
  waitingForPress: boolean; // a tap-and-wait that hasn't been tapped yet
}

// One clipboard per active patient, oldest first (docs/06 §6). Hidden conditions show
// their milder complaint until reveals arrive in M2.
export function ticketModels(world: World, ctx: SimContext): TicketModel[] {
  return [...world.patients]
    .sort((a, b) => a.arrivedTick - b.arrivedTick || a.id - b.id)
    .map((patient) => ticketFor(world, patient, ctx));
}

function ticketFor(world: World, patient: Patient, ctx: SimContext): TicketModel {
  const condition = ctx.content.conditions.get(patient.condition);
  const shown = condition?.hidden?.showsAs ?? condition;
  const ready = new Set(availableTasks(patient));
  return {
    patient: patient.id,
    label: shown?.label ?? patient.condition,
    acuity: shown?.acuity ?? patient.acuity,
    place: placeName(patient, ctx),
    patience: patient.patienceMaxTicks > 0 ? patient.patienceTicks / patient.patienceMaxTicks : 0,
    chips: patient.tasks.map((entry) => chipFor(world, ctx, patient, entry, ready.has(entry))),
  };
}

function chipFor(
  world: World,
  ctx: SimContext,
  patient: Patient,
  entry: PatientTask,
  unlocked: boolean,
): Chip {
  const task = ctx.content.tasks.get(entry.task);
  const chip = (state: ChipState, note: string | null = null): Chip => ({
    label: task?.label ?? entry.task,
    state,
    repeats: entry.remaining,
    note,
  });
  if (entry.remaining === 0) return chip('done');
  if (!unlocked || !task) return chip('later');
  const seconds = `${Math.ceil(ticksToSeconds(Math.max(0, entry.dueTick - world.tick)))} s`;
  switch (entry.stage) {
    case 'ordered':
    case 'result':
      return chip('waiting', seconds);
    case 'ready': {
      const carried = world.items.some(
        (i) => i.for?.patient === patient.id && i.for.task === entry.task,
      );
      return chip('ready', carried ? null : 'pick up');
    }
    case 'sample': {
      const at = task.result ? ctx.content.stations.get(task.result.at)?.label : undefined;
      return chip('ready', at ? `to ${at.toLowerCase()}` : null);
    }
    case 'start':
      return chip('ready', needsOrder(ctx, task) ? 'order' : null);
  }
}

// How many ready orders wait at stations of this type, for its label.
export function readyAt(world: World, ctx: SimContext, stationType: string): number {
  let count = 0;
  for (const patient of world.patients) {
    for (const entry of patient.tasks) {
      const need = ctx.content.tasks.get(entry.task)?.needsItem;
      if (entry.stage !== 'ready' || !need) continue;
      if (!ctx.content.items.get(need)?.sources.includes(stationType)) continue;
      const taken = world.items.some(
        (i) => i.for?.patient === patient.id && i.for.task === entry.task,
      );
      if (!taken) count += 1;
    }
  }
  return count;
}

// Where a patient is, for their ticket.
export function placeName(patient: Patient, ctx: SimContext): string {
  const location = patient.location;
  switch (location.kind) {
    case 'bed':
      return bedName(location.bed);
    case 'waiting':
      return 'Waiting room';
    case 'escorted': {
      const type = ctx.content.tasks.get(location.task)?.station;
      const label = type === undefined ? undefined : ctx.content.stations.get(type)?.label;
      return label ? `Walking to ${label.toLowerCase()}` : 'Walking';
    }
    case 'station': {
      const station = ctx.map.stations.find((s) => s.id === location.station);
      return (station && ctx.content.stations.get(station.type)?.label) ?? location.station;
    }
  }
}

// "bay-1" reads as "Bay 1" on a ticket.
export function bedName(id: string): string {
  const words = id.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function hudModel(world: World, ctx: SimContext): HudModel {
  const elapsed = ticksToSeconds(world.tick);
  const length = ctx.level.lengthSeconds;
  return {
    score: world.score,
    strikes: world.strikes,
    strikeLimit: ctx.level.strikeLimit,
    stars: starsFor(ctx.level, ctx.content.rules, world.playerCount, world.score, elapsed),
    // Timed levels count down; untimed ones (level 1) count up.
    clock: formatClock(length === null ? elapsed : Math.max(0, length - elapsed), length !== null),
  };
}

export function formatClock(seconds: number, countingDown: boolean): string {
  const whole = countingDown ? Math.ceil(seconds) : Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// The progress panel above each working player (docs/03 §1).
export function activityModels(world: World, ctx: SimContext): ActivityModel[] {
  return world.players.flatMap((player) => {
    const activity = player.activity;
    if (!activity) return [];
    const patient = world.patients.find((p) => p.id === activity.patient);
    const entry = patient?.tasks.find((t) => t.task === activity.task);
    const task = ctx.content.tasks.get(activity.task);
    if (!entry || !task) return [];
    // Placing an order is one short hold at the computer.
    const steps = activity.ordering ? 1 : Math.max(1, task.steps.length);
    const done = activity.ordering ? 0 : entry.stepIndex;
    const step = entry.step;
    const within = step ? step.progressTicks / step.totalTicks : 0;
    return [
      {
        slot: player.slot,
        label: activity.ordering ? `Order ${task.label.toLowerCase()}` : task.label,
        progress: Math.min(1, (done + within) / steps),
        waitingForPress: step?.kind === 'tapWait' && !step.started,
      },
    ];
  });
}
