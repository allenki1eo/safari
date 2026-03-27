import * as THREE from 'three';
import { loadingManager } from './Level.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const JUMP_FORCE      = 15;
const GRAVITY         = -32;
const SLIDE_DURATION  = 0.72;
const DOUBLE_JUMP_CAP = 1;       // allow one mid-air jump

/* Colour palette — Tanzania flag + warm skin */
const C = {
  skin:    0x3D1D0C,   /* rich dark brown */
  skinMid: 0x5C2E14,   /* lighter area (palms/face) */
  hair:    0x0A0400,
  green:   0x0E7A3E,   /* Tanzania green shirt */
  black:   0x151515,   /* shorts */
  gold:    0xE8C418,   /* stripe / trim */
  blue:    0x0EAED4,   /* shoes */
  white:   0xF5F0E8,
  teeth:   0xFFFAF0,
};

function mat(color, rough = 0.85, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

/* ─────────────────────────────────────────────────────────── */
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

    /* State: running | jumping | sliding | dead */
    this.pstate      = 'running';

    /* Bounding box (world-space, updated each frame) */
    this.hitBox = new THREE.Box3();

    this._build();
    this._addShadowCatcher();
  }

  /* ─── Build custom character ──────────────────────────── */
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

        /* Center and scale the rigid body */
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        object.scale.setScalar(1.6 / size.y);
        
        /* Characters are oriented to +Z by default; face direction of travel (+X) */
        object.rotation.y = Math.PI / 2;

        /* Move pivot so feet sit cleanly on Y=0 */
        const scaledBox = new THREE.Box3().setFromObject(object);
        object.position.y = -scaledBox.min.y;
        
        this.group.add(object);
        this.characterMesh = object;
      });
    });
  }

  _addShadowCatcher() {
    /* Soft blob shadow under the player */
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

  /* ─── Public API ──────────────────────────────────────── */
  reset() {
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, Math.PI / 2, 0);
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
    this._restoreDefaultPose();
  }

  hide() {
    this.group.visible = false;
    this._shadow.visible = false;
  }

  jump() {
    if (this.isSliding) return;
    if (this.onGround) {
      this.vy         = JUMP_FORCE;
      this.onGround   = false;
      this.pstate     = 'jumping';
      this.extraJumps = DOUBLE_JUMP_CAP;
    } else if (this.extraJumps > 0) {
      /* Double jump */
      this.vy = JUMP_FORCE * 0.82;
      this.extraJumps--;
      /* tiny visual kick */
      this.group.rotation.z = 0.15;
    }
  }

  slide() {
    if (this.isSliding || !this.onGround) return;
    this.isSliding  = true;
    this.slideTimer = SLIDE_DURATION;
    this.pstate     = 'sliding';
  }

  startInvincibility(dur = 2.2) {
    this.isInvincible = true;
    this.invTimer = dur;
  }

  /* ─── Update ──────────────────────────────────────────── */
  update(dt, time) {
    this.animT += dt;

    /* Gravity */
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.group.position.y += this.vy * dt;
      if (this.group.position.y <= 0) {
        this.group.position.y = 0;
        this.vy       = 0;
        this.onGround = true;
        if (this.pstate === 'jumping') this.pstate = 'running';
        this.group.rotation.z = 0;
      }
    }

    /* Slide countdown */
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.pstate    = 'running';
      }
    }

    /* Invincibility flash */
    if (this.isInvincible) {
      this.invTimer -= dt;
      this.group.visible = Math.sin(this.invTimer * 18) > 0;
      if (this.invTimer <= 0) {
        this.isInvincible = false;
        this.group.visible = true;
      }
    }

    /* Animate */
    this._animate();

    /* Blob shadow follows, fades when airborne */
    this._shadow.position.x = this.group.position.x;
    this._shadow.position.z = this.group.position.z;
    const shadowOpacity = 0.35 * (1 - Math.min(1, this.group.position.y / 4));
    this._shadow.material.opacity = shadowOpacity;
    this._shadow.scale.set(1 + this.group.position.y * 0.05, 1 + this.group.position.y * 0.05, 1);

    /* Update hitbox */
    const py = this.group.position.y;
    if (this.isSliding) {
      this.hitBox.setFromCenterAndSize(
        new THREE.Vector3(0.05, py + 0.42, 0),
        new THREE.Vector3(0.32, 0.84, 0.24)
      );
    } else {
      this.hitBox.setFromCenterAndSize(
        new THREE.Vector3(0.05, py + 0.92, 0),
        new THREE.Vector3(0.32, 1.72, 0.24)
      );
    }
  }

  /* ─── Animation ───────────────────────────────────────── */
  _animate() {
    const t = this.animT;

    /* If object hasn't loaded yet from AssetManager, do nothing */
    if (!this.characterMesh) return;

    if (this.pstate === 'running') {
      const s = Math.sin(t * 7.5);
      
      /* Rigid body bob to simulate pounding steps */
      this.characterMesh.position.y = Math.abs(s) * 0.08;
      this.characterMesh.rotation.z = s * 0.05; // slight shoulder sway
      this.characterMesh.rotation.x = 0;       // reset lean
      
      this.group.rotation.z = 0;
      this.group.scale.set(1, 1, 1);

    } else if (this.pstate === 'jumping') {
      /* Lean back mid-air */
      this.characterMesh.rotation.x = -0.3;
      this.characterMesh.position.y = 0;
      this.group.scale.set(1, 1, 1);

    } else if (this.pstate === 'sliding') {
      /* Feet-first baseball slide tilt */
      this.group.scale.y = 0.65;
      this.characterMesh.rotation.x = 1.25; 
      this.characterMesh.position.y = 0;
    }
  }

  _restoreDefaultPose() {
    if (this.characterMesh) {
      this.characterMesh.position.y = 0;
      this.characterMesh.rotation.set(0, Math.PI / 2, 0); 
    }
  }
}
