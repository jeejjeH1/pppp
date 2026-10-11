import * as THREE from 'three';
import { C, LOGO_POLYS, LOGO_CENTER } from './palette.js';

function shapeFrom(poly, scale) {
  const s = new THREE.Shape();
  poly.forEach(([x, y], i) => {
    const px = (x - LOGO_CENTER[0]) * scale;
    const py = -(y - LOGO_CENTER[1]) * scale;
    i ? s.lineTo(px, py) : s.moveTo(px, py);
  });
  s.closePath();
  return s;
}

/**
 * Extruded GenLayer mark. Returns a group with three named parts (left, right, diamond)
 * so the intro can assemble it piece by piece.
 * `size` = overall height in world units.
 */
export function makeLogoMesh({ size = 3, depth = 0.35, glow = 2.2, chrome = false } = {}) {
  const scale = size / 340;
  const group = new THREE.Group();
  const face = chrome
    ? new THREE.MeshPhysicalMaterial({ color: '#1c0727', metalness: 0.5, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 1, sheenColor: new THREE.Color(C.pink), sheenRoughness: 0.35 })
    : new THREE.MeshPhysicalMaterial({ color: C.pink, metalness: 0.2, roughness: 0.25, emissive: new THREE.Color(C.purple), emissiveIntensity: glow * 0.35, clearcoat: 1 });
  const side = new THREE.MeshStandardMaterial({ color: C.purple, emissive: new THREE.Color(C.purple), emissiveIntensity: glow, roughness: 0.4 });
  group.userData.materials = { face, side };
  for (const [name, poly] of Object.entries(LOGO_POLYS)) {
    const geo = new THREE.ExtrudeGeometry(shapeFrom(poly, scale), {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.18,
      bevelSize: size * 0.008,
      bevelSegments: 3,
    });
    geo.translate(0, 0, -depth / 2);
    // compute local centroid so each piece can spin about itself
    geo.computeBoundingBox();
    const ctr = new THREE.Vector3();
    geo.boundingBox.getCenter(ctr);
    geo.translate(-ctr.x, -ctr.y, 0);
    const m = new THREE.Mesh(geo, [face, side]);
    m.position.set(ctr.x, ctr.y, 0);
    m.userData.home = m.position.clone();
    m.name = name;
    group.add(m);
  }
  return group;
}
