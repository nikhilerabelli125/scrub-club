// What the overlay shows, worked out from sim state. Pure (no DOM), so it's unit tested
// and the DOM code in overlay.ts only has to draw it.
import type { Acuity } from '../data';
import {
  availableTasks,
  starsFor,
  ticksToSeconds,
  type Patient,
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

export type ChipState = 'done' | 'ready' | 'later';

export interface TicketModel {
  patient: number;
  label: string;
  acuity: Acuity;
  bed: string | null;
  patience: number; // 0 to 1
  chips: { label: string; state: ChipState; repeats: number }[];
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
    .map((patient) => ticketFor(patient, ctx));
}

function ticketFor(patient: Patient, ctx: SimContext): TicketModel {
  const condition = ctx.content.conditions.get(patient.condition);
  const shown = condition?.hidden?.showsAs ?? condition;
  const ready = new Set(availableTasks(patient));
  return {
    patient: patient.id,
    label: shown?.label ?? patient.condition,
    acuity: shown?.acuity ?? patient.acuity,
    bed: patient.location.kind === 'bed' ? bedName(patient.location.bed) : null,
    patience: patient.patienceMaxTicks > 0 ? patient.patienceTicks / patient.patienceMaxTicks : 0,
    chips: patient.tasks.map((entry) => ({
      label: ctx.content.tasks.get(entry.task)?.label ?? entry.task,
      state: entry.remaining === 0 ? 'done' : ready.has(entry) ? 'ready' : 'later',
      repeats: entry.remaining,
    })),
  };
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
    const steps = Math.max(1, task.steps.length);
    const step = entry.step;
    const within = step ? step.progressTicks / step.totalTicks : 0;
    return [
      {
        slot: player.slot,
        label: task.label,
        progress: Math.min(1, (entry.stepIndex + within) / steps),
        waitingForPress: step?.kind === 'tapWait' && !step.started,
      },
    ];
  });
}
