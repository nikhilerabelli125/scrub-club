// The dev-build debug panel (docs/07 §12): jump to a level, restart with a seed, spawn
// any condition, skip time, and read fps and sim tick time. Spawns travel as sim
// commands in the next tick's input, so a debug session replays exactly (docs/07 §3.4).
// Press ` (backquote) or click the pill to open it.
import './debug.css';
import type { Content } from '../data';
import { secondsToTicks, type SimCommand, type SimContext, type World } from '../sim';
import { conditionChoices, levelChoices, smooth, type Choice } from './model';

export interface DebugStats {
  frameMs: number; // time since the last frame
  tickMs: number; // average time per sim tick this frame (0 when none ran)
}

export interface DebugPanel {
  // Hands over the commands queued since the last call, for the next tick.
  takeCommands(): SimCommand[];
  // Hands over the ticks to skip, to run at once with everyone standing still.
  takeSkipTicks(): number;
  update(world: World, stats: DebugStats): void;
}

const SKIPS = [10, 30];

export function createDebugPanel(
  root: HTMLElement,
  content: Content,
  ctx: SimContext,
  restart: (seed: number) => void,
): DebugPanel {
  const panel = document.createElement('div');
  panel.className = 'debug';
  panel.innerHTML = `
    <button type="button" class="debug-pill">Debug <span data-fps></span></button>
    <div class="debug-body" hidden>
      <label>Level ${select('level', levelChoices(content))}</label>
      <div class="debug-row">
        <label>Spawn ${select('condition', conditionChoices(content, ctx.level.setting))}</label>
        <button type="button" data-spawn>Spawn</button>
      </div>
      <div class="debug-row">
        Skip ${SKIPS.map((s) => `<button type="button" data-skip="${s}">+${s} s</button>`).join('')}
      </div>
      <div class="debug-row">
        <label>Seed <input data-seed inputmode="numeric" size="11" /></label>
        <button type="button" data-restart>Restart</button>
      </div>
      <p class="debug-stats" data-stats></p>
    </div>`;
  root.append(panel);

  const body = find<HTMLElement>(panel, '.debug-body');
  const levelSelect = find<HTMLSelectElement>(panel, '[data-select="level"]');
  const conditionSelect = find<HTMLSelectElement>(panel, '[data-select="condition"]');
  const seedInput = find<HTMLInputElement>(panel, '[data-seed]');
  const fpsText = find<HTMLElement>(panel, '[data-fps]');
  const statsText = find<HTMLElement>(panel, '[data-stats]');
  levelSelect.value = ctx.level.id;

  let commands: SimCommand[] = [];
  let skipTicks = 0;
  let frameMs = 1000 / 60;
  let tickMs = 0;
  let shownSeed: number | null = null;

  const toggle = () => {
    body.hidden = !body.hidden;
  };
  // Keys typed into the panel stay out of the game. Key releases still reach it, so a
  // key held while clicking here can't get stuck down.
  panel.addEventListener('keydown', (event) => event.stopPropagation());
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Backquote' && !event.repeat) toggle();
  });
  panel.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;
    button.blur(); // so Enter and Space go back to the game
    if (button.classList.contains('debug-pill')) toggle();
    else if (button.dataset.spawn !== undefined) {
      commands.push({ type: 'spawn', condition: conditionSelect.value });
    } else if (button.dataset.skip) {
      skipTicks += secondsToTicks(Number(button.dataset.skip));
    } else if (button.dataset.restart !== undefined) {
      const seed = Number.parseInt(seedInput.value, 10);
      if (Number.isSafeInteger(seed) && seed >= 0) restart(seed >>> 0);
    }
  });
  levelSelect.addEventListener('change', () => {
    // Levels load from the URL until menus arrive (M4); keep the player count.
    const params = new URLSearchParams(window.location.search);
    params.set('level', levelSelect.value);
    window.location.search = params.toString();
  });

  return {
    takeCommands() {
      const taken = commands;
      commands = [];
      return taken;
    },
    takeSkipTicks() {
      const taken = skipTicks;
      skipTicks = 0;
      return taken;
    },
    update(world, stats) {
      frameMs = smooth(frameMs, stats.frameMs);
      if (stats.tickMs > 0) tickMs = smooth(tickMs, stats.tickMs);
      setText(fpsText, `${Math.round(1000 / frameMs)} fps`);
      if (body.hidden) return;
      if (world.seed !== shownSeed && document.activeElement !== seedInput) {
        seedInput.value = String(world.seed);
        shownSeed = world.seed;
      }
      const count = world.patients.length;
      const waiting = world.patients.filter((p) => p.location.kind === 'waiting').length;
      setText(
        statsText,
        `Tick ${world.tick} · ${tickMs.toFixed(3)} ms per tick · ` +
          `${count} ${count === 1 ? 'patient' : 'patients'}, ${waiting} waiting`,
      );
    },
  };
}

function select(name: string, choices: readonly Choice[]): string {
  const options = choices
    .map((choice) => `<option value="${choice.id}">${escape(choice.label)}</option>`)
    .join('');
  return `<select data-select="${name}">${options}</select>`;
}

function find<T extends Element>(root: Element, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`debug panel is missing ${selector}`);
  return found;
}

// Skips the DOM write when nothing changed, since this runs every frame.
function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
