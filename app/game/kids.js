import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { G, bakeRigid, basic, bend, mat, mesh } from './materials.js';
import { PAT, PATTERN_GLSL } from './rigkit.js';

/**
 * The runners as fully modelled, motion-captured-style characters: Quaternius Universal Base
 * Characters (CC0) animated with the Universal Animation Library (CC0), built by
 * scripts/build-kids.mjs. Each runner is dressed in code: skin tone, an outfit painted onto
 * the body (with kitenge, shuka and jersey patterns), hair, and their kit (headwrap, cap,
 * hat, beads, braids, shuka, backpack, shoes).
 *
 * The hand-built runner from people.js stands in until the files arrive, so a run never
 * waits on the network and still works offline.
 */

const BASE = `${import.meta.env.BASE_URL}models/`;
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
        console.warn(`[kids] ${name} unavailable, keeping the hand-built runner`, err);
        return null;
      });
    files.set(name, entry);
  }
  return files.get(name);
}

/** Starts fetching what the chosen runner needs. */
export function preloadKids(runnerId) {
  load(`kid-${LOOKS[runnerId]?.body ?? 'male'}`);
  load('kid-clips');
}

/* ------------------------------------------------------------- the runners */
// Rest-pose measurements of the two bodies (T-pose, metres, facing +z).
const BODY = {
  male: { shoulder: 0.205, waist: 0.985, knee: 0.54, height: 1.81, neck: 1.5, wrist: 0.7 },
  female: { shoulder: 0.15, waist: 0.965, knee: 0.53, height: 1.77, neck: 1.46, wrist: 0.63 },
};

/**
 * How each runner is dressed. `sleeve` is where sleeves end along the arm (0 = sleeveless,
 * 1 = to the wrist); `hem` where shorts end down the thigh (0 = at the hip, 1 = at the knee,
 * 2 = full length).
 */
const LOOKS = {
  zuri: {
    body: 'female', hair: 'Hair_BuzzedFemale', sleeve: 0.35, hem: 0.55, height: 1.66,
    gear: ['wrap', 'shuka', 'backpack', 'sandals'],
    wrapPat: { type: PAT.zigzag, color: 0xf4d35e, scale: 13 }, shukaPat: { type: PAT.check, color: 0x1b2a6b, scale: 16 },
  },
  juma: {
    body: 'male', hair: 'Hair_Buzzed', sleeve: 0.38, hem: 0.5, height: 1.7, socks: 0xffffff,
    shirtPat: { type: PAT.diagonal, color: 0x1e8f4e, scale: 9 }, sockPat: { type: PAT.stripesY, color: 0x1b998b, scale: 12 },
    gear: ['sweatband', 'boots'],
  },
  neema: {
    body: 'female', hair: 'Hair_Buns', sleeve: 0.3, hem: 0.2, height: 1.64,
    shirtPat: null, gear: ['skirt', 'collar', 'headband', 'bracelets', 'sandals'],
    skirtPat: { type: PAT.dots, color: 0xf4d35e, scale: 18 },
  },
  baraka: {
    body: 'male', hair: 'Hair_Buzzed', sleeve: 0.42, hem: 0.62, height: 1.72, vest: 0x5f6b3a,
    gear: ['hat', 'backpack', 'binoculars', 'boots'],
  },
  amani: {
    body: 'female', hair: 'Hair_BuzzedFemale', sleeve: 1, hem: 2, height: 1.68,
    shirtPat: { type: PAT.zigzag, color: 0x4de1ff, scale: 10 }, gear: ['braids', 'necklace', 'glowshoes'],
  },
  kito: {
    body: 'male', hair: 'Hair_Buzzed', sleeve: 0.5, hem: 0.7, height: 1.56,
    pantsPat: { type: PAT.stripesX, color: 0xd7263d, scale: 22 }, gear: ['hightop', 'chain', 'goldshoes'],
  },
};

// Kit that belongs to the runner whatever they wear; clothes and shoes come with the outfit.
const OWN = new Set(['wrap', 'sweatband', 'collar', 'headband', 'bracelets', 'hat', 'binoculars', 'braids', 'necklace', 'hightop', 'chain']);
const SIGNATURE_SHOES = new Set(['glowshoes', 'goldshoes']);

/** The runner's look in the outfit chosen for the device (OUTFITS in content.js). */
function wear(def, outfit) {
  const own = LOOKS[def.id] ?? LOOKS.zuri;
  const cuts = {
    kit: { sleeve: 0, hem: 0.12, gear: own.gear.filter((k) => SIGNATURE_SHOES.has(k)) },
    jersey: {
      sleeve: 0.4, hem: 0.45, socks: 0xffffff, gear: ['boots'],
      shirtPat: { type: PAT.diagonal, color: def.accent, scale: 9 }, sockPat: { type: PAT.stripesY, color: def.accent, scale: 12 },
    },
    kanga: {
      sleeve: 0.35, hem: 2, gear: ['skirt', 'sandals'],
      shirtPat: { type: PAT.zigzag, color: def.accent, scale: 12 }, skirtPat: { type: PAT.dots, color: def.accent, scale: 18 },
    },
    vest: { sleeve: 0.42, hem: 0.62, shirt: 0xe4d2ae, vest: 0x5f6b3a, gear: ['backpack', 'boots'] },
    journey: { sleeve: 1, hem: 2, shukaPat: { type: PAT.check, color: def.accent, scale: 16 }, gear: ['shuka', 'backpack', 'sandals'] },
  };
  const cut = cuts[outfit];
  if (!cut) return own;
  const plain = { shirtPat: null, pantsPat: null, sockPat: null, socks: null, vest: null, shirt: null };
  return { ...own, ...plain, ...cut, gear: [...own.gear.filter((k) => OWN.has(k)), ...cut.gear] };
}

/* ---------------------------------------------------------- outfit shader */
/** Paints an outfit onto the body in rest-pose space and tints the skin. */
function dress(material, def, look, body) {
  const m = bend(material, {
    key: `kid-${def.id}`,
    vertexHead: 'attribute vec3 aBind;\nvarying vec3 vB;\n',
    vertexBegin: 'vB = aBind;\n',
    fragmentHead: /* glsl */ `
      varying vec3 vB;
      uniform vec3 uSkin, uShirt, uPants, uShoe, uSock, uShirtPC, uPantsPC, uSockPC, uVest;
      uniform vec4 uShirtPT, uCut;
      uniform vec3 uCut2;
      float clothMask;
    ` + PATTERN_GLSL,
    fragmentColor: /* glsl */ `
      float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      vec3 skinC = uSkin * clamp(lum / 0.42, 0.6, 1.3);
      float ax = abs(vB.x);
      float armRow = step(1.28, vB.y);                      // arms stretch out at shoulder height
      float arm = step(uCut.x, ax) * armRow;
      float neck = step(length(vec2(vB.x, vB.z + 0.02)), 0.085) * step(uCut2.z - 0.06 - 0.05 * step(0.0, vB.z), vB.y);
      float torso = (1.0 - arm) * step(uCut.z, vB.y) * step(vB.y, uCut2.z + 0.08) * (1.0 - neck);
      float shirt = max(torso, arm * step(ax, uCut.y));
      float pants = (1.0 - arm) * step(uCut.w, vB.y) * step(vB.y, uCut.z);
      float shoe = step(vB.y, 0.105);
      float sock = step(vB.y, uCut2.x) * (1.0 - shoe);
      // a vest over the shirt, open down the front
      float vest = torso * uShirtPT.z * (1.0 - step(abs(vB.x), 0.035) * step(0.0, vB.z));
      vec3 shirtC = mix(mix(uShirt, uShirtPC, patternMask(vB * uShirtPT.y, uShirtPT.x)), uVest, vest);
      vec3 pantsC = mix(uPants, uPantsPC, patternMask(vB * uCut2.y, uShirtPT.w));
      vec3 sockC = mix(uSock, uSockPC, patternMask(vB * 12.0, 2.0) * step(0.5, uCut2.x));
      vec3 c = skinC;
      c = mix(c, sockC, sock);
      c = mix(c, pantsC, pants);
      c = mix(c, shirtC, shirt);
      c = mix(c, uShoe, shoe);
      clothMask = clamp(shirt + pants + shoe + sock, 0.0, 1.0);
      diffuseColor.rgb = c;
    `,
  });
  const pat = (p) => (p ? new THREE.Vector2(p.type, p.scale) : new THREE.Vector2(0, 1));
  const sp = pat(look.shirtPat);
  const pp = pat(look.pantsPat);
  const sleeveX = body.shoulder + (body.wrist - body.shoulder) * look.sleeve;
  const hemY = look.hem >= 2 ? 0.12 : body.waist - (body.waist - body.knee - 0.04) * look.hem - 0.04;
  const uniforms = {
    uSkin: { value: new THREE.Color(def.skin).multiplyScalar(1.15) },
    uShirt: { value: new THREE.Color(look.shirt ?? def.shirt) },
    uPants: { value: new THREE.Color(def.dress ?? def.pants) },
    uShoe: { value: new THREE.Color(look.gear.includes('sandals') ? def.skin : def.shoes) },
    uSock: { value: new THREE.Color(look.socks ?? def.skin) },
    uShirtPC: { value: new THREE.Color(look.shirtPat?.color ?? look.shirt ?? def.shirt) },
    uPantsPC: { value: new THREE.Color(look.pantsPat?.color ?? def.pants) },
    uSockPC: { value: new THREE.Color(look.sockPat?.color ?? 0xffffff) },
    uVest: { value: new THREE.Color(look.vest ?? look.shirt ?? def.shirt) },
    // x: pattern, y: scale, z: vest on, w: trouser pattern
    uShirtPT: { value: new THREE.Vector4(sp.x, sp.y, look.vest ? 1 : 0, pp.x) },
    uCut: { value: new THREE.Vector4(body.shoulder, look.sleeve > 0 ? sleeveX : 0, body.waist, hemY) },
    // x: sock top, y: trouser pattern scale, z: neckline
    uCut2: { value: new THREE.Vector3(look.socks ? 0.36 : 0, pp.y, body.neck) },
  };
  const compile = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    // fabric hides the body's muscle detail and is matte
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, clothMask * 0.8));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.62, 0.88, clothMask);');
  };
  return m;
}

/* -------------------------------------------------------------- the kit */
const v3 = new THREE.Vector3();
const m4 = new THREE.Matrix4();

function localTo(space, obj, target = new THREE.Matrix4()) {
  return target.copy(space.matrixWorld).invert().multiply(obj.matrixWorld);
}

/** Re-parents `piece` (built in `space` coordinates, rest pose) onto `bone`. */
function attach(space, bone, piece) {
  space.updateMatrixWorld(true);
  m4.copy(localTo(space, bone)).invert().multiply(piece.matrix.compose(piece.position, piece.quaternion, piece.scale));
  m4.decompose(piece.position, piece.quaternion, piece.scale);
  bone.add(piece);
  piece.traverse((o) => o.isMesh && ((o.castShadow = true), (o.frustumCulled = false)));
  return piece;
}

/** Box around the skin that `bones` mostly drive, in `space` coordinates (rest pose). */
function boneBox(space, mesh, bones) {
  const box = new THREE.Box3();
  space.updateMatrixWorld(true);
  const inv = space.matrixWorld.clone().invert();
  const idx = bones.map((b) => mesh.skeleton.bones.indexOf(b)).filter((i) => i >= 0);
  const { skinIndex, skinWeight } = mesh.geometry.attributes;
  for (let i = 0; i < skinIndex.count; i++) {
    for (let j = 0; j < 4; j++) {
      if (idx.includes(skinIndex.getComponent(i, j)) && skinWeight.getComponent(i, j) > 0.5) {
        box.expandByPoint(mesh.getVertexPosition(i, v3).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv));
        break;
      }
    }
  }
  return box;
}

const dark = (c, k = 0.75) => new THREE.Color(c).multiplyScalar(k).getHex();

/** Builds one piece of kit in rest-pose model space; returns [boneName, group]. */
function buildGear(kind, def, look, f) {
  const g = new THREE.Group();
  const { head: H, hs, chest: C, pelvis: P } = f;
  const r = Math.max(hs.x, hs.z) * 0.52;
  const top = H.y + hs.y * 0.5;
  const accent = mat(def.accent, { flat: false });
  switch (kind) {
    case 'wrap': {
      const wm = patterned(def.accent, look.wrapPat);
      g.add(mesh(G.sphere, wm, r * 1.12, r * 0.78, r * 1.16, H.x, top - r * 0.38, H.z - r * 0.06));
      g.add(mesh(G.sphere, wm, r * 0.85, r * 0.62, r * 0.85, H.x, top + r * 0.12, H.z - r * 0.35));
      g.add(mesh(G.sphere, mat(dark(def.accent), { flat: false }), r * 0.4, r * 0.34, r * 0.34, H.x + r * 0.15, top - r * 0.4, H.z - r * 1.12));
      return ['Head', g];
    }
    case 'sweatband':
      g.add(new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, r * 0.13, 6, 24), mat(0x1b998b, { flat: false })));
      g.children[0].rotation.x = Math.PI / 2 - 0.2;
      g.children[0].position.set(H.x, top - r * 0.55, H.z);
      return ['Head', g];
    case 'headband': {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.04, r * 0.12, 6, 24), patterned(def.accent, { type: PAT.stripesX, color: 0xffffff, scale: 50 }));
      t.rotation.x = Math.PI / 2 - 0.25;
      t.position.set(H.x, top - r * 0.5, H.z);
      g.add(t);
      return ['Head', g];
    }
    case 'hat':
      g.add(mesh(G.cyl, accent, r * 0.92, r * 0.75, r * 0.92, H.x, top - r * 0.05, H.z));
      g.add(mesh(G.cyl, mat(dark(def.accent, 0.55), { flat: false }), r * 0.96, r * 0.2, r * 0.96, H.x, top - r * 0.35, H.z));
      g.add(mesh(G.cyl, accent, r * 1.7, r * 0.06, r * 1.7, H.x, top - r * 0.45, H.z));
      return ['Head', g];
    case 'hightop': {
      const hair = mat(def.hair ?? 0x120c08, { flat: false });
      g.add(mesh(G.sphere, hair, r * 1.02, r * 0.95, r * 1.06, H.x, top + r * 0.12, H.z + r * 0.02));
      g.add(mesh(G.sphere, mat(def.accent, { flat: false }), r * 0.86, r * 0.32, r * 0.9, H.x, top + r * 0.72, H.z + r * 0.02));
      return ['Head', g];
    }
    case 'braids': {
      const hair = mat(def.hair ?? 0x120c08, { flat: false });
      const bead = basic(def.accent);
      g.add(mesh(G.sphere, hair, r * 0.55, r * 0.45, r * 0.55, H.x, top - r * 0.05, H.z - r * 0.55));
      for (let i = 0; i < 11; i++) {
        const a = -1.2 + (i / 10) * 2.4;
        const sx = Math.sin(a) * r * 0.95;
        const sz = -Math.cos(a) * r * 0.55 - r * 0.45;
        const start = new THREE.Vector3(H.x + sx, top - r * 0.5, H.z + sz);
        const end = new THREE.Vector3(H.x + sx * 1.25, C.y + 0.02, H.z + sz - 0.07);
        const len = start.distanceTo(end);
        const b = mesh(G.cyl, hair, 0.008, len, 0.008);
        b.position.copy(start).add(end).multiplyScalar(0.5);
        b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
        g.add(b);
        g.add(mesh(G.sphere, bead, 0.016, 0.019, 0.016, end.x, end.y, end.z));
      }
      return ['Head', g];
    }
    case 'collar': {
      const ring = patterned(0xd7263d, { type: PAT.rings, color: 0xffffff, scale: 30 });
      g.add(mesh(G.cyl, ring, 0.19, 0.016, 0.17, C.x, f.neckBase - 0.015, C.z + 0.005));
      g.add(mesh(G.cyl, mat(0x2e86ab, { flat: false }), 0.1, 0.02, 0.095, C.x, f.neckBase - 0.005, C.z + 0.005));
      return ['spine_03', g];
    }
    case 'necklace':
    case 'chain': {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 5, 18), kind === 'chain' ? mat(0xf4c430, { flat: false }) : basic(def.accent));
      t.rotation.x = Math.PI / 2 - 0.6;
      t.position.set(C.x, f.neckBase - 0.05, C.z + 0.04);
      g.add(t);
      return ['spine_03', g];
    }
    case 'shuka': {
      // a cloth band wrapped over one shoulder and under the other arm
      const base = def.scarf ?? def.accent;
      const pat = look.shukaPat && { ...look.shukaPat, color: def.scarfPattern ?? dark(base, 0.45) };
      const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 6, 32), patterned(base, pat));
      band.rotation.x = Math.PI / 2;
      band.scale.set(0.2, 0.135, 0.5);
      const tilt = new THREE.Group();
      tilt.position.set(C.x, C.y - 0.02, C.z - 0.005);
      tilt.rotation.z = -0.78;
      tilt.add(band);
      g.add(tilt);
      return ['spine_03', g];
    }
    case 'backpack': {
      const c = def.backpack ?? 0x3f6b3a;
      g.add(mesh(G.box, mat(c, { flat: false }), 0.27, 0.32, 0.13, C.x, C.y - 0.05, C.z - 0.17));
      g.add(mesh(G.box, mat(dark(c, 0.7), { flat: false }), 0.28, 0.07, 0.14, C.x, C.y + 0.09, C.z - 0.17));
      return ['spine_03', g];
    }
    case 'binoculars':
      for (const x of [-0.028, 0.028]) {
        const b = mesh(G.cyl, mat(0x2a2a2a), 0.022, 0.06, 0.022, C.x + x, C.y - 0.04, C.z + 0.16);
        b.rotation.x = Math.PI / 2;
        g.add(b);
      }
      return ['spine_03', g];
    case 'skirt': {
      const sk = patterned(def.dress ?? def.pants, look.skirtPat);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.36, 18, 1, true), sk);
      s.material.side = THREE.DoubleSide;
      s.position.set(P.x, P.y - 0.12, P.z + 0.01);
      g.add(s);
      return ['pelvis', g];
    }
    case 'bracelets':
      return null;
  }
  return null;
}

const patMats = new Map();
/** A curved-world material carrying one of the rig patterns (kitenge, shuka...). */
function patterned(color, pat) {
  const key = `${color}|${pat?.type}|${pat?.scale}|${pat?.color}`;
  if (patMats.has(key)) return patMats.get(key);
  const m = bend(new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), {
    key: `kidpat${pat?.type ?? 0}`,
    vertexHead: 'varying vec3 vP;\n',
    vertexBegin: 'vP = position;\n',
    fragmentHead: 'varying vec3 vP;\nuniform vec3 uPC;\nuniform vec2 uPT;\n' + PATTERN_GLSL,
    fragmentColor: 'diffuseColor.rgb = mix(diffuseColor.rgb, uPC, patternMask(vP * uPT.y, uPT.x));\n',
  });
  const compile = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    compile(sh, r);
    sh.uniforms.uPC = { value: new THREE.Color(pat?.color ?? color) };
    sh.uniforms.uPT = { value: new THREE.Vector2(pat?.type ?? 0, pat?.scale ?? 1) };
  };
  patMats.set(key, m);
  return m;
}

/** Sneakers (or sandals) over the feet: a rounded shoe on each foot bone. */
function buildShoes(space, body, bones, def, look) {
  const kind = look.gear.find((k) => /boots|sandals|glowshoes|goldshoes/.test(k)) ?? 'trainers';
  const color = kind === 'goldshoes' ? 0xf4c430 : kind === 'glowshoes' ? 0x101828 : def.shoes;
  const upper = mat(color, { flat: false });
  const sole = mat(kind === 'sandals' ? def.shoes : 0xf2ece0, { flat: false });
  for (const side of ['l', 'r']) {
    const foot = bones[`foot_${side}`];
    if (!foot) continue;
    space.updateMatrixWorld(true);
    const p = new THREE.Vector3().setFromMatrixPosition(localTo(space, foot));
    const g = new THREE.Group();
    if (kind === 'sandals') {
      g.add(mesh(G.box, sole, 0.1, 0.02, 0.27, p.x, 0.01, p.z + 0.08));
      g.add(mesh(G.box, upper, 0.1, 0.015, 0.03, p.x, 0.05, p.z + 0.12));
    } else {
      g.add(mesh(G.sphere, upper, 0.062, 0.06, 0.15, p.x, 0.055, p.z + 0.07));
      g.add(mesh(G.box, sole, 0.12, 0.025, 0.29, p.x, 0.012, p.z + 0.08));
      if (kind === 'boots') g.add(mesh(G.cyl, upper, 0.06, 0.12, 0.06, p.x, 0.12, p.z));
      if (kind === 'glowshoes') g.add(mesh(G.box, basic(def.accent), 0.124, 0.012, 0.292, p.x, 0.03, p.z + 0.08));
    }
    attach(space, foot, g);
  }
}

/**
 * Rest-pose positions in metres as an attribute, once per body. (The compressed meshes store
 * quantised positions, so the outfit can't be measured from `position` directly.)
 */
function addBindPositions(space, o) {
  if (o.geometry.attributes.aBind) return;
  space.updateMatrixWorld(true);
  const inv = space.matrixWorld.clone().invert();
  const n = o.geometry.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    o.getVertexPosition(i, v3).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
    a[i * 3] = v3.x;
    a[i * 3 + 1] = v3.y;
    a[i * 3 + 2] = v3.z;
  }
  o.geometry.setAttribute('aBind', new THREE.BufferAttribute(a, 3));
}

/* -------------------------------------------------------------- assembly */
const CLIP = {
  run: 'Sprint_Loop', idle: 'Idle_Loop', hello: 'Yes', jump: 'NinjaJump_Start', air: 'NinjaJump_Idle_Loop',
  slide: 'Slide_Start', slideLoop: 'Slide_Loop', ride: 'Driving_Loop', fly: 'Swim_Idle_Loop', dead: 'Death01', hit: 'Hit_Chest',
};

function buildKid(def, look, gltf, clipsGltf) {
  const body = BODY[look.body];
  const space = new THREE.Group();
  const model = cloneSkinned(gltf.scene);
  space.add(model);
  model.traverse((o) => o.isSkinnedMesh && /superhero/i.test(o.name) && addBindPositions(space, o));
  model.scale.setScalar(look.height / body.height);
  space.updateMatrixWorld(true);

  const bones = {};
  let bodyMesh = null;
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    if (/superhero/i.test(o.name)) {
      bodyMesh = o;
      o.material = dress(o.material.clone(), def, look, body);
    } else if (/^Hair_/.test(o.name)) {
      o.visible = o.name === look.hair && !look.gear.includes('wrap') && !look.gear.includes('hat');
      o.material = bend(new THREE.MeshStandardMaterial({ color: def.hair ?? 0x120c08, roughness: 0.9, map: o.material.map, normalMap: o.material.normalMap }));
    } else if (/Eyebrows/.test(o.name)) {
      o.material = bend(new THREE.MeshStandardMaterial({ color: def.hair ?? 0x120c08, roughness: 0.9, map: o.material.map, transparent: o.material.transparent, alphaTest: 0.4 }));
    } else {
      o.material = bend(o.material.clone());
    }
  });
  // short buzzed hair sits under a high-top or a wrap; keep it for texture
  if (look.gear.includes('hightop')) model.traverse((o) => o.name === look.hair && (o.visible = true));

  // landmarks for the kit, measured on the rest pose
  const headBox = boneBox(space, bodyMesh, [bones.Head]);
  const f = {
    head: headBox.getCenter(new THREE.Vector3()),
    hs: headBox.getSize(new THREE.Vector3()),
    chest: new THREE.Vector3().setFromMatrixPosition(localTo(space, bones.spine_03)),
    pelvis: new THREE.Vector3().setFromMatrixPosition(localTo(space, bones.pelvis)),
    neckBase: new THREE.Vector3().setFromMatrixPosition(localTo(space, bones.neck_01)).y,
  };
  for (const kind of look.gear) {
    const built = buildGear(kind, def, look, f);
    if (!built || !bones[built[0]]) continue;
    bakeRigid(built[1]);
    attach(space, bones[built[0]], built[1]);
  }
  buildShoes(space, body, bones, def, look);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const c of clipsGltf.animations) actions[c.name] = mixer.clipAction(c);
  return { space, mixer, actions, root: bones.root, pelvis: bones.pelvis };
}

/**
 * Wraps the hand-built runner (`fallback`, from people.js) and swaps the modelled character in
 * once loaded, dressed in `outfit`. Same API: `root`, `shadow`, `update(dt, speed, state)`, `hit()`.
 */
export function makeKidRunner(def, fallback, outfit = 'kit') {
  const root = fallback.root;
  const holder = new THREE.Group();
  holder.rotation.y = Math.PI; // the models face +z; runners look down the track (-z)
  root.add(holder);
  let kid = null;
  let current = null;
  let state = '';
  let hitT = 0;
  let helloT = 0;
  let airT = 0;
  let slideT = 0;
  let rideY = 0;

  const play = (name, { fade = 0.2, once = false, speed = 1, restart = false } = {}) => {
    const next = kid.actions[name];
    if (!next) return null;
    next.timeScale = speed;
    if (current === next && !restart) return next;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (current && current !== next) next.crossFadeFrom(current, fade, false);
    else next.fadeIn(fade);
    next.play();
    current = next;
    return next;
  };

  const api = {
    root,
    shadow: fallback.shadow,
    ready: false,
    hit() {
      hitT = 0.45;
      fallback.hit?.();
    },
    update(dt, speed, next) {
      if (!kid) return fallback.update(dt, speed, next);
      const was = state;
      state = next;
      switch (next) {
        case 'run':
          if (hitT > 0) {
            hitT -= dt;
            play(CLIP.hit, { fade: 0.06, once: true, speed: 1.4 });
          } else play(CLIP.run, { fade: was === 'slide' || was === 'jump' ? 0.12 : 0.2, speed: 0.7 + speed * 0.018 });
          break;
        case 'jump':
          if (was !== 'jump') {
            play(CLIP.jump, { fade: 0.06, once: true, speed: 1.6, restart: true });
            airT = 0;
          }
          if ((airT += dt) > 0.22) play(CLIP.air, { fade: 0.15 });
          break;
        case 'slide':
          if (was !== 'slide') {
            play(CLIP.slide, { fade: 0.06, once: true, speed: 1.8, restart: true });
            slideT = 0;
          }
          if ((slideT += dt) > 0.2) play(CLIP.slideLoop, { fade: 0.1 });
          break;
        case 'ride':
          play(CLIP.ride, { fade: 0.25 });
          break;
        case 'fly':
          play(CLIP.fly, { fade: 0.25 });
          break;
        case 'dead':
          play(CLIP.dead, { fade: 0.08, once: true });
          break;
        default:
          if (was !== 'idle') {
            play(CLIP.hello, { fade: 0.25, once: true, restart: true });
            helloT = 1.6;
          } else if ((helloT -= dt) <= 0) play(CLIP.idle, { fade: 0.4 });
      }
      kid.mixer.update(dt);
      // the game moves the runner; clips' root motion stays put
      if (kid.root) kid.root.position.set(0, kid.root.position.y, 0);
      if (kid.pelvis && next !== 'dead') {
        kid.pelvis.position.x = kid.pelvisRest.x;
        kid.pelvis.position.z = kid.pelvisRest.z;
      }
      rideY += ((next === 'ride' ? -0.45 : 0) - rideY) * Math.min(1, dt * 10);
      holder.position.y = rideY;
    },
  };

  const look = wear(def, outfit);
  const body = load(`kid-${look.body}`);
  const clips = load('kid-clips');
  Promise.all([body.promise, clips.promise]).then(([g, c]) => {
    if (!g || !c?.animations?.length) return;
    kid = buildKid(def, look, g, c);
    kid.pelvisRest = kid.pelvis.position.clone();
    holder.add(kid.space);
    for (const ch of [...root.children]) if (ch !== holder && ch !== fallback.shadow) ch.visible = false;
    api.ready = true;
    state = '';
  });
  return api;
}
