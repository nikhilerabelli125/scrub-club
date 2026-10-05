import * as THREE from 'three';
import type { MapDef } from '../data';

// The fixed camera (docs/06 §5): 32° field of view, tilted 55° down, the whole map
// always on screen whatever the window's shape. Values come from the style lab.
const FOV = 32;
const ELEVATION = THREE.MathUtils.degToRad(55);
// Tall enough that a character standing on the far edge stays fully in frame.
const HEADROOM = 2;
const MARGIN = 0.96; // of the screen's half-width and half-height

export function createFixedCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
}

// Aims the camera at the middle of the map from the closest distance at which every
// corner of the floor, plus headroom, lands on screen. Checking corners matters because
// the near edge looks wider than the middle of the map.
export function fitFixedCamera(camera: THREE.PerspectiveCamera, map: MapDef, aspect: number): void {
  const [width, depth] = map.size;
  const target = new THREE.Vector3(width / 2, 0, depth / 2);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  const corners: THREE.Vector3[] = [];
  for (const x of [0, width]) {
    for (const z of [0, depth]) {
      corners.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, HEADROOM, z));
    }
  }
  const onScreen = new THREE.Vector3();
  const place = (distance: number) => {
    camera.position.set(
      target.x,
      Math.sin(ELEVATION) * distance,
      target.z + Math.cos(ELEVATION) * distance,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };
  const fits = (distance: number) => {
    place(distance);
    return corners.every((corner) => {
      onScreen.copy(corner).project(camera);
      return Math.abs(onScreen.x) <= MARGIN && Math.abs(onScreen.y) <= MARGIN;
    });
  };

  let near = 1;
  let far = 500;
  for (let step = 0; step < 30; step++) {
    const middle = (near + far) / 2;
    if (fits(middle)) far = middle;
    else near = middle;
  }
  place(far);
}
