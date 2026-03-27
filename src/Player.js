/* ─── Player — Beautiful 3D Tanzanian Runner ─────────────── */
import * as THREE from 'three';

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

  /* ─── Build humanoid ──────────────────────────────────── */
  _build() {
    const g = this.group;

    /* materials */
    const mSkin  = mat(C.skin,    0.9);
    const mSkinL = mat(C.skinMid, 0.9);
    const mHair  = mat(C.hair,    0.85);
    const mGreen = mat(C.green,   0.8);
    const mBlack = mat(C.black,   0.8);
    const mGold  = mat(C.gold,    0.5,  0.3);
    const mBlue  = mat(C.blue,    0.7);
    const mWhite = mat(C.white,   0.9);

    /* ── HEAD GROUP ── */
    this._head = new THREE.Group();
    this._head.position.set(0, 1.72, 0);

    /* skull */
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), mSkin);
    skull.castShadow = true;
    this._head.add(skull);

    /* hair — tight afro: sphere + cap */
    const hair1 = new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 14), mHair);
    hair1.scale.set(1, 0.78, 1);
    hair1.position.y = 0.07;
    this._head.add(hair1);

    /* face — subtle lighter oval */
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), mSkinL);
    face.scale.set(0.7, 0.82, 0.4);
    face.position.set(0, -0.02, 0.14);
    this._head.add(face);

    /* whites of eyes */
    const eyeGeo = new THREE.SphereGeometry(0.038, 10, 8);
    const lEyeW = new THREE.Mesh(eyeGeo, mWhite);
    lEyeW.position.set(-0.082, 0.052, 0.196);
    this._head.add(lEyeW);
    const rEyeW = lEyeW.clone();
    rEyeW.position.x = 0.082;
    this._head.add(rEyeW);

    /* irises */
    const irisGeo = new THREE.SphereGeometry(0.024, 8, 8);
    const mIris = mat(0x111111, 0.8);
    const lIris = new THREE.Mesh(irisGeo, mIris);
    lIris.position.set(-0.082, 0.052, 0.217);
    this._head.add(lIris);
    const rIris = lIris.clone();
    rIris.position.x = 0.082;
    this._head.add(rIris);

    /* smile */
    const smileGeo = new THREE.TorusGeometry(0.055, 0.01, 6, 14, Math.PI);
    const smile = new THREE.Mesh(smileGeo, mat(0x8B3A1A, 0.9));
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.06, 0.21);
    this._head.add(smile);

    /* neck */
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.13, 10), mSkin);
    neck.position.set(0, -0.19, 0);
    this._head.add(neck);

    g.add(this._head);

    /* ── TORSO ── */
    this._torso = new THREE.Group();
    this._torso.position.set(0, 1.18, 0);

    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.26), mGreen);
    torsoMesh.castShadow = true;
    this._torso.add(torsoMesh);

    /* jersey number "10" badge */
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.22), mat(C.gold, 0.6));
    badge.position.set(0, 0.02, 0.135);
    this._torso.add(badge);

    /* shoulder gold stripes */
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.27), mGold);
    strap.position.y = 0.24;
    this._torso.add(strap);

    g.add(this._torso);

    /* ── HIPS / SHORTS ── */
    this._hips = new THREE.Group();
    this._hips.position.set(0, 0.82, 0);

    const hipsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.24), mBlack);
    hipsMesh.castShadow = true;
    this._hips.add(hipsMesh);

    /* gold waistband */
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.055, 0.255), mGold);
    waist.position.y = 0.14;
    this._hips.add(waist);

    g.add(this._hips);

    /* ── ARMS ── (pivot at shoulder) */
    const uArmGeo = new THREE.CylinderGeometry(0.072, 0.065, 0.32, 9);
    const lArmGeo = new THREE.CylinderGeometry(0.065, 0.058, 0.28, 9);
    const handGeo = new THREE.SphereGeometry(0.07, 10, 8);

    this._lArmP = this._buildArm(-0.28, mGreen, mSkin, uArmGeo, lArmGeo, handGeo);
    this._rArmP = this._buildArm( 0.28, mGreen, mSkin, uArmGeo, lArmGeo, handGeo);
    g.add(this._lArmP, this._rArmP);

    /* ── LEGS ── (pivot at hip) */
    const uLegGeo = new THREE.CylinderGeometry(0.105, 0.092, 0.44, 10);
    const lLegGeo = new THREE.CylinderGeometry(0.088, 0.072, 0.38, 10);
    const shoeGeo = new THREE.BoxGeometry(0.14, 0.1, 0.31);
    const soleGeo = new THREE.BoxGeometry(0.145, 0.04, 0.315);

    [this._lLegP, this._lKneeP] = this._buildLeg(-0.135, mBlack, mSkin, mBlue, mGold, uLegGeo, lLegGeo, shoeGeo, soleGeo);
    [this._rLegP, this._rKneeP] = this._buildLeg( 0.135, mBlack, mSkin, mBlue, mGold, uLegGeo, lLegGeo, shoeGeo, soleGeo);
    g.add(this._lLegP, this._rLegP);

    /* cast shadow on all meshes */
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  }

  _buildArm(xOff, mShirt, mSkin, uGeo, lGeo, hGeo) {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 1.37, 0);

    const upper = new THREE.Mesh(uGeo, mShirt);
    upper.position.y = -0.16;
    pivot.add(upper);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.32;
    pivot.add(kneePivot);

    const lower = new THREE.Mesh(lGeo, mSkin);
    lower.position.y = -0.14;
    kneePivot.add(lower);

    const hand = new THREE.Mesh(hGeo, mSkin);
    hand.position.y = -0.29;
    kneePivot.add(hand);

    pivot._elbow = kneePivot;
    return pivot;
  }

  _buildLeg(xOff, mShorts, mSkin, mShoe, mGold, uGeo, lGeo, shGeo, slGeo) {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 0.68, 0);

    const upper = new THREE.Mesh(uGeo, mShorts);
    upper.position.y = -0.22;
    pivot.add(upper);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.44;
    pivot.add(kneePivot);

    const lower = new THREE.Mesh(lGeo, mSkin);
    lower.position.y = -0.19;
    kneePivot.add(lower);

    const shoe = new THREE.Mesh(shGeo, mShoe);
    shoe.position.set(0, -0.4, 0.06);
    kneePivot.add(shoe);

    /* lace stripe */
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.025, 0.12), mat(C.white, 0.9));
    lace.position.set(0, -0.355, 0.10);
    kneePivot.add(lace);

    const sole = new THREE.Mesh(slGeo, mGold);
    sole.position.set(0, -0.445, 0.06);
    kneePivot.add(sole);

    return [pivot, kneePivot];
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
    const py = this.group.position.y;

    if (this.pstate === 'running') {
      const s = Math.sin(t * 7.5);
      const c = Math.cos(t * 7.5);

      /* legs — realistic running gait */
      this._lLegP.rotation.x  =  s * 1.0;
      this._rLegP.rotation.x  = -s * 1.0;
      /* knee bend — only when leg swings back */
      this._lKneeP.rotation.x = Math.max(0, -s * 1.1);
      this._rKneeP.rotation.x = Math.max(0, s * 1.1);

      /* arms swing opposite to legs */
      this._lArmP.rotation.x  = -s * 0.75;
      this._rArmP.rotation.x  =  s * 0.75;
      this._lArmP._elbow.rotation.x = Math.max(0, -s * 0.5);
      this._rArmP._elbow.rotation.x = Math.max(0, s * 0.5);

      /* slight lateral lean in stride */
      this._torso.rotation.z  = s * 0.04;
      this._head.rotation.z   = -s * 0.025;

      /* body bob */
      const bob = Math.abs(s) * 0.028;
      this._torso.position.y = 1.18 + bob;
      this._head.position.y  = 1.72 + bob;

      /* forward lean */
      this._torso.rotation.x = 0.12;
      this._head.rotation.x  = -0.05;
      this.group.rotation.z  = 0;
      this.group.scale.set(1, 1, 1);

    } else if (this.pstate === 'jumping') {
      /* tuck legs up, arms forward/out */
      this._lLegP.rotation.x  = -0.5 + py * 0.03;
      this._rLegP.rotation.x  = -0.5 + py * 0.03;
      this._lKneeP.rotation.x =  0.8;
      this._rKneeP.rotation.x =  0.8;
      this._lArmP.rotation.x  = -1.1;
      this._rArmP.rotation.x  = -1.1;
      this._lArmP._elbow.rotation.x = 0.3;
      this._rArmP._elbow.rotation.x = 0.3;
      this._torso.rotation.x  = -0.05;
      this._head.rotation.x   = 0.1;
      this._torso.position.y  = 1.18;
      this._head.position.y   = 1.72;
      this.group.scale.set(1, 1, 1);

    } else if (this.pstate === 'sliding') {
      /* crouch / slide */
      this.group.scale.y = 0.52;
      this._lLegP.rotation.x  =  0.65;
      this._rLegP.rotation.x  =  0.65;
      this._lKneeP.rotation.x =  0.9;
      this._rKneeP.rotation.x =  0.9;
      this._lArmP.rotation.x  =  0.6;
      this._rArmP.rotation.x  =  0.6;
      this._lArmP._elbow.rotation.x = -0.4;
      this._rArmP._elbow.rotation.x = -0.4;
      this._torso.rotation.x  = -0.4;
      this._head.rotation.x   =  0.3;
    }
  }

  _restoreDefaultPose() {
    for (const p of [this._lLegP, this._rLegP, this._lArmP, this._rArmP]) {
      if (p) p.rotation.set(0, 0, 0);
    }
    for (const p of [this._lKneeP, this._rKneeP]) {
      if (p) p.rotation.set(0, 0, 0);
    }
    if (this._torso) this._torso.rotation.set(0, 0, 0);
    if (this._head)  this._head.rotation.set(0, 0, 0);
  }
}
