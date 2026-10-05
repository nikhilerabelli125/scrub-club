// Three.js rendering. Reads sim state and never changes it (docs/07 §7). Lane C.
import * as THREE from 'three';
import type { Point, PlayerSlot, SimContext, World } from '../sim';
import { createActors } from './actors';
import { createFixedCamera, fitFixedCamera } from './camera';
import { buildGreybox } from './greybox';

export { stationHeight } from './greybox';

export interface ScreenPoint {
  x: number; // CSS pixels from the canvas's left edge
  y: number; // CSS pixels from its top edge
  visible: boolean;
}

export interface View {
  render(world: World, alpha: number, previous: ReadonlyMap<PlayerSlot, Point>): void;
  // Where a point in the map (meters, y up) shows on screen, for DOM labels. A plain
  // function, so it can be handed to the overlay on its own.
  project: (x: number, y: number, z: number) => ScreenPoint;
}

export function createView(canvas: HTMLCanvasElement, ctx: SimContext): View {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#DCE5E2');
  scene.add(buildGreybox(ctx.map));

  const [width, depth] = ctx.map.size;
  const center = new THREE.Vector3(width / 2, 0, depth / 2);
  // The style lab ran on three r128's legacy light units; since r155 the same look needs
  // those intensities multiplied by π.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f9c99, 0.62 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.74 * Math.PI);
  sun.position.set(center.x + 7, 16, center.z + 9);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const reach = Math.max(width, depth) / 2 + 3;
  Object.assign(sun.shadow.camera, {
    left: -reach,
    right: reach,
    top: reach,
    bottom: -reach,
    near: 1,
    far: 60,
  });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  const camera = createFixedCamera();
  const actors = createActors(scene);

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    fitFixedCamera(camera, ctx.map, w / h);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const projected = new THREE.Vector3();
  return {
    render(world, alpha, previous) {
      actors.sync(world, ctx, alpha, previous);
      renderer.render(scene, camera);
    },
    project: (x, y, z) => {
      projected.set(x, y, z).project(camera);
      return {
        x: ((projected.x + 1) / 2) * canvas.clientWidth,
        y: ((1 - projected.y) / 2) * canvas.clientHeight,
        visible: projected.z < 1,
      };
    },
  };
}
