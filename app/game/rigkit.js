import * as THREE from 'three';
import { bend } from './materials.js';

/**
 * A small toolkit for authoring skinned, animated low-poly characters in code.
 *
 *   const b = new SkinBuilder([['hips', null, [0, 0.9, 0]], ['spine', 'hips', [0, 1.0, 0]], ...]);
 *   b.add(ellipsoid(center, radii), { color: 0x6b4226, bone: 'head' });
 *   b.add(tube(rings), {});              // rings carry their own colours and bone weights
 *   const mesh = b.build();              // one SkinnedMesh, one material, one draw call
 *   const clip = sampleClip('run', 0.7, (t) => ({ thighL: [Math.sin(t * TAU), 0, 0] }), b.boneNames);
 *
 * Everything is vertex-coloured and shaded through one shared curved-world material.
 * Fabric and coat patterns (kitenge zigzags, shuka checks, zebra stripes, giraffe patches,
 * spots) are painted per pixel in bind-pose space, so they ride along with the skin.
 */

export const TAU = Math.PI * 2;
const V = THREE.Vector3;

/* ------------------------------------------------------------- patterns */
export const PAT = {
  none: 0,
  stripesZ: 1, // bands along the body (zebra flanks)
  stripesY: 2, // horizontal hoops (legs, socks, kikoi)
  spots: 3, // cheetah, hyena
  patches: 4, // reticulated giraffe
  zigzag: 5, // kitenge print
  check: 6, // Maasai shuka
  dots: 7, // kanga
  diagonal: 8, // football jersey
  rings: 9, // beaded collar, around the y axis
  stripesX: 10, // vertical pinstripes
  hide: 11, // fine grain and a soft mottle: skin, hide, short fur
};

const PATTERN_GLSL = /* glsl */ `
  float hash3(vec3 c) { return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float patternMask(vec3 p, float type) {
    if (type < 0.5) return 0.0;
    if (type < 1.5) return step(0.55, fract(p.z + sin(p.y * 2.3) * 0.18));
    if (type < 2.5) return step(0.55, fract(p.y + sin(p.x * 2.0 + p.z * 2.0) * 0.06));
    if (type < 3.5) {
      vec3 cell = floor(p);
      float h = hash3(cell);
      vec3 off = vec3(fract(h * 7.13), fract(h * 13.37), fract(h * 3.71)) * 0.5 + 0.25;
      return step(length(fract(p) - off), 0.24) * step(0.25, h);
    }
    if (type < 4.5) {
      // distance to the nearest two cell centres: the gap between them is the cream line
      vec3 cell = floor(p);
      float f1 = 9.0, f2 = 9.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
        vec3 c = cell + vec3(float(x), float(y), float(z));
        vec3 o = c + vec3(hash3(c), hash3(c + 17.0), hash3(c + 31.0)) * 0.8 + 0.1;
        float d = length(p - o);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      return step(0.09, f2 - f1);
    }
    if (type < 5.5) {
      float zig = abs(fract(p.x + p.z) - 0.5) * 2.0;
      return step(0.5, fract(p.y + zig * 0.5));
    }
    if (type < 6.5) {
      float a = step(0.62, fract(p.x + p.z));
      float b = step(0.62, fract(p.y));
      return clamp(a * 0.6 + b * 0.6, 0.0, 1.0);
    }
    if (type < 7.5) {
      vec2 q = fract(vec2(p.x + p.z, p.y)) - 0.5;
      return step(length(q), 0.22);
    }
    if (type < 8.5) return step(0.6, fract((p.x + p.y) * 0.7));
    if (type < 9.5) return step(0.5, fract(length(p.xz)));
    if (type < 10.5) return step(0.6, fract(p.x + p.z * 0.3));
    float grain = hash3(floor(p * 14.0));
    float mottle = hash3(floor(p * 2.4));
    return smoothstep(0.4, 0.95, mottle) * 0.6 + step(0.8, grain) * 0.4;
  }
`;

const RIG_EXT = {
  key: 'rigkit',
  vertexHead: 'attribute vec3 aPatC;\nattribute vec2 aPatT;\nattribute float aGlow;\nvarying vec3 vBind;\nvarying vec3 vPatC;\nvarying vec2 vPatT;\nvarying float vGlow;\n',
  vertexBegin: 'vBind = position; vPatC = aPatC; vPatT = aPatT; vGlow = aGlow;\n',
  fragmentHead: 'varying vec3 vBind;\nvarying vec3 vPatC;\nvarying vec2 vPatT;\nvarying float vGlow;\n' + PATTERN_GLSL,
  fragmentColor: 'diffuseColor.rgb = mix(diffuseColor.rgb, vPatC, patternMask(vBind * vPatT.y, vPatT.x));\n',
};

const materials = new Map();
/**
 * Materials shared by every rigged character. `smooth` shades with vertex normals (rounded,
 * lifelike forms); `standard` adds a soft physically based sheen for skin, hair and fabric.
 */
export function rigMaterial({ smooth = true, standard = false, roughness = 0.74 } = {}) {
  const key = `${smooth}|${standard}|${roughness}`;
  if (materials.has(key)) return materials.get(key);
  const opts = { vertexColors: true, flatShading: !smooth };
  const m = bend(standard ? new THREE.MeshStandardMaterial({ ...opts, roughness, metalness: 0 }) : new THREE.MeshLambertMaterial(opts), { ...RIG_EXT, key: `rigkit${key}` });
  const compile = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    // glowing beads and trims light themselves
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vGlow;',
    );
  };
  materials.set(key, m);
  return m;
}

/* ----------------------------------------------------------- primitives */
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const Y = new V(0, 1, 0);

function place(geo, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  tmpM.compose(new V(...at), tmpQ.setFromEuler(new THREE.Euler(...rot)), new V(...scale));
  return geo.applyMatrix4(tmpM);
}

/** Ellipsoid centred at `c` with radii `r`. `opts.rot` tilts it. */
export function ellipsoid(c, r, seg = [10, 7], opts = {}) {
  return place(new THREE.SphereGeometry(1, seg[0], seg[1]), { at: c, scale: r, rot: opts.rot });
}

/** Part of a sphere from the top down to `theta` radians: caps, hair, hats. */
export function cap(c, r, theta = 1.3, opts = {}) {
  return place(new THREE.SphereGeometry(1, opts.seg ?? 12, 6, 0, TAU, 0, theta), { at: c, scale: r, rot: opts.rot });
}

export function box(c, size, rot = [0, 0, 0]) {
  return place(new THREE.BoxGeometry(...size), { at: c, rot });
}

/** Tapered cylinder from point a to point b. */
export function limb(a, b, ra, rb, seg = 7, open = false) {
  const A = new V(...a);
  const B = new V(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(rb, ra, len, seg, 1, open);
  tmpQ.setFromUnitVectors(Y, dir.normalize());
  tmpM.compose(A.clone().add(B).multiplyScalar(0.5), tmpQ, new V(1, 1, 1));
  return geo.applyMatrix4(tmpM);
}

export function cone(c, r, h, seg = 6, rot = [0, 0, 0]) {
  return place(new THREE.ConeGeometry(r, h, seg), { at: c, rot });
}

export function disc(c, rTop, rBottom, h, seg = 14, rot = [0, 0, 0]) {
  return place(new THREE.CylinderGeometry(rTop, rBottom, h, seg), { at: c, rot });
}

export function torus(c, r, tube, rot = [0, 0, 0], seg = [5, 12]) {
  return place(new THREE.TorusGeometry(r, tube, seg[0], seg[1]), { at: c, rot });
}

/**
 * A tube through `rings`: [{ p: [x,y,z], rx, ry, c?, w?, pat? }]. Each ring is an ellipse
 * across the path (rx sideways, ry in the path's "up"), so one call can build a torso,
 * a neck, a tail, a trunk or a leg. Per-ring colour and bone weights are interpolated
 * onto the ring's vertices; the ends are capped.
 */
export function tube(rings, seg = 8, { up = [0, 1, 0], caps = true, arc = null } = {}) {
  const pos = [];
  const meta = [];
  const index = [];
  const upV = new V(...up);
  const pts = rings.map((r) => new V(...r.p));
  // A partial arc (vest fronts, cloth edges) does not wrap. Angles follow the same
  // frame as a full tube: 0 is one side, half pi is "up" rotated onto the path.
  const partial = !!arc;
  const a0 = partial ? arc[0] : 0;
  const a1 = partial ? arc[1] : TAU;
  const verts = partial ? seg + 1 : seg;
  for (let i = 0; i < rings.length; i++) {
    const t = (i === 0 ? pts[1].clone().sub(pts[0]) : i === rings.length - 1 ? pts[i].clone().sub(pts[i - 1]) : pts[i + 1].clone().sub(pts[i - 1])).normalize();
    let side = new V().crossVectors(t, upV);
    if (side.lengthSq() < 1e-6) side = new V(1, 0, 0);
    side.normalize();
    const n = new V().crossVectors(side, t).normalize();
    const r = rings[i];
    for (let j = 0; j < verts; j++) {
      const a = partial ? a0 + (j / seg) * (a1 - a0) : (j / seg) * TAU;
      const v = pts[i].clone().addScaledVector(side, Math.cos(a) * r.rx).addScaledVector(n, Math.sin(a) * (r.ry ?? r.rx));
      pos.push(v.x, v.y, v.z);
      meta.push(i);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < (partial ? seg : seg); j++) {
      const a = i * verts + j;
      const b = partial ? a + 1 : i * verts + ((j + 1) % seg);
      const c = a + verts;
      const d = b + verts;
      index.push(a, c, b, b, c, d);
    }
  }
  if (caps && !partial) {
    for (const [i, flip] of [[0, true], [rings.length - 1, false]]) {
      const centre = pos.length / 3;
      pos.push(pts[i].x, pts[i].y, pts[i].z);
      meta.push(i);
      for (let j = 0; j < seg; j++) {
        const a = i * seg + j;
        const b = i * seg + ((j + 1) % seg);
        if (flip) index.push(centre, b, a);
        else index.push(centre, a, b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.userData.rings = rings;
  geo.userData.ringOf = meta;
  return geo;
}

/* -------------------------------------------------------------- builder */
const colorTmp = new THREE.Color();

export class SkinBuilder {
  /** `spec`: [[name, parentName|null, [x, y, z] model-space rest position], ...] */
  constructor(spec) {
    this.bones = {};
    this.list = [];
    this.index = {};
    for (const [name, parent, at] of spec) {
      const bone = new THREE.Bone();
      bone.name = name;
      bone.userData.at = new V(...at);
      if (parent) {
        const p = this.bones[parent];
        bone.position.copy(bone.userData.at).sub(p.userData.at);
        p.add(bone);
      } else bone.position.copy(bone.userData.at);
      this.index[name] = this.list.length;
      this.bones[name] = bone;
      this.list.push(bone);
    }
    this.boneNames = this.list.map((b) => b.name);
    this.parts = [];
  }

  /** Rest (model-space) position of a bone. */
  at(name) {
    return this.bones[name].userData.at.clone();
  }

  /**
   * Adds geometry. `color` is a hex or (vertex) => hex; `bone` a bone name or
   * (vertex) => [[name, weight], ...]. Tubes may instead carry `c` and `w` on each ring.
   * `pat`: { type, color, scale } paints a pattern; `glow` makes it emissive.
   */
  add(geo, { color = 0xffffff, bone, pat, glow = 0 } = {}) {
    this.parts.push({ geo, color, bone, pat, glow });
    return this;
  }

  build({ material = rigMaterial() } = {}) {
    const P = [];
    const N = [];
    const C = [];
    const SI = [];
    const SW = [];
    const PC = [];
    const PT = [];
    const GL = [];
    const I = [];
    const v = new V();
    for (const { geo, color, bone, pat, glow } of this.parts) {
      const g = geo.index ? geo : geo.toNonIndexed();
      if (!g.attributes.normal) g.computeVertexNormals();
      const pos = g.attributes.position;
      const nor = g.attributes.normal;
      const base = P.length / 3;
      const rings = geo.userData.rings;
      const ringOf = geo.userData.ringOf;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        P.push(v.x, v.y, v.z);
        N.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        const ring = rings?.[ringOf[i]];
        const ringPat = ring?.pat ?? pat;
        const c = ring?.c ?? color;
        colorTmp.set(typeof c === 'function' ? c(v) : c);
        C.push(colorTmp.r, colorTmp.g, colorTmp.b);
        let w = ring?.w ?? bone;
        if (typeof w === 'function') w = w(v);
        if (typeof w === 'string') w = [[w, 1]];
        const ws = w.slice(0, 4);
        let sum = 0;
        for (const [, x] of ws) sum += x;
        for (let k = 0; k < 4; k++) {
          SI.push(ws[k] ? this.index[ws[k][0]] : 0);
          SW.push(ws[k] ? ws[k][1] / sum : 0);
        }
        if (ringPat) {
          colorTmp.set(ringPat.color);
          PC.push(colorTmp.r, colorTmp.g, colorTmp.b);
          PT.push(ringPat.type, ringPat.scale ?? 1);
        } else {
          PC.push(0, 0, 0);
          PT.push(0, 1);
        }
        GL.push(ring?.glow ?? glow);
      }
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i++) I.push(base + idx[i]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    geo.setAttribute('aPatC', new THREE.Float32BufferAttribute(PC, 3));
    geo.setAttribute('aPatT', new THREE.Float32BufferAttribute(PT, 2));
    geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(GL, 1));
    geo.setIndex(I);
    geo.computeBoundingSphere();

    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.add(this.list[0]);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(this.list));
    return mesh;
  }
}

/** Weight helper: blends between two bones as `t(v)` goes 0 → 1. */
export function blend(a, b, t) {
  return (v) => {
    const k = Math.min(1, Math.max(0, t(v)));
    return [[a, 1 - k], [b, k]];
  };
}

/** Smooth 0..1 ramp. */
export function ramp(x, a, b) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ----------------------------------------------------------- animation */
const eul = new THREE.Euler();
const q = new THREE.Quaternion();

/**
 * Bakes `fn(t)` (t from 0 to 1) into a clip. Each pose maps bone names to Euler angles
 * [x, y, z]; `name@` keys offset that bone's position. Every bone in `bones` gets a track
 * (rest rotation when a pose leaves it out), so cross-fades never leave a joint stuck.
 */
export function sampleClip(name, duration, fn, builder, { fps = 30, moving = ['hips'] } = {}) {
  const frames = Math.max(2, Math.round(duration * fps) + 1);
  const times = new Float32Array(frames);
  const rot = {};
  const pos = {};
  for (const b of builder.boneNames) rot[b] = new Float32Array(frames * 4);
  for (const b of moving) if (builder.bones[b]) pos[b] = new Float32Array(frames * 3);
  for (let f = 0; f < frames; f++) {
    const t = f / (frames - 1);
    times[f] = t * duration;
    const pose = fn(t);
    for (const b of builder.boneNames) {
      const e = pose[b];
      if (e) q.setFromEuler(eul.set(e[0], e[1], e[2]));
      else q.identity();
      rot[b].set([q.x, q.y, q.z, q.w], f * 4);
    }
    for (const b of Object.keys(pos)) {
      const rest = builder.bones[b].position;
      const o = pose[`${b}@`] ?? [0, 0, 0];
      pos[b].set([rest.x + o[0], rest.y + o[1], rest.z + o[2]], f * 3);
    }
  }
  const tracks = [];
  for (const b of builder.boneNames) tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, rot[b]));
  for (const b of Object.keys(pos)) tracks.push(new THREE.VectorKeyframeTrack(`${b}.position`, times, pos[b]));
  return new THREE.AnimationClip(name, duration, tracks);
}

/** Interpolates between keyed poses: [[t, pose], ...] with eased segments. */
export function keyed(keys) {
  return (t) => {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i];
    const [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const k = t1 > t0 ? ramp(t, t0, t1) : 1;
    const out = {};
    for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[name] ?? [0, 0, 0];
      const y = b[name] ?? [0, 0, 0];
      out[name] = [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
    }
    return out;
  };
}

/** Thin layer over AnimationMixer: cross-fading loops and one-shots. */
export class Animator {
  constructor(mesh, clips) {
    this.mixer = new THREE.AnimationMixer(mesh);
    this.actions = {};
    for (const c of clips) this.actions[c.name] = this.mixer.clipAction(c);
    this.current = null;
  }

  play(name, { fade = 0.2, once = false, speed, restart = false } = {}) {
    const next = this.actions[name];
    if (!next) return null;
    if (speed != null) next.timeScale = speed;
    if (this.current === next && !restart) return next;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false);
    else next.fadeIn(fade);
    next.play();
    this.current = next;
    return next;
  }

  update(dt) {
    this.mixer.update(dt);
  }
}
