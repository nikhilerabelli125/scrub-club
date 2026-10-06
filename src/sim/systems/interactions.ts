import type { TaskDef } from '../../data';
import { keepsProgress, locksPlayer } from '../../minigames';
import { secondsToTicks } from '../clock';
import { distanceToBox, stationBox, type Point } from '../geometry';
import { patientArea } from '../places';
import type {
  ItemInstance,
  Patient,
  PatientTask,
  Player,
  PlayerInput,
  SimContext,
  TickInput,
  World,
} from '../types';
import { controlsFor } from './controls';
import { equipmentAt, grabbableEquipment, grabEquipment, parkEquipment } from './equipment';
import { escorting, startEscort } from './escort';
import { availableTasks } from './tasks';

// Pick up / put down, and starting or walking away from tasks (docs/02 §4, docs/03 §1).
// Simplifications until their milestones: a player works on a patient from anywhere
// within reach of their bed (exact bed spots arrive with codes in M3). One player per
// task and per bed spot holds.
export function interactionSystem(world: World, ctx: SimContext, input: TickInput): void {
  for (const player of world.players) {
    const controls = controlsFor(input, player.slot);
    if (player.activity) checkActivity(world, ctx, player, controls);
    else if (controls.pickUp === 'pressed') pickUpOrPutDown(world, ctx, player);
    else if (controls.use === 'pressed') useHere(world, ctx, player);
  }
}

// Ends a task that can't continue (the patient left or finished) or that the player is
// walking away from. A hold keeps its progress; other minigames start over (docs/03 §1).
function checkActivity(world: World, ctx: SimContext, player: Player, controls: PlayerInput): void {
  const activity = player.activity;
  if (!activity) return;
  const patient = world.patients.find((p) => p.id === activity.patient);
  const entry = patient ? availableTasks(patient).find((t) => t.task === activity.task) : undefined;
  if (!entry) {
    stopTask(world, player, null);
    return;
  }
  const pushing = Math.hypot(controls.move.x, controls.move.z) > 0.5;
  player.walkAwayTicks = pushing ? player.walkAwayTicks + 1 : 0;
  const walkAway = secondsToTicks(ctx.content.rules.interaction.walkAwaySeconds);
  if (player.walkAwayTicks >= walkAway && !locksPlayer(entry.step)) stopTask(world, player, entry);
}

export function stopTask(world: World, player: Player, entry: PatientTask | null): void {
  const activity = player.activity;
  if (!activity) return;
  const progressKept = entry !== null && keepsProgress(entry.step);
  if (entry && !progressKept) {
    entry.step = null;
    entry.stepIndex = 0;
  }
  player.activity = null;
  player.walkAwayTicks = 0;
  world.events.push({
    type: 'taskStopped',
    player: player.slot,
    patient: activity.patient,
    task: activity.task,
    progressKept,
  });
}

// Use needs both hands, so wheeled equipment is parked first (beside the bed, if that's
// where the player is). Then it starts the best task here, or a walk to a station.
function useHere(world: World, ctx: SimContext, player: Player): void {
  if (player.pushing !== null) parkEquipment(world, ctx, player);
  const choice = findTask(world, ctx, player);
  if (!choice) return;
  const { patient, entry, task } = choice;
  player.lastPatient = patient.id;
  if (task.interaction === 'escort' && task.station) {
    startEscort(world, ctx, player, patient, entry.task);
    return;
  }
  const equipment = task.needsEquipment
    ? equipmentAt(world, ctx, task.needsEquipment, patientArea(world, ctx, patient))
    : null;
  player.activity = { patient: patient.id, task: entry.task, equipment: equipment?.id ?? null };
  player.walkAwayTicks = 0;
  world.events.push({
    type: 'taskStarted',
    player: player.slot,
    patient: patient.id,
    task: entry.task,
  });
}

interface TaskChoice {
  patient: Patient;
  entry: PatientTask;
  task: TaskDef;
}

// What Use does here. The nearest patient within reach gets the first task a player can
// do at their bedside, preferring one that uses the carried item. Failing that, a
// station within reach runs its task (an X-ray at the computer) for whoever has waited
// longest.
function findTask(world: World, ctx: SimContext, player: Player): TaskChoice | null {
  const { reach } = ctx.content.rules.movement;
  const carried = carriedItem(world, player)?.item ?? null;

  const nearby = world.patients
    .filter((patient) => patient.location.kind !== 'escorted')
    .map((patient) => ({
      patient,
      distance: distanceToBox(patientArea(world, ctx, patient), player.pos),
    }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance || a.patient.id - b.patient.id);
  for (const { patient } of nearby) {
    const choice = pickTask(world, ctx, player, patient, carried, null);
    if (choice) return choice;
  }

  for (const station of stationsInReach(ctx, player.pos, reach)) {
    for (const patient of patientsFor(world, player)) {
      const choice = pickTask(world, ctx, player, patient, carried, station.type);
      if (choice) return choice;
    }
  }
  return null;
}

function pickTask(
  world: World,
  ctx: SimContext,
  player: Player,
  patient: Patient,
  carried: string | null,
  atStation: string | null,
): TaskChoice | null {
  const candidates = availableTasks(patient).flatMap((entry): TaskChoice[] => {
    const task = ctx.content.tasks.get(entry.task);
    if (!task) return [];
    // Escorts start at the bedside and end at their station. Other interactions run as
    // stand-in holds at the bedside until built.
    const where = task.interaction ? null : (task.station ?? null);
    if (where !== atStation) return [];
    if (task.needsItem && task.needsItem !== carried) return [];
    if (task.interaction === 'escort' && task.station && escorting(world, player)) return [];
    const area = patientArea(world, ctx, patient);
    if (task.needsEquipment && !equipmentAt(world, ctx, task.needsEquipment, area)) return [];
    if (takenByOther(world, ctx, player, patient, task)) return [];
    return [{ patient, entry, task }];
  });
  const usesCarried = candidates.find(
    (choice) => carried !== null && choice.task.needsItem === carried,
  );
  return usesCarried ?? candidates[0] ?? null;
}

// One player per task, and one per bed spot (docs/03 §1).
function takenByOther(
  world: World,
  ctx: SimContext,
  player: Player,
  patient: Patient,
  task: TaskDef,
): boolean {
  return world.players.some((other) => {
    const activity = other.activity;
    if (other === player || !activity || activity.patient !== patient.id) return false;
    if (activity.task === task.id) return true;
    return task.spot !== 'any' && ctx.content.tasks.get(activity.task)?.spot === task.spot;
  });
}

// Pick up / put down. Wheeling equipment: let go of it. Carrying something: hand it back
// to a station that stocks it, or set it down in front of you. Empty-handed: take the
// nearest item on the floor or piece of equipment, or what a patient will need from a
// station that stocks it.
function pickUpOrPutDown(world: World, ctx: SimContext, player: Player): void {
  if (player.pushing !== null) {
    parkEquipment(world, ctx, player);
    return;
  }
  const { reach } = ctx.content.rules.movement;
  const carried = carriedItem(world, player);
  if (carried) {
    putDown(world, ctx, player, carried);
    return;
  }

  const onFloor = world.items
    .flatMap((item) =>
      item.place.kind === 'floor'
        ? [
            {
              item,
              distance: Math.hypot(
                item.place.pos[0] - player.pos[0],
                item.place.pos[1] - player.pos[1],
              ),
            },
          ]
        : [],
    )
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance || a.item.id - b.item.id)[0];
  const cart = grabbableEquipment(world, ctx, player)[0];
  if (cart && (!onFloor || cart.distance < onFloor.distance)) {
    grabEquipment(world, player, cart.cart);
    return;
  }
  if (onFloor) {
    onFloor.item.place = { kind: 'held', player: player.slot };
    player.holding = onFloor.item.id;
    world.events.push({
      type: 'itemPickedUp',
      player: player.slot,
      itemId: onFloor.item.id,
      item: onFloor.item.item,
      from: 'floor',
    });
    return;
  }

  for (const station of stationsInReach(ctx, player.pos, reach)) {
    const item = itemToHandOut(world, ctx, player, station.type);
    if (!item) continue;
    const instance: ItemInstance = {
      id: world.nextItemId,
      item,
      place: { kind: 'held', player: player.slot },
    };
    world.nextItemId += 1;
    world.items.push(instance);
    player.holding = instance.id;
    world.events.push({
      type: 'itemPickedUp',
      player: player.slot,
      itemId: instance.id,
      item,
      from: 'station',
    });
    return;
  }
}

function putDown(world: World, ctx: SimContext, player: Player, carried: ItemInstance): void {
  const { reach } = ctx.content.rules.movement;
  player.holding = null;
  const shelf = stationsInReach(ctx, player.pos, reach).find((s) =>
    stocks(ctx, s.type, carried.item),
  );
  if (shelf) {
    world.items = world.items.filter((i) => i.id !== carried.id);
    world.events.push({
      type: 'itemReturned',
      player: player.slot,
      itemId: carried.id,
      item: carried.item,
    });
    return;
  }
  const pos = inFront(ctx, player, 0.6);
  carried.place = { kind: 'floor', pos };
  world.events.push({
    type: 'itemDropped',
    player: player.slot,
    itemId: carried.id,
    item: carried.item,
    pos,
  });
}

// What a station hands out: an item a patient needs from it that isn't already carried
// or set down for them. Needs for tasks that can be done now come first, and among them
// the player's own patient (the last one they started a task on), then whoever has
// waited longest, so one button usually grabs the right thing. With everything covered,
// it hands out the most needed item again; with nothing needed, its first item, so
// players can stock up ahead.
function itemToHandOut(
  world: World,
  ctx: SimContext,
  player: Player,
  stationType: string,
): string | null {
  const stocked = [...ctx.content.items.values()]
    .filter((item) => item.sources.includes(stationType))
    .map((item) => item.id);
  const now: string[] = [];
  const later: string[] = [];
  for (const patient of patientsFor(world, player)) {
    const ready = new Set(availableTasks(patient));
    for (const entry of patient.tasks) {
      const need = ctx.content.tasks.get(entry.task)?.needsItem;
      if (!need || !stocked.includes(need)) continue;
      for (let i = 0; i < entry.remaining; i++) (ready.has(entry) ? now : later).push(need);
    }
  }
  const needs = [...now, ...later];
  const inPlay = new Map<string, number>();
  for (const item of world.items) inPlay.set(item.item, (inPlay.get(item.item) ?? 0) + 1);
  for (const need of needs) {
    const covered = inPlay.get(need) ?? 0;
    if (covered === 0) return need;
    inPlay.set(need, covered - 1);
  }
  return needs[0] ?? stocked[0] ?? null;
}

function stocks(ctx: SimContext, stationType: string, item: string): boolean {
  return ctx.content.items.get(item)?.sources.includes(stationType) ?? false;
}

export function carriedItem(world: World, player: Player): ItemInstance | undefined {
  return player.holding === null ? undefined : world.items.find((i) => i.id === player.holding);
}

function stationsInReach(ctx: SimContext, pos: Point, reach: number) {
  return ctx.map.stations
    .map((station) => ({ station, distance: distanceToBox(stationBox(station), pos) }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance)
    .map(({ station }) => station);
}

// The player's own patient first, then everyone else, longest waiting first.
function patientsFor(world: World, player: Player): Patient[] {
  return [...world.patients].sort(
    (a, b) =>
      Number(b.id === player.lastPatient) - Number(a.id === player.lastPatient) ||
      a.arrivedTick - b.arrivedTick ||
      a.id - b.id,
  );
}

// A spot just in front of the player, kept inside the map.
function inFront(ctx: SimContext, player: Player, distance: number): [number, number] {
  const [width, depth] = ctx.map.size;
  const x = player.pos[0] + Math.sin(player.facing) * distance;
  const z = player.pos[1] + Math.cos(player.facing) * distance;
  return [Math.max(0.3, Math.min(width - 0.3, x)), Math.max(0.3, Math.min(depth - 0.3, z))];
}
