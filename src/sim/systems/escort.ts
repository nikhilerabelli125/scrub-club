// The escort interaction (docs/03 §2): Use beside a patient whose next task is a walk
// (the dark room, the observation chairs) and they get up and follow you. Bring them
// within reach of the destination and they go in: the task is done (or, in the
// observation chairs, its wait starts), and their bed is free for the next patient.
import { canReach, stationBox } from '../geometry';
import { patientArea } from '../places';
import type { Patient, Player, SimContext, World } from '../types';
import { finishSteps } from './orders';

// The patient follows the player's path a step behind: breadcrumbs every CRUMB meters,
// and the patient stands on the oldest of the last TRAIL_CRUMBS.
const CRUMB = 0.15;
const TRAIL_CRUMBS = 7;

export function startEscort(
  world: World,
  ctx: SimContext,
  player: Player,
  patient: Patient,
  task: string,
): void {
  const area = patientArea(world, ctx, patient);
  // They step off the side of the bed nearest the player.
  const start: [number, number] = [
    Math.max(area.x0, Math.min(area.x1, player.pos[0])),
    Math.max(area.z0, Math.min(area.z1, player.pos[1])),
  ];
  patient.location = { kind: 'escorted', by: player.slot, task, trail: [start] };
  player.lastPatient = patient.id;
  world.events.push({ type: 'escortStarted', player: player.slot, patient: patient.id, task });
}

export function escorting(world: World, player: Player): Patient | undefined {
  return world.patients.find(
    (p) => p.location.kind === 'escorted' && p.location.by === player.slot,
  );
}

// Runs after movement: escorted patients follow their player, and arrive once the player
// reaches a station of the right type.
export function escortSystem(world: World, ctx: SimContext): void {
  const { reach } = ctx.content.rules.movement;
  for (const patient of [...world.patients]) {
    const location = patient.location;
    if (location.kind !== 'escorted') continue;
    const player = world.players.find((p) => p.slot === location.by);
    if (!player) continue;

    const last = location.trail[location.trail.length - 1];
    if (!last || Math.hypot(player.pos[0] - last[0], player.pos[1] - last[1]) >= CRUMB) {
      location.trail.push([player.pos[0], player.pos[1]]);
      if (location.trail.length > TRAIL_CRUMBS) location.trail.shift();
    }

    const destination = ctx.content.tasks.get(location.task)?.station;
    const station = ctx.map.stations.find(
      (s) => s.type === destination && canReach(ctx.walls, player.pos, stationBox(s), reach),
    );
    if (!station) continue;
    for (const bed of world.beds) if (bed.patient === patient.id) bed.patient = null;
    patient.location = { kind: 'station', station: station.id };
    world.events.push({
      type: 'escortArrived',
      player: player.slot,
      patient: patient.id,
      task: location.task,
      station: station.id,
    });
    const entry = patient.tasks.find((t) => t.task === location.task);
    const task = ctx.content.tasks.get(location.task);
    // Done, or seated to wait out the observation chairs' result.
    if (entry && task) finishSteps(world, ctx, player, patient, entry, task);
  }
}
