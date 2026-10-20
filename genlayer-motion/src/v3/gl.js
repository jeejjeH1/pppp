// Three.js shots: the extruded GenLayer mark (intro) and the isometric protocol stack from
// genlayer.com (black Adjudication tile over Interop / Identity / Payments layers).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LOGO_POLYS, LOGO_CENTER } from '../palette.js';

const canvasEl = document.createElement('canvas');
canvasEl.id = 'gl';
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(1920, 1080, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

function logoShapes(size) {
  const scale = size / 340;
  return Object.values(LOGO_POLYS).map((poly) => {
    const s = new THREE.Shape();
    poly.forEach(([x, y], i) => {
      const px = (x - LOGO_CENTER[0]) * scale;
      const py = -(y - LOGO_CENTER[1]) * scale;
      i ? s.lineTo(px, py) : s.moveTo(px, py);
    });
    s.closePath();
    return s;
  });
}

const textures = [];
function textTexture(text, { w = 1024, h = 128, font = '500 64px "Geist Mono"', color = '#111', align = 'right', bg = null, spacing = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  // fonts may not be loaded yet: redraw on GL.refreshText()
  const draw = () => {
  g.clearRect(0, 0, w, h);
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  g.font = font;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  g.textAlign = align;
  g.fillText(text, align === 'right' ? w - 20 : align === 'center' ? w / 2 : 20, h / 2);
  tex.needsUpdate = true;
  };
  draw();
  textures.push(draw);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ------------------------------------------------------------------ intro: extruded mark
const logoScene = new THREE.Scene();
const logoCam = new THREE.PerspectiveCamera(30, 1920 / 1080, 0.1, 100);
const logoGroup = new THREE.Group();
logoScene.add(logoGroup);
{
  const face = new THREE.MeshPhysicalMaterial({ color: '#f4f4f8', metalness: 0.85, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
  const side = new THREE.MeshPhysicalMaterial({ color: '#1a0dff', metalness: 0.4, roughness: 0.35, emissive: new THREE.Color('#1a0dff'), emissiveIntensity: 0.55 });
  logoShapes(3.2).forEach((shape, i) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.035, bevelSegments: 4 });
    geo.translate(0, 0, -0.21);
    geo.computeBoundingBox();
    const ctr = new THREE.Vector3();
    geo.boundingBox.getCenter(ctr);
    geo.translate(-ctr.x, -ctr.y, 0);
    const m = new THREE.Mesh(geo, [face, side]);
    m.position.set(ctr.x, ctr.y, 0);
    m.userData.home = m.position.clone();
    m.userData.i = i;
    logoGroup.add(m);
  });
  // environment so metal reads as chrome
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const eg = new THREE.SphereGeometry(10, 32, 16);
  const em = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
  const cols = [];
  const pos = eg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    const x = pos.getX(i) / 10;
    const band = Math.exp(-Math.pow((y - 0.25) * 6, 2)) * 1.6 + Math.exp(-Math.pow((x + 0.6) * 5, 2)) * 0.6;
    const c = new THREE.Color(0.02, 0.02, 0.05).lerp(new THREE.Color(0.35, 0.33, 1.0), Math.min(1, band * 0.6)).add(new THREE.Color(band * 0.5, band * 0.5, band * 0.55));
    cols.push(c.r, c.g, c.b);
  }
  eg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  envScene.add(new THREE.Mesh(eg, em));
  logoScene.environment = pm.fromScene(envScene, 0.02).texture;
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(-3, 4, 6);
  logoScene.add(key);
  const rim = new THREE.PointLight('#3a2bff', 60, 30);
  rim.position.set(4, -1, -3);
  logoScene.add(rim);
  logoScene.userData.sweep = new THREE.PointLight('#ffffff', 0, 12);
  logoScene.add(logoScene.userData.sweep);
}

// ------------------------------------------------------------------ hero: protocol stack
const stackScene = new THREE.Scene();
const stackCam = new THREE.PerspectiveCamera(18, 1920 / 1080, 0.1, 200);
const stack = new THREE.Group();
stackScene.add(stack);
const layers = [];
{
  stackScene.add(new THREE.HemisphereLight('#ffffff', '#c9c9d4', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(-6, 10, 7);
  stackScene.add(key);
  const fill = new THREE.DirectionalLight('#dfe0ff', 0.8);
  fill.position.set(7, 3, 5);
  stackScene.add(fill);

  const tileGeo = new RoundedBoxGeometry(4, 0.62, 4, 6, 0.32);
  const slabGeo = new RoundedBoxGeometry(4, 0.52, 4, 6, 0.32);
  const black = new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', roughness: 0.38, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.18 });
  const labels = [['Payments (x402)'], ['Identity (ERC-8004)'], ['Interop (A2A)']];
  const edgeMat = new THREE.LineBasicMaterial({ color: '#c8c8cc', transparent: true });
  labels.forEach(([txt], i) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.55, transparent: true, opacity: 0.97 });
    const m = new THREE.Mesh(slabGeo, mat);
    g.add(m);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo, 30), edgeMat);
    g.add(edges);
    const lab = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.425),
      new THREE.MeshBasicMaterial({ map: textTexture(txt, { font: '400 58px "Geist Mono"', color: '#1d1d1d', spacing: 4 }), transparent: true, toneMapped: false }),
    );
    lab.position.set(0.05, 0, 2.003);
    g.add(lab);
    g.userData = { home: -0.78 * (3 - i) - 0.05, mat, lab };
    stack.add(g);
    layers.push(g);
  });
  const top = new THREE.Group();
  const tile = new THREE.Mesh(tileGeo, black);
  top.add(tile);
  const lab = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.425),
    new THREE.MeshBasicMaterial({ map: textTexture('Adjudication', { font: '400 60px "Geist Mono"', color: '#ffffff', spacing: 4 }), transparent: true, toneMapped: false }),
  );
  lab.position.set(0.05, 0, 2.003);
  top.add(lab);
  // mark lying on the tile, pointing "up" on screen
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.35 });
  const mark = new THREE.Group();
  logoShapes(2.5).forEach((shape) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    mark.add(new THREE.Mesh(geo, white));
  });
  mark.rotation.x = -Math.PI / 2;
  const markHolder = new THREE.Group();
  markHolder.rotation.y = -Math.PI / 2;
  markHolder.position.y = 0.315;
  markHolder.add(mark);
  top.add(markHolder);
  top.userData = { home: 0.05, mark };
  stack.add(top);
  layers.push(top);

  // contact shadow
  const sc = document.createElement('canvas');
  sc.width = sc.height = 256;
  const sg = sc.getContext('2d');
  const gr = sg.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, 'rgba(10,10,30,0.35)');
  gr.addColorStop(1, 'rgba(10,10,30,0)');
  sg.fillStyle = gr;
  sg.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -2.75;
  stackScene.add(shadow);
  stackScene.userData.shadow = shadow;

  // dashed ground rings like the site hero
  const rings = new THREE.Group();
  [4.2, 5.6, 7.2, 9.0].forEach((r, i) => {
    const pts = [];
    for (let k = 0; k <= 160; k++) pts.push(new THREE.Vector3(Math.cos((k / 160) * Math.PI * 2) * r, 0, Math.sin((k / 160) * Math.PI * 2) * r));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: '#b9b9c2', dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.8 - i * 0.15 }));
    line.computeLineDistances();
    rings.add(line);
  });
  rings.position.y = -2.78;
  stackScene.add(rings);
  stackScene.userData.rings = rings;
}

export const GL = {
  canvas: canvasEl,
  logo: logoGroup,
  logoCam,
  logoScene,
  stack,
  layers,
  stackCam,
  stackScene,
  shot: null,
  refreshText() {
    textures.forEach((d) => d());
  },
  reset() {
    this.shot = null;
  },
  draw() {
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    if (this.shot === 'logo') renderer.render(logoScene, logoCam);
    else if (this.shot === 'stack') renderer.render(stackScene, stackCam);
    canvasEl.style.display = this.shot ? 'block' : 'none';
  },
  /** Project a world position of the current shot to screen pixels. */
  project(v, cam) {
    const p = v.clone().project(cam);
    return [(p.x * 0.5 + 0.5) * 1920, (-p.y * 0.5 + 0.5) * 1080];
  },
};
