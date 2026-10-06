// What the overlay shows, worked out from sim state. Pure (no DOM), so it's unit tested
// and the DOM code in overlay.ts only has to draw it.
import type { Acuity } from '../data';
import {
  availableTasks,
  needsOrder,
  secondsToTicks,
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

// A patient nobody has asked about yet (issue #19).
export const UNKNOWN_COLOR = '#9AA6A9';

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
  label: string; // "New patient" until someone asks questions, then their complaint
  acuity: Acuity | null; // null (a grey strip) until someone asks
  place: string; // their bed, the waiting room, or where they're walking to
  // 0 to 1: time left before they walk out or get worse, whichever comes first. Hidden
  // (null) until someone asks questions (issue #19).
  timer: number | null;
  // Getting worse (01 §4.5): a sign on the patient, then a badge. Both show before anyone
  // has asked, since anyone can see a patient getting worse.
  warning: 'none' | 'sign' | 'badge';
  badge: string | null;
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
  const shown = patient.known === 'all' ? condition : (condition?.hidden?.showsAs ?? condition);
  const ready = new Set(availableTasks(patient));
  const stage = condition?.escalation[patient.escalation.stage - 1];
  // Until the real problem is known, or in assess mode until triage is done, the ticket
  // only lists triage (and treat-first) tasks, so it can't give the diagnosis away.
  const triageDone = patient.tasks.every((t) => t.phase === 'main' || t.remaining === 0);
  const showAll = patient.known === 'all' && (ctx.level.ticketMode === 'full' || triageDone);
  return {
    patient: patient.id,
    label: patient.known === 'nothing' ? 'New patient' : (shown?.label ?? patient.condition),
    acuity: patient.known === 'nothing' ? null : (shown?.acuity ?? patient.acuity),
    place: placeName(patient, ctx),
    timer: patient.known === 'nothing' ? null : timerFor(world, ctx, patient),
    warning: patient.escalation.stage === 0 ? 'none' : stage?.badge ? 'badge' : 'sign',
    badge: stage?.badge ?? null,
    chips: patient.tasks
      .filter((entry) => showAll || entry.phase !== 'main')
      .map((entry) => chipFor(world, ctx, patient, entry, ready.has(entry))),
  };
}

// Time left before the next bad thing: walking out (acuity 3 to 5) or the end of their
// escalation path. Each is measured against its own full length, and the sooner one wins.
function timerFor(world: World, ctx: SimContext, patient: Patient): number {
  const clocks: { left: number; total: number }[] = [];
  if (patient.acuity >= 3 || patient.known !== 'all') {
    clocks.push({ left: patient.patienceTicks, total: patient.patienceMaxTicks });
  }
  const stages = ctx.content.conditions.get(patient.condition)?.escalation ?? [];
  const end = stages.findIndex((stage) => stage.outcome !== undefined);
  if (patient.known === 'all' && end >= patient.escalation.stage) {
    const after = (from: number) =>
      stages
        .slice(from, end + 1)
        .reduce((sum, stage) => sum + secondsToTicks(stage.afterSeconds), 0);
    const { stage, dueTick, firstTicks } = patient.escalation;
    // The first stage's length includes its seeded jitter; later ones are as written.
    clocks.push({
      left: Math.max(0, dueTick - world.tick) + after(stage + 1),
      total: firstTicks + after(1),
    });
  }
  // Past the last stage that could end badly, only patience is left to show.
  if (clocks.length === 0) {
    clocks.push({ left: patient.patienceTicks, total: patient.patienceMaxTicks });
  }
  const soonest = clocks.sort((a, b) => a.left - b.left)[0];
  if (!soonest || soonest.total <= 0) return 0;
  return Math.max(0, Math.min(1, soonest.left / soonest.total));
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
      // Delivered by tube: "pick up" until someone has it in hand.
      const held = world.items.some(
        (i) =>
          i.for?.patient === patient.id && i.for.task === entry.task && i.place.kind === 'held',
      );
      return chip('ready', held ? null : 'pick up');
    }
    case 'sample': {
      const at = task.result ? ctx.content.stations.get(task.result.at)?.label : undefined;
      return chip('ready', at ? `to ${at.toLowerCase()}` : null);
    }
    case 'start':
      return chip('ready', needsOrder(ctx, task) ? 'order' : null);
  }
}

// Where a patient is, for their ticket.
export function placeName(patient: Patient, ctx: SimContext): string {
  const where = locationName(patient, ctx);
  return patient.entrance === 'ambulance' ? `${where} · ambulance` : where;
}

function locationName(patient: Patient, ctx: SimContext): string {
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
