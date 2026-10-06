import { describe, expect, it } from 'vitest';
import {
  createRng,
  jitter,
  nextFloat,
  nextRange,
  pickOne,
  pickWeighted,
  type Rng,
} from '../../src/sim';

describe('seeded random numbers', () => {
  it('repeat exactly for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const first = Array.from({ length: 5 }, () => nextFloat(a));
    expect(Array.from({ length: 5 }, () => nextFloat(b))).toEqual(first);
  });

  it('differ between seeds', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it('stay in [0, 1) and average about one half', () => {
    const rng = createRng(7);
    const values = Array.from({ length: 10_000 }, () => nextFloat(rng));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.01);
  });

  it('carry on exactly where they left off after a JSON round trip', () => {
    const rng = createRng(99);
    nextFloat(rng);
    nextFloat(rng);
    const copy = JSON.parse(JSON.stringify(rng)) as Rng;
    expect(nextFloat(copy)).toBe(nextFloat(rng));
  });

  it('jitter within ±spread, and leave a zero spread alone without using a number', () => {
    const rng = createRng(5);
    for (let i = 0; i < 1000; i++) {
      const value = jitter(rng, 60, 15);
      expect(value).toBeGreaterThanOrEqual(45);
      expect(value).toBeLessThan(75);
    }
    const before = rng.state;
    expect(jitter(rng, 60, 0)).toBe(60);
    expect(rng.state).toBe(before);
    expect(nextRange(rng, 22, 30)).toBeGreaterThanOrEqual(22);
  });

  it('pick weighted items in proportion to their weights', () => {
    const rng = createRng(3);
    const items = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 2 },
      { id: 'c', weight: 5 },
    ];
    const draws = 16_000;
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < draws; i++) {
      const { id } = pickWeighted(rng, items, (item) => item.weight);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(Math.abs((counts.a ?? 0) / draws - 1 / 8)).toBeLessThan(0.01);
    expect(Math.abs((counts.b ?? 0) / draws - 2 / 8)).toBeLessThan(0.01);
    expect(Math.abs((counts.c ?? 0) / draws - 5 / 8)).toBeLessThan(0.01);
  });

  it('pick one item with every item equally likely', () => {
    const rng = createRng(11);
    const counts = new Map<string, number>();
    for (let i = 0; i < 9_000; i++) {
      const item = pickOne(rng, ['a', 'b', 'c']);
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    for (const count of counts.values()) expect(Math.abs(count / 9_000 - 1 / 3)).toBeLessThan(0.02);
    expect(() => pickOne(rng, [])).toThrow();
  });
});
