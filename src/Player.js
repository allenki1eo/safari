import * as THREE from 'three';
import { loadingManager } from './Level.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

/* ─── Physics Constants ─────────────────────────────────────── */
const JUMP_FORCE      = 15;
const GRAVITY         = -32;
const SLIDE_DURATION  = 0.72;
const DOUBLE_JUMP_CAP = 1;

/* ─── Lane System ───────────────────────────────────────────── */
const LANE_WIDTH   = 1.8;          // distance between lanes
const LANES        = [-LANE_WIDTH, 0, LANE_WIDTH];  // left, center, right
const LANE_LERP    = 12;           // how fast we slide between lanes

/* ─── Game-feel Constants ───────────────────────────────────── */
const COYOTE_TIME    = 0.12;       // seconds after leaving ground where jump still works
const JUMP_BUFFER    = 0.15;       // seconds before landing where jump input is queued
const LAND_SQUASH_T  = 0.18;       // squash duration on landing
const STUMBLE_DUR    = 0.35;       // stumble animation duration on hit

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
    this.laneIdx     = 1;           // 0=left, 1=center, 2=right
    this.targetZ     = 0;

    /* Game-feel timers */
    this.coyoteTimer   = 0;         // time since last on ground
    this.jumpBufferT   = 0;         // buffered jump input timer
    this.landSquashT   = 0;         // squash animation timer
    this.wasOnGround   = true;

    /* Stumble */
    this.stumbleT      = 0;

    /* State: running | jumping | sliding */
    this.pstate      = 'running';

    /* Bounding box (world-space, updated each frame) */
    this.hitBox = new THREE.Box3();

    /* Dust particles on feet */
    this._dustParticles = [];

    this._build();
    this._addShadowCatcher();
    this._buildDustKicks();
  }

  /* ─── Build character model ──────────────────────────────── */
  _build() {
    const mtlLoader = new MTLLoader(loadingManager);
    mtlLoader.setPath('src/assets/characters/male/OBJ/');
    mtlLoader.load('Male_Casual.mtl', (materials) => {
      materials.preload();
      const objLoader = new OBJLoader(loadingManager);
      objLoader.setMaterials(materials);
      objLoader.setPath('src/assets/characters/male/OBJ/');
      objLoader.load('Male_Casual.obj', (object) => {
        object.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });

        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        object.scale.setScalar(1.6 / size.y);
        object.rotation.y = Math.PI / 2;

        const scaledBox = new THREE.Box3().setFromObject(object);
        object.position.y = -scaledBox.min.y;

        this.group.add(object);
        this.characterMesh = object;
      });
    });
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
    this.animT      = 0;
    this.laneIdx    = 1;
    this.targetZ    = 0;
    this.coyoteTimer  = 0;
    this.jumpBufferT  = 0;
    this.landSquashT  = 0;
    this.stumbleT     = 0;
    this.wasOnGround  = true;
    this._restoreDefaultPose();
  }

  hide() {
    this.group.visible = false;
    this._shadow.visible = false;
    for (const d of this._dustParticles) d.mesh.visible = false;
  }

  jump() {
    if (this.isSliding) {
      // Cancel slide into jump
      this.isSliding = false;
      this.slideTimer = 0;
    }

    // Can we jump right now?
    if (this.onGround || this.coyoteTimer > 0) {
      this._doJump(JUMP_FORCE);
    } else if (this.extraJumps > 0) {
      // Double jump
      this._doJump(JUMP_FORCE * 0.82);
      this.extraJumps--;
      this._spawnDust(6, 0.3);  // air dust burst
    } else {
      // Buffer the jump for when we land
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
    if (!this.onGround && this.group.position.y > 0.5) return;  // Can't slide high in air

    // If slightly airborne, snap down fast (ground pound slide)
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
  }

  /* ─── Dust effect ─────────────────────────────────────────── */
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

    /* ── Coyote time tracking ── */
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

        /* Landing effects */
        if (wasAirborne) {
          this.landSquashT = LAND_SQUASH_T;
          this._spawnDust(4, 0.2);
        }

        /* Execute buffered jump */
        if (this.jumpBufferT > 0) {
          this.jumpBufferT = 0;
          this._doJump(JUMP_FORCE);
        }
      }
    }
    this.wasOnGround = this.onGround;

    /* ── Jump buffer countdown ── */
    if (this.jumpBufferT > 0) this.jumpBufferT -= dt;

    /* ── Slide countdown ── */
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.pstate = 'running';
      }
    }

    /* ── Stumble timer ── */
    if (this.stumbleT > 0) this.stumbleT -= dt;

    /* ── Land squash timer ── */
    if (this.landSquashT > 0) this.landSquashT -= dt;

    /* ── Invincibility flash ── */
    if (this.isInvincible) {
      this.invTimer -= dt;
      this.group.visible = Math.sin(this.invTimer * 18) > 0;
      if (this.invTimer <= 0) {
        this.isInvincible = false;
        this.group.visible = true;
      }
    }

    /* ── Lane movement (smooth lerp) ── */
    const dz = this.targetZ - this.group.position.z;
    this.group.position.z += dz * Math.min(1, LANE_LERP * dt);
    // Snap if very close
    if (Math.abs(dz) < 0.01) this.group.position.z = this.targetZ;

    /* ── Animate ── */
    this._animate(dz);

    /* ── Dust particles ── */
    this._updateDust(dt);

    /* ── Running dust kicks ── */
    if (this.pstate === 'running' && this.onGround && Math.random() < dt * 8) {
      this._spawnDust(1, 0.05);
    }

    /* ── Blob shadow ── */
    this._shadow.position.x = this.group.position.x;
    this._shadow.position.z = this.group.position.z;
    const airFrac = Math.min(1, this.group.position.y / 4);
    this._shadow.material.opacity = 0.35 * (1 - airFrac);
    this._shadow.scale.setScalar(1 + this.group.position.y * 0.08);

    /* ── Update hitbox (accounts for Z lane position) ── */
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

  /* ─── Animation ───────────────────────────────────────────── */
  _animate(laneDZ) {
    const t = this.animT;
    if (!this.characterMesh) return;

    /* ── Stumble overlay ── */
    if (this.stumbleT > 0) {
      const st = this.stumbleT / STUMBLE_DUR;
      this.characterMesh.rotation.z = Math.sin(st * Math.PI * 6) * 0.25 * st;
      // Don't return — let other animations layer below
    }

    if (this.pstate === 'running') {
      const runFreq = 8.5;
      const s = Math.sin(t * runFreq);
      const c = Math.cos(t * runFreq);

      /* Vertical bob — sharper foot strikes */
      const bob = Math.abs(s);
      this.characterMesh.position.y = bob * 0.1;

      /* Forward lean — slight constant lean while running */
      this.characterMesh.rotation.x = 0.08;

      /* Shoulder rotation (simulates arm pump) */
      this.characterMesh.rotation.z = s * 0.06;

      /* Lean into lane changes */
      const leanTarget = -laneDZ * 0.3;
      this.group.rotation.y = THREE.MathUtils.lerp(
        this.group.rotation.y, leanTarget, 0.15
      );

      /* Landing squash & stretch */
      if (this.landSquashT > 0) {
        const sq = this.landSquashT / LAND_SQUASH_T;
        const squashAmt = sq * 0.15;
        this.group.scale.set(1 + squashAmt, 1 - squashAmt * 1.5, 1 + squashAmt);
      } else {
        this.group.scale.set(1, 1, 1);
      }

    } else if (this.pstate === 'jumping') {
      const airTime = Math.max(0, this.group.position.y / 3);

      /* Tuck on the way up, extend on the way down */
      if (this.vy > 0) {
        // Going up — tuck
        this.characterMesh.rotation.x = -0.25 - airTime * 0.1;
        this.group.scale.set(0.95, 1.08, 0.95); // stretch vertically
      } else {
        // Coming down — extend/prepare for landing
        this.characterMesh.rotation.x = 0.1;
        this.group.scale.set(1.05, 0.93, 1.05); // squash anticipation
      }

      this.characterMesh.position.y = 0;

      /* Lean into direction */
      this.group.rotation.y = THREE.MathUtils.lerp(
        this.group.rotation.y, -laneDZ * 0.4, 0.1
      );

      /* Slight spin on double jump */
      if (this.extraJumps < DOUBLE_JUMP_CAP) {
        this.characterMesh.rotation.z += 8 * (1 / 60); // continuous spin
      } else {
        this.characterMesh.rotation.z = 0;
      }

    } else if (this.pstate === 'sliding') {
      /* Low slide — squash down, tilt forward */
      const slideProgress = 1 - (this.slideTimer / SLIDE_DURATION);
      this.group.scale.y = 0.55 + slideProgress * 0.1; // start low, rise slightly
      this.group.scale.x = 1.1;
      this.group.scale.z = 1.1;
      this.characterMesh.rotation.x = 1.3 - slideProgress * 0.3;
      this.characterMesh.position.y = 0;

      /* Keep lane lean */
      this.group.rotation.y = THREE.MathUtils.lerp(
        this.group.rotation.y, -laneDZ * 0.2, 0.1
      );
    }
  }

  _restoreDefaultPose() {
    if (this.characterMesh) {
      this.characterMesh.position.y = 0;
      this.characterMesh.rotation.set(0, Math.PI / 2, 0);
    }
  }
}
