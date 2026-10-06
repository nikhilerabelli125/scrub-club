// Where patients are on the map, for reach checks here and for drawing in lane C.
import { bedBox, boxAround, stationBox, type Box } from './geometry';
import type { Patient, SimContext, World } from './types';

// The space a patient takes up: their bed, their seat, or where they stand on a walk.
export function patientArea(world: World, ctx: SimContext, patient: Patient): Box {
  const location = patient.location;
  if (location.kind === 'bed') {
    const bed = ctx.map.beds.find((b) => b.id === location.bed);
    if (bed) return bedBox(bed);
  }
  return boxAround(patientSpot(world, ctx, patient), [0.6, 0.6]);
}

// Where a patient who isn't lying in a bed stands or sits: a seat in the waiting room or
// at the station they were walked to, or the spot behind the player walking them there.
export function patientSpot(world: World, ctx: SimContext, patient: Patient): [number, number] {
  const location = patient.location;
  if (location.kind === 'escorted') {
    const [x, z] = location.trail[0] ?? [0, 0];
    return [x, z];
  }
  if (location.kind === 'station') {
    const station = ctx.map.stations.find((s) => s.id === location.station);
    const here = world.patients.filter(
      (p) => p.location.kind === 'station' && p.location.station === location.station,
    );
    if (station) return seat(stationBox(station), indexIn(here, patient));
  }
  return waitingSpot(world, ctx, patient);
}

// Waiting patients sit in the waiting room in arrival order, or in a row beside the
// first entrance on maps without one.
export function waitingSpot(world: World, ctx: SimContext, patient: Patient): [number, number] {
  const waiting = world.patients.filter((p) => p.location.kind === 'waiting');
  const index = indexIn(waiting, patient);
  const room = ctx.map.stations.find((s) => s.type === 'station.waiting-chairs');
  if (!room) {
    const [x, z] = ctx.map.entrances[0]?.pos ?? [1, 1];
    return [x + 1 + index * 0.8, z];
  }
  return seat(stationBox(room), index);
}

// Seats are a 1 m grid inside a seating station. The row nearest the camera, which faces
// the open floor, fills first, so players can reach everyone there.
function seat(box: Box, index: number): [number, number] {
  const columns = Math.max(1, Math.floor(box.x1 - box.x0));
  const rows = Math.max(1, Math.floor(box.z1 - box.z0));
  const row = Math.min(rows - 1, Math.floor(index / columns));
  return [box.x0 + 0.5 + (index % columns), box.z1 - 0.5 - row];
}

function indexIn(patients: readonly Patient[], patient: Patient): number {
  return Math.max(
    0,
    patients.findIndex((p) => p.id === patient.id),
  );
}
