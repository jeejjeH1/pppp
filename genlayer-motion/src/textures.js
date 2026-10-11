import * as THREE from 'three';
import { C, LOGO_POLYS } from './palette.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function logoPath(ctx, cx, cy, size) {
  // Draws the GenLayer mark centered on (cx, cy), `size` px tall.
  const s = size / 340;
  ctx.beginPath();
  for (const poly of Object.values(LOGO_POLYS)) {
    poly.forEach(([x, y], i) => {
      const px = cx + (x - 200.5) * s;
      const py = cy + (y - 203) * s;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.closePath();
  }
}

// ---------------------------------------------------------------------------
// Visor faces: LED dot-matrix expressions, drawn as a mask then resampled
// into glowing dots like the reference character.
const FACE_W = 1024;
const FACE_H = 768;

function drawExpression(ctx, kind) {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const eye = (side) => {
    const sx = side;
    ctx.save();
    ctx.translate(512 + sx * 190, 420);
    ctx.scale(sx, 1);
    if (kind === 'angry') {
      // slanted angular eye, inner corner low (like the reference)
      ctx.beginPath();
      ctx.moveTo(-135, -50);
      ctx.quadraticCurveTo(-10, -50, 95, 25);
      ctx.quadraticCurveTo(10, 105, -95, 70);
      ctx.quadraticCurveTo(-150, 30, -135, -50);
      ctx.fill();
    } else if (kind === 'happy') {
      ctx.lineWidth = 46;
      ctx.beginPath();
      ctx.moveTo(-110, 60);
      ctx.quadraticCurveTo(0, -80, 110, 60);
      ctx.stroke();
    } else if (kind === 'blink') {
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.moveTo(-110, 40);
      ctx.lineTo(100, 50);
      ctx.stroke();
    } else if (kind === 'wide') {
      ctx.beginPath();
      ctx.ellipse(0, 20, 88, 98, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  if (kind === 'check') {
    ctx.lineWidth = 70;
    ctx.beginPath();
    ctx.moveTo(330, 430);
    ctx.lineTo(460, 560);
    ctx.lineTo(700, 300);
    ctx.stroke();
    return;
  }
  if (kind === 'cross') {
    ctx.lineWidth = 70;
    ctx.beginPath();
    ctx.moveTo(370, 300);
    ctx.lineTo(650, 580);
    ctx.moveTo(650, 300);
    ctx.lineTo(370, 580);
    ctx.stroke();
    return;
  }
  if (kind === 'think') {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(352 + i * 160, 440, 44, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  eye(-1);
  eye(1);
  // cat "w" mouth
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(420, 560);
  ctx.quadraticCurveTo(466, 625, 512, 572);
  ctx.quadraticCurveTo(558, 625, 604, 560);
  ctx.stroke();
}

export function makeFaceTexture(kind, color = C.mint) {
  const [mask, mctx] = canvas(FACE_W, FACE_H);
  drawExpression(mctx, kind);
  // forehead A
  mctx.fillStyle = '#fff';
  logoPath(mctx, 512, 205, 120);
  mctx.fill();
  const data = mctx.getImageData(0, 0, FACE_W, FACE_H).data;

  const [c, ctx] = canvas(FACE_W, FACE_H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  // faint visor sheen (teal top, like reference), emissive so keep subtle
  const g = ctx.createLinearGradient(0, 0, 0, FACE_H);
  g.addColorStop(0, 'rgba(60,170,170,0.28)');
  g.addColorStop(0.45, 'rgba(20,60,80,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FACE_W, FACE_H);

  const step = 15;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  for (let y = step / 2; y < FACE_H; y += step) {
    for (let x = step / 2; x < FACE_W; x += step) {
      const i = ((y | 0) * FACE_W + (x | 0)) * 4;
      if (data[i] > 128) {
        ctx.beginPath();
        ctx.arc(x, y, step * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------------------
// Floating UI cards (web sources, code, evidence ...)
export function makeCardTexture(opts) {
  const { w = 640, h = 400, title = '', tag = '', lines = 4, accent = C.pink, body = null, mono = false, icon = null, status = null } = opts;
  const [c, ctx] = canvas(w, h);
  const r = 28;
  ctx.clearRect(0, 0, w, h);
  // glass body
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, r);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(40,14,58,0.92)');
  g.addColorStop(1, 'rgba(14,6,24,0.92)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = accent;
  ctx.stroke();
  // header bar
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, 64, [r, r, 0, 0]);
  ctx.fillStyle = 'rgba(255,135,255,0.12)';
  ctx.fill();
  ctx.restore();
  [0, 1, 2].forEach((i) => {
    ctx.beginPath();
    ctx.arc(40 + i * 28, 38, 9, 0, Math.PI * 2);
    ctx.fillStyle = [C.purple, C.pink, C.mint][i];
    ctx.fill();
  });
  ctx.font = '600 26px "Inter"';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textBaseline = 'middle';
  ctx.fillText(tag, 140, 39);

  ctx.font = '800 44px "Inter Display"';
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  let y = 140;
  if (icon) {
    ctx.font = '800 60px "Inter Display"';
    ctx.fillStyle = accent;
    ctx.fillText(icon, 40, y);
    ctx.font = '800 44px "Inter Display"';
    ctx.fillStyle = '#fff';
    ctx.fillText(title, 120, y - 6);
  } else if (title) {
    ctx.fillText(title, 40, y);
  }
  y += 40;
  if (body) {
    ctx.font = mono ? '500 30px "DejaVu Sans Mono"' : '500 32px "Inter"';
    body.forEach((ln, i) => {
      if (Array.isArray(ln)) {
        let x = 40;
        for (const [txt, col] of ln) {
          ctx.fillStyle = col;
          ctx.fillText(txt, x, y + i * 46);
          x += ctx.measureText(txt).width;
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(ln, 40, y + i * 46);
      }
    });
  } else {
    for (let i = 0; i < lines; i++) {
      const lw = (w - 80) * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.7 + title.length)));
      ctx.beginPath();
      ctx.roundRect(40, y + i * 40, lw, 16, 8);
      ctx.fillStyle = i === 0 ? 'rgba(168,255,210,0.55)' : 'rgba(255,255,255,0.18)';
      ctx.fill();
    }
  }
  if (status) {
    const [txt, col] = status;
    ctx.font = '800 28px "Inter"';
    const tw = ctx.measureText(txt).width + 40;
    ctx.beginPath();
    ctx.roundRect(w - tw - 30, h - 74, tw, 48, 24);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillText(txt, w - tw - 10, h - 40);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function makeGlowSprite(color = '#fff') {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCoinTexture() {
  const [c, ctx] = canvas(512, 512);
  const g = ctx.createRadialGradient(256, 200, 20, 256, 256, 256);
  g.addColorStop(0, C.pink);
  g.addColorStop(1, C.purple);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(256, 256, 220, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  logoPath(ctx, 256, 262, 270);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
