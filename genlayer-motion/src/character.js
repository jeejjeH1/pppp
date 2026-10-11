import * as THREE from 'three';
import { C } from './palette.js';
import { makeFaceTexture } from './textures.js';
import { makeLogoMesh } from './logo.js';

const FACE_KINDS = ['angry', 'happy', 'blink', 'wide', 'check', 'cross', 'think'];
let faceCache = null;
function faces() {
  if (!faceCache) {
    faceCache = {};
    for (const k of FACE_KINDS) faceCache[k] = makeFaceTexture(k);
    faceCache.crossRed = makeFaceTexture('cross', C.red);
  }
  return faceCache;
}

function mat(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    ...opts,
  });
}

// Planar UV projection so the face canvas maps flat onto the visor dome.
function planarUV(geo, rx, ry) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / rx * 0.5 + 0.5, pos.getY(i) / ry * 0.5 + 0.5);
  }
  uv.needsUpdate = true;
}

function catEar(side) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.34, 0);
  shape.lineTo(0.3, 0);
  shape.lineTo(0.1, 0.78);
  shape.closePath();
  const outer = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4 }),
    mat(C.gray, { roughness: 0.3 }),
  );
  outer.position.z = -0.06;
  g.add(outer);
  const inner = new THREE.Shape();
  inner.moveTo(-0.22, 0.06);
  inner.lineTo(0.2, 0.06);
  inner.lineTo(0.08, 0.64);
  inner.closePath();
  const innerMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(inner, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 }),
    mat(C.purple, { emissive: new THREE.Color(C.purple), emissiveIntensity: 0.55, roughness: 0.25 }),
  );
  innerMesh.position.z = 0.11;
  g.add(innerMesh);
  g.scale.x = side; // mirror so the tip leans outward
  return g;
}

function capsule(r, len, color, opts) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 24), mat(color, opts));
}

/**
 * Builds the GenLayer cat-astronaut mascot.
 * Returned object exposes `.pose(t, params)` for pure, time-driven animation.
 */
export function makeCharacter({ blaster = true } = {}) {
  const F = faces();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ---------------- head
  const head = new THREE.Group();
  head.position.set(0, 2.15, 0);
  body.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat(C.white, { roughness: 0.28, clearcoat: 1 }));
  helmet.scale.set(1.1, 0.96, 1.0);
  head.add(helmet);

  const frameGeo = new THREE.SphereGeometry(1, 64, 48);
  const frame = new THREE.Mesh(frameGeo, mat(C.gray, { roughness: 0.3, metalness: 0.2 }));
  frame.scale.set(0.98, 0.8, 0.62);
  frame.position.set(0, -0.04, 0.42);
  head.add(frame);

  const visorGeo = new THREE.SphereGeometry(1, 64, 48);
  planarUV(visorGeo, 1, 1);
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: '#0d1430',
    roughness: 0.12,
    metalness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: F.angry,
    emissiveIntensity: 1.6,
  });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.scale.set(0.9, 0.72, 0.6);
  visor.position.set(0, -0.04, 0.5);
  head.add(visor);

  // headphones
  for (const s of [-1, 1]) {
    const cup = new THREE.Group();
    cup.position.set(s * 1.06, 0.02, 0.05);
    cup.rotation.z = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.2, 40), mat(C.gray, { metalness: 0.3, roughness: 0.3 }));
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.26, 40),
      mat(C.purple, { emissive: new THREE.Color(C.purple), emissiveIntensity: 0.7, roughness: 0.2 }),
    );
    cup.add(ring, pad);
    head.add(cup);
  }
  // ears
  for (const s of [-1, 1]) {
    const ear = catEar(s);
    ear.position.set(s * 0.62, 0.62, -0.05);
    ear.rotation.z = -s * 0.38;
    head.add(ear);
  }

  // ---------------- torso
  const torso = capsule(0.5, 0.42, C.white, { roughness: 0.32, clearcoat: 1 });
  torso.position.y = 0.88;
  torso.scale.set(1, 1, 0.82);
  body.add(torso);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 16, 48), mat(C.gray, { metalness: 0.3, roughness: 0.3 }));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.32;
  body.add(collar);

  // harness straps / shoulder plates
  for (const s of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 24), mat(C.gray, { metalness: 0.25, roughness: 0.3 }));
    pad.position.set(s * 0.5, 1.18, 0);
    pad.scale.set(1, 0.8, 0.9);
    body.add(pad);
  }
  const chestLogo = makeLogoMesh({ depth: 0.06, size: 0.5, glow: 1.3 });
  chestLogo.position.set(0, 0.9, 0.43);
  chestLogo.rotation.x = -0.12;
  body.add(chestLogo);

  const backLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), new THREE.MeshBasicMaterial({ color: C.mint }));
  backLight.position.set(0, 1.08, -0.44);
  body.add(backLight);

  // ---------------- arms
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.6, 1.16, 0);
    const upper = capsule(0.15, 0.32, C.gray, { metalness: 0.2 });
    upper.position.y = -0.28;
    shoulder.add(upper);
    const hand = new THREE.Group();
    hand.position.y = -0.62;
    const glove = capsule(0.21, 0.16, C.gauntlet, { roughness: 0.4 });
    glove.scale.set(1, 1, 0.95);
    hand.add(glove);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), new THREE.MeshBasicMaterial({ color: C.mint }));
    dot.position.set(s * 0.06, 0.06, 0.19);
    hand.add(dot);
    shoulder.add(hand);
    body.add(shoulder);
    arms.push({ shoulder, hand });
  }
  // blaster on right hand (viewer left)
  let blasterMesh = null;
  if (blaster) {
    blasterMesh = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.3, 48), mat(C.gauntlet, { metalness: 0.4, roughness: 0.35 }));
    barrel.rotation.x = Math.PI / 2;
    blasterMesh.add(barrel);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 48), mat('#22243a'));
    face.rotation.x = Math.PI / 2;
    face.position.z = 0.16;
    blasterMesh.add(face);
    [[0, 0.11], [-0.11, -0.07], [0.11, -0.07]].forEach(([x, y]) => {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.mint).multiplyScalar(0.75) }));
      l.position.set(x, y, 0.175);
      blasterMesh.add(l);
    });
    blasterMesh.position.set(-0.05, -0.05, 0.22);
    blasterMesh.rotation.y = -0.5;
    arms[0].hand.add(blasterMesh);
  }

  // ---------------- legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.24, 0.5, 0);
    const leg = capsule(0.2, 0.22, C.white, { clearcoat: 1, roughness: 0.3 });
    leg.position.y = -0.22;
    hip.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.23, 32, 20), mat(C.white, { clearcoat: 1, roughness: 0.3 }));
    foot.scale.set(1, 0.55, 1.25);
    foot.position.set(0, -0.44, 0.06);
    hip.add(foot);
    body.add(hip);
    legs.push(hip);
  }

  // ---------------- tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.6, -0.4);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.25, -0.25, -0.35),
    new THREE.Vector3(0.75, -0.1, -0.4),
    new THREE.Vector3(1.05, 0.35, -0.2),
    new THREE.Vector3(0.9, 0.7, 0.0),
    new THREE.Vector3(0.65, 0.62, 0.1),
  ]);
  const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.06, 12, false), mat('#211d2a', { roughness: 0.5 }));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), tailMesh.material);
  tip.position.copy(curve.getPoint(1));
  tail.add(tailMesh, tip);
  body.add(tail);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const api = {
    root,
    body,
    head,
    visorMat,
    arms,
    tail,
    setFace(kind) {
      visorMat.emissiveMap = F[kind] || F.angry;
    },
    /**
     * Pure function of time. p = { wave, armL, armR, lookX, lookY, bounce, walk }
     */
    pose(t, p = {}) {
      const bob = Math.sin(t * Math.PI * 2 * 0.5) * 0.04 * (p.bob ?? 1);
      body.position.y = bob + (p.lift ?? 0);
      head.rotation.y = (p.lookX ?? 0) + Math.sin(t * 0.9) * 0.05;
      head.rotation.x = (p.lookY ?? 0) + Math.sin(t * 1.3) * 0.03;
      head.rotation.z = (p.tilt ?? 0) + Math.sin(t * 0.7) * 0.03;
      const sw = Math.sin(t * Math.PI * 2 * 0.5);
      // arms[0] = character's right (viewer left), arms[1] = left
      arms[0].shoulder.rotation.z = -0.15 - (p.armR ?? 0) + sw * 0.04;
      arms[0].shoulder.rotation.x = -(p.armRFwd ?? 0.35);
      arms[1].shoulder.rotation.z = 0.15 + (p.armL ?? 0) - sw * 0.04;
      arms[1].shoulder.rotation.x = -(p.armLFwd ?? 0);
      if (p.wave) {
        arms[1].shoulder.rotation.z = 2.5 + Math.sin(t * 14) * 0.35 * p.wave;
      }
      tail.rotation.y = Math.sin(t * 2.2) * 0.35;
      tail.rotation.z = Math.sin(t * 1.7) * 0.12;
      const squash = p.squash ?? 0;
      body.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      const blink = (t % 3.7) > 3.55;
      if (p.face) api.setFace(blink && p.face === 'angry' ? 'blink' : p.face);
      visorMat.emissiveIntensity = (p.glow ?? 1.6) * (0.92 + 0.08 * Math.sin(t * 9));
    },
  };
  return api;
}

// Mini validator head (helmet + visor + ears) reused for consensus scene.
export function makeHead() {
  const c = makeCharacter({ blaster: false });
  const head = c.head;
  c.body.remove(head);
  head.position.set(0, 0, 0);
  return { root: head, visorMat: c.visorMat, setFace: c.setFace };
}
