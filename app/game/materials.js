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
 *   { key, vertexHead, vertexBegin, fragmentHead, fragmentColor, uniforms }
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
    if (ext.fragmentHead || ext.fragmentColor) {
      let fs = 'uniform float uTime;\n' + (ext.fragmentHead ?? '') + shader.fragmentShader;
      if (ext.fragmentColor) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + ext.fragmentColor);
      shader.fragmentShader = fs;
    }
  };
  const key = 'bend' + (ext.key ?? '');
  material.customProgramCacheKey = () => key;
  return material;
}

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
      const grd = g.createLinearGradient(cx - lane * 0.32, 0, cx + lane * 0.32, 0);
      grd.addColorStop(0, 'rgba(90,90,90,0)');
      grd.addColorStop(0.5, 'rgba(90,90,90,0.22)');
      grd.addColorStop(1, 'rgba(90,90,90,0)');
      g.fillStyle = grd;
      g.fillRect(cx - lane * 0.32, 0, lane * 0.64, s);
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

/* ---- water: moving ripples, sparkles and a foamy shore edge ---- */
export function waterMaterial(color) {
  const m = new THREE.MeshLambertMaterial({ color, emissive: 0x0a2a30, transparent: true, opacity: 0.94 });
  return bend(m, {
    key: 'water',
    vertexHead: 'varying vec3 vWaterW;\n',
    vertexBegin: 'vWaterW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    fragmentHead: 'varying vec3 vWaterW;\n',
    fragmentColor: /* glsl */ `
      vec2 wp = vWaterW.xz;
      float r1 = sin(wp.x * 0.9 + uTime * 1.3) * sin(wp.y * 0.7 - uTime * 1.1);
      float r2 = sin((wp.x + wp.y) * 0.45 + uTime * 0.8);
      float ripple = r1 * 0.6 + r2 * 0.4;
      diffuseColor.rgb *= 0.9 + ripple * 0.12;
      float glint = smoothstep(0.88, 1.0, sin(wp.x * 2.3 + uTime * 2.1) * sin(wp.y * 1.9 - uTime * 1.7));
      diffuseColor.rgb += glint * 0.55;
      float shore = smoothstep(4.0, 0.0, abs(abs(vWaterW.x) - 14.3));
      float foam = shore * (0.55 + 0.45 * sin(wp.y * 0.8 + uTime * 2.4));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), clamp(foam, 0.0, 0.85));
    `,
  });
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
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 7),
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
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUv && k === 'uv')) g.deleteAttribute(k);
        if (vc) {
          const { r, g: gg, b } = m.material.color;
          const n = g.attributes.position.count;
          const col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) col.set([r, gg, b], i * 3);
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
