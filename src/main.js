import { Game } from './game/game.js';
import { G } from './game/G.js';
import { Campaign } from './game/campaignMode.js';
import { Tutorial } from './game/tutorial.js';
import { UI } from './ui/ui.js';

// Entry point: drives the loading bar from real boot stages, then fades in.
const loader = document.getElementById('loader');
const fill = loader && loader.querySelector('.fill');
const label = loader && loader.querySelector('.label');
if (window.__preload) clearInterval(window.__preload);

let shown = window.__loadK || 0.2;
let target = Math.max(0.22, shown);
let finished = false;
const draw = () => {
  shown += (target - shown) * 0.18;
  if (fill) fill.style.width = `${(shown * 100).toFixed(1)}%`;
  if (!finished) requestAnimationFrame(draw);
};
requestAnimationFrame(draw);

function progress(k, text) {
  // boot stages report 0..1; the bundle download already covered the first 20%
  target = Math.max(target, 0.2 + k * 0.8);
  if (text && label) label.textContent = text;
}

// Block browser gestures that fight the game (pinch-zoom, context menu, drag).
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && e.target === document.body) e.preventDefault();
});

Game.boot(progress)
  .then(() => {
    target = 1;
    setTimeout(() => {
      finished = true;
      if (fill) fill.style.width = '100%';
      loader.classList.add('done');
      setTimeout(() => loader.remove(), 700);
      window.__ready = true;
    }, 250);
    if (new URLSearchParams(location.search).has('dev')) window.__bh = { G, Game, Campaign, Tutorial, UI };
  })
  .catch((e) => {
    console.error(e);
    if (label) label.textContent = 'Something went wrong. Please reload the page.';
    window.__bootError = String(e && e.stack ? e.stack : e);
  });
