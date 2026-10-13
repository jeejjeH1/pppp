// v2 "A thread of light" — one particle system that flows between formations:
// logo -> chain -> web -> intelligent-contract core -> four reasons -> consensus -> logo.
// Everything is a pure function of time so frames render deterministically.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C, LOGO_POLYS } from '../palette.js';
import { makeLogoMesh } from '../logo.js';
import { Overlay } from '../overlay.js';
import { CUES, DURATION, FORMATIONS } from './timeline.js';

const W = 1920;
const H = 1080;
const N = 2600;
const RX = 2.9; // centre of the right-hand composition
const RY = 0.1;

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lin = (t, a, b) => clamp((t - a) / (b - a));
const mix = (a, b, k) => a + (b - a) * k;
const smooth = (x) => x * x * (3 - 2 * x);
const eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const TAU = Math.PI * 2;

// per-particle random numbers
const R = Array.from({ length: N }, (_, i) => [hash(i), hash(i + 1e3), hash(i + 2e3), hash(i + 3e3), hash(i + 4e3), hash(i + 5e3)]);
const gauss = (u, v) => Math.sqrt(-2 * Math.log(Math.max(u, 1e-6))) * Math.cos(TAU * v);

// ---------------------------------------------------------------- logo samples
function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const POLYS = Object.values(LOGO_POLYS);
const LOGO_PTS = [];
{
  // 35 % on outlines (crisp silhouette), the rest filling the shape
  const edges = [];
  let total = 0;
  for (const p of POLYS) for (let k = 0; k < p.length; k++) {
    const a = p[k];
    const b = p[(k + 1) % p.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    edges.push({ a, b, len });
    total += len;
  }
  let s = 1;
  for (let i = 0; i < N; i++) {
    if (hash(i + 77) < 0.35) {
      let d = hash(i + 91) * total;
      const e = edges.find((ed) => (d -= ed.len) < 0) || edges[0];
      const u = hash(i + 93);
      LOGO_PTS.push([mix(e.a[0], e.b[0], u), mix(e.a[1], e.b[1], u)]);
    } else {
      for (;;) {
        const x = 20 + hash(s++) * 362;
        const y = 34 + hash(s++) * 338;
        if (POLYS.some((p) => inPoly(x, y, p))) {
          LOGO_PTS.push([x, y]);
          break;
        }
      }
    }
  }
}

// web cluster centres (fibonacci sphere)
const NC = 16;
const CENTERS = Array.from({ length: NC }, (_, k) => {
  const y = 1 - (k / (NC - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const th = k * Math.PI * (3 - Math.sqrt(5));
  return [Math.cos(th) * r, y, Math.sin(th) * r];
});
const LINKS = [];
for (let a = 0; a < NC; a++) {
  const d = CENTERS.map((c, b) => [b, Math.hypot(c[0] - CENTERS[a][0], c[1] - CENTERS[a][1], c[2] - CENTERS[a][2])]).filter(([b]) => b !== a);
  d.sort((p, q) => p[1] - q[1]);
  for (const [b] of d.slice(0, 3)) if (a < b) LINKS.push([a, b]);
}
function webCenter(k, t) {
  const [x, y, z] = CENTERS[k];
  const a = t * 0.12;
  const rr = 2.6;
  return [RX + (x * Math.cos(a) + z * Math.sin(a)) * rr, RY + y * rr * 0.92, -0.6 + (-x * Math.sin(a) + z * Math.cos(a)) * rr];
}

// consensus layout
const LEADER = [0, -0.35, 0];
const VALID = Array.from({ length: 5 }, (_, k) => {
  const a = Math.PI * (0.92 - k * 0.21);
  return [Math.cos(a) * 3.7, -0.35 + Math.sin(a) * 1.75, -0.6];
});
const VOTE = (k) => 44.0 + k * 0.35;

// colours
const COL = { pink: new THREE.Color(C.pink), purple: new THREE.Color(C.purple), mint: new THREE.Color(C.mint), red: new THREE.Color('#ff4d7a'), white: new THREE.Color('#f4eaff') };
const BASE = R.map((r) => (r[5] < 0.42 ? COL.pink : r[5] < 0.72 ? COL.purple : COL.mint));

// ---------------------------------------------------------------- formations
// each returns [x, y, z, alpha, size, tintColor|null, tintAmount]
const OUT = [0, 0, 0, 1, 1, null, 0];
function set(x, y, z, a = 1, s = 1, tc = null, ta = 0) {
  OUT[0] = x; OUT[1] = y; OUT[2] = z; OUT[3] = a; OUT[4] = s; OUT[5] = tc; OUT[6] = ta;
  return OUT;
}

function sphereSurface(i, r, cx, cy, cz, t, spin = 0.3) {
  const [r0, r1] = R[i];
  const y = 1 - 2 * r0;
  const rr = Math.sqrt(1 - y * y);
  const th = r1 * TAU + t * spin;
  return [cx + Math.cos(th) * rr * r, cy + y * r, cz + Math.sin(th) * rr * r];
}

const F = {
  scatter(i, t) {
    const r = R[i];
    return set((r[0] - 0.5) * 18, (r[1] - 0.5) * 10 + Math.sin(t * 0.2 + r[3] * 6) * 0.2, (r[2] - 0.5) * 8 - 2, 0.35, 0.8);
  },
  drift(i, t) {
    const r = R[i];
    return set((r[0] - 0.5) * 17 + Math.sin(t * 0.15 + r[4] * 9) * 0.3, (r[1] - 0.5) * 10 + Math.sin(t * 0.2 + r[3] * 6) * 0.3, (r[2] - 0.5) * 8 - 3, 0.22, 0.8);
  },
  logo(i, t, size = 3.0, cx = 0, cy = 0.85) {
    const [px, py] = LOGO_PTS[i];
    const s = size / 340;
    const z = Math.sin(t * 1.4 + R[i][0] * 12) * 0.04 + (R[i][1] - 0.5) * 0.12;
    const grad = clamp((py - 34) / 338); // pink at the top, purple at the bottom
    return set(cx + (px - 200.5) * s, cy - (py - 203) * s, z, 1, 0.9, grad < 0.5 ? COL.pink : COL.purple, 0.75);
  },
  logoEnd(i, t) {
    return F.logo(i, t, 2.6, 0, 1.05);
  },
  chain(i, t) {
    const r = R[i];
    const k = i % 6;
    if (k === 5) {
      // lane walls: the chain lives inside a closed box
      const x = RX - 4 + r[1] * 8;
      const wall = r[2] < 0.5 ? 1.15 : -1.15;
      return set(x, RY + wall, (r[3] - 0.5) * 0.05, 0.55 * (1 - lin(t, 11.6, 12.4) * 0.6), 0.7, COL.mint, 0.8);
    }
    const spacing = 1.65;
    let cx = RX + (k - 2) * spacing + fract(t * 0.18) * spacing;
    if (cx > RX + 2.5 * spacing) cx -= 5 * spacing;
    const fade = clamp(1 - Math.abs(cx - RX) / (2.6 * spacing)) * 1.4;
    const h = 0.42;
    const e = Math.floor(r[0] * 12);
    const u = r[1] * 2 - 1;
    const sgn = (b) => ((e >> b) & 1 ? h : -h);
    let x;
    let y;
    let z;
    const axis = Math.floor(e / 4);
    if (axis === 0) [x, y, z] = [u * h, sgn(0), sgn(1)];
    else if (axis === 1) [x, y, z] = [sgn(0), u * h, sgn(1)];
    else [x, y, z] = [sgn(0), sgn(1), u * h];
    const a = t * 0.4 + k;
    const xr = x * Math.cos(a) - z * Math.sin(a);
    const zr = x * Math.sin(a) + z * Math.cos(a);
    return set(cx + xr, RY + y, zr, Math.min(1, fade), 0.9);
  },
  web(i, t) {
    const r = R[i];
    const k = i % NC;
    if (r[4] < 0.72) {
      const [cx, cy, cz] = webCenter(k, t);
      const s = 0.2;
      return set(cx + gauss(r[0], r[1]) * s, cy + gauss(r[2], r[3]) * s, cz + gauss(r[1], r[3]) * s, 0.95, 0.85);
    }
    // particles travelling along the links: information flowing
    const [a, b] = LINKS[i % LINKS.length];
    const pa = webCenter(a, t);
    const pb = webCenter(b, t);
    const u = fract(r[0] + t * 0.12 * (r[1] < 0.5 ? 1 : -1));
    return set(mix(pa[0], pb[0], u), mix(pa[1], pb[1], u), mix(pa[2], pb[2], u), 0.8, 0.6, COL.mint, 0.6);
  },
  core(i, t) {
    const r = R[i];
    if (r[4] < 0.55) {
      const ang = r[0] * TAU + t * 0.25;
      const tube = 0.07;
      const x = Math.cos(ang) * (1.75 + gauss(r[1], r[2]) * tube);
      const y = Math.sin(ang) * (1.75 + gauss(r[2], r[3]) * tube);
      const tilt = 0.35;
      return set(RX + x, RY + y * Math.cos(tilt), y * Math.sin(tilt), 1, 0.8);
    }
    if (r[4] < 0.78) {
      const ang = r[0] * TAU - t * 0.4;
      const x = Math.cos(ang) * 2.25;
      const y = Math.sin(ang) * 2.25;
      const tilt = -0.9;
      return set(RX + x * Math.cos(tilt), RY + y * 0.35, x * Math.sin(tilt), 0.75, 0.6, COL.mint, 0.7);
    }
    if (r[4] < 0.9) {
      // a small particle logo at the heart of the contract
      const [px, py] = LOGO_PTS[i];
      const s = 1.35 / 340;
      return set(RX + (px - 200.5) * s, RY - (py - 203) * s, Math.sin(t * 1.4 + r[0] * 12) * 0.03, 1, 0.75, COL.pink, 0.6);
    }
    // data streaming inward from the web into the contract
    const u = fract(r[1] + t * 0.3);
    const dir = [gauss(r[2], r[3]), gauss(r[3], r[0]), gauss(r[0], r[2]) * 0.5];
    const len = Math.hypot(...dir) || 1;
    const rad = mix(6, 0.5, u);
    return set(RX + (dir[0] / len) * rad, RY + (dir[1] / len) * rad * 0.8, (dir[2] / len) * rad, Math.sin(u * Math.PI), 0.7, COL.mint, 0.9);
  },
  evidence(i, t) {
    const r = R[i];
    // three sources converge, then resolve into a check mark
    const k = i % 3;
    const ang = Math.PI / 2 + k * (TAU / 3) + t * 0.1;
    const conv = smooth(lin(t, 26.6, 28.0));
    const rad = mix(1.9, 0.5, conv);
    const s = 0.28 * (1 - conv * 0.5);
    const cx = RX + Math.cos(ang) * rad + gauss(r[0], r[1]) * s;
    const cy = RY + Math.sin(ang) * rad + gauss(r[2], r[3]) * s;
    const cz = gauss(r[1], r[2]) * s;
    const ck = smooth(lin(t, 27.9, 28.9));
    if (ck <= 0) return set(cx, cy, cz, 0.9, 0.85);
    let x;
    let y;
    if (r[4] < 0.6) {
      const P = [[-0.85, 0.0], [-0.25, -0.6], [0.95, 0.75]];
      const u = r[0] * 1.6;
      const [a, b] = u < 0.6 ? [P[0], P[1]] : [P[1], P[2]];
      const v = u < 0.6 ? u / 0.6 : (u - 0.6);
      x = mix(a[0], b[0], v) * 1.15;
      y = mix(a[1], b[1], v) * 1.15;
    } else {
      const ang2 = r[0] * TAU;
      x = Math.cos(ang2) * 1.75;
      y = Math.sin(ang2) * 1.75;
    }
    return set(mix(cx, RX + x + gauss(r[1], r[2]) * 0.03, ck), mix(cy, RY + y + gauss(r[2], r[3]) * 0.03, ck), mix(cz, 0, ck), 1, 0.85, COL.mint, ck * 0.85);
  },
  grid(i, t) {
    const n = i % 1000;
    if (i >= 1000) return set(...gridHide(i, t));
    const gx = n % 40;
    const gy = Math.floor(n / 40);
    const x = (gx / 39 - 0.5) * 4.8;
    const y = (gy / 24 - 0.5) * 3.0;
    return set(RX + x, RY + y * 0.8, -y * 0.5, 0.9, 0.7, COL.white, 0.5);
  },
  wave(i, t) {
    const n = i % 1000;
    if (i >= 1000) return set(...gridHide(i, t));
    const gx = n % 40;
    const gy = Math.floor(n / 40);
    const x = (gx / 39 - 0.5) * 4.8;
    const y = (gy / 24 - 0.5) * 3.0;
    const z = Math.sin(x * 1.5 + t * 1.6) * Math.cos(y * 1.3 + t * 0.8) * 0.8;
    return set(RX + x, RY + y * 0.8 + z * 0.5, -y * 0.5 + z, 0.95, 0.75, COL.pink, 0.6);
  },
  agents(i, t) {
    const r = R[i];
    const A = [RX - 1.7, RY, 0];
    const B = [RX + 1.7, RY, 0];
    if (r[4] < 0.78) {
      const c = r[5] < 0.5 ? A : B;
      const [x, y, z] = sphereSurface(i, 0.62 + (r[3] - 0.5) * 0.1, c[0], c[1], c[2], t, r[5] < 0.5 ? 0.4 : -0.4);
      return set(x, y, z, 0.95, 0.8, r[5] < 0.5 ? COL.pink : COL.mint, 0.7);
    }
    // a value / result passing between the two agents
    const fwd = r[1] < 0.5;
    const u = fract(r[0] + t * 0.45);
    const [p, q] = fwd ? [A, B] : [B, A];
    const arc = Math.sin(u * Math.PI) * (fwd ? 0.95 : -0.95);
    return set(mix(p[0], q[0], u), p[1] + arc, 0, Math.sin(u * Math.PI), 0.7, fwd ? COL.pink : COL.mint, 0.8);
  },
  noise(i, t) {
    const r = R[i];
    const bad = r[3] < 0.3;
    const j = Math.sin(t * 9 + r[0] * 50) * 0.03;
    return set(RX + (r[0] - 0.5) * 5 + j, RY + (r[1] - 0.5) * 3.2 + j, (r[2] - 0.5) * 2, bad ? 1 : 0.75, 0.8, bad ? COL.red : null, bad ? 0.9 : 0);
  },
  filtered(i, t) {
    const r = R[i];
    if (r[3] < 0.3) {
      // misleading / outdated points drift away and fade
      return set(RX + (r[0] - 0.5) * 9, RY + (r[1] - 0.5) * 6, (r[2] - 0.5) * 4 - 2, 0.12, 0.6, COL.red, 0.9);
    }
    const lane = Math.floor(r[1] * 3);
    const x = (fract(r[0] + t * 0.05) - 0.5) * 5;
    return set(RX + x, RY + (lane - 1) * 0.6, 0, 0.95, 0.75, COL.mint, 0.85);
  },
  consensus(i, t) {
    const r = R[i];
    if (r[4] < 0.32) {
      const [x, y, z] = sphereSurface(i, 0.8, ...LEADER, t, 0.3);
      return set(x, y, z, 1, 0.85, t > 46 ? COL.mint : COL.pink, 0.7);
    }
    const k = i % 5;
    const v = VALID[k];
    const voted = t > VOTE(k);
    if (r[4] < 0.78) {
      const [x, y, z] = sphereSurface(i, 0.38, ...v, t, 0.5);
      return set(x, y, z, 1, 0.75, voted ? COL.mint : COL.purple, 0.75);
    }
    // evaluation requests travel leader -> validator, answers come back
    const u = fract(r[0] + t * 0.5);
    const back = voted && r[1] < 0.6;
    const [p, q] = back ? [v, LEADER] : [LEADER, v];
    return set(mix(p[0], q[0], u), mix(p[1], q[1], u), mix(p[2], q[2], u), Math.sin(u * Math.PI) * 0.9, 0.6, back ? COL.mint : COL.pink, 0.7);
  },
};
function gridHide(i, t) {
  const r = R[i];
  return [(r[0] - 0.5) * 18, (r[1] - 0.5) * 10 + Math.sin(t * 0.2 + r[3] * 6) * 0.2, (r[2] - 0.5) * 8 - 4, 0.15, 0.6, null, 0];
}

// ---------------------------------------------------------------- three setup
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
scene.add(new THREE.HemisphereLight('#d8c8ff', '#10041a', 0.6));
const key = new THREE.DirectionalLight('#ffffff', 1.2);
key.position.set(-3, 4, 8);
scene.add(key);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);

// background
const bgMat = new THREE.ShaderMaterial({
  depthTest: false,
  depthWrite: false,
  uniforms: { uC: { value: new THREE.Vector2(0.3, 0) }, uGlow: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform vec2 uC; uniform float uGlow;
    void main(){
      vec2 p = vUv - 0.5; p.x *= 1.7778;
      float r = length(p - uC);
      vec3 col = vec3(0.012, 0.006, 0.022);
      col += vec3(0.86, 0.0, 1.0) * 0.07 * uGlow * pow(smoothstep(1.1, 0.0, r), 1.8);
      col += vec3(0.66, 1.0, 0.82) * 0.012 * smoothstep(1.0, 0.0, length(p - vec2(-0.8, 0.5)));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bg.frustumCulled = false;
bg.renderOrder = -10;
scene.add(bg);

// particles
const pos = new Float32Array(N * 3);
const col = new Float32Array(N * 3);
const alpha = new Float32Array(N);
const size = new Float32Array(N);
const pgeo = new THREE.BufferGeometry();
pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
pgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
pgeo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
pgeo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
const points = new THREE.Points(
  pgeo,
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute float alpha; attribute float psize; varying vec3 vC; varying float vA;
      void main(){
        vC = color; vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * 5.2 * (14.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(vC * 1.25, core * vA);
      }`,
  }),
);
points.frustumCulled = false;
scene.add(points);

// lines between web clusters
const webLineGeo = new THREE.BufferGeometry();
webLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINKS.length * 6), 3));
const webLines = new THREE.LineSegments(webLineGeo, new THREE.LineBasicMaterial({ color: C.purple, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
webLines.frustumCulled = false;
scene.add(webLines);

// consensus lines + ripple
const conGeo = new THREE.BufferGeometry();
conGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 6), 3));
const conLines = new THREE.LineSegments(conGeo, new THREE.LineBasicMaterial({ color: C.pink, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
conLines.frustumCulled = false;
scene.add(conLines);
const ripple = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: C.mint, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scene.add(ripple);

// small solid logo at the heart of the intelligent-contract core
const coreLogo = makeLogoMesh({ size: 1.25, depth: 0.22, glow: 0.5, chrome: true });
coreLogo.position.set(RX, RY, 0);
scene.add(coreLogo);
const coreMats = new Set();
coreLogo.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => coreMats.add(m)));
for (const m of coreMats) m.transparent = true;

// post
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.75, 0.55, 0.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
fxaa.material.uniforms.resolution.value.set(1 / W, 1 / H);
composer.addPass(fxaa);
const fin = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uFade: { value: 1 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uFade; uniform float uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float vig = smoothstep(1.2, 0.3, length((vUv - 0.5) * vec2(1.6, 1.2)));
      c *= mix(0.6, 1.0, vig);
      c += (h(vUv * 1000.0 + uTime) - 0.5) * 0.016;
      gl_FragColor = vec4(c * uFade, 1.0);
    }`,
});
composer.addPass(fin);

const overlay = new Overlay(document.getElementById('overlay'), CUES);

// ---------------------------------------------------------------- frame
const TRANS = 1.9; // seconds for one particle's journey between formations
function keyIndex(t) {
  let k = 0;
  for (let i = 0; i < FORMATIONS.length; i++) if (t >= FORMATIONS[i].t) k = i;
  return k;
}
// 0..1 presence of a named formation at time t (for its companion meshes)
function weight(name, t) {
  let w = 0;
  FORMATIONS.forEach((f, i) => {
    if (f.f !== name) return;
    const next = FORMATIONS[i + 1]?.t ?? Infinity;
    w = Math.max(w, Math.min(smooth(lin(t, f.t, f.t + TRANS)), 1 - smooth(lin(t, next, next + TRANS * 0.6))));
  });
  return w;
}

const tmpC = new THREE.Color();
const prevC = new THREE.Color();
function evalF(name, i, t) {
  const o = F[name](i, t);
  return o;
}

function renderAt(t) {
  const k = keyIndex(t);
  const cur = FORMATIONS[k];
  const prev = FORMATIONS[Math.max(0, k - 1)];
  for (let i = 0; i < N; i++) {
    const r = R[i];
    const dur = cur.dur ?? TRANS;
    const p = smooth(clamp((t - cur.t - r[3] * 0.8 * (dur / TRANS)) / dur));
    const e = eInOut(p);
    let a;
    if (k > 0 && e < 1) {
      a = evalF(prev.f, i, t).slice();
      prevC.copy(BASE[i]);
      if (a[5]) prevC.lerp(a[5], a[6]);
    }
    const b = evalF(cur.f, i, t);
    tmpC.copy(BASE[i]);
    if (b[5]) tmpC.lerp(b[5], b[6]);
    if (a) {
      // travel along a gentle arc between formations
      const lift = Math.sin(e * Math.PI) * (r[2] - 0.5) * 1.2;
      pos[i * 3] = mix(a[0], b[0], e);
      pos[i * 3 + 1] = mix(a[1], b[1], e) + lift;
      pos[i * 3 + 2] = mix(a[2], b[2], e) + Math.sin(e * Math.PI) * (r[1] - 0.5) * 1.5;
      alpha[i] = mix(a[3], b[3], e);
      size[i] = mix(a[4], b[4], e);
      tmpC.lerp(prevC, 1 - e);
    } else {
      pos[i * 3] = b[0];
      pos[i * 3 + 1] = b[1];
      pos[i * 3 + 2] = b[2];
      alpha[i] = b[3];
      size[i] = b[4];
    }
    // gentle twinkle
    alpha[i] *= 0.85 + 0.15 * Math.sin(t * (1.5 + r[4] * 2) + r[0] * 40);
    col[i * 3] = tmpC.r;
    col[i * 3 + 1] = tmpC.g;
    col[i * 3 + 2] = tmpC.b;
  }
  // fade in from black at the very start
  const intro = smooth(lin(t, 0, 1.2));
  for (let i = 0; i < N; i++) alpha[i] *= intro;
  pgeo.attributes.position.needsUpdate = true;
  pgeo.attributes.color.needsUpdate = true;
  pgeo.attributes.alpha.needsUpdate = true;
  pgeo.attributes.psize.needsUpdate = true;

  // web links
  const ww = weight('web', t);
  webLines.visible = ww > 0.01;
  if (webLines.visible) {
    const lp = webLineGeo.attributes.position.array;
    LINKS.forEach(([a, b], j) => lp.set([...webCenter(a, t), ...webCenter(b, t)], j * 6));
    webLineGeo.attributes.position.needsUpdate = true;
    webLines.material.opacity = ww * 0.45;
  }
  // consensus lines + ripple
  const cw = weight('consensus', t);
  conLines.visible = cw > 0.01;
  if (conLines.visible) {
    const lp = conGeo.attributes.position.array;
    VALID.forEach((v, j) => lp.set([...LEADER, ...v], j * 6));
    conGeo.attributes.position.needsUpdate = true;
    conLines.material.opacity = cw * 0.35;
    conLines.material.color.set(t > 46 ? C.mint : C.pink);
  }
  const rp = lin(t, 46.0, 48.5);
  ripple.visible = rp > 0 && rp < 1;
  ripple.position.set(...LEADER);
  ripple.scale.setScalar(0.8 + smooth(rp) * 2.6);
  ripple.material.opacity = (1 - rp) * 0.25;

  // core logo
  const lw = weight('core', t);
  coreLogo.visible = false;
  coreLogo.rotation.set(Math.sin(t * 0.5) * 0.06, Math.sin(t * 0.35) * 0.18, 0);
  coreLogo.scale.setScalar(0.6 + 0.4 * lw);
  for (const m of coreMats) m.opacity = lw;

  // background glow follows the composition (centre for logo/consensus/triad, right otherwise)
  const centred = Math.max(weight('logo', t), weight('consensus', t), weight('drift', t), weight('logoEnd', t), t < 1 ? 1 : 0);
  bgMat.uniforms.uC.value.set(mix(0.3, 0, centred), mix(0, 0.05, centred));

  // slow camera drift
  camera.position.set(Math.sin(t * 0.07) * 0.5, Math.cos(t * 0.05) * 0.25, 14 - Math.sin(t * 0.04) * 0.4);
  camera.lookAt(0, 0.1, 0);

  fin.uniforms.uTime.value = t;
  fin.uniforms.uFade.value = Math.min(lin(t, 0, 0.6), 1 - lin(t, DURATION - 1.2, DURATION));
  composer.render();
  overlay.update(t);
  document.getElementById('overlay').style.opacity = String(1 - lin(t, DURATION - 1.2, DURATION));
}

window.DURATION = DURATION;
window.renderAt = renderAt;
await document.fonts.ready;
renderAt(0);
window.__ready = true;
