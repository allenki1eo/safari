/* ─── MenuScene — Animated Safari Sunset Art ─────────────── */
import * as THREE from 'three';
import { loadModel } from './Level.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const GROUND_COL = 0x7A4E1A;

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
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      this._add(grp);

      const treeModel = Math.random() > 0.5 ? 'src/assets/nature/CommonTree_1.gltf' : 'src/assets/nature/DeadTree_1.gltf';
      loadModel(treeModel, gltf => {
         const mesh = gltf.scene.clone();
         const box = new THREE.Box3().setFromObject(mesh);
         mesh.scale.setScalar((4.5 * s) / box.getSize(new THREE.Vector3()).y);
         mesh.traverse(c => {
             if (c.isMesh) c.castShadow = true;
         });
         grp.add(mesh);
      });
    }
  }

  /* ─── Animal herd ───────────────────────────────────────── */
  _buildHerd() {
    const specs = [
      ['src/assets/animals/Bull.gltf',     1.0,  50,  -2, 3.5, 0.5],
      ['src/assets/animals/Bull.gltf',     0.9,  60,  -6, 3.2, 1.8],
      ['src/assets/animals/Bull.gltf',     1.1,  35,  -1, 3.4, 0.0],
      ['src/assets/animals/Stag.gltf',     0.85, 28,  -2, 5.8, 0.7],
      ['src/assets/animals/Stag.gltf',     1.0,  42,   0, 5.2, 1.4],
      ['src/assets/animals/Stag.gltf',     0.8,  55,  -1, 6.0, 2.1],
      ['src/assets/animals/Deer.gltf',     1.1, -8,   -5, 4.3, 2.2],
      ['src/assets/animals/Horse.gltf',    1.0,  20,  -4, 4.5, 0.0],
      ['src/assets/animals/Horse.gltf',    0.85, 14,  -3, 4.8, 1.0],
      ['src/assets/animals/Wolf.gltf',     0.95,-12,  -2, 6.6, 2.8],
    ];

    for (const [path, s, x, z, speed, phase] of specs) {
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);
      this.scene.add(grp);
      this._herd.push({ grp, speed, phase, baseX: x, origX: x });

      loadModel(path, gltf => {
          const mesh = SkeletonUtils.clone(gltf.scene);
          if (gltf.animations) {
              const mixer = new THREE.AnimationMixer(mesh);
              const clip = gltf.animations.find(a => a.name==='Run' || a.name==='Gallop' || a.name==='Walk') || gltf.animations[0];
              mixer.clipAction(clip).play();
              grp.userData.mixer = mixer;
          }
          const box = new THREE.Box3().setFromObject(mesh);
          mesh.scale.setScalar((1.5 * s) / box.getSize(new THREE.Vector3()).y);
          mesh.rotation.y = -Math.PI / 2;
          mesh.traverse(c => { if (c.isMesh) c.castShadow = true; });
          grp.add(mesh);
      });
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

      if (a.grp.userData.mixer) {
        a.grp.userData.mixer.update(dt * (a.speed / 3));
      }

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

    /* Gentle camera drift — cinematic low pan */
    if (camera) {
      camera.position.x = Math.sin(t * 0.03) * 5;
      camera.position.y = 1.2 + Math.sin(t * 0.08) * 0.4;
      camera.position.z = 10;
      camera.lookAt(new THREE.Vector3(Math.sin(t * 0.02) * 3, 3.5, -15));
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
