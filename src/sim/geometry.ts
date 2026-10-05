// Map geometry in meters: x to the right, z toward the camera, origin at the map's
// top-left corner (docs/07 §4). Boxes are axis-aligned; stations and beds may only
// turn in quarter turns.
import type { MapDef } from '../data';

export type Point = readonly [number, number];

export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

// Beds are 1.1 × 2.4 m (docs/05 §4); rot 0 puts the head toward -z.
export const BED_SIZE: Point = [1.1, 2.4];
const WALL_THICKNESS = 0.2;

export function boxAround([x, z]: Point, [width, depth]: Point, rotDegrees = 0): Box {
  const sideways = Math.round(rotDegrees / 90) % 2 !== 0;
  const halfX = (sideways ? depth : width) / 2;
  const halfZ = (sideways ? width : depth) / 2;
  return { x0: x - halfX, x1: x + halfX, z0: z - halfZ, z1: z + halfZ };
}

export function stationBox(station: MapDef['stations'][number]): Box {
  return boxAround(station.pos, station.size ?? [1, 1], station.rot ?? 0);
}

export function bedBox(bed: MapDef['beds'][number]): Box {
  return boxAround(bed.pos, BED_SIZE, bed.rot);
}

// Our maps use straight walls along the axes; a diagonal wall would block its whole
// bounding box.
function wallBox({ from, to }: MapDef['walls'][number]): Box {
  const half = WALL_THICKNESS / 2;
  return {
    x0: Math.min(from[0], to[0]) - half,
    x1: Math.max(from[0], to[0]) + half,
    z0: Math.min(from[1], to[1]) - half,
    z1: Math.max(from[1], to[1]) + half,
  };
}

// Everything players can't walk through.
export function buildColliders(map: MapDef): Box[] {
  return [...map.walls.map(wallBox), ...map.stations.map(stationBox), ...map.beds.map(bedBox)];
}

export function distanceToBox(box: Box, [x, z]: Point): number {
  const dx = Math.max(box.x0 - x, 0, x - box.x1);
  const dz = Math.max(box.z0 - z, 0, z - box.z1);
  return Math.hypot(dx, dz);
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Pushes a circle out of every box it overlaps, then keeps it inside the map. This is
// the style lab's collision; two passes settle the corners where boxes meet.
export function resolveCircle(
  pos: Point,
  radius: number,
  boxes: readonly Box[],
  [width, depth]: Point,
): [number, number] {
  let [x, z] = pos;
  for (let pass = 0; pass < 2; pass++) {
    for (const box of boxes) {
      const nearestX = clamp(x, box.x0, box.x1);
      const nearestZ = clamp(z, box.z0, box.z1);
      const dx = x - nearestX;
      const dz = z - nearestZ;
      const squared = dx * dx + dz * dz;
      if (squared >= radius * radius) continue;
      if (squared > 1e-12) {
        const distance = Math.sqrt(squared);
        x = nearestX + (dx / distance) * radius;
        z = nearestZ + (dz / distance) * radius;
      } else {
        // The center is inside the box: leave by the nearest side.
        const left = x - box.x0;
        const right = box.x1 - x;
        const top = z - box.z0;
        const bottom = box.z1 - z;
        const nearest = Math.min(left, right, top, bottom);
        if (nearest === left) x = box.x0 - radius;
        else if (nearest === right) x = box.x1 + radius;
        else if (nearest === top) z = box.z0 - radius;
        else z = box.z1 + radius;
      }
    }
  }
  return [clamp(x, radius, width - radius), clamp(z, radius, depth - radius)];
}
