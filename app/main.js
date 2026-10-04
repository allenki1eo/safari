import './styles.css';
// first, so the browser's install offer is caught however early it fires
import './ui/install.js';
// before any screen renders: picks the language and puts the Kiswahili into the game's text
import './i18n.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { bindInput } from './game/input.js';
import { audio } from './game/audio.js';
import { save } from './data/save.js';

const canvas = document.getElementById('scene');
const game = new Game(canvas);
const ui = new UI(game, document.getElementById('ui'));

audio.musicOn = save.music;
audio.soundOn = save.sound;

bindInput(window, (action) => {
  if (action === 'pause') {
    if (game.state === 'running') game.pause();
    return;
  }
  game.input(action);
});

// iOS/Android need a user gesture before audio can start.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'running') game.pause();
});

// Fade the splash once the first frames are on screen.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    document.getElementById('boot').classList.add('hide');
    ui.title();
  }),
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// handy for debugging from the console
window.__kimbia = { game, ui, save };
