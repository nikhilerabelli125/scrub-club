import type { Content } from '../data';
import type { DebugPanel } from '../debug';
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

  // Each run gets its own seed (docs/07 §3.3), shown in the debug panel.
  const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  let world = createWorld(ctx, { seed: randomSeed(), playerCount: options.playerCount });
  let memories = layouts.map(() => emptyMemory());
  let previous = positions(world);
  let last = performance.now();
  let debug: DebugPanel | null = null;

  const restart = (seed: number) => {
    world = createWorld(ctx, { seed, playerCount: options.playerCount });
    memories = layouts.map(() => emptyMemory());
    previous = positions(world);
    overlay.hideResults();
  };

  const frame = (now: number) => {
    const frameMs = now - last;
    const ticks = takeTicks(clock, frameMs / 1000);
    last = now;
    const started = performance.now();
    let stepped = 0;

    // Skipping time runs the ticks at once, with everyone standing still.
    const skip = debug?.takeSkipTicks() ?? 0;
    for (let i = 0; i < skip && world.status === 'running'; i++) {
      stepWorld(world, ctx, { players: [] });
      stepped += 1;
    }
    if (skip > 0) previous = positions(world);
    if (world.result) overlay.showResults(world.result);

    for (let i = 0; i < ticks; i++) {
      const keys = keyboard.read();
      if (world.status === 'ended') {
        if (keys.tapped.has('Enter')) restart(randomSeed());
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
      stepWorld(world, ctx, { players, commands: debug?.takeCommands() ?? [] });
      stepped += 1;
      if (world.result) overlay.showResults(world.result);
    }
    view.render(world, interpolationAlpha(clock), previous);
    overlay.update(world, view.project);
    debug?.update(world, {
      frameMs,
      tickMs: stepped > 0 ? (performance.now() - started) / stepped : 0,
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Dev builds get the debug panel, and the running game on window for poking at it
  // from the browser console. Production builds leave both out.
  if (import.meta.env.DEV) {
    void import('../debug').then(({ createDebugPanel }) => {
      debug = createDebugPanel(uiRoot, content, ctx, restart);
    });
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
