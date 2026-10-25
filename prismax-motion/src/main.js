// Prismax — "Latency vs. π0.5 rollout performance". 1920×1080 motion piece for an X/Twitter post.
// Everything is drawn on a 2D canvas as a pure function of time: window.renderAt(t) draws frame t,
// and src/render.cjs steps it frame by frame in headless Chromium and pipes the frames into ffmpeg.
// Scene/transition/hit timings live in timeline.json, which the soundtrack (src/audio.py) reads too.
const TL = await (await fetch('./timeline.json')).json();
const W = 1920, H = 1080, TAU = Math.PI * 2;

// ------------------------------------------------------------------ brand
const INK = '#202020', CREAM = '#DFD8D0', GOLD = '#B9986A', BRONZE = '#B56654', BROWN = '#7A6B5A';
const GOLD_L = '#E4CA9E', BRONZE_L = '#D98A72', PAPER = '#F4F1EC';
const SERIF = '"PX Serif", Georgia, serif';
const SANS = '"PX Sans", Arial, sans-serif';
const MONO = '"PX Mono", "DejaVu Sans Mono", monospace';
const LOGO = '"PX Logo", Georgia, serif';
const F = (size, fam = SERIF, weight = 400, style = 'normal') => `${style} ${weight} ${size}px ${fam}`;

async function loadFonts() {
  const fs = '/node_modules/@fontsource/';
  const defs = [
    ['PX Serif', 'instrument-serif/files/instrument-serif-latin-400-normal.woff2', {}],
    ['PX Serif', 'instrument-serif/files/instrument-serif-latin-400-italic.woff2', { style: 'italic' }],
    ['PX Serif', 'noto-serif-display/files/noto-serif-display-greek-300-normal.woff2', { unicodeRange: 'U+0370-03FF' }],
    ['PX Serif', 'noto-serif-display/files/noto-serif-display-greek-300-italic.woff2', { style: 'italic', unicodeRange: 'U+0370-03FF' }],
    ['PX Sans', 'inter/files/inter-latin-300-normal.woff2', { weight: '300' }],
    ['PX Sans', 'inter/files/inter-latin-400-normal.woff2', { weight: '400' }],
    ['PX Sans', 'inter/files/inter-latin-500-normal.woff2', { weight: '500' }],
    ['PX Sans', 'inter/files/inter-greek-400-normal.woff2', { weight: '400', unicodeRange: 'U+0370-03FF' }],
    ['PX Mono', 'jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', { weight: '400' }],
    ['PX Mono', 'jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2', { weight: '500' }],
    ['PX Mono', 'jetbrains-mono/files/jetbrains-mono-greek-400-normal.woff2', { weight: '400', unicodeRange: 'U+0370-03FF' }],
    ['PX Mono', 'jetbrains-mono/files/jetbrains-mono-greek-500-normal.woff2', { weight: '500', unicodeRange: 'U+0370-03FF' }],
    ['PX Logo', 'playfair-display/files/playfair-display-latin-800-normal.woff2', { weight: '800' }],
    ['PX Logo', 'playfair-display/files/playfair-display-latin-400-normal.woff2', { weight: '400' }],
  ];
  await Promise.all(defs.map(async ([fam, p, desc]) => {
    try {
      const f = new FontFace(fam, `url(${fs}${p})`, desc);
      await f.load();
      document.fonts.add(f);
    } catch (e) {
      console.warn('font missing', p);
    }
  }));
}

// ------------------------------------------------------------------ math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const eInExpo = (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
const eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const eOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(7);

// ------------------------------------------------------------------ canvases
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const out = mk(W, H); document.body.appendChild(out);
const ox = out.getContext('2d');
const scn = mk(W, H), sx = scn.getContext('2d');
const bufA = mk(W, H), ax = bufA.getContext('2d');
const bufB = mk(W, H), bx = bufB.getContext('2d');
const tmp = mk(W, H), tx = tmp.getContext('2d');
const tmp2 = mk(W, H), tx2 = tmp2.getContext('2d');
const sm1 = mk(W / 4, H / 4), s1 = sm1.getContext('2d');
const sm2 = mk(W / 4, H / 4), s2 = sm2.getContext('2d');
const rays = mk(W / 4, H / 4), rx = rays.getContext('2d');

function reset(c) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.filter = 'none';
  c.shadowBlur = 0; c.shadowColor = 'transparent'; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
  c.setLineDash([]);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.imageSmoothingQuality = 'high';
}

// sprites
const bokeh = mk(128, 128);
{
  const b = bokeh.getContext('2d');
  const g = b.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,215,1)'); g.addColorStop(0.22, 'rgba(236,206,160,.55)');
  g.addColorStop(0.6, 'rgba(185,152,106,.14)'); g.addColorStop(1, 'rgba(185,152,106,0)');
  b.fillStyle = g; b.fillRect(0, 0, 128, 128);
}
const disk = mk(128, 128);
{
  const b = disk.getContext('2d');
  const g = b.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(228,202,158,.22)'); g.addColorStop(0.82, 'rgba(228,202,158,.30)');
  g.addColorStop(0.93, 'rgba(255,236,205,.55)'); g.addColorStop(1, 'rgba(228,202,158,0)');
  b.fillStyle = g; b.beginPath(); b.arc(64, 64, 62, 0, TAU); b.fill();
}
const GRAIN = Array.from({ length: 6 }, (_, k) => {
  const c = mk(256, 256), g = c.getContext('2d');
  const id = g.createImageData(256, 256), r = rng(100 + k);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 128 + (r() + r() + r() - 1.5) * 150;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return ox.createPattern(c, 'repeat');
});

// ------------------------------------------------------------------ logo
function trim(c) {
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const o = mk(x1 - x0 + 3, y1 - y0 + 3);
  o.getContext('2d').drawImage(c, -x0 + 1, -y0 + 1);
  return o;
}
function tint(img, color, h) {
  const w = Math.ceil((h * img.width) / img.height);
  const c = mk(w + 8, h + 8), g = c.getContext('2d');
  g.drawImage(img, 4, 4, w, h);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return trim(c);
}
// Approximation of the Prismax wordmark (condensed high-contrast serif, the "i" drawn as a dot over a
// diagonal stroke, superscript "(x)"), used only when assets/*.svg are not present.
function synthMark(color, mono) {
  const S = 420, sxf = 0.8;
  const c = mk(S * 4, S * 1.6), x = c.getContext('2d');
  const base = S * 1.2;
  x.fillStyle = color;
  x.scale(sxf, 1);
  x.font = F(S, LOGO, 800);
  let px = 20;
  const head = mono ? 'P' : 'Pr';
  x.fillText(head, px, base);
  px += x.measureText(head).width;
  if (!mono) {
    const xi = px - S * 0.01, xh = S * 0.5;
    x.beginPath();
    x.moveTo(xi, base - xh); x.lineTo(xi + S * 0.1, base - xh);
    x.lineTo(xi + S * 0.33, base); x.lineTo(xi + S * 0.24, base);
    x.closePath(); x.fill();
    x.beginPath(); x.arc(xi + S * 0.045, base - xh - S * 0.15, S * 0.055, 0, TAU); x.fill();
    px = xi + S * 0.2;
    x.fillText('sma', px, base);
    px += x.measureText('sma').width;
  }
  x.font = F(S * (mono ? 0.5 : 0.38), LOGO, 400);
  x.fillText('(x)', px + S * 0.03, base - S * (mono ? 0.42 : 0.6));
  return trim(c);
}
async function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
const MARK = {};
async function buildLogos() {
  let word = null, mono = null;
  try { word = await loadImg('/assets/prismax-wordmark.svg'); } catch { console.warn('no wordmark svg, using synthesized mark'); }
  try { mono = await loadImg('/assets/prismax-monogram.svg'); } catch { console.warn('no monogram svg, using synthesized mark'); }
  for (const [k, col] of [['cream', CREAM], ['ink', INK], ['white', '#FFF6EA']]) {
    MARK['word_' + k] = word ? tint(word, col, 420) : synthMark(col, false);
    MARK['mono_' + k] = mono ? tint(mono, col, 520) : synthMark(col, true);
  }
}
function drawMark(c, img, cx, cy, h, a = 1) {
  const w = (h * img.width) / img.height;
  c.save(); c.globalAlpha *= a; c.drawImage(img, cx - w / 2, cy - h / 2, w, h); c.restore();
  return [cx - w / 2, cy - h / 2, w, h];
}
// A light band sliding across a shape (the shape's own alpha is the mask).
function glint(c, img, box, p, { col = '255,242,222', width = 0.16, mode = 'lighter', a = 1 } = {}) {
  if (p <= 0 || p >= 1) return;
  const [x, y, w, h] = box;
  reset(tx); tx.clearRect(0, 0, W, H);
  tx.drawImage(img, x, y, w, h);
  tx.globalCompositeOperation = 'source-in';
  const bxp = lerp(x - w * 0.35, x + w * 1.35, p), bw = w * width;
  const g = tx.createLinearGradient(bxp - bw, y, bxp + bw, y + h * 0.4);
  g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
  tx.fillStyle = g; tx.fillRect(x, y, w, h);
  c.save(); c.globalCompositeOperation = mode; c.drawImage(tmp, 0, 0); c.restore();
}

// ------------------------------------------------------------------ text
function segWidth(c, sg) { c.font = sg.f; return c.measureText(sg.s).width + (sg.tr || 0) * Math.max(0, sg.s.length - 1); }
function measure(c, segs) { return segs.reduce((a, sg) => a + segWidth(c, sg), 0); }
// Draws segments [{s, f, color, tr, glow, glowColor}] glyph by glyph; fx(i, n) -> {a, x, y, s, blur, ch, color, glow}.
function rich(c, segs, x, y, { align = 'left', fx = null } = {}) {
  const items = [];
  let total = 0;
  for (const sg of segs) {
    c.font = sg.f;
    const tr = sg.tr || 0;
    for (let i = 0; i < sg.s.length; i++) {
      items.push({ ch: sg.s[i], x: total + c.measureText(sg.s.slice(0, i)).width + tr * i, w: c.measureText(sg.s[i]).width, sg });
    }
    total += segWidth(c, sg);
  }
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const n = items.length;
  items.forEach((it, i) => {
    if (it.ch === ' ') return;
    const o = fx ? fx(i, n) : {};
    const a = o.a ?? 1;
    if (a <= 0.003) return;
    c.save();
    c.globalAlpha *= Math.min(1, a);
    c.font = it.sg.f;
    c.fillStyle = o.color || it.sg.color;
    c.translate(x0 + it.x + it.w / 2 + (o.x || 0), y + (o.y || 0));
    if (o.s && o.s !== 1) c.scale(o.s, o.s);
    if (o.blur > 0.4) c.filter = `blur(${o.blur.toFixed(1)}px)`;
    const gl = o.glow ?? it.sg.glow;
    if (gl) { c.shadowColor = it.sg.glowColor || 'rgba(255,214,160,.85)'; c.shadowBlur = gl; }
    c.fillText(o.ch || it.ch, -it.w / 2, 0);
    c.restore();
  });
  return { x0, w: total };
}
const fxRise = (u, { st = 0.032, d = 0.9, dist = 70, blur = 16 } = {}) => (i) => {
  const p = clamp((u - i * st) / d);
  const e = eOutExpo(p);
  return { a: clamp(p * 2.4), y: (1 - e) * dist, blur: (1 - e) * blur };
};
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/=';
const fxDecode = (u, cps = 30, lead = 0.2) => (i) => {
  const ts = i / cps;
  if (u < ts - lead) return { a: 0 };
  if (u < ts) return { a: 0.75, ch: GLYPHS[Math.floor(hash(i * 13 + Math.floor(u * 26)) * GLYPHS.length)] };
  return {};
};
function kicker(c, s, x, y, u, { align = 'left', color = GOLD, size = 18, tr = 7, cps = 34, a = 1 } = {}) {
  if (u <= 0 || a <= 0) return;
  c.save(); c.globalAlpha *= a;
  rich(c, [{ s, f: F(size, MONO, 500), color, tr }], x, y, { align, fx: fxDecode(u, cps) });
  c.restore();
}
function wipeText(c, segs, x, y, size, p, { align = 'center' } = {}) {
  if (p <= 0) return;
  const m = measure(c, segs);
  const x0 = align === 'center' ? x - m / 2 : x;
  const ww = (m + 80) * p;
  c.save();
  c.beginPath(); c.rect(x0 - 40, y - size * 1.05, ww, size * 1.5); c.clip();
  rich(c, segs, x, y, { align, fx: (i) => ({ blur: (1 - p) * 4 }) });
  c.restore();
  if (p < 1) {
    const ex = x0 - 40 + ww;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(ex - 90, 0, ex + 4, 0);
    g.addColorStop(0, 'rgba(228,202,158,0)'); g.addColorStop(1, 'rgba(255,240,215,.85)');
    c.fillStyle = g; c.fillRect(ex - 90, y - size * 0.95, 94, size * 1.3);
    c.restore();
    flare(c, ex, y - size * 0.32, 0.22, 0.55 * Math.sin(p * Math.PI), { ghosts: false });
  }
}

// ------------------------------------------------------------------ light
const GHOSTS = [[0.45, 34, '185,152,106', 0.22], [0.75, 14, '217,138,114', 0.32], [1.15, 70, '223,216,208', 0.08],
  [1.5, 22, '228,202,158', 0.22], [1.85, 120, '122,107,90', 0.08], [2.2, 44, '181,102,84', 0.12]];
function flare(c, x, y, s, a, { ghosts = true, streak = 1 } = {}) {
  if (a <= 0.002) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  let r = 180 * s;
  let g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,252,244,${a})`); g.addColorStop(0.12, `rgba(255,228,186,${0.7 * a})`);
  g.addColorStop(0.45, `rgba(214,170,120,${0.16 * a})`); g.addColorStop(1, 'rgba(185,152,106,0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  // anamorphic streak
  c.save();
  c.translate(x, y); c.scale(1, 0.016);
  r = W * 0.62 * s * streak;
  g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(255,250,240,${a})`); g.addColorStop(0.18, `rgba(244,210,160,${0.55 * a})`);
  g.addColorStop(0.55, `rgba(185,152,106,${0.12 * a})`); g.addColorStop(1, 'rgba(185,152,106,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.restore();
  if (ghosts) {
    const dx = W / 2 - x, dy = H / 2 - y;
    for (const [k, gr, col, ga] of GHOSTS) {
      const gx = x + dx * k, gy = y + dy * k, rr = gr * (0.6 + s * 0.6);
      const gg = c.createRadialGradient(gx, gy, 0, gx, gy, rr);
      gg.addColorStop(0, `rgba(${col},${ga * a * 0.5})`); gg.addColorStop(0.85, `rgba(${col},${ga * a})`); gg.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gg; c.beginPath(); c.arc(gx, gy, rr, 0, TAU); c.fill();
    }
  }
  c.restore();
}
function leaks(c, t, a) {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'screen';
  const B = [
    [0.1 + 0.08 * Math.sin(t * 0.21), 0.16 + 0.1 * Math.cos(t * 0.17), 0.55, '181,102,84', 0.30],
    [0.9 + 0.06 * Math.cos(t * 0.15), 0.85 + 0.08 * Math.sin(t * 0.19), 0.6, '185,152,106', 0.28],
    [0.55 + 0.25 * Math.sin(t * 0.09), 1.08, 0.42, '228,202,158', 0.12],
  ];
  for (const [x, y, r, col, al] of B) {
    const g = c.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W);
    g.addColorStop(0, `rgba(${col},${al * a})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  c.restore();
}
function godRays(c, cx, cy, t, a, { n = 26, len = 1.25, col = '255,226,180', spin = 0.04 } = {}) {
  if (a <= 0.002) return;
  reset(rx); rx.clearRect(0, 0, W / 4, H / 4);
  rx.translate(cx / 4, cy / 4);
  rx.globalCompositeOperation = 'lighter';
  const r = (W / 4) * len;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + t * spin + (hash(i) - 0.5) * 0.3;
    const w = 0.012 + 0.035 * hash(i + 40);
    const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 3.1));
    const g = rx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${col},${0.55 * k})`); g.addColorStop(0.5, `rgba(${col},${0.12 * k})`); g.addColorStop(1, `rgba(${col},0)`);
    rx.fillStyle = g;
    rx.beginPath(); rx.moveTo(0, 0); rx.arc(0, 0, r, ang - w, ang + w); rx.closePath(); rx.fill();
  }
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= a; c.drawImage(rays, 0, 0, W, H); c.restore();
}
const DUST = Array.from({ length: 170 }, () => ({ x: R(), y: R(), z: R(), vx: (R() - 0.5) * 0.012, vy: -0.004 - R() * 0.01, ph: R() * TAU, tw: 0.5 + R() * 2 }));
function dust(c, t, a = 1) {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const p of DUST) {
    const x = ((((p.x + p.vx * t + Math.sin(t * 0.3 + p.ph) * 0.01) % 1) + 1) % 1) * W;
    const y = ((((p.y + p.vy * t) % 1) + 1) % 1) * H;
    const big = p.z > 0.9;
    const s = big ? 30 + (p.z - 0.9) * 500 : 2 + p.z * p.z * 9;
    c.globalAlpha = a * (big ? 0.28 : 0.25 + 0.6 * p.z) * (0.55 + 0.45 * Math.sin(t * p.tw + p.ph));
    c.drawImage(big ? disk : bokeh, x - s, y - s, s * 2, s * 2);
  }
  c.restore();
}
const STARS = Array.from({ length: 460 }, () => ({ x: R() * 2 - 1, y: R() * 2 - 1, z: R(), b: R() }));
function warp(c, d, a, streak) {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (const s of STARS) {
    const z = (((s.z - d) % 1) + 1) % 1;
    const dep = 0.04 + z, dep2 = dep + streak;
    const k = 0.18 / dep, k2 = 0.18 / dep2;
    const x = W / 2 + s.x * W * k, y = H / 2 + s.y * W * k;
    const x2 = W / 2 + s.x * W * k2, y2 = H / 2 + s.y * W * k2;
    const al = a * Math.pow(1 - z, 1.3) * (0.35 + 0.65 * s.b);
    if (al < 0.01) continue;
    c.strokeStyle = `rgba(244,224,192,${al})`;
    c.lineWidth = 0.4 + (1 - z) * 2.6;
    c.beginPath(); c.moveTo(x2, y2); c.lineTo(x, y); c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------ backgrounds
function darkBg(c) {
  const g = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.5, W * 0.72);
  g.addColorStop(0, '#26221F'); g.addColorStop(0.55, '#171513'); g.addColorStop(1, '#0A0908');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function paperBg(c) {
  const g = c.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, '#FAF8F4'); g.addColorStop(0.6, PAPER); g.addColorStop(1, '#E2DAD0');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function grid(c, a, col = '223,216,208', step = 120) {
  c.save(); c.strokeStyle = `rgba(${col},${a})`; c.lineWidth = 1;
  c.beginPath();
  for (let x = step / 2; x < W; x += step) { c.moveTo(x, 0); c.lineTo(x, H); }
  for (let y = 0; y < H; y += step) { c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke(); c.restore();
}
function push(c, z, cx = W / 2, cy = H / 2) { c.translate(cx, cy); c.scale(z, z); c.translate(-cx, -cy); }
function corners(c, x0, y0, x1, y1, len, col, lw = 1.5) {
  c.save(); c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
  c.moveTo(x0, y0 + len); c.lineTo(x0, y0); c.lineTo(x0 + len, y0);
  c.moveTo(x1 - len, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + len);
  c.moveTo(x1, y1 - len); c.lineTo(x1, y1); c.lineTo(x1 - len, y1);
  c.moveTo(x0 + len, y1); c.lineTo(x0, y1); c.lineTo(x0, y1 - len);
  c.stroke(); c.restore();
}

// ================================================================== scenes
// Each scene: f(c, u, D, t) with u = local time (may run slightly <0 or >D inside transitions).

// 01 — cold open: warp, light point -> anamorphic streak -> slit opens on the monogram -> wordmark
function sOpen(c, u, D, t) {
  darkBg(c);
  const v0 = 0.18, acc = 0.5, tHit = 1.6;
  const vHit = v0 + acc * tHit, vEnd = 0.05;
  const d = u < tHit ? v0 * u + 0.5 * acc * u * u
    : v0 * tHit + 0.5 * acc * tHit * tHit + vEnd * (u - tHit) + ((vHit - vEnd) * (1 - Math.exp(-(u - tHit) * 4))) / 4;
  const v = u < tHit ? v0 + acc * u : vEnd + (vHit - vEnd) * Math.exp(-(u - tHit) * 4);
  warp(c, d, clamp(u / 0.5) * (1 - 0.55 * prog(u, 1.6, 3.2)), v * 0.12);
  leaks(c, t, 0.9 * prog(u, 1.6, 3.2));

  const open = eOutExpo(prog(u, 1.6, 2.5));
  const toWord = prog(u, 3.0, 3.6);
  // rays behind the mark
  godRays(c, W / 2, H / 2 - 10, t, 0.75 * open * (1 - 0.45 * toWord), { n: 30, len: 1.4 });

  // monogram inside the opening slit
  if (u > 1.55 && toWord < 1) {
    const hh = open * 300;
    c.save();
    c.beginPath(); c.rect(0, H / 2 - hh, W, hh * 2); c.clip();
    const sc = lerp(1.12, 1, eOutCubic(prog(u, 1.6, 3.0))) * lerp(1, 0.86, eInOut(toWord));
    c.save();
    if (toWord > 0) c.filter = `blur(${toWord * 14}px)`;
    const box = drawMark(c, MARK.mono_cream, W / 2, H / 2, 330 * sc, 1 - toWord);
    c.restore();
    glint(c, MARK.mono_cream, box, prog(u, 2.1, 2.9), { width: 0.22 });
    c.restore();
    // slit edges
    const ea = 1 - prog(u, 2.0, 2.9);
    if (ea > 0) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const sgn of [-1, 1]) {
        const y = H / 2 + sgn * hh;
        const g = c.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(228,202,158,0)'); g.addColorStop(0.5, `rgba(255,244,226,${ea})`); g.addColorStop(1, 'rgba(228,202,158,0)');
        c.fillStyle = g; c.fillRect(0, y - 1.5, W, 3);
      }
      c.restore();
    }
  }
  // the light point that becomes a streak
  if (u < 1.6) {
    const e = eInExpo(prog(u, 0.2, 1.6));
    flare(c, W / 2, H / 2, 0.1 + e * 1.1, 0.25 + 0.75 * clamp(u / 0.4), { ghosts: u > 0.8 });
  } else {
    flare(c, W / 2, H / 2, 1.2, Math.exp(-(u - 1.6) * 2.2), { streak: 1.3 });
  }

  // wordmark scanned in from the centre
  if (toWord > 0) {
    const p = eInOut(prog(u, 3.05, 3.8));
    const img = MARK.word_cream;
    const h = 150, w = (h * img.width) / img.height;
    const half = (w / 2 + 40) * p;
    c.save();
    c.beginPath(); c.rect(W / 2 - half, H / 2 - 160, half * 2, 320); c.clip();
    if (p < 1) c.filter = `blur(${(1 - p) * 8}px)`;
    const box = drawMark(c, img, W / 2, H / 2 - 20, h * lerp(1.06, 1, p));
    c.restore();
    glint(c, img, box, prog(u, 3.9, 4.7), { width: 0.14 });
    if (p > 0 && p < 1) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const sgn of [-1, 1]) {
        const x = W / 2 + sgn * half;
        const g = c.createLinearGradient(0, H / 2 - 160, 0, H / 2 + 120);
        g.addColorStop(0, 'rgba(255,240,215,0)'); g.addColorStop(0.5, 'rgba(255,240,215,.95)'); g.addColorStop(1, 'rgba(255,240,215,0)');
        c.fillStyle = g; c.fillRect(x - 1.5, H / 2 - 160, 3, 280);
      }
      c.restore();
      flare(c, W / 2 - half, H / 2 - 20, 0.3, 0.6, { ghosts: false });
      flare(c, W / 2 + half, H / 2 - 20, 0.3, 0.6, { ghosts: false });
    }
    kicker(c, 'RESEARCH NOTE  ·  ROBOTICS AI', W / 2, H / 2 + 110, u - 3.6, { align: 'center', size: 17, tr: 8 });
  }
  dust(c, t, 0.6 * prog(u, 1.6, 2.6));
}

// 02 — title
function scope(c, u, a) {
  c.save();
  const y0 = H * 0.5;
  const f = (x, ph) => Math.sin(x * 0.006 + ph) * 46 + Math.sin(x * 0.017 + ph * 1.7) * 18 + Math.sin(x * 0.041 + ph * 0.6) * 6;
  c.lineWidth = 1.5;
  for (const [ph, col, al] of [[u * 2.2, '223,216,208', 0.13], [u * 2.2 - 1.1, '181,102,84', 0.32]]) {
    c.strokeStyle = `rgba(${col},${al * a})`;
    c.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = y0 + f(x, ph); x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }
  c.restore();
}
function sTitle(c, u, D, t) {
  darkBg(c);
  grid(c, 0.035);
  c.save();
  push(c, 1 + 0.045 * eInOut(prog(u, -0.5, D + 0.5)));
  leaks(c, t, 0.85);
  scope(c, u, clamp(u / 1.0));
  godRays(c, W / 2, H * 0.62, t, 0.14, { n: 22, len: 1.5, spin: 0.02 });

  kicker(c, 'PRISMAX EXPLORES', W / 2, 330, u - 0.15, { align: 'center', size: 20 });
  rich(c, [{ s: 'Latency ', f: F(168), color: CREAM }, { s: 'vs.', f: F(168, SERIF, 400, 'italic'), color: GOLD_L }],
    W / 2, 548, { align: 'center', fx: fxRise(u - 0.35, { st: 0.045 }) });
  const glow = 26 + 14 * Math.sin(u * 3);
  const l2 = rich(c, [{ s: 'π0.5', f: F(150, SERIF, 400, 'italic'), color: GOLD_L, glow, glowColor: 'rgba(240,200,140,.9)' }, { s: ' Rollout Performance', f: F(150), color: CREAM }],
    W / 2, 720, { align: 'center', fx: fxRise(u - 0.95, { st: 0.03 }) });
  c.font = F(150, SERIF, 400, 'italic');
  const piW = c.measureText('π0.5').width;
  if (u > 1.7) flare(c, l2.x0 + piW / 2, 672, 0.7, 0.9 * Math.exp(-(u - 1.7) * 2.5));

  const rw = 560 * eOutExpo(prog(u, 2.0, 2.9));
  c.fillStyle = 'rgba(223,216,208,.38)'; c.fillRect(W / 2 - rw / 2, 792, rw, 1.5);
  rich(c, [{ s: 'A critical challenge in robotics AI', f: F(34, SANS, 300), color: 'rgba(223,216,208,.78)', tr: 0.5 }],
    W / 2, 858, { align: 'center', fx: fxRise(u - 2.3, { st: 0.012, dist: 24, blur: 8 }) });
  c.restore();
  dust(c, t, 0.8);
}

// 03 — "Building powerful VLA models is only half the battle" (light)
function iconEye(c, x, y, s, u) {
  c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y - s * 0.95, x + s, y); c.quadraticCurveTo(x, y + s * 0.95, x - s, y); c.stroke();
  const lx = Math.sin(u * 1.7) * s * 0.18;
  c.beginPath(); c.arc(x + lx, y, s * 0.34, 0, TAU); c.stroke();
  c.beginPath(); c.arc(x + lx, y, s * 0.15, 0, TAU); c.fill();
}
function iconLang(c, x, y, s, u) {
  const L = [1.7, 1.2, 1.45];
  L.forEach((l, i) => {
    const ww = s * l * clamp((u - i * 0.25) / 0.5);
    c.beginPath(); c.moveTo(x - s * 0.85, y + (i - 1) * s * 0.5); c.lineTo(x - s * 0.85 + ww, y + (i - 1) * s * 0.5); c.stroke();
  });
  if (Math.floor(u * 2.5) % 2 === 0) c.fillRect(x - s * 0.85 + s * 1.2 + 8, y - s * 0.12, s * 0.16, s * 0.26);
}
function iconArm(c, x, y, s, u) {
  const a1 = -2.0 + Math.sin(u * 1.6) * 0.18, a2 = 0.95 + Math.sin(u * 1.6 + 1) * 0.25;
  const bx0 = x - s * 0.35, by0 = y + s * 0.75;
  const jx = bx0 + Math.cos(a1) * s * 0.9, jy = by0 + Math.sin(a1) * s * 0.9;
  const ex = jx + Math.cos(a1 + a2) * s * 0.85, ey = jy + Math.sin(a1 + a2) * s * 0.85;
  c.beginPath(); c.moveTo(x - s * 0.8, by0); c.lineTo(x + s * 0.1, by0); c.stroke();
  c.beginPath(); c.moveTo(bx0, by0); c.lineTo(jx, jy); c.lineTo(ex, ey); c.stroke();
  c.beginPath(); c.arc(jx, jy, s * 0.09, 0, TAU); c.fill();
  const ga = a1 + a2, open = 0.35 + 0.2 * Math.sin(u * 3);
  for (const sg of [-1, 1]) {
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + Math.cos(ga + sg * open) * s * 0.32, ey + Math.sin(ga + sg * open) * s * 0.32); c.stroke();
  }
}
function sVla(c, u, D, t) {
  paperBg(c);
  grid(c, 0.05, '32,32,32');
  c.save();
  push(c, 1 + 0.03 * eInOut(prog(u, -0.5, D)));
  kicker(c, 'VISION  ·  LANGUAGE  ·  ACTION', W / 2, 140, u - 0.15, { align: 'center', color: BRONZE, size: 17 });
  const NX = [600, 960, 1320], NY = 300, NR = 82;
  const labels = ['VISION', 'LANGUAGE', 'ACTION'];
  // connections + travelling light
  const lp = eInOut(prog(u, 0.9, 1.6));
  c.save();
  c.strokeStyle = 'rgba(32,32,32,.35)'; c.lineWidth = 1.5; c.setLineDash([3, 7]);
  for (let k = 0; k < 2; k++) {
    const xa = NX[k] + NR + 10, xb = NX[k + 1] - NR - 10;
    c.beginPath(); c.moveTo(xa, NY); c.lineTo(lerp(xa, xb, lp), NY); c.stroke();
  }
  c.restore();
  if (u > 1.6) {
    for (let j = 0; j < 3; j++) {
      const q = (((u - 1.6) * 0.45 + j / 3) % 1);
      const x = lerp(NX[0] + NR, NX[2] - NR, q);
      if (Math.abs(x - NX[1]) < NR) continue;
      c.save();
      const g = c.createLinearGradient(x - 120, 0, x, 0);
      g.addColorStop(0, 'rgba(181,102,84,0)'); g.addColorStop(1, 'rgba(181,102,84,.9)');
      c.fillStyle = g; c.fillRect(x - 120, NY - 1.5, 120, 3);
      c.shadowColor = 'rgba(181,102,84,.8)'; c.shadowBlur = 16; c.fillStyle = BRONZE;
      c.beginPath(); c.arc(x, NY, 5, 0, TAU); c.fill();
      c.restore();
    }
  }
  for (let k = 0; k < 3; k++) {
    const p = prog(u, 0.3 + k * 0.3, 0.85 + k * 0.3);
    if (p <= 0) continue;
    const s = eOutBack(p);
    c.save();
    c.translate(NX[k], NY); c.scale(s, s);
    c.globalAlpha = clamp(p * 3);
    c.shadowColor = 'rgba(32,32,32,.13)'; c.shadowBlur = 40; c.shadowOffsetY = 14;
    c.fillStyle = '#FCFBF8'; c.beginPath(); c.arc(0, 0, NR, 0, TAU); c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = 'rgba(32,32,32,.75)'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
    [iconEye, iconLang, iconArm][k](c, 0, 0, 34, u);
    c.restore();
    kicker(c, labels[k], NX[k], NY + NR + 44, u - 0.5 - k * 0.3, { align: 'center', color: INK, size: 15, tr: 6 });
  }

  rich(c, [{ s: 'Building powerful VLA models', f: F(116), color: INK }], W / 2, 590, { align: 'center', fx: fxRise(u - 1.3, { st: 0.022 }) });
  rich(c, [{ s: 'is only ', f: F(116), color: INK }, { s: 'half the battle.', f: F(116, SERIF, 400, 'italic'), color: BRONZE }],
    W / 2, 712, { align: 'center', fx: fxRise(u - 1.75, { st: 0.026 }) });

  // the 50% bar
  const X0 = 460, BW = 1000, BY = 840;
  const ap = prog(u, 2.6, 3.0);
  if (ap > 0) {
    c.save(); c.globalAlpha = ap;
    c.fillStyle = 'rgba(32,32,32,.14)'; c.fillRect(X0, BY - 0.75, BW, 1.5);
    const fp = eOutExpo(prog(u, 3.0, 4.2));
    const fx = X0 + BW * 0.5 * fp;
    c.fillStyle = INK; c.fillRect(X0, BY - 2, fx - X0, 4);
    // the other half: the deployment side
    if (u > 4.2) {
      const pulse = 0.45 + 0.35 * Math.sin((u - 4.2) * 5);
      c.strokeStyle = `rgba(181,102,84,${pulse})`; c.lineWidth = 2; c.setLineDash([8, 8]); c.lineDashOffset = -u * 30;
      c.beginPath(); c.moveTo(X0 + BW / 2 + 10, BY); c.lineTo(X0 + BW, BY); c.stroke(); c.setLineDash([]);
    }
    c.fillStyle = INK; c.beginPath(); c.arc(fx, BY, 7, 0, TAU); c.fill();
    if (u > 4.2) {
      const k = Math.exp(-(u - 4.2) * 3);
      c.strokeStyle = `rgba(181,102,84,${k})`; c.lineWidth = 2;
      c.beginPath(); c.arc(fx, BY, 7 + (1 - k) * 40, 0, TAU); c.stroke();
    }
    c.font = F(46); c.textAlign = 'center'; c.fillStyle = INK;
    c.fillText(`${Math.round(50 * fp)}%`, fx, BY - 26);
    c.font = F(14, MONO, 500); c.letterSpacing = '4px'; c.fillStyle = 'rgba(32,32,32,.6)';
    c.textAlign = 'left'; c.fillText('BUILD THE MODEL', X0, BY + 40);
    c.textAlign = 'right'; c.fillStyle = `rgba(181,102,84,${prog(u, 4.2, 4.6)})`; c.fillText('DEPLOY IT IN THE REAL WORLD', X0 + BW, BY + 40);
    c.letterSpacing = '0px';
    c.restore();
  }
  c.restore();
}

// 04 — the real challenge: deploying efficiently & reliably in the real world
function floor(c, u, a) {
  const vx = W / 2, HY = 770, FOC = 520;
  c.save();
  c.globalCompositeOperation = 'lighter';
  // horizon glow
  c.save(); c.translate(vx, HY); c.scale(1, 0.22);
  let g = c.createRadialGradient(0, 0, 0, 0, 0, 1000);
  g.addColorStop(0, `rgba(240,205,150,${0.55 * a})`); g.addColorStop(0.4, `rgba(185,152,106,${0.18 * a})`); g.addColorStop(1, 'rgba(185,152,106,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1000, 0, TAU); c.fill(); c.restore();
  c.fillStyle = `rgba(255,236,205,${0.5 * a})`; c.fillRect(0, HY - 0.75, W, 1.5);
  // depth lines
  g = c.createLinearGradient(0, HY, 0, H);
  g.addColorStop(0, 'rgba(185,152,106,0)'); g.addColorStop(1, `rgba(214,180,130,${0.55 * a})`);
  c.strokeStyle = g; c.lineWidth = 1.2;
  c.beginPath();
  for (let i = -22; i <= 22; i++) {
    const xw = i * 0.6;
    c.moveTo(vx + (xw / 40) * FOC, HY + FOC / 40);
    c.lineTo(vx + (xw / 0.5) * FOC, HY + FOC / 0.5);
  }
  c.stroke();
  // cross lines flowing toward camera
  for (let k = 0; k < 26; k++) {
    const z = 0.5 + ((((k * 1.2 - u * 3.2) % 31.2) + 31.2) % 31.2);
    const y = HY + FOC / z;
    if (y > H + 2) continue;
    c.strokeStyle = `rgba(214,180,130,${a * clamp(0.6 / z * 3, 0, 0.5)})`;
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }
  // scanning beam
  const zs = 30 - ((u * 9) % 30);
  const ys = HY + FOC / Math.max(zs, 0.5);
  if (ys < H) {
    g = c.createLinearGradient(0, ys - 30, 0, ys + 4);
    g.addColorStop(0, 'rgba(255,236,205,0)'); g.addColorStop(1, `rgba(255,236,205,${0.5 * a})`);
    c.fillStyle = g; c.fillRect(0, ys - 30, W, 34);
  }
  c.restore();
}
function sDeploy(c, u, D, t) {
  darkBg(c);
  c.save();
  push(c, 1 + 0.06 * eInOut(prog(u, -0.3, D + 0.5)), W / 2, 700);
  c.save(); c.beginPath(); c.rect(0, 0, W, 770); c.clip();
  godRays(c, W / 2, 770, t, 0.45, { n: 34, len: 1.8, spin: 0.015 });
  c.restore();
  floor(c, u, clamp((u + 0.4) / 1.0));
  leaks(c, t, 0.5);
  kicker(c, 'THE REAL CHALLENGE', W / 2, 175, u - 0.1, { align: 'center', size: 19 });
  const L = [
    [[{ s: 'Deploy efficiently.', f: F(118), color: CREAM }], 305],
    [[{ s: 'Perform reliably.', f: F(118), color: CREAM }], 435],
    [[{ s: 'In the ', f: F(118, SERIF, 400, 'italic'), color: GOLD_L }, { s: 'real world.', f: F(118, SERIF, 400, 'italic'), color: GOLD_L, glow: 24 }], 565],
  ];
  L.forEach(([segs, y], k) => wipeText(c, segs, W / 2, y, 118, eInOut(prog(u, 0.4 + k * 0.6, 1.2 + k * 0.6))));
  c.restore();
  dust(c, t, 0.9);
}

// 05 — why does latency matter?
function sLatency(c, u, D, t) {
  darkBg(c);
  grid(c, 0.03);
  leaks(c, t, 0.6);
  c.save();
  push(c, 1 + 0.03 * eInOut(prog(u, -0.5, D)));
  kicker(c, '01 — LATENCY', 140, 225, u - 0.1);
  rich(c, [{ s: 'Why does', f: F(118), color: CREAM }], 140, 360, { fx: fxRise(u - 0.25) });
  rich(c, [{ s: 'latency', f: F(118, SERIF, 400, 'italic'), color: GOLD_L, glow: 22 }, { s: ' matter?', f: F(118), color: CREAM }], 140, 485, { fx: fxRise(u - 0.55) });
  rich(c, [{ s: 'Between seeing and acting,', f: F(30, SANS, 300), color: 'rgba(223,216,208,.74)' }], 140, 575, { fx: fxRise(u - 1.1, { st: 0.008, dist: 20, blur: 6 }) });
  rich(c, [{ s: 'the world keeps moving.', f: F(30, SANS, 300), color: 'rgba(223,216,208,.74)' }], 140, 618, { fx: fxRise(u - 1.25, { st: 0.008, dist: 20, blur: 6 }) });

  // latency dial
  const CX = 1430, CY = 440, RR = 232;
  const [c0, c1, vmax] = TL.counter;
  const sc = TL.scenes.find((s) => s[0] === 'latency')[1];
  const val = vmax * eOutCubic(prog(u, c0 - sc, c1 - sc));
  const frac = val / 250;
  const app = prog(u, 0.5, 1.5);
  c.save(); c.lineCap = 'round';
  for (let i = 0; i < 120; i++) {
    const ta = prog(app, i / 160, i / 160 + 0.25);
    if (ta <= 0) continue;
    const ang = -Math.PI / 2 + (i / 120) * TAU + (1 - eOutCubic(app)) * 0.6;
    const major = i % 10 === 0, on = i / 120 < frac;
    const l = major ? 26 : 12;
    c.strokeStyle = on ? `rgba(244,214,165,${ta})` : `rgba(223,216,208,${0.22 * ta})`;
    c.lineWidth = major ? 2.4 : 1.4;
    if (on) { c.shadowColor = 'rgba(240,200,140,.8)'; c.shadowBlur = 10; } else c.shadowBlur = 0;
    c.beginPath();
    c.moveTo(CX + Math.cos(ang) * RR, CY + Math.sin(ang) * RR);
    c.lineTo(CX + Math.cos(ang) * (RR - l), CY + Math.sin(ang) * (RR - l)); c.stroke();
  }
  c.shadowBlur = 0;
  c.strokeStyle = `rgba(223,216,208,${0.12 * app})`; c.lineWidth = 1;
  c.beginPath(); c.arc(CX, CY, RR + 30, 0, TAU); c.stroke();
  if (frac > 0) {
    const a1 = -Math.PI / 2 + frac * TAU;
    c.strokeStyle = GOLD_L; c.lineWidth = 3; c.shadowColor = 'rgba(240,200,140,.9)'; c.shadowBlur = 18;
    c.beginPath(); c.arc(CX, CY, RR + 30, -Math.PI / 2, a1); c.stroke();
    c.shadowBlur = 0;
    flare(c, CX + Math.cos(a1) * (RR + 30), CY + Math.sin(a1) * (RR + 30), 0.32, 0.8 * (1 - prog(u, 4.0, 4.6) * 0.6), { ghosts: false });
  }
  c.restore();
  c.save(); c.globalAlpha = app;
  c.font = F(13, MONO, 500); c.letterSpacing = '5px'; c.textAlign = 'center'; c.fillStyle = 'rgba(223,216,208,.55)';
  c.fillText('Δt  END-TO-END', CX + 2, CY - 92);
  c.font = F(176); c.letterSpacing = '0px'; c.fillStyle = CREAM;
  c.fillText(String(Math.round(val)).padStart(3, '0'), CX, CY + 58);
  c.font = F(20, MONO, 500); c.letterSpacing = '8px'; c.fillStyle = GOLD_L; c.fillText('MS', CX + 4, CY + 108);
  c.font = F(11, MONO, 400); c.letterSpacing = '5px'; c.fillStyle = 'rgba(223,216,208,.35)'; c.fillText('ILLUSTRATIVE', CX + 2, CY + RR + 78);
  c.restore();

  // pipeline
  const PY = 860, X0 = 140, X1 = 1780;
  const NODES = [[260, 'OBSERVE'], [760, 'INFER  ·  π0.5'], [1260, 'ACT'], [1700, 'WORLD HAS MOVED']];
  const lpp = eInOut(prog(u, 0.8, 1.6));
  c.save();
  c.fillStyle = 'rgba(223,216,208,.18)'; c.fillRect(X0, PY - 0.75, (X1 - X0) * lpp, 1.5);
  const px = lerp(260, 1700, eInOut(prog(u, c0 - sc, c1 - sc)));
  const going = u > c0 - sc;
  NODES.forEach(([x, lab], k) => {
    const na = prog(u, 0.9 + k * 0.15, 1.3 + k * 0.15);
    if (na <= 0) return;
    const hit = going && px >= x - 1;
    c.globalAlpha = na;
    c.strokeStyle = hit ? GOLD_L : 'rgba(223,216,208,.55)'; c.lineWidth = 1.5;
    c.fillStyle = hit ? GOLD_L : '#171513';
    c.beginPath(); c.arc(x, PY, 8, 0, TAU); c.fill(); c.stroke();
    c.font = F(14, MONO, 500); c.letterSpacing = '4px'; c.textAlign = 'center';
    c.fillStyle = hit ? GOLD_L : 'rgba(223,216,208,.6)';
    c.fillText(lab, x, PY + 44);
    c.letterSpacing = '0px';
  });
  c.globalAlpha = 1;
  if (going && u < c1 - sc + 0.6) {
    const g = c.createLinearGradient(px - 300, 0, px, 0);
    g.addColorStop(0, 'rgba(228,202,158,0)'); g.addColorStop(1, 'rgba(255,236,205,.95)');
    c.fillStyle = g; c.fillRect(Math.max(260, px - 300), PY - 1.5, Math.min(300, px - 260), 3);
    flare(c, px, PY, 0.35, u < c1 - sc ? 0.9 : 0.9 * (1 - (u - (c1 - sc)) / 0.6), { ghosts: false });
  }
  // Δt bracket
  const bp = eOutExpo(prog(u, c1 - sc, c1 - sc + 0.6));
  if (bp > 0) {
    c.strokeStyle = `rgba(181,102,84,${bp})`; c.lineWidth = 1.5;
    const bx1 = lerp(260, 1260, bp);
    c.beginPath(); c.moveTo(260, PY - 30); c.lineTo(260, PY - 40); c.lineTo(bx1, PY - 40); c.lineTo(bx1, PY - 30); c.stroke();
    c.font = F(15, MONO, 500); c.letterSpacing = '4px'; c.fillStyle = `rgba(217,138,114,${bp})`; c.textAlign = 'center';
    c.fillText(`Δt = ${Math.round(val)} MS`, 760, PY - 56); c.letterSpacing = '0px';
  }
  c.restore();
  c.restore();
  dust(c, t, 0.7);
}

// 06 — how does it affect robot execution? two arms tracking the same path, 20 ms vs 250 ms
const SIM_HZ = 240, SIM_T = 6.5;
const LEM = (s) => { const th = Math.max(0, s) * 1.45; const d = 1 + Math.sin(th) ** 2; return [270 * Math.cos(th) / d, 300 * Math.sin(th) * Math.cos(th) / d]; };
function simulate(delay, hz, k, damp) {
  const n = SIM_HZ * SIM_T, P = new Float32Array(n * 2), E = new Float32Array(n);
  let [px, py] = LEM(0), vx = 0, vy = 0, acc = 0;
  const win = [];
  for (let i = 0; i < n; i++) {
    const s = i / SIM_HZ;
    const q = LEM(Math.floor((s - delay) * hz) / hz); // stale, sample-and-hold observation
    vx += (k * (q[0] - px) - damp * vx) / SIM_HZ; vy += (k * (q[1] - py) - damp * vy) / SIM_HZ;
    px += vx / SIM_HZ; py += vy / SIM_HZ;
    P[i * 2] = px; P[i * 2 + 1] = py;
    const tg = LEM(s), e2 = (tg[0] - px) ** 2 + (tg[1] - py) ** 2;
    win.push(e2); acc += e2; if (win.length > SIM_HZ / 2) acc -= win.shift();
    E[i] = Math.sqrt(acc / win.length);
  }
  return { P, E, n };
}
const ARMS = [
  { cx: 560, label: 'LOW LATENCY', dt: 'Δt ≈ 20 MS', trail: '228,202,158', sim: simulate(0.02, 50, 900, 55) },
  { cx: 1360, label: 'HIGH LATENCY', dt: 'Δt ≈ 250 MS', trail: '217,138,114', sim: simulate(0.25, 6, 70, 5) },
];
function ik(bx0, by0, ex, ey, L1, L2) {
  let dx = ex - bx0, dy = ey - by0, d = Math.hypot(dx, dy);
  const dm = Math.min(d, L1 + L2 - 1);
  const a = Math.atan2(dy, dx);
  const k = Math.acos(clamp((L1 * L1 + dm * dm - L2 * L2) / (2 * L1 * dm), -1, 1));
  return [bx0 + Math.cos(a - k) * L1, by0 + Math.sin(a - k) * L1, bx0 + Math.cos(a) * dm, by0 + Math.sin(a) * dm];
}
function sExec(c, u, D, t) {
  darkBg(c);
  grid(c, 0.025);
  leaks(c, t, 0.55);
  kicker(c, '02 — EXECUTION', W / 2, 108, u - 0.05, { align: 'center' });
  rich(c, [{ s: 'How does it affect ', f: F(88), color: CREAM }, { s: 'robot execution', f: F(88, SERIF, 400, 'italic'), color: GOLD_L, glow: 20 }, { s: '?', f: F(88), color: CREAM }],
    W / 2, 212, { align: 'center', fx: fxRise(u - 0.15, { st: 0.016 }) });
  const s = u - 0.9;
  for (const arm of ARMS) {
    const pa = eOutCubic(prog(u, 0.35 + (arm.cx > 1000 ? 0.15 : 0), 1.0 + (arm.cx > 1000 ? 0.15 : 0)));
    if (pa <= 0) continue;
    c.save();
    c.globalAlpha = pa; c.translate(0, (1 - pa) * 40);
    const cx = arm.cx, cy = 600;
    corners(c, cx - 360, 290, cx + 360, 970, 26, 'rgba(223,216,208,.38)');
    c.font = F(15, MONO, 500); c.letterSpacing = '5px';
    c.fillStyle = arm.cx > 1000 ? BRONZE_L : GOLD_L; c.textAlign = 'left'; c.fillText(arm.label, cx - 330, 330);
    c.fillStyle = 'rgba(223,216,208,.55)'; c.textAlign = 'right'; c.fillText(arm.dt, cx + 330, 330);
    c.letterSpacing = '0px';
    // target path
    c.strokeStyle = 'rgba(223,216,208,.22)'; c.lineWidth = 1.5; c.setLineDash([2, 8]);
    c.beginPath();
    for (let k = 0; k <= 200; k++) { const p = LEM((k / 200) * (TAU / 1.45)); k ? c.lineTo(cx + p[0], cy + p[1]) : c.moveTo(cx + p[0], cy + p[1]); }
    c.closePath(); c.stroke(); c.setLineDash([]);
    const { P, E, n } = arm.sim;
    const idx = clamp(Math.round(s * SIM_HZ), 0, n - 1);
    // trail
    const TR = Math.round(1.4 * SIM_HZ);
    c.lineCap = 'round'; c.lineWidth = 3;
    for (let k = Math.max(2, idx - TR); k <= idx; k += 2) {
      c.strokeStyle = `rgba(${arm.trail},${(1 - (idx - k) / TR) * 0.9})`;
      c.beginPath(); c.moveTo(cx + P[(k - 2) * 2], cy + P[(k - 2) * 2 + 1]); c.lineTo(cx + P[k * 2], cy + P[k * 2 + 1]); c.stroke();
    }
    const ex = cx + P[idx * 2], ey = cy + P[idx * 2 + 1];
    const tg = LEM(s), tgx = cx + tg[0], tgy = cy + tg[1];
    // error line
    c.strokeStyle = 'rgba(217,138,114,.75)'; c.lineWidth = 1.2; c.setLineDash([4, 5]);
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(tgx, tgy); c.stroke(); c.setLineDash([]);
    // target
    c.save(); c.shadowColor = 'rgba(240,200,140,.95)'; c.shadowBlur = 20;
    c.strokeStyle = GOLD_L; c.lineWidth = 2; c.beginPath(); c.arc(tgx, tgy, 11, 0, TAU); c.stroke();
    c.fillStyle = GOLD_L; c.beginPath(); c.arc(tgx, tgy, 3.5, 0, TAU); c.fill(); c.restore();
    // arm
    const bx0 = cx, by0 = 905;
    const [jx, jy, fx, fy] = ik(bx0, by0, ex, ey, 270, 250);
    c.fillStyle = '#2A2724'; c.strokeStyle = 'rgba(223,216,208,.6)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(bx0 - 60, 935); c.lineTo(bx0 + 60, 935); c.lineTo(bx0 + 34, by0 - 6); c.lineTo(bx0 - 34, by0 - 6); c.closePath(); c.fill(); c.stroke();
    c.lineCap = 'round';
    for (const [w, col] of [[22, '#3A3531'], [12, 'rgba(160,150,138,.9)'], [3, 'rgba(228,202,158,.55)']]) {
      c.strokeStyle = col; c.lineWidth = w;
      c.beginPath(); c.moveTo(bx0, by0); c.lineTo(jx, jy); c.lineTo(fx, fy); c.stroke();
    }
    const ga = Math.atan2(fy - jy, fx - jx);
    c.strokeStyle = 'rgba(160,150,138,.95)'; c.lineWidth = 6;
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + Math.cos(ga + sg * 0.5) * 30, fy + Math.sin(ga + sg * 0.5) * 30); c.stroke(); }
    for (const [x, y, r] of [[bx0, by0, 18], [jx, jy, 16], [fx, fy, 11]]) {
      c.fillStyle = '#1B1917'; c.strokeStyle = GOLD; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke();
    }
    // readout
    c.font = F(13, MONO, 500); c.letterSpacing = '5px'; c.textAlign = 'left'; c.fillStyle = 'rgba(223,216,208,.5)';
    c.fillText('TRACKING ERROR', cx - 330, 955);
    c.textAlign = 'right'; c.fillStyle = arm.cx > 1000 ? BRONZE_L : GOLD_L; c.font = F(15, MONO, 500);
    c.fillText(`${(E[idx] * 0.35).toFixed(1).padStart(5, ' ')} MM`, cx + 330, 955);
    c.letterSpacing = '0px';
    c.restore();
  }
  dust(c, t, 0.5);
}

// 07 — why is rollout performance essential? 40 rollouts flip to success / failure
const FLIP = (() => {
  const [, step, count] = TL.flips;
  const tiles = [];
  for (let r = 0; r < 5; r++) for (let col = 0; col < 8; col++) tiles.push({ r, col });
  const order = [...tiles].sort((a, b) => a.col + a.r - (b.col + b.r) || a.r - b.r);
  const rr = rng(21);
  order.forEach((tile, k) => { tile.tf = k * step; tile.ok = rr() < 0.68; });
  return { tiles, count };
})();
function sRollout(c, u, D, t) {
  darkBg(c);
  grid(c, 0.03);
  leaks(c, t, 0.6);
  c.save();
  push(c, 1 + 0.03 * eInOut(prog(u, -0.5, D)));
  kicker(c, '03 — ROLLOUTS', 140, 250, u - 0.1);
  rich(c, [{ s: 'Why is ', f: F(112), color: CREAM }, { s: 'rollout', f: F(112, SERIF, 400, 'italic'), color: GOLD_L, glow: 22 }], 140, 385, { fx: fxRise(u - 0.2) });
  rich(c, [{ s: 'performance', f: F(112), color: CREAM }], 140, 502, { fx: fxRise(u - 0.45) });
  rich(c, [{ s: 'essential?', f: F(112), color: CREAM }], 140, 619, { fx: fxRise(u - 0.7) });
  rich(c, [{ s: 'Real-world capability is measured', f: F(30, SANS, 300), color: 'rgba(223,216,208,.74)' }], 140, 712, { fx: fxRise(u - 1.2, { st: 0.007, dist: 20, blur: 6 }) });
  rich(c, [{ s: 'in rollouts, not offline scores.', f: F(30, SANS, 300), color: 'rgba(223,216,208,.74)' }], 140, 754, { fx: fxRise(u - 1.35, { st: 0.007, dist: 20, blur: 6 }) });

  const sc = TL.scenes.find((s) => s[0] === 'rollout')[1];
  const f0 = TL.flips[0] - sc;
  const TS = 78, GP = 14, GX = 1780 - (8 * TS + 7 * GP), GY = 262;
  let shown = 0, okc = 0;
  for (const tile of FLIP.tiles) {
    const x = GX + tile.col * (TS + GP), y = GY + tile.r * (TS + GP);
    const ta = prog(u, 0.3 + (tile.col + tile.r) * 0.03, 0.7 + (tile.col + tile.r) * 0.03);
    if (ta <= 0) continue;
    const fp = prog(u, f0 + tile.tf, f0 + tile.tf + 0.35);
    if (fp >= 0.5) { shown++; if (tile.ok) okc++; }
    c.save();
    c.globalAlpha = ta;
    c.translate(x + TS / 2, y + TS / 2);
    c.scale(1, Math.max(0.02, Math.abs(Math.cos(fp * Math.PI))));
    if (fp < 0.5) {
      c.strokeStyle = 'rgba(223,216,208,.22)'; c.lineWidth = 1.2; c.strokeRect(-TS / 2, -TS / 2, TS, TS);
      c.font = F(11, MONO, 400); c.fillStyle = 'rgba(223,216,208,.32)'; c.textAlign = 'left';
      c.fillText(String(tile.r * 8 + tile.col + 1).padStart(2, '0'), -TS / 2 + 8, -TS / 2 + 18);
    } else {
      const col = tile.ok ? '228,202,158' : '217,138,114';
      const glow = Math.exp(-(u - (f0 + tile.tf + 0.175)) * 3);
      c.fillStyle = `rgba(${col},${0.12 + 0.25 * glow})`; c.fillRect(-TS / 2, -TS / 2, TS, TS);
      c.strokeStyle = `rgba(${col},.85)`; c.lineWidth = 1.5; c.strokeRect(-TS / 2, -TS / 2, TS, TS);
      c.shadowColor = `rgba(${col},.9)`; c.shadowBlur = 8 + 20 * glow;
      c.strokeStyle = `rgb(${col})`; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      if (tile.ok) { c.moveTo(-14, 1); c.lineTo(-4, 11); c.lineTo(15, -11); } else { c.moveTo(-11, -11); c.lineTo(11, 11); c.moveTo(11, -11); c.lineTo(-11, 11); }
      c.stroke();
    }
    c.restore();
  }
  // scan beam across the grid while flipping
  const sp = prog(u, f0 - 0.1, f0 + FLIP.count * TL.flips[1] + 0.4);
  if (sp > 0 && sp < 1) {
    const bxp = lerp(GX - 60, 1780 + 60, sp);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(bxp - 80, 0, bxp + 10, 0);
    g.addColorStop(0, 'rgba(228,202,158,0)'); g.addColorStop(1, 'rgba(255,236,205,.35)');
    c.fillStyle = g; c.fillRect(bxp - 80, GY - 30, 90, 5 * TS + 4 * GP + 60);
    c.restore();
  }
  const ra = prog(u, 0.8, 1.3);
  c.save(); c.globalAlpha = ra;
  c.fillStyle = 'rgba(223,216,208,.2)'; c.fillRect(GX, 760, 1780 - GX, 1);
  c.font = F(13, MONO, 500); c.letterSpacing = '5px'; c.fillStyle = 'rgba(223,216,208,.55)'; c.textAlign = 'left';
  c.fillText('SUCCESS RATE  ·  40 ROLLOUTS', GX, 800);
  c.font = F(11, MONO, 400); c.fillStyle = 'rgba(223,216,208,.32)'; c.textAlign = 'right'; c.fillText('ILLUSTRATIVE', 1780, 900);
  c.font = F(15, MONO, 500); c.textAlign = 'right'; c.fillStyle = 'rgba(223,216,208,.7)';
  c.fillText(`${okc} / ${shown || 0}`, 1780, 800);
  c.letterSpacing = '0px';
  c.font = F(120); c.fillStyle = GOLD_L; c.textAlign = 'left';
  c.shadowColor = 'rgba(240,200,140,.6)'; c.shadowBlur = 24;
  c.fillText(`${shown ? Math.round((100 * okc) / shown) : 0}%`, GX - 6, 905);
  c.restore();
  c.restore();
  dust(c, t, 0.6);
}

// 08 — with models like π0.5, the gap between capability and deployment
function sGap(c, u, D, t) {
  darkBg(c);
  grid(c, 0.03);
  leaks(c, t, 0.7);
  c.save();
  push(c, 1 + 0.035 * eInOut(prog(u, -0.7, D)));
  kicker(c, 'WITH MODELS LIKE', 140, 240, u - 0.15);
  // π0.5, traced in light then filled
  const pf = F(330, SERIF, 400, 'italic');
  c.save();
  c.font = pf; c.lineWidth = 1.8; c.strokeStyle = GOLD_L; c.lineJoin = 'round';
  const dp = eInOut(prog(u, 0.25, 1.7));
  c.setLineDash([3200 * dp, 3200]);
  c.shadowColor = 'rgba(240,200,140,.9)'; c.shadowBlur = 16;
  if (dp > 0) c.strokeText('π0.5', 130, 545);
  c.setLineDash([]);
  const fa = prog(u, 1.3, 2.1);
  if (fa > 0) {
    const g = c.createLinearGradient(0, 300, 0, 560);
    g.addColorStop(0, '#F3DFBC'); g.addColorStop(0.55, GOLD_L); g.addColorStop(1, GOLD);
    c.globalAlpha = fa; c.fillStyle = g; c.shadowBlur = 40; c.fillText('π0.5', 130, 545);
  }
  c.restore();
  if (fa > 0) {
    // glint across the filled numerals
    reset(tx2); tx2.clearRect(0, 0, W, H); tx2.font = pf; tx2.fillStyle = '#fff'; tx2.fillText('π0.5', 130, 545);
    const pw = tx2.measureText('π0.5').width;
    const gp = prog(u, 1.9, 2.8);
    if (gp > 0 && gp < 1) {
      tx2.globalCompositeOperation = 'source-in';
      const gx = lerp(80, 130 + pw + 80, gp);
      const g = tx2.createLinearGradient(gx - 70, 0, gx + 70, 0);
      g.addColorStop(0, 'rgba(255,246,230,0)'); g.addColorStop(0.5, 'rgba(255,246,230,.95)'); g.addColorStop(1, 'rgba(255,246,230,0)');
      tx2.fillStyle = g; tx2.fillRect(0, 0, W, H);
      c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(tmp2, 0, 0); c.restore();
    }
  }
  if (u > 0.25 && u < 1.8) {
    // the tracing pen head
    flare(c, 130 + 520 * eInOut(prog(u, 0.25, 1.7)), 545 - 120 - 100 * Math.sin(u * 7), 0.3, 0.5, { ghosts: false });
  }
  const P = ['The gap between model capability', 'and deployment performance remains', 'a key engineering challenge.'];
  P.forEach((s, k) => rich(c, [{ s, f: F(31, SANS, 300), color: 'rgba(223,216,208,.76)' }], 140, 660 + k * 46, { fx: fxRise(u - 1.6 - k * 0.15, { st: 0.006, dist: 20, blur: 6 }) }));

  // chart
  const CX0 = 960, CX1 = 1760, CY0 = 250, CY1 = 780;
  const ap = prog(u, 0.6, 1.2);
  c.save(); c.globalAlpha = ap;
  c.strokeStyle = 'rgba(223,216,208,.28)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(CX0, CY0); c.lineTo(CX0, CY1); c.lineTo(CX1, CY1); c.stroke();
  c.font = F(12, MONO, 500); c.letterSpacing = '5px'; c.fillStyle = 'rgba(223,216,208,.5)';
  c.textAlign = 'left'; c.fillText('PERFORMANCE', CX0 + 14, CY0 + 4);
  c.textAlign = 'right'; c.fillText('MODEL PROGRESS  →', CX1, CY1 + 36);
  c.letterSpacing = '0px';
  c.restore();
  const cap = (x) => 0.14 + 0.78 * (1 - Math.exp(-3.1 * x));
  const dep = (x) => 0.08 + 0.4 * (1 - Math.exp(-2.0 * x));
  const X = (x) => lerp(CX0 + 10, CX1, x), Y = (v) => CY1 - v * 500;
  const q = eInOut(prog(u, 0.9, 2.7));
  if (q > 0) {
    const N = 80;
    // the gap, hatched
    const ga = prog(u, 2.0, 2.8);
    if (ga > 0) {
      c.save();
      c.beginPath();
      for (let k = 0; k <= N; k++) { const x = (k / N) * q; k ? c.lineTo(X(x), Y(cap(x))) : c.moveTo(X(x), Y(cap(x))); }
      for (let k = N; k >= 0; k--) { const x = (k / N) * q; c.lineTo(X(x), Y(dep(x))); }
      c.closePath(); c.clip();
      c.fillStyle = `rgba(181,102,84,${0.16 * ga})`; c.fillRect(CX0, CY0, CX1 - CX0, CY1 - CY0);
      c.strokeStyle = `rgba(217,138,114,${0.45 * ga})`; c.lineWidth = 1.2;
      c.beginPath();
      const off = (u * 24) % 18;
      for (let x = CX0 - 600 + off; x < CX1; x += 18) { c.moveTo(x, CY1); c.lineTo(x + 530, CY0); }
      c.stroke();
      c.restore();
    }
    for (const [fn, col, w, glow] of [[dep, 'rgba(223,216,208,.85)', 2.5, 0], [cap, GOLD_L, 3.5, 20]]) {
      c.save();
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
      if (glow) { c.shadowColor = 'rgba(240,200,140,.9)'; c.shadowBlur = glow; }
      c.beginPath();
      for (let k = 0; k <= N; k++) { const x = (k / N) * q; k ? c.lineTo(X(x), Y(fn(x))) : c.moveTo(X(x), Y(fn(x))); }
      c.stroke();
      c.restore();
      flare(c, X(q), Y(fn(q)), 0.25, fn === cap ? 0.85 : 0.45, { ghosts: false, streak: 0.5 });
    }
    const la = prog(u, 2.5, 3.0);
    c.save(); c.globalAlpha = la;
    c.font = F(13, MONO, 500); c.letterSpacing = '5px'; c.textAlign = 'right';
    c.fillStyle = GOLD_L; c.fillText('MODEL CAPABILITY', CX1, Y(cap(1)) - 26);
    c.fillStyle = 'rgba(223,216,208,.8)'; c.fillText('DEPLOYMENT PERFORMANCE', CX1, Y(dep(1)) + 40);
    // the gap marker
    const gx = X(0.62), gy0 = Y(cap(0.62)) + 8, gy1 = Y(dep(0.62)) - 8;
    const gp = eOutExpo(prog(u, 2.7, 3.4));
    const mid = (gy0 + gy1) / 2;
    c.strokeStyle = BRONZE_L; c.lineWidth = 2;
    c.beginPath(); c.moveTo(gx, lerp(mid, gy0, gp)); c.lineTo(gx, lerp(mid, gy1, gp)); c.stroke();
    if (gp > 0.6) {
      c.beginPath(); c.moveTo(gx - 7, gy0 + 10); c.lineTo(gx, gy0); c.lineTo(gx + 7, gy0 + 10);
      c.moveTo(gx - 7, gy1 - 10); c.lineTo(gx, gy1); c.lineTo(gx + 7, gy1 - 10); c.stroke();
    }
    c.textAlign = 'left'; c.fillStyle = BRONZE_L; c.font = F(16, MONO, 500); c.letterSpacing = '6px';
    c.fillText('THE GAP', gx + 22, mid + 6);
    c.letterSpacing = '0px';
    c.restore();
  }
  c.restore();
  dust(c, t, 0.7);
}

// 09 — the takeaway: three hits
function sTakeaway(c, u, D, t) {
  darkBg(c);
  leaks(c, t, 1.0);
  const sc = TL.scenes.find((s) => s[0] === 'takeaway')[1];
  const HITS = TL.impacts.filter(([h]) => h > sc + 1 && h < sc + D).map(([h]) => h - sc);
  godRays(c, W / 2, H / 2, t, 0.1 + 0.14 * prog(u, HITS[0], HITS[2]), { n: 36, len: 1.6 });
  c.save();
  push(c, 1 + 0.05 * eInOut(prog(u, -0.5, D + 0.5)));
  const ex = prog(u, HITS[0] - 0.45, HITS[0] - 0.05);
  if (ex < 1) {
    c.save();
    c.globalAlpha = 1 - ex;
    push(c, 1 - 0.08 * eInOut(ex));
    if (ex > 0) c.filter = `blur(${ex * 12}px)`;
    kicker(c, 'THE TAKEAWAY', W / 2, 360, u - 0.15, { align: 'center' });
    rich(c, [{ s: 'Robotics AI isn’t just about', f: F(104), color: CREAM }], W / 2, 520, { align: 'center', fx: fxRise(u - 0.35, { st: 0.02 }) });
    rich(c, [{ s: 'building ', f: F(104), color: CREAM }, { s: 'smarter models.', f: F(104, SERIF, 400, 'italic'), color: GOLD_L, glow: 22 }],
      W / 2, 645, { align: 'center', fx: fxRise(u - 0.75, { st: 0.022 }) });
    c.restore();
  }
  const LINES = [
    [[{ s: 'Faster.', f: F(150), color: CREAM }], 395],
    [[{ s: 'More reliable.', f: F(150), color: CREAM }], 565],
    [[{ s: 'Effective in the real world.', f: F(132, SERIF, 400, 'italic'), color: GOLD_L, glow: 30 }], 735],
  ];
  LINES.forEach(([segs, y], k) => {
    const q = u - HITS[k];
    if (q < 0) return;
    const e = eOutExpo(clamp(q / 0.55));
    c.save();
    c.globalAlpha = clamp(q / 0.06);
    c.translate(W / 2, y - 50); c.scale(1 + (1 - e) * 0.55, 1 + (1 - e) * 0.55); c.translate(-W / 2, -(y - 50));
    if (e < 1) c.filter = `blur(${(1 - e) * 22}px)`;
    rich(c, segs, W / 2, y, { align: 'center' });
    c.restore();
    flare(c, W / 2, y - 50, 0.9, 0.95 * Math.exp(-q * 4.5), { streak: 1.2 });
  });
  c.restore();
  dust(c, t, 1.0);
}

// 10 — outro lockup on cream
function sOutro(c, u, D, t) {
  paperBg(c);
  c.save();
  push(c, 1 + 0.03 * eInOut(prog(u, -0.6, D)));
  const g = c.createRadialGradient(W / 2, 470, 0, W / 2, 470, 700);
  g.addColorStop(0, 'rgba(185,152,106,.16)'); g.addColorStop(1, 'rgba(185,152,106,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const p = eOutExpo(prog(u, 0.25, 1.4));
  const img = MARK.word_ink;
  const h = 175;
  c.save();
  c.beginPath(); c.rect(0, 470 - h / 2 - 40, W, (h + 80) * p); c.clip();
  if (p < 1) c.filter = `blur(${(1 - p) * 6}px)`;
  const box = drawMark(c, img, W / 2, 470 + (1 - p) * 30, h, clamp(p * 1.5));
  c.restore();
  glint(c, img, box, prog(u, 1.3, 2.2), { col: '185,152,106', mode: 'source-over', width: 0.12 });
  const rw = 380 * eOutExpo(prog(u, 1.2, 2.0));
  c.fillStyle = 'rgba(32,32,32,.28)'; c.fillRect(W / 2 - rw / 2, 615, rw, 1.2);
  kicker(c, 'LATENCY VS. π0.5 ROLLOUT PERFORMANCE', W / 2, 668, u - 1.4, { align: 'center', color: 'rgba(32,32,32,.68)', size: 16, tr: 6, cps: 40 });
  rich(c, [{ s: 'prismax.ai', f: F(30, SANS, 400), color: INK, tr: 0.5 }], W / 2, 760, { align: 'center', fx: fxRise(u - 2.1, { st: 0.03, dist: 16, blur: 6 }) });
  c.restore();
}

// ================================================================== composition
const FNS = { open: sOpen, title: sTitle, vla: sVla, deploy: sDeploy, latency: sLatency, exec: sExec, rollout: sRollout, gap: sGap, takeaway: sTakeaway, outro: sOutro };
const SCN = Object.fromEntries(TL.scenes.map(([id, a, b, light], i) => [id, { id, a, b, light: !!light, i, f: FNS[id] }]));
const ORDER = TL.scenes.map((s) => s[0]);
function drawScene(id, t, c) {
  const s = SCN[id];
  reset(c);
  s.f(c, t - s.a, s.b - s.a, t);
  reset(c);
}

// transitions: (c, A, B, p) with the cut at p = pre / (pre + post)
function trZoom(c, A, B, p, cut) {
  if (p < cut) {
    const e = eInExpo(p / cut);
    c.save(); push(c, 1 + e * 0.6); if (e > 0.02) c.filter = `blur(${e * 20}px)`; c.drawImage(A, 0, 0); c.restore();
  } else {
    const e = eOutExpo((p - cut) / (1 - cut));
    c.save(); push(c, 1.3 - 0.3 * e); if (e < 0.98) c.filter = `blur(${(1 - e) * 18}px)`; c.drawImage(B, 0, 0); c.restore();
  }
  const f = Math.exp(-Math.pow((p - cut) / 0.09, 2));
  c.save(); c.fillStyle = `rgba(255,246,232,${0.9 * f})`; c.fillRect(0, 0, W, H); c.restore();
  flare(c, W / 2, H / 2, 1.4, f, { streak: 1.4 });
}
function trSweep(c, A, B, p) {
  const e = eInOut(p);
  const bxp = lerp(-0.45 * W, 1.45 * W, e), k = 0.45;
  c.drawImage(B, 0, 0);
  c.save();
  c.beginPath(); c.moveTo(bxp + H * k, 0); c.lineTo(W * 2, 0); c.lineTo(W * 2, H); c.lineTo(bxp - H * k, H); c.closePath(); c.clip();
  c.drawImage(A, 0, 0);
  c.restore();
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [wd, al] of [[260, 0.35], [70, 0.9]]) {
    const g = c.createLinearGradient(bxp - wd, 0, bxp + wd, 0);
    g.addColorStop(0, 'rgba(228,202,158,0)'); g.addColorStop(0.5, `rgba(255,244,226,${al})`); g.addColorStop(1, 'rgba(228,202,158,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(bxp + H * k - wd, 0); c.lineTo(bxp + H * k + wd, 0); c.lineTo(bxp - H * k + wd, H); c.lineTo(bxp - H * k - wd, H); c.closePath(); c.fill();
  }
  c.restore();
  flare(c, bxp, H / 2, 0.8, 0.8 * Math.sin(p * Math.PI));
}
function trSplit(c, A, B, p) {
  const ys = 840;
  const e = eInOut(prog(p, 0.3, 1));
  c.save(); push(c, 1.1 - 0.1 * eOutCubic(prog(p, 0.3, 1))); c.drawImage(B, 0, 0); c.restore();
  c.save(); c.beginPath(); c.rect(0, 0, W, ys); c.clip(); c.drawImage(A, 0, -e * (ys + 40)); c.restore();
  c.save(); c.beginPath(); c.rect(0, ys + e * (H - ys + 40), W, H); c.clip(); c.drawImage(A, 0, e * (H - ys + 40)); c.restore();
  const la = Math.sin(clamp(p / 0.3) * Math.PI / 2) * (1 - e);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const y of [ys - e * (ys + 40), ys + e * (H - ys + 40)]) {
    const g = c.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(217,138,114,0)'); g.addColorStop(0.5, `rgba(255,236,215,${0.9 * Math.max(la, 0.4 * (1 - e))})`); g.addColorStop(1, 'rgba(217,138,114,0)');
    c.fillStyle = g; c.fillRect(0, y - 2, W, 4);
  }
  c.restore();
  flare(c, W / 2, ys, 1.0, la);
}
function chroma(c, X, off) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  for (const [col, dx] of [['#f00', -off], ['#0f0', 0], ['#00f', off]]) {
    reset(tx); tx.drawImage(X, 0, 0); tx.globalCompositeOperation = 'multiply'; tx.fillStyle = col; tx.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(tmp, dx, 0); c.restore();
  }
}
function trGlitch(c, A, B, p, cut, t) {
  const X = p < cut ? A : B;
  const k = 1 - Math.abs(p - cut) / Math.max(cut, 1 - cut);
  chroma(c, X, 4 + k * 26);
  const r = rng(Math.floor(t * 30) + 5);
  for (let i = 0; i < 9; i++) {
    const y = r() * H, h = 8 + r() * 70 * k, dx = (r() - 0.5) * 260 * k;
    c.drawImage(r() < 0.5 ? A : B, 0, y, W, h, dx, y, W, h);
  }
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(228,202,158,${0.12 * k})`; c.fillRect(0, 0, W, H); c.restore();
}
function trIris(c, A, B, p) {
  const e = eInOut(p);
  const r = e * Math.hypot(W, H) * 0.56;
  c.drawImage(A, 0, 0);
  c.save(); c.beginPath(); c.arc(W / 2, H / 2, r, 0, TAU); c.clip(); c.drawImage(B, 0, 0); c.restore();
  c.save(); c.globalCompositeOperation = 'lighter';
  c.strokeStyle = `rgba(255,236,205,${0.9 * (1 - e * 0.6)})`; c.lineWidth = 3; c.shadowColor = 'rgba(240,200,140,1)'; c.shadowBlur = 30;
  c.beginPath(); c.arc(W / 2, H / 2, r, 0, TAU); c.stroke();
  c.restore();
  flare(c, W / 2, H / 2, 1.0, Math.exp(-p * 6));
}
function trWhite(c, A, B, p, cut) {
  if (p < cut) {
    const q = p / cut;
    c.save(); push(c, 1 + 0.08 * eInExpo(q)); c.drawImage(A, 0, 0); c.restore();
    c.fillStyle = `rgba(252,249,244,${eInExpo(q)})`; c.fillRect(0, 0, W, H);
    flare(c, W / 2, H / 2, 1.3, eInExpo(q));
  } else {
    const q = (p - cut) / (1 - cut);
    c.drawImage(B, 0, 0);
    c.fillStyle = `rgba(252,249,244,${1 - eOutCubic(q)})`; c.fillRect(0, 0, W, H);
  }
}
const TFN = { zoom: trZoom, sweep: trSweep, split: trSplit, glitch: trGlitch, iris: trIris, white: trWhite };
const TRANS = TL.transitions.map(([at, pre, post, kind], i) => ({ at, pre, post, kind, from: ORDER[i], to: ORDER[i + 1] }));

function shake(t) {
  let m = 0;
  for (const [h, a] of TL.impacts) if (t >= h) m += a * 16 * Math.exp(-(t - h) * 6);
  const n1 = Math.sin(t * 61.3) * 0.6 + Math.sin(t * 97.1 + 1.3) * 0.4;
  const n2 = Math.sin(t * 53.7 + 2.1) * 0.6 + Math.sin(t * 89.9 + 0.4) * 0.4;
  return [n1 * m, n2 * m, m];
}

function post(t, light, bloomAmt) {
  // bloom: threshold the bright parts at quarter resolution, blur, add back
  if (bloomAmt > 0) {
    reset(s1); s1.clearRect(0, 0, W / 4, H / 4);
    s1.filter = 'contrast(3)'; s1.drawImage(out, 0, 0, W / 4, H / 4);
    for (const [b, a] of [[4, 0.55], [14, 0.6]]) {
      reset(s2); s2.clearRect(0, 0, W / 4, H / 4); s2.filter = `blur(${b}px)`; s2.drawImage(sm1, 0, 0);
      ox.save(); ox.globalCompositeOperation = 'lighter'; ox.globalAlpha = a * bloomAmt; ox.drawImage(sm2, 0, 0, W, H); ox.restore();
    }
  }
  // vignette
  const v = ox.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${light ? 0.22 : 0.6})`);
  ox.fillStyle = v; ox.fillRect(0, 0, W, H);
  // grain (24 fps, like film)
  const gi = Math.floor(t * 24);
  ox.save();
  ox.globalCompositeOperation = 'overlay'; ox.globalAlpha = light ? 0.07 : 0.11;
  ox.translate(Math.floor(hash(gi) * 256), Math.floor(hash(gi + 9) * 256));
  ox.fillStyle = GRAIN[gi % GRAIN.length]; ox.fillRect(-256, -256, W + 512, H + 512);
  ox.restore();
}
function hud(t, light, a) {
  if (a <= 0) return;
  const col = light ? '32,32,32' : '223,216,208';
  ox.save();
  ox.globalAlpha = a;
  corners(ox, 44, 44, W - 44, H - 44, 30, `rgba(${col},.45)`, 1.5);
  ox.font = F(13, MONO, 500); ox.letterSpacing = '4px'; ox.fillStyle = `rgba(${col},.5)`;
  const sIdx = TL.scenes.findIndex(([, a0, b0]) => t >= a0 && t < b0);
  const names = ['OPEN', 'TITLE', 'VLA', 'DEPLOY', 'LATENCY', 'EXECUTION', 'ROLLOUTS', 'THE GAP', 'TAKEAWAY', 'PRISMAX'];
  ox.textAlign = 'left'; ox.fillText('PRISMAX  /  RESEARCH', 92, 68);
  ox.textAlign = 'right'; ox.fillText('LATENCY × π0.5 ROLLOUT', W - 92, 68);
  const fr = Math.floor((t % 1) * 24), ss = Math.floor(t) % 60, mm = Math.floor(t / 60);
  ox.textAlign = 'left';
  ox.fillText(`TC 00:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, 112, H - 58);
  if (Math.floor(t * 2) % 2 === 0) { ox.fillStyle = BRONZE; ox.beginPath(); ox.arc(96, H - 63, 5, 0, TAU); ox.fill(); }
  ox.fillStyle = `rgba(${col},.5)`; ox.textAlign = 'right';
  ox.fillText(`${String(sIdx + 1).padStart(2, '0')} / ${TL.scenes.length}  ${names[sIdx] || ''}`, W - 92, H - 58);
  // progress
  ox.fillStyle = `rgba(${col},.12)`; ox.fillRect(560, H - 63, W - 1120, 2);
  ox.fillStyle = light ? BRONZE : GOLD_L; ox.fillRect(560, H - 63, (W - 1120) * (t / TL.duration), 2);
  ox.restore();
}

function renderAt(t) {
  const tr = TRANS.find((x) => t >= x.at - x.pre && t < x.at + x.post);
  let light, bloom;
  reset(sx);
  if (tr) {
    const p = (t - (tr.at - tr.pre)) / (tr.pre + tr.post), cut = tr.pre / (tr.pre + tr.post);
    drawScene(tr.from, t, ax);
    drawScene(tr.to, t, bx);
    TFN[tr.kind](sx, bufA, bufB, p, cut, t);
    const lf = SCN[tr.from].light, lt = SCN[tr.to].light;
    light = p < cut ? lf : lt;
    bloom = lerp(lf ? 0 : 1, lt ? 0 : 1, eInOut(p));
  } else {
    const id = ORDER.find((k) => t >= SCN[k].a && t < SCN[k].b) || ORDER[ORDER.length - 1];
    drawScene(id, t, sx);
    light = SCN[id].light;
    bloom = light ? 0 : 1;
  }
  reset(sx);
  // camera: shake on impacts, slight overscan so edges never show
  reset(ox);
  ox.fillStyle = '#000'; ox.fillRect(0, 0, W, H);
  const [dx, dy, m] = shake(t);
  const z = 1.015 + m * 0.0012;
  ox.translate(W / 2 + dx, H / 2 + dy); ox.scale(z, z); ox.drawImage(scn, -W / 2, -H / 2);
  reset(ox);
  post(t, light, bloom * 0.8);
  // letterbox on the cold open
  const lb = 138 * (1 - eInOut(prog(t, 4.3, 5.3)));
  if (lb > 0.5) { ox.fillStyle = '#000'; ox.fillRect(0, 0, W, lb); ox.fillRect(0, H - lb, W, lb); }
  hud(t, light, 0.85 * prog(t, 5.2, 6.0) * (1 - prog(t, 50.6, 51.0)));
  // fade in / out
  const f = Math.max(1 - prog(t, 0, 0.25), prog(t, TL.duration - 0.9, TL.duration - 0.05));
  if (f > 0) { ox.fillStyle = `rgba(0,0,0,${f})`; ox.fillRect(0, 0, W, H); }
}

await loadFonts();
await buildLogos();
window.DURATION = TL.duration;
window.renderAt = renderAt;
renderAt(0);
window.__ready = true;
