/**
 * One way to type a runner name, used everywhere a name is asked for (the game-over card,
 * Settings, the challenge sheet):
 * - no autocorrect or spellcheck, so the phone never swaps the name for a "better" word
 * - at most 16 characters, counted the way the server counts them, never cutting an emoji in two
 * - a live check as you type: ✓ free, ✓ already yours, or ✗ taken with a few free names to tap
 */
import { t } from '../i18n.js';
import { NAME_MAX, playerToken, runnerName } from './leaderboard.js';

/** Attributes for a name <input>: no autocorrect, and no maxlength (it counts emoji as two). */
export const NAME_ATTRS = 'autocomplete="nickname" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done"';

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Cuts a name to 16 characters (code points, as the server counts) at a whole-symbol boundary. */
export function clampName(raw) {
  const s = String(raw ?? '');
  if ([...s].length <= NAME_MAX) return s;
  const parts = segmenter ? [...segmenter.segment(s)].map((x) => x.segment) : [...s];
  let out = '';
  for (const p of parts) {
    if ([...out].length + [...p].length > NAME_MAX) break;
    out += p;
  }
  return out;
}

/** Asks the server whether this device can use `name`. */
export async function checkName(name) {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ action: 'check', token: playerToken(), name }),
  });
  if (!res.ok) throw new Error('check failed');
  return res.json();
}

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Wires a name input to a status line under it. `current` is the name this device already has
 * (no check needed while it is unchanged). Returns helpers to show a result from elsewhere
 * (e.g. a "taken" answer from saving).
 */
export function bindNameField(input, status, { current = '' } = {}) {
  let timer = 0;
  let seq = 0;
  const show = (html, tone = '') => {
    status.className = `name-status ${tone}`;
    status.innerHTML = html;
  };
  const suggest = (list) => (list?.length
    ? `<span class="try">${t('Try:')}</span>${list.map((n) => `<button type="button" class="name-chip" data-pick="${esc(n)}">${esc(n)}</button>`).join('')}`
    : '');
  const api = {
    taken(name, suggestions) {
      show(`✗ ${t('“{name}” is taken.', { name: esc(name) })} ${suggest(suggestions)}`, 'bad');
    },
    clear: () => show(''),
  };
  const run = async () => {
    const name = runnerName(input.value);
    const mine = seq + 1;
    seq = mine;
    if (!name) return show(input.value.trim() ? t('Use 1–16 characters.') : '', input.value.trim() ? 'bad' : '');
    if (current && name.toLowerCase() === current.toLowerCase()) return show(`✓ ${t("That's your name.")}`, 'good');
    show(`<span class="spin"></span> ${t('Checking…')}`);
    try {
      const r = await checkName(name);
      if (mine !== seq) return; // typed on since
      if (r.ok) show(`✓ ${r.yours ? t("That's your name.") : t('Available!')}`, 'good');
      else if (r.reason === 'taken') api.taken(name, r.suggestions);
      else show(t('Use 1–16 characters.'), 'bad');
    } catch {
      if (mine === seq) show('');
    }
  };
  input.addEventListener('input', () => {
    const clamped = clampName(input.value);
    if (clamped !== input.value) input.value = clamped;
    clearTimeout(timer);
    timer = setTimeout(run, 450);
  });
  status.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-pick]');
    if (!chip) return;
    input.value = chip.dataset.pick;
    input.dispatchEvent(new Event('input'));
    input.focus();
  });
  if (input.value && runnerName(input.value) && runnerName(input.value) !== current) timer = setTimeout(run, 50);
  return api;
}
