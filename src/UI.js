/* ─── UI Manager ─────────────────────────────────────────── */
import { CHARACTER_SKINS } from './Player.js';
import * as SFX from './Sound.js';

const LEVELS = [
  { emoji: '🌾', name: 'Serengeti',        desc: 'Dodge wildebeest across the golden plains', locked: false },
  { emoji: '🏖️', name: 'Zanzibar Beach',   desc: 'Jump crabs & waves on the Indian Ocean shore', locked: false },
  { emoji: '🏔️', name: 'Kilimanjaro',      desc: 'Scale Africa\'s highest peak through snow & rock', locked: false },
  { emoji: '🌿', name: 'Ngorongoro',        desc: 'Flamingo-filled crater floor — coming soon', locked: true },
  { emoji: '🏙️', name: 'Stone Town',        desc: 'Urban parkour through Zanzibar\'s ancient alleys', locked: true },
  { emoji: '🌊', name: 'Mafia Island',      desc: 'Underwater coral reef bonus level', locked: true },
];

const TRIVIA = [
  { q: 'What is the highest mountain in Africa?', opts: ['Kilimanjaro', 'Mount Kenya', 'Rwenzori', 'Simien'], ans: 0 },
  { q: 'Zanzibar is an island of which country?', opts: ['Kenya', 'Mozambique', 'Tanzania', 'Madagascar'], ans: 2 },
  { q: 'What does "Hakuna Matata" mean in Swahili?', opts: ['Hello friend', 'No worries', 'Run faster', 'Goodbye'], ans: 1 },
  { q: 'The Serengeti is famous for which annual event?', opts: ['Wildebeest Migration', 'Flamingo Festival', 'Lion Dance', 'Rain Season'], ans: 0 },
  { q: 'What is the currency of Tanzania?', opts: ['Shilling', 'Franc', 'Pound', 'Dollar'], ans: 0 },
  { q: 'Which ocean borders Tanzania to the east?', opts: ['Atlantic', 'Pacific', 'Arctic', 'Indian'], ans: 3 },
  { q: 'Swahili is also called?', opts: ['Kiswahili', 'Bantu', 'Kiganda', 'Amharic'], ans: 0 },
  { q: 'What is Tanzania\'s main national park for wildlife?', opts: ['Serengeti', 'Kruger', 'Amboseli', 'Etosha'], ans: 0 },
];

export class UI {
  constructor(game) {
    this.game = game;
    this._toastTimer = null;
    this._hintTimer  = null;
    this._selectedSkin = 0;
    this._buildLevelGrid();
    this._buildCharacterScreen();
    this._bindButtons();
  }

  /* ─── Level Select Grid ──────────────────────────────────── */
  _buildLevelGrid() {
    const grid = document.getElementById('level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const card = document.createElement('div');
      card.className = 'level-card' + (lvl.locked ? ' locked' : '');
      card.innerHTML = `
        <span class="level-emoji">${lvl.emoji}</span>
        <div class="level-name">${lvl.name}</div>
        <div class="level-desc">${lvl.desc}</div>
        ${lvl.locked ? '<span class="level-lock">🔒</span>' : ''}
      `;
      if (!lvl.locked) {
        const startFn = (e) => {
          e.stopPropagation();
          try {
            SFX.resumeAudio();
            this.game.startLevel(i);
          } catch (err) {
            console.error(err);
          }
        };
        card.addEventListener('click',    startFn);
        card.addEventListener('touchend', startFn, { passive: false });
        card.style.cssText += `
          background: linear-gradient(135deg,
            rgba(255,255,255,0.1) 0%,
            rgba(255,255,255,0.04) 100%);
        `;
      }
      grid.appendChild(card);
    });
  }

  /* ─── Character Selection Screen (Subway Surfers style) ─── */
  _buildCharacterScreen() {
    const SKIN_EMOJIS = ['🧭','👕','🧥','🌾','🎸','🔧','💼','🏖️','👑','🛡️','🚀'];

    const nameEl    = document.getElementById('char-name');
    const countEl   = document.getElementById('char-skin-count');
    const prevBtn   = document.getElementById('char-prev');
    const nextBtn   = document.getElementById('char-next');
    const grid      = document.getElementById('char-grid');
    const openBtn   = document.getElementById('open-char-select');
    const doneBtn   = document.getElementById('char-select-done');

    const updateDisplay = () => {
      if (nameEl) nameEl.textContent = CHARACTER_SKINS[this._selectedSkin];
      if (countEl) countEl.textContent = `${this._selectedSkin + 1} / ${CHARACTER_SKINS.length}`;
      /* Highlight active card */
      grid?.querySelectorAll('.char-card').forEach((card, i) => {
        card.classList.toggle('selected', i === this._selectedSkin);
      });
    };

    const selectSkin = (idx) => {
      SFX.resumeAudio();
      SFX.sfxLaneSwitch();
      this._selectedSkin = idx;
      this.game.player.setSkin(idx);
      updateDisplay();
    };

    /* Build grid of character cards */
    if (grid) {
      grid.innerHTML = '';
      CHARACTER_SKINS.forEach((name, i) => {
        const card = document.createElement('div');
        card.className = 'char-card' + (i === 0 ? ' selected' : '');
        card.innerHTML = `
          <span class="char-card-emoji">${SKIN_EMOJIS[i] || '🏃'}</span>
          <div class="char-card-name">${name}</div>
        `;
        card.addEventListener('click', () => selectSkin(i));
        grid.appendChild(card);
      });
    }

    /* Arrow navigation */
    prevBtn?.addEventListener('click', () => {
      selectSkin((this._selectedSkin - 1 + CHARACTER_SKINS.length) % CHARACTER_SKINS.length);
    });
    nextBtn?.addEventListener('click', () => {
      selectSkin((this._selectedSkin + 1) % CHARACTER_SKINS.length);
    });

    /* Open / close character screen — click + touchend for mobile */
    const addTap = (el, fn) => {
      if (!el) return;
      const h = (e) => { e.stopPropagation(); fn(); };
      el.addEventListener('click',    h);
      el.addEventListener('touchend', h, { passive: false });
    };
    addTap(openBtn, () => {
      SFX.resumeAudio(); SFX.sfxMenuClick();
      this._hide('menu'); this._show('char-screen');
    });
    addTap(doneBtn, () => {
      SFX.resumeAudio(); SFX.sfxMenuClick();
      this._hide('char-screen'); this._show('menu');
    });

    updateDisplay();
  }

  _bindButtons() {
    /* Trivia options handled dynamically */
  }

  /* ─── Screen helpers ─────────────────────────────────────── */
  _show(id)  { document.getElementById(id)?.classList.remove('hidden'); }
  _hide(id)  { document.getElementById(id)?.classList.add('hidden'); }
  _hideAll() {
    ['loading', 'menu', 'hud', 'pause-overlay', 'trivia', 'level-complete', 'gameover', 'char-screen']
      .forEach(id => this._hide(id));
    this._hide('controls-hint');
  }

  showMenu() {
    this._hideAll();
    this._show('menu');
  }

  showHUD() {
    this._hideAll();
    this._show('hud');
  }

  showPause() {
    this._show('pause-overlay');
  }

  hidePause() {
    this._hide('pause-overlay');
  }

  showGameOver(score) {
    this._hide('hud');
    const el = document.getElementById('go-score-val');
    if (el) el.textContent = score.toLocaleString();
    this._show('gameover');
  }

  showLevelComplete(score, hasNext) {
    this._hide('hud');
    const el = document.getElementById('lc-score-val');
    if (el) el.textContent = score.toLocaleString();
    const nextBtn = document.getElementById('next-level-btn');
    if (nextBtn) nextBtn.style.display = hasNext ? '' : 'none';
    this._show('level-complete');
  }

  showControlsHint() {
    const hint = document.getElementById('controls-hint');
    if (!hint) return;
    hint.classList.add('visible');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => hint.classList.remove('visible'), 5000);
  }

  /* ─── HUD updates ───────────────────────────────────────── */
  setScore(n) {
    const el = document.getElementById('score-val');
    if (el) el.textContent = n.toLocaleString();
  }

  setLives(n) {
    const el = document.getElementById('lives-val');
    if (el) el.textContent = '❤️'.repeat(Math.max(0, n)) + '🖤'.repeat(Math.max(0, 3 - n));
  }

  setLevelName(name) {
    const el = document.getElementById('level-label');
    if (el) el.textContent = name;
  }

  setCombo(n) {
    const el = document.getElementById('combo-display');
    if (!el) return;
    if (n >= 2) {
      el.textContent = `x${n} COMBO`;
      el.classList.add('active');
      /* Scale pulse */
      el.style.transform = 'translateX(-50%) scale(1.3)';
      setTimeout(() => { el.style.transform = 'translateX(-50%) scale(1)'; }, 120);
    } else {
      el.classList.remove('active');
    }
  }

  /* ─── Swahili toast ─────────────────────────────────────── */
  showToast(text) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  /* ─── Trivia ─────────────────────────────────────────────── */
  showTrivia(onDone) {
    const item   = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
    const qEl    = document.getElementById('trivia-q');
    const optsEl = document.getElementById('trivia-opts');
    if (!qEl || !optsEl) { onDone(false); return; }

    qEl.textContent = item.q;
    optsEl.innerHTML = '';
    let answered = false;
    item.opts.forEach((opt, i) => {
      const btn = document.createElement('div');
      btn.className = 'trivia-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        btn.classList.add(i === item.ans ? 'correct' : 'wrong');
        if (i !== item.ans) {
          optsEl.children[item.ans].classList.add('correct');
        }
        setTimeout(() => {
          this._hide('trivia');
          onDone(i === item.ans);
        }, 1600);
      });
      optsEl.appendChild(btn);
    });

    this._show('trivia');
    setTimeout(() => {
      if (!answered) {
        answered = true;
        this._hide('trivia');
        onDone(false);
      }
    }, 15000);
  }
}
