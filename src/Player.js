import * as THREE from 'three';
import { loadModel, loadingManager } from './Level.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/* ─── Physics Constants ─────────────────────────────────────── */
const JUMP_FORCE      = 15;
const GRAVITY         = -32;
const SLIDE_DURATION  = 0.72;
const DOUBLE_JUMP_CAP = 1;

/* ─── Lane System ───────────────────────────────────────────── */
const LANE_WIDTH   = 1.8;
const LANES        = [-LANE_WIDTH, 0, LANE_WIDTH];
const LANE_LERP    = 12;

/* ─── Game-feel Constants ───────────────────────────────────── */
const COYOTE_TIME    = 0.12;
const JUMP_BUFFER    = 0.15;
const LAND_SQUASH_T  = 0.18;
const STUMBLE_DUR    = 0.35;

/* ─── Animation clip names (Quaternius characters) ──────────── */
const ANIM = {
  run:       'CharacterArmature|Run',
  runLeft:   'CharacterArmature|Run_Left',
  runRight:  'CharacterArmature|Run_Right',
  roll:      'CharacterArmature|Roll',         // slide
  idle:      'CharacterArmature|Idle',
  wave:      'CharacterArmature|Wave',
  hit:       'CharacterArmature|HitRecieve',
  death:     'CharacterArmature|Death',
  kick:      'CharacterArmature|Kick_Left',    // jump pose
  walk:      'CharacterArmature|Walk',
};

/* Default crossfade duration in seconds */
const FADE = 0.15;

/* Available character skins */
export const CHARACTER_SKINS = [
  'Adventurer',
  'Casual Character',
  'Hoodie Character',
  'Farmer',
  'Punk',
  'Worker',
  'Business Man',
  'Beach Character',
  'King',
  'Swat',
  'Astronaut',
];

/* ─────────────────────────────────────────────────────────────── */
export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 0);
    scene.add(this.group);

    /* Physics */
    this.vy          = 0;
    this.onGround    = true;
    this.extraJumps  = DOUBLE_JUMP_CAP;
    this.isSliding   = false;
    this.slideTimer  = 0;
    this.isInvincible   = false;
    this.invTimer    = 0;
    this.animT       = 0;

    /* Lane */
    this.laneIdx     = 1;
    this.targetZ     = 0;

    /* Game-feel timers */
    this.coyoteTimer   = 0;
    this.jumpBufferT   = 0;
    this.landSquashT   = 0;
    this.wasOnGround   = true;

    /* Stumble */
    this.stumbleT      = 0;

    /* State: running | jumping | sliding | hit | dead */
    this.pstate      = 'running';
    this._prevState  = '';

    /* Animation mixer */
    this.mixer       = null;
    this.actions     = {};       // name → AnimationAction
    this._currentAction = null;

    /* Bounding box */
    this.hitBox = new THREE.Box3();

    /* Dust particles */
    this._dustParticles = [];

    /* Skin index (for character selection) */
    this.skinIdx = 0;
    this._buildGen = 0;   /* generation counter — prevents stale async callbacks */
    this._skinLocked = false; /* true during gameplay to prevent mid-game shifts */

    this._build();
    this._addShadowCatcher();
    this._buildDustKicks();
  }

  /* ─── Build character from GLB ───────────────────────────── */
  _build() {
    const gen = ++this._buildGen;   /* capture generation */
    const skinName = CHARACTER_SKINS[this.skinIdx % CHARACTER_SKINS.length];
    const path = `src/assets/characters/male/${skinName}.glb`;

    loadModel(path, (gltf) => {
      try {
        /* Stale callback — a newer _build() was called since this one started */
        if (gen !== this._buildGen) return;

        /* Remove old character if swapping skins */
        if (this.characterMesh) {
          this.group.remove(this.characterMesh);
          this.characterMesh = null;
        }

        /* Clone so the cache entry stays untouched and can be reused */
        const model = SkeletonUtils.clone(gltf.scene);
        model.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });

        /*
         * Quaternius characters have an Armature node with scale [100,100,100]
         * and rotation [-90deg X]. This inflates Box3.setFromObject().
         * Compute bounding box from mesh geometry only for accurate sizing.
         */
        const meshBox = new THREE.Box3();
        model.traverse(c => {
          if (c.isMesh && c.geometry) {
            c.geometry.computeBoundingBox();
            const worldMat = c.matrixWorld;
            c.updateWorldMatrix(true, false);
            const b = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
            meshBox.union(b);
          }
        });
        /* Fallback if meshBox is empty */
        if (meshBox.isEmpty()) meshBox.setFromObject(model);

        const size = meshBox.getSize(new THREE.Vector3());
        const targetH = 1.6;
        const scaleFactor = targetH / Math.max(size.y, 0.001);
        model.scale.setScalar(scaleFactor);

        /* Face direction of travel */
        model.rotation.y = Math.PI / 2;

        /* Pivot feet to Y=0 — recompute after scaling */
        model.updateMatrixWorld(true);
        const feetBox = new THREE.Box3();
        model.traverse(c => {
          if (c.isMesh && c.geometry) {
            c.updateWorldMatrix(true, false);
            const b = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
            feetBox.union(b);
          }
        });
        if (!feetBox.isEmpty()) {
          model.position.y = -feetBox.min.y;
        }

        this.group.add(model);
        this.characterMesh = model;

        /* ── Setup AnimationMixer ── */
        this.mixer = new THREE.AnimationMixer(model);
        this.actions = {};

        if (gltf.animations && gltf.animations.length > 0) {
          for (const clip of gltf.animations) {
            const action = this.mixer.clipAction(clip);
            this.actions[clip.name] = action;

            /* One-shot animations shouldn't loop */
            if (clip.name === ANIM.hit || clip.name === ANIM.death ||
                clip.name === ANIM.kick || clip.name === ANIM.roll) {
              action.setLoop(THREE.LoopOnce);
              action.clampWhenFinished = true;
            }
          }
        }

        /* Start with Run */
        this._playAction(ANIM.run);
      } catch (err) {
        console.error('[Player] Failed to setup character model:', err);
      }
    });
  }

  /* ─── Animation helpers ──────────────────────────────────── */
  _playAction(name, fadeDur = FADE) {
    const next = this.actions[name];
    if (!next) return;
    if (this._currentAction === next && next.isRunning()) return;

    next.reset();
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);

    if (this._currentAction && this._currentAction !== next) {
      this._currentAction.crossFadeTo(next, fadeDur, true);
    }
    next.play();
    this._currentAction = next;
  }

  _setAnimSpeed(speed) {
    if (this._currentAction) {
      this._currentAction.setEffectiveTimeScale(speed);
    }
  }

  _addShadowCatcher() {
    const geo  = new THREE.CircleGeometry(0.45, 24);
    const mat2 = new THREE.MeshBasicMaterial({
      color:       0x000000,
      transparent: true,
      opacity:     0.35,
      depthWrite:  false,
    });
    this._shadow = new THREE.Mesh(geo, mat2);
    this._shadow.rotation.x = -Math.PI / 2;
    this._shadow.position.y = 0.01;
    this.scene.add(this._shadow);
  }

  _buildDustKicks() {
    const dustGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xD4A050,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(dustGeo, dustMat.clone());
      p.visible = false;
      this.scene.add(p);
      this._dustParticles.push({
        mesh: p,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
      });
    }
  }

  /* ─── Public API ──────────────────────────────────────────── */
  reset() {
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.set(1, 1, 1);
    this.group.visible   = true;
    this._shadow.visible = true;
    this.vy         = 0;
    this.onGround   = true;
    this.extraJumps = DOUBLE_JUMP_CAP;
    this.isSliding  = false;
    this.slideTimer = 0;
    this.isInvincible = false;
    this.pstate     = 'running';
    this._prevState = '';
    this.animT      = 0;
    this.laneIdx    = 1;
    this.targetZ    = 0;
    this.coyoteTimer  = 0;
    this.jumpBufferT  = 0;
    this.landSquashT  = 0;
    this.stumbleT     = 0;
    this.wasOnGround  = true;

    /* Reset animation to run */
    if (this.mixer) {
      this.mixer.stopAllAction();
      this._currentAction = null;
      this._playAction(ANIM.run);
    }
  }

  hide() {
    this.group.visible = false;
    this._shadow.visible = false;
    for (const d of this._dustParticles) d.mesh.visible = false;
  }

  /** Switch to a different character skin (0-based index) */
  setSkin(idx) {
    if (this._skinLocked) return;   /* prevent mid-game character shifts */
    this.skinIdx = idx % CHARACTER_SKINS.length;
    this._build();
  }

  /** Lock skin so it can't change during gameplay */
  lockSkin()   { this._skinLocked = true; }
  unlockSkin() { this._skinLocked = false; }

  jump() {
    if (this.isSliding) {
      this.isSliding = false;
      this.slideTimer = 0;
    }

    if (this.onGround || this.coyoteTimer > 0) {
      this._doJump(JUMP_FORCE);
    } else if (this.extraJumps > 0) {
      this._doJump(JUMP_FORCE * 0.82);
      this.extraJumps--;
      this._spawnDust(6, 0.3);
    } else {
      this.jumpBufferT = JUMP_BUFFER;
    }
  }

  _doJump(force) {
    this.vy = force;
    this.onGround = false;
    this.coyoteTimer = 0;
    this.pstate = 'jumping';
    this.extraJumps = DOUBLE_JUMP_CAP;
    this._spawnDust(4, 0.15);
  }

  slide() {
    if (this.isSliding) return;
    if (!this.onGround && this.group.position.y > 0.5) return;

    if (!this.onGround) {
      this.vy = -20;
    }

    this.isSliding  = true;
    this.slideTimer = SLIDE_DURATION;
    this.pstate     = 'sliding';
    this._spawnDust(3, 0.1);
  }

  moveLeft() {
    if (this.laneIdx > 0) {
      this.laneIdx--;
      this.targetZ = LANES[this.laneIdx];
    }
  }

  moveRight() {
    if (this.laneIdx < 2) {
      this.laneIdx++;
      this.targetZ = LANES[this.laneIdx];
    }
  }

  startInvincibility(dur = 2.2) {
    this.isInvincible = true;
    this.invTimer = dur;
    this.stumbleT = STUMBLE_DUR;
    this.pstate = 'hit';
  }

  /* ─── Dust effects ────────────────────────────────────────── */
  _spawnDust(count, spread) {
    let spawned = 0;
    for (const d of this._dustParticles) {
      if (d.life > 0 || spawned >= count) continue;
      d.mesh.visible = true;
      d.mesh.material.opacity = 0.6;
      d.mesh.position.set(
        this.group.position.x + (Math.random() - 0.5) * 0.3,
        this.group.position.y + 0.05,
        this.group.position.z + (Math.random() - 0.5) * 0.3
      );
      d.vel.set(
        (Math.random() - 0.5) * spread * 2 - 0.5,
        Math.random() * spread * 3 + 0.5,
        (Math.random() - 0.5) * spread * 2
      );
      d.life = 0.3 + Math.random() * 0.3;
      d.maxLife = d.life;
      spawned++;
    }
  }

  _updateDust(dt) {
    for (const d of this._dustParticles) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.mesh.position.x += d.vel.x * dt;
      d.mesh.position.y += d.vel.y * dt;
      d.mesh.position.z += d.vel.z * dt;
      d.vel.y -= 3 * dt;
      const t = Math.max(0, d.life / d.maxLife);
      d.mesh.material.opacity = t * 0.5;
      d.mesh.scale.setScalar(1 + (1 - t) * 1.5);
      if (d.life <= 0) d.mesh.visible = false;
    }
  }

  /* ─── Update ──────────────────────────────────────────────── */
  update(dt, time) {
    this.animT += dt;

    /* ── Update animation mixer ── */
    if (this.mixer) this.mixer.update(dt);

    /* ── Coyote time ── */
    if (this.onGround) {
      this.coyoteTimer = COYOTE_TIME;
    } else {
      this.coyoteTimer -= dt;
    }

    /* ── Gravity ── */
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.group.position.y += this.vy * dt;
      if (this.group.position.y <= 0) {
        this.group.position.y = 0;
        this.vy = 0;

        const wasAirborne = !this.wasOnGround;
        this.onGround = true;

        if (this.pstate === 'jumping') this.pstate = 'running';

        if (wasAirborne) {
          this.landSquashT = LAND_SQUASH_T;
          this._spawnDust(4, 0.2);
        }

        if (this.jumpBufferT > 0) {
          this.jumpBufferT = 0;
          this._doJump(JUMP_FORCE);
        }
      }
    }
    this.wasOnGround = this.onGround;

    /* ── Timers ── */
    if (this.jumpBufferT > 0) this.jumpBufferT -= dt;
    if (this.landSquashT > 0) this.landSquashT -= dt;

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.pstate = 'running';
      }
    }

    if (this.stumbleT > 0) {
      this.stumbleT -= dt;
      if (this.stumbleT <= 0 && this.pstate === 'hit') {
        this.pstate = 'running';
      }
    }

    /* ── Invincibility flash ── */
    if (this.isInvincible) {
      this.invTimer -= dt;
      this.group.visible = Math.sin(this.invTimer * 18) > 0;
      if (this.invTimer <= 0) {
        this.isInvincible = false;
        this.group.visible = true;
      }
    }

    /* ── Lane movement ── */
    const dz = this.targetZ - this.group.position.z;
    this.group.position.z += dz * Math.min(1, LANE_LERP * dt);
    if (Math.abs(dz) < 0.01) this.group.position.z = this.targetZ;

    /* ── Skeletal animation state machine ── */
    this._updateAnimation(dz);

    /* ── Body lean into lane changes ── */
    const leanTarget = -dz * 0.25;
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, leanTarget, 0.15);

    /* ── Squash & stretch on landing ── */
    if (this.landSquashT > 0) {
      const sq = this.landSquashT / LAND_SQUASH_T;
      const amt = sq * 0.12;
      this.group.scale.set(1 + amt, 1 - amt * 1.5, 1 + amt);
    } else if (this.pstate === 'jumping') {
      /* Stretch while airborne */
      if (this.vy > 0) {
        this.group.scale.set(0.96, 1.06, 0.96);
      } else {
        this.group.scale.set(1.04, 0.94, 1.04);
      }
    } else if (this.pstate === 'sliding') {
      /* Squash during slide */
      this.group.scale.set(1.08, 0.6, 1.08);
    } else {
      this.group.scale.set(1, 1, 1);
    }

    /* ── Dust ── */
    this._updateDust(dt);
    if (this.pstate === 'running' && this.onGround && Math.random() < dt * 8) {
      this._spawnDust(1, 0.05);
    }

    /* ── Shadow ── */
    this._shadow.position.x = this.group.position.x;
    this._shadow.position.z = this.group.position.z;
    const airFrac = Math.min(1, this.group.position.y / 4);
    this._shadow.material.opacity = 0.35 * (1 - airFrac);
    this._shadow.scale.setScalar(1 + this.group.position.y * 0.08);

    /* ── Hitbox ── */
    const py = this.group.position.y;
    const pz = this.group.position.z;
    if (this.isSliding) {
      this.hitBox.setFromCenterAndSize(
        new THREE.Vector3(0.05, py + 0.42, pz),
        new THREE.Vector3(0.32, 0.84, 0.7)
      );
    } else {
      this.hitBox.setFromCenterAndSize(
        new THREE.Vector3(0.05, py + 0.92, pz),
        new THREE.Vector3(0.32, 1.72, 0.7)
      );
    }
  }

  /* ─── Skeletal Animation State Machine ────────────────────── */
  _updateAnimation(laneDZ) {
    if (!this.mixer) return;

    const state = this.pstate;

    /* Only switch animation when state changes */
    if (state === this._prevState) {
      /* Within running state, blend strafe animations */
      if (state === 'running' && Math.abs(laneDZ) > 0.15) {
        const strafeAnim = laneDZ > 0 ? ANIM.runLeft : ANIM.runRight;
        this._playAction(strafeAnim, 0.1);
      } else if (state === 'running') {
        this._playAction(ANIM.run, 0.2);
      }
      return;
    }

    /* State just changed */
    this._prevState = state;

    switch (state) {
      case 'running':
        this._playAction(ANIM.run, 0.15);
        break;
      case 'jumping':
        this._playAction(ANIM.kick, 0.08);
        this._setAnimSpeed(0.6);  // slow-mo the kick for a float feel
        break;
      case 'sliding':
        this._playAction(ANIM.roll, 0.08);
        this._setAnimSpeed(1.4);  // fast roll
        break;
      case 'hit':
        this._playAction(ANIM.hit, 0.05);
        break;
      case 'dead':
        this._playAction(ANIM.death, 0.1);
        break;
    }
  }
}
