import * as THREE from 'three';
import { curve, bend, bakeRigid } from './materials.js';
import {
  makeRunner, Animals, makeEagle, makeHornbill, makeLog, makeBranchGate, makeBoulder, makeMoundObstacle,
  makeTruck, makeRamp, makeTotem,
} from './models.js';
import { World, Particles, LANE_W } from './world.js';
import { audio } from './audio.js';
import { RUNNERS, ALLIES, ALLY_IDS, CHAPTERS, TUTORIAL, SHOUTS } from '../data/content.js';
import { save, multiplier } from '../data/save.js';

const LANES = [-LANE_W, 0, LANE_W];
const GRAVITY = 58;
const JUMP_V = 16;
const SLIDE_T = 0.62;
const TRUCK_LEN = 7;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (n) => (Math.random() * n) | 0;
const pick = (a) => a[randi(a.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const shuffle = (a) => a.sort(() => Math.random() - 0.5);

// Collision profiles: vertical extent and z-length of each obstacle kind.
const KINDS = {
  log: { y0: 0, y1: 0.85, len: 0.9 },
  gate: { y0: 1.12, y1: 3.4, len: 0.4 },
  boulder: { y0: 0, y1: 2.7, len: 2.0 },
  mound: { y0: 0, y1: 2.9, len: 1.5 },
  truck: { y0: 0, y1: 2.7, len: TRUCK_LEN, top: 2.7 },
  ramp: { y0: 0, y1: 0, len: 5, ramp: 2.7 },
  rhino: { y0: 0, y1: 1.9, len: 2.4 },
};

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

    this.obstacles = [];
    this.coins = [];
    this.totems = [];
    this.buildCoins();
    this.buildAllies();
    this.buildChasers();
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
  }

  /* -------------------------------------------------------- characters */
  setRunner(id) {
    const def = RUNNERS.find((r) => r.id === id) ?? RUNNERS[0];
    if (this.runner) this.scene.remove(this.runner.root);
    this.runner = makeRunner(def);
    this.scene.add(this.runner.root);
    this.runnerId = def.id;
  }

  buildAllies() {
    this.allyModels = {
      tembo: Animals.elephant(),
      tai: makeEagle(),
      duma: Animals.cheetah(),
      twiga: Animals.giraffe(),
      hondo: makeHornbill(),
      simba: Animals.lion(),
    };
    this.allyModels.tembo.root.scale.setScalar(0.62);
    this.allyModels.tai.root.scale.setScalar(0.9);
    this.allyModels.twiga.root.scale.setScalar(0.9);
    for (const a of Object.values(this.allyModels)) {
      a.root.visible = false;
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
      this.scene.add(c.root);
    });
  }

  buildCoins() {
    const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.09, 14);
    geo.rotateX(Math.PI / 2);
    const m = bend(new THREE.MeshLambertMaterial({ color: 0xffc83d, emissive: 0x8a5200 }));
    this.coinMesh = new THREE.InstancedMesh(geo, m, 400);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.count = 0;
    this.scene.add(this.coinMesh);
    this.dummy = new THREE.Object3D();
  }

  /* --------------------------------------------------------------- run */
  resetRun() {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const t of this.totems) this.scene.remove(t.mesh);
    this.obstacles = [];
    this.totems = [];
    this.coins = [];
    this.D = 0;
    this.speed = 15;
    this.score = 0;
    this.seeds = 0;
    this.combo = 0;
    this.comboT = 0;
    this.stats = { seeds: 0, distance: 0, jumps: 0, slides: 0, allies: 0, score: 0, roofs: 0, smash: 0, nearMiss: 0 };
    this.p = { lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, grounded: true, slide: 0, invuln: 0, laneT: 9, onTruck: null, ground: 0 };
    this.powers = {};
    this.chaseT = 0;
    this.chaseDist = 14;
    this.stumbleT = 0;
    this.nextChunk = 45;
    this.nextTotemAt = 260 + rand(0, 140);
    this.chapter = -1;
    this.tutorial = !save.tutorialDone;
    this.tutorialIdx = 0;
    this.chunkIdx = 0;
    this.revives = 0;
    this.deathT = 0;
    for (const a of Object.values(this.allyModels)) a.root.visible = false;
  }

  start() {
    this.resetRun();
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
    this.state = 'menu';
    this.camMode = mode;
    audio.setIntensity(0);
    audio.muffle(false);
  }

  revive() {
    this.revives++;
    // clear the way ahead
    for (const o of this.obstacles) if (o.wz < this.D + 50) o.dead = true;
    this.p.invuln = 3;
    this.p.y = Math.max(this.p.y, 0);
    this.state = 'running';
    this.chaseT = 0;
    audio.muffle(false);
    audio.powerup();
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
        if (p.grounded) {
          p.vy = JUMP_V * (this.powers.twiga ? 1.6 : 1);
          p.grounded = false;
          p.slide = 0;
          this.stats.jumps++;
          audio.jump();
          this.fx.dust(p.x, 0, 0xd9b07a, 4);
        }
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

  /* -------------------------------------------------------------- loop */
  frame() {
    let dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.adaptQuality(dt);

    if (this.state === 'running') this.updateRun(dt);
    else if (this.state === 'dying') this.updateDying(dt);
    else if (this.state === 'menu') this.updateMenu(dt);

    if (this.state !== 'paused') {
      this.world.update(dt, this.D, this.camera, this.time);
      this.world.setTime(this.D);
      this.fx.update(dt, this.state === 'running' ? this.speed * dt : 0);
      this.updateCoinsMesh();
      for (const t of this.totems) t.mesh.userData.spin(this.time);
    }
    // gentle sway of the curved horizon, like the real thing
    curve.value.x = Math.sin(this.time * 0.08) * 0.0011;
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  adaptQuality(dt) {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc > 2.5) {
      const fps = this.fpsFrames / this.fpsAcc;
      if (fps < 42 && this.pixelRatio > 1) {
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
    if (this.chaseT > 0) this.chaseT -= dt;
    if (this.comboT > 0) this.comboT -= dt;
    else this.combo = 0;
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
        if (ground < p.y - 0.05) p.grounded = false;
        else p.y = ground;
      }
      if (!p.grounded) {
        p.vy -= GRAVITY * (p.vy < 0 ? 1.15 : 1) * dt;
        p.y += p.vy * dt;
        if (p.y <= ground) {
          p.y = ground;
          p.vy = 0;
          p.grounded = true;
          audio.land();
          this.fx.dust(p.x, 0, 0xd9b07a, 5);
        }
      }
    }
    if (p.slide > 0) p.slide -= dt;

    this.spawn();
    this.updateObstacles(dt, prevD);
    this.updatePickups(dt);
    this.updateRunnerVisual(dt);
    this.updateAllies(dt);
    this.updateChasers(dt);
    this.checkStory();

    if (p.grounded && !pw.tembo && Math.random() < dt * 14) this.fx.dust(p.x, 0.3, 0xc9955a, 1);
    this.emit('hud', this);
  }

  /* --------------------------------------------------- ground & trucks */
  groundAt(x, y) {
    let g = 0;
    for (const o of this.obstacles) {
      if (o.dead || (!o.top && !o.ramp)) continue;
      if (Math.abs(x - LANES[o.lane]) > 1.0) continue;
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
    let m;
    let top = k.top;
    switch (kind) {
      case 'log': m = makeLog(); break;
      case 'gate': m = makeBranchGate(); break;
      case 'boulder': m = makeBoulder(); break;
      case 'mound': m = makeMoundObstacle(); break;
      case 'ramp': m = makeRamp(k.len, k.ramp); break;
      case 'truck': {
        const t = makeTruck(TRUCK_LEN, !!opts.moving);
        m = t.group;
        top = t.height;
        break;
      }
      case 'rhino': {
        const r = Animals.rhino();
        m = r.root;
        opts.anim = r;
        break;
      }
    }
    if (kind !== 'rhino') bakeRigid(m, true);
    m.position.x = LANES[lane];
    this.scene.add(m);
    const o = { kind, lane, wz, len: k.len, y0: k.y0, y1: k.y1, top, ramp: k.ramp, mesh: m, moving: opts.moving ?? 0, anim: opts.anim, dead: false, passed: false, zPrev: false };
    this.obstacles.push(o);
    return o;
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
      if (o.anim) o.anim.update(dt, 1.4, 'run');

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
      if (o.flying || o.kind === 'ramp' && pw.tai) continue;

      const ox = LANES[o.lane];
      const zOver = Math.abs(this.D - o.wz) < o.len / 2 + 0.35;
      const xOver = Math.abs(p.x - ox) < 1.05 + 0.32;

      // near-miss: a big blocker whizzes past in the lane we just left
      if (!o.passed && this.D > o.wz + o.len / 2) {
        o.passed = true;
        if (Math.abs(p.x - ox) < 2.8 && Math.abs(p.x - ox) > 1.5 && p.laneT < 0.45 && (o.kind === 'truck' || o.kind === 'boulder' || o.kind === 'rhino' || o.kind === 'mound')) {
          this.stats.nearMiss++;
          this.emit('shout', { text: 'Close call!', sub: pick(SHOUTS) });
          this.score += 50 * multiplier();
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
          else if (side) this.stumble(false);
          else return this.crash(o);
        }
      }
      o.zPrev = zOver;
    }
  }

  smash(o) {
    if (o.flying) return;
    o.flying = true;
    o.vy = rand(9, 14);
    o.vx = (o.lane - 1 || (Math.random() < 0.5 ? -1 : 1)) * rand(5, 9);
    o.vz = rand(15, 30);
    o.spin = rand(-8, 8);
    o.moving = 0;
    this.stats.smash += this.powers.tembo ? 1 : 0;
    this.score += 25 * multiplier();
    this.shake = 0.5;
    audio.smash();
    this.haptic(25);
    const cols = o.kind === 'truck' ? [0x4f6b3a, 0x2a2522, 0x8a4a22] : o.kind === 'log' || o.kind === 'gate' ? [0x6b4526, 0xd9b07a, 0x6f8c33] : [0xa08a78, 0x93806e, 0xd9b07a];
    this.fx.debris(LANES[o.lane], 0.5, -1, cols, 16);
  }

  stumble(edge) {
    const p = this.p;
    if (!edge) {
      p.lane = p.prevLane;
      p.laneT = 9;
    }
    this.shake = 0.35;
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

  crash(o, caught = false) {
    this.state = 'dying';
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
    if (o?.kind === 'rhino') o.moving = 0;
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
      chapter: this.chapter,
      revives: this.revives,
    };
  }

  /* ------------------------------------------------------------ spawning */
  spawn() {
    while (this.nextChunk < this.D + 170) {
      const len = this.tutorial ? this.tutorialChunk(this.nextChunk) : this.chunk(this.nextChunk);
      const diff = Math.min(1, this.D / 6000);
      const gap = Math.max(12, this.speed * lerp(1.15, 0.62, diff));
      this.nextChunk += len + gap;
    }
  }

  tutorialChunk(z) {
    const i = this.chunkIdx++;
    switch (i) {
      case 0: this.coinLine(1, z, z + 16); return 16;
      case 1: this.addObstacle('boulder', 1, z + 8); this.coinLine(0, z, z + 14); this.coinLine(2, z, z + 14); return 16;
      case 2: [0, 1, 2].forEach((l) => this.addObstacle('log', l, z + 10)); this.coinArc(1, z + 10); return 16;
      case 3: [0, 1, 2].forEach((l) => this.addObstacle('gate', l, z + 10)); this.coinLine(1, z + 6, z + 14, 1.6, 0.6); return 16;
      case 4: this.addTotem(pick(['tembo', 'duma', 'hondo']), 1, z + 10); this.coinLine(0, z, z + 20); return 20;
      default:
        this.tutorial = false;
        save.tutorialDone = true;
        return 10;
    }
  }

  chunk(z) {
    this.chunkIdx++;
    const d = this.D;
    const pats = [
      ['single', 3], ['double', d > 300 ? 3 : 1], ['logs', 2], ['gates', 2], ['mix', d > 400 ? 3 : 1],
      ['trucks', d > 250 ? 3.5 : 0.5], ['oncoming', d > 900 ? 2 : 0], ['rhino', d > 600 ? 1.6 : 0],
      ['snake', 1.2], ['zigzag', d > 500 ? 2 : 0], ['logrun', d > 350 ? 1.4 : 0],
    ];
    const total = pats.reduce((s, p) => s + p[1], 0);
    let r = Math.random() * total;
    let pat = 'single';
    for (const [name, w] of pats) {
      if ((r -= w) <= 0) {
        pat = name;
        break;
      }
    }
    const wantTotem = this.D + 150 > this.nextTotemAt;
    const L = [0, 1, 2];

    switch (pat) {
      case 'single': {
        const l = randi(3);
        this.addObstacle(pick(['boulder', 'mound']), l, z + 2);
        const free = L.filter((x) => x !== l);
        this.coinLine(pick(free), z - 6, z + 10);
        if (wantTotem) this.addTotem(null, free.find((x) => x !== l), z + 2);
        return 6;
      }
      case 'double': {
        const free = randi(3);
        L.filter((l) => l !== free).forEach((l) => this.addObstacle(pick(['boulder', 'mound', 'boulder']), l, z + 2));
        this.coinLine(free, z - 8, z + 12);
        return 6;
      }
      case 'logs': {
        L.forEach((l) => this.addObstacle('log', l, z + 2));
        this.coinArc(randi(3), z + 2);
        return 4;
      }
      case 'gates': {
        L.forEach((l) => this.addObstacle('gate', l, z + 2));
        this.coinLine(randi(3), z - 3, z + 6, 1.5, 0.6);
        return 4;
      }
      case 'mix': {
        const kinds = shuffle(['log', 'gate', pick(['boulder', 'mound'])]);
        kinds.forEach((k, l) => this.addObstacle(k, l, z + 2));
        const li = kinds.indexOf('log');
        this.coinArc(li, z + 2);
        return 4;
      }
      case 'trucks': {
        const lanes = shuffle([...L]).slice(0, 1 + randi(2));
        let longest = 0;
        lanes.forEach((l, i) => {
          const n = 1 + randi(3);
          const off = i * rand(0, 8);
          const withRamp = i === 0;
          let zz = z + off;
          if (withRamp) {
            this.addObstacle('ramp', l, zz + KINDS.ramp.len / 2);
            this.coinLine(l, zz + 0.5, zz + 4.5, 1.2, 0, true);
            zz += KINDS.ramp.len;
          }
          for (let k = 0; k < n; k++) this.addObstacle('truck', l, zz + TRUCK_LEN / 2 + k * TRUCK_LEN);
          this.coinLine(l, zz + 1, zz + n * TRUCK_LEN - 1, 1.8, 2.7 + 0.6);
          longest = Math.max(longest, zz + n * TRUCK_LEN - z);
        });
        const free = L.filter((l) => !lanes.includes(l));
        if (free.length && Math.random() < 0.5) this.addObstacle('log', free[0], z + longest * 0.5);
        if (free.length && wantTotem) this.addTotem(null, free[0], z + longest * 0.75);
        return longest;
      }
      case 'oncoming': {
        const l = randi(3);
        const v = rand(7, 11);
        // place far enough ahead that it arrives roughly in chunk position
        const lead = (z - this.D) * (v / Math.max(this.speed, 1));
        this.addObstacle('truck', l, z + lead + TRUCK_LEN, { moving: v });
        const free = L.filter((x) => x !== l);
        this.coinLine(pick(free), z - 4, z + 14);
        return 10;
      }
      case 'rhino': {
        const l = randi(3);
        const v = rand(6, 9);
        const lead = (z - this.D) * (v / Math.max(this.speed, 1));
        this.addObstacle('rhino', l, z + lead + 2, { moving: v });
        const free = L.filter((x) => x !== l);
        this.addObstacle('log', pick(free), z + 2);
        this.emit('warn', { lane: l });
        return 8;
      }
      case 'snake': {
        let l = randi(3);
        for (let k = 0; k < 4; k++) {
          this.coinLine(l, z + k * 8, z + k * 8 + 6);
          l = Math.max(0, Math.min(2, l + pick([-1, 1])));
        }
        if (wantTotem) this.addTotem(null, l, z + 34);
        return 34;
      }
      case 'zigzag': {
        let l = randi(3);
        for (let k = 0; k < 3; k++) {
          this.addObstacle(pick(['boulder', 'mound']), l, z + k * 14);
          const nl = L.filter((x) => x !== l);
          this.coinLine(pick(nl), z + k * 14 - 5, z + k * 14 + 3);
          l = pick(nl);
        }
        return 30;
      }
      case 'logrun': {
        const l = randi(3);
        for (let k = 0; k < 3; k++) {
          this.addObstacle('log', l, z + k * 12);
          this.coinArc(l, z + k * 12);
        }
        const other = pick(L.filter((x) => x !== l));
        this.addObstacle('gate', other, z + 12);
        return 26;
      }
    }
    return 8;
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
    id ??= pick(ALLY_IDS);
    const a = ALLIES[id];
    const m = makeTotem(a.emoji, a.ring);
    m.position.x = LANES[lane];
    this.scene.add(m);
    this.totems.push({ id, lane, wz, mesh: m });
    this.nextTotemAt = this.D + rand(420, 700);
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
  }

  collectSeed(c) {
    this.seeds++;
    this.stats.seeds = this.seeds;
    this.combo++;
    this.comboT = 0.6;
    this.score += 5 * multiplier() * (this.powers.simba ? 2 : 1);
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
    let c = 0;
    for (let i = 0; i < CHAPTERS.length; i++) if (this.D >= CHAPTERS[i].at) c = i;
    if (c !== this.chapter) {
      this.chapter = c;
      this.emit('chapter', { index: c, ...CHAPTERS[c], first: c > save.chapterSeen });
      if (c > 0) audio.chime();
      if (c > save.chapterSeen) save.chapterSeen = c;
    }
    if (this.tutorialIdx < TUTORIAL.length && !save.tutorialDone) {
      const t = TUTORIAL[this.tutorialIdx];
      if (this.D >= t.at) {
        this.tutorialIdx++;
        this.emit('tutorial', t);
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
      tp.set(1.7 + s * 0.3, 1.6, 4.1);
      tl.set(-1.4, 1.75, -8);
      k = 2;
    } else if (this.camMode === 'select') {
      tp.set(0.5, 1.45, -4.6);
      tl.set(0, 1.25, 0);
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
    const fovTarget = this.baseFov + (this.camMode === 'run' && this.state === 'running' ? Math.min(8, (this.speed - 15) * 0.3) + (this.powers.duma ? 8 : 0) : this.camMode === 'select' ? -8 : 0);
    if (Math.abs(cam.fov - fovTarget) > 0.05) {
      cam.fov = damp(cam.fov, fovTarget, 3, dt);
      cam.updateProjectionMatrix();
    }
  }
}

