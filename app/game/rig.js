import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { G, bakeRigid, basic, bend, mat, mesh } from './materials.js';

/**
 * Rigged characters: the runners and the hyenas, zebras, wildebeest and buffalo are skinned
 * glTF models (CC0, Quaternius) animated with an AnimationMixer. Jumping, riding and flying have
 * no clip of their own, so those poses are layered on top of the mixer bone by bone.
 *
 * Every factory returns the hand-built procedural model straight away and swaps the rig in
 * once its file arrives, so the game never waits on the network and still works offline.
 */

const BASE = `${import.meta.env.BASE_URL}models/`;
let loader;
const files = new Map();

function load(name) {
  if (!files.has(name)) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const entry = { gltf: null, promise: null };
    entry.promise = loader
      .loadAsync(`${BASE}${name}.glb`)
      .then((gltf) => (entry.gltf = gltf))
      .catch((err) => {
        console.warn(`[rig] ${name} unavailable, keeping the procedural model`, err);
        return null;
      });
    files.set(name, entry);
  }
  return files.get(name);
}

/** Starts fetching the models a run needs first, so they're usually in before the title fades. */
export function preloadRigs(runnerId) {
  load('runner-clips');
  load(`runners/${runnerId}`);
  load('hyena');
  load('zebra');
  load('buffalo');
}

/* ---------------------------------------------------------------- helpers */
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const m4 = new THREE.Matrix4();
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

// the loader strips characters such as '.' from node names (UpperLeg.L -> UpperLegL)
const boneKey = (name) => THREE.PropertyBinding.sanitizeNodeName(name);

const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

/** Flat-shaded curved-world material; the models ship without normals for exactly this look. */
function flat(color, opts = {}, ext) {
  return bend(new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }), ext);
}

/** Matrix of `obj` in the space of `space` (both must have current world matrices). */
function localTo(space, obj, target = new THREE.Matrix4()) {
  return target.copy(space.matrixWorld).invert().multiply(obj.matrixWorld);
}

/** Re-parents `piece` (built in `space` coordinates) onto `bone`, keeping where it sits. */
function attach(space, bone, piece) {
  space.updateMatrixWorld(true);
  m4.copy(localTo(space, bone)).invert().multiply(piece.matrix.compose(piece.position, piece.quaternion, piece.scale));
  m4.decompose(piece.position, piece.quaternion, piece.scale);
  bone.add(piece);
  return piece;
}

/** Box around the skinned meshes in `space` coordinates, in the pose the bones hold right now. */
function skinnedBox(space, filter = () => true) {
  const box = new THREE.Box3();
  space.updateMatrixWorld(true);
  const inv = space.matrixWorld.clone().invert();
  space.traverse((o) => {
    if (!o.isSkinnedMesh || !filter(o)) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      o.getVertexPosition(i, v3);
      box.expandByPoint(v3.applyMatrix4(o.matrixWorld).applyMatrix4(inv));
    }
  });
  return box;
}

/**
 * Box around the skin some bones mostly drive, in `space` coordinates. Bone origins don't always sit
 * inside the mesh (quantisation moves the bind transform around), so props are placed from this.
 */
function boneBox(space, bones) {
  const box = new THREE.Box3();
  space.updateMatrixWorld(true);
  const inv = space.matrixWorld.clone().invert();
  space.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const indices = bones.map((b) => o.skeleton.bones.indexOf(b)).filter((i) => i >= 0);
    if (!indices.length) return;
    const { skinIndex, skinWeight } = o.geometry.attributes;
    for (let i = 0; i < skinIndex.count; i++) {
      for (let j = 0; j < 4; j++) {
        if (indices.includes(skinIndex.getComponent(i, j)) && skinWeight.getComponent(i, j) > 0.5) {
          box.expandByPoint(o.getVertexPosition(i, v3).applyMatrix4(o.matrixWorld).applyMatrix4(inv));
        }
      }
    }
  });
  return box;
}

function shade(hex, k) {
  return new THREE.Color(hex).multiplyScalar(k).getHex();
}

/**
 * A small layer over AnimationMixer: cross-fades between looping clips, plays one-shots,
 * and blends procedural poses (rotations in model space applied to the rest pose) on top.
 */
class Animator {
  constructor(space, model, clips, poses = {}) {
    this.space = space;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of clips) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;
    this.bones = {};
    model.traverse((o) => o.isBone && (this.bones[o.name] = o));
    this.rest = new Map();
    for (const b of Object.values(this.bones)) this.rest.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
    this.poses = this.compilePoses(poses);
    this.pose = null;
    this.poseW = 0;
  }

  /** Turns `{ bone: [['x', angle], ...] }` (model-space axes) into target local rotations. */
  compilePoses(poses) {
    this.space.updateMatrixWorld(true);
    const out = {};
    for (const [name, spec] of Object.entries(poses)) {
      out[name] = [];
      for (const [boneName, steps] of Object.entries(spec)) {
        const bone = this.bones[boneKey(boneName)];
        if (!bone) continue;
        const parentQ = new THREE.Quaternion();
        localTo(this.space, bone.parent, m4).decompose(v3, parentQ, new THREE.Vector3());
        const inv = parentQ.clone().invert();
        const q = this.rest.get(bone).q.clone();
        for (const [axis, angle] of steps) q.premultiply(q1.setFromAxisAngle(AXES[axis].clone().applyQuaternion(inv), angle));
        out[name].push({ bone, q });
      }
    }
    return out;
  }

  play(name, { fade = 0.2, once = false, speed = 1, restart = false } = {}) {
    const next = this.actions[name];
    if (!next) return null;
    if (this.current === next && !restart) return next;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.timeScale = speed;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false);
    else next.fadeIn(fade);
    next.play();
    this.current = next;
    return next;
  }

  update(dt, pose, lock = []) {
    // bones the clip doesn't animate would otherwise keep last frame's pose overlay
    for (const [b, r] of this.rest) b.quaternion.copy(r.q);
    this.mixer.update(dt);
    // clips may carry root motion; the game moves the character itself
    for (const b of lock) {
      const r = this.rest.get(b);
      b.position.x = r.p.x;
      b.position.z = r.p.z;
    }
    this.poseW = damp(this.poseW, pose ? 1 : 0, 14, dt);
    if (pose) this.pose = pose;
    const p = this.pose && this.poses[this.pose];
    if (!p || this.poseW < 0.001) return;
    for (const { bone, q } of p) bone.quaternion.slerp(q, this.poseW);
  }
}

/* ================================================================ RUNNERS */

/**
 * Which source model plays each runner, and how its materials are repainted. Paint values are
 * runner colour keys from content.js or hex colours; anything unlisted keeps the model's own.
 */
const RUNNER_RIGS = {
  zuri: {
    paint: { Skin: 'skin', Hair: 'hair', Eyebrows: 'hair' },
    gear: ['wrap', 'scarf'],
  },
  juma: {
    paint: { Skin: 'skin', Hair: 'hair', Eyebrows: 'hair', LightBrown: 'shirt', Red_Dark: 'pants', White: 'accent' },
    gear: ['cap'],
  },
  neema: {
    paint: { Skin: 'skin', Skin_Darker: 'skinDark', Hair: 'hair', Eyebrows: 'hair', LightBrown: 'shirt', LightBlue: 0x3b1d4f, White: 0xf4d35e, Red_Dark: 'scarf' },
    gear: ['beads', 'necklace'],
  },
  baraka: {
    paint: { Skin: 'skin', Eyebrows: 'hair', Brown: 'shirt', LightBlue: 'pants', Beige: 'accent', Red: 'scarf' },
    gear: ['backpack'],
  },
  amani: {
    paint: { Skin: 'skin', Hair: 'hair', Eyebrows: 'hair', Purple: 'shirt', LightBlue: 'pants', White: 'glow' },
    gear: ['scarf', 'necklace'],
  },
  kito: {
    paint: { Skin: 'skin', Eyebrows: 'hair', Red: 'accent', Red_Dark: 'hair', White: 'shirt', Black: 0x2b1a0e, LightBlue: 0x3a2716 },
    gear: ['scarf'],
  },
};

const RUNNER_HEIGHT = 1.78;
const RUNNER_CLIPS = ['Run', 'Idle', 'Roll', 'Death', 'Wave', 'HitRecieve'];

// Poses are rotations about model axes (+z forward, +x the runner's left) applied to the rest pose,
// which stands with the legs straight and the arms hanging about 60 degrees below horizontal.
const RUNNER_POSES = {
  jump: {
    Torso: [['x', 0.22]],
    Head: [['x', -0.25]],
    'UpperLeg.L': [['x', -1.6]],
    'LowerLeg.L': [['x', 2.1]],
    'UpperLeg.R': [['x', -0.55]],
    'LowerLeg.R': [['x', 1.5]],
    'UpperArm.L': [['z', 0.3], ['x', -1.7]],
    'LowerArm.L': [['x', -0.6]],
    'UpperArm.R': [['z', -0.6], ['x', 0.7]],
    'LowerArm.R': [['x', -0.7]],
  },
  ride: {
    Torso: [['x', 0.12]],
    'UpperLeg.L': [['z', 0.45], ['x', -1.45]],
    'LowerLeg.L': [['x', 1.5]],
    'UpperLeg.R': [['z', -0.45], ['x', -1.45]],
    'LowerLeg.R': [['x', 1.5]],
    'UpperArm.L': [['z', 0.2], ['x', -1.3]],
    'LowerArm.L': [['x', -0.4]],
    'UpperArm.R': [['z', -2.3]],
    'LowerArm.R': [['z', -0.45]],
  },
  fly: {
    Torso: [['x', -0.12]],
    Head: [['x', -0.3]],
    'UpperArm.L': [['z', 2.45], ['x', -0.15]],
    'LowerArm.L': [['z', 0.15]],
    'UpperArm.R': [['z', -2.45], ['x', -0.15]],
    'LowerArm.R': [['z', -0.15]],
    'UpperLeg.L': [['x', -0.45]],
    'LowerLeg.L': [['x', 0.7]],
    'UpperLeg.R': [['x', 0.15]],
    'LowerLeg.R': [['x', 0.35]],
  },
};

/** Little props sewn onto the rig, built around the head and chest of the bind pose. */
function buildGear(kind, def, ctx) {
  const { head, neck, chest, H } = ctx;
  const s = H / RUNNER_HEIGHT;
  const g = new THREE.Group();
  const accent = mat(def.accent);
  const top = head.max.y;
  const hc = head.getCenter(new THREE.Vector3());
  const hs = head.getSize(new THREE.Vector3());
  const r = Math.max(hs.x, hs.z) * 0.53;
  switch (kind) {
    case 'wrap': {
      // a dome over the hair, a band around the brow and a knot at the back
      g.add(mesh(G.sphere, accent, r * 1.06, r * 0.66, r * 1.1, hc.x, top - r * 0.42, hc.z - r * 0.06));
      g.add(mesh(G.cyl, accent, r * 1.1, r * 0.34, r * 1.12, hc.x, top - r * 0.74, hc.z - r * 0.06));
      g.add(mesh(G.sphere, mat(def.scarfPattern ?? 0xf4d35e), r * 0.36, r * 0.3, r * 0.3, hc.x, top - r * 0.55, hc.z - r * 1.12));
      return { bone: 'Head', piece: g };
    }
    case 'cap': {
      g.add(mesh(G.sphere, accent, r * 1.05, r * 0.62, r * 1.08, hc.x, top - r * 0.45, hc.z - r * 0.04));
      const brim = mesh(G.box, accent, r * 1.3, r * 0.07, r * 0.95, hc.x, top - r * 0.7, hc.z + r * 0.95);
      brim.rotation.x = -0.12;
      g.add(brim);
      g.add(mesh(G.sphere, mat(0xffffff), r * 0.13, r * 0.09, r * 0.13, hc.x, top + r * 0.14, hc.z - r * 0.04));
      return { bone: 'Head', piece: g };
    }
    case 'beads': {
      const y = top - r * 0.72;
      g.add(mesh(G.cyl, accent, r * 1.04, r * 0.14, r * 1.06, hc.x, y, hc.z));
      const cols = [0xd7263d, 0x1b998b, 0xf4d35e, 0x2e86ab, 0xffffff];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        g.add(mesh(G.sphere, mat(cols[i % cols.length]), r * 0.1, r * 0.1, r * 0.1, hc.x + Math.sin(a) * r * 1.08, y, hc.z + Math.cos(a) * r * 1.08));
      }
      return { bone: 'Head', piece: g };
    }
    case 'necklace': {
      const cols = def.id === 'amani' ? [0x4de1ff, 0xffffff] : [0xd7263d, 0xffffff, 0x1b998b, 0xf4d35e, 0x2e86ab];
      const rr = 0.13 * s;
      for (let i = 0; i < 15; i++) {
        const a = (i / 14) * Math.PI - Math.PI / 2;
        const m = def.id === 'amani' ? basic(cols[i % 2]) : mat(cols[i % cols.length]);
        g.add(mesh(G.box, m, 0.035 * s, 0.035 * s, 0.025 * s, neck.x + Math.sin(a) * rr, neck.y - 0.03 * s - Math.cos(a) * 0.08 * s, neck.z + 0.04 * s + Math.cos(a) * rr * 0.7));
      }
      return { bone: 'Chest', piece: g };
    }
    case 'scarf': {
      const m = mat(def.scarf ?? def.accent);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085 * s, 0.035 * s, 5, 10), m);
      ring.rotation.x = Math.PI / 2 + 0.3; // drapes lower at the front
      ring.position.set(neck.x, neck.y - 0.05 * s, neck.z + 0.005 * s);
      g.add(ring);
      // the tail streams behind and flaps (animated in update)
      const tail = new THREE.Group();
      tail.position.set(neck.x + 0.04 * s, neck.y - 0.04 * s, neck.z - 0.11 * s);
      tail.add(mesh(G.box, m, 0.09 * s, 0.32 * s, 0.025 * s, 0, -0.16 * s, 0));
      if (def.scarfPattern) {
        const p = mat(def.scarfPattern);
        for (let i = 0; i < 3; i++) tail.add(mesh(G.box, p, 0.095 * s, 0.025 * s, 0.03 * s, 0, -0.07 * s - i * 0.1 * s, 0));
      }
      g.add(tail);
      return { bone: 'Chest', piece: g, tail };
    }
    case 'backpack': {
      const c = chest;
      const pack = mat(def.backpack ?? 0x3f6b3a);
      g.add(mesh(G.box, pack, 0.3 * s, 0.36 * s, 0.15 * s, c.x, c.y - 0.08 * s, c.z - 0.2 * s));
      g.add(mesh(G.box, mat(0x2a1a0c), 0.32 * s, 0.07 * s, 0.17 * s, c.x, c.y + 0.04 * s, c.z - 0.2 * s));
      g.add(mesh(G.box, mat(shade(def.backpack ?? 0x3f6b3a, 0.75)), 0.2 * s, 0.14 * s, 0.05 * s, c.x, c.y - 0.16 * s, c.z - 0.29 * s));
      return { bone: 'Chest', piece: g };
    }
  }
  return null;
}

function runnerColor(def, key) {
  if (typeof key === 'number') return key;
  if (key === 'skinDark') return shade(def.skin, 0.8);
  if (key === 'glow') return def.accent;
  return def[key];
}

/** Builds the rigged runner from the loaded files. */
function buildRunner(def, gltf, clipsFile) {
  const spec = RUNNER_RIGS[def.id] ?? RUNNER_RIGS.zuri;
  const space = new THREE.Group(); // model space: feet at y=0, facing +z, runner-sized
  const model = cloneSkinned(gltf.scene);
  space.add(model);

  const mats = new Map();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    if (!mats.has(src.name)) {
      const key = spec.paint[src.name];
      let m;
      if (key === 'glow') m = flat(runnerColor(def, key), { emissive: new THREE.Color(def.accent).multiplyScalar(0.6) });
      else if (key != null) m = flat(runnerColor(def, key));
      else m = flat(src.color.clone());
      mats.set(src.name, m);
    }
    o.material = mats.get(src.name);
    o.castShadow = true;
    o.frustumCulled = false;
  });

  // normalise size and drop the feet onto the ground
  const box = skinnedBox(space);
  const k = RUNNER_HEIGHT / (box.max.y - box.min.y);
  model.scale.multiplyScalar(k);
  model.position.y -= box.min.y * k;
  model.position.x -= ((box.min.x + box.max.x) / 2) * k;

  const bones = {};
  model.traverse((o) => o.isBone && (bones[o.name] = o));
  // multi-material meshes load as several skinned meshes under one "…_Head" group
  const head = skinnedBox(space, (o) => /Head/.test(o.name + o.parent.name));
  space.updateMatrixWorld(true);
  const at = (name) => (bones[name] ? new THREE.Vector3().setFromMatrixPosition(localTo(space, bones[name])) : new THREE.Vector3());
  const ctx = { head, neck: at('Neck'), chest: at('Chest'), H: RUNNER_HEIGHT };

  const tails = [];
  for (const kind of spec.gear) {
    const g = buildGear(kind, def, ctx);
    if (!g || !bones[g.bone]) continue;
    bakeRigid(g.piece);
    g.piece.traverse((o) => o.isMesh && (o.castShadow = true));
    attach(space, bones[g.bone], g.piece);
    if (g.tail) tails.push(g.tail);
  }

  const clips = (clipsFile?.animations ?? []).filter((c) => RUNNER_CLIPS.includes(c.name));
  const anim = new Animator(space, model, clips, RUNNER_POSES);
  return { space, anim, tails, lock: [bones.Body].filter(Boolean) };
}

/**
 * The player's runner: same API as the procedural one (`root`, `shadow`, `update`), plus
 * `hit()` for stumbles and `ready` once the rig has replaced the stand-in.
 */
export function makeRiggedRunner(def, fallback) {
  const root = fallback.root;
  const holder = new THREE.Group();
  holder.rotation.y = Math.PI; // models face +z; the runner looks down the track (-z)
  root.add(holder);

  const api = {
    root,
    shadow: fallback.shadow,
    ready: false,
    rig: null,
    state: 'idle',
    t: 0,
    hitT: 0,
    rideY: 0,
    hit() {
      api.hitT = 0.5;
    },
    update(dt, speed, state) {
      if (!api.rig) return fallback.update(dt, speed, state);
      api.t += dt;
      const { anim, tails } = api.rig;
      const was = api.state;
      api.state = state;
      let pose = null;
      switch (state) {
        case 'run': {
          if (api.hitT > 0) {
            api.hitT -= dt;
            anim.play('HitRecieve', { fade: 0.06, once: true, speed: 1.1 });
          } else {
            const a = anim.play('Run', { fade: was === 'slide' ? 0.12 : 0.18 });
            if (a) a.timeScale = 0.8 + speed * 0.02;
          }
          break;
        }
        case 'jump':
          pose = 'jump';
          anim.play('Run', { fade: 0.2 }).timeScale = 0.35;
          break;
        case 'slide':
          if (was !== 'slide') anim.play('Roll', { fade: 0.06, once: true, speed: 2.1, restart: true });
          break;
        case 'ride':
          pose = 'ride';
          anim.play('Idle', { fade: 0.25 });
          break;
        case 'fly':
          pose = 'fly';
          anim.play('Idle', { fade: 0.25 });
          break;
        case 'dead':
          anim.play('Death', { fade: 0.08, once: true });
          break;
        default: {
          // a wave hello when a runner first appears, then a relaxed idle
          if (was !== 'idle' || !api.greeted) {
            api.greeted = true;
            anim.play('Wave', { fade: 0.2, once: true, restart: true });
            api.waveT = 1.6;
          }
          if ((api.waveT -= dt) <= 0) anim.play('Idle', { fade: 0.4 });
        }
      }
      anim.update(dt, pose, api.rig.lock);
      // settle into the elephant's back
      api.rideY = damp(api.rideY, state === 'ride' ? -0.42 : 0, 10, dt);
      holder.position.y = api.rideY;
      for (const t of tails) {
        t.rotation.x = 0.35 + Math.sin(api.t * 13) * 0.18 + Math.min(speed, 30) * 0.025; // streams out behind
        t.rotation.z = Math.sin(api.t * 8.3) * 0.18;
      }
    },
  };

  const model = load(`runners/${def.id}`);
  const clips = load('runner-clips');
  Promise.all([model.promise, clips.promise]).then(([gltf, clipsGltf]) => {
    if (!gltf || !clipsGltf?.animations?.length) return;
    api.rig = buildRunner(def, gltf, clipsGltf);
    holder.add(api.rig.space);
    // retire the stand-in, keeping the blob shadow
    for (const c of [...root.children]) if (c !== holder && c !== fallback.shadow) c.visible = false;
    api.ready = true;
    api.greeted = false;
    api.state = '';
  });
  return api;
}

/* ================================================================ ANIMALS */

// Surface patterns painted in bind-pose space so they stay put while the animal moves.
const PATTERN_EXT = {
  stripes: {
    key: 'stripes',
    fragment: /* glsl */ `
      float legs = 1.0 - smoothstep(0.43, 0.47, vPat.y);
      float neck = smoothstep(0.62, 0.7, vPat.y);
      float f = mix(vPat.z * 15.0 + sin(vPat.y * 9.0) * 0.5, vPat.y * 26.0, legs);
      f = mix(f, vPat.y * 22.0 + vPat.z * 4.0, neck * (1.0 - legs));
      float band = step(0.55, fract(f));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.032, 0.03), band * uPatOn);
    `,
  },
  spots: {
    key: 'spots',
    fragment: /* glsl */ `
      vec3 q = vPat * 11.0;
      vec3 cell = floor(q);
      float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      vec3 off = vec3(fract(h * 7.13), fract(h * 13.37), fract(h * 3.71)) * 0.5 + 0.25;
      float d = length(fract(q) - off);
      float spot = step(d, 0.23) * step(0.3, h) * step(0.18, vPat.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.38, spot * uPatOn);
    `,
  },
  brindle: {
    key: 'brindle',
    fragment: /* glsl */ `
      float front = smoothstep(0.25, 0.75, vPat.z / 1.5) * step(0.45, vPat.y);
      float band = step(0.6, fract(vPat.z * 16.0 + sin(vPat.y * 7.0) * 0.4));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.6, band * front * uPatOn);
    `,
  },
};

function patternExt(name) {
  const p = PATTERN_EXT[name];
  return {
    key: p.key,
    vertexHead: 'attribute vec3 aPat;\nvarying vec3 vPat;\n',
    vertexBegin: 'vPat = aPat;\n',
    fragmentHead: 'varying vec3 vPat;\nuniform float uPatOn;\n',
    fragmentColor: p.fragment,
    uniforms: { uPatOn: { value: 1 } },
  };
}

const ANIMAL_RIGS = {
  hyena: {
    file: 'hyena',
    pattern: 'spots',
    paint: { Main: 0xa38d6d, Main_Light: 0xc9b48f, Nose: 0x1a120c, Eyes_Black: 'glow' },
    boss: { Main: 0x7b6a55, Main_Light: 0xa8957a },
    patterned: ['Main', 'Main_Light'],
    // a sloping back and a heavier head read as hyena rather than wolf
    bones: { 'BackUpperLeg.L': 0.86, 'BackUpperLeg.R': 0.86, Head: 1.12, 'Ear1.L': 0.75, 'Ear1.R': 0.75 },
    clips: { run: 'Gallop', walk: 'Walk', idle: 'Idle' },
    speed: { run: 0.85, walk: 1, idle: 1 },
    size: 0.62, // the wolf model stands taller than a hyena
  },
  zebra: {
    file: 'zebra',
    pattern: 'stripes',
    paint: { Main: 0xf3efe6, Main_Dark: 0xf3efe6, Main_Light: 0xf3efe6, Hair: 0x1a1816, Hooves: 0x1d1b1a, Muzzle: 0x26221f },
    patterned: ['Main', 'Main_Dark', 'Main_Light'],
    clips: { run: 'Gallop', walk: 'Walk', idle: ['Idle', 'Eating'] },
    speed: { run: 0.8, walk: 1, idle: 1 },
  },
  wildebeest: {
    file: 'buffalo',
    pattern: 'brindle',
    paint: { Main: 0x5d5852, Main_Light: 0x45403b, Horns: 0x2b2723, Muzzle: 0x1f1c1a, Hooves: 0x1f1c1a },
    patterned: ['Main'],
    bones: { Head: 1.08 },
    clips: { run: 'Gallop', walk: 'Walk', idle: ['Idle', 'Eating'] },
    speed: { run: 0.8, walk: 1, idle: 1 },
  },
  buffalo: {
    file: 'buffalo',
    paint: { Main: 0x2f2926, Main_Light: 0x3d3531, Horns: 0x544c44, Muzzle: 0x1a1614, Hooves: 0x151210 },
    clips: { run: 'Gallop', walk: 'Walk', idle: ['Idle', 'Eating'] },
    speed: { run: 0.75, walk: 1, idle: 1 },
  },
};

const animalMats = new Map();
const patternReady = new WeakSet();
const refSizes = new Map();

/** Writes each vertex's bind-pose position (in units of body height) as `aPat`, once per geometry. */
function addPatternCoords(space) {
  const box = skinnedBox(space);
  const H = box.max.y - box.min.y;
  space.updateMatrixWorld(true);
  const inv = space.matrixWorld.clone().invert();
  space.traverse((o) => {
    if (!o.isSkinnedMesh || patternReady.has(o.geometry)) return;
    const n = o.geometry.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      o.getVertexPosition(i, v3).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      a[i * 3] = (v3.x - box.min.x) / H;
      a[i * 3 + 1] = (v3.y - box.min.y) / H;
      a[i * 3 + 2] = (v3.z - box.min.z) / H;
    }
    o.geometry.setAttribute('aPat', new THREE.BufferAttribute(a, 3));
    patternReady.add(o.geometry);
  });
}

function animalMaterial(kind, spec, name, src, boss) {
  const key = `${kind}|${boss ? 'boss' : ''}|${name}`;
  if (animalMats.has(key)) return animalMats.get(key);
  const paint = { ...spec.paint, ...(boss ? spec.boss : {}) };
  const c = paint[name];
  let m;
  if (c === 'glow') m = basic(0xffe14d);
  else {
    const ext = spec.pattern && spec.patterned?.includes(name) ? patternExt(spec.pattern) : undefined;
    m = flat(c ?? src.color.clone(), {}, ext);
  }
  animalMats.set(key, m);
  return m;
}

function buildAnimal(kind, gltf, height, boss) {
  const spec = ANIMAL_RIGS[kind];
  const space = new THREE.Group();
  const model = cloneSkinned(gltf.scene);
  space.add(model);
  if (spec.pattern) addPatternCoords(space);

  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isMesh) return;
    o.material = animalMaterial(kind, spec, o.material.name, o.material, boss);
    o.frustumCulled = false;
  });
  for (const [name, s] of Object.entries(spec.bones ?? {})) bones[boneKey(name)]?.scale.multiplyScalar(s);

  const box = skinnedBox(space);
  const k = height / (box.max.y - box.min.y);
  model.scale.multiplyScalar(k);
  model.position.y -= box.min.y * k;
  model.position.z -= ((box.min.z + box.max.z) / 2) * k;
  model.position.x -= ((box.min.x + box.max.x) / 2) * k;

  if (boss && bones.Neck2) {
    // Fisi's tattered red bandana
    space.updateMatrixWorld(true);
    const neck = boneBox(space, [bones.Neck1, bones.Neck2, bones.Neck3].filter(Boolean));
    const n = neck.getCenter(new THREE.Vector3());
    const ns = neck.getSize(new THREE.Vector3());
    const g = new THREE.Group();
    const red = mat(0xb3261e);
    const r = ns.x * 0.72;
    const band = mesh(G.cyl, red, r, ns.y * 0.25, Math.max(r, ns.z * 0.75), n.x, n.y - ns.y * 0.12, n.z);
    band.rotation.x = 0.35;
    g.add(band);
    const knot = mesh(G.cone4, red, 0.14, 0.3, 0.05, n.x, n.y - ns.y * 0.35, n.z + ns.z * 0.25);
    knot.rotation.x = 2.8;
    g.add(knot);
    bakeRigid(g);
    attach(space, bones.Neck2, g);
  }

  const clips = gltf.animations;
  const anim = new Animator(space, model, clips);
  return { space, anim, lock: [bones.Body].filter(Boolean) };
}

/**
 * Wraps a procedural animal factory (facing -z, `update(dt, rate, mode)`) so a rigged model
 * replaces it as soon as the file is ready. Kinds without a rig pass straight through.
 */
export function riggedAnimal(kind, makeFallback, { boss = false } = {}) {
  const spec = ANIMAL_RIGS[kind];
  if (!spec) return makeFallback();
  const file = load(spec.file);

  const root = new THREE.Group();
  let fallback = null;
  let rig = null;
  const holder = new THREE.Group();
  holder.rotation.y = Math.PI;
  root.add(holder);

  // the rig is sized to match the procedural model's height (before any wrapper scale)
  const ref = () => {
    const key = kind + boss;
    if (!refSizes.has(key)) {
      const probe = fallback ?? makeFallback();
      const h = new THREE.Box3().setFromObject(probe.root).getSize(new THREE.Vector3()).y;
      refSizes.set(key, h / probe.root.scale.y);
    }
    return refSizes.get(key);
  };

  const swapIn = () => {
    if (rig || !file.gltf) return;
    rig = buildAnimal(kind, file.gltf, ref() * (spec.size ?? 1), boss);
    holder.add(rig.space);
    // inherit shadow casting from the stand-in (the game sets it when the animal is created)
    let shadows = false;
    fallback?.root.traverse((o) => o.isMesh && o.castShadow && (shadows = true));
    rig.space.traverse((o) => o.isMesh && (o.castShadow = shadows));
    if (fallback) fallback.root.visible = false;
    // stagger herds so they don't move in lockstep
    rig.anim.mixer.setTime(Math.random() * 3);
  };

  if (!file.gltf) {
    fallback = makeFallback();
    root.add(fallback.root);
    // procedural animals may scale themselves (the boss is bigger); keep that on the wrapper
    root.scale.copy(fallback.root.scale);
    fallback.root.scale.setScalar(1);
    file.promise.then(swapIn);
  } else {
    if (boss) root.scale.setScalar(1.12);
    swapIn();
  }

  let mode = '';
  let idleClip = null;
  let idleT = 0;
  return {
    root,
    get rigged() {
      return !!rig;
    },
    update(dt, rate = 1, nextMode = 'run') {
      if (!rig) return fallback?.update(dt, rate, nextMode);
      const clips = spec.clips;
      let name = clips[nextMode] ?? clips.run;
      if (Array.isArray(name)) {
        // idle herds alternate between standing and grazing
        if ((idleT -= dt) <= 0 || mode !== nextMode) {
          idleClip = name[Math.floor(Math.random() * name.length)];
          idleT = 4 + Math.random() * 6;
        }
        name = idleClip;
      }
      mode = nextMode;
      const a = rig.anim.play(name, { fade: 0.3 });
      if (a) a.timeScale = (spec.speed[nextMode] ?? 1) * (nextMode === 'idle' ? 1 : Math.max(0.3, rate));
      rig.anim.update(dt, null, rig.lock);
    },
  };
}
