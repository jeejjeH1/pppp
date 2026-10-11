import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C } from './palette.js';
import { makeCharacter, makeHead } from './character.js';
import { makeLogoMesh } from './logo.js';
import { makeCardTexture, makeGlowSprite, makeCoinTexture } from './textures.js';
import { Overlay } from './overlay.js';
import { CUES, SCENES, IMPACTS, DURATION } from './timeline.js';

const W = 1920;
const H = 1080;

// ---------------------------------------------------------------- math helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lin = (t, a, b) => clamp((t - a) / (b - a));
const mix = (a, b, k) => a + (b - a) * k;
const eOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const eInExpo = (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
const eOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eOutBack = (x, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const eOutElastic = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
// in/out envelope: 0 -> 1 -> 0
const env = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(lin(t, a, a + fi), 1 - lin(t, b - fo, b));
const hash = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;

const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);

// lights
scene.add(new THREE.HemisphereLight('#c9b8ff', '#12051c', 0.45));
const key = new THREE.DirectionalLight('#ffffff', 1.3);
key.position.set(-4, 7, 9);
scene.add(key);
const rimPink = new THREE.PointLight(C.pink, 60, 30, 2);
rimPink.position.set(5, 4, -4);
scene.add(rimPink);
const rimMint = new THREE.PointLight(C.mint, 40, 30, 2);
rimMint.position.set(-5, 3, -3);
scene.add(rimMint);
const fill = new THREE.PointLight(C.purple, 25, 25, 2);
fill.position.set(0, -1, 6);
scene.add(fill);

// ---------------------------------------------------------------- background
const bgMat = new THREE.ShaderMaterial({
  depthTest: false,
  depthWrite: false,
  uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(C.purple) }, uB: { value: new THREE.Color(C.mint) }, uGlow: { value: 1 }, uCenter: { value: new THREE.Vector2(0, 0) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uGlow; uniform vec2 uCenter;
    void main(){
      vec2 p = vUv - 0.5; p.x *= 1.7778;
      float r = length(p - uCenter);
      vec3 col = vec3(0.010, 0.004, 0.020);
      col += uA * 0.11 * uGlow * pow(smoothstep(1.05, 0.0, r), 1.6);
      col += uB * 0.025 * smoothstep(0.9, 0.0, length(p - vec2(-0.75, 0.45)));
      col += vec3(1.0,0.53,1.0) * 0.02 * smoothstep(0.9, 0.0, length(p - vec2(0.8, -0.4)));
      vec2 g = fract(vUv * vec2(72.0, 40.5)) - 0.5;
      float d = smoothstep(0.09, 0.0, length(g)) * 0.035 * smoothstep(1.0, 0.15, r);
      col += d * vec3(0.8, 0.6, 1.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bg.frustumCulled = false;
bg.renderOrder = -10;
scene.add(bg);

// floor grid
const floorMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 }, uPulse: { value: 0 }, uPulseR: { value: 0 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    varying vec3 vW; uniform float uOpacity; uniform float uTime; uniform float uPulse; uniform float uPulseR;
    void main(){
      vec2 g = abs(fract(vW.xz * 0.5) - 0.5) / fwidth(vW.xz * 0.5);
      float line = 1.0 - min(min(g.x, g.y), 1.0);
      float r = length(vW.xz);
      float fade = smoothstep(16.0, 2.0, r);
      vec3 col = mix(vec3(0.86, 0.0, 1.0), vec3(1.0, 0.53, 1.0), 0.4) * line * 0.55 * fade;
      float pr = abs(r - uPulseR);
      col += vec3(0.66, 1.0, 0.82) * smoothstep(0.35, 0.0, pr) * uPulse * (0.6 + line);
      col += vec3(0.86, 0.0, 1.0) * 0.12 * smoothstep(4.0, 0.0, r);
      gl_FragColor = vec4(col, (line * 0.6 * fade + 0.25 * smoothstep(4.0, 0.0, r) + smoothstep(0.35,0.0,pr)*uPulse) * uOpacity);
    }`,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// dust particles (positions computed in shader from time => deterministic)
{
  const N = 700;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (hash(i) - 0.5) * 30;
    pos[i * 3 + 1] = (hash(i + 99) - 0.5) * 18;
    pos[i * 3 + 2] = (hash(i + 7) - 0.5) * 24 - 4;
    seed[i] = hash(i + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  var dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uWarp: { value: 0 } },
    vertexShader: `
      attribute float seed; uniform float uTime; uniform float uWarp; varying float vS;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.15 + seed * 0.3) + 9.0, 18.0) - 9.0;
        p.x += sin(uTime * 0.5 + seed * 20.0) * 0.4;
        p.z = mod(p.z + uWarp + 16.0, 24.0) - 16.0;
        vS = seed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + seed * 5.0) * (14.0 / -mv.z) * (1.0 + uWarp * 0.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vS;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = vS < 0.33 ? vec3(0.66,1.0,0.82) : (vS < 0.7 ? vec3(1.0,0.53,1.0) : vec3(0.86,0.0,1.0));
        gl_FragColor = vec4(col * 1.4, a * 0.55);
      }`,
  });
  const dust = new THREE.Points(g, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);
}

// generic glow sprite helper
const glowTex = makeGlowSprite('#ffffff');
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

// shockwave rings
function makeRing(color) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 96),
    new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
  );
  m.visible = false;
  scene.add(m);
  return m;
}
const rings = [makeRing(C.pink), makeRing(C.mint), makeRing(C.purple), makeRing(C.mint)];
function ringAt(ring, t, t0, dur, maxS, { pos = [0, 0, 0], rotX = 0 } = {}) {
  const p = (t - t0) / dur;
  if (p < 0 || p > 1) return;
  ring.visible = true;
  ring.position.set(...pos);
  ring.rotation.set(rotX, 0, 0);
  const s = 0.2 + eOutExpo(p) * maxS;
  ring.scale.set(s, s, s);
  ring.material.opacity = (1 - p) * (1 - p);
}

// ---------------------------------------------------------------- hero objects
const hero = makeCharacter();
scene.add(hero.root);
const buddy = makeCharacter({ blaster: false });
scene.add(buddy.root);
// buddy gets mint ear accents so the two agents read as different
buddy.root.traverse((o) => {
  if (o.isMesh && o.material.emissive && o.material.color.getHexString() === new THREE.Color(C.purple).getHexString()) {
    o.material = o.material.clone();
    o.material.color.set(C.mintDeep);
    o.material.emissive.set(C.mintDeep);
  }
});

const logo = makeLogoMesh({ size: 3.2, depth: 0.42, glow: 2.4, chrome: true });
scene.add(logo);
const logoGlow = glow(C.purple, 9, 0);
scene.add(logoGlow);

// ---------------------------------------------------------------- chain blocks (S3)
const chain = new THREE.Group();
scene.add(chain);
const blocks = [];
{
  const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const edges = new THREE.EdgesGeometry(geo);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#2a0b3a', metalness: 0.3, roughness: 0.2, clearcoat: 1, emissive: new THREE.Color(C.purple), emissiveIntensity: 0.15 }));
    const e = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: C.pink }));
    b.add(m, e);
    b.position.x = (i - 2) * 1.6;
    chain.add(b);
    blocks.push({ g: b, m, e });
    if (i < 4) {
      const link = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 12), new THREE.MeshBasicMaterial({ color: C.purple }));
      link.rotation.z = Math.PI / 2;
      link.position.x = (i - 2) * 1.6 + 0.8;
      chain.add(link);
    }
  }
  const boxGeo = new THREE.BoxGeometry(9.4, 2.4, 2.4);
  const cage = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color: C.mint, transparent: true, opacity: 0.8 }));
  cage.name = 'cage';
  chain.add(cage);
  const cageFace = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: C.mint, transparent: true, opacity: 0.04, depthWrite: false }));
  cageFace.name = 'cageFace';
  chain.add(cageFace);
}
const chainPulse = glow(C.mint, 1.6, 0);
chain.add(chainPulse);

// ---------------------------------------------------------------- web globe (S3/S4/S7)
const globe = new THREE.Group();
scene.add(globe);
{
  const N = 520;
  const R = 2.6;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * Math.PI * (3 - Math.sqrt(5));
    pts.push(new THREE.Vector3(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R));
  }
  const pg = new THREE.BufferGeometry().setFromPoints(pts);
  const pm = new THREE.PointsMaterial({ color: C.mint, size: 0.06, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  globe.add(new THREE.Points(pg, pm));
  const seg = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (pts[i].distanceTo(pts[j]) < 0.42 && hash(i * 31 + j) < 0.55) seg.push(pts[i], pts[j]);
    }
  }
  const lg = new THREE.BufferGeometry().setFromPoints(seg);
  globe.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: C.purple, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.97, 48, 32), new THREE.MeshBasicMaterial({ color: '#12031c', transparent: true, opacity: 0.6 }));
  globe.add(core);
  const halo = glow(C.purple, R * 4.2, 0.55);
  globe.add(halo);
  // orbit rings
  for (let k = 0; k < 2; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * (1.25 + k * 0.18), 0.012, 8, 160), new THREE.MeshBasicMaterial({ color: k ? C.pink : C.mint, transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2 + (k ? 0.5 : -0.35);
    ring.rotation.y = k ? 0.3 : -0.2;
    globe.add(ring);
  }
}

// ---------------------------------------------------------------- web cards
const cardSpecs = [
  { tag: 'news.world', title: 'Breaking News', accent: C.pink },
  { tag: 'docs / pdf', title: 'Documents', accent: C.mint },
  { tag: 'data.feed', title: 'Market Data', accent: C.purple },
  { tag: 'reports.org', title: 'Reports', accent: C.pink },
  { tag: 'social.post', title: 'Social', accent: C.mint },
  { tag: 'api.v2', title: 'Web APIs', accent: C.purple },
];
const cards = cardSpecs.map((s) => {
  const tex = makeCardTexture({ ...s, lines: 4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 1.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: '#d8d0e0', depthWrite: false, side: THREE.DoubleSide }));
  scene.add(m);
  return m;
});

// ---------------------------------------------------------------- intelligent contract core (S4)
const contract = new THREE.Group();
scene.add(contract);
{
  const hexGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.36, 6);
  const hex = new THREE.Mesh(hexGeo, new THREE.MeshPhysicalMaterial({ color: '#1a0626', metalness: 0.6, roughness: 0.2, clearcoat: 1 }));
  hex.rotation.x = Math.PI / 2;
  hex.rotation.y = Math.PI / 6;
  const hexEdge = new THREE.LineSegments(new THREE.EdgesGeometry(hexGeo), new THREE.LineBasicMaterial({ color: C.pink }));
  hexEdge.rotation.copy(hex.rotation);
  contract.add(hex, hexEdge);
  const inner = makeLogoMesh({ size: 1.5, depth: 0.2, glow: 2.6 });
  inner.position.z = 0.26;
  contract.add(inner);
  const rA = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.022, 8, 160), new THREE.MeshBasicMaterial({ color: C.mint }));
  const rB = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.016, 8, 160), new THREE.MeshBasicMaterial({ color: C.pink }));
  rA.name = 'rA';
  rB.name = 'rB';
  contract.add(rA, rB);
  const cg = glow(C.purple, 6.5, 0.8);
  cg.name = 'glow';
  contract.add(cg);
}
// data streams from cards into the contract
const STREAM_N = 18;
const streamGeo = new THREE.BufferGeometry();
streamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cards.length * STREAM_N * 3), 3));
const streams = new THREE.Points(
  streamGeo,
  new THREE.PointsMaterial({ color: C.mint, size: 0.11, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
);
streams.frustumCulled = false;
scene.add(streams);

// ---------------------------------------------------------------- point scenes props
function card3D(opts, w = 2.6) {
  const tex = makeCardTexture(opts);
  const h = w * (opts.h || 400) / (opts.w || 640);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: '#e2dcea', depthWrite: false, side: THREE.DoubleSide }));
  m.visible = false;
  scene.add(m);
  return m;
}
const p1Question = card3D({ w: 760, h: 300, tag: 'contract.query', title: 'Did the event happen?', body: ['criteria: confirmed by reliable sources'], accent: C.pink }, 3.4);
const p1Evidence = [
  card3D({ tag: 'news.world', title: 'Source A', lines: 3, accent: C.mint, status: ['EVIDENCE', C.mint] }, 2.1),
  card3D({ tag: 'gov.records', title: 'Source B', lines: 3, accent: C.mint, status: ['EVIDENCE', C.mint] }, 2.1),
  card3D({ tag: 'data.feed', title: 'Source C', lines: 3, accent: C.mint, status: ['EVIDENCE', C.mint] }, 2.1),
];
const checkBadge = new THREE.Group();
{
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 16, 64), new THREE.MeshStandardMaterial({ color: C.mint, emissive: new THREE.Color(C.mint), emissiveIntensity: 0.9 }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.58, 48), new THREE.MeshBasicMaterial({ color: '#0b2a1e', transparent: true, opacity: 0.85 }));
  const m = new THREE.MeshStandardMaterial({ color: C.mint, emissive: new THREE.Color(C.mint), emissiveIntensity: 1.1 });
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), m);
  a.position.set(-0.16, -0.06, 0.05);
  a.rotation.z = -Math.PI / 4;
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.12), m);
  b.position.set(0.12, 0.06, 0.05);
  b.rotation.z = Math.PI / 4 + 0.08;
  checkBadge.add(disc, ringM, a, b);
  checkBadge.visible = false;
  scene.add(checkBadge);
}
const p2Code = card3D({
  w: 720, h: 420, tag: 'smart_contract.sol', title: 'Deterministic', mono: true, accent: C.purple,
  body: [[['if ', C.pink], ['(price > target)', '#fff']], [['  pay', C.mint], ['(seller);', '#fff']], [['else ', C.pink], ['revert();', '#fff']]],
}, 3.0);
const p2NL = card3D({
  w: 760, h: 440, tag: 'intelligent_contract.py', title: 'Natural language', accent: C.mint,
  body: ['“Was the delivered article original,', 'accurate and on-brief?”'], status: ['AI EVALUATED ✓', C.mint],
}, 3.4);
const p3Card = card3D({ w: 700, h: 300, tag: 'agent_agreement', title: 'Agreement fulfilled?', body: ['result meets requirements'], accent: C.mint, status: ['VERIFIED ✓', C.mint] }, 2.9);
const coin = new THREE.Mesh(
  new THREE.CylinderGeometry(0.42, 0.42, 0.08, 48),
  [new THREE.MeshStandardMaterial({ color: C.purple, metalness: 0.7, roughness: 0.3, emissive: new THREE.Color(C.purple), emissiveIntensity: 0.4 }),
    new THREE.MeshStandardMaterial({ map: makeCoinTexture(), emissive: new THREE.Color('#ffffff'), emissiveMap: makeCoinTexture(), emissiveIntensity: 0.5 }),
    new THREE.MeshStandardMaterial({ map: makeCoinTexture(), emissive: new THREE.Color('#ffffff'), emissiveMap: makeCoinTexture(), emissiveIntensity: 0.5 })],
);
coin.visible = false;
scene.add(coin);
const p4Cards = [
  card3D({ tag: 'blog.example', title: 'Source 1', lines: 3, accent: C.red, status: ['OUTDATED', C.red] }, 2.2),
  card3D({ tag: 'forum.thread', title: 'Source 2', lines: 3, accent: C.pink, status: ['CONTRADICTORY', C.pink] }, 2.2),
  card3D({ tag: 'unknown.site', title: 'Source 3', lines: 3, accent: C.red, status: ['MISLEADING', C.red] }, 2.2),
  card3D({ tag: 'docs.partial', title: 'Source 4', lines: 2, accent: C.purple, status: ['INCOMPLETE', C.pink] }, 2.2),
];

// ---------------------------------------------------------------- validators (S6)
const leader = makeHead();
scene.add(leader.root);
const validators = Array.from({ length: 5 }, () => {
  const v = makeHead();
  scene.add(v.root);
  return v;
});
const beamGeo = new THREE.BufferGeometry();
beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 2 * 3), 3));
const beams = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ color: C.pink, transparent: true, blending: THREE.AdditiveBlending }));
beams.frustumCulled = false;
scene.add(beams);
const beamDots = Array.from({ length: 5 }, () => {
  const g = glow(C.mint, 0.7, 1);
  scene.add(g);
  return g;
});

// ---------------------------------------------------------------- post FX
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.9, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
fxaa.material.uniforms.resolution.value.set(1 / W, 1 / H);
composer.addPass(fxaa);
const fx = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uAberr: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uTime: { value: 0 }, uFade: { value: 1 }, uGlitch: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAberr; uniform float uFlash; uniform vec3 uFlashCol; uniform float uTime; uniform float uFade; uniform float uGlitch;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float band = step(0.82, h(vec2(floor(uv.y * 28.0), floor(uTime * 24.0))));
      uv.x += (h(vec2(floor(uv.y * 28.0), floor(uTime * 30.0))) - 0.5) * 0.06 * uGlitch * band;
      vec2 dir = (uv - 0.5);
      float a = uAberr * (0.35 + length(dir) * 1.6);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * a).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * a).b;
      float vig = smoothstep(1.15, 0.35, length((vUv - 0.5) * vec2(1.6, 1.15)));
      col *= mix(0.55, 1.0, vig);
      col += (h(vUv * 1000.0 + uTime) - 0.5) * 0.035;
      col = mix(col, uFlashCol, clamp(uFlash, 0.0, 1.0));
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
});
composer.addPass(fx);

// ---------------------------------------------------------------- overlay
const overlay = new Overlay(document.getElementById('overlay'), CUES);
const hud = document.getElementById('hud');
const hudScene = document.getElementById('hud-scene');
const hudTc = document.getElementById('hud-tc');

// ---------------------------------------------------------------- per-frame
const look = new THREE.Vector3();
function setCam(px, py, pz, tx, ty, tz, fov = 30) {
  camera.position.set(px, py, pz);
  look.set(tx, ty, tz);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function hideAll() {
  for (const o of [hero.root, buddy.root, logo, logoGlow, chain, globe, contract, streams, checkBadge, coin, leader.root, beams, ...beamDots,
    ...cards, p1Question, ...p1Evidence, p2Code, p2NL, p3Card, ...p4Cards, ...validators.map((v) => v.root), ...rings]) o.visible = false;
  floor.visible = true;
  floorMat.uniforms.uOpacity.value = 1;
  floorMat.uniforms.uPulse.value = 0;
  bgMat.uniforms.uGlow.value = 1;
  bgMat.uniforms.uCenter.value.set(0, 0);
}

function placeHero(c, x, y, z, ry, s = 1) {
  c.root.visible = true;
  c.root.position.set(x, y, z);
  c.root.rotation.set(0, ry, 0);
  c.root.scale.setScalar(s);
}

function popScale(t, a, dur = 0.5) {
  return eOutBack(clamp((t - a) / dur), 2.2);
}

function cardAt(m, t, a, b, x, y, z, ry = 0, rz = 0) {
  const e = env(t, a, b, 0.5, 0.3);
  if (e <= 0) return;
  m.visible = true;
  const k = eOutExpo(clamp((t - a) / 0.7));
  m.position.set(x, y - (1 - k) * 1.2, z - (1 - k) * 2);
  m.rotation.set(0, ry + (1 - k) * 0.8, rz);
  m.material.opacity = e;
}

const sceneIdx = (t) => SCENES.findIndex((s) => t >= s.start && t < s.end);

function renderAt(t) {
  hideAll();
  // impact energy for shake / aberration
  let impact = 0;
  let flash = 0;
  for (const i of IMPACTS) {
    if (t >= i.t) {
      const d = t - i.t;
      impact += Math.exp(-d * 7) * (i.k ?? 1);
      flash += Math.exp(-d * 14) * (i.flash ?? 0);
    }
  }
  const si = sceneIdx(t);
  const S = SCENES[Math.max(0, si)];
  const lt = t - S.start;

  // ================================================================== S1 INTRO [0,4]
  if (S.id === 'intro') {
    floorMat.uniforms.uOpacity.value = lin(t, 2, 3) * 0.6;
    logo.visible = true;
    logoGlow.visible = true;
    const parts = { left: [-9, 4, -6], right: [9, -3, -5], diamond: [0, -7, 4] };
    for (const m of logo.children) {
      const [sx, sy, sz] = parts[m.name];
      const p = clamp((t - (m.name === 'diamond' ? 0.55 : 0.3)) / (m.name === 'diamond' ? 1.45 : 1.7));
      const e = 1 - Math.pow(1 - p, 4);
      const h = m.userData.home;
      m.position.set(mix(sx, h.x, e), mix(sy, h.y, e), mix(sz, h.z, e));
      m.rotation.set((1 - e) * 4, (1 - e) * (m.name === 'left' ? -5 : 5), (1 - e) * 2);
    }
    const settle = lin(t, 2, 4);
    logo.position.set(0, 1.85, 0);
    logo.rotation.set(0, Math.sin(t * 1.3) * 0.18 * settle + (1 - lin(t, 0, 2)) * 0.6, 0);
    logo.scale.setScalar(1 + 0.12 * eOutBack(lin(t, 2.0, 2.4)) - 0.12 * lin(t, 2.4, 3.2));
    logoGlow.position.set(0, 1.85, -1);
    logoGlow.material.opacity = lin(t, 1.6, 2.0) * (0.55 + Math.exp(-Math.max(0, t - 2) * 3) * 0.9);
    ringAt(rings[0], t, 2.0, 1.2, 9, { pos: [0, 1.85, -0.2] });
    ringAt(rings[1], t, 2.08, 1.4, 12, { pos: [0, 1.85, -0.4] });
    // camera: slow push, then dive into logo at the end
    const dive = eInExpo(lin(t, 3.35, 4.0));
    setCam(Math.sin(t * 0.6) * 0.4, 1.9 + (1 - lin(t, 0, 2)) * 0.6, mix(13 - lin(t, 0, 3.3) * 1.5, 1.2, dive), 0, 1.5, 0);
    bgMat.uniforms.uCenter.value.set(0, 0.05);
  }

  // ================================================================== S2 HOOK [4,10]
  if (S.id === 'hook') {
    const land = 4.0;
    const drop = clamp((t - (land - 0.45)) / 0.45);
    const y = t < land ? mix(9, 0, drop * drop) : 0;
    const sq = t >= land ? Math.exp(-(t - land) * 6) * Math.cos((t - land) * 22) * 0.22 : -0.12 * drop;
    placeHero(hero, 3.75, y, 0, -0.42 + Math.sin(t * 0.8) * 0.06);
    let face = 'angry';
    if (t > 7.4) face = 'think';
    if (t > 8.7) face = 'wide';
    hero.pose(t, { squash: sq, face, lookY: t > 7.4 ? -0.12 : 0.05, tilt: t > 7.4 ? 0.18 : 0 });
    ringAt(rings[1], t, land, 1.0, 5, { pos: [3.75, 0.03, 0], rotX: -Math.PI / 2 });
    ringAt(rings[0], t, land + 0.06, 1.2, 7, { pos: [3.75, 0.02, 0], rotX: -Math.PI / 2 });
    floorMat.uniforms.uPulse.value = Math.exp(-Math.max(0, t - land) * 2.5) * (t >= land ? 1 : 0);
    floorMat.uniforms.uPulseR.value = Math.max(0, t - land) * 9;
    const orbit = lt * 0.06;
    setCam(1.2 + Math.sin(orbit) * 2, 2.2 + Math.max(0, 1 - lin(t, 4, 4.6)) * 1.2, 12.5 - lt * 0.25, 1.4, 1.55, 0);
    bgMat.uniforms.uCenter.value.set(0.35, 0);
  }

  // ================================================================== S3 CHAIN -> WORLD [10,16]
  if (S.id === 'world') {
    const reveal = 12.0;
    if (t < reveal + 0.6) {
      chain.visible = true;
      const k = eOutExpo(lin(t, 10, 10.9));
      const burst = eInExpo(lin(t, reveal - 0.15, reveal + 0.6));
      chain.position.set(0, 1.4, 0);
      chain.rotation.set(0.18, -0.35 + lt * 0.08, 0);
      chain.scale.setScalar(k * (1 + burst * 2.5));
      blocks.forEach((b, i) => {
        const p = Math.max(0, Math.sin((t * 2.5 - i * 0.5) * Math.PI)) ** 8;
        b.m.material.emissiveIntensity = 0.15 + p * 1.8;
        b.g.rotation.set(t * 0.4 + i, t * 0.3 + i * 0.7, 0);
        b.g.scale.setScalar(popScale(t, 10.05 + i * 0.08, 0.5) * (1 + p * 0.08));
      });
      chainPulse.material.opacity = 0.9;
      chainPulse.position.set(((t * 1.25) % 1) * 8 - 4, 0, 0);
      const cage = chain.getObjectByName('cage');
      cage.material.opacity = 0.8 * (1 - burst);
    }
    // globe reveal
    const g = eOutExpo(lin(t, reveal, reveal + 1.4));
    if (t >= reveal - 0.05) {
      globe.visible = true;
      globe.position.set(2.5, 1.5, 0);
      globe.scale.setScalar(0.2 + g * 0.8);
      globe.rotation.set(0.25, t * 0.25, 0);
      cards.forEach((c, i) => {
        const a = (i / cards.length) * Math.PI * 2 + t * 0.22;
        const k = eOutBack(clamp((t - reveal - 0.3 - i * 0.12) / 0.7), 1.4);
        if (k <= 0) return;
        c.visible = true;
        const r = 3.4 * k;
        c.position.set(2.5 + Math.cos(a) * r, 1.5 + Math.sin(i * 1.9) * 1.6 * k, Math.sin(a) * r * 0.8);
        c.rotation.set(0, -(c.position.x - 2.5) * 0.12, 0);
        c.scale.setScalar(Math.max(0.01, k));
        c.material.opacity = clamp(k);
      });
    }
    floorMat.uniforms.uOpacity.value = 0.6;
    const pull = eInOut(lin(t, reveal - 0.1, reveal + 1.2));
    setCam(mix(0, -1.5, pull), mix(2.2, 2.6, pull), mix(12.8 - lt * 0.25, 15.5, pull), mix(0, 0.6, pull), 1.4, 0);
    bgMat.uniforms.uCenter.value.set(mix(0, 0.3, pull), 0);
    ringAt(rings[2], t, reveal, 1.3, 12, { pos: [2.5, 1.5, 0] });
  }

  // ================================================================== S4 INTELLIGENT CONTRACTS [16,22]
  if (S.id === 'ic') {
    const cx = 0.9;
    const cy = 1.35;
    contract.visible = true;
    const k = eOutBack(lin(t, 16.0, 16.7), 1.6);
    contract.position.set(cx, cy, 0);
    contract.scale.setScalar(Math.max(0.001, k) * 0.9);
    contract.rotation.set(Math.sin(t * 0.7) * 0.12, Math.sin(t * 0.5) * 0.35, 0);
    contract.getObjectByName('rA').rotation.set(t * 0.9, t * 0.5, 0);
    contract.getObjectByName('rB').rotation.set(-t * 0.6, 0.4, t * 0.7);
    const pulse = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2)), 6);
    contract.getObjectByName('glow').material.opacity = 0.55 + pulse * 0.4;
    globe.visible = true;
    globe.position.set(cx, cy, -9);
    globe.scale.setScalar(1.7);
    globe.rotation.set(0.25, t * 0.15, 0);
    // cards orbit + streams
    const sp = streamGeo.attributes.position.array;
    const tmp = new THREE.Vector3();
    cards.forEach((c, i) => {
      const a = (i / cards.length) * Math.PI * 2 + t * 0.16 + 0.3;
      const kk = eOutExpo(clamp((t - 16.2 - i * 0.07) / 0.9));
      c.visible = true;
      const pos = new THREE.Vector3(cx + Math.cos(a) * 4.3, cy + Math.sin(a) * 2.25, -1.8 + Math.sin(a * 2) * 0.5);
      c.position.copy(pos).lerp(new THREE.Vector3(cx, cy, -6), 1 - kk);
      c.rotation.set(0, -Math.cos(a) * 0.4, 0);
      c.scale.setScalar(0.72);
      c.material.opacity = kk;
      for (let j = 0; j < STREAM_N; j++) {
        const u = ((t * 0.7 + j / STREAM_N + i * 0.13) % 1);
        const on = t > 17.0 ? 1 : 0;
        const ctrl = new THREE.Vector3((pos.x + cx) / 2, (pos.y + cy) / 2 + 1.0, 0.8);
        tmp.copy(pos).multiplyScalar((1 - u) * (1 - u)).addScaledVector(ctrl, 2 * u * (1 - u)).addScaledVector(new THREE.Vector3(cx, cy, -0.6), u * u);
        if (!on) tmp.set(0, -50, 0);
        sp.set([tmp.x, tmp.y, tmp.z], (i * STREAM_N + j) * 3);
      }
    });
    streamGeo.attributes.position.needsUpdate = true;
    streams.visible = true;
    // hero points at the contract
    const hin = eOutExpo(lin(t, 16.6, 17.4));
    placeHero(hero, mix(-7, -3.5, hin), 0, 1.2, 0.55, 0.92);
    hero.pose(t, { face: t > 18 ? 'happy' : 'wide', armL: 1.1, armLFwd: 0.3, lookX: 0.25, lookY: -0.05 });
    floorMat.uniforms.uOpacity.value = 0.45;
    setCam(Math.sin(lt * 0.25) * 1.2, 2.0, 15 - lt * 0.35, 0.3, 1.5, 0);
    ringAt(rings[0], t, 16.0, 1.1, 8, { pos: [cx, cy, 0] });
  }

  // ================================================================== S5 FOUR REASONS [22,34]
  if (S.id === 'reasons') {
    const n = Math.floor(lt / 3);
    const pt = lt - n * 3; // 0..3 inside point
    const T0 = S.start + n * 3;
    const camX = Math.sin(pt * 0.4) * 0.4;
    setCam(1.6 + camX, 2.0, 13.5 - pt * 0.35, 1.6, 1.45, 0);
    bgMat.uniforms.uCenter.value.set(0.38, 0);
    floorMat.uniforms.uOpacity.value = 0.5;
    if (n === 0) {
      cardAt(p1Question, t, T0, T0 + 3, 2.6, 2.75, 0);
      p1Evidence.forEach((c, i) => cardAt(c, t, T0 + 0.35 + i * 0.18, T0 + 3, 1.75 + i * 1.95, 0.85 + (i === 1 ? -0.3 : 0), -0.6 - (i === 1 ? -0.5 : 0), (1 - i) * 0.25));
      const b = popScale(t, T0 + 1.5, 0.45);
      if (t > T0 + 1.5) {
        checkBadge.visible = true;
        checkBadge.position.set(4.7, 2.95, 0.9);
        checkBadge.scale.setScalar(Math.max(0.001, b) * 0.8 * (1 - lin(t, T0 + 2.75, T0 + 3)));
        checkBadge.rotation.set(0, Math.sin(t * 2) * 0.2, 0);
      }
      ringAt(rings[1], t, T0 + 1.5, 0.9, 2, { pos: [4.7, 2.95, 0.8] });
    } else if (n === 1) {
      cardAt(p2Code, t, T0, T0 + 3, 0.9, 2.35, -1.2, 0.35);
      cardAt(p2NL, t, T0 + 0.45, T0 + 3, 3.2, 1.1, 0.5, -0.25);
      // arrow of particles from code -> nl
      const sp = streamGeo.attributes.position.array;
      sp.fill(0);
      for (let j = 0; j < STREAM_N * cards.length; j++) {
        const u = ((t * 0.9 + j / 40) % 1);
        const on = t > T0 + 0.8 && j < 40;
        sp.set(on ? [mix(1.6, 2.9, u), mix(1.6, 1.3, u) + Math.sin(u * Math.PI) * 0.6, mix(-1, 0.6, u)] : [0, -50, 0], j * 3);
      }
      streamGeo.attributes.position.needsUpdate = true;
      streams.visible = true;
    } else if (n === 2) {
      const meet = eOutExpo(clamp((t - T0) / 0.8));
      placeHero(hero, mix(-0.5, 1.3, meet), 0, 0.5, 0.65, 0.8);
      placeHero(buddy, mix(7, 4.7, meet), 0, 0.5, -0.65, 0.8);
      hero.pose(t, { face: 'happy', armL: 0.9, armLFwd: 0.6 });
      buddy.pose(t + 1.3, { face: t > T0 + 1.9 ? 'check' : 'happy', armR: 0.9, armRFwd: 0.6 });
      const u = clamp((t - (T0 + 0.8)) / 1.0);
      if (u > 0 && u < 1) {
        coin.visible = true;
        const e = eInOut(u);
        coin.position.set(mix(2.0, 4.0, e), 1.3 + Math.sin(e * Math.PI) * 1.4, 0.8);
        coin.rotation.set(Math.PI / 2, 0, t * 9);
        coin.rotation.x = Math.PI / 2 + Math.sin(t * 7) * 0.3;
      }
      cardAt(p3Card, t, T0 + 1.6, T0 + 3, 3.0, 3.6, -0.6);
      ringAt(rings[0], t, T0 + 1.85, 0.9, 4, { pos: [3.0, 3.6, -0.5] });
    } else if (n === 3) {
      p4Cards.forEach((c, i) => {
        const gx = [0.4, 2.8, 5.0, 2.0][i];
        const gy = [2.6, 3.3, 2.2, 0.8][i];
        cardAt(c, t, T0 + i * 0.15, T0 + 3, gx, gy, -1.4 - (i % 2) * 0.6, (i - 1.5) * 0.15, (hash(i) - 0.5) * 0.15);
        if (c.visible) {
          const gl = Math.floor(t * 18 + i * 3) % 7 === 0 ? 1 : 0;
          c.position.x += gl * (hash(Math.floor(t * 30) + i) - 0.5) * 0.4;
          c.position.y += gl * (hash(Math.floor(t * 30) + i + 9) - 0.5) * 0.2;
        }
      });
      placeHero(hero, 3.3, 0, 1.4, -0.2, 0.72);
      hero.pose(t, { face: Math.floor(t * 2) % 2 ? 'crossRed' : 'wide', tilt: Math.sin(t * 3) * 0.12 });
    }
  }

  // ================================================================== S6 OPTIMISTIC DEMOCRACY [34,40]
  if (S.id === 'consensus') {
    const cx = 0;
    const cy = 0.7;
    leader.root.visible = true;
    const lk = eOutBack(lin(t, 34.0, 34.6), 1.8);
    leader.root.position.set(cx, cy + Math.sin(t * 2) * 0.06, 0);
    leader.root.scale.setScalar(Math.max(0.001, lk) * 0.95);
    leader.root.rotation.set(0.05, Math.sin(t * 0.8) * 0.2, 0);
    leader.setFace(t > 37.5 ? 'happy' : 'think');
    leader.visorMat.emissiveIntensity = 1.6;
    const bp = beamGeo.attributes.position.array;
    validators.forEach((v, i) => {
      const a = Math.PI * (0.95 - (i / 4) * 0.9); // arc around the leader
      const tIn = 34.4 + i * 0.12;
      const k = eOutBack(lin(t, tIn, tIn + 0.5), 1.8);
      const x = cx + Math.cos(a) * 4.3;
      const z = -1.4;
      const y = cy + Math.sin(a) * 1.9 - 0.1 + Math.sin(t * 2 + i) * 0.08;
      v.root.visible = true;
      v.root.position.set(x, y, z);
      v.root.scale.setScalar(Math.max(0.001, k) * 0.58);
      v.root.rotation.set(0, -x * 0.12, 0);
      const vt = 35.9 + i * 0.3;
      let face = 'think';
      if (t > vt) face = 'check';
      if (t > vt && i === 3 && t < 37.2) face = 'crossRed'; // one validator disagrees -> re-evaluates
      if (t > 37.5) face = 'happy';
      v.setFace(face);
      v.visorMat.emissiveIntensity = 1.6;
      bp.set([cx, cy, 0, x, y, z], i * 6);
      const d = beamDots[i];
      const u = ((t - 34.6) * 0.9 + i * 0.2) % 1;
      d.visible = t > 34.7 && t < 37.6;
      d.position.set(mix(cx, x, u), mix(cy, y, u), mix(0, z, u));
      d.material.color.set(t > vt ? C.mint : C.pink);
      ringAt(rings[i % 4], t, vt, 0.6, 1.4, { pos: [x, y, z + 0.6] });
    });
    beamGeo.attributes.position.needsUpdate = true;
    beams.visible = t > 34.6;
    beams.material.color.set(t > 37.5 ? C.mint : C.pink);
    beams.material.opacity = t > 37.5 ? 1 : 0.55;
    floorMat.uniforms.uPulse.value = t > 37.5 ? Math.exp(-(t - 37.5) * 1.5) : 0;
    floorMat.uniforms.uPulseR.value = Math.max(0, t - 37.5) * 8;
    ringAt(rings[0], t, 37.5, 1.4, 10, { pos: [cx, cy, 0] });
    floorMat.uniforms.uOpacity.value = 0.7;
    const ang = lt * 0.06 - 0.18;
    setCam(Math.sin(ang) * 14, 2.6 - lt * 0.1, Math.cos(ang) * 14, 0, 1.45, -0.8);
  }

  // ================================================================== S7 TRIAD [40,46]
  if (S.id === 'triad') {
    globe.visible = true;
    globe.position.set(0, -5.2 + eOutCubic(lin(t, 40, 46)) * 0.8, -6);
    globe.scale.setScalar(2.4);
    globe.rotation.set(0.25, t * 0.2, 0);
    if (false) {
      contract.visible = true;
      const k = eOutBack(lin(t, 43.0, 43.6), 1.6);
      contract.position.set(0, 1.2, -3);
      contract.scale.setScalar(Math.max(0.001, k) * 1.1);
      contract.rotation.set(0, t * 0.6, 0);
      contract.getObjectByName('rA').rotation.set(t * 0.9, t * 0.5, 0);
      contract.getObjectByName('rB').rotation.set(-t * 0.6, 0.4, t * 0.7);
    }
    floorMat.uniforms.uOpacity.value = 0.35;
    bgMat.uniforms.uGlow.value = 1.3;
    setCam(Math.sin(lt * 0.3) * 1.0, 1.6, 12 - lt * 0.25, 0, 1.0, -3);
    ringAt(rings[1], t, 43.0, 1.2, 10, { pos: [0, 0.9, -3] });
  }

  // ================================================================== S8 FINALE [46,56]
  if (S.id === 'finale') {
    const k = eOutExpo(lin(t, 46.0, 46.8));
    logo.visible = true;
    logoGlow.visible = true;
    for (const m of logo.children) {
      m.position.copy(m.userData.home);
      m.rotation.set(0, 0, 0);
    }
    logo.position.set(0, 2.3, -3.5);
    logo.scale.setScalar(mix(0.2, 1.75, k));
    logo.rotation.set(0, Math.sin(t * 0.6) * 0.12, 0);
    logoGlow.position.set(0, 2.3, -4.2);
    logoGlow.scale.setScalar(16);
    logoGlow.material.opacity = 0.65 * k;
    const hk = eOutBack(lin(t, 46.2, 46.9), 1.4);
    placeHero(hero, 0, 0, 0.6, Math.sin(t * 0.5) * 0.1, Math.max(0.001, hk));
    hero.pose(t, { face: t > 50.6 ? 'happy' : 'angry', wave: t > 50.6 && t < 52.5 ? 1 : 0, lookY: 0.05 });
    floorMat.uniforms.uPulse.value = Math.exp(-Math.max(0, t - 46) * 1.6);
    floorMat.uniforms.uPulseR.value = Math.max(0, t - 46) * 9;
    ringAt(rings[0], t, 46.0, 1.4, 12, { pos: [0, 2.3, -3.4] });
    ringAt(rings[1], t, 46.1, 1.6, 16, { pos: [0, 2.3, -3.6] });
    ringAt(rings[2], t, 46.0, 1.2, 6, { pos: [0, 0.02, 0.6], rotX: -Math.PI / 2 });
    const push = lin(t, 46, 56);
    setCam(Math.sin(t * 0.25) * 1.2, mix(1.2, 1.6, push), mix(12.5, 14, eOutCubic(push)), 0, mix(2.55, 2.35, push), 0);
    bgMat.uniforms.uGlow.value = 1.6;
  }

  // camera shake on impacts
  const sh = Math.min(impact, 1.5) * 0.06;
  camera.position.x += Math.sin(t * 91) * sh;
  camera.position.y += Math.cos(t * 77) * sh;
  camera.lookAt(look);
  camera.rotation.z += Math.sin(t * 53) * sh * 0.15;

  // global uniforms
  bgMat.uniforms.uTime.value = t;
  dustMat.uniforms.uTime.value = t;
  dustMat.uniforms.uWarp.value = 0;
  floorMat.uniforms.uTime.value = t;
  fx.uniforms.uTime.value = t;
  const glitch = S.id === 'reasons' && t > 31 && t < 34 ? (Math.floor(t * 18) % 7 === 0 ? 1 : 0.15) : 0;
  fx.uniforms.uGlitch.value = glitch + Math.min(impact, 1) * 0.25;
  fx.uniforms.uAberr.value = 0.0025 + Math.min(impact, 1.5) * 0.012 + glitch * 0.01;
  fx.uniforms.uFlash.value = Math.min(flash, 1) * 0.85;
  fx.uniforms.uFade.value = Math.min(lin(t, 0, 0.35), 1 - lin(t, DURATION - 0.8, DURATION));
  bloom.strength = 0.9 + Math.min(impact, 1) * 0.6;

  composer.render();

  // overlay + HUD
  overlay.update(t);
  hud.style.opacity = String(env(t, 4.2, DURATION - 0.6, 0.6, 0.6) * 0.9);
  hudScene.textContent = String(Math.max(1, si + 1)).padStart(2, '0');
  const f = Math.floor((t % 1) * 30);
  hudTc.textContent = `00:${String(Math.floor(t)).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  document.getElementById('overlay').style.opacity = String(1 - lin(t, DURATION - 0.8, DURATION));
}

window.DURATION = DURATION;
window.renderAt = renderAt;
await document.fonts.ready;
renderAt(0.0);
window.__ready = true;
