import './ui/ui.css';
import { loadBundledContent, startGame } from './app';
import { showDataErrors } from './ui';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLElement>('#ui');
if (!canvas || !ui) throw new Error('index.html is missing #scene or #ui');

const loaded = loadBundledContent();
if (loaded.ok) {
  // Until menus arrive (M4), ?level=cl-a picks another level and ?players=1 plays solo.
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('level') ?? 'ed-a';
  startGame(canvas, ui, loaded.content, {
    levelId: loaded.content.levels.has(requested) ? requested : 'ed-a',
    playerCount: params.get('players') === '1' ? 1 : 2,
  });
} else {
  showDataErrors(ui, loaded.issues);
}
