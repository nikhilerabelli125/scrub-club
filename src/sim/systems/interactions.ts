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
import { availableTasks } from './tasks';

// Pick up / put down, and starting or walking away from tasks (docs/02 §4, docs/03 §1).
// M1 simplifications until their milestones: a player works on a patient from anywhere
// within reach of their bed (exact bed spots arrive with codes in M3), and needsEquipment
// is ignored (scarce equipment arrives in M2). One player per task and per bed spot holds.
export function interactionSystem(world: World, ctx: SimContext, input: TickInput): void {
  for (const player of world.players) {
    const controls = controlsFor(input, player.slot);
    if (player.activity) checkActivity(world, ctx, player, controls);
    else if (controls.pickUp === 'pressed') pickUpOrPutDown(world, ctx, player);
    else if (controls.use === 'pressed') startTask(world, ctx, player);
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

function startTask(world: World, ctx: SimContext, player: Player): void {
  const choice = findTask(world, ctx, player);
  if (!choice) return;
  player.activity = { patient: choice.patient.id, task: choice.entry.task };
  player.walkAwayTicks = 0;
  world.events.push({
    type: 'taskStarted',
    player: player.slot,
    patient: choice.patient.id,
    task: choice.entry.task,
  });
}

// What Use does here. The nearest patient within reach gets the first task a player can
// do at their bedside, preferring one that uses the carried item. Failing that, a
// station within reach runs its task (an X-ray at the computer) for whoever has waited
// longest.
function findTask(
  world: World,
  ctx: SimContext,
  player: Player,
): { patient: Patient; entry: PatientTask } | null {
  const { reach } = ctx.content.rules.movement;
  const carried = carriedItem(world, player)?.item ?? null;

  const nearby = world.patients
    .map((patient) => ({
      patient,
      distance: distanceToBox(patientArea(world, ctx, patient), player.pos),
    }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance || a.patient.id - b.patient.id);
  for (const { patient } of nearby) {
    const entry = pickTask(world, ctx, player, patient, carried, null);
    if (entry) return { patient, entry };
  }

  for (const station of stationsInReach(ctx, player.pos, reach)) {
    for (const patient of longestWaitingFirst(world)) {
      const entry = pickTask(world, ctx, player, patient, carried, station.type);
      if (entry) return { patient, entry };
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
): PatientTask | null {
  const candidates = availableTasks(patient).filter((entry) => {
    const task = ctx.content.tasks.get(entry.task);
    if (!task) return false;
    // Interactions (escort, carry, ...) run as stand-in holds at the bedside until built.
    const where = task.interaction ? null : (task.station ?? null);
    if (where !== atStation) return false;
    if (task.needsItem && task.needsItem !== carried) return false;
    return !takenByOther(world, ctx, player, patient, task);
  });
  const usesCarried = candidates.find(
    (entry) => carried !== null && ctx.content.tasks.get(entry.task)?.needsItem === carried,
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

// Pick up / put down. Carrying something: hand it back to a station that stocks it, or
// set it down in front of you. Empty-handed: grab the nearest item on the floor, or take
// what a patient will need from a station that stocks it.
function pickUpOrPutDown(world: World, ctx: SimContext, player: Player): void {
  const { reach } = ctx.content.rules.movement;
  const carried = carriedItem(world, player);
  if (carried) {
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
    } else {
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
    const item = itemToHandOut(world, ctx, station.type);
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

// What a station hands out: the first item a patient will need from it, longest-waiting
// patient first, so one button grabs the right thing. Otherwise the station's first item,
// so players can stock up ahead.
function itemToHandOut(world: World, ctx: SimContext, stationType: string): string | null {
  const stocked = [...ctx.content.items.values()]
    .filter((item) => item.sources.includes(stationType))
    .map((item) => item.id);
  for (const patient of longestWaitingFirst(world)) {
    for (const entry of patient.tasks) {
      const need = entry.remaining > 0 ? ctx.content.tasks.get(entry.task)?.needsItem : undefined;
      if (need && stocked.includes(need)) return need;
    }
  }
  return stocked[0] ?? null;
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

function longestWaitingFirst(world: World): Patient[] {
  return [...world.patients].sort((a, b) => a.arrivedTick - b.arrivedTick || a.id - b.id);
}

// A spot just in front of the player, kept inside the map.
function inFront(ctx: SimContext, player: Player, distance: number): [number, number] {
  const [width, depth] = ctx.map.size;
  const x = player.pos[0] + Math.sin(player.facing) * distance;
  const z = player.pos[1] + Math.cos(player.facing) * distance;
  return [Math.max(0.3, Math.min(width - 0.3, x)), Math.max(0.3, Math.min(depth - 0.3, z))];
}
