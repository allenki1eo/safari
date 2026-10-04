import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { track } from './loading.js';
import { G, bakeRigid, bend, mat, mesh } from './materials.js';
import { PAT, PATTERN_GLSL } from './rigkit.js';

/**
 * Textured, animated savanna animals from 0 A.D. by Wildfire Games (CC-BY-SA 3.0; see
 * static/models/animals/LICENSE.txt): lion, lioness, zebra, wildebeest, rhino, giraffe,
 * African elephant and hippo, plus a hyena, cheetah and buffalo recoated from 0 A.D.'s wolf,
 * tiger and bull, a painted wild dog from the same wolf, gazelle, warthog (0 A.D.'s boar),
 * crocodile, and elephant and giraffe calves. Where a code-built animal exists (fauna.js) it
 * stands in until the model arrives, so the herds never wait on the network.
 */

const BASE = `${import.meta.env.BASE_URL}models/animals/`;
let loader;
const files = new Map();
function load(name) {
  if (!files.has(name)) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const entry = { gltf: null };
    entry.promise = track(loader
      .loadAsync(`${BASE}${name}.glb`)
      .then((g) => (entry.gltf = g))
      .catch((err) => {
        console.warn(`[wildlife] ${name} unavailable, keeping the hand-built animal`, err);
        return null;
      }));
    files.set(name, entry);
  }
  return files.get(name);
}

/** Starts fetching the models the opening regions show first. */
export function preloadWildlife() {
  for (const n of ['hyena', 'zebra', 'wildebeest', 'giraffe', 'elephant', 'lion']) load(n);
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
  // borrowed from cousins and recoated (see COATS): wolf -> hyena, tiger -> cheetah, bull -> buffalo
  hyena: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2', 'Idle3'] },
  cheetah: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2', 'Idle3'] },
  buffalo: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2', 'Feeding'] },
  hippo: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2'] },
  wilddog: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2', 'Idle3'] },
  gazelle: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2', 'Idle3'] },
  warthog: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2'] },
  elephant_calf: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2'] },
  giraffe_calf: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2'] },
  croc: { run: 'Run', walk: 'Walk', idle: ['Idle', 'Idle2'] },
};

// species drawn from another species' model file: the wild dog is 0 A.D.'s wolf, like the hyena
const FILES = { wilddog: 'hyena' };

/**
 * Reshaping a borrowed body, applied after each animation update (the clips key every bone's
 * scale, so a one-off change wouldn't stick). The hyena is the wolf with its spine tilted nose-up
 * from the hips, longer front legs, a heavier neck and a short tail: the sloping-backed outline
 * that reads as a hyena at a glance.
 */
const RESHAPE = {
  hyena: { tilt: ['Bone', -0.15], scale: { FrontLeg1_L: 1.2, FrontLeg1_R: 1.2, Neck1: 1.14, Tail1: 0.55 } },
};

function reshaper(kind, model) {
  const spec = RESHAPE[kind];
  if (!spec) return null;
  const bones = {};
  model.traverse((o) => o.isBone && (bones[o.name] = o));
  const tiltBone = spec.tilt && bones[spec.tilt[0]];
  let tilt = null;
  if (tiltBone) {
    // pitch about the model's own sideways axis, expressed in the bone's parent space
    model.updateMatrixWorld(true);
    const rel = new THREE.Quaternion();
    tiltBone.parent.matrixWorld.decompose(new THREE.Vector3(), rel, new THREE.Vector3());
    const modelQ = new THREE.Quaternion();
    model.matrixWorld.decompose(new THREE.Vector3(), modelQ, new THREE.Vector3());
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(modelQ).applyQuaternion(rel.invert()).normalize();
    tilt = new THREE.Quaternion().setFromAxisAngle(axis, spec.tilt[1]);
  }
  const scaled = Object.entries(spec.scale ?? {}).filter(([n]) => bones[n]).map(([n, k]) => [bones[n], k]);
  return () => {
    if (tilt) tiltBone.quaternion.premultiply(tilt);
    for (const [b, k] of scaled) b.scale.multiplyScalar(k);
  };
}

/**
 * New coats for models borrowed from a cousin: the texture keeps the fur's light and shade
 * (sampled blurred, so the tiger's stripes melt away), and the colour and markings are
 * painted on in the model's own space. `scale` is pattern cells per metre.
 */
const COATS = {
  cheetah: { base: 0xe0ae58, mark: 0x1d140c, type: PAT.spots, scale: 11, blur: 4, lo: 0.75 },
  hyena: { base: 0xa8916f, mark: 0x3d2f22, type: PAT.spots, scale: 8, blur: 2, lo: 0.55 },
  buffalo: { base: 0x4a4038, mark: 0x4a4038, type: PAT.none, scale: 1, blur: 0, lo: 0.35 },
  // the painted wolf: blotches of black over tan and cream
  wilddog: { base: 0xa8803f, mark: 0x1c1712, type: PAT.spots, scale: 4.6, blur: 2, lo: 0.6 },
  warthog: { base: 0x9a8a76, mark: 0x9a8a76, type: PAT.none, scale: 1, blur: 1, lo: 0.6 },
};

const materials = new Map();
function curved(src, kind, unit) {
  const key = `${kind}|${src.uuid}`;
  if (materials.has(key)) return materials.get(key);
  const m = new THREE.MeshLambertMaterial({ map: src.map, color: src.color });
  const coat = COATS[kind];
  if (!coat) {
    materials.set(key, bend(m));
    return materials.get(key);
  }
  bend(m, {
    key: `coat-${kind}`,
    vertexHead: 'varying vec3 vCoat;\n',
    vertexBegin: 'vCoat = position;\n',
    fragmentHead: 'varying vec3 vCoat;\nuniform vec3 uBase, uMark;\nuniform vec4 uPat;\n' + PATTERN_GLSL,
    fragmentColor: /* glsl */ `
      vec3 fur = texture2D(map, vMapUv, uPat.z).rgb;
      float shade = clamp(dot(fur, vec3(0.299, 0.587, 0.114)) / 0.42, uPat.w, 1.35);
      diffuseColor.rgb = mix(uBase, uMark, patternMask(vCoat * uPat.y, uPat.x)) * shade;
    `,
    uniforms: {
      uBase: { value: new THREE.Color(coat.base) },
      uMark: { value: new THREE.Color(coat.mark) },
      uPat: { value: new THREE.Vector4(coat.type, coat.scale * unit, coat.blur, coat.lo) },
    },
  });
  materials.set(key, m);
  return m;
}

const refHeights = new Map();
const sizes = new Map();

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

/** Fisi's tattered red bandana, tied round the hyena's neck. */
function addBandana(model) {
  let neck = null;
  model.traverse((o) => o.isBone && o.name === 'Neck2' && (neck = o));
  if (!neck) return;
  model.updateMatrixWorld(true);
  // built in metres facing +z like the model (which has no parent yet), then carried into the
  // bone's frame with the full inverse, since these rigs can carry mirrored or skewed bone scales
  const g = new THREE.Group();
  const red = bend(new THREE.MeshLambertMaterial({ color: 0xb3261e }));
  // the neck rises forward, so the band tilts with it; the bone runs along the top of the neck
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 20), red);
  band.position.y = -0.12;
  band.rotation.x = -0.35;
  g.add(band);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), red);
  tail.position.set(0, -0.3, 0.1);
  tail.rotation.x = Math.PI - 0.5;
  g.add(tail);
  const at = new THREE.Vector3().setFromMatrixPosition(neck.matrixWorld);
  g.matrixAutoUpdate = false;
  g.matrix.copy(neck.matrixWorld).invert().multiply(new THREE.Matrix4().makeTranslation(at.x, at.y, at.z));
  neck.add(g);
}

/**
 * A 0 A.D. animal with the game's animal API (`root` facing -z, `update(dt, rate, mode)`),
 * sized to match the hand-built stand-in so lanes, hit boxes and the ride stay right.
 */
export function makeWildAnimal(kind, makeFallback, { saddle = false, boss = false, height = 1 } = {}) {
  const file = load(FILES[kind] ?? kind);
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.rotation.y = Math.PI; // the models face +z
  root.add(holder);
  let fallback = null;
  let rig = null;

  const refHeight = () => {
    const key = kind + (saddle ? '+saddle' : ''); // the boss is sized by its caller
    if (!makeFallback) return height; // no code-built cousin: sized from `height` (metres)
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
    let shadows = !fallback;
    fallback?.root.traverse((o) => o.isMesh && o.castShadow && (shadows = true));
    // measured on the skinned pose: some meshes carry a node scale that skinning ignores
    const reshape = reshaper(kind, model);
    // and standing in the idle pose, since a bind pose can crouch or sprawl
    if (!sizes.has(kind)) {
      const idle = file.gltf.animations.find((c) => c.name === 'Idle');
      const probe = idle && new THREE.AnimationMixer(model);
      probe?.clipAction(idle).play();
      probe?.update(0);
      reshape?.();
      model.updateMatrixWorld(true);
      sizes.set(kind, new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3()));
      probe?.stopAllAction();
      probe?.uncacheRoot(model);
    }
    const size = sizes.get(kind);
    const h = size.y;
    const height = refHeight() * (kind === 'elephant' ? 0.96 : 1);
    const longest = (v) => Math.max(v.x, v.y, v.z);
    model.traverse((o) => {
      if (!o.isMesh) return;
      // metres per unit of the mesh's own positions (whatever its axes), to paint coats to scale
      o.geometry.boundingBox ?? o.geometry.computeBoundingBox();
      const unit = (longest(size) * height) / h / Math.max(1e-6, longest(o.geometry.boundingBox.getSize(new THREE.Vector3())));
      o.material = curved(o.material, kind, unit);
      o.castShadow = shadows;
      o.frustumCulled = false;
    });
    model.scale.setScalar(height / h);
    if (saddle) addSaddle(model);
    if (boss) addBandana(model);
    holder.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const c of file.gltf.animations) actions[c.name] = mixer.clipAction(c);
    rig = { mixer, actions, current: null, reshape };
    mixer.setTime(Math.random() * 3);
    if (fallback) fallback.root.visible = false;
  };

  if (file.gltf) swapIn();
  if (!rig) {
    if (makeFallback) {
      fallback = makeFallback();
      root.add(fallback.root);
    }
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
      rig.reshape?.();
    },
  };
}

