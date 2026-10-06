import * as THREE from 'three';
import type { MapDef } from '../data';
import { bedBox, boxAround, BED_SIZE, stationBox, wallBox, type Box } from '../sim';
import { matte } from './materials';

// Greybox geometry built straight from a map file (docs/07 §7). Primitive shapes only;
// M5 swaps in real props by station type without touching the sim (CLAUDE.md rule 8).

const WALL_HEIGHT = 1; // a map can set its own per wall
// Walls along the camera-side edge stay low so they don't hide the floor behind them.
const NEAR_WALL_HEIGHT = 0.25;

// Muted rooms so characters, items, and cues pop (docs/06 color rule).
const WALL = '#E8EDEB';
const COUNTER = '#C3CFCB';
const BED = '#F4F6F5';
const PILLOW = '#D9E4EE';
const STATION_LOOK: Record<string, { height: number; color: string }> = {
  'station.waiting-chairs': { height: 0.45, color: '#A9B9C7' },
  'station.observation': { height: 0.45, color: '#A9B9C7' },
  'station.imaging': { height: 1.3, color: '#AFBDB9' },
  'station.dark-room': { height: 1.3, color: '#7C8A96' },
  'station.tube': { height: 1.5, color: '#8FB3C9' },
};
// Each kind of equipment has its own color so players spot it instantly (docs/06 §4).
// Its home spot gets a floor marker in the same color; actors.ts draws the equipment.
export const EQUIPMENT_COLORS: Record<string, string> = {
  'equipment.crash-cart': '#D9433B',
  'equipment.ekg': '#E8C21F',
  'equipment.ultrasound': '#3E8BD6',
  'equipment.vitals-cart': '#2A9D8F',
  'equipment.c-arm': '#8A9199',
  'equipment.dialysis': '#F4F6F5',
};

export function stationHeight(type: string): number {
  return STATION_LOOK[type]?.height ?? 0.95;
}

export function buildGreybox(map: MapDef): THREE.Group {
  const group = new THREE.Group();
  const [width, depth] = map.size;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), matte(map.floorColor));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(width / 2, 0, depth / 2);
  floor.receiveShadow = true;
  group.add(floor);

  const block = (box: Box, height: number, color: string, castShadow = true) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(box.x1 - box.x0, height, box.z1 - box.z0),
      matte(color),
    );
    mesh.position.set((box.x0 + box.x1) / 2, height / 2, (box.z0 + box.z1) / 2);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  for (const wall of map.walls) {
    const onNearEdge = wall.from[1] >= depth - 0.01 && wall.to[1] >= depth - 0.01;
    block(wallBox(wall), onNearEdge ? NEAR_WALL_HEIGHT : (wall.height ?? WALL_HEIGHT), WALL);
  }
  for (const station of map.stations) {
    block(
      stationBox(station),
      stationHeight(station.type),
      STATION_LOOK[station.type]?.color ?? COUNTER,
    );
  }
  for (const bed of map.beds) {
    block(bedBox(bed), 0.5, BED);
    // The pillow sits at the head end; rot 0 puts the head toward -z (docs/07 §4).
    const turn = THREE.MathUtils.degToRad(bed.rot);
    const reach = BED_SIZE[1] / 2 - 0.3;
    const pillow = block(
      boxAround(
        [bed.pos[0] - Math.sin(turn) * reach, bed.pos[1] - Math.cos(turn) * reach],
        [0.8, 0.4],
        bed.rot,
      ),
      0.12,
      PILLOW,
      false,
    );
    pillow.position.y = 0.56;
  }
  for (const home of map.equipmentHomes) {
    const marker = block(
      boxAround(home.pos, [0.9, 0.9]),
      0.02,
      EQUIPMENT_COLORS[home.equipment] ?? '#8A9199',
      false,
    );
    marker.position.y = 0.011;
  }
  return group;
}
