// Shared helpers: easing, deterministic noise, DOM text splitting and per-character reveals.
// Everything is a pure function of time so frames render deterministically.

export const W = 1920;
export const H = 1080;
export const COL = {
  blue: '#1a0dff',
  blueSoft: '#4d44ff',
  green: '#00f26b',
  red: '#ff3b30',
  ink: '#0a0a0a',
  paper: '#ffffff',
  panel: '#f4f4f4',
  gray: '#8d8d8d',
  line: '#d9d9d9',
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, d) => clamp((t - a) / d);
export const E = {
  lin: (x) => x,
  in2: (x) => x * x,
  in3: (x) => x * x * x,
  out2: (x) => 1 - (1 - x) * (1 - x),
  out3: (x) => 1 - Math.pow(1 - x, 3),
  out5: (x) => 1 - Math.pow(1 - x, 5),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOut3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inOut5: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outBack: (x) => {
    const c1 = 1.5;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
};
export const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export const noise1 = (x, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1;
};

export function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export function css(e, o) {
  for (const k in o) e.style[k] = o[k];
  return e;
}

export function canvas(parent, w = W, h = H, cls = 'cv') {
  const c = el('canvas', cls, parent);
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

/**
 * Split text into word/char spans. `*word*` marks highlight (class hl), `_word_` class hl2,
 * `|` forces a line break. Returns the char spans (in reading order) and word spans.
 */
export function split(parent, text) {
  const chars = [];
  const words = [];
  text.split('|').forEach((line, li) => {
    if (li) el('br', null, parent);
    line.split(' ').filter(Boolean).forEach((raw, wi, arr) => {
      let w = raw;
      let cls = 'wd';
      if (/^\*.*\*[.,?!:;—]*$/.test(w)) {
        cls += ' hl';
        w = w.replace(/\*/g, '');
      } else if (/^_.*_[.,?!:;—]*$/.test(w)) {
        cls += ' hl2';
        w = w.replace(/_/g, '');
      } else if (/^~.*~[.,?!:;—]*$/.test(w)) {
        cls += ' hl3';
        w = w.replace(/~/g, '');
      }
      const ws = el('span', cls, parent);
      for (const ch of w) chars.push(el('span', 'ch', ws, ch === ' ' ? '&nbsp;' : ch));
      words.push(ws);
      if (wi < arr.length - 1) el('span', 'sp', parent, ' ');
    });
  });
  return { chars, words };
}

/** Rise + unblur reveal per char. */
export function rise(spans, t, t0, { st = 0.022, d = 0.7, y = 0.55, blur = 12, rot = 0, ease = E.out5 } = {}) {
  spans.forEach((s, i) => {
    const p = ease(prog(t, t0 + i * st, d));
    s.style.opacity = p;
    s.style.transform = `translate3d(0, ${(1 - p) * y}em, 0) rotate(${(1 - p) * rot}deg)`;
    s.style.filter = p < 0.999 ? `blur(${(1 - p) * blur}px)` : 'none';
  });
}

/** Reveal per word (spans = word spans). */
export function riseWords(spans, t, t0, opts = {}) {
  rise(spans, t, t0, { st: 0.09, d: 0.8, ...opts });
}

/** Reveal each word exactly when the narrator says it (`times` = onset per word). */
export function riseAt(spans, t, times, { d = 0.55, y = 0.5, blur = 14 } = {}) {
  spans.forEach((s, i) => {
    const p = E.out5(prog(t, times[Math.min(i, times.length - 1)] - 0.06, d));
    s.style.opacity = p;
    s.style.transform = `translate3d(0, ${(1 - p) * y}em, 0) scale(${1 + (1 - p) * 0.08})`;
    s.style.filter = p < 0.999 ? `blur(${(1 - p) * blur}px)` : 'none';
  });
}

const GLYPHS = '01<>/[]{}#$%&*+=?ABCDEFGHJKMNPQRSTUVWXYZ';
/** Decode effect for mono labels: glyphs shuffle before settling. */
export function scramble(spans, t, t0, { st = 0.025, settle = 0.28, seed = 1 } = {}) {
  spans.forEach((s, i) => {
    if (s.dataset.c == null) s.dataset.c = s.textContent;
    const a = t0 + i * st;
    if (t < a) {
      s.style.opacity = 0;
      return;
    }
    s.style.opacity = 1;
    if (t < a + settle && s.dataset.c.trim()) {
      const g = GLYPHS[Math.floor(hash(i * 13.1 + Math.floor(t * 30) * 7.7 + seed) * GLYPHS.length)];
      s.textContent = g;
      s.classList.add('scr');
    } else {
      s.textContent = s.dataset.c;
      s.classList.remove('scr');
    }
  });
}

/** Fade/blur an element out over [t1, t1+d]. Returns 0..1 visibility. */
export function vis(t, a, b, fi = 0.4, fo = 0.4) {
  return Math.min(E.out3(prog(t, a, fi)), 1 - E.in3(prog(t, b - fo, fo)));
}

export function fadeEl(e, v, { y = 0, blur = 10, scale = 0 } = {}) {
  e.style.opacity = v;
  e.style.filter = v < 0.999 ? `blur(${(1 - v) * blur}px)` : 'none';
  if (y || scale) e.style.transform = `translate3d(0, ${(1 - v) * y}px, 0) scale(${1 + (1 - v) * scale})`;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Isometric-ish wireframe cube (site style) drawn with a simple 3D projection. */
export function cube(g, cx, cy, s, { yaw = 0.7853, pitch = 0.52, fill = null, stroke = '#111', lw = 1.6, top = null, side = null } = {}) {
  const v = [];
  for (let i = 0; i < 8; i++) {
    const x = (i & 1 ? 1 : -1) * 0.5;
    const y = (i & 2 ? 1 : -1) * 0.5;
    const z = (i & 4 ? 1 : -1) * 0.5;
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
    const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    v.push([cx + x1 * s, cy - y1 * s, z2]);
  }
  const faces = [
    [0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5],
  ];
  // painter's order: back faces first
  const fz = faces.map((f) => [f, f.reduce((a, k) => a + v[k][2], 0) / 4]).sort((a, b) => a[1] - b[1]);
  g.lineJoin = 'round';
  for (const [f, z] of fz) {
    // only draw the 3 nearest faces when filled
    if (fill && z < 0) continue;
    g.beginPath();
    f.forEach((k, j) => (j ? g.lineTo(v[k][0], v[k][1]) : g.moveTo(v[k][0], v[k][1])));
    g.closePath();
    if (fill) {
      const isTop = f.every((k) => k & 2);
      g.fillStyle = isTop && top ? top : side && !isTop ? side : fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = lw;
      g.stroke();
    }
  }
}

/** Halftone renderer: draws a luminance map (ImageData) as dots. */
export function makeHalftone(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const lum = new Float32Array(c.width * c.height);
  for (let i = 0; i < lum.length; i++) lum[i] = data[i * 4] / 255;
  return {
    w: c.width,
    h: c.height,
    sample(u, v) {
      if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
      return lum[Math.floor(v * c.height) * c.width + Math.floor(u * c.width)];
    },
  };
}

/**
 * Draw halftone: image placed at (x,y) with height h (aspect kept), dot cell size `cell`.
 * reveal(u,v) -> 0..1 multiplier for animated reveals, shimmer adds sparkle.
 */
export function drawHalftone(g, ht, { x, y, h, cell = 9, color = COL.blue, t = 0, reveal = null, gamma = 1.1, shimmer = 0.15, edge = 0.12 }) {
  const w = (h * ht.w) / ht.h;
  g.fillStyle = color;
  const r0 = cell * 0.62;
  const x0 = Math.max(0, x);
  const x1 = Math.min(W, x + w);
  const y0 = Math.max(0, y);
  const y1 = Math.min(H, y + h);
  g.beginPath();
  for (let py = y0 - ((y0 - y) % cell); py < y1; py += cell) {
    const v = (py - y) / h;
    for (let px = x0 - ((x0 - x) % cell); px < x1; px += cell) {
      const u = (px - x) / w;
      let l = Math.pow(ht.sample(u, v), gamma);
      // soft edge fade so crops never show a hard border
      const ef = Math.min(u, 1 - u, v, 1 - v) / edge;
      if (ef < 1) l *= Math.max(0, ef);
      if (reveal) l *= reveal(u, v);
      if (shimmer) l *= 1 - shimmer + shimmer * hash(px * 0.37 + py * 1.91 + Math.floor(t * 12) * 3.3);
      if (l < 0.04) continue;
      const r = r0 * Math.sqrt(l);
      g.moveTo(px + r, py);
      g.arc(px, py, r, 0, Math.PI * 2);
    }
  }
  g.fill();
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
