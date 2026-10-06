// Pure game simulation on a fixed 60 Hz tick (docs/07 §3). No Three.js, DOM, or Tone.js, so it
// runs in Node tests and can later run on an online host. Lane A.
export * from './clock';
export * from './rng';
export * from './types';
export {
  BED_SIZE,
  bedBox,
  boxAround,
  CART_SIZE,
  cartBox,
  distanceToBox,
  resolveCircle,
  stationBox,
  wallBox,
  type Box,
  type Point,
} from './geometry';
export { patientArea, patientSpot, waitingSpot } from './places';
export { createContext, createWorld, type WorldOptions } from './world';
export { stepWorld } from './step';
export { idleControls } from './systems/controls';
export { availableTasks } from './systems/tasks';
export { equipmentAt } from './systems/equipment';
export { needsOrder } from './systems/orders';
export { starsFor } from './systems/end';
