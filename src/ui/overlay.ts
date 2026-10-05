// The DOM overlay above the canvas (docs/06 §6, docs/07 §9): ticket rail, clock, HUD,
// floating tags, and the results card. It draws what model.ts works out from the world
// and never changes the world.
import type { DataIssue } from '../data';
import type { ScreenPoint } from '../render';
import { stationHeight } from '../render';
import type { LevelResult, Patient, PlayerSlot, SimContext, World } from '../sim';
import { BED_SIZE, patientArea } from '../sim';
import {
  ACUITY_COLORS,
  activityModels,
  hudModel,
  PLAYER_COLORS,
  ticketModels,
  type HudModel,
  type TicketModel,
} from './model';

export type Project = (x: number, y: number, z: number) => ScreenPoint;

export interface Overlay {
  update(world: World, project: Project): void;
  showResults(result: LevelResult): void;
  hideResults(): void;
}

const CONTROLS: Record<PlayerSlot, string> = {
  1: 'W A S D to move, F to pick up, G to use',
  2: 'arrow keys to move, K to pick up, L to use',
  3: '',
  4: '',
};

export function createOverlay(root: HTMLElement, ctx: SimContext, playerCount: 1 | 2): Overlay {
  const labels = element('div', 'labels');
  const rail = element('div', 'rail');
  const tickets = element('div', 'tickets');
  const clock = element('div', 'clock');
  rail.append(tickets, clock);
  const hud = element('div', 'hud');
  const help = element('div', 'help');
  help.innerHTML = ([1, 2] as const)
    .slice(0, playerCount)
    .map(
      (slot) =>
        `<p><b style="color:${PLAYER_COLORS[slot]}">Player ${slot}:</b> ${CONTROLS[slot]}</p>`,
    )
    .join('');
  const results = element('div', 'results');
  results.hidden = true;
  root.replaceChildren(labels, rail, hud, help, results);

  const tags = new Map<string, HTMLElement>();
  let ticketsDrawn = '';
  let hudDrawn = '';

  return {
    update(world, project) {
      const models = ticketModels(world, ctx);
      drawTickets(tickets, models, ticketsDrawn, (drawn) => (ticketsDrawn = drawn));
      const summary = hudModel(world, ctx);
      clock.textContent = summary.clock;
      const hudHtml = hudMarkup(summary);
      if (hudHtml !== hudDrawn) {
        hud.innerHTML = hudHtml;
        hudDrawn = hudHtml;
      }
      placeTags(labels, tags, floatingTags(world, ctx, models, project));
    },
    showResults(result) {
      const titles = {
        timeUp: 'Shift over',
        completed: 'Everyone seen',
        strikeOut: 'Too many strikes',
      } as const;
      results.innerHTML = `
        <div class="card">
          <h2>${titles[result.outcome]}</h2>
          <div class="stars big">${starsMarkup(result.stars)}</div>
          <p>Score ${result.score} · Strikes ${result.strikes}</p>
          <p class="hint">Press Enter to play again</p>
        </div>`;
      results.hidden = false;
    },
    hideResults() {
      results.hidden = true;
    },
  };
}

// Shown instead of the game when data/ fails validation, so a bad edit is obvious.
export function showDataErrors(root: HTMLElement, issues: readonly DataIssue[]): void {
  const list = issues
    .map(
      (i) => `<li><code>data/${escape(i.file)}</code> ${escape(i.at)}: ${escape(i.message)}</li>`,
    )
    .join('');
  root.innerHTML = `<div class="results"><div class="card errors"><h2>The game data has problems</h2>
    <p>Run <code>npm run validate-data</code> for details.</p><ul>${list}</ul></div></div>`;
}

function drawTickets(
  container: HTMLElement,
  models: readonly TicketModel[],
  drawn: string,
  remember: (drawn: string) => void,
): void {
  // Rebuild only when a ticket's content changes; patience bars update every frame.
  const html = models.map(ticketMarkup).join('');
  if (html !== drawn) {
    container.innerHTML = html;
    remember(html);
  }
  for (const ticket of models) {
    const bar = container.querySelector<HTMLElement>(`[data-patient="${ticket.patient}"] .t-bar i`);
    if (!bar) continue;
    bar.style.width = `${Math.round(ticket.patience * 100)}%`;
    bar.style.background = patienceColor(ticket.patience);
  }
}

function ticketMarkup(ticket: TicketModel): string {
  const chips = ticket.chips
    .map((chip) => {
      const repeats = chip.repeats > 1 ? ` ×${chip.repeats}` : '';
      return `<li class="${chip.state}">${escape(chip.label)}${repeats}</li>`;
    })
    .join('');
  return `
    <div class="ticket" data-patient="${ticket.patient}">
      <div class="paper" style="--acuity:${ACUITY_COLORS[ticket.acuity]}">
        <div class="t-name">${escape(ticket.label)}</div>
        <div class="t-bed">${escape(ticket.bed ?? 'Waiting room')}</div>
        <ul class="t-steps">${chips}</ul>
        <div class="t-bar"><i></i></div>
      </div>
    </div>`;
}

// The bar shifts green, then orange, then red as patience runs out (docs/06 §6).
function patienceColor(left: number): string {
  if (left > 0.5) return '#3BB273';
  return left > 0.25 ? '#EE8A2B' : '#D9433B';
}

function hudMarkup(hud: HudModel): string {
  const strikes =
    hud.strikeLimit === null
      ? '<span class="none">No limit</span>'
      : Array.from({ length: hud.strikeLimit }, (_, i) =>
          i < hud.strikes ? '<span class="on"></span>' : '<span></span>',
        ).join('');
  return `
    <div><div class="k">Score</div><div class="v">${hud.score}</div></div>
    <div><div class="k">Stars</div><div class="stars">${starsMarkup(hud.stars)}</div></div>
    <div><div class="k">Strikes</div><div class="strikes">${strikes}</div></div>`;
}

function starsMarkup(stars: number): string {
  return [1, 2, 3].map((n) => (n <= stars ? '★' : '<span class="off">★</span>')).join('');
}

interface Tag {
  className: string;
  html: string;
  point: ScreenPoint;
}

// Everything that floats over the 3D scene, keyed so the same element follows the same thing.
function floatingTags(
  world: World,
  ctx: SimContext,
  tickets: readonly TicketModel[],
  project: Project,
): Map<string, Tag> {
  const tags = new Map<string, Tag>();
  for (const station of ctx.map.stations) {
    const label = ctx.content.stations.get(station.type)?.label;
    if (!label) continue;
    tags.set(`station:${station.id}`, {
      className: 'tag station',
      html: escape(label),
      point: project(station.pos[0], stationHeight(station.type) + 0.1, station.pos[1]),
    });
  }

  const ticketByPatient = new Map(tickets.map((t) => [t.patient, t]));
  for (const patient of world.patients) {
    const ticket = ticketByPatient.get(patient.id);
    if (!ticket) continue;
    tags.set(`patient:${patient.id}`, {
      className: 'tag patient',
      html: `<span style="background:${ACUITY_COLORS[ticket.acuity]}">${escape(ticket.label)}</span>`,
      point: patientTagPoint(world, ctx, patient, project),
    });
  }

  const working = new Map(activityModels(world, ctx).map((a) => [a.slot, a]));
  for (const player of world.players) {
    const carried = world.items.find((i) => i.id === player.holding);
    const itemLabel = carried ? ctx.content.items.get(carried.item)?.label : undefined;
    const name = `P${player.slot}${itemLabel ? ` · ${escape(itemLabel)}` : ''}`;
    tags.set(`player:${player.slot}`, {
      className: 'tag player',
      html: `<span style="background:${PLAYER_COLORS[player.slot]}">${name}</span>`,
      point: project(player.pos[0], 1.65, player.pos[1]),
    });
    const activity = working.get(player.slot);
    if (activity) {
      const body = activity.waitingForPress
        ? '<em>Press Use</em>'
        : `<b style="width:${Math.round(activity.progress * 100)}%"></b>`;
      tags.set(`activity:${player.slot}`, {
        className: 'tag activity',
        html: `<span>${escape(activity.label)}</span><div class="bar">${body}</div>`,
        point: project(player.pos[0], 2.05, player.pos[1]),
      });
    }
  }
  return tags;
}

// Over the head of the bed, so a player working at the bedside never covers it; over the
// seat for waiting patients.
function patientTagPoint(
  world: World,
  ctx: SimContext,
  patient: Patient,
  project: Project,
): ScreenPoint {
  const location = patient.location;
  const bed = location.kind === 'bed' ? ctx.map.beds.find((b) => b.id === location.bed) : undefined;
  if (bed) {
    const turn = (bed.rot * Math.PI) / 180;
    const toHead = BED_SIZE[1] / 2 - 0.35;
    return project(
      bed.pos[0] - Math.sin(turn) * toHead,
      1.05,
      bed.pos[1] - Math.cos(turn) * toHead,
    );
  }
  const area = patientArea(world, ctx, patient);
  return project((area.x0 + area.x1) / 2, 1.6, (area.z0 + area.z1) / 2);
}

function placeTags(
  container: HTMLElement,
  elements: Map<string, HTMLElement>,
  tags: Map<string, Tag>,
): void {
  for (const [key, el] of elements) {
    if (!tags.has(key)) {
      el.remove();
      elements.delete(key);
    }
  }
  for (const [key, tag] of tags) {
    let el = elements.get(key);
    if (!el) {
      el = element('div', tag.className);
      container.append(el);
      elements.set(key, el);
    }
    if (el.dataset.html !== tag.html) {
      el.innerHTML = tag.html;
      el.dataset.html = tag.html;
    }
    el.hidden = !tag.point.visible;
    el.style.transform = `translate(${tag.point.x.toFixed(1)}px, ${tag.point.y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}

function element(tag: 'div', className: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}
