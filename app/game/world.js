import * as THREE from 'three';
import { bend, mat, G, mesh, bakeRigid } from './materials.js';
import {
  Animals, makeAcacia, makeBaobab, makeKopje, makeTermiteMound, makeGrass, makeBush, makeKilimanjaro,
} from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
const C = (h) => new THREE.Color(h);

export const LANE_W = 2.4;
export const SEG_LEN = 24;
const SEG_COUNT = 9;

/* ---------------------------------------------------------------- palettes */
// Times of day keyed by distance — the story's chapters ride the sun across the sky.
const CYCLE = 7600;
const PALETTES = [
  { at: 0, top: '#4f9be0', hor: '#ffe2ac', fog: '#f5d9a6', sun: '#fff1d2', sunI: 2.4, hemiS: '#f4ead8', hemiG: '#b08a4a', hemiI: 1.25, sunH: 0.42, night: 0, hill: '#c9a86a', cloud: '#ffffff' },
  { at: 1100, top: '#3f8ad6', hor: '#ffe7b8', fog: '#f7deaf', sun: '#fff4dc', sunI: 2.6, hemiS: '#f6eedf', hemiG: '#b8924e', hemiI: 1.3, sunH: 0.75, night: 0, hill: '#c4a564', cloud: '#ffffff' },
  { at: 1900, top: '#4b5aa8', hor: '#ffb070', fog: '#f4b47a', sun: '#ffb46a', sunI: 2.2, hemiS: '#ffd0a8', hemiG: '#a0663a', hemiI: 1.1, sunH: 0.16, night: 0, hill: '#b98450', cloud: '#ffd2b0' },
  { at: 2600, top: '#2a2a6e', hor: '#ff7a45', fog: '#e8805a', sun: '#ff8040', sunI: 1.6, hemiS: '#ff9a7a', hemiG: '#6a3a2a', hemiI: 0.95, sunH: 0.04, night: 0.15, hill: '#8a4a3a', cloud: '#ff9a7a' },
  { at: 3200, top: '#070b26', hor: '#26306e', fog: '#1d2558', sun: '#a9bcff', sunI: 0.9, hemiS: '#6a7ad0', hemiG: '#1e1a30', hemiI: 0.75, sunH: 0.5, night: 1, hill: '#1c2148', cloud: '#3a4278' },
  { at: 4300, top: '#0b1030', hor: '#2c3070', fog: '#232a60', sun: '#b4c4ff', sunI: 0.9, hemiS: '#7080d8', hemiG: '#221c34', hemiI: 0.8, sunH: 0.4, night: 1, hill: '#20254e', cloud: '#3e4680' },
  { at: 5000, top: '#5a58a8', hor: '#ffad8a', fog: '#e9a68e', sun: '#ffc09a', sunI: 1.7, hemiS: '#ffc8c0', hemiG: '#7a5a52', hemiI: 1.0, sunH: 0.08, night: 0.1, hill: '#a87a6a', cloud: '#ffd0c8' },
  { at: 6000, top: '#5aa2e2', hor: '#ffdcb0', fog: '#f2d4a8', sun: '#fff0d0', sunI: 2.3, hemiS: '#f2e9d8', hemiG: '#ad8a4c', hemiI: 1.2, sunH: 0.3, night: 0, hill: '#c6a66a', cloud: '#ffffff' },
  { at: CYCLE, top: '#4f9be0', hor: '#ffe2ac', fog: '#f5d9a6', sun: '#fff1d2', sunI: 2.4, hemiS: '#f4ead8', hemiG: '#b08a4a', hemiI: 1.25, sunH: 0.42, night: 0, hill: '#c9a86a', cloud: '#ffffff' },
].map((p) => ({ ...p, top: C(p.top), hor: C(p.hor), fog: C(p.fog), sun: C(p.sun), hemiS: C(p.hemiS), hemiG: C(p.hemiG), hill: C(p.hill), cloud: C(p.cloud) }));

const smooth = (t) => t * t * (3 - 2 * t);

/* ---------------------------------------------------------------- sky */
const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }`;
const skyFrag = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uFog; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uNight;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHor, uTop, pow(smoothstep(-0.02, 0.55, h), 0.75));
    col = mix(col, uFog, smoothstep(0.03, -0.06, h));
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    float disc = smoothstep(0.9985 - uNight * 0.0004, 0.9993, sd);
    col += uSun * (disc * 1.6 + pow(sd, 18.0) * 0.32 * (1.0 - uNight * 0.6) + pow(sd, 4.0) * 0.12);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.palette = { ...PALETTES[0], top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), hill: new THREE.Color(), cloud: new THREE.Color() };

    scene.fog = new THREE.Fog(0xf5d9a6, 45, 175);

    // Lights
    this.hemi = new THREE.HemisphereLight(0xd6ecff, 0xb08a4a, 1.2);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(-30, 40, -20);
    scene.add(this.sun);

    this.buildSky();
    this.buildBackdrop();
    this.buildGround();
    this.buildScenery();
    this.buildHerds();
    this.buildFireflies();
    this.setTime(0);
  }

  /* ------------------------------------------------------------------ sky */
  buildSky() {
    this.skyUniforms = {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
      uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(-0.3, 0.4, -1) }, uNight: { value: 0 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.sky = sky;
    this.scene.add(sky);

    // Stars
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(rand(0.04, 1));
      pos.set([Math.sin(v) * Math.cos(u) * 800, Math.cos(v) * 800, Math.sin(v) * Math.sin(u) * 800], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.renderOrder = -9;
    this.scene.add(this.stars);

    // Clouds
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false, flatShading: true, emissive: 0x444444 });
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      const parts = 4 + ((Math.random() * 3) | 0);
      for (let j = 0; j < parts; j++) {
        const s = rand(9, 16);
        c.add(mesh(G.ico1, this.cloudMat, s * 1.4, s * 0.7, s, j * 13 - parts * 6, rand(-2, 4), rand(-5, 5)));
      }
      c.position.set(rand(-500, 500), rand(90, 160), rand(-650, -350));
      c.userData.v = rand(1.5, 4);
      bakeRigid(c);
      this.clouds.push(c);
      this.scene.add(c);
    }
  }

  /* ------------------------------------------------------------- backdrop */
  buildBackdrop() {
    this.mtnMat = new THREE.MeshLambertMaterial({ color: 0x8a90b0, flatShading: true, fog: false });
    this.snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false, emissive: 0x333344 });
    const kili = makeKilimanjaro(this.mtnMat, this.snowMat);
    kili.position.set(-260, -26, -720);
    kili.scale.set(1.25, 0.95, 1);
    this.kili = kili;
    this.scene.add(kili);

    // Rolling horizon hills fill the haze band between the curved ground and the sky.
    this.hillMat = new THREE.MeshLambertMaterial({ color: 0xc9a86a, flatShading: true, fog: false });
    this.hillMat2 = new THREE.MeshLambertMaterial({ color: 0xc9a86a, flatShading: true, fog: false });
    this.hills = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 0.9;
      const r = rand(330, 380);
      const h = mesh(G.ico1, i % 2 ? this.hillMat : this.hillMat2, rand(60, 120), rand(28, 50), rand(40, 60), Math.cos(a) * r, -38, Math.sin(a) * r);
      h.rotation.y = -a;
      this.hills.add(h);
    }
    // flat-topped acacia silhouettes on the horizon
    this.silMat = new THREE.MeshBasicMaterial({ color: 0x6a5a3a, fog: false });
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * 0.85 + rand(0, Math.PI * 0.7);
      const r = rand(300, 320);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = rand(-2, 1);
      this.hills.add(mesh(G.cyl, this.silMat, 0.6, 9, 0.6, x, y + 4.5, z));
      this.hills.add(mesh(G.ico1, this.silMat, rand(8, 11), 1.6, rand(6, 8), x, y + 9.5, z));
    }
    bakeRigid(this.hills);
    this.scene.add(this.hills);
  }

  /* --------------------------------------------------------------- ground */
  buildGround() {
    const grassGeo = new THREE.PlaneGeometry(220, SEG_LEN, 22, 4);
    grassGeo.rotateX(-Math.PI / 2);
    const gc = [];
    const base = [C('#d6b25a'), C('#c9a24c'), C('#dcbc66'), C('#bfa04e'), C('#b9a556')];
    const p = grassGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // deterministic noise keyed on x and *edge-safe* z so tiles stitch seamlessly
      const n = Math.sin(x * 0.37) * 0.5 + Math.sin(x * 0.11 + (Math.abs(z) > SEG_LEN / 2 - 0.1 ? 0 : z * 0.3)) * 0.5;
      const c = base[Math.floor((n * 0.5 + 0.5) * (base.length - 0.01))].clone();
      if (Math.abs(x) < 6) c.lerp(C('#b98a4e'), 0.5);
      gc.push(c.r, c.g, c.b);
      p.setY(i, Math.abs(x) > 14 ? Math.sin(x * 0.2) * 0.4 : 0);
    }
    grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
    grassGeo.computeVertexNormals();
    const grassMat = bend(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));

    const pathMat = mat(0xc28c55);
    const rutMat = mat(0xa9773f);
    const edgeMat = mat(0xd2a066);

    this.segments = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(grassGeo, grassMat));
      g.add(mesh(G.box, pathMat, LANE_W * 3 + 0.9, 0.05, SEG_LEN, 0, 0.0, 0));
      for (let l = -1; l <= 1; l++) g.add(mesh(G.box, rutMat, 1.3, 0.05, SEG_LEN, l * LANE_W, 0.012, 0));
      for (const s of [-1, 1]) g.add(mesh(G.box, edgeMat, 0.5, 0.07, SEG_LEN, s * (LANE_W * 1.5 + 0.55), 0.0, 0));
      // little pebbles & tufts along the path edge
      for (let k = 0; k < 6; k++) {
        const s = Math.random() < 0.5 ? -1 : 1;
        const peb = mesh(G.dodec, mat(0x9c8a78), rand(0.1, 0.22), rand(0.08, 0.15), rand(0.1, 0.2), s * rand(4.1, 5.2), 0.06, rand(-SEG_LEN / 2, SEG_LEN / 2));
        g.add(peb);
      }
      for (let k = 0; k < 7; k++) {
        const patch = mesh(G.cyl6, mat(Math.random() < 0.5 ? 0xb8834e : 0xc9955e), rand(0.25, 0.6), 0.02, rand(0.4, 0.9), rand(-3.8, 3.8), 0.03, rand(-SEG_LEN / 2, SEG_LEN / 2));
        patch.rotation.y = rand(0, 3);
        g.add(patch);
      }
      for (let k = 0; k < 5; k++) {
        const s = Math.random() < 0.5 ? -1 : 1;
        g.add(makeGrass(rand(0.6, 1)).translateX(s * rand(4.6, 7)).translateZ(rand(-SEG_LEN / 2, SEG_LEN / 2)));
      }
      bakeRigid(g, true);
      g.userData.wz = (i - 1) * SEG_LEN;
      this.segments.push(g);
      this.scene.add(g);
    }
  }

  /* ------------------------------------------------------------- scenery */
  buildScenery() {
    this.props = [];
    const add = (factory, count, xMin, xMax, small = false) => {
      for (let i = 0; i < count; i++) {
        const obj = bakeRigid(factory(), true);
        obj.userData.cull = small ? -100 : -180;
        obj.userData.xr = [xMin, xMax];
        obj.userData.wz = rand(-10, 220);
        obj.position.x = (Math.random() < 0.5 ? -1 : 1) * rand(xMin, xMax);
        obj.rotation.y = rand(0, Math.PI * 2);
        this.props.push(obj);
        this.scene.add(obj);
      }
    };
    add(() => makeAcacia(rand(0.9, 1.3)), 16, 9, 34);
    add(() => makeBaobab(rand(0.9, 1.3)), 5, 12, 40);
    add(() => makeKopje(rand(1, 1.8)), 5, 22, 55);
    add(() => makeTermiteMound(rand(0.8, 1.2)), 8, 6.5, 18);
    add(() => makeBush(rand(0.8, 1.4)), 16, 6, 26, true);
    add(() => makeGrass(rand(1, 1.8)), 30, 5.5, 30, true);
  }

  buildHerds() {
    this.herd = [];
    const spawn = (kind, count, xMin, xMax, mode) => {
      for (let i = 0; i < count; i++) {
        const a = Animals[kind]();
        a.root.userData = { wz: rand(20, 230), xr: [xMin, xMax], mode, kind, walkV: rand(0.6, 1.4), dir: 1 };
        a.root.position.x = (Math.random() < 0.5 ? -1 : 1) * rand(xMin, xMax);
        this.face(a);
        if (mode !== 'walk') a.root.rotation.y = rand(0, Math.PI * 2);
        this.herd.push(a);
        this.scene.add(a.root);
      }
    };
    spawn('zebra', 3, 12, 30, 'walk');
    spawn('giraffe', 2, 16, 36, 'walk');
    spawn('elephant', 2, 24, 44, 'walk');
    spawn('wildebeest', 2, 14, 34, 'idle');
  }

  /** Point a walking animal along the plain, heading away from the track first. */
  face(a) {
    const u = a.root.userData;
    u.dir = Math.sign(a.root.position.x) || 1;
    a.root.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  buildFireflies() {
    const n = 120;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([rand(-25, 25), rand(0.3, 4), rand(-80, 10)], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.fireflyMat = new THREE.PointsMaterial({ color: 0xd8ff6a, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    bend(this.fireflyMat);
    this.fireflies = new THREE.Points(g, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
  }

  /* ---------------------------------------------------------------- time */
  setTime(distance) {
    const d = ((distance % CYCLE) + CYCLE) % CYCLE;
    let i = 0;
    while (i < PALETTES.length - 2 && PALETTES[i + 1].at <= d) i++;
    const a = PALETTES[i];
    const b = PALETTES[i + 1];
    const t = smooth(Math.min(1, Math.max(0, (d - a.at) / (b.at - a.at))));
    const P = this.palette;
    for (const k of ['top', 'hor', 'fog', 'sun', 'hemiS', 'hemiG', 'hill', 'cloud']) P[k].copy(a[k]).lerp(b[k], t);
    for (const k of ['sunI', 'hemiI', 'sunH', 'night']) P[k] = a[k] + (b[k] - a[k]) * t;

    this.skyUniforms.uTop.value.copy(P.top);
    this.skyUniforms.uHor.value.copy(P.hor);
    this.skyUniforms.uFog.value.copy(P.fog);
    this.skyUniforms.uSun.value.copy(P.sun);
    this.skyUniforms.uNight.value = P.night;
    // Sun (or moon) arcs low over the left horizon, roughly in front of the runner.
    const sd = this.skyUniforms.uSunDir.value.set(-0.45, P.sunH, -1).normalize();
    this.sun.position.copy(sd).multiplyScalar(60);
    this.sun.color.copy(P.sun);
    this.sun.intensity = P.sunI;
    this.hemi.color.copy(P.hemiS);
    this.hemi.groundColor.copy(P.hemiG);
    this.hemi.intensity = P.hemiI;
    this.scene.fog.color.copy(P.fog);
    this.starMat.opacity = P.night;
    this.fireflyMat.opacity = P.night * 0.9;
    this.hillMat.color.copy(P.fog).lerp(P.hill, 0.55);
    this.hillMat2.color.copy(P.fog).lerp(P.hill, 0.4);
    this.silMat.color.copy(P.fog).lerp(P.hill, 0.9).multiplyScalar(0.7);
    this.mtnMat.color.copy(P.fog).lerp(C('#6a6fa0'), 0.5);
    this.snowMat.color.copy(P.sun).lerp(C('#ffffff'), 0.5);
    this.cloudMat.color.copy(P.cloud);
    this.cloudMat.emissive.copy(P.cloud).multiplyScalar(0.35);
    return P;
  }

  /* -------------------------------------------------------------- update */
  update(dt, D, camera, time) {
    // Sky follows the camera so it never clips.
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);

    for (const seg of this.segments) {
      if (seg.userData.wz + SEG_LEN < D - 16) seg.userData.wz += SEG_LEN * SEG_COUNT;
      seg.position.z = D - seg.userData.wz - SEG_LEN / 2;
    }

    for (const p of this.props) {
      p.visible = p.position.z > p.userData.cull;
      if (p.userData.wz < D - 20) {
        p.userData.wz = D + rand(170, 240);
        const [a, b] = p.userData.xr;
        p.position.x = (Math.random() < 0.5 ? -1 : 1) * rand(a, b);
        p.rotation.y = rand(0, Math.PI * 2);
      }
      p.position.z = D - p.userData.wz;
    }

    for (const a of this.herd) {
      const u = a.root.userData;
      if (u.wz < D - 25) {
        u.wz = D + rand(180, 260);
        const side = Math.random() < 0.5 ? -1 : 1;
        a.root.position.x = side * rand(u.xr[0], u.xr[1]);
        if (u.mode === 'walk') this.face(a);
      }
      if (u.mode === 'walk') {
        // amble across the plain, turning back before reaching the track
        a.root.position.x += u.dir * u.walkV * dt;
        const ax = Math.abs(a.root.position.x);
        const outward = Math.sign(a.root.position.x) === u.dir;
        if ((ax < u.xr[0] && !outward) || (ax > u.xr[1] + 6 && outward)) {
          u.dir *= -1;
          a.root.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
      a.root.position.z = D - u.wz;
      a.root.visible = a.root.position.z > -175 && a.root.position.z < 12;
      if (a.root.visible && a.root.position.z > -120) a.update(dt, 1, u.mode);
    }

    for (const c of this.clouds) {
      c.position.x += c.userData.v * dt;
      if (c.position.x > 600) c.position.x = -600;
    }

    if (this.palette.night > 0.01) {
      const pos = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + dt * 6;
        if (z > 12) z -= 95;
        pos.setZ(i, z);
        pos.setY(i, pos.getY(i) + Math.sin(time * 2 + i) * dt * 0.4);
      }
      pos.needsUpdate = true;
    }
  }
}

/* ======================================================================
 * Particles — a single instanced mesh for dust, sparkles and debris.
 * ====================================================================== */
export class Particles {
  constructor(scene, max = 260) {
    this.max = max;
    const m = bend(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    this.mesh = new THREE.InstancedMesh(G.ico, m, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.p = [];
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.mesh.setColorAt(0, this.color);
    scene.add(this.mesh);
  }

  emit(x, y, z, o = {}) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({
      x, y, z,
      vx: o.vx ?? rand(-1, 1), vy: o.vy ?? rand(0.5, 2), vz: o.vz ?? rand(-1, 1),
      life: 0, max: o.life ?? 0.6, size: o.size ?? 0.15, g: o.g ?? 0,
      color: o.color ?? 0xffffff, spin: rand(-6, 6), world: o.world ?? true, grow: o.grow ?? 0,
    });
  }

  dust(x, z, color = 0xd9b07a, n = 3) {
    for (let i = 0; i < n; i++) this.emit(x + rand(-0.3, 0.3), 0.08, z + rand(0, 0.3), { vx: rand(-0.6, 0.6), vy: rand(0.2, 0.8), vz: rand(1.5, 3), life: rand(0.2, 0.32), size: rand(0.05, 0.09), color, grow: 0.25, world: false });
  }
  sparkle(x, y, z, color = 0xffd34d, n = 8) {
    for (let i = 0; i < n; i++) this.emit(x, y, z, { vx: rand(-3, 3), vy: rand(-1, 4), vz: rand(-3, 3), life: rand(0.25, 0.5), size: rand(0.06, 0.13), color, g: 4 });
  }
  debris(x, y, z, colors, n = 18) {
    for (let i = 0; i < n; i++) this.emit(x + rand(-0.8, 0.8), y + rand(0, 1.5), z, { vx: rand(-6, 6), vy: rand(3, 10), vz: rand(-8, -2), life: rand(0.6, 1.1), size: rand(0.12, 0.32), color: colors[i % colors.length], g: 22 });
  }

  update(dt, scroll) {
    const d = this.dummy;
    let n = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life += dt;
      if (q.life >= q.max) {
        this.p.splice(i, 1);
        continue;
      }
      q.vy -= q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt + (q.world ? scroll : 0);
      if (q.y < 0.02 && q.g > 0) {
        q.y = 0.02;
        q.vy *= -0.3;
        q.vx *= 0.6;
      }
      const k = 1 - q.life / q.max;
      d.position.set(q.x, q.y, q.z);
      d.rotation.set(q.life * q.spin, q.life * q.spin * 0.7, 0);
      d.scale.setScalar(q.size * (q.grow ? 1 + (1 - k) * q.grow * 3 : k));
      d.updateMatrix();
      this.mesh.setMatrixAt(n, d.matrix);
      this.mesh.setColorAt(n, this.color.set(q.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
