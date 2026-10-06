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
export function wallBox({ from, to }: MapDef['walls'][number]): Box {
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

// Wheeled equipment (vitals cart, EKG machine) is about 0.8 m wide and 0.6 m deep.
export const CART_SIZE: Point = [0.8, 0.6];

export function cartBox(pos: Point, facing: number): Box {
  // Facing along x turns the cart sideways.
  const sideways = Math.abs(Math.sin(facing)) > Math.SQRT1_2;
  return boxAround(pos, CART_SIZE, sideways ? 90 : 0);
}

export function distanceToBox(box: Box, [x, z]: Point): number {
  const dx = Math.max(box.x0 - x, 0, x - box.x1);
  const dz = Math.max(box.z0 - z, 0, z - box.z1);
  return Math.hypot(dx, dz);
}

// The nearest spot to `pos` where a circle fits clear of every box and inside the map.
// Pushing out of one box can push into another, so when that fails it searches rings
// around `pos` (in a fixed order, so replays match).
export function freeSpotNear(
  pos: Point,
  radius: number,
  boxes: readonly Box[],
  size: Point,
): [number, number] {
  const fits = (spot: Point) => boxes.every((box) => distanceToBox(box, spot) >= radius - 1e-9);
  const pushed = resolveCircle(pos, radius, boxes, size);
  if (fits(pushed)) return pushed;
  for (let ring = 1; ring <= 8; ring++) {
    for (let step = 0; step < 16; step++) {
      const angle = (step / 16) * Math.PI * 2;
      const spot: [number, number] = [
        clamp(pos[0] + Math.sin(angle) * ring * 0.25, radius, size[0] - radius),
        clamp(pos[1] + Math.cos(angle) * ring * 0.25, radius, size[1] - radius),
      ];
      if (fits(spot)) return spot;
    }
  }
  return pushed;
}

// How far a ray from `origin` along the unit vector `dir` travels before entering one of
// the boxes, up to `max`. Boxes the ray starts inside don't count.
export function rayDistance(origin: Point, dir: Point, max: number, boxes: readonly Box[]): number {
  let nearest = max;
  for (const box of boxes) {
    let enter = 0;
    let exit = nearest;
    for (const [o, d, lo, hi] of [
      [origin[0], dir[0], box.x0, box.x1],
      [origin[1], dir[1], box.z0, box.z1],
    ] as const) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) exit = -1;
        continue;
      }
      const a = (lo - o) / d;
      const b = (hi - o) / d;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    if (enter <= exit && enter > 0) nearest = Math.min(nearest, enter);
  }
  return nearest;
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
