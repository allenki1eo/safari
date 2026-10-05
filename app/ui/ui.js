import { RUNNERS, ALLIES, ALLY_IDS, UPGRADE_COSTS, INTRO, OUTFITS, outfitId, HUNT_WORDS, BOOSTS } from '../data/content.js';
import { REGIONS, COUNTRIES } from '../data/regions.js';
import {
  save, persist, ensureMissions, checkMissions, claimMissionSet, multiplier, claimDaily,
  collectMission, skipMission, skipCost, setBonus, missionSetReady, uncollected,
} from '../data/save.js';
import { audio } from '../game/audio.js';
import { challengeUrl, makeCard, shareText } from './share.js';
import { fetchBoard, leaveDecision, postScore, renderRows, runnerName, scoreSavePlan } from './leaderboard.js';
import { darDay, ghostFrom, huntWord, parseShareLink, routeForLink } from '../data/daily.js';
import { STAKES, acceptBet, collectBets, createChallenge, fetchChallenge, finishBet, linkOrigin } from './challenges.js';
import { install } from './install.js';
import { onLoading } from '../game/loading.js';
import { t, missionText, shareMessage, lang, LANGS, setLang } from '../i18n.js';

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
  install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/></svg>',
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
    this.route = routeForLink(this.link);
    this.challenge = this.route.challenge;
    // the shadow runner only ever comes from a friend's challenge
    this.ghostRun = ghostFrom(this.route.friend);
    this.remote = null; // the challenge as the server has it (recording, bet)
    this.bet = null; // a bet taken on this device, settled when the next run ends
    if (this.route.id) this.loadChallenge(this.route.id);
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
    game.on('boost', (e) => this.onBoost(e));
    game.on('boostIntro', ({ id }) => {
      const b = BOOSTS[id];
      this.later(() => this.speech(b.emoji, t('New powerup · {name}', { name: b.name }), b.intro, b.color), 1400);
    });
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
    game.on('letter', (e) => this.paintHunt(e.word, e.got));
    // the next word in today's chain takes over once the prize card has had its moment
    game.on('hunt', (e) => setTimeout(() => this.paintHunt(e.word, e.got, true), e.delay));
    game.on('quality', () => this.toast('✨', t('Switched to Low graphics to keep things smooth — change it in Settings.')));
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
    const missionsReady = missions.some((m) => m.done && !m.claimed) || missionSetReady();
    const start = REGIONS[Math.min(save.startRegion ?? 0, save.regionMax ?? 0)];
    const canAfford = RUNNERS.some((r) => !save.owned.includes(r.id) && r.cost <= save.seeds) || ALLY_IDS.some((id) => (save.upgrades[id] ?? 0) < 5 && UPGRADE_COSTS[save.upgrades[id] ?? 0] <= save.seeds);
    const el = $(`
      <div class="screen title scrim-bottom">
        <div class="title-top">
          <div class="chips">
            <div class="chip"><span class="seed"></span><span>${fmt(save.seeds)}</span></div>
            <div class="chip">✖️ ${multiplier()} <span class="muted" style="font-size:12px">${t('MULTIPLIER')}</span></div>
          </div>
          <div class="title-actions">
            ${install.offered ? `<button class="install-pill" data-act="install" data-click aria-label="${t('Install Kimbia! on this device')}">${ICON.install}<span>${t('Install')}</span></button>` : ''}
            <button class="icon-btn" data-act="board" data-click aria-label="${t('Leaderboard')}" title="${t('Leaderboard')}">🏆</button>
            <button class="icon-btn" data-act="settings" data-click aria-label="${t('Settings')}">${ICON.gear}</button>
          </div>
        </div>
        <div class="logo">
          <h1>KIMBIA!</h1>
          <div class="sub">${t('SPIRIT OF THE SERENGETI')}</div>
        </div>
        <div class="title-bottom">
          ${this.challengeCardHtml()}
          ${save.best ? `<div class="best-line">${t('Best run {score} pts · {dist}m', { score: `<b>${fmt(save.best)}</b>`, dist: `<b>${fmt(save.bestDistance)}` })}</b></div>` : ''}
          <button class="start-chip" data-act="journey" data-click>
            <span class="flag">${COUNTRIES[start.country].flag}</span>
            <span><small>${t('Starting at')}</small><b>${esc(start.name)}</b></span>
            <span class="go">🗺️ ${t('Change')}</span>
          </button>
          <div class="herd-loading" hidden><span class="label">${t('🐾 The herd is on its way…')}</span><i><b></b></i></div>
          <button class="btn big play-btn" data-act="play" data-click>${t('▶ RUN!')}</button>
          <div class="nav-row">
            <button class="nav-btn" data-act="runners" data-click><span class="ico">🧒🏾</span>${t('Runners')}${canAfford ? '<i class="badge-dot"></i>' : ''}</button>
            <button class="nav-btn" data-act="allies" data-click><span class="ico">🐘</span>${t('Allies')}</button>
            <button class="nav-btn" data-act="missions" data-click><span class="ico">🎯</span>${t('Missions')}${missionsReady ? '<i class="badge-dot"></i>' : ''}</button>
            <button class="nav-btn" data-act="journey" data-click><span class="ico">🗺️</span>${t('Journey')}${(save.regionMax ?? 0) > (save.mapSeen ?? 0) ? '<i class="badge-dot"></i>' : ''}</button>
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
      else if (act === 'install') this.installApp();
      else if (act === 'take-bet') this.takeBet(e.target.closest('button'));
    });
    this.show(el);
    this.collectWinnings();
    // the pill glows once the browser says it can install; it leaves once installed
    this.offInstall?.();
    this.offInstall = install.on((ev) => {
      const pill = el.querySelector('.install-pill');
      if (ev === 'ready') pill?.classList.add('ready');
      if (ev === 'installed' || ev === 'accepted') pill?.remove();
    });
    if (install.how === 'prompt') el.querySelector('.install-pill')?.classList.add('ready');
    // the models download in the background; show them arriving (a run can start any time)
    this.offLoading?.();
    const bar = el.querySelector('.herd-loading');
    let settled = true; // already all here when the screen opened: no bar at all
    this.offLoading = onLoading(({ done, total, ready }) => {
      if (!total || (ready && settled)) return;
      settled = false;
      bar.hidden = false;
      bar.querySelector('b').style.width = `${Math.round((done / total) * 100)}%`;
      bar.classList.toggle('done', ready);
      if (ready) {
        bar.querySelector('.label').textContent = t('🐾 The herd is here');
        setTimeout(() => (bar.hidden = true), 2000);
      }
    });
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
            <button class="skip" data-act="skip">${t('Skip story')}</button>
            <div class="progress">${INTRO.map(() => '<i></i>').join('')}</div>
            <button class="btn" data-act="next" data-click style="min-height:50px;font-size:20px">${t('Next ›')}</button>
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
      el.querySelector('[data-act=next]').textContent = i === INTRO.length - 1 ? t('Run! ›') : t('Next ›');
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
    this.game.linkedRoute = this.route.route;
    this.game.setGhost(this.ghostRun);
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
            <div class="ghost-chip" hidden></div>
          </div>
          <div class="hud-right">
            <div class="row">
              <div class="chip seeds-chip"><span class="seed lg"></span><span class="n">0</span><b class="x2" hidden>×2</b></div>
              <button class="icon-btn" data-act="pause" aria-label="${t('Pause')}" style="width:46px;height:46px">${ICON.pause}</button>
            </div>
            <div class="dist">0m</div>
          </div>
        </div>
        <div class="hunt" aria-label="${t('Word hunt')}"></div>
        <div class="combo"></div>
        <div class="powers"></div>
        <div class="warns"></div>
        <button class="shield-btn" data-act="shield" aria-label="${t('Use Ngao shield')}"><span class="i">🛡️</span><b class="n">${save.charms ?? 0}</b><i class="ring"></i></button>
      </div>`);
    el.querySelector('[data-act=pause]').addEventListener('click', () => this.game.pause());
    const sb = el.querySelector('[data-act=shield]');
    sb.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!this.game.useShield()) this.toast('🛡️', (save.charms ?? 0) > 0 ? t('Shield already up!') : t('No Ngao charms — get more in Allies'));
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
    this.boostEls = {};
    this.last = {};
    this.overlay(el);
    const today = save.hunt?.day === darDay();
    this.paintHunt(huntWord(HUNT_WORDS, darDay(), today ? save.hunt.done ?? 0 : 0).word, today ? save.hunt.got : 0);
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
    for (const [id, el] of Object.entries(this.boostEls)) {
      const left = g.boosts[id] ?? 0;
      el.style.setProperty('--p', Math.max(0, left / BOOSTS[id].dur).toFixed(3));
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
        E.ghost.textContent = ahead >= 0 ? t('{name} · {m}m ahead', { name: ghost.name, m: fmt(ahead) }) : t('Passed {name}', { name: ghost.name });
      }
    }
    // missions — checked a few times per second
    if ((this.missionTick += 1) % 20 === 0) {
      for (const done of checkMissions(g.stats)) this.toast('🎯', `<b>${t('Mission complete!')}</b><br>${esc(missionText(done))}<br><span class="toast-reward">+${fmt(done.reward)} <span class="seed"></span> ${t('to collect at the finish')}</span>`);
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
      this.speech(a.emoji, t('{name} the {species}', { name: a.name, species: a.species }), line, a.color);
    } else {
      this.powerEls[id]?.remove();
      delete this.powerEls[id];
    }
  }

  /** A timed powerup's chip sits with the allies' chips and drains as it runs out. */
  onBoost({ id, on }) {
    if (!this.hud) return;
    if (on && !this.boostEls[id]) {
      const b = BOOSTS[id];
      const el = $(`<div class="power boost" style="--c:${b.color}" title="${esc(b.name)}"><span>${b.emoji}</span>${b.tag ? `<b class="tag">${esc(b.tag)}</b>` : ''}</div>`);
      this.hudEls.powers.appendChild(el);
      this.boostEls[id] = el;
    } else if (!on) {
      this.boostEls[id]?.remove();
      delete this.boostEls[id];
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
        <div class="kicker">${country.flag} ${esc(country.name)}${c.lap ? ` · ${t('Legend lap {n}', { n: c.lap + 1 })}` : ''}</div>
        <h2>${esc(c.name)}</h2>
        <div class="place">${esc(c.title)}</div>
        ${c.unlocked ? `<div class="unlocked">${t('✨ New region unlocked')}</div>` : ''}
      </div>`);
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 3700);
    this.later(() => this.speech(c.emoji, c.speaker, c.line), c.index === 0 && !c.lap ? 3800 : 2600);
    if (c.unlocked) this.toast(country.flag, t('{name} unlocked — start your next run here from the Journey map!', { name: `<b>${esc(c.name)}</b>` }), 3400);
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
    el.innerHTML = `<b>×${n}</b> ${t('combo')}`;
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
    this.shout({ text: t('Journey complete!'), sub: `${t('Legend lap {n}', { n: lap + 1 })} · +${fmt(5000 * multiplier())}` });
    this.toast('🏆', t('<b>You crossed three countries!</b> The song grows stronger — keep running.'), 3600);
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

  /** Shows the word being hunted, its found letters lit; a new word slides in fresh. */
  paintHunt(word, got, fresh = false) {
    const row = this.hud?.querySelector('.hunt');
    if (!row) return;
    if (row.dataset.word !== word) {
      row.dataset.word = word;
      row.innerHTML = [...word].map((c) => `<i>${c}</i>`).join('');
      row.classList.toggle('long', word.length > 8);
      row.setAttribute('aria-label', t('Word hunt: {word}', { word }));
    }
    row.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < got));
    row.classList.toggle('done', got >= word.length);
    row.classList.remove('pop', 'fresh');
    void row.offsetWidth;
    row.classList.add(fresh ? 'fresh' : 'pop');
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
          <h2>${t('Paused')}</h2>
          <div class="muted">${t('Fisi is waiting… catch your breath.')}</div>
          <div class="mission-mini" style="margin-top:16px">
            ${ms.map((m) => `<div><span class="tick ${m.done ? 'done' : ''}">${m.done ? '✓' : ''}</span>${esc(missionText(m))}</div>`).join('')}
          </div>
          <div class="stack">
            <button class="btn" data-act="resume" data-click>${t('▶ Keep running')}</button>
            <div class="row2">
              <button class="btn ghost" data-act="sound" data-click>${save.music ? t('🔊 Music') : t('🔇 Music')}</button>
              <button class="btn ghost" data-act="home" data-click>${t('🏠 Home')}</button>
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
        e.target.closest('button').textContent = save.music ? t('🔊 Music') : t('🔇 Music');
      } else if (act === 'home') {
        el.remove();
        const run = this.game.summary();
        this.bankRun(run);
        if (this.bet) this.settleBet(null, run); // leaving a bet run counts as its finish
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
          <h2 class="h-display" style="font-size:32px;color:var(--sun-2)">${t('Second wind?')}</h2>
          <p class="muted" style="margin:6px 0 18px">${t('Bibi Tembo can scare Fisi away — for a few golden seeds.')}</p>
          <div class="stack" style="display:flex;flex-direction:column;gap:12px">
            <button class="btn flame big revive" data-act="revive" data-click>${t('Revive')} · ${fmt(cost)} <span class="seed"></span><i class="bar"></i></button>
            <button class="btn ghost" data-act="skip" data-click>${t('No thanks')}</button>
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
    this.speech('🐘', 'Bibi Tembo', t('Shoo, Fisi! Off you go, little one — run!'), '#ffb347');
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
    const beatChallenge = this.challenge && run.score > this.challenge.score;
    const el = $(`
      <div class="screen over scrim-full">
        <div class="panel card">
          <div class="caught">${run.caught ? t('🐾 Fisi caught you!') : t('💥 Ouch!')}</div>
          ${this.shareCardHtml(run)}
          <div class="big-score">${fmt(run.score)}</div>
          ${newBest ? `<div class="new-best">${t('★ NEW BEST ★')}</div>` : `<div class="muted">${t('Best {n}', { n: fmt(save.best) })}</div>`}
          ${beatChallenge ? `<div class="challenge" style="margin-top:12px;justify-content:center">🏆 ${t('You beat')} <b>&nbsp;${esc(this.challenge.name)}</b>!</div>` : ''}
          <div class="stat-grid">
            <div class="stat"><b><span class="seed"></span>${fmt(run.seeds)}</b><span>${t('Seeds')}</span></div>
            <div class="stat"><b>${fmt(run.distance)}m</b><span>${t('Distance')}</span></div>
            <div class="stat"><b>${run.stats.allies}</b><span>${t('Allies')}</span></div>
            <div class="stat"><b>🎁 ${run.stats.boxes ?? 0}</b><span>Zawadi</span></div>
          </div>
          <div class="lb">
            <div class="lb-head"><b>${t('Savanna board')}</b><span class="muted">${t('Top runs')}</span></div>
            <div class="lb-slot"><p class="muted">${t('Saving your run…')}</p></div>
          </div>
          <div class="story-unlock"><span class="e">${COUNTRIES[reg.country].flag}</span><div><b>${esc(reg.name)} · ${esc(reg.title)}</b><br><span class="muted">${next ? t('Next: {place}', { place: `${COUNTRIES[next.country].flag} ${esc(next.name)}` }) : t('You crossed all three countries!')}</span></div></div>
          <div class="bet-slot"></div>
          <div class="chal-slot"></div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <button class="btn big" type="button" data-act="again">${t('↻ Run again')}</button>
            <div class="row2">
              <button class="btn teal" type="button" data-act="share">${ICON.share.replace('<svg', '<svg width="22" height="22"')} WhatsApp</button>
              <button class="btn ghost" type="button" data-act="home">${t('🏠 Home')}</button>
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
        this.challengeSheet(run);
      } else if (act === 'board') {
        this.showBoard();
      }
    });
    this.overlay(el);
    this.cardFor(run); // draw the score card now, so the share can happen inside the tap
    this.recordFinishedRun(el, run);
    this.mountChallenges(el.querySelector('.chal-slot'));
    if (this.bet) this.settleBet(el, run);
  }

  /* ------------------------------------------------------ friend challenges */
  /** Opens a friend's challenge from the server: their route, shadow-runner recording and bet. */
  async loadChallenge(id) {
    try {
      const ch = await fetchChallenge(id);
      this.remote = ch;
      this.route = { ...this.route, id: ch.id, route: ch.route, startRegion: ch.startRegion };
      this.challenge = { name: ch.name, score: ch.score };
      this.ghostRun = ghostFrom(ch);
      if (this.screen?.classList.contains('title')) this.title();
    } catch {
      /* the link's own numbers still make a challenge, just without the recording or bet */
    }
  }

  challengeCardHtml() {
    if (!this.challenge) return '';
    const ch = this.remote;
    const name = `<b>${esc(this.challenge.name)}</b>`;
    let bet = '';
    if (ch?.stake > 0) {
      const own = (save.betsOut ?? []).includes(ch.id);
      const pot = `<b>${fmt(ch.stake * 2)}</b>&nbsp;<span class="seed"></span>`;
      if (this.bet?.id === ch.id) {
        bet = `<div class="bet-line on">🤝 ${t('Bet on! Beat {score} to win {pot}', { score: `<b>${fmt(ch.score)}</b>`, pot })}</div>`;
      } else if (own) {
        bet = `<div class="bet-line">${t('Your bet: {stake} coins on this run', { stake: fmt(ch.stake) })}</div>`;
      } else if (ch.status === 'open') {
        const short = save.seeds < ch.stake;
        bet = `
          <div class="bet-line">${t('Bet {stake} coins · winner takes {pot}', { stake: `<b>${fmt(ch.stake)}</b>`, pot })}</div>
          <button class="btn small flame bet-take" data-act="take-bet" data-click ${short ? 'disabled' : ''}>🤝 ${t('Take the bet')} · ${fmt(ch.stake)} <span class="seed"></span></button>
          ${short ? `<div class="bet-note">${t('You need {n} coins to take this bet.', { n: fmt(ch.stake) })}</div>` : ''}`;
      } else {
        bet = `<div class="bet-line">${ch.rivalName ? t('{name} already took this bet — race the shadow anyway.', { name: esc(ch.rivalName) }) : t('This bet is closed — race the shadow anyway.')}</div>`;
      }
    }
    return `
      <div class="challenge challenge-card">
        <span class="ch-ico">🔥</span>
        <div class="ch-body">
          <div>${t('{name} challenges you to beat {score}!', { name, score: `<b>${fmt(this.challenge.score)}</b>` })}</div>
          ${this.ghostRun ? `<div class="ch-sub">👻 ${t('Their shadow runner races you on the same route.')}</div>` : ''}
          ${bet}
        </div>
      </div>`;
  }

  async takeBet(btn) {
    const ch = this.remote;
    if (!ch || this.bet) return;
    btn.disabled = true;
    try {
      await acceptBet(ch.id, save.name || t('A friend'));
      this.bet = { id: ch.id, stake: ch.stake, pot: ch.stake * 2, score: ch.score, name: ch.name };
      audio.buy();
      this.toast('🤝', t('Bet on! Beat {score} to win {pot} coins.', { score: fmt(ch.score), pot: fmt(ch.stake * 2) }));
      this.startRun();
    } catch (err) {
      if (err.code === 'TAKEN' || err.code === 'OWN') this.remote = { ...ch, status: 'taken' };
      this.toast('⚠️', esc(err.message));
      this.title();
    }
  }

  /** Reports a bet run and shows who took the pot. `root` is the results card (or null). */
  async settleBet(root, run) {
    const bet = this.bet;
    this.bet = null;
    const slot = root?.querySelector('.bet-slot');
    if (slot) slot.innerHTML = `<div class="bet-result pending">🤝 ${t('Checking the bet…')}</div>`;
    try {
      const res = await finishBet(bet.id, run.score);
      if (this.remote?.id === bet.id) this.remote = { ...this.remote, status: 'settled' };
      const won = res.winner === 'rival';
      const html = won
        ? `<div class="bet-result won">🏆 <div><b>${t('You won the bet!')}</b><span>${t('+{pot} coins from {name}', { pot: fmt(res.pot), name: esc(res.hostName) })}</span></div></div>`
        : `<div class="bet-result lost">😬 <div><b>${t('{name} keeps the pot', { name: esc(res.hostName) })}</b><span>${t('You needed more than {score}.', { score: fmt(res.hostScore) })}</span></div></div>`;
      if (slot?.isConnected) {
        slot.innerHTML = html;
        root.querySelectorAll('.bank').forEach((b) => (b.textContent = fmt(save.seeds)));
      }
      else this.toast(won ? '🏆' : '😬', won ? t('You won the bet! +{pot} coins', { pot: fmt(res.pot) }) : t('{name} keeps the pot', { name: esc(res.hostName) }));
      if (won) audio.buy();
    } catch (err) {
      if (slot?.isConnected) slot.innerHTML = `<div class="bet-result lost">⚠️ <div><b>${t('The bet could not be settled')}</b><span>${esc(err.message)}</span></div></div>`;
    }
  }

  /** Winnings, refunds and news from your own bets, collected quietly in the background. */
  async collectWinnings() {
    if (this.collecting || Date.now() - (this.collectedAt ?? 0) < 20000) return;
    this.collecting = true;
    try {
      const payouts = await collectBets();
      this.collectedAt = Date.now();
      payouts.forEach((p, i) => setTimeout(() => {
        if (p.kind === 'won') this.toast('🏆', `<b>${t('{name} could not beat you!', { name: esc(p.rivalName) })}</b><br>${t('+{n} coins from your bet', { n: fmt(p.amount) })}`, 4200);
        else if (p.kind === 'forfeit') this.toast('🏆', `<b>${t('{name} never finished your challenge', { name: esc(p.rivalName ?? '') })}</b><br>${t('+{n} coins from your bet', { n: fmt(p.amount) })}`, 4200);
        else if (p.kind === 'refund') this.toast('↩️', t('Nobody took your bet — {n} coins back', { n: fmt(p.amount) }), 4200);
        else if (p.kind === 'lost') this.toast('😬', t('{name} beat your challenge and took the pot', { name: esc(p.rivalName) }), 4200);
      }, i * 4400));
      if (payouts.some((p) => p.amount > 0)) {
        audio.buy();
        if (this.screen?.classList.contains('title')) {
          const chip = this.screen.querySelector('.title-top .chip span:last-child');
          if (chip) chip.textContent = fmt(save.seeds);
        }
      }
    } catch {
      /* try again next time */
    } finally {
      this.collecting = false;
    }
  }

  /**
   * The challenge sheet: send your run to a friend, with an optional coin bet. A free
   * challenge is posted the moment the sheet opens, so Send works in one tap; a bet is locked
   * in first (the coins leave your bank), then sent.
   */
  challengeSheet(run) {
    const base = { ...run, runner: run.runner || save.runner };
    const links = new Map(); // stake → link
    let stake = 0;
    const el = $(`
      <div class="screen modal-wrap scrim-full">
        <div class="panel modal challenge-sheet">
          <h2>${t('Challenge a friend')}</h2>
          <div class="muted">${t('They race your shadow on this exact route.')}</div>
          ${save.name ? '' : `<input class="name-input" data-name maxlength="16" placeholder="${t('Your runner name')}" autocomplete="nickname">`}
          <div class="bet-head"><b>${t('Bet coins?')}</b><span>${t('Winner takes all')}</span></div>
          <div class="stakes">
            ${STAKES.map((n) => `<button class="stake ${n === 0 ? 'on' : ''}" data-stake="${n}" ${n > save.seeds ? 'disabled' : ''}>${n ? `${fmt(n)}<span class="seed"></span>` : t('Free')}</button>`).join('')}
          </div>
          <div class="pot-line" data-pot></div>
          <div class="stack">
            <button class="btn teal big send" data-send>${ICON.share.replace('<svg', '<svg width="24" height="24"')} ${t('Send on WhatsApp')}</button>
            <button class="btn ghost" data-close data-click>${t('Not now')}</button>
          </div>
        </div>
      </div>`);
    const send = el.querySelector('[data-send]');
    const pot = el.querySelector('[data-pot]');
    const nameOf = () => runnerName(el.querySelector('[data-name]')?.value ?? '') || save.name;
    const paint = () => {
      el.querySelectorAll('[data-stake]').forEach((b) => b.classList.toggle('on', Number(b.dataset.stake) === stake));
      const ready = links.has(stake);
      pot.innerHTML = stake
        ? `${t('You put in {n}. If they take the bet and lose, you win {pot}.', { n: `<b>${fmt(stake)}</b>`, pot: `<b>${fmt(stake * 2)}</b>` })}`
        : t('Just for bragging rights.');
      const label = stake && !ready ? `🔒 ${t('Lock bet')} · ${fmt(stake)} <span class="seed"></span>` : `${ICON.share.replace('<svg', '<svg width="24" height="24"')} ${t('Send on WhatsApp')}`;
      send.innerHTML = label;
      send.classList.toggle('flame', !!stake && !ready);
      send.classList.toggle('teal', !stake || ready);
    };
    const make = async (n) => {
      const name = nameOf();
      if (!name) throw Object.assign(new Error(t('Pick a runner name first.')), { code: 'NAME' });
      if (!save.name) {
        save.name = name;
        persist();
      }
      const { id } = await createChallenge(base, n, name);
      const url = challengeUrl({ ...base, name, challengeId: id }).replace(/^https?:\/\/[^/]+/, linkOrigin());
      links.set(n, url);
      return url;
    };
    // a free challenge, ready before the first tap
    if (save.name) make(0).then(paint, () => {});
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]') || e.target === el) return el.remove();
      const chip = e.target.closest('[data-stake]');
      if (chip && !chip.disabled) {
        stake = Number(chip.dataset.stake);
        audio.click();
        return paint();
      }
      if (!e.target.closest('[data-send]') || send.disabled) return;
      const url = links.get(stake);
      if (url) {
        this.shareOnWhatsApp({ ...base, stake }, url);
        return;
      }
      send.disabled = true;
      try {
        await make(stake);
        if (stake) {
          audio.buy();
          el.querySelectorAll('[data-stake]').forEach((b) => (b.disabled = Number(b.dataset.stake) !== stake));
          this.toast('🔒', t('Bet locked: {n} coins. Now send it!', { n: fmt(stake) }));
        } else this.shareOnWhatsApp(base, links.get(0));
      } catch (err) {
        if (stake) this.toast('⚠️', `${esc(err.message)}<br>${t('Bets need a connection.')}`);
        else if (err.code === 'NAME') this.toast('✏️', esc(err.message));
        else this.shareOnWhatsApp(base); // offline: the plain link still makes a challenge
      } finally {
        send.disabled = false;
        paint();
      }
    });
    paint();
    this.overlay(el);
  }

  shareCardHtml(run) {
    const miss = run.nearMiss?.line
      ? `${esc(run.nearMiss.line)} · ${esc(run.nearMiss.shout)}`
      : t('Clean run · no close call');
    return `
      <div class="share-card">
        <div class="share-kicker">${t("Today's route")}</div>
        <div class="share-dist">${fmt(run.distance)}m</div>
        <div class="share-rank" data-share-rank>${t('Today')} <span class="muted">…</span></div>
        <div class="share-miss">${miss}</div>
      </div>`;
  }

  paintDailyRank(root, daily, failed = false) {
    const el = root.querySelector('[data-share-rank]');
    if (!el) return;
    if (daily?.rank) {
      el.innerHTML = `${t('Today')} <b>#${fmt(daily.rank)}</b>`;
      return;
    }
    el.textContent = failed ? t("Today's rank didn't save") : t('Today — off the board');
  }

  /** The run's score card as a PNG file, drawn once per score and rank and kept ready. */
  cardFor(run) {
    const key = `${run.score}|${run.distance}|${run.rank ?? ''}`;
    if (this.card?.key !== key) {
      const card = { key, file: null };
      card.ready = makeCard(run)
        .then((blob) => (card.file = blob ? new File([blob], 'kimbia-score.png', { type: 'image/png' }) : null))
        .catch(() => null);
      this.card = card;
    }
    return this.card;
  }

  /**
   * Shares the score card image with the challenge link. Phones that can share files open the
   * share sheet (WhatsApp is right there); anything else falls back to a WhatsApp text link.
   */
  async shareOnWhatsApp(run, url) {
    const r = { ...run, name: save.name || run.name, runner: run.runner || save.runner };
    url ??= challengeUrl(r);
    const card = this.cardFor(r);
    // usually ready already; waiting briefly keeps us inside the tap that allows sharing
    const file = card.file ?? (await Promise.race([card.ready, new Promise((ok) => setTimeout(ok, 900))]));
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${shareMessage(r, shareText(r))} ${url}`, title: 'KIMBIA!' });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return; // closed the sheet
      }
    }
    const href = `https://wa.me/?text=${encodeURIComponent(`${shareMessage(r, shareText(r))} ${url}`)}`;
    const opened = window.open(href, '_blank', 'noopener,noreferrer');
    if (!opened) {
      navigator.clipboard?.writeText(href).then(
        () => this.toast('🔗', t('WhatsApp link copied — send it to a friend!')),
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
      error = err.message || t('The board is quiet right now.');
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
      slot.innerHTML = `<p class="muted">${t('Saving your run…')}</p>`;
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
        if (data.daily?.rank) {
          run.rank = data.daily.rank;
          this.cardFor(run); // redraw with today's rank on it
        }
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
            ? t('“{name}” is taken. Pick another name.', { name })
            : (err.message || t('Could not save your score'));
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
      this.paintBoard(root, this.lastTop, null, t('Add your name so this run is saved.'), run, true);
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
      const rank = entry.rank ? t("You're <b>#{n}</b> on the savanna board", { n: fmt(entry.rank) }) : t('Finish a run with points to make the board');
      const note = entry.improved ? t('🎉 New personal best!') : t('Your best: <b>{n}</b>', { n: fmt(entry.score) });
      head = `<div class="lb-placed">${rank}<span class="lb-note">${note}</span></div>`;
    } else if (needName) {
      const draft = slot.querySelector('[data-lb-name]')?.value ?? save.name;
      head = `
        <p class="lb-ask">${t("Pick your runner name. It's yours for good, and your best run will post by itself after every game.")}</p>
        <form class="lb-form">
          <input class="name-input" maxlength="16" data-lb-name placeholder="${t('Your name')}" value="${esc(draft)}" autocomplete="nickname" enterkeyhint="done" />
          <button class="btn teal wide" type="submit" data-act="post">${t('Save score')}</button>
        </form>`;
    }
    const msg = `<p class="lb-msg">${esc(error)}</p>`;
    const youId = save.playerId ?? null;
    const list = preview.length
      ? renderRows(preview, { youId, youName: '' })
      : (error ? '' : `<p class="muted lb-empty">${t('No scores yet. Be the first name on the board.')}</p>`);
    slot.innerHTML = `${head}${msg}${list}<button class="lb-more" type="button" data-act="board">${t('Full board ›')}</button>`;
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
      if (msg) msg.textContent = t('Add your name so this run is saved.');
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
          <button class="icon-btn" data-act="back" data-click aria-label="${t('Back')}">${ICON.back}</button>
          <h2>${t('Leaderboard')}</h2>
          <div class="chip">🏆</div>
        </div>
        <div class="sheet-body">
          <div class="lb-tabs">
            <button type="button" data-board="all" class="on">${t('All-time')}</button>
            <button type="button" data-board="daily">${t('Today')}</button>
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
    body.innerHTML = `<p class="muted">${daily ? t("Loading today's route…") : t('Loading the savanna board…')}</p>`;
    try {
      if (this._submitTask) await this._submitTask;
      const data = await fetchBoard(daily ? 'daily' : undefined);
      if (!body.isConnected) return;
      const youId = save.playerId ?? null;
      const top = data.top || [];
      const intro = daily
        ? `<p class="muted" style="margin:0 4px">${t("Today's route · {day} · resets at midnight in Dar es Salaam.", { day: esc(data.day || '') })}</p>`
        : `<p class="muted" style="margin:0 4px">${t('One best run per runner, ranked by score.')}</p>`;
      const empty = daily
        ? `<div class="panel lb-empty-card"><div class="e">🌅</div><p>${t("No scores on today's route yet. Finish a run and it lands here.")}</p></div>`
        : `<div class="panel lb-empty-card"><div class="e">🌱</div><p>${t('No scores yet. Finish a run and put your name on the board.')}</p></div>`;
      body.innerHTML = top.length ? `${intro}${renderRows(top, { youId, youName: '' })}` : empty;
    } catch (err) {
      if (!body.isConnected) return;
      body.innerHTML = `
        <div class="panel lb-empty-card">
          <div class="e">🌫️</div>
          <p>${esc(err.message || t('Could not load the board'))}</p>
          <button class="btn" data-act="retry" data-click style="margin-top:14px">${t('Try again')}</button>
        </div>`;
    }
  }

  missionSetComplete() {
    const bonus = claimMissionSet();
    if (!bonus) return false;
    audio.buy();
    this.toast('🎉', `<b>${t('Mission set complete!')}</b><br>${t('Multiplier is now ×{m} · +{s} seeds', { m: multiplier(), s: fmt(bonus) })}`, 3600);
    return true;
  }

  /* -------------------------------------------------------- challenges */
  /**
   * The three missions with live progress. Finished ones are collected here for their seeds
   * (coins fly into the bank); unfinished ones can be skipped for a fee, confirmed with a
   * second tap. Once all three are settled the set bonus raises the multiplier.
   */
  mountChallenges(slot, onSet) {
    if (!slot) return;
    const render = (fresh = false) => {
      slot.innerHTML = this.challengesHtml(fresh);
      // keep the sheet's own bank chip in step
      document.querySelectorAll('.sheet-head .bank').forEach((b) => (b.textContent = fmt(save.seeds)));
    };
    render();
    let confirmTimer = 0;
    slot.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled || slot.dataset.busy) return;
      const bank = slot.querySelector('.bank');
      if (btn.dataset.collect || btn.hasAttribute('data-collect-all')) {
        const ids = btn.dataset.collect ? [btn.dataset.collect] : uncollected().map((m) => m.id);
        const from = save.seeds;
        let paid = 0;
        for (const id of ids) paid += collectMission(id);
        if (!paid) return render();
        slot.dataset.busy = '1';
        btn.disabled = true;
        await this.flySeeds(btn, slot.querySelector('.bank-chip'), Math.min(12, 4 + ids.length * 3), from, save.seeds, bank);
        delete slot.dataset.busy;
        render();
      } else if (btn.dataset.skip) {
        if (!btn.classList.contains('confirm')) {
          // first tap arms it, so a stray tap never spends seeds
          slot.querySelectorAll('.chal-skip.confirm').forEach((b) => { b.classList.remove('confirm'); b.innerHTML = b.dataset.label; });
          btn.dataset.label = btn.innerHTML;
          btn.classList.add('confirm');
          btn.innerHTML = `${t('Pay {n}?', { n: fmt(skipCost(ensureMissions().find((m) => m.id === btn.dataset.skip))) })} <span class="seed"></span>`;
          clearTimeout(confirmTimer);
          confirmTimer = setTimeout(() => { if (btn.isConnected) { btn.classList.remove('confirm'); btn.innerHTML = btn.dataset.label; } }, 3000);
          return;
        }
        clearTimeout(confirmTimer);
        const from = save.seeds;
        if (!skipMission(btn.dataset.skip)) return render();
        audio.buy();
        this.countTo(bank, from, save.seeds, 500);
        btn.closest('.chal')?.classList.add('skipping');
        setTimeout(render, 420);
      } else if (btn.hasAttribute('data-set-bonus')) {
        const from = save.seeds;
        if (!this.missionSetComplete()) return render();
        slot.dataset.busy = '1';
        await this.flySeeds(btn, slot.querySelector('.bank-chip'), 14, from, save.seeds, bank);
        delete slot.dataset.busy;
        render(true);
        onSet?.();
      }
    });
  }

  challengesHtml(fresh = false) {
    const ms = ensureMissions();
    const waiting = uncollected();
    const owed = waiting.reduce((n, m) => n + m.reward, 0);
    return `
      <div class="chal-wrap">
        <div class="chal-head">
          <b>${t('Challenges')}</b>
          <span class="chal-mult">×${multiplier()}</span>
          <span class="chip bank-chip"><span class="seed"></span><span class="bank">${fmt(save.seeds)}</span></span>
        </div>
        ${ms.map((m, i) => this.challengeRow(m, fresh, i)).join('')}
        ${waiting.length > 1 ? `<button class="btn wide chal-all" data-collect-all>${t('Collect all')} · +${fmt(owed)} <span class="seed"></span></button>` : ''}
        ${missionSetReady() ? `<button class="btn flame wide chal-set" data-set-bonus>🎉 ${t('Set bonus')} · +${fmt(setBonus(save.missionLevel))} <span class="seed"></span></button>` : ''}
      </div>`;
  }

  challengeRow(m, fresh, i) {
    const best = Math.min(m.n, m.best ?? 0);
    const pct = m.done ? 100 : Math.round((100 * best) / m.n);
    let act;
    let meta;
    if (m.skipped) {
      act = `<span class="chal-tag">${t('Skipped')}</span>`;
      meta = t('Counts towards the set');
    } else if (m.claimed) {
      act = `<span class="chal-tag paid">✓ +${fmt(m.reward)}</span>`;
      meta = t('Collected');
    } else if (m.done) {
      act = `<button class="btn small chal-collect" type="button" data-collect="${m.id}">${t('Collect')} +${fmt(m.reward)} <span class="seed"></span></button>`;
      meta = `<b>${t('Done!')}</b>`;
    } else {
      const cost = skipCost(m);
      act = `<button class="btn small ghost chal-skip" type="button" data-skip="${m.id}" ${save.seeds < cost ? 'disabled' : ''}>${t('Skip')} · ${fmt(cost)} <span class="seed"></span></button>`;
      meta = `<span><b>${fmt(best)}</b> / ${fmt(m.n)}</span><span class="pays"><b>+${fmt(m.reward)}</b><span class="seed"></span></span>`;
    }
    const cls = m.skipped ? 'skipped' : m.claimed ? 'claimed' : m.done ? 'ready' : '';
    return `
      <div class="chal ${cls}" style="${fresh ? `animation:rise .45s ${i * 0.08}s ease both` : ''}">
        <span class="chal-ico">${m.skipped ? '⏭' : m.done ? '✓' : '🎯'}</span>
        <div class="chal-body">
          <div class="chal-txt">${esc(missionText(m))}</div>
          <div class="chal-bar"><i style="width:${pct}%"></i></div>
          <div class="chal-foot"><div class="chal-meta">${meta}</div><div class="chal-act">${act}</div></div>
        </div>
      </div>`;
  }

  /** Counts a number up (or down) in place. */
  countTo(el, from, to, ms = 700) {
    if (!el) return;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Coins burst from `fromEl` and arc into `toEl`, the bank ticking up as each lands. */
  flySeeds(fromEl, toEl, n, from, to, numEl) {
    const a = fromEl.getBoundingClientRect();
    const b = (toEl ?? fromEl).getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    const bx = b.left + 18;
    const by = b.top + b.height / 2;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !toEl) {
      this.countTo(numEl, from, to, 400);
      audio.coin(3);
      return new Promise((r) => setTimeout(r, 400));
    }
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('span');
      c.className = 'seed fly-seed';
      document.body.appendChild(c);
      const sx = (Math.random() - 0.5) * 90;
      const sy = -30 - Math.random() * 60;
      const anim = c.animate(
        [
          { transform: `translate(${ax}px, ${ay}px) scale(0.4)`, opacity: 0 },
          { transform: `translate(${ax + sx}px, ${ay + sy}px) scale(1.15)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${bx}px, ${by}px) scale(0.7)`, opacity: 1 },
        ],
        { duration: 720 + i * 18, delay: i * 55, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' },
      );
      jobs.push(anim.finished.then(() => {
        c.remove();
        audio.coin(i);
        if (numEl) numEl.textContent = fmt(from + ((to - from) * (i + 1)) / n);
        toEl.classList.remove('bump');
        void toEl.offsetWidth;
        toEl.classList.add('bump');
      }));
    }
    return Promise.all(jobs).then(() => numEl && (numEl.textContent = fmt(to)));
  }

  /* ------------------------------------------------------------ sheets */
  sheet(title, body, onBack = () => this.title()) {
    const el = $(`
      <div class="screen scrim-full">
        <div class="sheet-head">
          <button class="icon-btn" data-act="back" data-click aria-label="${t('Back')}">${ICON.back}</button>
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
              <h3>${a.name} <span class="muted" style="font-family:var(--body);font-size:13px">${lang === 'sw' ? a.species : `the ${a.species}`}</span></h3>
              <div style="font-size:13px;color:${a.color}">${a.power} · ${dur.toFixed(1)}s</div>
              <p>${a.desc}</p>
              <div class="pips">${Array.from({ length: 5 }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</div>
            </div>
            ${lvl < 5 ? `<button class="btn buy" data-up="${id}" ${save.seeds < cost ? 'disabled' : ''}><span class="seed"></span>${fmt(cost)}</button>` : `<div class="chip">${t('MAX')}</div>`}
          </div>`;
      }).join('');
      const charm = `
        <div class="panel list-card" style="--c:#7fe0ff">
          <div class="art">🛡️</div>
          <div class="info">
            <h3>${t('Ngao Shield')} <span class="muted" style="font-family:var(--body);font-size:13px">${t('× {n} owned', { n: save.charms ?? 0 })}</span></h3>
            <div style="font-size:13px;color:#7fe0ff">${t('Tap 🛡️ while running · 30s')}</div>
            <p>${t('A Maasai-style shield charm that absorbs one crash and keeps your run alive.')}</p>
          </div>
          <button class="btn buy" data-charm ${save.seeds < 300 ? 'disabled' : ''}><span class="seed"></span>300</button>
        </div>`;
      const el = this.sheet(t('Animal Allies'), `<p class="muted" style="margin:0 4px">${t('Grab glowing totems on the trail to call an ally. Upgrade them to make their help last longer.')}</p>${charm}${body}`);
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-charm]') && save.seeds >= 300) {
          save.seeds -= 300;
          save.charms = (save.charms ?? 0) + 1;
          persist();
          audio.buy();
          this.toast('🛡️', t('Ngao shield ready! You have <b>{n}</b>.', { n: save.charms }));
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
        this.toast(ALLIES[id].emoji, t('<b>{name}</b> upgraded to level {n}!', { name: ALLIES[id].name, n: lvl + 1 }));
        render();
      });
    };
    render();
  }

  missions() {
    const el = this.sheet(t('Missions'), `
      <div class="panel mult-hero">
        <div class="x">×${multiplier()}</div>
        <div><b style="font-size:18px">${t('Score multiplier')}</b><div class="muted" style="font-size:14px">${t('Each mission pays seeds. Settle all three — finish them or skip them — to raise your multiplier and win the set bonus.')}</div></div>
      </div>
      <div class="panel chal-panel"><div class="chal-slot"></div></div>
    `);
    this.mountChallenges(el.querySelector('.chal-slot'), () => {
      el.querySelector('.mult-hero .x').textContent = `×${multiplier()}`;
    });
  }

  journey() {
    save.mapSeen = save.regionMax ?? 0;
    persist();
    const max = save.regionMax ?? 0;
    const sel = Math.min(save.startRegion ?? 0, max);
    let html = `
      <div class="journey-head panel">
        <div>${t('<b>{n}</b> / {total} regions discovered', { n: max + 1, total: REGIONS.length })}</div>
        <div class="journey-bar"><i style="width:${((max + 1) / REGIONS.length) * 100}%"></i></div>
        <button class="btn ghost wide" data-act="intro" data-click style="min-height:46px;font-size:17px">${t('📖 Replay the prologue')}</button>
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
            <div class="num">${i === 0 ? t('START') : `${(r.at / 1000).toFixed(1)} km`} · ${esc(r.title)}</div>
            <h3>${open ? esc(r.name) : '???'}</h3>
            <p>${open ? esc(r.blurb) : t('Keep running to discover this place.')}</p>
            ${open ? `<blockquote>“${esc(r.line)}” <span class="muted">— ${esc(r.speaker)}</span></blockquote>` : ''}
            ${open ? `<button class="btn ${i === sel ? 'ghost' : 'teal'} start-here" data-start="${i}" ${i === sel ? 'disabled' : ''}>${i === sel ? t('✓ Starting here') : t('Start runs here')}</button>` : ''}
          </div>
        </div>`;
    });
    const el = this.sheet(t('The Journey'), html);
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
      const outfit = OUTFITS.find((o) => o.id === outfitId(save.outfit));
      const el = $(`
        <div class="screen select scrim-bottom">
          <div class="sheet-head">
            <button class="icon-btn" data-act="back" data-click aria-label="${t('Back')}">${ICON.back}</button>
            <h2>${t('Runners')}</h2>
            <div class="chip"><span class="seed"></span><span>${fmt(save.seeds)}</span></div>
          </div>
          <div class="panel select-card">
            <div class="dots">${RUNNERS.map((_, i) => `<i class="${i === this.selIdx ? 'on' : ''}"></i>`).join('')}</div>
            <div class="role">${esc(r.title)}</div>
            <h2>${esc(r.name)}</h2>
            <p>${esc(r.bio)}</p>
            <div class="outfit-line">${esc(outfit.line)}</div>
            <div class="outfits" role="listbox" aria-label="${t('Outfit')}">
              ${OUTFITS.map((o) => `<button type="button" class="${o.id === outfit.id ? 'on' : ''}" data-outfit="${o.id}" aria-label="${esc(o.line)}">${esc(o.name)}</button>`).join('')}
            </div>
            <div class="select-nav">
              <button class="arrow" data-act="prev" aria-label="${t('Previous')}">‹</button>
              ${owned
                ? `<button class="btn ${selected ? 'ghost' : ''}" data-act="pick" data-click ${selected ? 'disabled' : ''}>${selected ? t('✓ Selected') : t('Select')}</button>`
                : `<button class="btn flame" data-act="buy" data-click ${save.seeds < r.cost ? 'disabled' : ''}>${t('Unlock · {cost}', { cost: fmt(r.cost) })} <span class="seed"></span></button>`}
              <button class="arrow" data-act="next" aria-label="${t('Next')}">›</button>
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
          this.toast(r.emoji, t('<b>{name}</b> joins the run!', { name: esc(r.name) }));
          return render();
        }
        if (act === 'pick') {
          save.runner = r.id;
          persist();
          render();
        }
        const outfitBtn = e.target.closest('[data-outfit]');
        if (outfitBtn) {
          save.outfit = outfitId(outfitBtn.dataset.outfit);
          persist();
          audio.click();
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

  /** Installs the game: the browser's own prompt where there is one, otherwise a how-to. */
  async installApp() {
    audio.click();
    if (install.how === 'prompt') {
      const outcome = await install.prompt();
      if (outcome === 'accepted') this.toast('📲', t('Kimbia! is on your home screen. Karibu tena!'));
      if (outcome !== 'unavailable') return;
    }
    const step = (n, html) => `<li><b>${n}</b><span>${html}</span></li>`;
    const steps = {
      ios: [
        step(1, t("Tap <b>Share</b> {icon} in Safari's toolbar", { icon: `<span class="key">${ICON.share}</span>` })),
        step(2, t('Scroll down and tap <b>Add to Home Screen</b>')),
        step(3, t('Tap <b>Add</b>. Kimbia! opens full screen, even offline')),
      ],
      inapp: [
        step(1, t('Tap the <b>⋮</b> or <b>•••</b> menu in this app')),
        step(2, t('Choose <b>Open in browser</b> (Chrome or Safari)')),
        step(3, t('Tap <b>Install</b> on the Kimbia! home screen there')),
      ],
      menu: [
        step(1, t('Open your browser menu <b>⋮</b>')),
        step(2, t('Tap <b>Install app</b> or <b>Add to Home screen</b>')),
        step(3, t('Confirm. Kimbia! opens full screen, even offline')),
      ],
    }[install.how] ?? [];
    const el = $(`
      <div class="screen modal-wrap scrim-full">
        <div class="panel modal install-card">
          <div class="install-icon"><img src="/icons/icon-192.png" alt="" width="72" height="72" /></div>
          <h2>${t('Install Kimbia!')}</h2>
          <p class="muted">${t('Play from your home screen: full screen, quicker to open, and it works offline.')}</p>
          <ol class="install-steps">${steps.join('')}</ol>
          <div class="stack"><button class="btn" data-act="close" data-click>${t('Got it')}</button></div>
        </div>
      </div>`);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-act=close]') || e.target === el) el.remove();
    });
    this.overlay(el);
  }

  settings() {
    const row = (key, en) => { const label = t(en); return `<div class="toggle-row"><span>${label}</span><button class="switch ${save[key] ? 'on' : ''}" data-key="${key}" aria-label="${label}"></button></div>`; };
    const el = $(`
      <div class="screen modal-wrap scrim-full">
        <div class="panel modal" style="text-align:left">
          <h2 style="text-align:center">${t('Settings')}</h2>
          ${row('music', '🎵 Music')}
          ${row('sound', '🔊 Sound effects')}
          ${row('haptics', '📳 Vibration')}
          <div class="toggle-row"><span>${t('✨ Graphics')}</span><div class="seg" role="group">${['auto', 'high', 'low'].map((q) => `<button class="${(save.quality ?? 'auto') === q ? 'on' : ''}" data-q="${q}">${t(q[0].toUpperCase() + q.slice(1))}</button>`).join('')}</div></div>
          <div class="toggle-row"><span>${t('🌍 Language')}</span><div class="seg" role="group">${Object.entries(LANGS).map(([k, n]) => `<button class="${lang === k ? 'on' : ''}" data-lang="${k}">${n}</button>`).join('')}</div></div>
          ${install.offered ? `<div class="toggle-row"><span>${t('📲 Play from your home screen')}</span><button class="btn small" data-act="install" data-click>${t('Install')}</button></div>` : ''}
          <div style="margin:18px 0 6px" class="muted">${t('Your runner name (shown on challenges)')}</div>
          <input class="name-input" maxlength="16" placeholder="${t('e.g. Zuri')}" value="${esc(save.name)}" />
          <div class="stack"><button class="btn" data-act="close" data-click>${t('Done')}</button></div>
          <p class="muted" style="text-align:center;font-size:12px;margin:16px 0 0">${t('Swipe to move · Arrow keys / WASD on desktop')}</p>
          <p class="muted credits" style="text-align:center;font-size:11px;margin:10px 0 0;line-height:1.5">${t('Runners: Quaternius (CC0). Animals: © Wildfire Games, from')} <a href="https://play0ad.com" target="_blank" rel="noopener">0 A.D.</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.</p>
        </div>
      </div>`);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-act=install]')) return this.installApp();
      const lb = e.target.closest('[data-lang]');
      if (lb) return setLang(lb.dataset.lang);
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
      this.toast('✅', t("You're now <b>{name}</b> on the leaderboard.", { name: esc(save.name) }));
    } catch (err) {
      if (err.code === 'NAME_TAKEN') this.toast('🙅', t('<b>{name}</b> is already taken. Try another name.', { name: esc(name) }), 3200);
      else if (err.status === 503) {
        // no leaderboard configured (e.g. local dev): keep the name locally
        save.name = name;
        persist();
      } else this.toast('📡', t("Couldn't reach the leaderboard. Your name wasn't changed."));
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
          <h2>${t('Jambo! Day {n}', { n: d.streak })}</h2>
          <div class="muted">${t('The savanna rewards those who return.')}</div>
          <div class="daily-days">
            ${Array.from({ length: 7 }, (_, i) => `<div class="${i < d.streak ? 'on' : ''}"><span>${t('Day {n}', { n: i + 1 })}</span><b>${i === 6 ? '🎁' : 50 * (i + 1)}</b></div>`).join('')}
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
