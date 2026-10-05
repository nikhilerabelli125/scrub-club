import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFixedCamera, fitFixedCamera } from '../../src/render/camera';
import { content } from '../sim/helpers';

const SHAPES: [string, number][] = [
  ['4:3', 4 / 3],
  ['16:9', 16 / 9],
  ['a phone held upright', 9 / 19.5],
  ['an ultrawide screen', 21 / 9],
];

// The fixed camera keeps the whole map in view at any window shape (docs/06 §5).
describe('fixed camera', () => {
  for (const mapId of ['ed-main', 'cl-a']) {
    for (const [shape, aspect] of SHAPES) {
      it(`keeps all of ${mapId} on screen at ${shape}, without zooming out more than it must`, () => {
        const map = content().maps.get(mapId);
        if (!map) throw new Error(`no map ${mapId}`);
        const camera = createFixedCamera();
        fitFixedCamera(camera, map, aspect);

        const [width, depth] = map.size;
        const edges: number[] = [];
        for (const x of [0, width]) {
          for (const z of [0, depth]) {
            for (const y of [0, 2]) {
              const point = new THREE.Vector3(x, y, z).project(camera);
              expect(Math.abs(point.x)).toBeLessThanOrEqual(1);
              expect(Math.abs(point.y)).toBeLessThanOrEqual(1);
              edges.push(Math.max(Math.abs(point.x), Math.abs(point.y)));
            }
          }
        }
        expect(Math.max(...edges)).toBeGreaterThan(0.9);
      });
    }
  }
});
