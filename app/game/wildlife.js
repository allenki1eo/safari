import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { G, bakeRigid, bend, mat, mesh } from './materials.js';

/**
 * Textured, animated savanna animals from 0 A.D. by Wildfire Games (CC-BY-SA 3.0; see
 * static/models/animals/LICENSE.txt): lion, lioness, zebra, wildebeest, rhino, giraffe and
 * African elephant. Each wraps the code-built animal from fauna.js, which stands in until
 * the model arrives, so the herds never wait on the network.
 */

const BASE = `${import.meta.env.BASE_URL}models/animals/`;
let loader;
const files = new Map();
function load(name) {
  if (!files.has(name)) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const entry = { gltf: null };
    entry.promise = loader
      .loadAsync(`${BASE}${name}.glb`)
      .then((g) => (entry.gltf = g))
      .catch((err) => {
        console.warn(`[wildlife] ${name} unavailable, keeping the hand-built animal`, err);
        return null;
      });
    files.set(name, entry);
  }
  return files.get(name);
}

/** Starts fetching the models the opening regions show first. */
export function preloadWildlife() {
  for (const n of ['zebra', 'wildebeest', 'giraffe', 'elephant', 'lion']) load(n);
}

// mode -> clip(s); several idles take turns
const CLIPS = {
  lion: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2', 'Idle3'] },
  lioness: { run: 'Run', walk: 'Walk', idle: ['Idle'] },
  zebra: { run: 'Run', walk: 'Walk', idle: ['Idle'] },
  wildebeest: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Feeding'] },
  rhino: { run: 'Run', walk: 'Walk', idle: ['Idle'] },
  giraffe: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2'] },
  elephant: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2'] },
};

const materials = new Map();
function curved(src) {
  if (!materials.has(src)) {
    const m = bend(new THREE.MeshLambertMaterial({ map: src.map, color: src.color }));
    materials.set(src, m);
  }
  return materials.get(src);
}

const refHeights = new Map();

/** Tembo's ceremonial blanket, seated where 0 A.D. puts the elephant's rider. */
function addSaddle(model) {
  let seat = null;
  model.traverse((o) => o.isBone && o.name === 'prop-rider' && (seat = o));
  if (!seat) return;
  const g = new THREE.Group();
  const cloth = bend(new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  const gold = mat(0xf4d35e);
  // sizes in the elephant's own units (the model is about 3.3 m tall)
  g.add(mesh(G.box, cloth, 1.7, 0.08, 1.3, 0, -0.08, 0));
  for (const s of [-1, 1]) g.add(mesh(G.box, cloth, 0.05, 0.75, 1.3, s * 0.86, -0.45, 0));
  for (const z of [-0.66, 0.66]) g.add(mesh(G.box, gold, 1.75, 0.5, 0.05, 0, -0.32, z));
  g.add(mesh(G.box, gold, 1.72, 0.04, 1.32, 0, -0.03, 0));
  bakeRigid(g);
  // undo the bone's world scale and rotation so the blanket sits level
  model.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  seat.matrixWorld.decompose(new THREE.Vector3(), q, sc);
  g.quaternion.copy(q.invert());
  g.scale.set(1 / sc.x, 1 / sc.y, 1 / sc.z).multiplyScalar(model.scale.x);
  seat.add(g);
}

/**
 * A 0 A.D. animal with the game's animal API (`root` facing -z, `update(dt, rate, mode)`),
 * sized to match the hand-built stand-in so lanes, hit boxes and the ride stay right.
 */
export function makeWildAnimal(kind, makeFallback, { saddle = false } = {}) {
  const file = load(kind);
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.rotation.y = Math.PI; // the models face +z
  root.add(holder);
  let fallback = null;
  let rig = null;

  const refHeight = () => {
    const key = kind + (saddle ? '+saddle' : '');
    if (!refHeights.has(key)) {
      const probe = fallback ?? makeFallback();
      const h = new THREE.Box3().setFromObject(probe.root).getSize(new THREE.Vector3()).y;
      refHeights.set(key, h / probe.root.scale.y);
    }
    return refHeights.get(key);
  };

  const swapIn = () => {
    if (rig || !file.gltf) return;
    const model = cloneSkinned(file.gltf.scene);
    let shadows = false;
    fallback?.root.traverse((o) => o.isMesh && o.castShadow && (shadows = true));
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = curved(o.material);
      o.castShadow = shadows;
      o.frustumCulled = false;
    });
    const h = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    model.scale.setScalar((refHeight() * (kind === 'elephant' ? 0.96 : 1)) / h);
    if (saddle) addSaddle(model);
    holder.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const c of file.gltf.animations) actions[c.name] = mixer.clipAction(c);
    rig = { mixer, actions, current: null };
    mixer.setTime(Math.random() * 3);
    if (fallback) fallback.root.visible = false;
  };

  if (file.gltf) swapIn();
  if (!rig) {
    fallback = makeFallback();
    root.add(fallback.root);
    file.promise.then(swapIn);
  }

  let mode = '';
  let idleName = null;
  let idleT = 0;
  return {
    root,
    update(dt, rate = 1, next = 'run') {
      if (!rig) return fallback?.update(dt, rate, next);
      const clips = CLIPS[kind];
      let name = clips[next] ?? clips.run;
      if (Array.isArray(name)) {
        if (mode !== next || (idleT -= dt) <= 0) {
          idleName = name[Math.floor(Math.random() * name.length)];
          idleT = 4 + Math.random() * 6;
        }
        name = idleName;
      }
      mode = next;
      const a = rig.actions[name];
      if (a && rig.current !== a) {
        a.reset().play();
        if (rig.current) a.crossFadeFrom(rig.current, 0.35, false);
        rig.current = a;
      }
      if (a) a.timeScale = next === 'idle' ? 1 : Math.max(0.4, rate) * (next === 'walk' ? 1 : 0.85);
      rig.mixer.update(dt);
    },
  };
}

