/* ─── Level Manager — 3 Tanzania levels ─────────────────── */
import * as THREE from 'three';

/* ─── Shared helpers ─────────────────────────────────────── */
function m(color, rough = 0.85, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function box(w, h, d, mat, y0 = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = y0 + h / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/* ─── Level config catalogue ─────────────────────────────── */
const CONFIGS = [
  /* 0 — Serengeti */
  {
    name:       '🌾 Serengeti',
    skyTop:     0xE8622A,
    skyBot:     0xFFB84C,
    fogColor:   0xFFB347,
    fogDensity: 0.016,
    groundCol:  0xC4922A,
    groundRough:0.95,
    lightCol:   0xFFE0A0,
    ambCol:     0xFFD090,
    ambInt:     0.5,
    /* obstacle templates: { kind, w, h, hGap } hGap>0 = arch (duck under), hGap=0 = block (jump over) */
    obstacles: [
      { kind: 'wildebeest', w: 0.85, h: 1.05, hGap: 0,   col: 0x5C3D1C },
      { kind: 'rock',       w: 0.9,  h: 0.78, hGap: 0,   col: 0x7A6248 },
      { kind: 'termite',    w: 0.55, h: 1.45, hGap: 0,   col: 0xB87E3B },
      { kind: 'archway',    w: 0.4,  h: 2.6,  hGap: 1.05, col: 0x8B7355 },
    ],
    spawnMin: 2.2, spawnMax: 3.6,
  },
  /* 1 — Zanzibar Beach */
  {
    name:       '🏖️ Zanzibar',
    skyTop:     0x00BFEA,
    skyBot:     0x6EE6FF,
    fogColor:   0x9DE8FF,
    fogDensity: 0.012,
    groundCol:  0xEDD5A0,
    groundRough:0.9,
    lightCol:   0xFFF8E0,
    ambCol:     0xC0EEFF,
    ambInt:     0.6,
    obstacles: [
      { kind: 'crab',      w: 0.75, h: 0.55, hGap: 0,   col: 0xE05020 },
      { kind: 'barrel',    w: 0.6,  h: 1.0,  hGap: 0,   col: 0x8B4513 },
      { kind: 'driftwood', w: 1.1,  h: 0.45, hGap: 0,   col: 0x9E7B56 },
      { kind: 'arch-rock', w: 0.45, h: 2.8,  hGap: 1.1, col: 0xC8A66A },
    ],
    spawnMin: 2.0, spawnMax: 3.2,
  },
  /* 2 — Kilimanjaro Slopes */
  {
    name:       '🏔️ Kilimanjaro',
    skyTop:     0xA8C0D0,
    skyBot:     0xD8EAF5,
    fogColor:   0xCDE4F5,
    fogDensity: 0.014,
    groundCol:  0x8C8C8C,
    groundRough:0.92,
    lightCol:   0xE8F0FF,
    ambCol:     0xB0CCEE,
    ambInt:     0.6,
    obstacles: [
      { kind: 'boulder', w: 1.0,  h: 1.2,  hGap: 0,   col: 0x6A6A6A },
      { kind: 'icewall', w: 0.5,  h: 2.0,  hGap: 0,   col: 0xB8D8F0 },
      { kind: 'snowlog', w: 1.2,  h: 0.5,  hGap: 0,   col: 0xE8E8F5 },
      { kind: 'iceArch', w: 0.45, h: 2.7,  hGap: 1.05, col: 0x90C4E0 },
    ],
    spawnMin: 1.8, spawnMax: 2.8,
  },
];

/* Swahili collectible phrases */
const SWAHILI = [
  'Karibu!', 'Hakuna Matata!', 'Jambo!', 'Pole pole!',
  'Asante!', 'Nzuri sana!', 'Haraka haraka!', 'Twende!',
  'Mambo?', 'Poa!', 'Salama!',
];

/* ─────────────────────────────────────────────────────────── */
export class Level {
  static LEVEL_COUNT = CONFIGS.length;

  constructor(scene, renderer) {
    this.scene    = scene;
    this.renderer = renderer;
    this.cfg      = null;

    /* Running lists */
    this._env       = [];   /* static env meshes */
    this._obstacles = [];   /* { mesh, hb:Box3, speed multiplier, arch } */
    this._gems      = [];   /* { mesh, hb, word } */
    this._particles = null; /* Points */

    /* Pool for re-use */
    this._obsPool  = [];
    this._gemPool  = [];

    /* Decorations that scroll */
    this._decors   = [];    /* { group, z } */

    this._spawnTimer = 0;
    this._gemTimer   = 0;
    this._spawnInt   = 2.5;
    this._gemInt     = 4.0;
    this._loaded     = false;
    this.name        = '';

    /* Reusable geometries */
    this._gemGeo = new THREE.OctahedronGeometry(0.22, 0);
    this._gemMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.1, metalness: 0.9, emissive: 0xFFAA00, emissiveIntensity: 0.4 });
  }

  /* ─── Load level ────────────────────────────────────────── */
  load(idx) {
    this.unload();
    this.cfg  = CONFIGS[idx];
    this.name = this.cfg.name;
    this._loaded = true;

    this._buildSky();
    this._buildGround();
    this._buildBackground(idx);
    this._buildObstaclePool();
    this._buildGemPool();
    this._buildParticles(idx);

    this._spawnTimer = 1.0;
    this._gemTimer   = this.cfg.spawnMin * 1.5;
    this._spawnInt   = this.cfg.spawnMin;
    this.scene.fog   = new THREE.FogExp2(this.cfg.fogColor, this.cfg.fogDensity);
  }

  unload() {
    for (const m of this._env)     this.scene.remove(m);
    for (const o of this._obsPool) this.scene.remove(o.mesh);
    for (const g of this._gemPool) this.scene.remove(g.mesh);
    if (this._particles) this.scene.remove(this._particles);
    for (const d of this._decors) this.scene.remove(d.group);

    this._env      = [];
    this._obsPool  = [];
    this._gemPool  = [];
    this._obstacles = [];
    this._gems      = [];
    this._decors   = [];
    this._particles = null;
    this._loaded    = false;
  }

  /* ─── Sky gradient background ──────────────────────────── */
  _buildSky() {
    /* We render a large sky-box sphere */
    const geo = new THREE.SphereGeometry(220, 32, 16);
    geo.deleteAttribute('normal');
    /* Use vertex colours for gradient */
    const pos = geo.attributes.position;
    const col = [];
    const top = new THREE.Color(this.cfg.skyTop);
    const bot = new THREE.Color(this.cfg.skyBot);
    for (let i = 0; i < pos.count; i++) {
      const y  = pos.getY(i);
      const t  = THREE.MathUtils.clamp((y + 80) / 180, 0, 1);
      const c  = bot.clone().lerp(top, t);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
    const sky = new THREE.Mesh(geo, skyMat);
    this.scene.add(sky);
    this._env.push(sky);
  }

  /* ─── Ground plane ─────────────────────────────────────── */
  _buildGround() {
    const geo = new THREE.PlaneGeometry(300, 40, 60, 1);
    /* Subtle height variation */
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, (Math.random() - 0.5) * 0.04);
    }
    geo.computeVertexNormals();

    const mat2 = new THREE.MeshStandardMaterial({
      color:     this.cfg.groundCol,
      roughness: this.cfg.groundRough,
    });
    const ground = new THREE.Mesh(geo, mat2);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this._env.push(ground);

    /* Ground edge / runner lane — slight highlight */
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 1.5),
      new THREE.MeshStandardMaterial({ color: this.cfg.groundCol, roughness: 0.8, opacity: 0.6, transparent: true })
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.y = 0.005;
    this.scene.add(lane);
    this._env.push(lane);
  }

  /* ─── Background scenery ────────────────────────────────── */
  _buildBackground(idx) {
    if (idx === 0) this._buildSerengeti();
    if (idx === 1) this._buildZanzibar();
    if (idx === 2) this._buildKilimanjaro();
  }

  _buildSerengeti() {
    /* Acacia tree silhouettes at various z depths */
    for (let i = 0; i < 24; i++) {
      const x   = (Math.random() - 0.5) * 140;
      const z   = -2 - Math.random() * 9;
      const s   = 0.5 + Math.random() * 1.2;
      const grp = this._makeAcacia(s);
      grp.position.set(x, 0, z);
      this.scene.add(grp);
      this._decors.push({ group: grp, z, speed: 0.25 + 0.5 * (z / -11) });
    }
    /* Sun disk */
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(6, 32),
      new THREE.MeshBasicMaterial({ color: 0xFF8C00 })
    );
    sun.position.set(30, 28, -60);
    this.scene.add(sun);
    this._env.push(sun);
    /* Sun glow */
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshBasicMaterial({ color: 0xFFB34C, transparent: true, opacity: 0.3 })
    );
    glow.position.set(30, 28, -60.1);
    this.scene.add(glow);
    this._env.push(glow);
    /* Distant mountains silhouette */
    this._addHillSilhouette(0x8B4513, -50, 18, 6);
  }

  _makeAcacia(scale) {
    const grp = new THREE.Group();
    /* trunk */
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06 * scale, 0.1 * scale, 1.5 * scale, 7),
      m(0x5C3D18, 0.95)
    );
    trunk.position.y = 0.75 * scale;
    grp.add(trunk);
    /* canopy — flat umbrella disc + sphere */
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.0 * scale, 14, 6),
      m(0x2D5A1B + (Math.random() > 0.5 ? 0x050500 : 0), 0.9)
    );
    canopy.scale.set(1.6, 0.55, 1.4);
    canopy.position.y = 1.9 * scale;
    grp.add(canopy);
    return grp;
  }

  _buildZanzibar() {
    /* Ocean plane behind ground */
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 60),
      new THREE.MeshStandardMaterial({ color: 0x0080CC, roughness: 0.3, metalness: 0.1 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.05, -18);
    this.scene.add(ocean);
    this._env.push(ocean);
    this._ocean = ocean;

    /* Palm trees */
    for (let i = 0; i < 18; i++) {
      const x = (Math.random() - 0.5) * 120;
      const z = -1 - Math.random() * 8;
      const s = 0.6 + Math.random() * 0.8;
      const p = this._makePalm(s);
      p.position.set(x, 0, z);
      this.scene.add(p);
      this._decors.push({ group: p, z, speed: 0.3 + 0.5 * (z / -9) });
    }
    /* Distant island */
    this._addHillSilhouette(0x007755, -60, 14, 5);
  }

  _makePalm(scale) {
    const grp = new THREE.Group();
    /* curved trunk via tapered cylinder segments */
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07 * scale * (1 - i * 0.06), 0.09 * scale * (1 - i * 0.04), 0.9 * scale, 8),
        m(0x8B6914, 0.95)
      );
      seg.position.y = (0.45 + i * 0.9) * scale;
      seg.rotation.z = Math.sin(i * 0.6) * 0.12;
      grp.add(seg);
    }
    /* fronds */
    const frondMat = m(0x1A7A25, 0.85);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const fr = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 * scale, 0.04 * scale, 0.9 * scale),
        frondMat
      );
      fr.position.set(
        Math.cos(angle) * 0.55 * scale,
        3.7 * scale,
        Math.sin(angle) * 0.55 * scale
      );
      fr.rotation.z = Math.cos(angle) * 0.5;
      fr.rotation.x = Math.sin(angle) * 0.5;
      fr.rotation.y = -angle;
      grp.add(fr);
    }
    /* coconuts */
    const coco = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 * scale, 8, 8),
      m(0x5A3A10, 0.9)
    );
    coco.position.set(0, 3.5 * scale, 0);
    grp.add(coco);
    return grp;
  }

  _buildKilimanjaro() {
    /* Large mountain peak */
    const peak = new THREE.Mesh(
      new THREE.ConeGeometry(22, 38, 8),
      m(0x889899, 0.92)
    );
    peak.position.set(30, 0, -55);
    this.scene.add(peak);
    this._env.push(peak);

    /* Snow cap */
    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(8, 14, 8),
      m(0xF0F4F8, 0.88)
    );
    snow.position.set(30, 19, -55);
    this.scene.add(snow);
    this._env.push(snow);

    /* Secondary peak */
    const peak2 = new THREE.Mesh(
      new THREE.ConeGeometry(14, 26, 7),
      m(0x7A8A90, 0.92)
    );
    peak2.position.set(-20, 0, -50);
    this.scene.add(peak2);
    this._env.push(peak2);

    /* Snow patches on ground */
    for (let i = 0; i < 20; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(0.6 + Math.random() * 1.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xF0F4F8, roughness: 0.9 })
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((Math.random() - 0.5) * 100, 0.01, (Math.random() - 0.5) * 15);
      this.scene.add(patch);
      this._env.push(patch);
    }

    /* Pine trees */
    for (let i = 0; i < 14; i++) {
      const x = (Math.random() - 0.5) * 110;
      const z = -1.5 - Math.random() * 7;
      const s = 0.5 + Math.random() * 1.0;
      const p = this._makePine(s);
      p.position.set(x, 0, z);
      this.scene.add(p);
      this._decors.push({ group: p, z, speed: 0.3 + 0.4 * (z / -8.5) });
    }
  }

  _makePine(scale) {
    const grp = new THREE.Group();
    const trunkMat = m(0x5C3A18, 0.95);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.1 * scale, 0.8 * scale, 7), trunkMat);
    trunk.position.y = 0.4 * scale;
    grp.add(trunk);
    const needleMat = m(0x1A4A22, 0.88);
    for (let t = 0; t < 3; t++) {
      const tier = new THREE.Mesh(
        new THREE.ConeGeometry((0.6 - t * 0.12) * scale, (0.8 + t * 0.1) * scale, 7),
        needleMat
      );
      tier.position.y = (1.0 + t * 0.55) * scale;
      grp.add(tier);
    }
    return grp;
  }

  _addHillSilhouette(color, z, maxH, count) {
    const mat2 = m(color, 0.95);
    for (let i = 0; i < count; i++) {
      const h   = maxH * (0.5 + Math.random() * 0.5);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(10 + Math.random() * 8, h, 7), mat2);
      hill.position.set((i - count / 2) * 22 + (Math.random() - 0.5) * 10, 0, z);
      this.scene.add(hill);
      this._env.push(hill);
    }
  }

  /* ─── Obstacle pool ─────────────────────────────────────── */
  _buildObstaclePool() {
    for (let i = 0; i < 18; i++) {
      const tmpl = this.cfg.obstacles[i % this.cfg.obstacles.length];
      const grp  = this._makeObstacleMesh(tmpl);
      grp.visible = false;
      this.scene.add(grp);
      this._obsPool.push({ group: grp, active: false, tmpl, hb: new THREE.Box3() });
    }
  }

  _makeObstacleMesh(tmpl) {
    const grp = new THREE.Group();
    const mat2 = m(tmpl.col, 0.9);

    if (tmpl.hGap > 0) {
      /* Archway: two pillars + crossbar */
      const pillarH = tmpl.h;
      const pillarW = 0.4;
      const gapH    = tmpl.hGap;

      /* Left pillar (from ground to full height, opening cut in middle) */
      const pL = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, 0.6), mat2);
      pL.position.set(-0.65, pillarH / 2, 0);
      pL.castShadow = true;
      grp.add(pL);

      const pR = pL.clone();
      pR.position.x = 0.65;
      grp.add(pR);

      /* Top bar (above the gap) */
      const barH = pillarH - gapH;
      const bar  = new THREE.Mesh(new THREE.BoxGeometry(1.7, barH, 0.6), mat2);
      bar.position.y = gapH + barH / 2;
      bar.castShadow = true;
      grp.add(bar);

      grp.userData = { arch: true, gapTop: gapH, gapBot: 0 };
    } else {
      /* Solid obstacle */
      let obsMesh;
      if (tmpl.kind === 'wildebeest' || tmpl.kind === 'crab') {
        obsMesh = this._makeAnimal(tmpl);
      } else if (tmpl.kind === 'boulder' || tmpl.kind === 'rock') {
        obsMesh = this._makeRock(tmpl);
      } else {
        obsMesh = box(tmpl.w, tmpl.h, 0.5, mat2);
      }
      grp.add(obsMesh);
      grp.userData = { arch: false };
    }
    return grp;
  }

  _makeAnimal(tmpl) {
    const mat2 = m(tmpl.col, 0.88);
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(tmpl.w, tmpl.h * 0.6, 0.5), mat2);
    body.position.y = tmpl.h * 0.6;
    body.castShadow = true;
    grp.add(body);
    /* legs */
    const legH = tmpl.h * 0.45;
    const legGeo = new THREE.CylinderGeometry(0.07, 0.06, legH, 6);
    for (let lx = -0.25; lx <= 0.25; lx += 0.5) {
      const leg = new THREE.Mesh(legGeo, mat2);
      leg.position.set(lx, legH / 2, 0.12);
      leg.castShadow = true;
      grp.add(leg);
      const leg2 = leg.clone();
      leg2.position.z = -0.12;
      grp.add(leg2);
    }
    /* head */
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), mat2);
    head.position.set(tmpl.w * 0.45, tmpl.h * 0.72, 0);
    head.castShadow = true;
    grp.add(head);
    return grp;
  }

  _makeRock(tmpl) {
    const mat2 = m(tmpl.col, 0.95);
    const grp = new THREE.Group();
    const geo = new THREE.DodecahedronGeometry(tmpl.h / 2, 0);
    /* Randomise vertices slightly */
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) * (0.85 + Math.random() * 0.3));
      pos.setY(i, pos.getY(i) * (0.85 + Math.random() * 0.3));
      pos.setZ(i, pos.getZ(i) * (0.85 + Math.random() * 0.3));
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, mat2);
    rock.scale.set(tmpl.w / tmpl.h, 1, 0.8);
    rock.position.y = tmpl.h / 2;
    rock.castShadow = rock.receiveShadow = true;
    grp.add(rock);
    return grp;
  }

  /* ─── Gem pool ──────────────────────────────────────────── */
  _buildGemPool() {
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(this._gemGeo, this._gemMat);
      mesh.castShadow = true;
      mesh.visible = false;
      this.scene.add(mesh);
      this._gemPool.push({ mesh, active: false, hb: new THREE.Box3(), word: '' });
    }
  }

  /* ─── Particles ─────────────────────────────────────────── */
  _buildParticles(idx) {
    const count = 320;
    const pos   = new Float32Array(count * 3);
    const col   = new Float32Array(count * 3);
    const baseC = idx === 2
      ? new THREE.Color(0xDDEEFF)
      : idx === 1
        ? new THREE.Color(0xFFFFFF)
        : new THREE.Color(0xD4A050);

    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 80;
      pos[i*3+1] = Math.random() * 6;
      pos[i*3+2] = (Math.random() - 0.5) * 8;
      const c = baseC.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.2);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    const mat2 = new THREE.PointsMaterial({ size: idx === 2 ? 0.12 : 0.09, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });
    this._particles = new THREE.Points(geo, mat2);
    this.scene.add(this._particles);
  }

  /* ─── Update ─────────────────────────────────────────────── */
  update(dt, speed, playerHB, time) {
    if (!this._loaded) return { hit: false };

    const ev = { hit: false, collect: null, word: null };

    /* Scroll decorations (parallax) */
    for (const d of this._decors) {
      d.group.position.x -= speed * d.speed * dt;
      if (d.group.position.x < -80) d.group.position.x += 160;
    }

    /* Animate ocean waves */
    if (this._ocean) {
      this._ocean.position.y = -0.05 + Math.sin(time * 1.4) * 0.06;
    }

    /* Particles drift */
    if (this._particles) {
      const pos = this._particles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) - speed * 0.04 * dt);
        pos.setY(i, pos.getY(i) + Math.sin(time + i) * 0.005);
        if (pos.getX(i) < -40) pos.setX(i, pos.getX(i) + 80);
      }
      pos.needsUpdate = true;
      this._particles.rotation.y = Math.sin(time * 0.1) * 0.01;
    }

    /* Obstacle spawning */
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = this.cfg.spawnMin + Math.random() * (this.cfg.spawnMax - this.cfg.spawnMin);
      this._spawnTimer = Math.max(this._spawnTimer * (9 / speed), 0.8);
      this._spawnObstacle();
    }

    /* Move and check obstacles */
    for (const obs of this._obsPool) {
      if (!obs.active) continue;
      obs.group.position.x -= speed * dt;

      /* Update hitbox */
      obs.hb.setFromObject(obs.group);
      /* Shrink slightly for fairness */
      obs.hb.expandByScalar(-0.07);

      /* Off-screen → recycle */
      if (obs.group.position.x < -16) {
        obs.active = false;
        obs.group.visible = false;
        continue;
      }

      /* Collision check vs player */
      if (!ev.hit && obs.hb.intersectsBox(playerHB)) {
        if (obs.tmpl.hGap > 0) {
          /* Arch: only hit if player overlaps with the SOLID parts */
          const py_top = playerHB.max.y;
          const py_bot = playerHB.min.y;
          const archTop  = obs.tmpl.h;
          const gapBot   = 0;
          const gapTop   = obs.tmpl.hGap;
          /* Solid = [gapBot..0] (nothing below) or [gapTop..archTop] */
          if (py_top > (obs.group.position.y + gapTop)) {
            ev.hit = true;
          }
        } else {
          ev.hit = true;
        }
      }
    }

    /* Gem spawning */
    this._gemTimer -= dt;
    if (this._gemTimer <= 0) {
      this._gemTimer = 3.5 + Math.random() * 3.0;
      this._spawnGem();
    }

    /* Move and check gems */
    for (const gem of this._gemPool) {
      if (!gem.active) continue;
      gem.mesh.position.x -= speed * dt;
      gem.mesh.position.y = gem._baseY + Math.sin(time * 4 + gem._phase) * 0.18;
      gem.mesh.rotation.y += dt * 2.5;

      gem.hb.setFromObject(gem.mesh);

      if (gem.mesh.position.x < -16) {
        gem.active = false;
        gem.mesh.visible = false;
        continue;
      }
      if (!ev.collect && gem.hb.intersectsBox(playerHB)) {
        gem.active = false;
        gem.mesh.visible = false;
        ev.collect = 'gem';
        ev.word    = gem.word;
      }
    }

    return ev;
  }

  /* ─── Spawners ──────────────────────────────────────────── */
  _spawnObstacle() {
    const free = this._obsPool.find(o => !o.active);
    if (!free) return;

    /* Pick a random template, matching pool slot */
    const tmpl     = this.cfg.obstacles[Math.floor(Math.random() * this.cfg.obstacles.length)];
    /* Find a pool slot with this template (or just use the free one and rebuild) */
    free.tmpl      = tmpl;
    free.group.position.set(24 + Math.random() * 4, 0, (Math.random() - 0.5) * 0.3);
    free.group.visible = true;
    free.active    = true;
  }

  _spawnGem() {
    const free = this._gemPool.find(g => !g.active);
    if (!free) return;
    const y = 0.8 + Math.random() * 1.4;
    free.mesh.position.set(26 + Math.random() * 4, y, (Math.random() - 0.5) * 0.4);
    free._baseY  = y;
    free._phase  = Math.random() * Math.PI * 2;
    free.word    = SWAHILI[Math.floor(Math.random() * SWAHILI.length)];
    free.mesh.visible = true;
    free.active  = true;
  }

  /* ─── Lighting update ───────────────────────────────────── */
  updateLighting(sun, ambient, fill) {
    if (!this.cfg) return;
    sun.color.set(this.cfg.lightCol);
    ambient.color.set(this.cfg.ambCol);
    ambient.intensity = this.cfg.ambInt;
  }
}
