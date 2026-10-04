import { RUNNERS, ALLIES, ALLY_IDS, UPGRADE_COSTS, INTRO, HUNT_WORD } from '../data/content.js';
import { REGIONS, COUNTRIES } from '../data/regions.js';
import { save, persist, ensureMissions, checkMissions, claimMissionSet, multiplier, claimDaily } from '../data/save.js';
import { audio } from '../game/audio.js';
import { whatsAppHref } from './share.js';
import { fetchBoard, leaveDecision, postScore, renderRows, runnerName, scoreSavePlan } from './leaderboard.js';
import { darDay, ghostFrom, parseShareLink, routeForLink } from '../data/daily.js';

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
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/></svg>',
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
    this.link = parseShareLink(this.params);
    this.route = routeForLink(this.link, darDay());
    this.challenge = this.route.challenge;
    this.ghostRun = ghostFrom(this.route.friend, null);
    if (!this.ghostRun) this.loadYesterday();
    this.missionTick = 0;
    this.selIdx = Math.max(0, RUNNERS.findIndex((r) => r.id === save.runner));
    this.postedRunId = null;
    this.postedEntry = null;
    this.lastTop = [];
    this._submitTask = null;
    this.leaveLock = false;

    game.on('hud', (g) => this.updateHud(g));
    game.on('seed', () => this.bumpSeeds());
    game.on('power', (e) => this.onPower(e));
    game.on('chapter', (c) => this.onChapter(c));
    game.on('tutorial', (t) => this.tip(t));
    game.on('shout', (s) => this.shout(s));
    game.on('over', (r) => this.onOver(r));
    game.on('pause', () => this.showPause());
    game.on('warn', (w) => this.onWarn(w));
    game.on('combo', (n) => this.onCombo(n));
    game.on('shield', (e) => this.onShield(e));
    game.on('lap', (e) => this.onLap(e));
    game.on('prize', (e) => this.onPrize(e));
    game.on('letter', (e) => this.paintHunt(e.got));
    game.on('quality', () => this.toast('✨', 'Switched to Low graphics to keep things smooth — change it in Settings.'));
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
    const start = REGIONS[Math.min(save.startRegion ?? 0, save.regionMax ?? 0)];
    const canAfford = RUNNERS.some((r) => !save.owned.includes(r.id) && r.cost <= save.seeds) || ALLY_IDS.some((id) => (save.upgrades[id] ?? 0) < 5 && UPGRADE_COSTS[save.upgrades[id] ?? 0] <= save.seeds);
    const el = $(`
      <div class="screen title scrim-bottom">
        <div class="title-top">
          <div class="chips">
            <div class="chip"><span class="seed"></span><span>${fmt(save.seeds)}</span></div>
            <div class="chip">✖️ ${multiplier()} <span class="muted" style="font-size:12px">MULTIPLIER</span></div>
          </div>
          <div class="title-actions">
            <button class="icon-btn" data-act="board" data-click aria-label="Leaderboard" title="Leaderboard">🏆</button>
            <button class="icon-btn" data-act="settings" data-click aria-label="Settings">${ICON.gear}</button>
          </div>
        </div>
        <div class="logo">
          <h1>KIMBIA!</h1>
          <div class="sub">SPIRIT OF THE SERENGETI</div>
        </div>
        <div class="title-bottom">
          ${this.challenge ? `<div class="challenge"><span style="font-size:28px">🔥</span><div>${this.challenge.sameDay === false
            ? `<b>${esc(this.challenge.name)}</b> ran that on an earlier route. Today's trail is a new one.`
            : `<b>${esc(this.challenge.name)}</b> challenges you to beat <b>${fmt(this.challenge.score)}</b> on today's route!`}</div></div>` : ''}
          ${this.ghostRun ? `<div class="best-line">${esc(this.ghostRun.name)} is a faint runner ahead — pass them.</div>` : ''}
          ${save.best ? `<div class="best-line">Best run <b>${fmt(save.best)}</b> pts · <b>${fmt(save.bestDistance)}m</b></div>` : ''}
          <button class="start-chip" data-act="journey" data-click>
            <span class="flag">${COUNTRIES[start.country].flag}</span>
            <span><small>Starting at</small><b>${esc(start.name)}</b></span>
            <span class="go">🗺️ Change</span>
          </button>
          <button class="btn big play-btn" data-act="play" data-click>▶ RUN!</button>
          <div class="nav-row">
            <button class="nav-btn" data-act="runners" data-click><span class="ico">🧒🏾</span>Runners${canAfford ? '<i class="badge-dot"></i>' : ''}</button>
            <button class="nav-btn" data-act="allies" data-click><span class="ico">🐘</span>Allies</button>
            <button class="nav-btn" data-act="missions" data-click><span class="ico">🎯</span>Missions${missionsReady ? '<i class="badge-dot"></i>' : ''}</button>
            <button class="nav-btn" data-act="journey" data-click><span class="ico">🗺️</span>Journey${(save.regionMax ?? 0) > (save.mapSeen ?? 0) ? '<i class="badge-dot"></i>' : ''}</button>
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
      else if (act === 'journey') this.journey();
      else if (act === 'board') this.showBoard();
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
    this.game.linkedStart = this.route.startRegion;
    this.game.setGhost(this.ghostRun);
    this.show($('<div class="screen" style="pointer-events:none"></div>'));
    this.buildHud();
    this.game.start();
    this.missionTick = 0;
  }

  /** Yesterday's best, when the server has one. A friend link already set the ghost. */
  async loadYesterday() {
    try {
      const data = await fetchBoard('daily');
      if (this.route.friend) return;
      const ghost = ghostFrom(null, data.yesterday);
      if (!ghost) return;
      this.ghostRun = ghost;
      this.game.setGhost(ghost);
    } catch {
      /* no ghost rather than a made-up one */
    }
  }

  buildHud() {
    this.removeHud();
    const el = $(`
      <div class="screen hud">
        <div class="hud-top">
          <div class="score-box">
            <div class="score">0</div>
            <div class="mult">×${multiplier()}</div>
            <div class="ghost-chip" hidden></div>
          </div>
          <div class="hud-right">
            <div class="row">
              <div class="chip seeds-chip"><span class="seed lg"></span><span class="n">0</span><b class="x2" hidden>×2</b></div>
              <button class="icon-btn" data-act="pause" aria-label="Pause" style="width:46px;height:46px">${ICON.pause}</button>
            </div>
            <div class="dist">0m</div>
          </div>
        </div>
        <div class="hunt" aria-label="Daily word hunt">${[...HUNT_WORD].map((c) => `<i>${c}</i>`).join('')}</div>
        <div class="combo"></div>
        <div class="powers"></div>
        <div class="warns"></div>
        <button class="shield-btn" data-act="shield" aria-label="Use Ngao shield"><span class="i">🛡️</span><b class="n">${save.charms ?? 0}</b><i class="ring"></i></button>
      </div>`);
    el.querySelector('[data-act=pause]').addEventListener('click', () => this.game.pause());
    const sb = el.querySelector('[data-act=shield]');
    sb.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!this.game.useShield()) this.toast('🛡️', (save.charms ?? 0) > 0 ? 'Shield already up!' : 'No Ngao charms — get more in Allies');
    });
    sb.classList.toggle('empty', (save.charms ?? 0) <= 0);
    this.hud = el;
    this.hudEls = {
      score: el.querySelector('.score'),
      mult: el.querySelector('.mult'),
      seeds: el.querySelector('.seeds-chip .n'),
      seedsChip: el.querySelector('.seeds-chip'),
      x2: el.querySelector('.seeds-chip .x2'),
      dist: el.querySelector('.dist'),
      ghost: el.querySelector('.ghost-chip'),
      powers: el.querySelector('.powers'),
      combo: el.querySelector('.combo'),
      warns: el.querySelector('.warns'),
      shield: sb,
    };
    this.powerEls = {};
    this.last = {};
    this.overlay(el);
    this.paintHunt(save.hunt?.day === darDay() ? save.hunt.got : 0);
  }

  removeHud() {
    this.hud?.remove();
    this.hud = null;
    (this.timers ?? []).forEach(clearTimeout);
    this.timers = [];
  }

  /** setTimeout that dies with the HUD, so stale bubbles never leak into the next run. */
  later(fn, ms) {
    (this.timers ??= []).push(setTimeout(fn, ms));
  }

  updateHud(g) {
    if (!this.hud) return;
    const E = this.hudEls;
    const s = Math.floor(g.score);
    if (s !== this.last.score) E.score.textContent = fmt((this.last.score = s));
    const d = Math.floor(g.D);
    if (d !== this.last.d) E.dist.textContent = `${fmt((this.last.d = d))}m`;
    if (g.seeds !== this.last.seeds) E.seeds.textContent = fmt((this.last.seeds = g.seeds));
    const boost = g.seedBoost > 0;
    if (boost !== this.last.boost) E.x2.hidden = !(this.last.boost = boost);
    if (boost) E.x2.classList.toggle('ending', g.seedBoost < 2.5);
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
    if (g.shield > 0) E.shield.style.setProperty('--p', (g.shield / 30).toFixed(3));
    const ghost = g.ghostRun;
    if (E.ghost) {
      if (!ghost) E.ghost.hidden = true;
      else {
        const dist = Math.min(ghost.distance, (ghost.distance / ghost.duration) * g.runTime);
        const ahead = Math.round(dist - g.D);
        E.ghost.hidden = false;
        E.ghost.textContent = ahead >= 0 ? `${ghost.name} · ${fmt(ahead)}m ahead` : `Passed ${ghost.name}`;
      }
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
    const country = COUNTRIES[c.country];
    const el = $(`
      <div class="banner">
        <div class="kicker">${country.flag} ${esc(country.name)}${c.lap ? ` · Legend lap ${c.lap + 1}` : ''}</div>
        <h2>${esc(c.name)}</h2>
        <div class="place">${esc(c.title)}</div>
        ${c.unlocked ? '<div class="unlocked">✨ New region unlocked</div>' : ''}
      </div>`);
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 3700);
    this.later(() => this.speech(c.emoji, c.speaker, c.line), c.index === 0 && !c.lap ? 3800 : 2600);
    if (c.unlocked) this.toast(country.flag, `<b>${esc(c.name)}</b> unlocked — start your next run here from the Journey map!`, 3400);
  }

  onWarn({ lane, icon }) {
    if (!this.hud) return;
    const el = $(`<div class="warn" style="left:${[20, 50, 80][lane]}%"><span>${icon}</span><i>!</i></div>`);
    this.hudEls.warns.appendChild(el);
    setTimeout(() => el.remove(), 1600);
    audio.tone('square', 880, 880, 0.06, 0.05);
    audio.tone('square', 880, 880, 0.06, 0.05, 0.12);
  }

  onCombo(n) {
    const el = this.hudEls?.combo;
    if (!el) return;
    if (n < 5) {
      el.classList.remove('on');
      return;
    }
    el.innerHTML = `<b>×${n}</b> combo`;
    el.classList.add('on');
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  onShield({ on, broke }) {
    const b = this.hudEls?.shield;
    if (!b) return;
    b.classList.toggle('active', on);
    b.querySelector('.n').textContent = save.charms ?? 0;
    b.classList.toggle('empty', !on && (save.charms ?? 0) <= 0);
    if (broke) this.flash('rgba(127,224,255,0.55)');
  }

  onLap({ lap }) {
    this.shout({ text: 'Journey complete!', sub: `Legend lap ${lap + 1} · +${fmt(5000 * multiplier())}` });
    this.toast('🏆', '<b>You crossed three countries!</b> The song grows stronger — keep running.', 3600);
  }

  flash(color) {
    const f = $(`<div class="flash" style="background:radial-gradient(circle, rgba(255,255,255,0) 40%, ${color})"></div>`);
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 650);
  }

  tip(t) {
    if (!this.hud) return;
    this.hud.querySelector('.tip')?.remove();
    const el = $(`<div class="tip"><span class="i">${t.icon}</span>${esc(t.text)}</div>`);
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  /** Lights up the letters of the day's word found so far. */
  paintHunt(got) {
    const row = this.hud?.querySelector('.hunt');
    if (!row) return;
    row.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < got));
    row.classList.toggle('done', got >= HUNT_WORD.length);
    row.classList.remove('pop');
    void row.offsetWidth;
    row.classList.add('pop');
  }

  /** A Zawadi box bursts open: the prize pops up over the trail. */
  onPrize({ emoji, title, sub, big }) {
    if (!this.hud) return;
    this.hud.querySelector('.prize')?.remove();
    const el = $(`<div class="prize ${big ? 'big' : ''}"><div class="gift">🎁</div><div class="e">${emoji}</div><b>${esc(title)}</b><span>${esc(sub ?? '')}</span></div>`);
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), big ? 2400 : 1800);
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
    const ri = Math.max(0, run.chapter);
    const reg = REGIONS[ri];
    const next = REGIONS[ri + 1];
    const ms = ensureMissions();
    const beatChallenge = this.challenge && run.score > this.challenge.score;
    const el = $(`
      <div class="screen over scrim-full">
        <div class="panel card">
          <div class="caught">${run.caught ? '🐾 Fisi caught you!' : '💥 Ouch!'}</div>
          ${this.shareCardHtml(run)}
          <div class="big-score">${fmt(run.score)}</div>
          ${newBest ? '<div class="new-best">★ NEW BEST ★</div>' : `<div class="muted">Best ${fmt(save.best)}</div>`}
          ${beatChallenge ? `<div class="challenge" style="margin-top:12px;justify-content:center">🏆 You beat <b>&nbsp;${esc(this.challenge.name)}</b>!</div>` : ''}
          <div class="stat-grid">
            <div class="stat"><b><span class="seed"></span>${fmt(run.seeds)}</b><span>Seeds</span></div>
            <div class="stat"><b>${fmt(run.distance)}m</b><span>Distance</span></div>
            <div class="stat"><b>${run.stats.allies}</b><span>Allies</span></div>
          </div>
          <div class="lb">
            <div class="lb-head"><b>Savanna board</b><span class="muted">Top runs</span></div>
            <div class="lb-slot"><p class="muted">Saving your run…</p></div>
          </div>
          <div class="story-unlock"><span class="e">${COUNTRIES[reg.country].flag}</span><div><b>${esc(reg.name)} · ${esc(reg.title)}</b><br><span class="muted">${next ? `Next: ${COUNTRIES[next.country].flag} ${esc(next.name)}` : 'You crossed all three countries!'}</span></div></div>
          <div class="mission-mini">
            ${ms.map((m) => `<div><span class="tick ${m.done ? 'done' : ''}">${m.done ? '✓' : ''}</span>${esc(m.text)}</div>`).join('')}
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <button class="btn big" type="button" data-act="again">↻ Run again</button>
            <div class="row2">
              <button class="btn teal" type="button" data-act="share">${ICON.share.replace('<svg', '<svg width="22" height="22"')} WhatsApp</button>
              <button class="btn ghost" type="button" data-act="home">🏠 Home</button>
            </div>
          </div>
        </div>
      </div>`);
    el.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'again' || act === 'home') {
        this.leaveResults(el, run, act);
      } else if (act === 'post') {
        this.postRun(el, run);
      } else if (act === 'share') {
        this.shareOnWhatsApp(run);
      } else if (act === 'board') {
        this.showBoard();
      }
    });
    this.overlay(el);
    this.recordFinishedRun(el, run);
    if (ms.every((m) => m.done)) setTimeout(() => this.missionSetComplete(), 900);
  }

  shareCardHtml(run) {
    const miss = run.nearMiss?.line
      ? `${esc(run.nearMiss.line)} · ${esc(run.nearMiss.shout)}`
      : 'Clean run · no close call';
    return `
      <div class="share-card">
        <div class="share-kicker">Today's route</div>
        <div class="share-dist">${fmt(run.distance)}m</div>
        <div class="share-rank" data-share-rank>Today <span class="muted">…</span></div>
        <div class="share-miss">${miss}</div>
      </div>`;
  }

  paintDailyRank(root, daily, failed = false) {
    const el = root.querySelector('[data-share-rank]');
    if (!el) return;
    if (daily?.rank) {
      el.innerHTML = `Today <b>#${fmt(daily.rank)}</b>`;
      return;
    }
    el.textContent = failed ? "Today's rank didn't save" : 'Today — off the board';
  }

  shareOnWhatsApp(run) {
    const href = whatsAppHref({
      ...run,
      name: save.name || run.name,
      runner: run.runner || save.runner,
    });
    const opened = window.open(href, '_blank', 'noopener,noreferrer');
    if (!opened) {
      navigator.clipboard?.writeText(href).then(
        () => this.toast('🔗', 'WhatsApp link copied — send it to a friend!'),
        () => this.toast('📲', href),
      );
    }
  }

  /** Saves a finished run. A stored name posts immediately; otherwise the card asks. */
  recordFinishedRun(root, run) {
    const plan = scoreSavePlan(save.name);
    if (plan.action === 'save' && run.score > 0) {
      this.submitRun(root, run, plan.name);
      return;
    }
    if (!(run.score > 0)) this.paintDailyRank(root, null);
    this.loadPreview(root, run, plan.action === 'ask');
  }

  async loadPreview(root, run, ask) {
    let top = [];
    let error = '';
    try {
      top = (await fetchBoard()).top || [];
    } catch (err) {
      error = err.message || 'The board is quiet right now.';
    }
    if (!root.isConnected || this.postedRunId === this.game.runId) return;
    this.lastTop = top;
    this.paintBoard(root, top, null, error, run, ask);
    if (ask) root.querySelector('[data-lb-name]')?.focus();
  }

  /**
   * Posts this run once. Later callers share the same request so Run again
   * cannot fire a second insert or leave before the first one finishes.
   */
  submitRun(root, run, name) {
    if (this.postedRunId === this.game.runId) return Promise.resolve(true);
    if (this._submitTask) return this._submitTask;
    const slot = root.querySelector('.lb-slot');
    if (slot && !slot.querySelector('.lb-list') && !slot.querySelector('[data-lb-name]')) {
      slot.innerHTML = '<p class="muted">Saving your run…</p>';
    }
    let finish;
    const task = new Promise((resolve) => {
      finish = resolve;
    });
    this._submitTask = task;
    (async () => {
      try {
        const data = await postScore({
          name,
          score: run.score,
          distance: run.distance,
          seeds: run.seeds,
          allies: run.stats?.allies ?? 0,
          chapter: Math.max(0, run.chapter || 0),
          runner: save.runner,
          duration: Math.max(0, Math.round(run.duration || 0)),
        });
        save.name = data.entry.name;
        save.playerId = data.entry.id;
        persist();
        this.postedRunId = this.game.runId;
        this.postedEntry = data.entry;
        this.lastTop = data.top;
        if (data.daily?.rank) run.rank = data.daily.rank;
        if (root.isConnected) {
          this.paintBoard(root, data.top, data.entry, '', run);
          this.paintDailyRank(root, data.daily);
        }
        if (data.entry.improved && data.entry.rank) audio.buy();
        finish(true);
      } catch (err) {
        if (root.isConnected) {
          let top = this.lastTop;
          try { top = (await fetchBoard()).top || top; } catch { /* keep the card usable */ }
          this.lastTop = top;
          const message = err.code === 'NAME_TAKEN'
            ? `“${name}” is taken. Pick another name.`
            : (err.message || 'Could not save your score');
          this.paintBoard(root, top, null, message, run, true);
          this.paintDailyRank(root, null, true);
          root.querySelector('[data-lb-name]')?.focus();
        }
        finish(false);
      }
    })();
    return task.finally(() => {
      if (this._submitTask === task) this._submitTask = null;
    });
  }

  leaveResults(root, run, where) {
    if (this.leaveLock) return;
    this.leaveLock = true;
    this.finishLeave(root, run, where).finally(() => {
      this.leaveLock = false;
    });
  }

  async finishLeave(root, run, where) {
    const typed = root.querySelector('[data-lb-name]')?.value ?? '';
    const worthSaving = run.score > 0 || !!runnerName(typed);
    const decision = leaveDecision({
      alreadySaved: this.postedRunId === this.game.runId || !worthSaving,
      savedName: run.score > 0 ? save.name : '',
      typedName: typed,
    });
    if (decision.action === 'ask') {
      this.paintBoard(root, this.lastTop, null, 'Add your name so this run is saved.', run, true);
      root.querySelector('[data-lb-name]')?.focus();
      return;
    }
    if (decision.action === 'save') {
      const ok = await this.submitRun(root, run, decision.name);
      if (!ok || !root.isConnected) return;
    }
    root.remove();
    if (where === 'again') this.startRun();
    else this.title();
  }

  paintBoard(root, top, entry, error, run, needName = false) {
    const slot = root.querySelector('.lb-slot');
    if (!slot) return;
    const preview = (top || []).slice(0, 5);
    let head = '';
    if (entry) {
      const rank = entry.rank ? `You're <b>#${fmt(entry.rank)}</b> on the savanna board` : 'Finish a run with points to make the board';
      const note = entry.improved ? '🎉 New personal best!' : `Your best: <b>${fmt(entry.score)}</b>`;
      head = `<div class="lb-placed">${rank}<span class="lb-note">${note}</span></div>`;
    } else if (needName) {
      const draft = slot.querySelector('[data-lb-name]')?.value ?? save.name;
      head = `
        <p class="lb-ask">Pick your runner name. It's yours for good, and your best run will post by itself after every game.</p>
        <form class="lb-form">
          <input class="name-input" maxlength="16" data-lb-name placeholder="Your name" value="${esc(draft)}" autocomplete="nickname" enterkeyhint="done" />
          <button class="btn teal wide" type="submit" data-act="post">Save score</button>
        </form>`;
    }
    const msg = `<p class="lb-msg">${esc(error)}</p>`;
    const youId = save.playerId ?? null;
    const list = preview.length
      ? renderRows(preview, { youId, youName: '' })
      : (error ? '' : '<p class="muted lb-empty">No scores yet. Be the first name on the board.</p>');
    slot.innerHTML = `${head}${msg}${list}<button class="lb-more" type="button" data-act="board">Full board ›</button>`;
    slot.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.postRun(root, run);
    });
  }

  /** Name picked on the game-over card: claim it and post this run in one go. */
  postRun(root, run) {
    const input = root.querySelector('[data-lb-name]');
    const decision = leaveDecision({ alreadySaved: false, savedName: '', typedName: input?.value ?? '' });
    if (decision.action !== 'save') {
      const msg = root.querySelector('.lb-msg');
      if (msg) msg.textContent = 'Add your name so this run is saved.';
      input?.focus();
      return;
    }
    this.submitRun(root, run, decision.name);
  }

  showBoard() {
    this.root.querySelector('.lb-screen')?.remove();
    const el = $(`
      <div class="screen scrim-full lb-screen">
        <div class="sheet-head">
          <button class="icon-btn" data-act="back" data-click aria-label="Back">${ICON.back}</button>
          <h2>Leaderboard</h2>
          <div class="chip">🏆</div>
        </div>
        <div class="sheet-body">
          <div class="lb-tabs">
            <button type="button" data-board="all" class="on">All-time</button>
            <button type="button" data-board="daily">Today</button>
          </div>
          <div class="lb-rows"></div>
        </div>
      </div>`);
    const rows = el.querySelector('.lb-rows');
    const close = () => el.remove();
    el.querySelector('[data-act=back]').addEventListener('click', close);
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-click]')) audio.click();
    });
    el.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-board]');
      if (tab) {
        el.querySelectorAll('[data-board]').forEach((b) => b.classList.toggle('on', b === tab));
        this.fillBoard(rows, tab.dataset.board);
        return;
      }
      if (e.target.closest('[data-act=retry]')) {
        const which = el.querySelector('[data-board].on')?.dataset.board || 'all';
        this.fillBoard(rows, which);
      }
    });
    this.overlay(el);
    this.fillBoard(rows, 'all');
  }

  async fillBoard(body, board = 'all') {
    const daily = board === 'daily';
    body.innerHTML = `<p class="muted">${daily ? "Loading today's route…" : 'Loading the savanna board…'}</p>`;
    try {
      if (this._submitTask) await this._submitTask;
      const data = await fetchBoard(daily ? 'daily' : undefined);
      if (!body.isConnected) return;
      const youId = save.playerId ?? null;
      const top = data.top || [];
      const intro = daily
        ? `<p class="muted" style="margin:0 4px">Today's route · ${esc(data.day || '')} · resets at midnight in Dar es Salaam.</p>`
        : '<p class="muted" style="margin:0 4px">One best run per runner, ranked by score.</p>';
      const empty = daily
        ? '<div class="panel lb-empty-card"><div class="e">🌅</div><p>No scores on today\'s route yet. Finish a run and it lands here.</p></div>'
        : '<div class="panel lb-empty-card"><div class="e">🌱</div><p>No scores yet. Finish a run and put your name on the board.</p></div>';
      body.innerHTML = top.length ? `${intro}${renderRows(top, { youId, youName: '' })}` : empty;
    } catch (err) {
      if (!body.isConnected) return;
      body.innerHTML = `
        <div class="panel lb-empty-card">
          <div class="e">🌫️</div>
          <p>${esc(err.message || 'Could not load the board')}</p>
          <button class="btn" data-act="retry" data-click style="margin-top:14px">Try again</button>
        </div>`;
    }
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
      const charm = `
        <div class="panel list-card" style="--c:#7fe0ff">
          <div class="art">🛡️</div>
          <div class="info">
            <h3>Ngao Shield <span class="muted" style="font-family:var(--body);font-size:13px">× ${save.charms ?? 0} owned</span></h3>
            <div style="font-size:13px;color:#7fe0ff">Tap 🛡️ while running · 30s</div>
            <p>A Maasai-style shield charm that absorbs one crash and keeps your run alive.</p>
          </div>
          <button class="btn buy" data-charm ${save.seeds < 300 ? 'disabled' : ''}><span class="seed"></span>300</button>
        </div>`;
      const el = this.sheet('Animal Allies', `<p class="muted" style="margin:0 4px">Grab glowing totems on the trail to call an ally. Upgrade them to make their help last longer.</p>${charm}${body}`);
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-charm]') && save.seeds >= 300) {
          save.seeds -= 300;
          save.charms = (save.charms ?? 0) + 1;
          persist();
          audio.buy();
          this.toast('🛡️', `Ngao shield ready! You have <b>${save.charms}</b>.`);
          return render();
        }
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

  journey() {
    save.mapSeen = save.regionMax ?? 0;
    persist();
    const max = save.regionMax ?? 0;
    const sel = Math.min(save.startRegion ?? 0, max);
    let html = `
      <div class="journey-head panel">
        <div><b>${max + 1}</b> / ${REGIONS.length} regions discovered</div>
        <div class="journey-bar"><i style="width:${((max + 1) / REGIONS.length) * 100}%"></i></div>
        <button class="btn ghost wide" data-act="intro" data-click style="min-height:46px;font-size:17px">📖 Replay the prologue</button>
      </div>`;
    let lastCountry = null;
    REGIONS.forEach((r, i) => {
      const c = COUNTRIES[r.country];
      if (r.country !== lastCountry) {
        lastCountry = r.country;
        html += `<div class="country-head" style="--cc:${c.color}"><span>${c.flag}</span>${esc(c.name)}</div>`;
      }
      const open = i <= max;
      html += `
        <div class="panel region-card ${open ? '' : 'locked'} ${i === sel ? 'selected' : ''}" style="animation-delay:${i * 0.04}s">
          <div class="node">${open ? r.emoji : '🔒'}</div>
          <div class="info">
            <div class="num">${i === 0 ? 'START' : `${(r.at / 1000).toFixed(1)} km`} · ${esc(r.title)}</div>
            <h3>${open ? esc(r.name) : '???'}</h3>
            <p>${open ? esc(r.blurb) : 'Keep running to discover this place.'}</p>
            ${open ? `<blockquote>“${esc(r.line)}” <span class="muted">— ${esc(r.speaker)}</span></blockquote>` : ''}
            ${open ? `<button class="btn ${i === sel ? 'ghost' : 'teal'} start-here" data-start="${i}" ${i === sel ? 'disabled' : ''}>${i === sel ? '✓ Starting here' : 'Start runs here'}</button>` : ''}
          </div>
        </div>`;
    });
    const el = this.sheet('The Journey', html);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-act=intro]')) return this.intro(() => this.journey());
      const st = e.target.closest('[data-start]');
      if (st) {
        save.startRegion = Number(st.dataset.start);
        persist();
        audio.buy();
        this.title();
      }
    });
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
          <div class="toggle-row"><span>✨ Graphics</span><div class="seg" role="group">${['auto', 'high', 'low'].map((q) => `<button class="${(save.quality ?? 'auto') === q ? 'on' : ''}" data-q="${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div></div>
          <div style="margin:18px 0 6px" class="muted">Your runner name (shown on challenges)</div>
          <input class="name-input" maxlength="16" placeholder="e.g. Zuri" value="${esc(save.name)}" />
          <div class="stack"><button class="btn" data-act="close" data-click>Done</button></div>
          <p class="muted" style="text-align:center;font-size:12px;margin:16px 0 0">Swipe to move · Arrow keys / WASD on desktop</p>
        </div>
      </div>`);
    el.addEventListener('click', (e) => {
      const qb = e.target.closest('[data-q]');
      if (qb) {
        this.game.setQuality(qb.dataset.q);
        el.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('on', b === qb));
        audio.click();
      }
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
        const name = el.querySelector('.name-input').value.trim().slice(0, 16);
        el.remove();
        if (name && name !== save.name) this.claimName(name);
      }
    });
    this.overlay(el);
  }

  /** Claims (or renames to) a unique runner name without posting a run. */
  async claimName(name) {
    const previous = save.name;
    try {
      const data = await postScore({ name, score: 0, distance: 0, seeds: 0, allies: 0, chapter: 0, runner: save.runner });
      save.name = data.entry.name;
      save.playerId = data.entry.id;
      persist();
      this.toast('✅', `You're now <b>${esc(save.name)}</b> on the leaderboard.`);
    } catch (err) {
      if (err.code === 'NAME_TAKEN') this.toast('🙅', `<b>${esc(name)}</b> is already taken. Try another name.`, 3200);
      else if (err.status === 503) {
        // no leaderboard configured (e.g. local dev): keep the name locally
        save.name = name;
        persist();
      } else this.toast('📡', 'Couldn\'t reach the leaderboard. Your name wasn\'t changed.');
      if (save.name !== name) save.name = previous;
    }
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
