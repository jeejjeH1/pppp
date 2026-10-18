// v3 "Adjudication" — cinematic narrated cut in the genlayer.com theme.
// Timing comes from out/v3/timeline.json (written by tts.py), so visuals follow the voice.
import { GL } from './gl.js';
import { el, css, hash, clamp, prog, E, noise1, loadImage, makeHalftone } from './lib.js';
import { buildScenes } from './scenes.js';

const root = document.getElementById('root');
const bg = document.getElementById('bg');
const scenesEl = document.getElementById('scenes');
const flash = document.getElementById('flash');
const grain = document.getElementById('grain');
const vig = document.getElementById('vig');
const bars = document.querySelectorAll('#bars i');
const subs = document.getElementById('subs');
const flareCv = document.getElementById('flare');
const flareG = flareCv.getContext('2d');
root.insertBefore(GL.canvas, scenesEl);

const tl = await (await fetch('/out/v3/timeline.json')).json();
const LINES = Object.fromEntries(tl.lines.map((l) => [l.id, l]));
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9-']/g, '');
const ctx = {
  L: LINES,
  s: (id) => LINES[id].start,
  e: (id) => LINES[id].end,
  /** onset of the n-th word in line `id` that starts with `needle` */
  wt(id, needle, n = 0) {
    const ws = LINES[id].words.filter(([w]) => norm(w).startsWith(needle.toLowerCase()));
    if (!ws[n]) throw new Error(`word ${needle} not in ${id}`);
    return ws[n][1];
  },
  words: (id) => LINES[id].words.map((w) => w[1]),
  sfxList: [],
  sfx(t, type, gain = 1) {
    this.sfxList.push({ t: +t.toFixed(3), type, gain });
  },
  flares: [],
  flare(x, y, k, color = '90,80,255') {
    this.flares.push([x, y, k, color]);
  },
  shake: 0,
  gl: GL,
  img: {},
};

await Promise.all(['500 40px "Inter Tight"', '600 40px "Inter Tight"', '700 40px "Inter Tight"', '400 40px "Geist Mono"', '500 40px "Geist Mono"'].map((f) => document.fonts.load(f)));
GL.refreshText();
for (const n of ['hammer', 'thinker', 'arm']) ctx.img[n] = makeHalftone(await loadImage(`/assets/statues/${n}.png`));

const DURATION = tl.duration;
const scenes = buildScenes(ctx, DURATION);
for (const sc of scenes) {
  sc.root = el('div', `scene ${sc.dark ? 'dark' : 'light'}`, scenesEl);
  sc.build(sc.root, ctx);
  ctx.sfx(sc.a, sc.inSfx || 'whoosh', sc.inGain ?? 1);
}

// ------------------------------------------------------------------ subtitles
const chunks = [];
for (const l of tl.lines) {
  const ws = l.words;
  let cur = [];
  const flush = () => cur.length && (chunks.push(cur), (cur = []));
  ws.forEach(([w, t], i) => {
    cur.push([w, t]);
    const len = cur.map((c) => c[0]).join(' ').length;
    const nextLen = i + 1 < ws.length ? len + ws[i + 1][0].length + 1 : 0;
    if (/[,.?!]$/.test(w) && len > 22) flush();
    else if (nextLen > 46) flush();
  });
  flush();
}
chunks.forEach((c, i) => {
  c.start = c[0][1] - 0.12;
  const line = tl.lines.find((l) => l.start <= c[0][1] + 1e-6 && l.end >= c[0][1] - 1e-6);
  const nxt = chunks[i + 1];
  c.end = nxt && nxt[0][1] < line.end + 0.05 ? nxt[0][1] - 0.12 : Math.min(line.end + 0.45, nxt ? nxt[0][1] - 0.15 : 1e9);
});
const subBox = el('div', 'box', subs);
let subKey = -1;
function updateSubs(t) {
  const i = chunks.findIndex((c) => t >= c.start && t < c.end);
  if (i < 0) {
    subs.style.opacity = 0;
    return;
  }
  const c = chunks[i];
  if (subKey !== i) {
    subBox.innerHTML = c.map(([w]) => `<span class="sw">${w}</span>`).join(' ');
    subKey = i;
  }
  const v = Math.min(prog(t, c.start, 0.12), 1 - prog(t, c.end - 0.1, 0.1));
  subs.style.opacity = v;
  [...subBox.children].forEach((s, k) => {
    const on = t >= c[k][1] - 0.04;
    const nxt = c[k + 1] ? c[k + 1][1] : c.end;
    s.className = `sw${on ? ' on' : ''}${on && t < nxt - 0.04 ? ' now' : ''}`;
  });
}

// ------------------------------------------------------------------ grain
const grainTiles = [];
for (let k = 0; k < 6; k++) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const id = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = Math.floor(hash(i * 1.37 + k * 911.1) * 255);
    id.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(id, 0, 0);
  grainTiles.push(c.toDataURL());
}

function drawFlares(t) {
  flareG.clearRect(0, 0, 1920, 1080);
  for (const [x, y, k, col] of ctx.flares) {
    if (k <= 0.01) continue;
    // anamorphic streak
    const gr = flareG.createLinearGradient(x - 1100 * k, 0, x + 1100 * k, 0);
    gr.addColorStop(0, `rgba(${col},0)`);
    gr.addColorStop(0.5, `rgba(${col},${0.55 * k})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    flareG.fillStyle = gr;
    flareG.fillRect(x - 1100 * k, y - 3 - 4 * k, 2200 * k, 6 + 8 * k);
    const rg = flareG.createRadialGradient(x, y, 0, x, y, 260 * k);
    rg.addColorStop(0, `rgba(255,255,255,${0.75 * k})`);
    rg.addColorStop(0.2, `rgba(${col},${0.45 * k})`);
    rg.addColorStop(1, `rgba(${col},0)`);
    flareG.fillStyle = rg;
    flareG.fillRect(x - 260 * k, y - 260 * k, 520 * k, 520 * k);
  }
}

// ------------------------------------------------------------------ main loop
let active = null;
window.DURATION = DURATION;
window.renderAt = (t) => {
  ctx.flares = [];
  ctx.shake = 0;
  ctx.flashColor = null;
  ctx.flashK = 0;
  ctx.bars = 0;
  GL.reset();
  const sc = scenes.find((s) => t >= s.a && t < s.b) || scenes[scenes.length - 1];
  if (active !== sc) {
    if (active) active.root.style.display = 'none';
    sc.root.style.display = 'block';
    active = sc;
  }
  const lt = t - sc.a;
  const dur = sc.b - sc.a;
  bg.style.background = sc.dark ? '#000' : '#fff';
  sc.update(t, lt, ctx, dur);

  // entrance / exit camera move shared by all scenes
  const inP = E.out5(prog(lt, 0, sc.inDur ?? 0.55));
  const outP = sc.noOut ? 0 : E.in3(prog(lt, dur - 0.22, 0.22));
  const sh = ctx.shake;
  const dx = noise1(t * 0.6, 1) * 4 + noise1(t * 9, 2) * sh * 14;
  const dy = noise1(t * 0.5, 3) * 3 + noise1(t * 9, 4) * sh * 10;
  const sIn = sc.inScale ?? 1.07;
  const scale = (1 + (sIn - 1) * (1 - inP)) * (1 + outP * 0.05);
  css(sc.root, {
    transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${noise1(t * 0.4, 5) * 0.08}deg)`,
    filter: inP < 0.999 || outP > 0.001 ? `blur(${(1 - inP) * 14 + outP * 12}px)` : 'none',
  });
  GL.canvas.style.transform = sc.root.style.transform;
  GL.canvas.style.filter = sc.root.style.filter;
  GL.draw();

  // cut flash
  const fk = Math.max(ctx.flashK, sc.inFlash ? 1 - E.out3(prog(lt, 0, sc.inFlash)) : 0);
  flash.style.opacity = fk;
  flash.style.background = ctx.flashColor || sc.flashColor || (sc.dark ? '#ffffff' : '#ffffff');
  grain.style.backgroundImage = `url(${grainTiles[Math.floor(t * 24) % 6]})`;
  grain.style.transform = `translate(${Math.floor(hash(Math.floor(t * 24)) * 64)}px, ${Math.floor(hash(Math.floor(t * 24) + 7) * 64)}px)`;
  grain.style.opacity = sc.dark ? 0.11 : 0.06;
  vig.style.opacity = sc.dark ? 1 : 0.18;
  const bh = ctx.bars * 140;
  bars.forEach((b) => (b.style.height = `${bh}px`));
  drawFlares(t);
  updateSubs(t);
};

// dump of SFX cues for the soundtrack
window.SFX = ctx.sfxList.sort((a, b) => a.t - b.t);
window.__ready = true;
