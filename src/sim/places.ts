// Where patients are on the map, for reach checks here and for drawing in lane C.
import { bedBox, boxAround, stationBox, type Box } from './geometry';
import type { Patient, SimContext, World } from './types';

// The space a patient takes up: their bed, or their seat in the waiting room.
export function patientArea(world: World, ctx: SimContext, patient: Patient): Box {
  const location = patient.location;
  if (location.kind === 'bed') {
    const bed = ctx.map.beds.find((b) => b.id === location.bed);
    if (bed) return bedBox(bed);
  }
  return boxAround(waitingSpot(world, ctx, patient), [0.6, 0.6]);
}

// Waiting patients sit in a grid inside the waiting-room station, in arrival order, or in
// a row beside the first entrance on maps without a waiting room.
export function waitingSpot(world: World, ctx: SimContext, patient: Patient): [number, number] {
  const waiting = world.patients.filter((p) => p.location.kind === 'waiting');
  const index = Math.max(
    0,
    waiting.findIndex((p) => p.id === patient.id),
  );
  const room = ctx.map.stations.find((s) => s.type === 'station.waiting-chairs');
  if (!room) {
    const [x, z] = ctx.map.entrances[0]?.pos ?? [1, 1];
    return [x + 1 + index * 0.8, z];
  }
  const box = stationBox(room);
  const columns = Math.max(1, Math.floor(box.x1 - box.x0));
  const column = index % columns;
  const row = Math.floor(index / columns);
  return [box.x0 + 0.5 + column, Math.min(box.z1 - 0.5, box.z0 + 0.5 + row)];
}
