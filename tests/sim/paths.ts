import { distanceToBox, type SimContext } from '../../src/sim';

// Grid pathfinding for the walking test bot: A* over 0.2 m cells, avoiding everything a
// player's circle would bump into, then shortened to straight runs where nothing is in
// the way.
const CELL = 0.2;

type Point = [number, number];

export interface PathGrid {
  columns: number;
  rows: number;
  free: Uint8Array; // 1 where a player can stand
}

export function buildGrid(ctx: SimContext): PathGrid {
  const [width, depth] = ctx.map.size;
  const columns = Math.ceil(width / CELL);
  const rows = Math.ceil(depth / CELL);
  const free = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      free[row * columns + column] = canStand(ctx, center(column, row)) ? 1 : 0;
    }
  }
  return { columns, rows, free };
}

export function canStand(ctx: SimContext, [x, z]: Point): boolean {
  const { radius } = ctx.content.rules.movement;
  const [width, depth] = ctx.map.size;
  if (x < radius || z < radius || x > width - radius || z > depth - radius) return false;
  // A little margin, so paths don't scrape along walls.
  return ctx.colliders.every((box) => distanceToBox(box, [x, z]) >= radius + 0.02);
}

export function findPath(ctx: SimContext, grid: PathGrid, from: Point, to: Point): Point[] | null {
  const start = nearestFree(grid, cellOf(from));
  const goal = nearestFree(grid, cellOf(to));
  if (start === null || goal === null) return null;
  const { columns } = grid;
  const total = grid.columns * grid.rows;
  const cost = new Float64Array(total).fill(Infinity);
  const came = new Int32Array(total).fill(-1);
  const open = new Heap();
  cost[start] = 0;
  open.push(start, estimate(start, goal, columns));
  const closed = new Uint8Array(total);
  while (open.size > 0) {
    const current = open.pop();
    if (current === goal) break;
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % columns;
    const cz = Math.floor(current / columns);
    for (const [dx, dz] of STEPS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= columns || nz >= grid.rows) continue;
      const next = nz * columns + nx;
      if (!grid.free[next]) continue;
      // No cutting corners past a wall.
      if (dx !== 0 && dz !== 0 && (!grid.free[cz * columns + nx] || !grid.free[nz * columns + cx]))
        continue;
      const step = dx !== 0 && dz !== 0 ? Math.SQRT2 : 1;
      const candidate = (cost[current] ?? Infinity) + step;
      if (candidate >= (cost[next] ?? Infinity)) continue;
      cost[next] = candidate;
      came[next] = current;
      open.push(next, candidate + estimate(next, goal, columns));
    }
  }
  if (start !== goal && came[goal] === -1) return null;
  const cells: number[] = [];
  for (let at = goal; at !== -1 && at !== start; at = came[at] ?? -1) cells.push(at);
  const path = cells.reverse().map((cell) => center(cell % columns, Math.floor(cell / columns)));
  path.push([to[0], to[1]]);
  return shorten(ctx, from, path);
}

// Skips waypoints whenever the straight line to a later one is clear.
function shorten(ctx: SimContext, from: Point, path: Point[]): Point[] {
  const result: Point[] = [];
  let at = from;
  let i = 0;
  while (i < path.length) {
    let far = i;
    for (let j = path.length - 1; j > i; j--) {
      const target = path[j];
      if (target && clearLine(ctx, at, target)) {
        far = j;
        break;
      }
    }
    const next = path[far];
    if (!next) break;
    result.push(next);
    at = next;
    i = far + 1;
  }
  return result;
}

function clearLine(ctx: SimContext, a: Point, b: Point): boolean {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const samples = Math.max(1, Math.ceil(length / 0.1));
  for (let k = 1; k <= samples; k++) {
    const t = k / samples;
    if (!canStand(ctx, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false;
  }
  return true;
}

const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function center(column: number, row: number): Point {
  return [(column + 0.5) * CELL, (row + 0.5) * CELL];
}

function cellOf([x, z]: Point): [number, number] {
  return [Math.floor(x / CELL), Math.floor(z / CELL)];
}

function nearestFree(grid: PathGrid, [column, row]: [number, number]): number | null {
  for (let ring = 0; ring < 6; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const x = column + dx;
        const z = row + dz;
        if (x < 0 || z < 0 || x >= grid.columns || z >= grid.rows) continue;
        if (grid.free[z * grid.columns + x]) return z * grid.columns + x;
      }
    }
  }
  return null;
}

function estimate(a: number, b: number, columns: number): number {
  const dx = Math.abs((a % columns) - (b % columns));
  const dz = Math.abs(Math.floor(a / columns) - Math.floor(b / columns));
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

// A small binary heap of cell indexes by priority.
class Heap {
  private cells: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.cells.length;
  }

  push(cell: number, priority: number): void {
    this.cells.push(cell);
    this.priorities.push(priority);
    let i = this.cells.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.priorities[parent] ?? 0) <= priority) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.cells[0] ?? -1;
    const lastCell = this.cells.pop();
    const lastPriority = this.priorities.pop();
    if (this.cells.length > 0 && lastCell !== undefined && lastPriority !== undefined) {
      this.cells[0] = lastCell;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (
          left < this.cells.length &&
          (this.priorities[left] ?? 0) < (this.priorities[smallest] ?? 0)
        )
          smallest = left;
        if (
          right < this.cells.length &&
          (this.priorities[right] ?? 0) < (this.priorities[smallest] ?? 0)
        )
          smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.cells[a], this.cells[b]] = [this.cells[b] ?? 0, this.cells[a] ?? 0];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b] ?? 0, this.priorities[a] ?? 0];
  }
}
