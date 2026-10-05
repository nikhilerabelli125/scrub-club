import * as THREE from 'three';

// Camera and lights match reference/style-lab.html (docs/06 §5, docs/07 §7).
const CAMERA_FOV = 32;
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(55);
// Fixed-camera maps are about 24 × 16 m (docs/05 §4).
const FLOOR = { width: 24, depth: 16 };
// Tall enough that a character standing on the far edge stays fully in frame.
const HEADROOM = 2;

// M0 placeholder so the build has something to render; lane C replaces it in M1.
export function startEmptyScene(canvas: HTMLCanvasElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#DCE5E2');

  // The style lab ran on three r128's legacy light units. Since r155 the same look
  // needs those intensities multiplied by π.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f9c99, 0.62 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.74 * Math.PI);
  sun.position.set(7, 16, 9);
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR.width, FLOOR.depth),
    new THREE.MeshStandardMaterial({ color: '#CBD6D3', roughness: 0.8, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 300);

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    placeCamera(camera, fitDistance(camera));
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}

function placeCamera(camera: THREE.PerspectiveCamera, distance: number): void {
  camera.position.set(
    0,
    Math.sin(CAMERA_ELEVATION) * distance,
    Math.cos(CAMERA_ELEVATION) * distance,
  );
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}

// Closest camera distance at which every corner of the floor (plus headroom) lands on
// screen, so the whole map stays in view at any aspect ratio (docs/06 §5). Checking
// corners matters because the near edge looks wider than the middle of the map.
function fitDistance(camera: THREE.PerspectiveCamera): number {
  const corners: THREE.Vector3[] = [];
  for (const x of [-FLOOR.width / 2, FLOOR.width / 2]) {
    for (const z of [-FLOOR.depth / 2, FLOOR.depth / 2]) {
      corners.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, HEADROOM, z));
    }
  }
  const onScreen = new THREE.Vector3();
  const fits = (distance: number): boolean => {
    placeCamera(camera, distance);
    return corners.every((corner) => {
      onScreen.copy(corner).project(camera);
      return Math.abs(onScreen.x) <= 0.96 && Math.abs(onScreen.y) <= 0.96;
    });
  };

  let near = 1;
  let far = 500;
  for (let step = 0; step < 30; step++) {
    const middle = (near + far) / 2;
    if (fits(middle)) far = middle;
    else near = middle;
  }
  return far;
}
