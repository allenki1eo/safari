/* ─── Safari — Main Game Engine ──────────────────────────── */
import * as THREE from 'three';
import { Player }    from './Player.js';
import { Level }     from './Level.js';
import { UI }        from './UI.js';
import { MenuScene } from './MenuScene.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

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
    this._setupPostProcessing();
    this._setupLights();

    this.shakeIntensity = 0;

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
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.outputColorSpace    = THREE.SRGBColorSpace;

    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.composer) this.composer.setSize(w, h);
    });
  }

  /* ─── Post-Processing ─────────────────────────────────── */
  _setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.18,  /* strength — subtle glow only on gems/sun */
      0.4,   /* radius */
      0.88   /* threshold — only things >88% brightness bloom */
    );
    this.bloomPass = bloomPass;
    this.composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
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
    this.ambientLight = new THREE.AmbientLight(0xfff0e0, 0.7);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4d0, 1.2);
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
    this.chaseMode = false;

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
  _die() {
    this.lives = 0;
    this.ui.setLives(0);
    this.state = 'gameover';
    this.clock.stop();
    this.ui.showGameOver(Math.floor(this.score));
  }

  _onHit() {
    if (this.player.isInvincible) return;

    if (this.chaseMode) {
      this.speed = Math.max(SCROLL_SPEED_BASE - 2, this.speed - 6.5);
      this.shakeIntensity = 1.2;
      this.player.isInvincible = true;
      const iv = setInterval(() => { if (this.player) this.player.group.visible = !this.player.group.visible; }, 100);
      setTimeout(() => {
        clearInterval(iv);
        if (this.player) { this.player.isInvincible = false; this.player.group.visible = true; }
      }, 1200);
      return;
    }

    this.lives = Math.max(0, this.lives - 1);
    this.ui.setLives(this.lives);
    this.shakeIntensity = 1.0; /* Trigger camera shake */
    if (this.lives <= 0) {
      this._die();
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
        if (ev.collect) {
          if (ev.isEgg && !this.chaseMode) {
             this.chaseMode = true;
             this.ui.showToast("WOLF PACK IMMINENT!!");
             this.predator = this.level.spawnPredator();
             this.predator.position.set(-20, 0, 0); // start far back
          } else if (!ev.isEgg) {
             this._onCollect(ev.collect, ev.word);
          }
        }

        this.level.updateLighting(this.sunLight, this.ambientLight, this.fillLight);

        if (this.time >= LEVEL_DURATION) {
          this.state = 'levelcomplete';
          this.clock.stop();
          this.ui.showLevelComplete(Math.floor(this.score), this.levelIdx + 1 < Level.LEVEL_COUNT);
        }

        /* Camera sway and speed FOV */
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 62 + (this.speed - SCROLL_SPEED_BASE), 0.1);
        this.camera.updateProjectionMatrix();
        
        /* Camera shake */
        let shakeX = 0, shakeY = 0;
        if (this.shakeIntensity > 0) {
          shakeX = (Math.random() - 0.5) * 0.5 * this.shakeIntensity;
          shakeY = (Math.random() - 0.5) * 0.5 * this.shakeIntensity;
          this.shakeIntensity -= dt * 2.5;
          if (this.shakeIntensity < 0) this.shakeIntensity = 0;
        }

        let targetCamX = -1.5, targetCamZ = 13;

        if (this.chaseMode && this.predator) {
           const relativeSpeed = 16.5 - this.speed; // Wolf speed is ~16.5
           this.predator.position.x += relativeSpeed * dt;
           
           if (this.predator.position.x >= this.player.group.position.x - 0.8) {
               this._die();
           } else if (this.predator.position.x < -35) {
               this.chaseMode = false;
               this.predator.visible = false;
               this.ui.showToast("ESCAPED THE WOLF!");
               this.score += 500;
           }
           
           targetCamX = -4.0;
           targetCamZ = 16.5; 
        }

        this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX + shakeX, 0.05);
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, 0.05);
        this.camera.position.y = 5.5 + Math.sin(this.time * 0.8) * 0.08 + shakeY;
        this.camera.lookAt(new THREE.Vector3(1, 1.4, 0));

      } else if (this.state === 'menu') {
        /* Animate menu scene (use real time, not game clock) */
        const now  = ts / 1000;
        const mdt  = Math.min(now - lastMenuT, 0.05);
        lastMenuT  = now;
        if (this.menuScene) this.menuScene.update(mdt, this.camera);
      }

      this.composer.render(dt);
    };
    requestAnimationFrame(animate);
  }
}

/* ─── Boot — called directly, no DOMContentLoaded wrapper ── */
new Game();
