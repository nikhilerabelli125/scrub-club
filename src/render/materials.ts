import * as THREE from 'three';

// Soft-toy matte materials (docs/06 §1), one per color and shared by every mesh that
// uses it (docs/07 §7: reuse geometries and materials).
const cache = new Map<string, THREE.MeshStandardMaterial>();

export function matte(color: string): THREE.MeshStandardMaterial {
  let material = cache.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 });
    cache.set(color, material);
  }
  return material;
}
