import * as THREE from 'three';
import { bend, mat, G, mesh, bakeRigid, finishProp, pathTexture, grassTexture, waterMaterial, SWAY_EXT, GROUND_LIGHT, setBlobStrength } from './materials.js';
import {
  Animals, makeAcacia, makeBaobab, makeKopje, makeTermiteMound, makeGrass, makeBush, makeKilimanjaro,
} from './models.js';
import {
  RegionAnimals, makeFeverTree, makeGroundsel, makeLobelia, makeMontane, makeSnowRock, makePalm, makeDoum,
  makePapyrus, makeHut, makeStoneHouse, makeBanana, makeJungleTree, makeFern, makeTreeFern, makeFlowers, makeDhow,
  makeNgalawa, makeBanda, makeParasol, makeMangrove, makeCoralRock, makeSeaweedFarm, makeFishRack, makeLighthouse,
} from './regionModels.js';
import { darDay } from '../data/daily.js';
import { HERD_STEP, MODE_SPEED, ROAMERS, herdCursor, nextMode, planHerd } from './layout.js';
import { REGIONS, regionIndexAt, PROP_TYPES, JOURNEY_LEN } from '../data/regions.js';

const rand = (a, b) => a + Math.random() * (b - a);
const C = (h) => new THREE.Color(h);
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export const LANE_W = 2.4;
export const SEG_LEN = 24;
const SEG_COUNT = 9;
const AHEAD = 235;
const BLEND = 70; // metres over which one region melts into the next

/* ---------------------------------------------------------------- palettes */
// Time of day is keyed to journey distance, so the sun sets somewhere around Kilimanjaro.
const CYCLE = JOURNEY_LEN; // one full journey = one day, so every lap looks the same
const DAY = { top: '#4f9be0', hor: '#ffe2ac', fog: '#f5d9a6', sun: '#fff1d2', sunI: 2.4, hemiS: '#f4ead8', hemiG: '#b08a4a', hemiI: 1.25, sunH: 0.42, night: 0, cloud: '#ffffff' };
const NOON = { top: '#3f8ad6', hor: '#ffe7b8', fog: '#f7deaf', sun: '#fff4dc', sunI: 2.6, hemiS: '#f6eedf', hemiG: '#b8924e', hemiI: 1.3, sunH: 0.75, night: 0, cloud: '#ffffff' };
const GOLD = { top: '#4b5aa8', hor: '#ffb070', fog: '#f4b47a', sun: '#ffb46a', sunI: 2.2, hemiS: '#ffd0a8', hemiG: '#a0663a', hemiI: 1.1, sunH: 0.16, night: 0, cloud: '#ffd2b0' };
const DUSK = { top: '#2a2a6e', hor: '#ff7a45', fog: '#e8805a', sun: '#ff8040', sunI: 1.6, hemiS: '#ff9a7a', hemiG: '#6a3a2a', hemiI: 0.95, sunH: 0.04, night: 0.15, cloud: '#ff9a7a' };
const NIGHT = { top: '#070b26', hor: '#26306e', fog: '#1d2558', sun: '#a9bcff', sunI: 0.9, hemiS: '#6a7ad0', hemiG: '#1e1a30', hemiI: 0.75, sunH: 0.5, night: 1, cloud: '#3a4278' };
const BRIGHT = { top: '#3a95e6', hor: '#e8f4ff', fog: '#f2efe2', sun: '#fff6e0', sunI: 2.6, hemiS: '#f2f6ff', hemiG: '#c9b48a', hemiI: 1.35, sunH: 0.8, night: 0, cloud: '#ffffff' };
// Serengeti morning → crater noon → bright lakeshore → baobab afternoon → Kili sunset → dusk
// in Ruaha → Rufiji night → Zanzibar in full daylight → Mara day → golden Amboseli → soft misty
// Bwindi → morning again. Keyed to regions (`at(id, metres in)`) so adding one keeps the light.
// The coast starts bright on purpose: a night-to-dawn fade here turned the beach into fog.
const at = (id, m = 0) => REGIONS.find((r) => r.id === id).at + m;
const PALETTES = [
  { at: 0, ...DAY }, { at: at('ngorongoro', 200), ...NOON }, { at: at('manyara', 400), ...NOON },
  { at: at('tarangire', 400), ...DAY }, { at: at('kilimanjaro', 250), ...GOLD }, { at: at('ruaha', 350), ...DUSK },
  { at: at('selous', 250), ...NIGHT }, { at: at('selous', 700), ...NIGHT }, { at: at('zanzibar'), ...BRIGHT },
  { at: at('mara', 400), ...NOON }, { at: at('amboseli', 200), ...DAY }, { at: at('amboseli', 550), ...GOLD },
  { at: at('bwindi', 150), ...DAY }, { at: CYCLE, ...DAY },
].map((p) => ({ ...p, top: C(p.top), hor: C(p.hor), fog: C(p.fog), sun: C(p.sun), hemiS: C(p.hemiS), hemiG: C(p.hemiG), cloud: C(p.cloud) }));

/** Sun height and night amount at a journey distance. Used to keep regions in their own light. */
export function daylightAt(J) {
  const { a, b, t } = sampleDay(J);
  return {
    night: a.night + (b.night - a.night) * t,
    sunH: a.sunH + (b.sunH - a.sunH) * t,
  };
}

function sampleDay(J) {
  const d = ((J % CYCLE) + CYCLE) % CYCLE;
  let i = 0;
  while (i < PALETTES.length - 2 && PALETTES[i + 1].at <= d) i++;
  const a = PALETTES[i];
  const b = PALETTES[i + 1];
  const t = smooth(clamp01((d - a.at) / ((b.at - a.at) || 1)));
  return { a, b, t };
}

/* Pre-parsed region colours */
const RC = REGIONS.map((r) => ({
  grass: C(r.ground.grass),
  path: C(r.ground.path),
  water: r.ground.water ? C(r.ground.water) : null,
  hill: C(r.hill),
  fogTint: r.fog ? C(r.fog.tint) : null,
}));

/* ------------------------------------------------------------- prop table */
// factory, |x| range, cull distance (small things vanish sooner)
const PROPS = {
  acacia: [() => makeAcacia(rand(0.9, 1.3)), 9, 34],
  baobab: [() => makeBaobab(rand(0.9, 1.3)), 12, 40],
  kopje: [() => makeKopje(rand(1, 1.8)), 22, 55],
  mound: [() => makeTermiteMound(rand(0.8, 1.2)), 6.5, 18],
  bush: [() => makeBush(rand(0.8, 1.4)), 6, 26, true],
  grass: [() => makeGrass(rand(1, 1.8)), 5.5, 30, true],
  fever: [() => makeFeverTree(rand(0.9, 1.2)), 9, 36],
  groundsel: [() => makeGroundsel(rand(0.9, 1.4)), 6, 28],
  lobelia: [() => makeLobelia(rand(0.9, 1.3)), 5.5, 22, true],
  montane: [() => makeMontane(rand(0.9, 1.3)), 12, 44],
  snowrock: [() => makeSnowRock(rand(0.8, 1.6)), 6, 34],
  palm: [() => makePalm(rand(0.9, 1.3)), 7, 32],
  doum: [() => makeDoum(rand(0.9, 1.3)), 8, 34],
  papyrus: [() => makePapyrus(rand(0.9, 1.3)), 6, 20, true],
  hut: [() => makeHut(rand(0.9, 1.1)), 10, 30],
  stonehouse: [() => makeStoneHouse(1), 9, 22],
  banana: [() => makeBanana(rand(0.9, 1.3)), 6, 20],
  jungle: [() => makeJungleTree(rand(0.9, 1.3)), 7.5, 30],
  fern: [() => makeFern(rand(0.8, 1.5)), 5.5, 18, true],
  treefern: [() => makeTreeFern(rand(0.9, 1.3)), 6, 22],
  flowers: [() => makeFlowers(rand(0.8, 1.3)), 5.5, 22, true],
  dhow: [() => makeDhow(rand(0.9, 1.3)), 24, 70],
  ngalawa: [() => makeNgalawa(rand(0.9, 1.2)), 15, 34],
  banda: [() => makeBanda(rand(0.9, 1.1)), 8, 22],
  parasol: [() => makeParasol(rand(0.9, 1.1)), 6, 16, true],
  mangrove: [() => makeMangrove(rand(0.9, 1.3)), 9, 26],
  coralrock: [() => makeCoralRock(rand(0.8, 1.4)), 5.5, 18, true],
  seaweed: [() => makeSeaweedFarm(1), 15, 26],
  fishrack: [() => makeFishRack(rand(0.9, 1.1)), 6.5, 16, true],
  lighthouse: [() => makeLighthouse(1), 24, 40],
};
// these belong in (or at the edge of) the water
const WET = new Set(['dhow', 'papyrus', 'ngalawa', 'seaweed', 'mangrove']);
const AFLOAT = new Set(['dhow', 'ngalawa']);
for (const t of PROP_TYPES) if (!PROPS[t]) throw new Error(`missing prop factory: ${t}`);
// how far each plant's tips move in the wind (metres)
const SWAY = {
  acacia: 0.22, baobab: 0.06, bush: 0.08, grass: 0.18, fever: 0.28, groundsel: 0.05, lobelia: 0.04, montane: 0.16,
  palm: 0.45, doum: 0.28, papyrus: 0.3, banana: 0.3, jungle: 0.16, fern: 0.14, treefern: 0.22, flowers: 0.1,
  mangrove: 0.12, parasol: 0.04,
};

const HERD = {
  zebra: () => Animals.zebra(),
  giraffe: () => Animals.giraffe(),
  elephant: () => Animals.elephant(),
  wildebeest: () => Animals.wildebeest(),
  lion: () => Animals.lion(),
  rhino: () => Animals.rhino(),
  buffalo: () => RegionAnimals.buffalo(),
  flamingo: () => RegionAnimals.flamingo(),
  hippo: () => RegionAnimals.hippo(),
  dolphin: () => RegionAnimals.dolphin(),
  crab: () => RegionAnimals.crab(),
  gorilla: () => RegionAnimals.gorilla(),
  gazelle: () => Animals.gazelle(),
  warthog: () => Animals.warthog(),
  wilddog: () => Animals.wilddog(),
  elephant_calf: () => Animals.elephantCalf(),
  giraffe_calf: () => Animals.giraffeCalf(),
};

function weighted(list) {
  let total = 0;
  for (const e of list) total += e[e.length - 1];
  let r = Math.random() * total;
  for (const e of list) if ((r -= e[e.length - 1]) <= 0) return e;
  return list[0];
}

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
    const P = {};
    for (const k of ['top', 'hor', 'fog', 'sun', 'hemiS', 'hemiG', 'cloud']) P[k] = new THREE.Color();
    this.palette = P;
    this.blend = { a: 0, b: 0, t: 0, index: 0, lap: 0 };
    this.tmp = new THREE.Color();
    this.tmp2 = new THREE.Color();
    this.tmpV = new THREE.Vector3();
    this.sunDir = new THREE.Vector3(-0.45, 0.4, -1).normalize();

    scene.fog = new THREE.Fog(0xf5d9a6, 45, 175);
    this.hemi = new THREE.HemisphereLight(0xd6ecff, 0xb08a4a, 1.2);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(-30, 40, -20);
    scene.add(this.sun);

    this.buildSky();
    this.buildBackdrop();
    this.buildGround();
    this.buildWeather();
    this.buildBlades();
    this.pools = new Map();
    this.props = [];
    this.herd = [];
    this.day = darDay();
    this.reset(0);
  }

  /** Locks herd layout to one Dar day for the whole run. */
  setDay(day) {
    if (day) this.day = day;
  }

  /* --------------------------------------------------------------- region */
  /** Region blend at journey distance J: a → b with weight t near borders. */
  mixAt(J) {
    const { index, lap, local } = regionIndexAt(J);
    const r = REGIONS[index];
    const next = (index + 1) % REGIONS.length;
    const t = smooth(clamp01((local - (r.len - BLEND)) / BLEND));
    return { a: index, b: next, t, index, lap };
  }

  /** Mixes a per-region colour (from RC) into `out`. */
  mixColor(out, key, m, fallback) {
    const ca = RC[m.a][key] ?? fallback;
    const cb = RC[m.b][key] ?? fallback;
    return out.copy(ca).lerp(cb, m.t);
  }
  mixNum(m, fn) {
    return fn(REGIONS[m.a]) * (1 - m.t) + fn(REGIONS[m.b]) * m.t;
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
    this.kili = makeKilimanjaro(this.mtnMat, this.snowMat);
    this.scene.add(this.kili);

    this.hillMat = new THREE.MeshLambertMaterial({ color: 0xc9a86a, flatShading: true, fog: false });
    this.hillMat2 = new THREE.MeshLambertMaterial({ color: 0xc9a86a, flatShading: true, fog: false });
    this.silMat = new THREE.MeshBasicMaterial({ color: 0x6a5a3a, fog: false });
    // two halves so the ocean side can sink away on the coast
    this.hillsL = new THREE.Group();
    this.hillsR = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 0.9;
      const r = rand(330, 380);
      const h = mesh(G.ico1, i % 2 ? this.hillMat : this.hillMat2, rand(60, 120), rand(28, 50), rand(40, 60), Math.cos(a) * r, -38, Math.sin(a) * r);
      h.rotation.y = -a;
      (Math.cos(a) < 0 ? this.hillsL : this.hillsR).add(h);
    }
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * 0.85 + rand(0, Math.PI * 0.7);
      const r = rand(300, 320);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = rand(-2, 1);
      const grp = x < 0 ? this.hillsL : this.hillsR;
      grp.add(mesh(G.cyl, this.silMat, 0.6, 9, 0.6, x, y + 4.5, z));
      grp.add(mesh(G.ico1, this.silMat, rand(8, 11), 1.6, rand(6, 8), x, y + 9.5, z));
    }
    bakeRigid(this.hillsL);
    bakeRigid(this.hillsR);
    this.scene.add(this.hillsL, this.hillsR);

    // Ngorongoro's crater wall — a ring of steep green ridges close to the horizon
    this.rimMat = new THREE.MeshLambertMaterial({ color: 0x6f8f45, flatShading: true, fog: false });
    this.rim = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI + (i / 21) * Math.PI;
      const r = rand(250, 280);
      this.rim.add(mesh(G.ico1, this.rimMat, rand(55, 80), rand(60, 85), rand(40, 55), Math.cos(a) * r, -30, Math.sin(a) * r));
    }
    bakeRigid(this.rim);
    this.scene.add(this.rim);

    // Bwindi's rolling forested hills
    this.forestMat = new THREE.MeshLambertMaterial({ color: 0x2f5a2c, flatShading: true, fog: false });
    this.forest = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const a = -Math.PI + (i / 39) * Math.PI;
      const r = rand(200, 260);
      this.forest.add(mesh(G.ico1, this.forestMat, rand(30, 55), rand(35, 60), rand(30, 45), Math.cos(a) * r, -20, Math.sin(a) * r));
    }
    bakeRigid(this.forest);
    this.scene.add(this.forest);

    // horizon ocean for the coast
    this.oceanMat = new THREE.MeshLambertMaterial({ color: 0x3fc1c9, fog: false, emissive: 0x0a3a40 });
    this.ocean = new THREE.Mesh(new THREE.CircleGeometry(700, 32, Math.PI * 0.5, Math.PI), this.oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = -8;
    this.scene.add(this.ocean);
  }

  /* --------------------------------------------------------------- ground */
  buildGround() {
    // brightness-only vertex colours; hue comes from each segment's region tint
    const grassGeo = new THREE.PlaneGeometry(220, SEG_LEN, 22, 12);
    grassGeo.rotateX(-Math.PI / 2);
    const gc = [];
    const p = grassGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const n = Math.sin(x * 0.37) * 0.5 + Math.sin(x * 0.11 + (Math.abs(z) > SEG_LEN / 2 - 0.1 ? 0 : z * 0.3)) * 0.5;
      let v = 0.88 + (n * 0.5 + 0.5) * 0.2;
      if (Math.abs(x) < 6) v *= 0.92;
      gc.push(v, v, v);
      p.setY(i, Math.abs(x) > 14 ? Math.sin(x * 0.2) * 0.4 : 0);
    }
    grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
    grassGeo.computeVertexNormals();

    const trailGeo = new THREE.PlaneGeometry(LANE_W * 3 + 0.9, SEG_LEN, 1, 12);
    trailGeo.rotateX(-Math.PI / 2);
    pathTexture().repeat.set(1, SEG_LEN / (LANE_W * 3 + 0.9));
    const waterGeo = new THREE.PlaneGeometry(110, SEG_LEN, 4, 12);
    waterGeo.rotateX(-Math.PI / 2);
    const foamGeo = new THREE.PlaneGeometry(1.2, SEG_LEN, 1, 12);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = bend(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));

    const shade = (v) => mat(new THREE.Color(v, v, v).getHex());
    this.segments = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const g = new THREE.Group();
      const grassMat = bend(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: grassTexture() }), { key: 'grass', ...GROUND_LIGHT });
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.userData.keep = true;
      grass.receiveShadow = true;
      g.add(grass);
      // the trail surface itself: a textured strip with worn lanes, tyre tracks and footprints
      const trailMat = bend(new THREE.MeshLambertMaterial({ map: pathTexture() }), { key: 'trail', ...GROUND_LIGHT });
      const trail = new THREE.Mesh(trailGeo, trailMat);
      trail.position.y = 0.035;
      trail.receiveShadow = true;
      trail.userData.keep = true;
      g.add(trail);

      // path pieces are white-ish so the region tint shows through
      const path = new THREE.Group();
      path.add(mesh(G.boxLong, shade(1.0), LANE_W * 3 + 0.9, 0.05, SEG_LEN, 0, 0, 0));
      for (const s of [-1, 1]) path.add(mesh(G.boxLong, shade(1.08), 0.5, 0.07, SEG_LEN, s * (LANE_W * 1.5 + 0.55), 0, 0));
      // bright ridges splitting the trail into three lanes, above the textured surface
      for (const x of [-LANE_W * 0.5, LANE_W * 0.5]) path.add(mesh(G.boxLong, shade(1.45), 0.14, 0.05, SEG_LEN, x, 0.075, 0));
      for (let k = 0; k < 6; k++) {
        const s = Math.random() < 0.5 ? -1 : 1;
        path.add(mesh(G.dodec, shade(0.7), rand(0.1, 0.22), rand(0.08, 0.15), rand(0.1, 0.2), s * rand(4.1, 5.2), 0.06, rand(-SEG_LEN / 2, SEG_LEN / 2)));
      }
      bakeRigid(path, true);
      const pathMat = bend(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { key: 'path', ...GROUND_LIGHT });
      path.children.forEach((c) => {
        c.material = pathMat;
        c.receiveShadow = true;
      });
      g.add(path);

      const waterMat = waterMaterial(0x3fc1c9);
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.position.y = 0.46;
      g.add(water);
      const foam = new THREE.Mesh(foamGeo, foamMat);
      foam.position.y = 0.48;
      g.add(foam);

      g.userData = { wz: 0, grassMat, pathMat, trailMat, waterMat, water, foam, region: -1 };
      this.segments.push(g);
      this.scene.add(g);
    }
  }

  tintSegment(seg) {
    const u = seg.userData;
    const m = this.mixAt(u.wz + SEG_LEN / 2);
    this.mixColor(u.grassMat.color, 'grass', m);
    this.mixColor(u.pathMat.color, 'path', m);
    u.trailMat.color.copy(u.pathMat.color);
    const ra = REGIONS[m.a].ground;
    const rb = REGIONS[m.b].ground;
    const wr = m.t < 0.5 ? ra : rb;
    const hasWater = !!wr.water;
    u.water.visible = u.foam.visible = hasWater;
    if (hasWater) {
      u.waterMat.color.set(wr.water);
      const side = wr.waterSide ?? -1;
      u.water.position.x = side * (14 + 55);
      u.foam.position.x = side * 14.3;
    }
  }

  /* ------------------------------------------------------------ grass blades */
  /** Thousands of instanced, wind-blown blades lining the trail (High quality only). */
  buildBlades() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0, 1, 0.02], 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1], 3));
    geo.setAttribute('aSway', new THREE.Float32BufferAttribute([0, 0, 0.28], 1));
    this.bladeMat = bend(new THREE.MeshLambertMaterial({ color: 0xd4b05a, side: THREE.DoubleSide }), {
      ...SWAY_EXT,
      key: 'swayground',
      fragmentHead: GROUND_LIGHT.fragmentHead,
      fragmentLight: GROUND_LIGHT.fragmentLight,
      uniforms: { ...GROUND_LIGHT.uniforms },
    });
    this.bladeTiles = [];
    const TL = 40;
    const per = 1800;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    for (let t = 0; t < 3; t++) {
      const im = new THREE.InstancedMesh(geo, this.bladeMat, per);
      for (let i = 0; i < per; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (4.75 + Math.pow(Math.random(), 1.6) * 16);
        const h = rand(0.35, 0.95) * (1 - Math.abs(x) / 40);
        e.set(rand(-0.25, 0.25), rand(0, Math.PI), rand(-0.25, 0.25));
        m4.compose(new THREE.Vector3(x, 0, -Math.random() * TL), q.setFromEuler(e), new THREE.Vector3(rand(0.7, 1.4), h, 1));
        im.setMatrixAt(i, m4);
        const v = rand(0.78, 1.12);
        im.setColorAt(i, col.setRGB(v, v * rand(0.95, 1.05), v * 0.9));
      }
      im.frustumCulled = false;
      im.userData.wz = t * TL;
      im.visible = false;
      this.bladeTiles.push(im);
      this.scene.add(im);
    }
    this.bladeLen = TL;
  }

  setDetail(high) {
    this.detail = high;
    setBlobStrength(high ? 0.55 : 1);
  }

  /* --------------------------------------------------------------- weather */
  buildWeather() {
    const n = 140;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([rand(-25, 25), rand(0.3, 4), rand(-80, 10)], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.fireflyMat = bend(new THREE.PointsMaterial({ color: 0xd8ff6a, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fireflies = new THREE.Points(g, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);

    const sn = 420;
    const sp = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) sp.set([rand(-30, 30), rand(0, 22), rand(-70, 12)], i * 3);
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snowFallMat = bend(new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0, depthWrite: false }));
    this.snow = new THREE.Points(sgeo, this.snowFallMat);
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
  }

  /* --------------------------------------------------------------- spawning */
  take(type, factory, prep) {
    let pool = this.pools.get(type);
    if (!pool) this.pools.set(type, (pool = []));
    let obj = pool.pop();
    if (!obj) {
      obj = factory();
      prep?.(obj);
      obj.userData.type = type;
    }
    return obj;
  }
  give(obj) {
    obj.visible = false;
    this.pools.get(obj.userData.type).push(obj);
  }

  spawnProp(wz) {
    const ri = regionIndexAt(wz).index;
    const region = REGIONS[ri];
    let [type] = weighted(region.props);
    const water = region.ground.water ? region.ground.waterSide ?? -1 : 0;
    let side = Math.random() < 0.5 ? -1 : 1;
    if (region.ocean && Math.random() < 0.08) type = 'dhow';
    // boats, seaweed farms and mangroves go to the water's side
    if (water && WET.has(type) && type !== 'papyrus') side = water;
    const [factory, xMin, xMax, small] = PROPS[type];
    const obj = this.take(type, factory, (o) => {
      finishProp(bakeRigid(o, true), { sway: SWAY[type] ?? 0, ao: !AFLOAT.has(type) });
      o.traverse((c) => c.isMesh && !c.material.transparent && (c.castShadow = true));
    });
    let x = side * rand(xMin, xMax);
    // keep land props out of the water (papyrus and dhows like it wet)
    if (water && side === water && !WET.has(type)) x = side * rand(xMin, Math.min(xMax, 13));
    obj.position.set(x, AFLOAT.has(type) ? 0.1 : type === 'seaweed' ? 0.15 : 0, 0);
    obj.rotation.y = AFLOAT.has(type) || type === 'seaweed' ? rand(-0.4, 0.4) : rand(0, Math.PI * 2);
    obj.userData.wz = wz;
    obj.userData.cull = small ? -100 : -185;
    obj.visible = true;
    if (!obj.parent) this.scene.add(obj);
    this.props.push(obj);
  }

  spawnHerd(wz) {
    // Low graphics keeps every other herd animal: animated models are the costliest thing on screen
    if (this.detail === false && Math.round(wz / HERD_STEP) % 2) return;
    const region = REGIONS[regionIndexAt(wz).index];
    const plan = planHerd(region, this.day, wz);
    if (!plan) return;
    const { kind, mode, xr } = plan;
    const a = this.take(kind, () => {
      const m = HERD[kind]();
      m.root.userData.anim = m;
      return m.root;
    });
    const anim = a.userData.anim;
    a.position.set(plan.x, plan.y, 0);
    Object.assign(a.userData, { wz, xr, mode, walkV: plan.walkV, dir: plan.dir, roams: ROAMERS.has(kind), modeT: rand(2, 8) });
    a.rotation.y = plan.rot;
    // the region's walkers keep to their sideways stroll; roamers head wherever they face
    if (mode === 'walk' && !ROAMERS.has(kind)) a.rotation.y = plan.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    a.visible = true;
    if (!a.parent) this.scene.add(a);
    this.herd.push({ root: a, anim });
    if (plan.calf && this.detail !== false) this.spawnCalf(plan.calf, a);
  }

  /** A calf tucked in at its mother's flank; it copies her mood and her pace. */
  spawnCalf(kind, mother) {
    const c = this.take(kind, () => {
      const m = HERD[kind]();
      m.root.userData.anim = m;
      return m.root;
    });
    const u = mother.userData;
    Object.assign(c.userData, { wz: u.wz, xr: u.xr, mode: u.mode, roams: false, follow: mother, side: Math.random() < 0.5 ? -1 : 1 });
    c.visible = true;
    if (!c.parent) this.scene.add(c);
    this.herd.push({ root: c, anim: c.userData.anim });
  }

  /**
   * A plains animal living its own life: it grazes, wanders and now and then trots, always
   * moving the way it faces (the models face -z), and turns back before reaching the trail.
   */
  roam(a, u, dt) {
    if ((u.modeT -= dt) <= 0) {
      u.mode = nextMode(u.mode, Math.random());
      u.modeT = u.mode === 'run' ? rand(1.5, 4) : rand(3, 9);
      if (u.mode !== 'idle') a.rotation.y += rand(-1.2, 1.2);
    }
    const v = MODE_SPEED[u.mode] * u.walkV;
    if (!v) return;
    u.t = (u.t ?? 0) + dt;
    if (u.mode === 'walk') a.rotation.y += Math.sin(u.t * 0.7 + u.walkV * 9) * 0.25 * dt;
    const dx = -Math.sin(a.rotation.y);
    const dz = -Math.cos(a.rotation.y);
    a.position.x += dx * v * dt;
    u.wz -= dz * v * dt;
    const ax = Math.abs(a.position.x);
    const outward = Math.sign(a.position.x) === Math.sign(dx);
    if ((ax < u.xr[0] && !outward) || (ax > u.xr[1] + 6 && outward)) a.rotation.y = Math.atan2(dx, -dz);
  }

  /** Clears and re-populates everything around journey distance J. */
  reset(J) {
    for (const p of this.props) this.give(p);
    for (const h of this.herd) this.give(h.root);
    this.props = [];
    this.herd = [];
    this.propCursor = J - 20;
    this.herdCursor = herdCursor(J);
    this.bladeTiles?.forEach((t, i) => (t.userData.wz = Math.floor(J / this.bladeLen) * this.bladeLen + (i - 0.25) * this.bladeLen));
    const base = Math.floor((J - 16) / SEG_LEN) * SEG_LEN;
    this.segments.forEach((s, i) => {
      s.userData.wz = base + i * SEG_LEN;
      this.tintSegment(s);
    });
    this.populate(J);
    this.snapBackdrop = true;
  }

  populate(J) {
    // never backfill a gap we skipped over (e.g. a revive or a big jump in distance)
    if (this.propCursor < J - 30) this.propCursor = J - 20;
    if (this.herdCursor < J - 30) this.herdCursor = J;
    while (this.propCursor < J + AHEAD) {
      this.spawnProp(this.propCursor);
      this.propCursor += rand(1.8, 3.2);
    }
    while (this.herdCursor < J + AHEAD + 20) {
      this.spawnHerd(this.herdCursor);
      this.herdCursor += HERD_STEP;
    }
  }

  /* ---------------------------------------------------------------- time */
  setTime(J, dt = 0.016) {
    const { a, b, t } = sampleDay(J);
    const P = this.palette;
    for (const k of ['top', 'hor', 'fog', 'sun', 'hemiS', 'hemiG', 'cloud']) P[k].copy(a[k]).lerp(b[k], t);
    for (const k of ['sunI', 'hemiI', 'sunH', 'night']) P[k] = a[k] + (b[k] - a[k]) * t;

    // region atmosphere
    const m = (this.blend = this.mixAt(J));
    const ra = REGIONS[m.a];
    const rb = REGIONS[m.b];
    const fogAmt = this.mixNum(m, (r) => r.fog?.amount ?? 0) * (1 - P.night * 0.6);
    const tint = this.tmp.copy(RC[m.a].fogTint ?? P.fog).lerp(RC[m.b].fogTint ?? P.fog, m.t);
    P.fog.lerp(tint, fogAmt);
    P.hor.lerp(tint, fogAmt * 0.6);
    const near = this.mixNum(m, (r) => r.fog?.near ?? 45);
    const far = this.mixNum(m, (r) => r.fog?.far ?? 175);

    this.skyUniforms.uTop.value.copy(P.top);
    this.skyUniforms.uHor.value.copy(P.hor);
    this.skyUniforms.uFog.value.copy(P.fog);
    this.skyUniforms.uSun.value.copy(P.sun);
    this.skyUniforms.uNight.value = P.night;
    const sd = this.skyUniforms.uSunDir.value.set(-0.45, P.sunH, -1).normalize();
    this.sunDir.copy(sd);
    if (!this.sun.castShadow) this.sun.position.copy(sd).multiplyScalar(60);
    this.sun.color.copy(P.sun);
    this.sun.intensity = P.sunI;
    this.hemi.color.copy(P.hemiS);
    this.hemi.groundColor.copy(P.hemiG);
    this.hemi.intensity = P.hemiI;
    this.scene.fog.color.copy(P.fog);
    this.scene.fog.near = near;
    this.scene.fog.far = far;
    this.starMat.opacity = P.night * (1 - fogAmt);
    this.fireflyMat.opacity = P.night * 0.9;

    const hill = this.mixColor(this.tmp2, 'hill', m);
    this.hillMat.color.copy(P.fog).lerp(hill, 0.55);
    this.hillMat2.color.copy(P.fog).lerp(hill, 0.4);
    this.silMat.color.copy(P.fog).lerp(hill, 0.9).multiplyScalar(0.7);
    this.rimMat.color.copy(P.fog).lerp(hill, 0.7);
    this.forestMat.color.copy(P.fog).lerp(hill, 0.75);
    this.mtnMat.color.copy(P.fog).lerp(C('#5a6088'), 0.5 + fogAmt * 0.4);
    this.snowMat.color.copy(P.sun).lerp(C('#ffffff'), 0.5);
    this.cloudMat.color.copy(P.cloud);
    this.cloudMat.emissive.copy(P.cloud).multiplyScalar(0.35);
    this.oceanMat.color.set(rb.ocean && m.t > 0.5 ? rb.ground.water : ra.ground.water ?? '#3fc1c9').lerp(P.fog, 0.25);

    // backdrop pieces glide in and out between regions
    const k = this.snapBackdrop ? 1 : 1 - Math.exp(-1.5 * dt);
    this.snapBackdrop = false;
    const kp = (r) => r.kili;
    const kx = this.mixNum(m, (r) => kp(r).x);
    const ky = this.mixNum(m, (r) => kp(r).y);
    const kz = this.mixNum(m, (r) => kp(r).z);
    const ks = this.mixNum(m, (r) => kp(r).s);
    this.kili.position.lerp(this.tmpV.set(kx, ky, kz), k);
    this.kili.scale.setScalar(THREE.MathUtils.lerp(this.kili.scale.x, ks, k));
    const show = (grp, on) => (grp.position.y = THREE.MathUtils.lerp(grp.position.y, on ? 0 : -140, k));
    const pickR = m.t < 0.5 ? ra : rb;
    show(this.rim, !!pickR.crater);
    show(this.forest, !!pickR.forest);
    show(this.hillsL, !(pickR.ocean && (pickR.ground.waterSide ?? -1) < 0));
    show(this.hillsR, true);
    this.ocean.visible = !!pickR.ocean;
    this.snowFallMat.opacity = this.mixNum(m, (r) => (r.weather === 'snow' ? 0.9 : 0));
    return P;
  }

  dustColor() {
    const r = REGIONS[this.blend.index];
    return this.tmp.set(r.ground.path).getHex();
  }

  /* -------------------------------------------------------------- update */
  update(dt, J, camera, time) {
    this.frame = (this.frame ?? 0) + 1;
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.ocean.position.x = camera.position.x;
    this.ocean.position.z = camera.position.z;

    for (const seg of this.segments) {
      if (seg.userData.wz + SEG_LEN < J - 16) {
        seg.userData.wz += SEG_LEN * SEG_COUNT;
        this.tintSegment(seg);
      }
      seg.position.z = J - seg.userData.wz - SEG_LEN / 2;
    }

    // grass blades leapfrog along with the runner and take the region's colour
    const pickR = this.blend.t < 0.5 ? REGIONS[this.blend.a] : REGIONS[this.blend.b];
    const blades = this.detail && pickR.blades !== false;
    if (blades) this.mixColor(this.bladeMat.color, 'grass', this.blend).multiplyScalar(1.05);
    for (const t of this.bladeTiles) {
      if (t.userData.wz + this.bladeLen < J - 12) t.userData.wz += this.bladeLen * this.bladeTiles.length;
      t.position.z = J - t.userData.wz;
      t.visible = blades;
    }

    this.populate(J);
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i];
      if (p.userData.wz < J - 22) {
        this.give(p);
        this.props.splice(i, 1);
        continue;
      }
      p.position.z = J - p.userData.wz;
      p.visible = p.position.z > p.userData.cull;
    }

    for (let i = this.herd.length - 1; i >= 0; i--) {
      const { root: a, anim } = this.herd[i];
      const u = a.userData;
      if (u.wz < J - 25) {
        this.give(a);
        this.herd.splice(i, 1);
        continue;
      }
      if (u.follow) {
        // beside the mother, a little behind, facing the way she faces
        const m = u.follow;
        const mu = m.userData;
        const fx = -Math.sin(m.rotation.y);
        const fz = -Math.cos(m.rotation.y);
        // offset in scene space: 1.8 m to her side (right is (-fz, fx)) and 0.9 m back;
        // scene z runs opposite to journey distance, hence the minus on wz
        a.rotation.y = m.rotation.y;
        a.position.x = m.position.x - fz * u.side * 1.8 - fx * 0.9;
        u.wz = mu.wz - (fx * u.side * 1.8 - fz * 0.9);
        u.mode = mu.mode;
      } else if (u.roams) this.roam(a, u, dt);
      else if (u.mode === 'walk') {
        a.position.x += u.dir * u.walkV * dt;
        const ax = Math.abs(a.position.x);
        const outward = Math.sign(a.position.x) === u.dir;
        if ((ax < u.xr[0] && !outward) || (ax > u.xr[1] + 6 && outward)) {
          u.dir *= -1;
          a.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
      a.position.z = J - u.wz;
      a.visible = a.position.z > -175 && a.position.z < 12;
      // far animals animate at half rate (a frame each, alternately); near ones every frame
      if (a.visible && a.position.z > -120) {
        if (a.position.z > -55) anim.update(dt, 1, u.mode);
        else if ((this.frame + i) % 2 === 0) anim.update(dt * 2, 1, u.mode);
      }
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
    if (this.snowFallMat.opacity > 0.01) {
      const pos = this.snow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 2.2;
        let z = pos.getZ(i) + dt * 8;
        if (y < 0) y += 22;
        if (z > 12) z -= 82;
        pos.setY(i, y);
        pos.setZ(i, z);
        pos.setX(i, pos.getX(i) + Math.sin(time + i) * dt * 0.6);
      }
      pos.needsUpdate = true;
    }
  }
}

/* ======================================================================
 * Particles — two instanced meshes: soft round puffs for dust and smoke
 * (camera-facing, fading out), and small solid chips for debris and sparkles.
 * ====================================================================== */
let puffTex;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}

export class Particles {
  constructor(scene, max = 260) {
    this.max = max;
    const chips = bend(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    this.mesh = new THREE.InstancedMesh(G.ico, chips, max);
    // puffs carry their own fade in a per-instance alpha
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.setAttribute('aAlpha', this.alpha);
    const puffs = bend(new THREE.MeshBasicMaterial({ color: 0xffffff, map: puffTexture(), transparent: true, depthWrite: false }), {
      key: 'puff',
      vertexHead: 'attribute float aAlpha;\nvarying float vAlpha;\n',
      vertexBegin: 'vAlpha = aAlpha;\n',
      fragmentHead: 'varying float vAlpha;\n',
      fragmentColor: 'diffuseColor.a *= vAlpha;\n',
    });
    this.puffs = new THREE.InstancedMesh(plane, puffs, max);
    for (const m of [this.mesh, this.puffs]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      m.setColorAt(0, new THREE.Color());
      scene.add(m);
    }
    this.p = [];
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.camera = null; // set by the game so puffs can face it
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
    let m = 0;
    const face = this.camera?.quaternion;
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
      if (q.grow) {
        // a puff swells as it drifts and fades out softly
        if (face) d.quaternion.copy(face);
        else d.rotation.set(0, 0, 0);
        d.scale.setScalar(q.size * 2.2 * (1 + (1 - k) * q.grow * 2));
        d.updateMatrix();
        this.puffs.setMatrixAt(m, d.matrix);
        this.puffs.setColorAt(m, this.color.set(q.color));
        this.alpha.setX(m, Math.min(1, k * 1.6) * 0.75);
        m++;
      } else {
        d.rotation.set(q.life * q.spin, q.life * q.spin * 0.7, 0);
        d.scale.setScalar(q.size * k);
        d.updateMatrix();
        this.mesh.setMatrixAt(n, d.matrix);
        this.mesh.setColorAt(n, this.color.set(q.color));
        n++;
      }
    }
    this.mesh.count = n;
    this.puffs.count = m;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.puffs.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
    if (this.puffs.instanceColor) this.puffs.instanceColor.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
