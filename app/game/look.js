import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { REGIONS } from '../data/regions.js';

/**
 * "Golden hour" rendering: real shadows near the runner, bloom on bright things
 * (sun, seeds, totems, fireflies), per-region colour grading and a soft vignette.
 * Phones that can't keep up drop to the Low tier automatically.
 */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.08 },
    uContrast: { value: 1.05 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSat; uniform float uContrast; uniform vec3 uTint; uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.5) * uContrast + 0.5;
      c.rgb *= uTint;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = c;
    }`,
};

// per-region grading: saturation, contrast, tint
const GRADES = {
  serengeti: [1.1, 1.05, '#fff6ea'],
  ngorongoro: [1.12, 1.04, '#f4fff0'],
  kilimanjaro: [0.95, 1.06, '#eef4ff'],
  selous: [1.08, 1.05, '#fbffef'],
  zanzibar: [1.18, 1.04, '#f2fffe'],
  mara: [1.12, 1.07, '#fff0e2'],
  amboseli: [1.02, 1.04, '#fff8ec'],
  bwindi: [1.0, 1.03, '#effff0'],
};
const G = REGIONS.map((r) => {
  const [s, c, t] = GRADES[r.id] ?? [1.08, 1.05, '#ffffff'];
  return { s, c, t: new THREE.Color(t) };
});

export function detectQuality(pref) {
  if (pref === 'high' || pref === 'low') return pref;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = navigator.deviceMemory ?? 4;
  const ua = navigator.userAgent || '';
  // Budget Androids report 8 cores and 4 GB yet struggle with shadows and bloom (and some fail
  // to build those shaders at all), so they need more headroom before High is the default.
  if (/Android/i.test(ua)) return cores >= 8 && mem >= 8 ? 'high' : 'low';
  return cores >= 6 && mem >= 4 ? 'high' : 'low';
}

export class Look {
  constructor(renderer, scene, camera, world, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.focus = new THREE.Vector3();
    this.tint = new THREE.Color();
    this.vignetteEl = document.createElement('div');
    this.vignetteEl.className = 'vignette';
    document.body.appendChild(this.vignetteEl);

    // warm fill from behind the camera so faces turned toward us aren't muddy
    this.fill = new THREE.DirectionalLight(0xffe2c0, 0.55);
    this.fill.position.set(4, 10, 20);
    scene.add(this.fill);

    const sun = world.sun;
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.left = -10;
    cam.right = 10;
    cam.top = 16;
    cam.bottom = -10;
    cam.near = 1;
    cam.far = 140;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun.target);

    this.set(quality);
  }

  set(quality) {
    const high = quality === 'high';
    if (this.quality === quality) return;
    this.quality = quality;
    const r = this.renderer;
    r.shadowMap.enabled = high;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.world.sun.castShadow = high;
    this.world.setDetail(high);
    // materials must recompile when the shadow setup changes
    this.scene.traverse((o) => {
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
    });
    this.vignetteEl.style.display = high ? 'none' : 'block';
    if (high && !this.composer) this.buildComposer();
    this.fpsLow = 0;
  }

  buildComposer() {
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: r.getPixelRatio() < 2 ? 2 : 0, stencilBuffer: true });
    this.composer = new EffectComposer(r, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.55, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.resize();
  }

  resize() {
    if (!this.composer) return;
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(r.getPixelRatio());
    this.composer.setSize(size.x, size.y);
    this.bloom.resolution.set(size.x / 2, size.y / 2);
  }

  /** Keeps the shadow frustum hugging the runner and blends the region grade. */
  update(dt, focusX, night) {
    const sun = this.world.sun;
    if (sun.castShadow) {
      this.focus.set(focusX * 0.6, 0, -5);
      sun.target.position.copy(this.focus);
      sun.position.copy(this.world.sunDir).multiplyScalar(70).add(this.focus);
      sun.target.updateMatrixWorld();
    }
    if (this.grade) {
      const m = this.world.blend;
      const a = G[m.a];
      const b = G[m.b];
      const u = this.grade.uniforms;
      u.uSat.value = THREE.MathUtils.lerp(a.s, b.s, m.t) * (1 - night * 0.15);
      u.uContrast.value = THREE.MathUtils.lerp(a.c, b.c, m.t);
      u.uTint.value.copy(a.t).lerp(b.t, m.t);
      this.bloom.strength = 0.5 + night * 0.35;
    }
  }

  render() {
    if (this.quality === 'high' && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Called once a second with the measured frame rate; bails out of High if it struggles. */
  watch(fps, auto) {
    if (!auto || this.quality !== 'high') return false;
    this.fpsLow = fps < 40 ? this.fpsLow + 1 : 0;
    if (this.fpsLow >= 4) {
      this.set('low');
      return true;
    }
    return false;
  }
}
