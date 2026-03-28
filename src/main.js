/* ─── Safari — Main Game Engine ──────────────────────────── */
import * as THREE from 'three';
import { Player }    from './Player.js';
import { Level, loadingManager } from './Level.js';
import { UI }        from './UI.js';
import { MenuScene } from './MenuScene.js';
import * as SFX      from './Sound.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

/* ─── Constants ──────────────────────────────────────────── */
const SCROLL_SPEED_BASE = 9;
const SPEED_RAMP        = 0.22;
const SPEED_MAX         = 28;
const LEVEL_DURATION    = 90;  /* seconds per level */

/* ─── Combo System ───────────────────────────────────────── */
const COMBO_WINDOW = 2.5;  /* seconds between gems to keep combo alive */

class Game {
  constructor() {
    this.state    = 'loading';
    this.score    = 0;
    this.lives    = 3;
    this.levelIdx = 0;
    this.time     = 0;
    this.speed    = SCROLL_SPEED_BASE;

    /* Combo */
    this.combo       = 0;
    this.comboTimer  = 0;
    this.bestCombo   = 0;

    this.clock = new THREE.Clock(false);

    this._setupRenderer();
    this._setupScene();
    this._setupPostProcessing();
    this._setupLights();
    this._buildSpeedLines();

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
      65, window.innerWidth / window.innerHeight, 0.1, 400
    );
    this._setGameCamera();
  }

  _setGameCamera() {
    /* Behind-the-character camera (Subway Surfers style) */
    this.camera.position.set(-7, 4, 0);
    this.camera.lookAt(new THREE.Vector3(5, 1.5, 0));
  }

  /* ─── Lights ──────────────────────────────────────────── */
  _setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xfff0e0, 0.7);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4d0, 1.2);
    this.sunLight.position.set(5, 18, 5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left   = -12;
    this.sunLight.shadow.camera.right  =  25;
    this.sunLight.shadow.camera.top    =  10;
    this.sunLight.shadow.camera.bottom = -10;
    this.sunLight.shadow.bias          = -0.0005;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0x8ecfff, 0.4);
    this.fillLight.position.set(-5, 3, 5);
    this.scene.add(this.fillLight);
  }

  /* ─── Speed Lines (motion blur effect) ────────────────── */
  _buildSpeedLines() {
    const count = 40;
    const positions = new Float32Array(count * 6); // line segments: 2 vertices each
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this._speedLines = new THREE.LineSegments(geo, mat);
    this._speedLines.frustumCulled = false;
    this._speedLineCount = count;
    this._speedLineData = [];

    for (let i = 0; i < count; i++) {
      this._speedLineData.push({
        y: Math.random() * 5,
        z: (Math.random() - 0.5) * 8,
        length: 1 + Math.random() * 3,
        x: (Math.random() - 0.5) * 30,
      });
    }
    this.scene.add(this._speedLines);
  }

  _updateSpeedLines(dt, speed) {
    const intensity = Math.max(0, (speed - 14) / (SPEED_MAX - 14)); // starts at speed 14
    this._speedLines.material.opacity = intensity * 0.25;

    if (intensity <= 0) return;

    const pos = this._speedLines.geometry.attributes.position;
    for (let i = 0; i < this._speedLineCount; i++) {
      const d = this._speedLineData[i];
      d.x -= speed * dt * 1.5;
      if (d.x < -20) {
        d.x = 20 + Math.random() * 10;
        d.y = Math.random() * 5;
        d.z = (Math.random() - 0.5) * 8;
      }
      const len = d.length * intensity;
      pos.setXYZ(i * 2,     d.x,       d.y, d.z);
      pos.setXYZ(i * 2 + 1, d.x + len, d.y, d.z);
    }
    pos.needsUpdate = true;
  }

  /* ─── Input ───────────────────────────────────────────── */
  _setupInput() {
    /* Unlock audio on first interaction */
    const unlockAudio = () => {
      SFX.resumeAudio();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    window.addEventListener('keydown', e => {
      if (this.state !== 'playing') {
        if ((e.code === 'KeyP' || e.code === 'Escape') && this.state === 'paused') this.resume();
        return;
      }
      switch (e.code) {
        case 'Space': case 'ArrowUp':  case 'KeyW': e.preventDefault(); this.player.jump(); SFX.sfxJump();     break;
        case 'ArrowDown': case 'KeyS':              e.preventDefault(); this.player.slide(); SFX.sfxSlide();   break;
        case 'ArrowLeft':  case 'KeyA':              e.preventDefault(); this.player.moveLeft(); SFX.sfxLaneSwitch();  break;
        case 'ArrowRight': case 'KeyD':              e.preventDefault(); this.player.moveRight(); SFX.sfxLaneSwitch(); break;
        case 'KeyP': case 'Escape':                  this.pause(); break;
      }
    });

    /* ── Touch / Swipe controls ──────────────────────────── *
     *  Swipe left  → move left   Swipe right → move right
     *  Swipe up    → jump        Swipe down  → slide
     *  Tap (< 15px movement)    → jump
     * ─────────────────────────────────────────────────── */
    let tx0 = 0, ty0 = 0, tTime = 0;
    /* Track when a UI button last triggered a state change so we can
       ignore accidental canvas swipes that immediately follow a tap. */
    this._lastUIAction = 0;

    this.canvas.addEventListener('touchstart', e => {
      tx0   = e.touches[0].clientX;
      ty0   = e.touches[0].clientY;
      tTime = Date.now();
    }, { passive: true });

    this.canvas.addEventListener('touchend', e => {
      if (this.state !== 'playing') return;
      /* Ignore if a UI button was just pressed (within 400 ms) */
      if (Date.now() - this._lastUIAction < 400) return;

      const dx  = e.changedTouches[0].clientX - tx0;
      const dy  = e.changedTouches[0].clientY - ty0;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const dt  = Date.now() - tTime;   /* ms held */

      /* Threshold: 20 px movement OR fast flick */
      const SWIPE_DIST = 20;

      if (adx > ady && adx > SWIPE_DIST) {
        /* Horizontal swipe */
        if (dx < 0) { this.player.moveLeft();  SFX.sfxLaneSwitch(); }
        else        { this.player.moveRight(); SFX.sfxLaneSwitch(); }
      } else if (ady > SWIPE_DIST) {
        /* Vertical swipe */
        if (dy < 0) { this.player.jump();  SFX.sfxJump(); }
        else        { this.player.slide(); SFX.sfxSlide(); }
      } else if (adx < 15 && ady < 15 && dt < 300) {
        /* Quick tap — jump */
        this.player.jump(); SFX.sfxJump();
      }
    }, { passive: true });

    /* ── UI Buttons — click + touchend for instant mobile response ── */
    const onBtn = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      const handler = (e) => {
        e.stopPropagation();
        this._lastUIAction = Date.now();
        SFX.resumeAudio();
        fn();
      };
      el.addEventListener('click',    handler);
      el.addEventListener('touchend', handler, { passive: false });
    };

    onBtn('pause-btn',      () => this.pause());
    onBtn('resume-btn',     () => this.resume());
    onBtn('pause-menu-btn', () => { this.resume(); this.goToMenu(); });
    onBtn('retry-btn',      () => this.startLevel(this.levelIdx));
    onBtn('go-menu-btn',    () => this.goToMenu());
    onBtn('next-level-btn', () => this._nextLevel());
    onBtn('lc-menu-btn',    () => this.goToMenu());
  }

  /* ─── Loading ─────────────────────────────────────────── */
  _finishLoading() {
    const bar = document.getElementById('loader-bar');

    loadingManager.onProgress = (url, items, total) => {
      if (bar) bar.style.width = ((items / total) * 100) + '%';
    };

    let hasDoneWarmup = false;
    loadingManager.onLoad = () => {
      if (hasDoneWarmup) return;
      hasDoneWarmup = true;
      this.renderer.compile(this.scene, this.camera);

      setTimeout(() => {
        this.goToMenu();
      }, 400);
    };
    loadingManager.onError = (url) => console.warn('Failed to load asset', url);

    this.scene.fog = null;
    this.menuScene = new MenuScene(this.scene);
  }

  /* ─── Level flow ──────────────────────────────────────── */
  startLevel(idx) {
    SFX.resumeAudio();
    SFX.sfxMenuClick();

    if (this.menuScene) { this.menuScene.dispose(); this.menuScene = null; }

    this.levelIdx = idx;
    this.score    = 0;
    this.lives    = 3;
    this.time     = 0;
    this.speed    = SCROLL_SPEED_BASE + idx * 1.5;
    this.chaseMode = false;
    this.combo     = 0;
    this.comboTimer = 0;
    this.bestCombo  = 0;

    this.level.load(idx);
    this.player.reset();

    this._setGameCamera();
    this.scene.fog = new THREE.FogExp2(0xFFB347, 0.018);

    this.state = 'playing';
    this.clock.start();
    this.ui.showHUD();
    this.ui.setLevelName(this.level.name);
    this.ui.setLives(this.lives);
    this.ui.setScore(0);
    this.ui.setCombo(0);
    this.ui.showControlsHint();

    SFX.startAmbient();
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
    SFX.stopAmbient();

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
    SFX.sfxDeath();
    SFX.stopAmbient();
    this.ui.showGameOver(Math.floor(this.score));
  }

  _onHit() {
    if (this.player.isInvincible) return;
    SFX.sfxHit();

    /* Break combo on hit */
    this.combo = 0;
    this.comboTimer = 0;
    this.ui.setCombo(0);

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
    this.shakeIntensity = 1.0;
    if (this.lives <= 0) {
      this._die();
    } else {
      this.player.startInvincibility(2.2);
    }
  }

  _onCollect(type, word) {
    /* Combo system */
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;

    const multiplier = Math.min(this.combo, 10);
    const basePts = type === 'gem' ? 50 : 15;
    const pts = basePts * multiplier;
    this.score += pts;
    this.ui.setScore(Math.floor(this.score));
    this.ui.setCombo(this.combo);

    if (this.combo >= 3) {
      SFX.sfxCombo(multiplier);
    } else {
      SFX.sfxGem();
    }

    if (word) this.ui.showToast(this.combo >= 3 ? `${word} x${multiplier}!` : word);
  }

  /* ─── Main Loop ───────────────────────────────────────── */
  _loop() {
    let lastMenuT = 0;

    const animate = (ts) => {
      requestAnimationFrame(animate);

      const dt = Math.min(this.clock.getDelta(), 0.05);

      if (this.state === 'playing') {
        this.speed = Math.min(this.speed + SPEED_RAMP * dt, SPEED_MAX);
        this.time += dt;
        this.score += this.speed * dt * 1.2;
        this.ui.setScore(Math.floor(this.score));

        /* Combo timer decay */
        if (this.combo > 0) {
          this.comboTimer -= dt;
          if (this.comboTimer <= 0) {
            this.combo = 0;
            this.ui.setCombo(0);
          }
        }

        this.player.update(dt, this.time);

        /* Footstep sounds */
        SFX.tickFootsteps(this.time, this.speed, this.player.onGround, this.player.isSliding);

        /* Landing sound */
        if (this.player.landSquashT > 0 && this.player.landSquashT > SCROLL_SPEED_BASE * 0.01) {
          SFX.sfxLand();
        }

        const ev = this.level.update(dt, this.speed, this.player.hitBox, this.time);
        if (ev.hit)     this._onHit();
        if (ev.collect) {
          if (ev.isEgg && !this.chaseMode) {
             this.chaseMode = true;
             this.ui.showToast("WOLF PACK IMMINENT!!");
             this.predator = this.level.spawnPredator();
             this.predator.position.set(-20, 0, 0);
          } else if (!ev.isEgg) {
             this._onCollect(ev.collect, ev.word);
          }
        }

        this.level.updateLighting(this.sunLight, this.ambientLight, this.fillLight);

        if (this.time >= LEVEL_DURATION) {
          this.state = 'levelcomplete';
          this.clock.stop();
          SFX.sfxLevelComplete();
          SFX.stopAmbient();
          this.ui.showLevelComplete(Math.floor(this.score), this.levelIdx + 1 < Level.LEVEL_COUNT);
        }

        /* ── Behind-the-player camera (Subway Surfers style) ── */
        const speedFOV = 65 + (this.speed - SCROLL_SPEED_BASE) * 0.8;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, speedFOV, 0.08);
        this.camera.updateProjectionMatrix();

        /* Camera shake */
        let shakeX = 0, shakeY = 0, shakeZ = 0;
        if (this.shakeIntensity > 0) {
          shakeX = (Math.random() - 0.5) * 0.4 * this.shakeIntensity;
          shakeY = (Math.random() - 0.5) * 0.4 * this.shakeIntensity;
          shakeZ = (Math.random() - 0.5) * 0.3 * this.shakeIntensity;
          this.shakeIntensity -= dt * 2.5;
          if (this.shakeIntensity < 0) this.shakeIntensity = 0;
        }

        /* Camera target — behind & above the player */
        let camBackDist = -7;    // how far behind
        let camHeight   = 4;     // how high
        let lookAheadX  = 8;     // how far ahead to look
        let lookAtY     = 1.5;

        if (this.chaseMode && this.predator) {
           const relativeSpeed = 16.5 - this.speed;
           this.predator.position.x += relativeSpeed * dt;
           this.predator.position.z = THREE.MathUtils.lerp(
             this.predator.position.z, this.player.group.position.z, 0.03
           );

           if (this.predator.position.x >= this.player.group.position.x - 0.8) {
               this._die();
           } else if (this.predator.position.x < -35) {
               this.chaseMode = false;
               this.predator.visible = false;
               this.ui.showToast("ESCAPED THE WOLF!");
               this.score += 500;
           }

           /* Pull camera back further during chase to show the wolf */
           camBackDist = -10;
           camHeight   = 5;
           lookAheadX  = 6;
        }

        /* Smooth follow player's lane (Z) and height (Y) */
        const playerZ = this.player.group.position.z;
        const playerY = this.player.group.position.y;

        this.camera.position.x = THREE.MathUtils.lerp(
          this.camera.position.x, camBackDist + shakeX, 0.06
        );
        this.camera.position.y = THREE.MathUtils.lerp(
          this.camera.position.y,
          camHeight + playerY * 0.3 + Math.sin(this.time * 0.8) * 0.06 + shakeY,
          0.08
        );
        this.camera.position.z = THREE.MathUtils.lerp(
          this.camera.position.z, playerZ * 0.85 + shakeZ, 0.1
        );

        /* Look ahead of the player, slightly tracking lane */
        this.camera.lookAt(new THREE.Vector3(
          lookAheadX,
          lookAtY + playerY * 0.2,
          playerZ * 0.4
        ));

        /* Speed lines */
        this._updateSpeedLines(dt, this.speed);

        /* Bloom increases with speed */
        const speedFrac = (this.speed - SCROLL_SPEED_BASE) / (SPEED_MAX - SCROLL_SPEED_BASE);
        this.bloomPass.strength = 0.18 + speedFrac * 0.2;

      } else if (this.state === 'menu') {
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

/* ─── Boot ──────────────────────────────────────────────── */
new Game();
