import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Shared "curved world" uniform. Every world material bends vertices downward
 * (and slightly sideways) with distance from the camera, giving the classic
 * rolling-horizon look of lane runners.
 */
export const curve = { value: new THREE.Vector2(0, 0.0007) };

const BEND = /* glsl */ `
  float bendD = max(-mvPosition.z, 0.0);
  bendD *= bendD;
  mvPosition.x += uCurve.x * bendD;
  mvPosition.y -= uCurve.y * bendD;
  gl_Position = projectionMatrix * mvPosition;
`;

/** Shared clock for wind, water and shimmer. */
export const time = { value: 0 };

/**
 * Makes a material curve with the world. `ext` can inject extra GLSL:
 *   { key, vertexHead, vertexBegin, fragmentHead, fragmentColor, fragmentLight, uniforms }
 * `fragmentLight` is inserted after Lambert lighting, still before tone mapping.
 */
export function bend(material, ext = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurve = curve;
    shader.uniforms.uTime = time;
    Object.assign(shader.uniforms, ext.uniforms ?? {});
    let vs = 'uniform vec2 uCurve;\nuniform float uTime;\n' + (ext.vertexHead ?? '') + shader.vertexShader;
    if (ext.vertexBegin) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + ext.vertexBegin);
    vs = vs.replace('#include <project_vertex>', THREE.ShaderChunk.project_vertex.replace('gl_Position = projectionMatrix * mvPosition;', BEND));
    shader.vertexShader = vs;
    if (ext.fragmentHead || ext.fragmentColor || ext.fragmentLight) {
      let fs = 'uniform float uTime;\n' + (ext.fragmentHead ?? '') + shader.fragmentShader;
      if (ext.fragmentColor) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + ext.fragmentColor);
      if (ext.fragmentLight) {
        const lit = 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';
        fs = fs.replace(lit, `${lit}\n${ext.fragmentLight}`);
      }
      shader.fragmentShader = fs;
    }
  };
  const key = 'bend' + (ext.key ?? '');
  material.customProgramCacheKey = () => key;
  return material;
}

/**
 * Ground, path and lane albedo that Lambert is not allowed to crush to black.
 * MeshLambert divides by π, and a low sun (or the night hemi) then tone-maps
 * the trail into a void. This floor keeps a share of the surface colour —
 * region tint, grass noise, worn lanes — in front of the runner at every
 * time of day. It is one value for the whole journey, not a per-region hack.
 */
export const GROUND_LIFT = 1.45;
const groundLiftUniform = { value: GROUND_LIFT };
export const GROUND_LIGHT = {
  fragmentHead: 'uniform float uGroundLift;\n',
  // Gamma below 1 lifts dark grass and lane pixels more than pale ones, so a
  // brown forest path and a golden savanna path both stay readable, and the
  // worn lanes stay darker than the ridges between them.
  // The floor is capped, so pale ground (Zanzibar's white sand) settles to a soft beige at
  // night instead of blowing out to white.
  fragmentLight: 'vec3 groundFloor = min(pow(max(diffuseColor.rgb, vec3(0.001)), vec3(0.62)) * uGroundLift, vec3(0.42));\noutgoingLight = max(outgoingLight, groundFloor);',
  uniforms: { uGroundLift: groundLiftUniform },
};

/* ---- wind: plants carry a per-vertex sway weight (0 at the roots, 1 at the tips) ---- */
const SWAY = {
  key: 'sway',
  vertexHead: 'attribute float aSway;\n',
  vertexBegin: /* glsl */ `
    #ifdef USE_INSTANCING
      vec4 swayW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    #else
      vec4 swayW = modelMatrix * vec4(transformed, 1.0);
    #endif
    float gust = sin(uTime * 0.7 + swayW.x * 0.05) * 0.5 + 0.8;
    transformed.x += sin(uTime * 1.9 + swayW.x * 0.35 + swayW.z * 0.21) * aSway * gust;
    transformed.z += cos(uTime * 1.4 + swayW.z * 0.3) * aSway * 0.55 * gust;
  `,
};
export const SWAY_EXT = SWAY;
let swayMatInst;
export function swayMat() {
  swayMatInst ??= bend(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), SWAY);
  return swayMatInst;
}

/**
 * Post-bake touches for static props: darken vertices near the ground (cheap ambient occlusion)
 * and, for plants, add the wind weight attribute and switch to the swaying material.
 */
export function finishProp(root, { ao = true, sway = 0 } = {}) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const v = new THREE.Vector3();
  let top = 0.01;
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && o.material.vertexColors && o.geometry.attributes.color) meshes.push(o);
  });
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) top = Math.max(top, v.fromBufferAttribute(pos, i).applyMatrix4(mtx).y);
  }
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    const col = m.geometry.attributes.color;
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const sw = sway ? new Float32Array(pos.count) : null;
    for (let i = 0; i < pos.count; i++) {
      const y = v.fromBufferAttribute(pos, i).applyMatrix4(mtx).y;
      if (ao) {
        const k = 0.58 + 0.42 * Math.min(1, Math.max(0, y / Math.min(1.4, top * 0.5)));
        col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
      }
      if (sw) sw[i] = Math.pow(Math.max(0, y) / top, 2) * sway;
    }
    if (sw) {
      m.geometry.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
      m.material = swayMat();
    }
  }
  return root;
}

/* ---- procedural textures (grayscale, tinted by material colour) ---- */
function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(g, s, n, rMin, rMax, light, dark) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() < 0.5 ? light : dark;
    g.fillStyle = `rgba(${v},${v},${v},${0.15 + Math.random() * 0.3})`;
    const r = rMin + Math.random() * (rMax - rMin);
    g.beginPath();
    g.ellipse(Math.random() * s, Math.random() * s, r, r * (0.5 + Math.random() * 0.6), Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
}

let pathTex;
/** Packed-earth trail: speckles, three worn lanes, tyre tracks and footprints. */
export function pathTexture() {
  return (pathTex ??= canvasTex(512, (g, s) => {
    g.fillStyle = '#e6e6e6';
    g.fillRect(0, 0, s, s);
    speckle(g, s, 2600, 0.6, 2.6, 255, 150);
    const lane = s / 3.375; // the texture spans 3 lanes plus margins
    for (let l = -1; l <= 1; l++) {
      const cx = s / 2 + l * lane;
      const grd = g.createLinearGradient(cx - lane * 0.38, 0, cx + lane * 0.38, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0.16)');
      grd.addColorStop(0.42, 'rgba(70,70,70,0.42)');
      grd.addColorStop(1, 'rgba(255,255,255,0.16)');
      g.fillStyle = grd;
      g.fillRect(cx - lane * 0.38, 0, lane * 0.76, s);
      // tyre tracks
      for (const off of [-0.22, 0.22]) {
        g.fillStyle = 'rgba(70,70,70,0.16)';
        g.fillRect(cx + off * lane - 5, 0, 10, s);
        for (let y = 0; y < s; y += 9) {
          g.fillStyle = 'rgba(60,60,60,0.12)';
          g.fillRect(cx + off * lane - 5, y, 10, 3);
        }
      }
      // footprints of everyone who ran before you
      for (let y = 0; y < s; y += 34) {
        const side = (y / 34) % 2 ? 1 : -1;
        g.fillStyle = 'rgba(70,70,70,0.18)';
        g.beginPath();
        g.ellipse(cx + side * 7 + (Math.random() - 0.5) * 4, y + Math.random() * 6, 3.4, 6, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // pale ridges between the three running lanes so the corridors stay obvious
    for (const edge of [-0.5, 0.5]) {
      const x = s / 2 + edge * lane;
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(x - 5, 0, 10, s);
    }
    speckle(g, s, 140, 2, 6, 120, 90);
  }));
}

let grassTex;
/** Fine grassy noise for the plains, repeated many times across each tile. */
export function grassTexture() {
  return (grassTex ??= canvasTex(256, (g, s) => {
    g.fillStyle = '#d8d8d8';
    g.fillRect(0, 0, s, s);
    speckle(g, s, 900, 1, 4, 255, 150);
    for (let i = 0; i < 1600; i++) {
      const v = Math.random() < 0.6 ? 120 : 255;
      g.strokeStyle = `rgba(${v},${v},${v},0.25)`;
      g.lineWidth = 1;
      const x = Math.random() * s;
      const y = Math.random() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 5);
      g.stroke();
    }
  }, [36, 4]));
}

/* ---- water: shallows to deep, lapping shore, sky reflection and sun glitter ---- */

/** Sky and sun the water reflects, kept in step with the time of day by world.setTime. */
export const waterLight = {
  uSkyCol: { value: new THREE.Color(0xbfd8e0) },
  uSunCol: { value: new THREE.Color(0xffffff) },
  uSunDir: { value: new THREE.Vector3(-0.45, 0.4, -1).normalize() },
};

// Shared wave field, in world space so neighbouring tiles and lane pieces join seamlessly.
// waveN returns the surface normal of four travelling swells plus a fine chop.
const WATER_HEAD = /* glsl */ `
  uniform vec3 uSkyCol;
  uniform vec3 uSunCol;
  uniform vec3 uSunDir;
  varying vec3 vWaterW;
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 waveN(vec2 p, vec2 flow, float calm) {
    vec2 d = vec2(0.0);
    vec2 q = p - flow * uTime;
    d += cos(dot(q, vec2(0.31, 0.95)) * 0.9 + uTime * 1.3) * vec2(0.31, 0.95) * 0.9 * 0.10;
    d += cos(dot(q, vec2(-0.72, 0.69)) * 1.4 + uTime * 1.7) * vec2(-0.72, 0.69) * 1.4 * 0.06;
    d += cos(dot(q, vec2(0.93, -0.36)) * 2.3 + uTime * 2.2) * vec2(0.93, -0.36) * 2.3 * 0.035;
    d += cos(dot(q, vec2(-0.2, -0.98)) * 3.7 + uTime * 2.9) * vec2(-0.2, -0.98) * 3.7 * 0.02;
    d += (vec2(wNoise(q * 1.9 + uTime * 0.6), wNoise(q.yx * 1.9 - uTime * 0.5)) - 0.5) * 0.35;
    return normalize(vec3(-d.x * calm, 1.0, -d.y * calm));
  }
  // Sky reflection (Schlick fresnel) and a hard sun glitter; strength fades as the sun sets.
  vec3 waterSurface(vec3 lit, vec3 N, out float fres) {
    vec3 V = normalize(cameraPosition - vWaterW);
    fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 col = mix(lit, uSkyCol, clamp(fres, 0.0, 0.45));
    float day = smoothstep(-0.05, 0.25, uSunDir.y);
    vec3 R = reflect(-uSunDir, N);
    float rv = max(dot(R, V), 0.0);
    col += uSunCol * (pow(rv, 220.0) * 2.4 + pow(rv, 28.0) * 0.18) * day;
    return col;
  }
`;

/**
 * Lakes, rivers and the sea beside the trail. Tinted by `color`: the shallows run pale and
 * clear with caustics over the bed, the deep water darkens and takes the sky at grazing
 * angles, and at the shore the swash slides up the beach and back with a frothy edge,
 * leaving wet sand behind. `open` turns the shore off (the horizon sea).
 */
export function waterMaterial(color, { open = false } = {}) {
  const m = new THREE.MeshLambertMaterial({ color, transparent: true, depthWrite: false, fog: !open });
  return bend(m, {
    key: 'water',
    // the horizon sea stays flat: bending a 700 m disc would sink its far edge out of sight
    uniforms: { ...waterLight, uOpen: { value: open ? 1 : 0 }, ...(open ? { uCurve: { value: new THREE.Vector2(0, 0) } } : {}) },
    vertexHead: 'varying vec3 vWaterW;\n',
    vertexBegin: 'vWaterW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    fragmentHead: 'uniform float uOpen;\n' + WATER_HEAD,
    fragmentColor: /* glsl */ `
      vec2 wp = vWaterW.xz;
      // metres out from the waterline (negative: up the beach)
      float s = mix(abs(vWaterW.x) - 14.0, 60.0, uOpen);
      float deep = smoothstep(0.0, 34.0, s);
      vec3 base = diffuseColor.rgb;
      vec3 shallowC = mix(base, vec3(0.62, 1.0, 0.9), 0.22) * 1.06;
      vec3 deepC = base * vec3(0.3, 0.55, 0.72);
      diffuseColor.rgb = mix(shallowC, deepC, deep);
      // dancing caustics over the sandy bed
      vec2 cq = wp * 0.9;
      float ca = sin(cq.x * 1.7 + sin(cq.y * 1.3 + uTime * 1.1) * 1.6) * sin(cq.y * 1.9 + sin(cq.x * 1.1 - uTime * 1.2) * 1.6);
      diffuseColor.rgb += pow(abs(ca), 6.0) * 0.32 * (1.0 - smoothstep(0.0, 9.0, s)) * (1.0 - uOpen);
    `,
    fragmentLight: /* glsl */ `
      {
        float s = mix(abs(vWaterW.x) - 14.0, 60.0, uOpen);
        vec2 wp = vWaterW.xz;
        vec3 N = waveN(wp, vec2(0.0, -0.15), mix(0.55, 1.0, smoothstep(0.0, 6.0, s)));
        float fres;
        outgoingLight = waterSurface(outgoingLight, N, fres);
        // the swash: the waterline creeps up the beach and slips back, unevenly along the shore
        float nz = wNoise(vec2(wp.y * 0.12, 3.7)) * 2.0;
        float surge = 0.5 + 0.5 * sin(uTime * 0.85 + wp.y * 0.045 + nz);
        float edge = -2.2 + surge * 1.8;
        float froth = wNoise(wp * 2.6 + vec2(0.0, uTime * 0.4)) * 0.55 + wNoise(wp * 6.0 - uTime * 0.3) * 0.45;
        float lip = smoothstep(edge - 0.05, edge + 0.08, s) * (1.0 - smoothstep(edge + 0.25, edge + 0.9 + froth * 0.9, s));
        // a breaker rolling in from the deep, fading as it comes
        float ph = fract(uTime * 0.11 + wNoise(vec2(wp.y * 0.03, 1.3)) * 0.35);
        float lineAt = mix(11.0, edge + 0.6, ph);
        float breaker = (1.0 - smoothstep(0.0, 0.55 + froth * 0.6, abs(s - lineAt))) * sin(ph * 3.14159) * step(froth, 0.78);
        float foam = clamp(lip * (0.55 + froth * 0.7) + breaker * 0.75, 0.0, 1.0) * (1.0 - uOpen);
        outgoingLight = mix(outgoingLight, vec3(1.0) * (0.55 + 0.45 * max(uSunCol.r, 0.4)), foam * 0.9);
        // up the beach: no water, only a darker band of wet sand that dries as the swash retreats
        float wet = (1.0 - smoothstep(edge - 2.4, edge, s)) * step(s, edge) * (1.0 - uOpen);
        float inWater = step(edge, s);
        float alpha = mix(0.0, 0.72 + 0.26 * smoothstep(0.0, 5.0, s), inWater);
        alpha = max(alpha, foam);
        alpha = mix(alpha, 0.22, wet * (1.0 - inWater));
        outgoingLight = mix(outgoingLight, vec3(0.0), wet * (1.0 - inWater));
        diffuseColor.a = clamp(alpha, 0.0, 1.0);
      }
    `,
  });
}

/**
 * Rivers cutting the trail: deep water racing sideways, foam streaked along the current and
 * white water churning against both banks (`half` = half the river's length along the run).
 * Opaque, since the channel sits below the ground. Same wave field as the lakes.
 */
const streamCache = new Map();
export function streamMaterial(color, half = 1.6) {
  const key = `${color}|${half}`;
  if (streamCache.has(key)) return streamCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color });
  const out = bend(m, {
    key: 'stream',
    uniforms: { ...waterLight, uHalf: { value: half } },
    vertexHead: 'varying vec3 vWaterW;\nvarying vec3 vStreamL;\n',
    vertexBegin: 'vWaterW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvStreamL = position;',
    fragmentHead: 'uniform float uHalf;\nvarying vec3 vStreamL;\n' + WATER_HEAD,
    fragmentLight: /* glsl */ `
      {
        vec2 wp = vWaterW.xz;
        vec3 N = waveN(wp * 1.4, vec2(-2.2, 0.0), 0.8);
        float fres;
        vec3 lit = max(outgoingLight, diffuseColor.rgb * 0.5) * 1.15; // stays readable at dusk, like the trail
        outgoingLight = mix(lit, waterSurface(lit, N, fres), 0.35);
        // streaks of foam carried by the current, white water against both banks
        float streak = wNoise(vec2(wp.x * 0.7 + uTime * 2.6, wp.y * 3.2));
        float edge = abs(vStreamL.y);
        float bank = smoothstep(uHalf - 0.9, uHalf - 0.05, edge);
        float foam = clamp(smoothstep(0.8, 0.95, streak) * 0.55 + bank * (0.35 + 0.65 * streak), 0.0, 1.0);
        // deeper (darker) mid-stream, so it reads as a river you can't wade
        outgoingLight *= mix(0.72, 1.0, bank);
        outgoingLight = mix(outgoingLight, vec3(0.95) * (0.6 + 0.4 * max(uSunCol.r, 0.4)), foam * 0.85);
      }
    `,
  });
  streamCache.set(key, out);
  return out;
}

const matCache = new Map();

/** Flat-shaded, curved, cached lambert material. */
export function mat(color, opts = {}) {
  const key = `${color}|${opts.emissive ?? ''}|${opts.transparent ? opts.opacity : ''}|${opts.flat === false ? 's' : 'f'}`;
  let m = matCache.get(key);
  if (!m) {
    m = bend(
      new THREE.MeshLambertMaterial({
        color,
        flatShading: opts.flat !== false,
        emissive: opts.emissive ?? 0x000000,
        transparent: !!opts.transparent,
        opacity: opts.opacity ?? 1,
        depthWrite: opts.transparent ? false : true,
      }),
    );
    m.userData.bakeable = !opts.emissive && !opts.transparent;
    matCache.set(key, m);
  }
  return m;
}

/** One shared vertex-coloured material: every rigid part bakes into a single draw call. */
let vcMat;
export function vertexColorMat() {
  vcMat ??= bend(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  return vcMat;
}

/** Unlit curved material (glows, shadows, decals). */
export function basic(color, opts = {}) {
  return bend(
    new THREE.MeshBasicMaterial({
      color,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.depthWrite ?? !opts.transparent,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      map: opts.map ?? null,
      side: opts.side ?? THREE.FrontSide,
      fog: opts.fog ?? true,
      vertexColors: !!opts.vertexColors,
    }),
  );
}

// ---- Unit geometries, scaled per mesh -------------------------------------------------
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  boxLong: new THREE.BoxGeometry(1, 1, 1, 1, 1, 12), // long pieces need vertices along z to follow the curve
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  ball: new THREE.SphereGeometry(1, 28, 20),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl16: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone: new THREE.ConeGeometry(1, 1, 7),
  cone12: new THREE.ConeGeometry(1, 1, 12),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  dodec: new THREE.DodecahedronGeometry(1, 0),
};

/** Tapered cylinder geometry cache (top radius ratio). */
const taperCache = new Map();
export function taper(ratio, seg = 7) {
  const k = `${ratio}|${seg}`;
  if (!taperCache.has(k)) taperCache.set(k, new THREE.CylinderGeometry(ratio, 1, 1, seg));
  return taperCache.get(k);
}

export function mesh(geo, material, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

/**
 * Rotates one part and returns it, for `g.add(turn(mesh(...), 'x', a))`. (Chaining
 * `g.add(m).rotation` instead turns the whole group, since add() returns the parent.)
 */
export function turn(m, axis, angle) {
  m.rotation[axis] = angle;
  return m;
}

/** Soft round blob shadow texture. */
let shadowTex;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(40,20,5,0.55)');
  grd.addColorStop(0.6, 'rgba(40,20,5,0.25)');
  grd.addColorStop(1, 'rgba(40,20,5,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

let shadowMat;
/** Blob shadows soften when real shadow maps are on, so the two don't double up. */
let runnerShadowTex;
/** A darker, crisper blob for the runner, so their shadow reads on pale sand and snow. */
export function runnerShadowTexture() {
  if (runnerShadowTex) return runnerShadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(25,14,4,0.82)');
  grd.addColorStop(0.55, 'rgba(25,14,4,0.5)');
  grd.addColorStop(1, 'rgba(25,14,4,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  runnerShadowTex = new THREE.CanvasTexture(c);
  return runnerShadowTex;
}

export function setBlobStrength(v) {
  shadowMat ??= basic(0xffffff, { map: shadowTexture(), transparent: true, depthWrite: false });
  shadowMat.opacity = v;
}
export function blobShadow(w = 1, d = 1) {
  shadowMat ??= basic(0xffffff, { map: shadowTexture(), transparent: true, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(w, d, 1);
  m.position.y = 0.03;
  m.renderOrder = 1;
  return m;
}

/** Renders an emoji to a texture — used for ally totems and floating icons. */
const emojiCache = new Map();
export function emojiTexture(emoji, ring = '#ffd34d') {
  const key = emoji + ring;
  if (emojiCache.has(key)) return emojiCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,250,220,1)');
  grd.addColorStop(0.7, ring);
  grd.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  emojiCache.set(key, t);
  return t;
}

/**
 * Merges the direct mesh children of every group in `root` by material.
 * Hierarchy (and therefore animation pivots) is preserved, but a 40-piece
 * low-poly animal drops from ~40 draw calls to a handful.
 */
export function bakeRigid(root, deep = false) {
  // (geometry merge happens first; finishProp() can add AO/wind afterwards)
  if (deep) flatten(root);
  const groups = [];
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints) groups.push(o);
  });
  for (const node of groups) {
    const buckets = new Map();
    for (const c of node.children) {
      if (!c.isMesh || c.isInstancedMesh || c.children.length || c.userData.keep) continue;
      const key = c.material.userData?.bakeable ? 'vc' : c.material;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    }
    for (const [key, list] of buckets) {
      if (list.length < 2) continue;
      const vc = key === 'vc';
      const material = vc ? vertexColorMat() : key;
      const keepUv = !!material.map;
      const geos = list.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        // geometry that brings its own shading (leaf clumps) keeps it, tinted by the material
        const shade = vc && g.attributes.color ? g.attributes.color : null;
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUv && k === 'uv')) g.deleteAttribute(k);
        if (vc) {
          const { r, g: gg, b } = m.material.color;
          const n = g.attributes.position.count;
          const col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) {
            const k = shade ? shade.getX(i) : 1;
            col.set([r * k, gg * k, b * k], i * 3);
          }
          g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mm = new THREE.Mesh(merged, material);
      mm.renderOrder = list[0].renderOrder;
      list.forEach((m) => node.remove(m));
      node.add(mm);
    }
  }
  return root;
}

/** Re-parents every nested mesh directly under `root`, preserving its transform. */
function flatten(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && o.parent !== root && !o.children.length) meshes.push(o);
  });
  const m4 = new THREE.Matrix4();
  for (const m of meshes) {
    m4.multiplyMatrices(inv, m.matrixWorld);
    m.parent.remove(m);
    m4.decompose(m.position, m.quaternion, m.scale);
    root.add(m);
  }
  for (const c of [...root.children]) if (c.isGroup && !c.children.length) root.remove(c);
}
