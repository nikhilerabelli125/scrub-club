// Seeded random numbers (mulberry32). The whole generator state is one 32-bit number
// kept in the world, so every random choice replays exactly from the level's seed
// (docs/07 §3.3). Never use Math.random in the sim.
export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

// Uniform in [0, 1).
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Uniform in [min, max).
export function nextRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * nextFloat(rng);
}

// `value ± spread`, for the jittered timings in the docs ("2:30 ±20 s"). A spread of 0
// returns the value without consuming a random number.
export function jitter(rng: Rng, value: number, spread: number): number {
  return spread > 0 ? nextRange(rng, value - spread, value + spread) : value;
}

// One item, each equally likely.
export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(nextFloat(rng) * items.length)];
  if (item === undefined) throw new Error('pickOne needs at least one item');
  return item;
}

export function pickWeighted<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = nextFloat(rng) * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll < 0) return item;
  }
  // Float rounding can leave a sliver of the roll past the last item.
  const last = items.at(-1);
  if (last === undefined) throw new Error('pickWeighted needs at least one item');
  return last;
}
