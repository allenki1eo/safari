/* ─── Safari — Main Game Engine ──────────────────────────── */
import * as THREE from 'three';
import { Player }    from './Player.js';
import { Level }     from './Level.js';
import { UI }        from './UI.js';
import { MenuScene } from './MenuScene.js';

/* ─── Constants ──────────────────────────────────────────── */
const SCROLL_SPEED_BASE = 9;
const SPEED_RAMP        = 0.22;
const SPEED_MAX         = 28;
const LEVEL_DURATION    = 90;  /* seconds per level */

class Game {
  constructor() {
    this.state    = 'loading';
    this.score    = 0;
    this.lives    = 3;
    this.levelIdx = 0;
    this.time     = 0;
    this.speed    = SCROLL_SPEED_BASE;

    this.clock = new THREE.Clock(false);

    this._setupRenderer();
    this._setupScene();
    this._setupLights();

    this.player    = new Player(this.scene);
    this.level     = new Level(this.scene, this.renderer);
    this.menuScene = null;
    this.ui        = new UI(this);

    this._setupInput();
    this._loop();
    this._finishLoading();
  }

  /* ─── Renderer ────────────────────────────────────────── */
  _setupRenderer() {
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas:      this.canvas,
      antialias:   true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled   = true;
    this.renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace    = THREE.SRGBColorSpace;

    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  /* ─── Scene ───────────────────────────────────────────── */
  _setupScene() {
    this.scene = new THREE.Scene();

    /* Game-play camera — behind & above player */
    this.camera = new THREE.PerspectiveCamera(
      62, window.innerWidth / window.innerHeight, 0.1, 400
    );
    this._setGameCamera();
  }

  _setGameCamera() {
    this.camera.position.set(-1.5, 5.5, 13);
    this.camera.lookAt(new THREE.Vector3(1, 1.4, 0));
  }

  /* ─── Lights ──────────────────────────────────────────── */
  _setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xfff0e0, 0.55);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4d0, 2.0);
    this.sunLight.position.set(8, 18, 8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left   = -18;
    this.sunLight.shadow.camera.right  =  18;
    this.sunLight.shadow.camera.top    =  18;
    this.sunLight.shadow.camera.bottom = -6;
    this.sunLight.shadow.bias          = -0.0005;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0x8ecfff, 0.4);
    this.fillLight.position.set(-5, 3, 5);
    this.scene.add(this.fillLight);
  }

  /* ─── Input ───────────────────────────────────────────── */
  _setupInput() {
    window.addEventListener('keydown', e => {
      if (this.state !== 'playing') {
        if ((e.code === 'KeyP' || e.code === 'Escape') && this.state === 'paused') this.resume();
        return;
      }
      switch (e.code) {
        case 'Space': case 'ArrowUp':  case 'KeyW': e.preventDefault(); this.player.jump();  break;
        case 'ArrowDown': case 'KeyS':              e.preventDefault(); this.player.slide(); break;
        case 'KeyP': case 'Escape':                  this.pause(); break;
      }
    });

    /* Touch — swipe up = jump, swipe down = slide, tap = jump */
    let ty0 = 0;
    this.canvas.addEventListener('touchstart', e => {
      ty0 = e.touches[0].clientY;
    }, { passive: true });
    this.canvas.addEventListener('touchend', e => {
      if (this.state !== 'playing') return;
      const dy = e.changedTouches[0].clientY - ty0;
      if      (dy < -25) this.player.jump();
      else if (dy >  25) this.player.slide();
      else               this.player.jump();
    }, { passive: true });

    /* UI buttons */
    document.getElementById('pause-btn')?.addEventListener('click',      () => this.pause());
    document.getElementById('resume-btn')?.addEventListener('click',     () => this.resume());
    document.getElementById('pause-menu-btn')?.addEventListener('click', () => { this.resume(); this.goToMenu(); });
    document.getElementById('retry-btn')?.addEventListener('click',      () => this.startLevel(this.levelIdx));
    document.getElementById('go-menu-btn')?.addEventListener('click',    () => this.goToMenu());
    document.getElementById('next-level-btn')?.addEventListener('click', () => this._nextLevel());
    document.getElementById('lc-menu-btn')?.addEventListener('click',    () => this.goToMenu());
  }

  /* ─── Loading ─────────────────────────────────────────── */
  async _finishLoading() {
    const bar = document.getElementById('loader-bar');
    for (let p = 0; p <= 100; p += 8) {
      if (bar) bar.style.width = p + '%';
      await new Promise(r => setTimeout(r, 55));
    }
    this.goToMenu();
  }

  /* ─── Level flow ──────────────────────────────────────── */
  startLevel(idx) {
    /* Destroy menu scene */
    if (this.menuScene) { this.menuScene.dispose(); this.menuScene = null; }

    this.levelIdx = idx;
    this.score    = 0;
    this.lives    = 3;
    this.time     = 0;
    this.speed    = SCROLL_SPEED_BASE + idx * 1.5;

    this.level.load(idx);
    this.player.reset();

    /* Restore game camera */
    this._setGameCamera();
    this.scene.fog = new THREE.FogExp2(0xFFB347, 0.018);

    this.state = 'playing';
    this.clock.start();
    this.ui.showHUD();
    this.ui.setLevelName(this.level.name);
    this.ui.setLives(this.lives);
    this.ui.setScore(0);
    this.ui.showControlsHint();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.clock.stop();
    this.ui.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.clock.start();
    this.ui.hidePause();
  }

  goToMenu() {
    this.state = 'menu';
    this.clock.stop();
    this.level.unload();
    this.player.hide();

    /* Build menu art scene */
    if (!this.menuScene) {
      this.scene.fog = null;
      this.menuScene = new MenuScene(this.scene);
    }

    this.ui.showMenu();
  }

  _nextLevel() {
    const next = this.levelIdx + 1;
    if (next < Level.LEVEL_COUNT) this.startLevel(next);
    else this.goToMenu();
  }

  /* ─── Hit / Collect ───────────────────────────────────── */
  _onHit() {
    if (this.player.isInvincible) return;
    this.lives = Math.max(0, this.lives - 1);
    this.ui.setLives(this.lives);
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.clock.stop();
      this.ui.showGameOver(Math.floor(this.score));
    } else {
      this.player.startInvincibility(2.2);
    }
  }

  _onCollect(type, word) {
    const pts = type === 'gem' ? 50 : 15;
    this.score += pts;
    this.ui.setScore(Math.floor(this.score));
    if (word) this.ui.showToast(word);
  }

  /* ─── Main Loop ───────────────────────────────────────── */
  _loop() {
    let lastMenuT = 0;

    const animate = (ts) => {
      requestAnimationFrame(animate);

      /* Compute dt (Clock only runs during gameplay) */
      const dt = Math.min(this.clock.getDelta(), 0.05);

      if (this.state === 'playing') {
        this.speed = Math.min(this.speed + SPEED_RAMP * dt, SPEED_MAX);
        this.time += dt;
        this.score += this.speed * dt * 1.2;
        this.ui.setScore(Math.floor(this.score));

        this.player.update(dt, this.time);

        const ev = this.level.update(dt, this.speed, this.player.hitBox, this.time);
        if (ev.hit)     this._onHit();
        if (ev.collect) this._onCollect(ev.collect, ev.word);

        this.level.updateLighting(this.sunLight, this.ambientLight, this.fillLight);

        if (this.time >= LEVEL_DURATION) {
          this.state = 'levelcomplete';
          this.clock.stop();
          this.ui.showLevelComplete(Math.floor(this.score), this.levelIdx + 1 < Level.LEVEL_COUNT);
        }

        /* Camera sway */
        this.camera.position.y = 5.5 + Math.sin(this.time * 0.8) * 0.08;

      } else if (this.state === 'menu') {
        /* Animate menu scene (use real time, not game clock) */
        const now  = ts / 1000;
        const mdt  = Math.min(now - lastMenuT, 0.05);
        lastMenuT  = now;
        if (this.menuScene) this.menuScene.update(mdt, this.camera);
      }

      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(animate);
  }
}

/* ─── Boot — called directly, no DOMContentLoaded wrapper ── */
new Game();
