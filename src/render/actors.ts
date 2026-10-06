import * as THREE from 'three';
import type { Point, PlayerSlot, SimContext, World } from '../sim';
import { bedBox, CART_SIZE, patientSpot, stationBox } from '../sim';
import { PLAYER_COLORS } from '../ui/model';
import { EQUIPMENT_COLORS, stationHeight } from './greybox';
import { matte } from './materials';

// Greybox stand-ins for characters (M5 ports the style lab's procedural characters).
// Players are told apart by the ring under them and the tag above them, not their
// bodies (docs/02 §1), so both bodies share one neutral color.

// Draw order within the opaque pass: the room first, then player rings, then characters
// and items. Rings skip the depth test, so they still show when a wall hides their player
// (docs/02 §1), but characters drawn after them cover the ring's far side, so the ring
// sits under the player instead of over them.
const RING_ORDER = 1;
const CHARACTER_ORDER = 2;

const SCRUBS = '#5E7F8E';
const GOWN = '#A9C3DD';
const SKINS = ['#F2C9A5', '#E0A97E', '#C68863', '#8D5A3B', '#5C3A26', '#F5D7BE', '#B87A55'];
const ITEM_COLORS: Record<string, string> = {
  'item.med': '#E2483D',
  'item.blood-bag': '#A62B2B',
  'item.blood-tube': '#7A1F2B',
  'item.swab': '#F4F6F5',
  'item.fluid-bag': '#BFE3F5',
  'item.cast': '#F4F6F5',
  'item.splint': '#C9A15A',
  'item.oxygen-mask': '#7FD1C7',
  'item.nebulizer': '#9C7BD4',
  'item.wound-kit': '#F2A65A',
  'item.stitch-kit': '#5B6770',
  'item.stethoscope': '#26547C',
};

export interface ActorView {
  // `previous` holds each player's position one tick ago, so motion stays smooth on
  // screens faster than 60 Hz.
  sync(
    world: World,
    ctx: SimContext,
    alpha: number,
    previous: ReadonlyMap<PlayerSlot, Point>,
  ): void;
}

export function createActors(scene: THREE.Scene): ActorView {
  const players = new Map<PlayerSlot, THREE.Group>();
  const patients = new Map<
    number,
    { group: THREE.Group; lying: THREE.Group; seated: THREE.Group }
  >();
  const items = new Map<number, THREE.Mesh>();
  const itemGeometry = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const equipment = new Map<number, THREE.Group>();

  return {
    sync(world, ctx, alpha, previous) {
      for (const player of world.players) {
        let model = players.get(player.slot);
        if (!model) {
          model = playerModel(PLAYER_COLORS[player.slot]);
          scene.add(model);
          players.set(player.slot, model);
        }
        const from = previous.get(player.slot) ?? player.pos;
        model.position.set(
          from[0] + (player.pos[0] - from[0]) * alpha,
          0,
          from[1] + (player.pos[1] - from[1]) * alpha,
        );
        model.rotation.y = player.facing;
      }

      const present = new Set(world.patients.map((p) => p.id));
      for (const [id, model] of patients) {
        if (!present.has(id)) {
          scene.remove(model.group);
          patients.delete(id);
        }
      }
      for (const patient of world.patients) {
        let model = patients.get(patient.id);
        if (!model) {
          model = patientModel(SKINS[patient.id % SKINS.length] ?? SKINS[0] ?? '#E0A97E');
          scene.add(model.group);
          patients.set(patient.id, model);
        }
        const location = patient.location;
        const bed =
          location.kind === 'bed' ? ctx.map.beds.find((b) => b.id === location.bed) : undefined;
        model.lying.visible = bed !== undefined;
        // Seated in the waiting room or at a station; the same shape stands in for walking.
        model.seated.visible = bed === undefined;
        if (bed) {
          model.group.position.set(bed.pos[0], 0, bed.pos[1]);
          model.group.rotation.y = -THREE.MathUtils.degToRad(bed.rot);
        } else {
          const [x, z] = patientSpot(world, ctx, patient);
          model.group.position.set(x, 0, z);
          model.group.rotation.y = 0;
        }
      }

      for (const cart of world.equipment) {
        let model = equipment.get(cart.id);
        if (!model) {
          model = equipmentModel(EQUIPMENT_COLORS[cart.equipment] ?? '#8A9199');
          scene.add(model);
          equipment.set(cart.id, model);
        }
        // A pushed cart keeps its place in front of its pusher's smoothed position.
        const pusher = world.players.find((p) => p.slot === cart.pushedBy);
        const holder = cart.pushedBy === null ? undefined : players.get(cart.pushedBy);
        if (pusher && holder) {
          model.position.set(
            holder.position.x + cart.pos[0] - pusher.pos[0],
            0,
            holder.position.z + cart.pos[1] - pusher.pos[1],
          );
        } else {
          model.position.set(cart.pos[0], 0, cart.pos[1]);
        }
        model.rotation.y = cart.facing;
      }

      const live = new Set(world.items.map((i) => i.id));
      for (const [id, mesh] of items) {
        if (!live.has(id)) {
          scene.remove(mesh);
          items.delete(id);
        }
      }
      for (const item of world.items) {
        let mesh = items.get(item.id);
        if (!mesh) {
          mesh = new THREE.Mesh(itemGeometry, matte(ITEM_COLORS[item.item] ?? '#E8B321'));
          mesh.castShadow = true;
          mesh.renderOrder = CHARACTER_ORDER;
          scene.add(mesh);
          items.set(item.id, mesh);
        }
        const place = item.place;
        if (place.kind === 'floor') {
          // Items can rest on a counter or a bed they landed on.
          mesh.position.set(place.pos[0], restingHeight(ctx, place.pos) + 0.11, place.pos[1]);
        } else if (place.kind === 'flying') {
          // A short arc from hand height down to the floor.
          const t = place.total > 0 ? 1 - place.left / place.total : 1;
          mesh.position.set(
            place.pos[0],
            0.85 - 0.74 * t + 0.6 * Math.sin(Math.PI * t),
            place.pos[1],
          );
        } else {
          // Carried items float in front of the holder's hands.
          const holder = players.get(place.player);
          if (holder) {
            const angle = holder.rotation.y;
            mesh.position.set(
              holder.position.x + Math.sin(angle) * 0.42,
              0.85,
              holder.position.z + Math.cos(angle) * 0.42,
            );
          }
        }
      }
    },
  };
}

// The top of whatever an item lies on: a station's counter, a bed, or the floor.
function restingHeight(ctx: SimContext, pos: Point): number {
  const within = (box: { x0: number; x1: number; z0: number; z1: number }) =>
    pos[0] > box.x0 && pos[0] < box.x1 && pos[1] > box.z0 && pos[1] < box.z1;
  const station = ctx.map.stations.find((s) => within(stationBox(s)));
  if (station) return stationHeight(station.type);
  return ctx.map.beds.some((b) => within(bedBox(b))) ? 0.5 : 0;
}

function playerModel(ringColor: string): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.45, 6, 16), matte(SCRUBS));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), matte('#E0A97E'));
  head.position.y = 1.15;
  // A small visor shows which way the player faces.
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.1), matte('#2B3036'));
  visor.position.set(0, 1.18, 0.24);
  for (const mesh of [body, head, visor]) {
    mesh.castShadow = true;
    mesh.renderOrder = CHARACTER_ORDER;
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.66, 40),
    new THREE.MeshBasicMaterial({ color: ringColor, depthTest: false, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.renderOrder = RING_ORDER;
  group.add(body, head, visor, ring);
  return group;
}

// A cart on wheels with a handle on the side its pusher stands (local -z).
function equipmentModel(color: string): THREE.Group {
  const group = new THREE.Group();
  const [width, depth] = CART_SIZE;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.62, depth), matte(color));
  body.position.y = 0.45;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.8, 0.12, depth * 0.7),
    matte('#F4F6F5'),
  );
  top.position.y = 0.82;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.06, 0.06), matte('#2B3036'));
  handle.position.set(0, 0.9, -depth / 2 - 0.05);
  const wheels = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.9, 0.14, depth * 0.9),
    matte('#2B3036'),
  );
  wheels.position.y = 0.07;
  for (const mesh of [body, top, handle, wheels]) {
    mesh.castShadow = true;
    mesh.renderOrder = CHARACTER_ORDER;
  }
  group.add(body, top, handle, wheels);
  return group;
}

function patientModel(skin: string): {
  group: THREE.Group;
  lying: THREE.Group;
  seated: THREE.Group;
} {
  const group = new THREE.Group();

  // Lying in bed with the head on the pillow (toward -z before the bed's rotation).
  const lying = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.7, 6, 16), matte(GOWN));
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.68, 0.15);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), matte(skin));
  head.position.set(0, 0.78, -0.8);
  lying.add(body, head);

  // Sitting in the waiting room.
  const seated = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.35, 6, 16), matte(GOWN));
  torso.position.y = 0.6;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), matte(skin));
  face.position.y = 1.12;
  seated.add(torso, face);

  for (const mesh of [body, head, torso, face]) {
    mesh.castShadow = true;
    mesh.renderOrder = CHARACTER_ORDER;
  }
  group.add(lying, seated);
  return { group, lying, seated };
}
