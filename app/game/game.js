import * as THREE from 'three';
import { curve, bend, bakeRigid, finishProp, time as timeU } from './materials.js';
import { Look, detectQuality } from './look.js';
import { Animals, makeEagle, makeHornbill, makeTruck, makeRamp, makeTotem, makePrizeBox, makeLetterToken } from './models.js';
import { makeRunner } from './people.js';
import { makeKidRunner, preloadKids } from './kids.js';
import { preloadWildlife } from './wildlife.js';
import {
  RegionAnimals, makeLogStyled, makeGateStyled, makeBoulderStyled, makeMoundStyled, makeCart, makeRockfall, makeBeachedCanoe,
} from './regionModels.js';
import { World, Particles, LANE_W } from './world.js';
import { audio } from './audio.js';
import { makeChunk, KINDS, TRUCK_LEN, JUMP_V, GRAVITY } from './patterns.js';
import { RUNNERS, ALLIES, ALLY_IDS, TUTORIAL, SHOUTS, outfitId, HUNT_WORDS, HUNT_PER_LETTER } from '../data/content.js';
import { REGIONS, regionIndexAt, regionAt } from '../data/regions.js';
import { save, persist, multiplier } from '../data/save.js';
import {
  chunkPlan, darDay, ghostDistance, huntWord, lionClip, nearMissSpec, rngAt, waterClear, wildebeestFill,
} from '../data/daily.js';

const LANES = [-LANE_W, 0, LANE_W];
const castShadows = (root) => root.traverse((o) => o.isMesh && !o.material.transparent && (o.castShadow = true));
const SLIDE_T = 0.62;
const SHIELD_T = 30;
// what a Zawadi box can hold (weights)
const PRIZES = [
  { w: 30, id: 'seeds', n: 50 },
  { w: 17, id: 'seeds', n: 120 },
  { w: 7, id: 'seeds', n: 300 },
  { w: 2.5, id: 'seeds', n: 1000 },
  { w: 11, id: 'charm' },
  { w: 13, id: 'ally' },
  { w: 12, id: 'double' },
  { w: 8, id: 'score', n: 2500 },
];
const PRIZE_WEIGHT = PRIZES.reduce((s, p) => s + p.w, 0);
const JUMP_BUFFER = 0.16; // a jump pressed this long before landing still happens
const COYOTE = 0.1; // and one pressed this long after running off a roof
const COMBO_STEPS = [[10, 50], [25, 150], [50, 400], [100, 1000], [200, 2500]];
const WARN_ICONS = { rhino: '🦏', buffalo: '🐃', wildebeest: '🦬', rockfall: '🪨', crossing: '🐘', truck: '🚚' };
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (n) => (Math.random() * n) | 0;
const pick = (a) => a[randi(a.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const shuffle = (a) => a.sort(() => Math.random() - 0.5);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.listeners = {};
    this.state = 'menu';
    this.time = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.pixelRatio = dpr;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
    this.camera.position.set(3, 2, 4);

    this.world = new World(this.scene);
    this.fx = new Particles(this.scene);
    this.look = new Look(this.renderer, this.scene, this.camera, this.world, detectQuality(save.quality));

    this.obstacles = [];
    this.coins = [];
    this.totems = [];
    preloadKids(save.runner);
    preloadWildlife();
    this.buildCoins();
    this.buildAllies();
    this.buildChasers();
    this.buildShield();
    this.timeScale = 1;
    this.slowmo = 0;
    this.startJ = this.startFor(save.startRegion);
    this.setRunner(save.runner);
    this.resetRun();
    this.state = 'menu';

    this.camMode = 'menu';
    this.camPos = new THREE.Vector3(3, 2, 4);
    this.camLook = new THREE.Vector3(0, 1.5, -8);
    this.shake = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock();
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /* ------------------------------------------------------------ events */
  on(name, fn) {
    (this.listeners[name] ??= []).push(fn);
  }
  emit(name, data) {
    this.listeners[name]?.forEach((fn) => fn(data));
  }
  haptic(ms) {
    if (save.haptics && navigator.vibrate) navigator.vibrate(ms);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the three lanes framed on tall phone screens by widening vertical FOV.
    const hfov = THREE.MathUtils.degToRad(64);
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / this.camera.aspect));
    this.baseFov = THREE.MathUtils.clamp(vfov, 55, 84);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.look?.resize();
  }

  setQuality(pref) {
    save.quality = pref;
    persist();
    this.look.set(detectQuality(pref));
  }

  /* -------------------------------------------------------- characters */
  setRunner(id) {
    const def = RUNNERS.find((r) => r.id === id) ?? RUNNERS[0];
    const outfit = outfitId(save.outfit);
    if (this.runner) this.scene.remove(this.runner.root);
    this.runner = makeKidRunner(def, makeRunner(def, outfit), outfit);
    castShadows(this.runner.root);
    this.scene.add(this.runner.root);
    this.runnerId = def.id;
    this.outfitId = outfit;
  }

  buildAllies() {
    this.allyModels = {
      tembo: Animals.elephant({ saddle: true }),
      tai: makeEagle(),
      duma: Animals.cheetah(),
      twiga: Animals.giraffe(),
      hondo: makeHornbill(),
      simba: Animals.lion({ king: true }),
    };
    this.allyModels.tembo.root.scale.setScalar(0.62);
    this.allyModels.tai.root.scale.setScalar(0.9);
    this.allyModels.twiga.root.scale.setScalar(0.9);
    for (const a of Object.values(this.allyModels)) {
      a.root.visible = false;
      castShadows(a.root);
      this.scene.add(a.root);
    }
  }

  buildChasers() {
    this.chasers = [Animals.hyena(true), Animals.hyena(), Animals.hyena()];
    this.chasers.forEach((c, i) => {
      c.root.position.set((i - 1) * 1.6, 0, 14);
      c.offset = [0, -1.5, 1.5][i];
      c.lag = [0, 0.5, 0.8][i];
      if (i) c.root.scale.setScalar(0.82);
      castShadows(c.root);
      this.scene.add(c.root);
    });
  }

  buildShield() {
    const m = bend(new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 2), m);
    this.shieldMesh.scale.set(0.85, 1.15, 0.85);
    this.shieldMesh.visible = false;
    this.scene.add(this.shieldMesh);
  }

  /** Journey distance a run starts from. A shared link may start a locked region. */
  startFor(i, allowLocked = false) {
    const cap = allowLocked ? REGIONS.length - 1 : (save.regionMax ?? 0);
    const idx = Math.max(0, Math.min(i ?? 0, cap, REGIONS.length - 1));
    this.startIndex = idx;
    return REGIONS[idx].at;
  }
  get J() {
    return this.D + this.startJ;
  }

  buildCoins() {
    const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.09, 14);
    geo.rotateX(Math.PI / 2);
    const m = bend(new THREE.MeshLambertMaterial({ color: 0xffc83d, emissive: 0xc07400 }));
    this.coinMesh = new THREE.InstancedMesh(geo, m, 400);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.count = 0;
    this.scene.add(this.coinMesh);
    this.dummy = new THREE.Object3D();
    this.waterGeo = new THREE.BoxGeometry(LANE_W * 1.05, 0.16, KINDS.water.len);
    this.waterMat = bend(new THREE.MeshLambertMaterial({ color: 0x2a9bb8, transparent: true, opacity: 0.9 }));
  }

  /* --------------------------------------------------------------- run */
  resetRun() {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const t of this.totems) this.scene.remove(t.mesh);
    for (const b of this.boxes ?? []) this.scene.remove(b.mesh);
    this.letterOut = false;
    this.obstacles = [];
    this.totems = [];
    this.boxes = [];
    this.seedBoost = 0;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.coins = [];
    this.D = 0;
    this.speed = 15;
    this.score = 0;
    this.seeds = 0;
    this.combo = 0;
    this.comboT = 0;
    this.stats = { seeds: 0, distance: 0, jumps: 0, slides: 0, allies: 0, score: 0, roofs: 0, smash: 0, nearMiss: 0, regions: 0, bestCombo: 0, boxes: 0, words: 0 };
    this.shield = 0;
    this.lap = 0;
    this.runTime = 0;
    this.timeScale = 1;
    this.slowmo = 0;
    if (this.shieldMesh) this.shieldMesh.visible = false;
    this.p = { lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, grounded: true, slide: 0, invuln: 0, laneT: 9, onTruck: null, ground: 0 };
    this.powers = {};
    this.chaseT = 0;
    this.chaseDist = 14;
    this.stumbleT = 0;
    this.nextChunk = 45;
    this.chapter = -1;
    this.region = -1;
    this.day = darDay();
    this.tutorialIdx = 0;
    this.cardMoment = null;
    this.freeze = 0;
    this.ghostPassed = false;
    this.nextTotemAt = 260 + rngAt(this.day, 3, 0)() * 140;
    this.nextBoxAt = 160 + rngAt(this.day, 6, 0)() * 120;
    this.nextLetterAt = 200 + Math.random() * 160;
    if (save.hunt?.day !== this.day) save.hunt = { day: this.day, done: 0, got: 0 };
    save.hunt.done ??= 0;
    this.revives = 0;
    this.deathT = 0;
    for (const a of Object.values(this.allyModels)) a.root.visible = false;
    if (this.ghost) this.ghost.root.visible = false;
  }

  start() {
    this.resetRun();
    const linked = this.linkedStart;
    this.startJ = linked == null ? this.startFor(save.startRegion) : this.startFor(linked, true);
    this.world.setDay(this.day);
    this.world.reset(this.J);
    this.runId = (this.runId ?? 0) + 1;
    this.state = 'running';
    this.camMode = 'run';
    this.chaseT = 3.2; // Fisi's pack gives chase as the run begins
    audio.setIntensity(1);
    audio.muffle(false);
    setTimeout(() => this.state === 'running' && audio.cackle(), 400);
    this.emit('start');
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    audio.muffle(true);
    this.emit('pause');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    audio.muffle(false);
    this.clock.getDelta();
  }

  toMenu(mode = 'menu') {
    this.resetRun();
    this.startJ = this.startFor(save.startRegion);
    this.world.setDay(this.day);
    this.world.reset(this.J);
    this.state = 'menu';
    this.camMode = mode;
    audio.setIntensity(0);
    audio.muffle(false);
  }

  revive() {
    this.revives++;
    // clear the way ahead
    for (const o of this.obstacles) if (o.wz < this.D + 50 || o.moving) o.dead = true;
    this.p.invuln = 3;
    this.p.y = Math.max(this.p.y, 0);
    this.state = 'running';
    this.chaseT = 0;
    audio.muffle(false);
    audio.powerup();
  }

  /** Raises Ngao, the shield charm: it absorbs one crash. */
  useShield() {
    if (this.state !== 'running' || this.shield > 0 || (save.charms ?? 0) <= 0) return false;
    save.charms--;
    persist();
    this.shield = SHIELD_T;
    this.shieldMesh.visible = true;
    audio.powerup();
    this.haptic(30);
    this.emit('shield', { on: true, dur: SHIELD_T });
    return true;
  }

  breakShield() {
    this.shield = 0;
    this.shieldMesh.visible = false;
    this.p.invuln = Math.max(this.p.invuln, 1.4);
    this.fx.sparkle(this.p.x, 1.2, 0, 0x7fe0ff, 24);
    audio.smash();
    this.emit('shield', { on: false, broke: true });
    this.emit('shout', { text: 'Ngao saved you!', sub: 'Shield broken' });
  }

  /* ------------------------------------------------------------- input */
  input(action) {
    if (this.state !== 'running') return;
    const p = this.p;
    const flying = !!this.powers.tai;
    switch (action) {
      case 'left':
      case 'right': {
        const nl = Math.max(0, Math.min(2, p.lane + (action === 'left' ? -1 : 1)));
        if (nl !== p.lane) {
          p.prevLane = p.lane;
          p.lane = nl;
          p.laneT = 0;
          if (!flying) audio.tone('sine', 520, 380, 0.06, 0.06);
        } else if (!flying) {
          // bumping the edge of the trail
          this.stumble(true);
        }
        break;
      }
      case 'up':
        if (flying || this.powers.tembo) return;
        if (p.grounded || this.coyote > 0) this.jump();
        else this.jumpBuffer = JUMP_BUFFER;
        break;
      case 'down':
        if (flying || this.powers.tembo) return;
        if (!p.grounded) p.vy = Math.min(p.vy, -30);
        if (p.slide <= 0) {
          this.stats.slides++;
          audio.slide();
        }
        p.slide = SLIDE_T;
        break;
    }
  }

  jump() {
    const p = this.p;
    p.vy = JUMP_V * (this.powers.twiga ? 1.6 : 1);
    p.grounded = false;
    p.slide = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.stats.jumps++;
    audio.jump();
    this.fx.dust(p.x, 0, this.world.dustColor(), 4);
  }

  /* -------------------------------------------------------------- loop */
  frame() {
    const realDt = Math.min(this.clock.getDelta(), 0.05);
    this.adaptQuality(realDt);
    // A near-miss holds for a short beat. Other close calls only ease into slow motion.
    if (this.state === 'paused') {
      /* leave the clock where the pause caught it */
    } else if (this.freeze > 0) {
      this.freeze -= realDt;
      this.timeScale = damp(this.timeScale, 0.06, 28, realDt);
    } else {
      if (this.slowmo > 0) this.slowmo -= realDt;
      this.timeScale = damp(this.timeScale, this.slowmo > 0 ? 0.35 : 1, this.slowmo > 0 ? 30 : 6, realDt);
    }
    const dt = realDt * this.timeScale;
    this.time += dt;
    timeU.value = this.time;

    if (this.state === 'running') this.updateRun(dt);
    else if (this.state === 'dying') this.updateDying(dt);
    else if (this.state === 'menu') this.updateMenu(dt);

    if (this.state !== 'paused') {
      this.world.update(dt, this.J, this.camera, this.time);
      this.world.setTime(this.J, dt);
      this.fx.update(dt, this.state === 'running' ? this.speed * dt : 0);
      this.updateCoinsMesh();
      for (const t of this.totems) t.mesh.userData.spin(this.time);
    }
    // gentle sway of the curved horizon, like the real thing
    curve.value.x = Math.sin(this.time * 0.08) * 0.00035;
    this.updateCamera(dt);
    this.look.update(dt, this.p.x, this.world.palette.night);
    this.look.render();
  }

  adaptQuality(dt) {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc > 1) {
      const fps = this.fpsFrames / this.fpsAcc;
      if (this.look?.watch(fps, (save.quality ?? 'auto') === 'auto')) this.emit('quality', 'low');
      if (fps < 42 && this.pixelRatio > 1 && this.look?.quality === 'low') {
        this.pixelRatio = Math.max(1, this.pixelRatio - 0.35);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      }
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }

  updateMenu(dt) {
    const r = this.runner;
    r.root.position.set(0, 0, 0);
    r.root.rotation.y = this.camMode === 'select' ? Math.sin(this.time * 0.6) * 0.45 : 0;
    r.update(dt, 0, 'idle');
    for (const c of this.chasers) c.root.visible = false;
    // drift the world gently so the herds and clouds feel alive
    this.D += dt * 1.2;
    if (this.region !== regionIndexAt(this.J).index) {
      this.region = regionIndexAt(this.J).index;
      audio.setRegion(REGIONS[this.region].music);
    }
  }

  updateRun(dt) {
    const p = this.p;
    const pw = this.powers;
    const prevD = this.D;

    // ---- speed & distance
    const base = 15 + 21 * (1 - Math.exp(-this.D / 4200));
    const target = base * (pw.duma ? 1.75 : 1) * (pw.tai ? 1.25 : 1);
    this.speed = damp(this.speed, target, 3, dt);
    const step = this.speed * dt;
    this.D += step;
    this.runTime += dt;
    this.stats.distance = Math.floor(this.D);
    const mult = multiplier() * (pw.simba ? 2 : 1);
    this.score += step * mult;
    this.stats.score = Math.floor(this.score);

    // ---- timers
    for (const k of Object.keys(pw)) {
      pw[k] -= dt;
      if (pw[k] <= 0) this.endPower(k);
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (this.seedBoost > 0) this.seedBoost -= dt;
    if (this.chaseT > 0) this.chaseT -= dt;
    if (this.comboT > 0) this.comboT -= dt;
    else if (this.combo) {
      this.combo = 0;
      this.emit('combo', 0);
    }
    if (this.shield > 0) {
      this.shield -= dt;
      if (this.shield <= 0) {
        this.shield = 0;
        this.shieldMesh.visible = false;
        this.emit('shield', { on: false });
      }
    }
    audio.setLevel(Object.keys(pw).length ? 3 : this.speed > 25 ? 2 : 1, this.speed);
    p.laneT += dt;

    // ---- lateral
    p.x = damp(p.x, LANES[p.lane], 18, dt);

    // ---- vertical
    if (pw.tai) {
      p.y = damp(p.y, 7.5, 3, dt);
      p.vy = 0;
      p.grounded = false;
    } else {
      const ground = this.groundAt(p.x, p.y);
      p.ground = ground;
      if (p.grounded) {
        if (ground < p.y - 0.05) {
          p.grounded = false;
          this.coyote = COYOTE;
        } else p.y = ground;
      }
      if (this.coyote > 0) this.coyote -= dt;
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (!p.grounded) {
        p.vy -= GRAVITY * (p.vy < 0 ? 1.15 : 1) * dt;
        p.y += p.vy * dt;
        if (p.y <= ground) {
          p.y = ground;
          p.vy = 0;
          p.grounded = true;
          audio.land();
          this.fx.dust(p.x, 0, this.world.dustColor(), 5);
          if (this.jumpBuffer > 0 && p.slide <= 0) this.jump();
        }
      }
    }
    if (p.slide > 0) p.slide -= dt;

    this.spawn();
    this.updateObstacles(dt, prevD);
    this.updateGhost(dt);
    this.updatePickups(dt);
    this.updateRunnerVisual(dt);
    this.updateAllies(dt);
    this.updateChasers(dt);
    this.checkStory();

    if (p.grounded && !pw.tembo && Math.random() < dt * 14) this.fx.dust(p.x, 0.3, this.world.dustColor(), 1);
    if (this.shield > 0) {
      this.shieldMesh.position.set(p.x, p.y + 1 + (pw.tembo ? 1.95 : 0), 0);
      this.shieldMesh.rotation.y += dt * 1.5;
      this.shieldMesh.material.opacity = this.shield < 3 && Math.floor(this.time * 8) % 2 ? 0.06 : 0.22;
    }
    this.emit('hud', this);
  }

  /* --------------------------------------------------- ground & trucks */
  groundAt(x, y) {
    let g = 0;
    for (const o of this.obstacles) {
      if (o.dead || (!o.top && !o.ramp)) continue;
      if (Math.abs(x - o.x) > 1.0) continue;
      const near = o.wz - o.len / 2;
      const far = o.wz + o.len / 2;
      if (this.D < near - 0.3 || this.D > far + 0.3) continue;
      if (o.top) {
        if (y >= o.top - 0.6) g = Math.max(g, o.top);
      } else {
        const f = THREE.MathUtils.clamp((this.D - near) / o.len, 0, 1);
        const h = f * o.ramp;
        if (y >= h - 0.9) g = Math.max(g, h);
      }
    }
    return g;
  }

  /* --------------------------------------------------------- obstacles */
  addObstacle(kind, lane, wz, opts = {}) {
    const k = KINDS[kind];
    const style = regionAt(this.startJ + wz).style;
    let m;
    let anim = null;
    let top = k.top;
    switch (kind) {
      case 'log': m = makeLogStyled(style.log); break;
      case 'gate': m = makeGateStyled(style.gate); break;
      case 'boulder': m = makeBoulderStyled(style.rock); break;
      case 'mound': m = makeMoundStyled(); break;
      case 'cart': m = makeCart(); break;
      case 'canoe': m = makeBeachedCanoe(); break;
      case 'rockfall': m = makeRockfall(style.rock); break;
      case 'ramp': m = makeRamp(k.len, k.ramp); break;
      case 'truck': {
        const t = makeTruck(TRUCK_LEN, !!opts.moving);
        m = t.group;
        top = t.height;
        break;
      }
      case 'rhino': anim = Animals.rhino(); break;
      case 'wildebeest': anim = Animals.wildebeest(); break;
      case 'lion': anim = Animals.lion(); break;
      case 'buffalo': anim = RegionAnimals.buffalo(); break;
      case 'croc': anim = RegionAnimals.croc(); break;
      case 'gorilla': anim = RegionAnimals.gorilla(true); break;
      case 'crossing': anim = Animals.elephant(); break;
      case 'water': {
        m = new THREE.Mesh(this.waterGeo, this.waterMat);
        m.position.y = 0.08;
        break;
      }
    }
    if (anim) m = anim.root;
    else if (kind !== 'rockfall' && kind !== 'water') finishProp(bakeRigid(m, true));
    castShadows(m);
    // animals in the lane face the runner (the models face down the track, -z), so chargers
    // run head first rather than backwards
    if (anim && kind !== 'crossing') m.rotation.y = Math.PI;
    if (kind === 'crossing') {
      m.scale.setScalar(0.72);
      m.rotation.y = opts.cross.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const x = kind === 'crossing' ? -opts.cross.dir * 7 : LANES[lane];
    m.position.x = x;
    this.scene.add(m);
    const o = {
      kind, lane, x, wz, len: k.len, y0: k.y0, y1: k.y1, top, ramp: k.ramp, mesh: m, anim,
      moving: opts.moving ?? 0, cross: opts.cross, dead: false, passed: false, zPrev: false,
      warned: false, rockY: kind === 'rockfall' ? 18 : 0,
    };
    if (kind === 'rockfall') m.userData.rock.position.y = o.rockY;
    this.obstacles.push(o);
    return o;
  }

  /** Lane-crossing and falling hazards, plus early warnings for anything fast. */
  updateHazard(o, dt) {
    const dz = o.wz - this.D;
    const closing = this.speed + (o.moving || 0);
    if (!o.warned && (o.moving || o.kind === 'rockfall' || o.kind === 'crossing') && dz > 0 && dz / closing < 2.3) {
      o.warned = true;
      const lane = o.kind === 'crossing' ? (o.cross.dir > 0 ? 0 : 2) : o.lane;
      this.emit('warn', { lane, icon: WARN_ICONS[o.kind] ?? '⚠️' });
    }
    if (o.moving && dz > -4 && dz < 90 && Math.random() < dt * 22) {
      this.fx.emit(o.x + rand(-0.8, 0.8), 0.2, this.D - o.wz - o.len / 2, { vx: rand(-1, 1), vy: rand(0.6, 1.6), vz: rand(-1, 1), life: rand(0.6, 1.1), size: rand(0.25, 0.5), color: this.world.dustColor(), grow: 1.2 });
    }
    if (o.kind === 'rockfall') {
      const rock = o.mesh.userData.rock;
      const ring = o.mesh.userData.warn;
      if (dz < this.speed * 1.05 && o.rockY > 0) {
        o.rockVy = (o.rockVy ?? 0) - 60 * dt;
        o.rockY = Math.max(0, o.rockY + o.rockVy * dt);
        if (o.rockY === 0) {
          this.shake = Math.max(this.shake, 0.35);
          this.fx.debris(o.x, 0.3, this.D - o.wz, [0xf4f7fb, 0x8c8e96], 10);
          audio.land();
        }
      }
      rock.position.y = o.rockY;
      rock.rotation.x += dt * (o.rockY > 0 ? 6 : 0);
      ring.visible = o.rockY > 0;
      ring.scale.setScalar(1 + Math.sin(this.time * 14) * 0.12);
    }
    if (o.kind === 'crossing' && dz < 70) {
      o.x += o.cross.dir * o.cross.v * dt;
      o.mesh.position.x = o.x;
    }
  }

  updateObstacles(dt, prevD) {
    const p = this.p;
    const pw = this.powers;
    const invincible = pw.tembo || pw.duma || pw.tai || p.invuln > 0;
    const pH = p.slide > 0 ? 0.85 : 1.75;
    const changing = Math.abs(p.x - LANES[p.lane]) > 0.15;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.moving) o.wz -= o.moving * dt;
      if (o.anim) o.anim.update(dt, o.moving ? 1.4 : o.kind === 'crossing' ? 0.6 : 1, o.moving ? 'run' : o.kind === 'crossing' ? 'walk' : 'idle');
      this.updateHazard(o, dt);

      if (o.flying) {
        o.vy -= 30 * dt;
        o.mesh.position.y += o.vy * dt;
        o.mesh.position.x += o.vx * dt;
        o.wz += o.vz * dt;
        o.mesh.rotation.x += o.spin * dt;
        o.mesh.rotation.z += o.spin * 0.6 * dt;
        if (o.mesh.position.y < -10) o.dead = true;
      }
      o.mesh.position.z = this.D - o.wz;

      const far = o.wz + o.len / 2;
      if (o.dead || far < this.D - 25) {
        this.scene.remove(o.mesh);
        this.obstacles.splice(i, 1);
        continue;
      }
      if (o.flying || (o.kind === 'ramp' && pw.tai)) continue;
      if (o.kind === 'rockfall' && o.rockY > 2) {
        o.zPrev = false;
        continue;
      }

      const ox = o.x;
      const zOver = Math.abs(this.D - o.wz) < o.len / 2 + 0.35;
      const xOver = Math.abs(p.x - ox) < 1.05 + 0.32;

      // near-miss: a big blocker whizzes past in the lane we just left
      if (!o.passed && this.D > o.wz + o.len / 2) {
        o.passed = true;
        if (!o.specialMiss && Math.abs(p.x - ox) < 2.8 && Math.abs(p.x - ox) > 1.5 && p.laneT < 0.45 && KINDS[o.kind].pass === 'hard') {
          this.stats.nearMiss++;
          this.emit('shout', { text: 'Close call!', sub: pick(SHOUTS) });
          this.score += 50 * multiplier();
          this.slowmo = 0.22;
          audio.whoosh();
        }
      }

      if (zOver && xOver) {
        let hit = false;
        if (o.top) {
          if (p.y >= o.top - 0.6) {
            if (!o.roofCounted && p.grounded && Math.abs(p.x - ox) < 0.9) {
              o.roofCounted = true;
              this.stats.roofs++;
            }
          } else hit = true;
        } else if (o.ramp) {
          const f = THREE.MathUtils.clamp((this.D - (o.wz - o.len / 2)) / o.len, 0, 1);
          if (f * o.ramp - p.y > 0.9) hit = true;
        } else {
          hit = p.y < o.y1 && p.y + pH > o.y0;
        }

        if (hit) {
          const side = o.zPrev && changing;
          if (invincible) this.smash(o);
          else if (this.shield > 0) {
            this.smash(o);
            this.breakShield();
          } else if (side) this.stumble(false);
          else return this.crash(o);
        }
      }

      if (this.state === 'running') {
        if (!o.clipChecked && o.kind === 'lion' && this.D > o.wz) {
          o.clipChecked = true;
          if (lionClip({ kind: 'lion', dx: Math.abs(p.x - o.x) })) this.noteNearMiss('lion', o);
        }
        if (!o.filled && o.kind === 'wildebeest') {
          const dz = o.wz - this.D;
          if (wildebeestFill({ kind: 'wildebeest', dz, dx: Math.abs(p.x - o.x) })) {
            o.filled = true;
            this.noteNearMiss('wildebeest', o);
          }
        }
        if (o.kind === 'water' && !o.cleared && Math.abs(p.x - o.x) < 1.3) {
          const bank = o.wz + o.len / 2;
          const over = this.D + 0.3 > o.wz - o.len / 2 && this.D < bank + 0.4;
          if (over && p.y > o.y1 + 0.05) o.jumped = true;
          if (o.jumped && p.grounded && this.D >= bank) {
            o.cleared = true;
            const margin = this.D - bank;
            if (waterClear({ jumped: true, grounded: true, margin, wasOver: prevD < bank })) this.noteNearMiss('water', o);
          }
        }
      }
      if (o.pump) {
        o.mesh.scale.setScalar(this.freeze > 0 ? o.pump : 1);
        if (this.freeze <= 0) o.pump = 0;
      }
      o.zPrev = zOver;
    }
  }

  smash(o) {
    if (o.flying) return;
    o.flying = true;
    o.vy = rand(9, 14);
    o.vx = (Math.sign(o.x) || (Math.random() < 0.5 ? -1 : 1)) * rand(5, 9);
    o.vz = rand(15, 30);
    o.spin = rand(-8, 8);
    o.moving = 0;
    o.cross = null;
    if (o.kind === 'crossing') o.kind = 'boulder';
    this.stats.smash += this.powers.tembo ? 1 : 0;
    this.score += 25 * multiplier();
    this.shake = 0.5;
    audio.smash();
    this.haptic(25);
    const cols = o.kind === 'truck' ? [0x4f6b3a, 0x2a2522, 0x8a4a22] : o.kind === 'log' || o.kind === 'gate' ? [0x6b4526, 0xd9b07a, 0x6f8c33] : o.kind === 'cart' ? [0xe4572e, 0xf6d04d, 0x8a5a32] : [0xa08a78, 0x93806e, 0xd9b07a];
    this.fx.debris(o.x, 0.5, -1, cols, 16);
  }

  stumble(edge) {
    const p = this.p;
    if (!edge) {
      p.lane = p.prevLane;
      p.laneT = 9;
    }
    this.shake = 0.35;
    this.runner.hit?.();
    audio.bump();
    this.haptic(40);
    if (this.chaseT > 0 && this.stumbleT > 0 && !edge) {
      // stumbled twice while the pack was on our heels — caught!
      return this.crash(null, true);
    }
    if (!edge) {
      this.stumbleT = 7;
      this.chaseT = 7;
      setTimeout(() => this.state === 'running' && audio.cackle(), 150);
      this.emit('shout', { text: 'Stumbled!', sub: 'Fisi is right behind you!', warn: true });
    }
  }

  /** Holds the trail for a beat and keeps that moment for the share card. */
  noteNearMiss(kind, obstacle) {
    if (this.state !== 'running' || this.freeze > 0) return;
    const spec = nearMissSpec(kind);
    if (!spec) return;
    if (obstacle) obstacle.specialMiss = true;
    this.freeze = 0.62;
    this.cardMoment = spec;
    this.stats.nearMiss++;
    this.score += 50 * multiplier();
    if (kind === 'wildebeest' && obstacle?.mesh) obstacle.pump = 2.15;
    if (kind === 'lion') this.shake = Math.max(this.shake, 0.28);
    this.emit('shout', { text: spec.shout, sub: spec.line });
    audio.whoosh();
    this.haptic(20);
  }

  /**
   * The faint runner ahead. Hidden unless `run` is a real finish: a name, a
   * distance and a time. A missing ghost is not replaced with a made-up score.
   */
  setGhost(run) {
    const distance = Math.floor(Number(run?.distance) || 0);
    const duration = Math.floor(Number(run?.duration) || 0);
    const name = String(run?.name || '').trim().slice(0, 16);
    if (!name || distance <= 0 || duration <= 0) {
      this.ghostRun = null;
      if (this.ghost) this.ghost.root.visible = false;
      return;
    }
    const runner = RUNNERS.some((r) => r.id === run.runner) ? run.runner : 'zuri';
    this.ghostRun = { name, distance, duration, runner };
    this.ghostPassed = false;
    this.ensureGhost(runner);
  }

  ensureGhost(runnerId) {
    const outfit = outfitId(save.outfit);
    if (this.ghost && this.ghostRunnerId === runnerId && this.ghostOutfit === outfit) return;
    if (this.ghost) this.scene.remove(this.ghost.root);
    const def = RUNNERS.find((r) => r.id === runnerId) ?? RUNNERS[0];
    const ghost = makeRunner(def, outfit);
    ghost.root.traverse((node) => {
      if (!node.isMesh) return;
      const material = node.material.clone();
      material.transparent = true;
      material.opacity = 0.32;
      material.depthWrite = false;
      node.material = material;
      node.castShadow = false;
    });
    ghost.shadow.visible = false;
    ghost.root.visible = false;
    this.scene.add(ghost.root);
    this.ghost = ghost;
    this.ghostRunnerId = def.id;
    this.ghostOutfit = outfit;
  }

  updateGhost(dt) {
    const run = this.ghostRun;
    if (!run || !this.ghost) return;
    const dist = ghostDistance(run, this.runTime);
    if (dist == null) {
      this.ghost.root.visible = false;
      return;
    }
    const ahead = dist - this.D;
    this.ghost.root.visible = ahead > -40 && ahead < 90;
    this.ghost.root.position.set(LANES[0], 0, -ahead);
    this.ghost.update(dt, this.speed, 'run');
    if (!this.ghostPassed && ahead < -0.4) {
      this.ghostPassed = true;
      this.emit('shout', { text: 'Passed!', sub: run.name });
    }
  }

  crash(o, caught = false) {
    this.state = 'dying';
    this.freeze = 0;
    this.deathT = 0;
    this.caught = caught;
    this.chaseT = 99;
    this.shake = 0.9;
    this.powers = {};
    for (const a of Object.values(this.allyModels)) a.root.visible = false;
    audio.crash();
    audio.muffle(true);
    this.haptic([60, 40, 120]);
    this.fx.debris(this.p.x, 1, -0.5, [0xd9b07a, 0xffffff, 0xc28c55], 14);
    if (o?.moving) o.moving = 0;
    if (o?.cross) o.cross = null;
    setTimeout(() => audio.cackle(), 500);
  }

  updateDying(dt) {
    this.deathT += dt;
    const p = this.p;
    const ground = this.groundAt(p.x, p.y);
    if (p.y > ground) {
      p.vy -= GRAVITY * dt;
      p.y = Math.max(ground, p.y + p.vy * dt);
    }
    this.runner.update(dt, 0, 'dead');
    this.runner.root.position.set(p.x, p.y, 0);
    this.runner.shadow.position.y = 0.03;
    this.runner.shadow.visible = true;
    this.runner.root.visible = true;
    this.speed = damp(this.speed, 0, 5, dt);
    this.updateChasers(dt);
    for (const o of this.obstacles) {
      o.mesh.position.z = this.D - o.wz;
      if (o.anim) o.anim.update(dt, 0, 'idle');
    }
    if (this.deathT > 1.3 && this.state === 'dying') {
      this.state = 'over';
      this.emit('over', this.summary());
    }
  }

  summary() {
    return {
      score: Math.floor(this.score),
      seeds: this.seeds,
      distance: Math.floor(this.D),
      stats: { ...this.stats },
      caught: this.caught,
      chapter: this.region,
      region: REGIONS[this.region]?.id ?? 'serengeti',
      lap: this.lap,
      duration: Math.max(0, Math.round(this.runTime)),
      revives: this.revives,
      day: this.day,
      startRegion: this.startIndex ?? 0,
      runner: this.runnerId,
      nearMiss: this.cardMoment
        ? { kind: this.cardMoment.kind, line: this.cardMoment.line, shout: this.cardMoment.shout }
        : null,
    };
  }

  /* ------------------------------------------------------------ spawning */
  spawn() {
    while (this.nextChunk < this.D + 170) {
      const plan = chunkPlan(this.day, this.nextChunk);
      const chunk = makeChunk({
        z: plan.z,
        D: plan.D,
        speed: plan.speed,
        rng: plan.rng,
        region: regionAt(this.startJ + plan.z),
        wantTotem: plan.z + 150 > this.nextTotemAt,
        // a slot for the next prize box, or for the next hunt letter when one is due
        wantBox: plan.z > this.nextBoxAt || (plan.z > this.nextLetterAt && !this.letterOut && save.hunt.got < this.huntWord().word.length),
      });
      this.applyChunk(chunk.ops);
      this.nextChunk += chunk.len + plan.gap;
    }
  }

  applyChunk(ops) {
    for (const op of ops) {
      switch (op[0]) {
        case 'obs': this.addObstacle(op[1], op[2], op[3], op[4]); break;
        case 'line': this.coinLine(op[1], op[2], op[3], op[4], op[5], op[6]); break;
        case 'arc': this.coinArc(op[1], op[2]); break;
        case 'totem': this.addTotem(op[1], op[2], op[3]); break;
        case 'box': this.addBox(op[1], op[2], op[3]); break;
      }
    }
  }

  coinLine(lane, from, to, step = 2, y = 0, rampUp = false) {
    for (let z = from; z <= to; z += step) {
      let yy = y;
      if (rampUp) yy = ((z - from) / Math.max(1, to - from)) * KINDS.ramp.ramp;
      this.coins.push({ x: LANES[lane], y: yy + 0.9, wz: z, taken: false });
    }
  }

  coinArc(lane, center) {
    const v = JUMP_V;
    const t = (2 * v) / GRAVITY;
    const span = this.speed * t;
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      const tt = f * t;
      const h = v * tt - 0.5 * GRAVITY * tt * tt;
      this.coins.push({ x: LANES[lane], y: h + 0.9, wz: center - span / 2 + f * span, taken: false });
    }
  }

  addTotem(id, lane, wz) {
    id ??= ALLY_IDS[Math.floor(rngAt(this.day, 4, wz)() * ALLY_IDS.length)];
    const a = ALLIES[id];
    const m = makeTotem(a.emoji, a.ring);
    m.position.x = LANES[lane];
    this.scene.add(m);
    this.totems.push({ id, lane, wz, mesh: m });
    this.nextTotemAt = wz + 420 + rngAt(this.day, 3, wz)() * 280;
  }

  addBox(lane, wz, y = 0) {
    // some of the open-ground slots carry the next letter of the day's word instead
    const { word } = this.huntWord();
    if (y === 0 && wz > this.nextLetterAt && save.hunt.got < word.length && !this.letterOut) {
      const char = word[save.hunt.got];
      const m = makeLetterToken(char);
      m.position.set(LANES[lane], 0, 0);
      this.scene.add(m);
      this.boxes.push({ lane, wz, y, mesh: m, letter: char });
      this.letterOut = true;
      this.nextLetterAt = wz + 200 + Math.random() * 180;
      return;
    }
    if (wz <= this.nextBoxAt) return; // the slot was asked for a letter that can't sit here
    const m = makePrizeBox();
    m.position.set(LANES[lane], y, 0);
    this.scene.add(m);
    this.boxes.push({ lane, wz, y, mesh: m });
    // roughly every 250-450 m, a little more often the further you get
    this.nextBoxAt = wz + 250 + rngAt(this.day, 6, wz)() * 200 - Math.min(80, this.D / 100);
  }

  /** Opens a Zawadi box: seeds, a shield charm, a surprise ally, double seeds or bonus points. */
  openBox(b) {
    this.stats.boxes++;
    const m = multiplier();
    const roll = Math.random() * PRIZE_WEIGHT;
    let acc = 0;
    const prize = PRIZES.find((p) => (acc += p.w) >= roll) ?? PRIZES[0];
    let out;
    switch (prize.id) {
      case 'seeds':
        this.seeds += prize.n;
        this.stats.seeds = this.seeds;
        this.emit('seed', this.seeds);
        out = prize.n >= 1000
          ? { emoji: '💰', title: 'JACKPOT!', sub: `+${prize.n.toLocaleString()} seeds`, big: true }
          : { emoji: '🌾', title: `+${prize.n} seeds`, sub: 'Zawadi!' };
        break;
      case 'charm':
        save.charms = (save.charms ?? 0) + 1;
        persist();
        this.emit('shield', { on: this.shield > 0 });
        out = { emoji: '🛡️', title: 'Ngao charm!', sub: 'One more shield for the road' };
        break;
      case 'ally': {
        const id = ALLY_IDS[Math.floor(Math.random() * ALLY_IDS.length)];
        out = { emoji: ALLIES[id].emoji, title: `${ALLIES[id].name} joins you!`, sub: ALLIES[id].power };
        this.activate(id);
        break;
      }
      case 'double':
        this.seedBoost = 15;
        out = { emoji: '✨', title: 'Double seeds!', sub: 'Every seed counts twice for 15s' };
        break;
      default:
        this.score += prize.n * m;
        out = { emoji: '⭐', title: `+${(prize.n * m).toLocaleString()} points`, sub: 'Zawadi!' };
    }
    audio.powerup();
    audio.chime();
    this.haptic(30);
    const z = this.D - b.wz;
    this.fx.sparkle(LANES[b.lane], b.y + 1.2, z, 0xffd34d, 18);
    this.fx.debris(LANES[b.lane], b.y + 1.1, z, [0xc0392b, 0xf4d35e, 0x1b998b], 14);
    this.emit('prize', out);
  }

  /** The word being hunted: today's chain, after the words already spelled. */
  huntWord() {
    return huntWord(HUNT_WORDS, save.hunt.day || this.day, save.hunt.done);
  }

  collectLetter(b) {
    this.letterOut = false;
    const { word, line } = this.huntWord();
    save.hunt.got++;
    persist();
    const z = this.D - b.wz;
    this.fx.sparkle(LANES[b.lane], 1.3, z, 0xffe58a, 16);
    audio.chime();
    this.haptic(20);
    const done = save.hunt.got >= word.length;
    this.emit('letter', { got: save.hunt.got, word, done });
    if (!done) {
      this.emit('shout', { text: b.letter, sub: `${word.slice(0, save.hunt.got)}… word hunt` });
      return;
    }
    const prize = word.length * HUNT_PER_LETTER;
    this.seeds += prize;
    this.stats.seeds = this.seeds;
    this.stats.words++;
    save.charms = (save.charms ?? 0) + 1;
    // on to the next word in today's chain
    save.hunt.done++;
    save.hunt.got = 0;
    persist();
    this.emit('seed', this.seeds);
    this.emit('shield', { on: this.shield > 0 });
    audio.powerup();
    this.emit('prize', { emoji: '🏆', title: `${word}!`, sub: `${line} · +${prize} seeds & a shield`, big: true });
    this.emit('hunt', { word: this.huntWord().word, got: 0, delay: 3000 });
  }

  /* ------------------------------------------------------------- pickups */
  updatePickups(dt) {
    const p = this.p;
    const magnet = !!this.powers.hondo;
    const py = p.y + (p.slide > 0 ? 0.5 : 0.9);

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      const dz = c.wz - this.D;
      if (dz < -6) {
        this.coins.splice(i, 1);
        continue;
      }
      if (magnet && dz < 22 && dz > -2) c.mag = true;
      if (c.mag) {
        const k = 1 - Math.exp(-12 * dt);
        c.x += (p.x - c.x) * k;
        c.y += (py - c.y) * k;
        c.wz += (this.D - c.wz) * k;
      }
      if (Math.abs(c.wz - this.D) < 0.9 && Math.abs(c.x - p.x) < 1.0 && Math.abs(c.y - py) < 1.25) {
        this.coins.splice(i, 1);
        this.collectSeed(c);
      }
    }

    for (let i = this.totems.length - 1; i >= 0; i--) {
      const t = this.totems[i];
      t.mesh.position.z = this.D - t.wz;
      const dz = t.wz - this.D;
      if (dz < -8) {
        this.scene.remove(t.mesh);
        this.totems.splice(i, 1);
        continue;
      }
      if (Math.abs(dz) < 1.2 && Math.abs(LANES[t.lane] - p.x) < 1.1 && p.y < 3.2) {
        this.scene.remove(t.mesh);
        this.totems.splice(i, 1);
        this.activate(t.id);
      }
    }

    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      b.mesh.position.z = this.D - b.wz;
      b.mesh.userData.spin(this.time);
      const dz = b.wz - this.D;
      if (dz < -8) {
        this.scene.remove(b.mesh);
        this.boxes.splice(i, 1);
        if (b.letter) this.letterOut = false;
        continue;
      }
      // Hondo's magnet pulls boxes in too
      const reach = magnet ? 2.6 : 1.15;
      if (Math.abs(dz) < 1.3 && Math.abs(LANES[b.lane] - p.x) < reach && Math.abs(p.y + 0.8 - (b.y + 1.05)) < 1.6) {
        this.scene.remove(b.mesh);
        this.boxes.splice(i, 1);
        if (b.letter) this.collectLetter(b);
        else this.openBox(b);
      }
    }
  }

  collectSeed(c) {
    this.seeds += this.seedBoost > 0 ? 2 : 1;
    this.stats.seeds = this.seeds;
    this.combo++;
    this.comboT = 0.9;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.score += 5 * multiplier() * (this.powers.simba ? 2 : 1);
    const step = COMBO_STEPS.find(([n]) => n === this.combo);
    if (step) {
      this.score += step[1] * multiplier();
      this.emit('shout', { text: `Combo ×${this.combo}!`, sub: `+${(step[1] * multiplier()).toLocaleString()}` });
      audio.chime();
    }
    this.emit('combo', this.combo);
    audio.coin(this.combo);
    this.fx.sparkle(c.x, c.y, this.D - c.wz, 0xffd34d, 4);
    this.emit('seed', this.seeds);
  }

  updateCoinsMesh() {
    const d = this.dummy;
    let n = 0;
    const spin = this.time * 4;
    for (const c of this.coins) {
      const z = this.D - c.wz;
      if (z < -175 || z > 10 || n >= 400) continue;
      d.position.set(c.x, c.y + Math.sin(this.time * 4 + c.wz) * 0.08, z);
      d.rotation.set(0, spin + c.wz * 0.3, 0);
      d.updateMatrix();
      this.coinMesh.setMatrixAt(n++, d.matrix);
    }
    this.coinMesh.count = n;
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- allies */
  duration(id) {
    const a = ALLIES[id];
    return a.base + a.perLevel * (save.upgrades[id] ?? 0);
  }

  activate(id) {
    const pw = this.powers;
    // mounts are exclusive
    if (id === 'tembo' && pw.tai) this.endPower('tai');
    if (id === 'tai' && pw.tembo) this.endPower('tembo');
    pw[id] = this.duration(id);
    this.stats.allies++;
    audio.powerup();
    this.haptic(30);
    if (id === 'simba') {
      audio.roar();
      this.shake = 0.7;
    }
    if (id === 'tembo') audio.trumpet();
    if (id === 'tai') {
      audio.whoosh();
      this.skyTrail();
    }
    const m = this.allyModels[id];
    m.root.visible = true;
    if (id === 'twiga' || id === 'duma' || id === 'simba') m.root.position.z = 6;
    this.fx.sparkle(this.p.x, 1.4, 0, 0xffffff, 18);
    this.emit('power', { id, on: true, dur: pw[id], line: pick(ALLIES[id].lines) });
  }

  endPower(id) {
    delete this.powers[id];
    this.allyModels[id].root.visible = false;
    if (id === 'tai' || id === 'tembo') {
      this.p.invuln = Math.max(this.p.invuln, 1.2);
      if (id === 'tai') {
        this.p.grounded = false;
        this.p.vy = 0;
      }
      if (id === 'tembo') this.fx.debris(this.p.x, 0.5, 0, [0x8e8a87, 0xc0392b, 0xf4d35e], 10);
    }
    this.emit('power', { id, on: false });
  }

  skyTrail() {
    // a river of seeds across the sky
    const from = this.D + 20;
    const len = this.speed * 1.25 * this.duration('tai');
    let l = 1;
    for (let z = from; z < from + len - 20; z += 2.2) {
      if (Math.random() < 0.06) l = Math.max(0, Math.min(2, l + pick([-1, 1])));
      this.coins.push({ x: LANES[l], y: 8.4, wz: z, taken: false });
    }
  }

  updateRunnerVisual(dt) {
    const p = this.p;
    const pw = this.powers;
    const r = this.runner;
    let pose = 'run';
    let yOff = 0;
    if (pw.tai) pose = 'fly';
    else if (pw.tembo) {
      pose = 'ride';
      yOff = 1.95;
    } else if (p.slide > 0 && p.grounded) pose = 'slide';
    else if (!p.grounded) pose = 'jump';
    r.update(dt, this.speed, pose);
    r.root.position.set(p.x, p.y + yOff, 0);
    // lean into lane changes
    r.root.rotation.z = (LANES[p.lane] - p.x) * -0.12;
    r.root.rotation.y = 0;
    r.shadow.position.y = 0.03 - p.y - yOff + (p.ground || 0);
    r.shadow.visible = !pw.tai && !pw.tembo;
    const blink = p.invuln > 0 && !pw.tai && !pw.tembo && Math.floor(this.time * 14) % 2 === 0;
    r.root.visible = !blink;
  }

  updateAllies(dt) {
    const p = this.p;
    const pw = this.powers;
    const M = this.allyModels;
    if (pw.tembo) {
      const e = M.tembo;
      e.root.position.set(p.x, p.y, -0.2);
      e.root.rotation.z = (LANES[p.lane] - p.x) * -0.08;
      e.update(dt, this.speed / 18);
    }
    if (pw.tai) {
      const e = M.tai;
      e.root.position.set(p.x, p.y + 2.55, -0.1);
      e.root.rotation.z = (LANES[p.lane] - p.x) * -0.15;
      e.update(dt);
    }
    if (pw.duma) {
      const e = M.duma;
      const side = p.lane === 2 ? -1 : 1;
      e.root.position.x = damp(e.root.position.x, p.x + side * 1.25, 6, dt);
      e.root.position.y = p.y > 2 ? p.y : 0;
      e.root.position.z = damp(e.root.position.z, -1.2, 3, dt);
      e.update(dt, this.speed / 14);
      if (Math.random() < dt * 30) this.fx.emit(rand(-6, 6), rand(0.5, 4), rand(-30, -5), { vx: 0, vy: 0, vz: 60, life: 0.4, size: 0.05, color: 0xfff3c0, grow: 0 });
    }
    if (pw.twiga) {
      const e = M.twiga;
      const side = p.x > 0 ? -1 : 1;
      e.root.position.x = damp(e.root.position.x, side * 5.6, 4, dt);
      e.root.position.z = damp(e.root.position.z, -3, 3, dt);
      e.update(dt, this.speed / 14);
    }
    if (pw.hondo) {
      const e = M.hondo;
      const a = this.time * 3;
      e.root.position.set(p.x + Math.cos(a) * 1.4, p.y + 2.6 + Math.sin(a * 2) * 0.2, Math.sin(a) * 1.4 - 0.5);
      e.root.rotation.y = -a;
      e.update(dt);
    }
    if (pw.simba) {
      const e = M.simba;
      const side = p.lane === 0 ? 1 : -1;
      const dumaSide = pw.duma ? (p.lane === 2 ? -1 : 1) : 0;
      const s = dumaSide === side ? -side : side;
      e.root.position.x = damp(e.root.position.x, p.x + s * 1.3, 6, dt);
      e.root.position.y = p.y > 2 ? p.y : 0;
      e.root.position.z = damp(e.root.position.z, 0.8, 3, dt);
      e.update(dt, this.speed / 14);
    }
  }

  updateChasers(dt) {
    const p = this.p;
    const dying = this.state === 'dying';
    const target = dying ? 1.3 : this.chaseT > 0 ? 1.15 : 18;
    this.chaseDist = damp(this.chaseDist, target, dying ? 2.5 : this.chaseT > 0 ? 2.5 : 0.8, dt);
    this.chasers.forEach((c, i) => {
      const lagX = dying ? p.x + c.offset * 0.9 : p.x + c.offset * (this.chaseT > 0 ? 0.55 : 1);
      c.root.position.x = damp(c.root.position.x, lagX, 4 - c.lag * 1.5, dt);
      c.root.position.z = this.chaseDist + c.lag;
      c.root.position.y = Math.max(0, p.y > 2.2 && !dying ? 0 : 0);
      c.root.visible = c.root.position.z < 16;
      if (c.root.visible) c.update(dt, dying && this.deathT > 0.8 ? 0.15 : this.speed / 16, dying && this.deathT > 1 ? 'idle' : 'run');
    });
    if (this.stumbleT > 0) this.stumbleT -= dt;
  }

  /* --------------------------------------------------------------- story */
  checkStory() {
    const { index, lap } = regionIndexAt(this.J);
    if (index !== this.region || lap !== this.lap) {
      const first = this.region === -1;
      if (lap > this.lap) {
        this.emit('lap', { lap });
        this.score += 5000 * multiplier();
      }
      this.region = index;
      this.lap = lap;
      if (!first) this.stats.regions++;
      const r = REGIONS[index];
      const isNew = index > (save.regionMax ?? 0);
      if (isNew) {
        save.regionMax = index;
        persist();
      }
      this.chapter = index;
      this.emit('chapter', { index, ...r, lap, unlocked: isNew });
      audio.setRegion(r.music);
      if (!first) audio.chime();
    }
    if (this.tutorialIdx < TUTORIAL.length && !save.tutorialDone) {
      const t = TUTORIAL[this.tutorialIdx];
      if (this.D >= t.at) {
        this.tutorialIdx++;
        this.emit('tutorial', t);
        if (this.tutorialIdx >= TUTORIAL.length) {
          save.tutorialDone = true;
          persist();
        }
      }
    }
  }

  /* --------------------------------------------------------------- camera */
  updateCamera(dt) {
    const p = this.p;
    const cam = this.camera;
    const tp = new THREE.Vector3();
    const tl = new THREE.Vector3();
    let k = 6;
    if (this.camMode === 'menu') {
      const s = Math.sin(this.time * 0.15);
      tp.set(1.35 + s * 0.25, 1.6, 4.3);
      tl.set(-1.0, 1.75, -8);
      k = 2;
    } else if (this.camMode === 'select') {
      // the outfit card sits on the bottom of the phone, so frame the face and chest above it
      tp.set(0.2, 1.15, -2.55);
      tl.set(0, 1.48, 0);
      k = 4;
    } else {
      const fly = this.powers.tai ? Math.min(1, p.y / 7.5) : 0;
      const ride = this.powers.tembo ? 0.8 : 0;
      tp.set(p.x * 0.72, lerp(4.3 + p.y * 0.55, p.y + 3.4, fly) + ride, 7.4 + fly * 0.4);
      tl.set(p.x * 0.85, lerp(1.25 + p.y * 0.6, p.y - 1.2, fly), -9);
      k = 8;
      if (this.state === 'dying' || this.state === 'over') {
        // swing round in front of the runner to show the pack closing in
        tp.set(p.x * 0.5 + 1.6, 5.2 + p.y, -4.8);
        tl.set(p.x, 0.5 + p.y, 1.6);
        k = 2.4;
      }
    }
    this.camPos.x = damp(this.camPos.x, tp.x, k * 1.2, dt);
    this.camPos.y = damp(this.camPos.y, tp.y, k * 0.6, dt);
    this.camPos.z = damp(this.camPos.z, tp.z, k * 0.6, dt);
    this.camLook.lerp(tl, 1 - Math.exp(-k * dt));
    cam.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8);
      const s = this.shake * this.shake * 0.4;
      cam.position.x += rand(-s, s);
      cam.position.y += rand(-s, s);
    }
    cam.lookAt(this.camLook);
    const fovTarget = this.baseFov + (this.camMode === 'run' && this.state === 'running' ? Math.min(8, (this.speed - 15) * 0.3) + (this.powers.duma ? 8 : 0) : 0);
    if (Math.abs(cam.fov - fovTarget) > 0.05) {
      cam.fov = damp(cam.fov, fovTarget, 3, dt);
      cam.updateProjectionMatrix();
    }
  }
}

