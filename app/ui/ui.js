import { RUNNERS, ALLIES, ALLY_IDS, UPGRADE_COSTS, CHAPTERS, INTRO } from '../data/content.js';
import { save, persist, ensureMissions, checkMissions, claimMissionSet, multiplier, claimDaily } from '../data/save.js';
import { audio } from '../game/audio.js';
import { shareRun } from './share.js';

const $ = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const fmt = (n) => Math.floor(n).toLocaleString();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICON = {
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
};

/* ---------- illustrated story panels (pure CSS/SVG so they load instantly) ---------- */
const hills = (fill, h = 38) => `
  <svg viewBox="0 0 400 ${h + 60}" preserveAspectRatio="none" style="height:${h}%">
    <path d="M0 ${h} Q60 ${h - 14} 130 ${h - 4} T260 ${h - 8} T400 ${h - 12} V${h + 60} H0Z" fill="${fill}"/>
    <g fill="${fill}">
      <rect x="300" y="${h - 46}" width="4" height="40"/>
      <ellipse cx="302" cy="${h - 48}" rx="34" ry="7"/><ellipse cx="288" cy="${h - 53}" rx="18" ry="5"/><ellipse cx="318" cy="${h - 52}" rx="18" ry="5"/>
      <rect x="60" y="${h - 34}" width="3" height="28"/>
      <ellipse cx="61" cy="${h - 36}" rx="24" ry="5"/>
    </g>
  </svg>`;

const ART = {
  dawn: () => `
    <div class="sky" style="background:linear-gradient(#3b2a6e 0%,#c0436a 35%,#ff7a2f 60%,#ffc940 85%)"></div>
    <div class="sunball" style="bottom:22%;width:46vw;height:46vw;max-width:260px;max-height:260px;background:radial-gradient(circle,#fff6d6,#ffd34d 60%,#ff9a2f);box-shadow:0 0 120px #ffb347"></div>
    ${hills('#2b1a0e', 34)}
    <div class="emo march" style="bottom:10%;left:0;font-size:46px;white-space:nowrap;filter:brightness(0.15) drop-shadow(0 0 0 #000)">🦓 🦓 🦒 🐘 🦓 🦬 🦬</div>`,
  heart: () => `
    <div class="sky" style="background:radial-gradient(90% 60% at 50% 45%,#6a3a8a 0%,#2a1745 50%,#0c0718 100%)"></div>
    <div class="glow-seed"></div>
    ${hills('#120a06', 30)}
    <div class="emo float" style="left:12%;top:18%;font-size:28px">✨</div>
    <div class="emo float" style="right:14%;top:26%;font-size:22px;animation-delay:1s">✨</div>`,
  fisi: () => `
    <div class="sky" style="background:linear-gradient(#0c0718 0%,#3a1020 60%,#7a2418 100%)"></div>
    ${hills('#080404', 40)}
    <div class="eyes" style="left:18%;bottom:30%"><i></i><i></i></div>
    <div class="eyes" style="left:56%;bottom:36%;transform:scale(1.4)"><i></i><i></i></div>
    <div class="eyes" style="left:76%;bottom:27%"><i></i><i></i></div>
    <div class="emo" style="left:50%;top:22%;transform:translateX(-50%);font-size:88px">😈</div>
    <div class="emo march" style="bottom:12%;font-size:54px;filter:brightness(0.35);animation-duration:6s">🚛</div>`,
  scatter: () => `
    <div class="sky" style="background:linear-gradient(#4f9be0 0%,#ffe2ac 70%)"></div>
    ${hills('#c28c55', 36)}
    ${Array.from({ length: 14 }, (_, i) => `<div class="emo float" style="left:${(i * 37) % 92 + 3}%;top:${30 + ((i * 53) % 40)}%;font-size:22px;animation-delay:${(i % 5) * 0.4}s"><span class="seed"></span></div>`).join('')}
    <div class="emo march" style="bottom:20%;font-size:46px;animation-duration:7s">🚛💨</div>`,
  elder: () => `
    <div class="sky" style="background:linear-gradient(#ff9a5c 0%,#ffc98a 55%,#f5d9a6 100%)"></div>
    <div class="sunball" style="top:12%;left:72%;width:90px;height:90px;background:radial-gradient(circle,#fff6d6,#ffd34d);box-shadow:0 0 60px #ffd34d"></div>
    ${hills('#7a5a2e', 34)}
    <div class="emo float" style="left:8%;bottom:18%;font-size:140px">🐘</div>
    <div class="emo" style="right:16%;bottom:16%;font-size:72px">🧒🏾</div>`,
};

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.screen = null;
    this.hud = null;
    this.params = new URLSearchParams(location.search);
    this.challenge = this.params.get('c') ? { score: parseInt(this.params.get('c'), 10) || 0, name: (this.params.get('n') || 'A friend').slice(0, 16) } : null;
    this.missionTick = 0;
    this.selIdx = Math.max(0, RUNNERS.findIndex((r) => r.id === save.runner));

    game.on('hud', (g) => this.updateHud(g));
    game.on('seed', () => this.bumpSeeds());
    game.on('power', (e) => this.onPower(e));
    game.on('chapter', (c) => this.onChapter(c));
    game.on('tutorial', (t) => this.tip(t));
    game.on('shout', (s) => this.shout(s));
    game.on('over', (r) => this.onOver(r));
    game.on('pause', () => this.showPause());
  }

  /* ---------------------------------------------------------- plumbing */
  show(el) {
    const old = this.screen;
    if (old) {
      old.classList.add('leaving');
      setTimeout(() => old.remove(), 250);
    }
    this.screen = el;
    this.root.appendChild(el);
    el.querySelectorAll('[data-click]').forEach((b) => b.addEventListener('pointerdown', () => audio.click()));
    return el;
  }

  overlay(el) {
    this.root.appendChild(el);
    return el;
  }

  toast(emoji, html, ms = 2800) {
    const t = $(`<div class="toast"><span class="e">${emoji}</span><div>${html}</div></div>`);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /* ------------------------------------------------------------- title */
  title() {
    this.removeHud();
    this.game.toMenu('menu');
    const missions = ensureMissions();
    const missionsReady = missions.every((m) => m.done);
    const canAfford = RUNNERS.some((r) => !save.owned.includes(r.id) && r.cost <= save.seeds) || ALLY_IDS.some((id) => (save.upgrades[id] ?? 0) < 5 && UPGRADE_COSTS[save.upgrades[id] ?? 0] <= save.seeds);
    const el = $(`
      <div class="screen title scrim-bottom">
        <div class="title-top">
          <div class="chips">
            <div class="chip"><span class="seed"></span><span>${fmt(save.seeds)}</span></div>
            <div class="chip">✖️ ${multiplier()} <span class="muted" style="font-size:12px">MULTIPLIER</span></div>
          </div>
          <button class="icon-btn" data-act="settings" data-click aria-label="Settings">${ICON.gear}</button>
        </div>
        <div class="logo">
          <h1>KIMBIA!</h1>
          <div class="sub">SPIRIT OF THE SERENGETI</div>
        </div>
        <div class="title-bottom">
          ${this.challenge ? `<div class="challenge"><span style="font-size:28px">🔥</span><div><b>${esc(this.challenge.name)}</b> challenges you to beat <b>${fmt(this.challenge.score)}</b> points!</div></div>` : ''}
          ${save.best ? `<div class="best-line">Best run <b>${fmt(save.best)}</b> pts · <b>${fmt(save.bestDistance)}m</b></div>` : ''}
          <button class="btn big play-btn" data-act="play" data-click>▶ RUN!</button>
          <div class="nav-row">
            <button class="nav-btn" data-act="runners" data-click><span class="ico">🧒🏾</span>Runners${canAfford ? '<i class="badge-dot"></i>' : ''}</button>
            <button class="nav-btn" data-act="allies" data-click><span class="ico">🐘</span>Allies</button>
            <button class="nav-btn" data-act="missions" data-click><span class="ico">🎯</span>Missions${missionsReady ? '<i class="badge-dot"></i>' : ''}</button>
            <button class="nav-btn" data-act="story" data-click><span class="ico">📜</span>Story</button>
          </div>
        </div>
      </div>`);
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      audio.unlock();
      if (act === 'play') this.play();
      else if (act === 'settings') this.settings();
      else if (act === 'runners') this.runners();
      else if (act === 'allies') this.allies();
      else if (act === 'missions') this.missions();
      else if (act === 'story') this.story();
    });
    this.show(el);
    if (save.introSeen) setTimeout(() => this.daily(), 600);
  }

  play() {
    if (!save.introSeen) return this.intro(() => this.startRun());
    this.startRun();
  }

  /* ------------------------------------------------------------- intro */
  intro(done) {
    let i = 0;
    let typing;
    const el = $(`
      <div class="screen intro">
        <div class="art"></div>
        <div class="text">
          <div class="speaker"><span class="e"></span><span class="n"></span></div>
          <div class="line"></div>
          <div class="controls">
            <button class="skip" data-act="skip">Skip story</button>
            <div class="progress">${INTRO.map(() => '<i></i>').join('')}</div>
            <button class="btn" data-act="next" data-click style="min-height:50px;font-size:20px">Next ›</button>
          </div>
        </div>
      </div>`);
    const art = el.querySelector('.art');
    const line = el.querySelector('.line');
    const render = () => {
      const p = INTRO[i];
      art.innerHTML = `<div class="scene-art">${ART[p.art]()}</div>`;
      el.querySelector('.speaker .e').textContent = p.emoji;
      el.querySelector('.speaker .n').textContent = p.speaker;
      el.querySelectorAll('.progress i').forEach((d, k) => d.classList.toggle('on', k <= i));
      el.querySelector('[data-act=next]').textContent = i === INTRO.length - 1 ? 'Run! ›' : 'Next ›';
      clearInterval(typing);
      let n = 0;
      line.textContent = '';
      typing = setInterval(() => {
        n += 2;
        line.textContent = p.text.slice(0, n);
        if (n >= p.text.length) clearInterval(typing);
      }, 22);
    };
    const finish = () => {
      clearInterval(typing);
      save.introSeen = true;
      persist();
      done();
    };
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'skip') return finish();
      if (act === 'next' || e.target.closest('.art')) {
        if (line.textContent.length < INTRO[i].text.length) {
          clearInterval(typing);
          line.textContent = INTRO[i].text;
          return;
        }
        if (++i >= INTRO.length) return finish();
        audio.click();
        render();
      }
    });
    this.show(el);
    render();
  }

  /* --------------------------------------------------------------- run */
  startRun() {
    audio.unlock();
    this.show($('<div class="screen" style="pointer-events:none"></div>'));
    this.buildHud();
    this.game.start();
    this.missionTick = 0;
  }

  buildHud() {
    this.removeHud();
    const el = $(`
      <div class="screen hud">
        <div class="hud-top">
          <div class="score-box">
            <div class="score">0</div>
            <div class="mult">×${multiplier()}</div>
          </div>
          <div class="hud-right">
            <div class="row">
              <div class="chip seeds-chip"><span class="seed lg"></span><span class="n">0</span></div>
              <button class="icon-btn" data-act="pause" aria-label="Pause" style="width:46px;height:46px">${ICON.pause}</button>
            </div>
            <div class="dist">0m</div>
          </div>
        </div>
        <div class="powers"></div>
      </div>`);
    el.querySelector('[data-act=pause]').addEventListener('click', () => this.game.pause());
    this.hud = el;
    this.hudEls = {
      score: el.querySelector('.score'),
      mult: el.querySelector('.mult'),
      seeds: el.querySelector('.seeds-chip .n'),
      seedsChip: el.querySelector('.seeds-chip'),
      dist: el.querySelector('.dist'),
      powers: el.querySelector('.powers'),
    };
    this.powerEls = {};
    this.last = {};
    this.overlay(el);
  }

  removeHud() {
    this.hud?.remove();
    this.hud = null;
  }

  updateHud(g) {
    if (!this.hud) return;
    const E = this.hudEls;
    const s = Math.floor(g.score);
    if (s !== this.last.score) E.score.textContent = fmt((this.last.score = s));
    const d = Math.floor(g.D);
    if (d !== this.last.d) E.dist.textContent = `${fmt((this.last.d = d))}m`;
    if (g.seeds !== this.last.seeds) E.seeds.textContent = fmt((this.last.seeds = g.seeds));
    const m = multiplier() * (g.powers.simba ? 2 : 1);
    if (m !== this.last.mult) {
      this.last.mult = m;
      E.mult.textContent = `×${m}`;
      E.mult.classList.toggle('hot', !!g.powers.simba);
    }
    for (const [id, el] of Object.entries(this.powerEls)) {
      const left = g.powers[id] ?? 0;
      const p = Math.max(0, left / g.duration(id));
      el.style.setProperty('--p', p.toFixed(3));
      el.classList.toggle('ending', left < 1.5);
    }
    // missions — checked a few times per second
    if ((this.missionTick += 1) % 20 === 0) {
      for (const done of checkMissions(g.stats)) this.toast('🎯', `<b>Mission complete!</b><br>${esc(done.text)}`);
    }
  }

  bumpSeeds() {
    const c = this.hudEls?.seedsChip;
    if (!c) return;
    c.classList.remove('bump');
    void c.offsetWidth;
    c.classList.add('bump');
  }

  onPower({ id, on, line }) {
    if (!this.hud) return;
    const a = ALLIES[id];
    if (on) {
      if (!this.powerEls[id]) {
        const el = $(`<div class="power" style="--c:${a.color}"><span>${a.emoji}</span></div>`);
        this.hudEls.powers.appendChild(el);
        this.powerEls[id] = el;
      }
      this.speech(a.emoji, `${a.name} the ${a.species}`, line, a.color);
    } else {
      this.powerEls[id]?.remove();
      delete this.powerEls[id];
    }
  }

  speech(emoji, who, what, color = 'var(--sun)') {
    if (!this.hud) return;
    this.hud.querySelector('.speech')?.remove();
    const el = $(`<div class="speech" style="--c:${color}"><div class="face">${emoji}</div><div><div class="who">${esc(who)}</div><div class="what">${esc(what)}</div></div></div>`);
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  onChapter(c) {
    if (!this.hud) return;
    this.hud.querySelector('.banner')?.remove();
    const el = $(`<div class="banner"><div class="kicker">Chapter ${c.index + 1}</div><h2>${esc(c.title)}</h2><div class="place">📍 ${esc(c.place)}</div></div>`);
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 3700);
    setTimeout(() => this.speech(c.emoji, c.speaker, c.line), c.index === 0 ? 3800 : 2600);
  }

  tip(t) {
    if (!this.hud) return;
    this.hud.querySelector('.tip')?.remove();
    const el = $(`<div class="tip"><span class="i">${t.icon}</span>${esc(t.text)}</div>`);
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  shout({ text, sub, warn }) {
    if (!this.hud) return;
    this.hud.querySelector('.shout')?.remove();
    const el = $(`<div class="shout ${warn ? 'warn' : ''}"><b>${esc(text)}</b><span>${esc(sub ?? '')}</span></div>`);
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 1250);
    if (warn) {
      const f = $('<div class="flash"></div>');
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 650);
    }
  }

  /* ------------------------------------------------------------- pause */
  showPause() {
    const ms = ensureMissions();
    const el = $(`
      <div class="screen modal-wrap scrim-full">
        <div class="panel modal">
          <h2>Paused</h2>
          <div class="muted">Fisi is waiting… catch your breath.</div>
          <div class="mission-mini" style="margin-top:16px">
            ${ms.map((m) => `<div><span class="tick ${m.done ? 'done' : ''}">${m.done ? '✓' : ''}</span>${esc(m.text)}</div>`).join('')}
          </div>
          <div class="stack">
            <button class="btn" data-act="resume" data-click>▶ Keep running</button>
            <div class="row2">
              <button class="btn ghost" data-act="sound" data-click>${save.music ? '🔊 Music' : '🔇 Music'}</button>
              <button class="btn ghost" data-act="home" data-click>🏠 Home</button>
            </div>
          </div>
        </div>
      </div>`);
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'resume') {
        el.remove();
        this.countdownResume();
      } else if (act === 'sound') {
        save.music = !save.music;
        audio.setMusic(save.music);
        persist();
        e.target.closest('button').textContent = save.music ? '🔊 Music' : '🔇 Music';
      } else if (act === 'home') {
        el.remove();
        this.bankRun(this.game.summary());
        this.title();
      }
    });
    this.overlay(el);
  }

  countdownResume() {
    let n = 3;
    const el = $('<div class="shout" style="animation:none"><b>3</b></div>');
    this.hud.appendChild(el);
    const tick = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(tick);
        el.remove();
        this.game.resume();
      } else el.querySelector('b').textContent = n;
      audio.click();
    }, 550);
  }

  /* --------------------------------------------------------- game over */
  reviveCost() {
    return 150 * Math.pow(2, this.game.revives);
  }

  onOver(run) {
    const cost = this.reviveCost();
    const canRevive = this.game.revives < 2 && save.seeds + run.seeds >= cost;
    if (canRevive) this.revivePrompt(run, cost);
    else this.results(run);
  }

  revivePrompt(run, cost) {
    const el = $(`
      <div class="screen over scrim-full">
        <div class="panel card">
          <div style="font-size:64px">🐘</div>
          <h2 class="h-display" style="font-size:32px;color:var(--sun-2)">Second wind?</h2>
          <p class="muted" style="margin:6px 0 18px">Bibi Tembo can scare Fisi away — for a few golden seeds.</p>
          <div class="stack" style="display:flex;flex-direction:column;gap:12px">
            <button class="btn flame big revive" data-act="revive" data-click>Revive · ${fmt(cost)} <span class="seed"></span><i class="bar"></i></button>
            <button class="btn ghost" data-act="skip" data-click>No thanks</button>
          </div>
        </div>
      </div>`);
    let done = false;
    const finish = (revive) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.remove();
      if (revive) {
        // spend run seeds first, then the bank
        const fromRun = Math.min(this.game.seeds, cost);
        this.game.seeds -= fromRun;
        save.seeds -= cost - fromRun;
        persist();
        this.countdownRevive();
      } else this.results(run);
    };
    const timer = setTimeout(() => finish(false), 5000);
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'revive') finish(true);
      if (act === 'skip') finish(false);
    });
    this.overlay(el);
  }

  countdownRevive() {
    this.game.revive();
    this.speech('🐘', 'Bibi Tembo', 'Shoo, Fisi! Off you go, little one — run!', '#ffb347');
  }

  /** Banks a finished run into the save exactly once. */
  bankRun(run) {
    if (this.bankedId === this.game.runId) return this.lastBank;
    this.bankedId = this.game.runId;
    const newBest = run.score > save.best;
    save.seeds += run.seeds;
    save.runs++;
    if (newBest) save.best = run.score;
    save.bestDistance = Math.max(save.bestDistance, run.distance);
    checkMissions(run.stats);
    persist();
    this.lastBank = { newBest };
    return this.lastBank;
  }

  results(run) {
    const { newBest } = this.bankRun(run);
    this.removeHud();
    const ch = CHAPTERS[Math.max(0, run.chapter)];
    const ms = ensureMissions();
    const beatChallenge = this.challenge && run.score > this.challenge.score;
    const el = $(`
      <div class="screen over scrim-full">
        <div class="panel card">
          <div class="caught">${run.caught ? '🐾 Fisi caught you!' : '💥 Ouch!'}</div>
          <div class="big-score">${fmt(run.score)}</div>
          ${newBest ? '<div class="new-best">★ NEW BEST ★</div>' : `<div class="muted">Best ${fmt(save.best)}</div>`}
          ${beatChallenge ? `<div class="challenge" style="margin-top:12px;justify-content:center">🏆 You beat <b>&nbsp;${esc(this.challenge.name)}</b>!</div>` : ''}
          <div class="stat-grid">
            <div class="stat"><b><span class="seed"></span>${fmt(run.seeds)}</b><span>Seeds</span></div>
            <div class="stat"><b>${fmt(run.distance)}m</b><span>Distance</span></div>
            <div class="stat"><b>${run.stats.allies}</b><span>Allies</span></div>
          </div>
          <div class="story-unlock"><span class="e">${ch.emoji}</span><div><b>Chapter ${run.chapter + 1}: ${esc(ch.title)}</b><br><span class="muted">${run.chapter < CHAPTERS.length - 1 ? `Next chapter at ${fmt(CHAPTERS[run.chapter + 1].at)}m` : 'You reached the legend!'}</span></div></div>
          <div class="mission-mini">
            ${ms.map((m) => `<div><span class="tick ${m.done ? 'done' : ''}">${m.done ? '✓' : ''}</span>${esc(m.text)}</div>`).join('')}
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <button class="btn big" data-act="again" data-click>↻ Run again</button>
            <div class="row2">
              <button class="btn teal" data-act="share" data-click>${ICON.share.replace('<svg', '<svg width="22" height="22"')} Challenge</button>
              <button class="btn ghost" data-act="home" data-click>🏠 Home</button>
            </div>
          </div>
        </div>
      </div>`);
    el.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'again') {
        el.remove();
        this.startRun();
      } else if (act === 'home') {
        el.remove();
        this.title();
      } else if (act === 'share') {
        const r = await shareRun(run);
        if (r === 'copied') this.toast('🔗', 'Challenge link copied — send it to a friend!');
        else if (r === 'downloaded') this.toast('🖼️', 'Score card saved!');
      }
    });
    this.overlay(el);
    if (ms.every((m) => m.done)) setTimeout(() => this.missionSetComplete(), 900);
  }

  missionSetComplete() {
    if (!claimMissionSet()) return;
    audio.buy();
    this.toast('🎉', `<b>Mission set complete!</b><br>Multiplier is now ×${multiplier()} · +${fmt(250 * save.missionLevel)} seeds`, 3600);
  }

  /* ------------------------------------------------------------ sheets */
  sheet(title, body, onBack = () => this.title()) {
    const el = $(`
      <div class="screen scrim-full">
        <div class="sheet-head">
          <button class="icon-btn" data-act="back" data-click aria-label="Back">${ICON.back}</button>
          <h2>${title}</h2>
          <div class="chip"><span class="seed"></span><span class="bank">${fmt(save.seeds)}</span></div>
        </div>
        <div class="sheet-body"></div>
      </div>`);
    el.querySelector('[data-act=back]').addEventListener('click', onBack);
    const b = el.querySelector('.sheet-body');
    if (typeof body === 'string') b.innerHTML = body;
    else b.appendChild(body);
    this.show(el);
    return el;
  }

  allies() {
    const render = () => {
      const body = ALLY_IDS.map((id, i) => {
        const a = ALLIES[id];
        const lvl = save.upgrades[id] ?? 0;
        const cost = UPGRADE_COSTS[lvl];
        const dur = a.base + a.perLevel * lvl;
        return `
          <div class="panel list-card" style="--c:${a.color};animation-delay:${i * 0.05}s">
            <div class="art">${a.emoji}</div>
            <div class="info">
              <h3>${a.name} <span class="muted" style="font-family:var(--body);font-size:13px">the ${a.species}</span></h3>
              <div style="font-size:13px;color:${a.color}">${a.power} · ${dur.toFixed(1)}s</div>
              <p>${a.desc}</p>
              <div class="pips">${Array.from({ length: 5 }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</div>
            </div>
            ${lvl < 5 ? `<button class="btn buy" data-up="${id}" ${save.seeds < cost ? 'disabled' : ''}><span class="seed"></span>${fmt(cost)}</button>` : '<div class="chip">MAX</div>'}
          </div>`;
      }).join('');
      const el = this.sheet('Animal Allies', `<p class="muted" style="margin:0 4px">Grab glowing totems on the trail to call an ally. Upgrade them to make their help last longer.</p>${body}`);
      el.addEventListener('click', (e) => {
        const id = e.target.closest('[data-up]')?.dataset.up;
        if (!id) return;
        const lvl = save.upgrades[id] ?? 0;
        const cost = UPGRADE_COSTS[lvl];
        if (save.seeds < cost) return;
        save.seeds -= cost;
        save.upgrades[id] = lvl + 1;
        persist();
        audio.buy();
        this.toast(ALLIES[id].emoji, `<b>${ALLIES[id].name}</b> upgraded to level ${lvl + 1}!`);
        render();
      });
    };
    render();
  }

  missions() {
    const ms = ensureMissions();
    const ready = ms.every((m) => m.done);
    const el = this.sheet('Missions', `
      <div class="panel mult-hero">
        <div class="x">×${multiplier()}</div>
        <div><b style="font-size:18px">Score multiplier</b><div class="muted" style="font-size:14px">Complete all three missions to raise it by one and earn bonus seeds.</div></div>
      </div>
      ${ms.map((m, i) => `<div class="panel mission ${m.done ? 'done' : ''}" style="animation:rise .4s ${i * 0.06}s ease both"><span class="tick ${m.done ? 'done' : ''}">${m.done ? '✓' : '🎯'}</span><div class="txt">${esc(m.text)}</div></div>`).join('')}
      ${ready ? '<button class="btn big" data-act="claim" data-click>🎉 Claim reward</button>' : ''}
    `);
    el.querySelector('[data-act=claim]')?.addEventListener('click', () => {
      this.missionSetComplete();
      this.missions();
    });
  }

  story() {
    const body = CHAPTERS.map((c, i) => {
      const unlocked = i <= save.chapterSeen;
      return `
        <div class="panel chapter-card ${unlocked ? '' : 'locked'}" style="animation-delay:${i * 0.05}s">
          <div class="e">${unlocked ? c.emoji : '🔒'}</div>
          <div>
            <div class="num">CHAPTER ${i + 1} · ${fmt(c.at)}m</div>
            <h3>${unlocked ? esc(c.title) : '???'}</h3>
            <div class="where">${unlocked ? esc(c.place) : 'Run further to unlock'}</div>
            ${unlocked ? `<blockquote>“${esc(c.line)}” <span class="muted">— ${esc(c.speaker)}</span></blockquote>` : ''}
          </div>
        </div>`;
    }).join('');
    const el = this.sheet('The Story', `<button class="btn ghost wide" data-act="intro" data-click>📖 Replay the prologue</button>${body}`);
    el.querySelector('[data-act=intro]').addEventListener('click', () => this.intro(() => this.title()));
  }

  runners() {
    this.game.toMenu('select');
    const render = () => {
      const r = RUNNERS[this.selIdx];
      this.game.setRunner(r.id);
      const owned = save.owned.includes(r.id);
      const selected = save.runner === r.id;
      const el = $(`
        <div class="screen select scrim-bottom">
          <div class="sheet-head">
            <button class="icon-btn" data-act="back" data-click aria-label="Back">${ICON.back}</button>
            <h2>Runners</h2>
            <div class="chip"><span class="seed"></span><span>${fmt(save.seeds)}</span></div>
          </div>
          <div class="panel select-card">
            <div class="dots">${RUNNERS.map((_, i) => `<i class="${i === this.selIdx ? 'on' : ''}"></i>`).join('')}</div>
            <div class="role">${esc(r.title)}</div>
            <h2>${esc(r.name)}</h2>
            <p>${esc(r.bio)}</p>
            <div class="select-nav">
              <button class="arrow" data-act="prev" aria-label="Previous">‹</button>
              ${owned
                ? `<button class="btn ${selected ? 'ghost' : ''}" data-act="pick" data-click ${selected ? 'disabled' : ''}>${selected ? '✓ Selected' : 'Select'}</button>`
                : `<button class="btn flame" data-act="buy" data-click ${save.seeds < r.cost ? 'disabled' : ''}>Unlock · ${fmt(r.cost)} <span class="seed"></span></button>`}
              <button class="arrow" data-act="next" aria-label="Next">›</button>
            </div>
          </div>
        </div>`);
      el.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'back') {
          this.game.setRunner(save.runner);
          return this.title();
        }
        if (act === 'prev' || act === 'next') {
          this.selIdx = (this.selIdx + (act === 'next' ? 1 : -1) + RUNNERS.length) % RUNNERS.length;
          audio.click();
          return render();
        }
        if (act === 'buy' && save.seeds >= r.cost) {
          save.seeds -= r.cost;
          save.owned.push(r.id);
          save.runner = r.id;
          persist();
          audio.buy();
          this.toast(r.emoji, `<b>${esc(r.name)}</b> joins the run!`);
          return render();
        }
        if (act === 'pick') {
          save.runner = r.id;
          persist();
          render();
        }
      });
      // swipe between runners
      let sx = null;
      el.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
      el.addEventListener('touchend', (e) => {
        if (sx == null) return;
        const dx = e.changedTouches[0].clientX - sx;
        sx = null;
        if (Math.abs(dx) > 50) {
          this.selIdx = (this.selIdx + (dx < 0 ? 1 : -1) + RUNNERS.length) % RUNNERS.length;
          render();
        }
      });
      this.show(el);
    };
    render();
  }

  settings() {
    const row = (key, label) => `<div class="toggle-row"><span>${label}</span><button class="switch ${save[key] ? 'on' : ''}" data-key="${key}" aria-label="${label}"></button></div>`;
    const el = $(`
      <div class="screen modal-wrap scrim-full">
        <div class="panel modal" style="text-align:left">
          <h2 style="text-align:center">Settings</h2>
          ${row('music', '🎵 Music')}
          ${row('sound', '🔊 Sound effects')}
          ${row('haptics', '📳 Vibration')}
          <div style="margin:18px 0 6px" class="muted">Your runner name (shown on challenges)</div>
          <input class="name-input" maxlength="16" placeholder="e.g. Zuri" value="${esc(save.name)}" />
          <div class="stack"><button class="btn" data-act="close" data-click>Done</button></div>
          <p class="muted" style="text-align:center;font-size:12px;margin:16px 0 0">Swipe to move · Arrow keys / WASD on desktop</p>
        </div>
      </div>`);
    el.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-key]');
      if (sw) {
        const k = sw.dataset.key;
        save[k] = !save[k];
        sw.classList.toggle('on', save[k]);
        if (k === 'music') audio.setMusic(save.music);
        if (k === 'sound') audio.setSound(save.sound);
        persist();
        audio.click();
      }
      if (e.target.closest('[data-act=close]') || e.target === el) {
        save.name = el.querySelector('.name-input').value.trim().slice(0, 16);
        persist();
        el.remove();
      }
    });
    this.overlay(el);
  }

  daily() {
    const d = claimDaily();
    if (!d) return;
    const el = $(`
      <div class="screen modal-wrap scrim-full">
        <div class="panel modal">
          <div style="font-size:56px">🌅</div>
          <h2>Jambo! Day ${d.streak}</h2>
          <div class="muted">The savanna rewards those who return.</div>
          <div class="daily-days">
            ${Array.from({ length: 7 }, (_, i) => `<div class="${i < d.streak ? 'on' : ''}"><span>Day ${i + 1}</span><b>${i === 6 ? '🎁' : 50 * (i + 1)}</b></div>`).join('')}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:10px;font-family:var(--display);font-size:34px;color:var(--sun-2)"><span class="seed lg"></span>+${fmt(d.reward)}</div>
          <div class="stack"><button class="btn big" data-act="ok" data-click>Asante!</button></div>
        </div>
      </div>`);
    el.querySelector('[data-act=ok]').addEventListener('click', () => {
      audio.unlock();
      audio.buy();
      el.remove();
      this.title();
    });
    this.overlay(el);
  }
}
