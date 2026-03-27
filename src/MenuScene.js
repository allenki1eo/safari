/* ─── MenuScene — Animated Safari Sunset Art ─────────────── */
import * as THREE from 'three';

const SILHOUETTE = 0x0D0603; /* near-black warm brown */
const GROUND_COL = 0x7A4E1A;

function sm() {
  return new THREE.MeshStandardMaterial({ color: SILHOUETTE, roughness: 1, metalness: 0 });
}

/* ─── Animal builders ─────────────────────────────────────── */
function makeElephant(scale = 1) {
  const g = new THREE.Group();
  const mat = sm();

  /* body */
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 1.0 * scale, 0.8 * scale), mat);
  body.position.y = 1.3 * scale;
  g.add(body);

  /* head */
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45 * scale, 12, 10), mat);
  head.position.set(0.95 * scale, 1.9 * scale, 0);
  g.add(head);

  /* trunk — segments drooping down */
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 * scale, 0.08 * scale, 0.38 * scale, 7),
      mat
    );
    seg.position.set((1.35 + i * 0.1) * scale, (1.55 - i * 0.35) * scale, 0);
    seg.rotation.z = 0.3 + i * 0.22;
    g.add(seg);
  }

  /* ears */
  const earGeo = new THREE.EllipseCurve(0, 0, 0.42 * scale, 0.55 * scale, 0, Math.PI * 2);
  const earShape = new THREE.Shape();
  earShape.absellipse(0, 0, 0.42 * scale, 0.55 * scale, 0, Math.PI * 2);
  const ear = new THREE.Mesh(new THREE.ShapeGeometry(earShape), mat);
  ear.position.set(0.5 * scale, 1.85 * scale, 0.42 * scale);
  g.add(ear);

  /* tusk */
  const tusk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05 * scale, 0.03 * scale, 0.55 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0x2A1E10, roughness: 1 })
  );
  tusk.rotation.z = 1.1;
  tusk.position.set(1.35 * scale, 1.45 * scale, 0.16 * scale);
  g.add(tusk);

  /* 4 legs */
  const legH = 0.85 * scale;
  const legGeo = new THREE.CylinderGeometry(0.15 * scale, 0.18 * scale, legH, 8);
  for (let lx = -0.45; lx <= 0.45; lx += 0.9) {
    for (let lz = -0.22; lz <= 0.22; lz += 0.44) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(lx * scale, legH / 2, lz * scale);
      g.add(leg);
    }
  }

  /* tail */
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04 * scale, 0.02 * scale, 0.5 * scale, 6),
    mat
  );
  tail.rotation.z = -0.6;
  tail.position.set(-0.95 * scale, 1.4 * scale, 0);
  g.add(tail);

  return g;
}

function makeGiraffe(scale = 1) {
  const g = new THREE.Group();
  const mat = sm();

  /* body */
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.7 * scale, 0.55 * scale), mat);
  body.position.y = 2.0 * scale;
  g.add(body);

  /* long neck */
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * scale, 0.18 * scale, 2.1 * scale, 8),
    mat
  );
  neck.position.set(0.3 * scale, 3.3 * scale, 0);
  neck.rotation.z = 0.12;
  g.add(neck);

  /* head */
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45 * scale, 0.28 * scale, 0.28 * scale), mat);
  head.position.set(0.5 * scale, 4.52 * scale, 0);
  g.add(head);

  /* ossicones (horns) */
  for (let ox of [-0.1, 0.1]) {
    const horn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025 * scale, 0.04 * scale, 0.25 * scale, 5),
      mat
    );
    horn.position.set(0.38 * scale, 4.78 * scale, ox * scale);
    g.add(horn);
  }

  /* 4 long legs */
  const legH = 1.85 * scale;
  const legGeo = new THREE.CylinderGeometry(0.09 * scale, 0.07 * scale, legH, 7);
  for (let lx = -0.28; lx <= 0.28; lx += 0.56) {
    for (let lz = -0.17; lz <= 0.17; lz += 0.34) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(lx * scale, legH / 2, lz * scale);
      g.add(leg);
    }
  }

  /* tail */
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03 * scale, 0.01 * scale, 0.6 * scale, 5),
    mat
  );
  tail.rotation.z = -0.5;
  tail.position.set(-0.55 * scale, 1.9 * scale, 0);
  g.add(tail);

  return g;
}

function makeWildebeest(scale = 1) {
  const g = new THREE.Group();
  const mat = sm();

  /* body */
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0 * scale, 0.65 * scale, 0.5 * scale), mat);
  body.position.y = 1.15 * scale;
  g.add(body);

  /* shaggy head */
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 10, 8), mat);
  head.scale.set(1.2, 0.9, 1.0);
  head.position.set(0.62 * scale, 1.5 * scale, 0);
  g.add(head);

  /* horns */
  for (let hz = -0.14; hz <= 0.14; hz += 0.28) {
    const horn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04 * scale, 0.02 * scale, 0.35 * scale, 5),
      mat
    );
    horn.position.set(0.55 * scale, 1.88 * scale, hz * scale);
    horn.rotation.z = 0.5;
    horn.rotation.x = hz > 0 ? -0.4 : 0.4;
    g.add(horn);
  }

  /* beard */
  const beard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * scale, 0.04 * scale, 0.28 * scale, 6),
    mat
  );
  beard.position.set(0.75 * scale, 1.2 * scale, 0);
  g.add(beard);

  /* 4 legs */
  const legH = 0.9 * scale;
  const legGeo = new THREE.CylinderGeometry(0.08 * scale, 0.07 * scale, legH, 7);
  for (let lx = -0.3; lx <= 0.3; lx += 0.6) {
    for (let lz = -0.14; lz <= 0.14; lz += 0.28) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(lx * scale, legH / 2, lz * scale);
      g.add(leg);
    }
  }

  /* tail */
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03 * scale, 0.01 * scale, 0.4 * scale, 5),
    mat
  );
  tail.rotation.z = -0.7;
  tail.position.set(-0.62 * scale, 1.2 * scale, 0);
  g.add(tail);

  return g;
}

function makeAcacia(scale = 1) {
  const g   = new THREE.Group();
  const mat = sm();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07 * scale, 0.11 * scale, 1.8 * scale, 7),
    mat
  );
  trunk.position.y = 0.9 * scale;
  g.add(trunk);

  /* umbrella canopy */
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.1 * scale, 12, 6),
    mat
  );
  canopy.scale.set(1.8, 0.55, 1.5);
  canopy.position.y = 2.2 * scale;
  g.add(canopy);

  return g;
}

/* ─── MenuScene class ─────────────────────────────────────── */
export class MenuScene {
  constructor(scene) {
    this.scene   = scene;
    this._meshes = [];
    this._herd   = [];
    this.time    = 0;

    this._buildSky();
    this._buildGround();
    this._buildSun();
    this._buildTrees();
    this._buildHerd();
    this._buildDust();
    this._buildStars();
  }

  /* ─── Sky ───────────────────────────────────────────────── */
  _buildSky() {
    const geo = new THREE.SphereGeometry(260, 32, 16);
    const pos = geo.attributes.position;
    const col = [];
    const deep   = new THREE.Color(0x1A0A30);  /* zenith — deep indigo */
    const mid    = new THREE.Color(0xCC4400);  /* mid — burnt orange */
    const horiz  = new THREE.Color(0xFF8C00);  /* horizon — amber */

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = THREE.MathUtils.clamp((y + 40) / 200, 0, 1);
      let c;
      if (t < 0.3) {
        c = horiz.clone().lerp(mid, t / 0.3);
      } else {
        c = mid.clone().lerp(deep, (t - 0.3) / 0.7);
      }
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    this._add(new THREE.Mesh(geo, mat));
  }

  /* ─── Ground ────────────────────────────────────────────── */
  _buildGround() {
    const mat = new THREE.MeshStandardMaterial({ color: GROUND_COL, roughness: 0.97 });
    const g   = new THREE.Mesh(new THREE.PlaneGeometry(600, 80), mat);
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.01;
    g.receiveShadow = true;
    this._add(g);

    /* darker near-ground strip */
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 4),
      new THREE.MeshStandardMaterial({ color: 0x3D2200, roughness: 1 })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.005, 4);
    this._add(strip);
  }

  /* ─── Sun ───────────────────────────────────────────────── */
  _buildSun() {
    /* Glow ring */
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(14, 32),
      new THREE.MeshBasicMaterial({ color: 0xFFCC44, transparent: true, opacity: 0.18, fog: false, depthWrite: false })
    );
    glow.position.set(35, 10, -80);
    this._add(glow);

    /* Inner sun */
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(7, 32),
      new THREE.MeshBasicMaterial({ color: 0xFF6B00, fog: false })
    );
    sun.position.set(35, 10, -80.1);
    this._add(sun);

    /* Bright core */
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(4, 32),
      new THREE.MeshBasicMaterial({ color: 0xFFE060, fog: false })
    );
    core.position.set(35, 10, -80.05);
    this._add(core);
  }

  /* ─── Acacia silhouettes ────────────────────────────────── */
  _buildTrees() {
    const positions = [
      [-50, 0, -22, 1.8], [-20, 0, -18, 1.4], [10, 0, -26, 2.0],
      [40, 0, -20, 1.6],  [65, 0, -24, 1.2],  [-70, 0, -15, 1.5],
      [28, 0, -14, 1.1],  [-38, 0, -30, 2.2],
    ];
    for (const [x, y, z, s] of positions) {
      const tree = makeAcacia(s);
      tree.position.set(x, y, z);
      this._add(tree);
    }
  }

  /* ─── Animal herd ───────────────────────────────────────── */
  _buildHerd() {
    const specs = [
      /* [factory, scale, x, z, speed, phase] */
      [makeElephant,    1.0,  20,  -4, 2.5, 0.0],
      [makeElephant,    0.85, 14,  -3, 2.8, 1.0],
      [makeElephant,    1.1, -8,   -5, 2.3, 2.2],
      [makeGiraffe,     1.0,  50,  -2, 3.5, 0.5],
      [makeGiraffe,     0.9,  60,  -6, 3.2, 1.8],
      [makeWildebeest,  0.9,  35,  -1, 5.5, 0.0],
      [makeWildebeest,  0.85, 28,  -2, 5.8, 0.7],
      [makeWildebeest,  1.0,  42,   0, 5.2, 1.4],
      [makeWildebeest,  0.8,  55,  -1, 6.0, 2.1],
      [makeWildebeest,  0.95,-12,  -2, 5.6, 2.8],
    ];

    for (const [fn, s, x, z, speed, phase] of specs) {
      const grp = fn(s);
      grp.position.set(x, 0, z);
      this.scene.add(grp);
      this._herd.push({ grp, speed, phase, baseX: x, origX: x });
    }
  }

  /* ─── Dust particles ────────────────────────────────────── */
  _buildDust() {
    const count = 280;
    const pos   = new Float32Array(count * 3);
    const col   = new Float32Array(count * 3);
    const amber = new THREE.Color(0xCC7722);

    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 120;
      pos[i*3+1] = Math.random() * 4.5;
      pos[i*3+2] = (Math.random() * 8) - 4;
      const c = amber.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.25);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
    this._dust = new THREE.Points(geo,
      new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false })
    );
    this._add(this._dust);
  }

  /* ─── Stars (upper sky) ─────────────────────────────────── */
  _buildStars() {
    const count = 180;
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI * 0.45; /* upper half */
      pos[i*3]   = Math.sin(phi) * Math.cos(theta) * 240;
      pos[i*3+1] = Math.abs(Math.cos(phi)) * 240;
      pos[i*3+2] = Math.sin(phi) * Math.sin(theta) * 240;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this._stars = new THREE.Points(geo,
      new THREE.PointsMaterial({ color: 0xFFE8CC, size: 0.6, transparent: true, opacity: 0.7, fog: false, depthWrite: false })
    );
    this._add(this._stars);
  }

  /* ─── Update ────────────────────────────────────────────── */
  update(dt, camera) {
    this.time += dt;
    const t = this.time;

    /* Scroll herd left, loop back on right */
    for (const a of this._herd) {
      a.grp.position.x -= a.speed * dt;

      /* Walking bob */
      a.grp.position.y = Math.abs(Math.sin(t * a.speed * 1.5 + a.phase)) * 0.04;

      /* Loop */
      if (a.grp.position.x < -90) {
        a.grp.position.x = 95 + Math.random() * 20;
      }
    }

    /* Dust drift */
    if (this._dust) {
      const pos = this._dust.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) - 1.8 * dt);
        pos.setY(i, pos.getY(i) + Math.sin(t * 0.7 + i) * 0.003);
        if (pos.getX(i) < -60) pos.setX(i, pos.getX(i) + 120);
      }
      pos.needsUpdate = true;
    }

    /* Twinkling stars */
    if (this._stars) {
      this._stars.material.opacity = 0.5 + Math.sin(t * 0.4) * 0.2;
    }

    /* Gentle camera drift — slow pan */
    if (camera) {
      camera.position.x = Math.sin(t * 0.05) * 3;
      camera.position.y = 3.5 + Math.sin(t * 0.12) * 0.4;
      camera.position.z = 16;
      camera.lookAt(new THREE.Vector3(Math.sin(t * 0.04) * 2, 3.5, -10));
    }
  }

  /* ─── Dispose ───────────────────────────────────────────── */
  dispose() {
    for (const m of this._meshes) {
      this.scene.remove(m);
      m.geometry?.dispose();
      if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
      else m.material?.dispose();
    }
    for (const a of this._herd) {
      this.scene.remove(a.grp);
      a.grp.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
    }
    this._meshes = [];
    this._herd   = [];
  }

  _add(m) {
    this.scene.add(m);
    this._meshes.push(m);
  }
}
