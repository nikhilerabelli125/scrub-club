import type { Content } from '../data';
import {
  createKeyboard,
  emptyMemory,
  KEYBOARD_LEFT,
  KEYBOARD_RIGHT,
  layoutKeys,
  readKeyboard,
} from '../input';
import { createView } from '../render';
import {
  createClock,
  createContext,
  createWorld,
  interpolationAlpha,
  stepWorld,
  takeTicks,
  type Point,
  type PlayerSlot,
  type World,
} from '../sim';
import { createOverlay } from '../ui';

export interface GameOptions {
  levelId: string;
  playerCount: 1 | 2;
}

const SLOTS: readonly PlayerSlot[] = [1, 2];

// The game loop: keyboard in, fixed 60 Hz sim ticks, then draw the latest state
// (docs/07 §3). One level at a time until menus and the city map arrive in M4.
export function startGame(
  canvas: HTMLCanvasElement,
  uiRoot: HTMLElement,
  content: Content,
  options: GameOptions,
): void {
  const ctx = createContext(content, options.levelId);
  const view = createView(canvas, ctx);
  const overlay = createOverlay(uiRoot, ctx, options.playerCount);
  const layouts = [KEYBOARD_LEFT, KEYBOARD_RIGHT].slice(0, options.playerCount);
  const keyboard = createKeyboard(window, [...layouts.flatMap(layoutKeys), 'Enter']);
  const clock = createClock();

  const newWorld = (): World => {
    // Each run gets its own seed (docs/07 §3.3); the debug panel will show it.
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    return createWorld(ctx, { seed, playerCount: options.playerCount });
  };
  let world = newWorld();
  let memories = layouts.map(() => emptyMemory());
  let previous = positions(world);
  let last = performance.now();

  const frame = (now: number) => {
    const ticks = takeTicks(clock, (now - last) / 1000);
    last = now;
    for (let i = 0; i < ticks; i++) {
      const keys = keyboard.read();
      if (world.status === 'ended') {
        if (keys.tapped.has('Enter')) {
          world = newWorld();
          memories = layouts.map(() => emptyMemory());
          overlay.hideResults();
        }
        continue;
      }
      const players = layouts.map((layout, index) => {
        const read = readKeyboard(
          SLOTS[index] ?? 1,
          layout,
          keys,
          memories[index] ?? emptyMemory(),
        );
        memories[index] = read.memory;
        return read.input;
      });
      previous = positions(world);
      stepWorld(world, ctx, { players });
      if (world.result) overlay.showResults(world.result);
    }
    view.render(world, interpolationAlpha(clock), previous);
    overlay.update(world, view.project);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Dev builds expose the running game, for poking at it from the browser console.
  if (import.meta.env.DEV) {
    Object.assign(window, {
      scrubClub: {
        ctx,
        get world() {
          return world;
        },
      },
    });
  }
}

function positions(world: World): Map<PlayerSlot, Point> {
  return new Map(world.players.map((p) => [p.slot, [p.pos[0], p.pos[1]] as const]));
}
