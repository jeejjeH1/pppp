// Every frame is a pure function of t: window.renderAt(t) sets all styles, so render.js can step it deterministically.
const timing = await (await fetch('/out/timing.json')).json();
const L = Object.fromEntries(timing.lines.map((l, i) => [l.id, { ...l, i }]));
window.DURATION = timing.duration;
// fonts must be in before any layout is measured (cursor targets, badges)
await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
await document.fonts.ready;

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const NS = 'http://www.w3.org/2000/svg';
const rand = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const typed = (s, p) => s.slice(0, Math.round(p * s.length));

// ---------- spark glyph (12 uneven rounded rays) ----------
{
  const g = $('spark');
  for (let i = 0; i < 12; i++) {
    const len = (i % 2 ? 34 : 44) + (rand() - 0.5) * 8;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', -3.6); r.setAttribute('y', -len); r.setAttribute('width', 7.2); r.setAttribute('height', len - 2); r.setAttribute('rx', 3.6);
    r.setAttribute('transform', `rotate(${i * 30 + (rand() - 0.5) * 7})`);
    g.appendChild(r);
  }
  const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 7); g.appendChild(c);
}

// ---------- film grain ----------
const grain = $('grain'), gctx = grain.getContext('2d');
const grainFrames = Array.from({ length: 6 }, () => {
  const im = gctx.createImageData(540, 960);
  for (let i = 0; i < im.data.length; i += 4) { const v = rand() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  return im;
});

// ---------- colorful background blobs ----------
const BLOBS = [['#E8623A', 760, 180, 300], ['#3D7BF2', 700, 880, 520], ['#F5B83D', 640, 120, 1250], ['#9466F0', 620, 820, 1500], ['#EE4F86', 520, 500, 820]]
  .map(([c, sz, x, y], i) => {
    const d = document.createElement('div');
    d.className = 'blob'; d.style.background = c; d.style.width = d.style.height = sz + 'px';
    $('glow').appendChild(d);
    return { d, sz, x, y, ph: i * 1.7 };
  });

// ---------- confetti (deterministic bursts) ----------
const conf = $('confetti').getContext('2d');
const CONF_COLORS = ['#E8623A', '#3D7BF2', '#F5B83D', '#9466F0', '#22A86B', '#EE4F86'];
const bursts = [];
const burst = (t0, x, y, n = 70, spread = 1) => bursts.push({ t0, x, y, parts: Array.from({ length: n }, () => {
  const a = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.3 * spread, v = 700 + rand() * 900;
  return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: CONF_COLORS[Math.floor(rand() * 6)], w: 10 + rand() * 12, h: 6 + rand() * 8, r: rand() * 6, vr: (rand() - 0.5) * 14 };
}) });
function drawConfetti(t) {
  conf.clearRect(0, 0, 1080, 1920);
  for (const b of bursts) {
    const dt = t - b.t0;
    if (dt < 0 || dt > 2.2) continue;
    for (const p of b.parts) {
      const drag = (1 - Math.exp(-dt * 2.2)) / 2.2;
      const x = b.x + p.vx * drag, y = b.y + p.vy * drag + 900 * dt * dt * 0.5;
      conf.save(); conf.globalAlpha = 1 - seg(dt, 1.5, 2.2);
      conf.translate(x, y); conf.rotate(p.r + p.vr * dt);
      conf.fillStyle = p.c; conf.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(dt * 8 + p.r)));
      conf.restore();
    }
  }
}

// ---------- captions ----------
const HL = ['خودش', 'متن‌باز', 'نتیجه', 'دکمه‌ها', 'فیلدها؛', 'لوکال', 'ذخیره', 'دوباره', 'رایگان', '«عامل»', 'مرورگر'];
const cap = $('cap');
let hlCount = 0;
const HL_COLORS = ['#E8623A', '#3D7BF2', '#9466F0', '#22A86B', '#EE4F86'];
const capLines = timing.lines.map((l) => {
  const div = document.createElement('div');
  div.className = 'line';
  // keep Latin phrases as one LTR token so the RTL line doesn't reverse them
  const words = l.cap.replace('Claude Code', 'Claude Code').split(' ').map((w) => {
    const s = document.createElement('span');
    const latin = /^[A-Za-z(]/.test(w);
    s.className = 'wd' + (HL.includes(w) || latin ? ' hl' : '');
    if (HL.includes(w) || latin) s.style.color = HL_COLORS[hlCount++ % HL_COLORS.length];
    if (latin) s.dir = 'ltr';
    s.textContent = w;
    div.appendChild(s);
    div.appendChild(document.createTextNode(' '));
    return s;
  });
  div.style.display = 'none';
  cap.appendChild(div);
  return { el: div, words, l };
});

// ---------- scene windows ----------
const order = ['hook', 'intro', 'acts', 'dom', 'models', 'agents', 'replay', 'oss', 'cta'];
const scenes = order.map((id, i) => {
  const l = L[id];
  const next = timing.lines[i + 1];
  return { id, el: $('s-' + id), l, a: i === 0 ? 0 : l.start - 0.45, b: next ? next.start - 0.45 : timing.duration + 1 };
});

function sceneFx(s, t) {
  const fin = easeOut(seg(t, s.a, s.a + 0.55));
  const fout = easeInOut(seg(t, s.b - 0.4, s.b));
  const on = t >= s.a - 0.01 && t < s.b;
  s.el.style.display = on ? 'block' : 'none';
  if (!on) return false;
  const first = s.id === 'hook';
  s.el.style.opacity = first ? 1 - fout : fin * (1 - fout);
  const bin = back(seg(t, s.a, s.a + 0.5));
  const y = first ? -60 * fout : 110 * (1 - bin) - 60 * fout;
  const sc = first ? 1 + 0.06 * fout : lerp(0.86, 1, bin) + 0.05 * fout;
  s.el.style.transform = `translateY(${y}px) scale(${sc}) rotate(${first ? 0 : (1 - fin) * 1.5}deg)`;
  s.el.style.filter = `blur(${(1 - fin) * (first ? 0 : 6) + fout * 8}px)`;
  return true;
}

const show = (el, p, dy = 30, sc = 1) => {
  el.style.opacity = p;
  el.style.transform = `translateY(${(1 - p) * dy}px) scale(${lerp(sc, 1, p)})`;
};
const pop = (el, p) => { el.style.opacity = p ? 1 : 0; el.style.transform = `scale(${p ? back(p) : 0})`; };

// skeleton web page used inside the small browser windows
const skeleton = (w) => `<div style="position:absolute;inset:0;padding:${w * 0.05}px">
  <div style="width:40%;height:${w * 0.045}px;border-radius:8px;background:#E3DDD3;margin-bottom:${w * 0.03}px"></div>
  <div style="width:85%;height:${w * 0.022}px;border-radius:6px;background:#F2EEE8;margin-bottom:${w * 0.015}px"></div>
  <div style="width:70%;height:${w * 0.022}px;border-radius:6px;background:#F2EEE8;margin-bottom:${w * 0.04}px"></div>
  <div style="display:flex;gap:${w * 0.02}px;margin-bottom:${w * 0.04}px">${[0, 1, 2].map(() => `<div style="flex:1;height:${w * 0.16}px;border-radius:12px;background:#F2EEE8"></div>`).join('')}</div>
  <div class="skBtn" style="width:${w * 0.26}px;height:${w * 0.07}px;border-radius:12px;background:#2b2823"></div></div>`;

// cursor driven by keyframes [t, x, y] with click times
function cursorAt(keys, u) {
  if (u <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) {
      const p = easeInOut(seg(u, keys[i - 1][0], keys[i][0]));
      return [lerp(keys[i - 1][1], keys[i][1], p), lerp(keys[i - 1][2], keys[i][2], p)];
    }
  }
  const k = keys[keys.length - 1];
  return [k[1], k[2]];
}
function ring(el, clicks, u) {
  const c = clicks.filter(([tc]) => u >= tc && u < tc + 0.45).pop();
  if (!c) { el.style.opacity = 0; return; }
  const p = seg(u, c[0], c[0] + 0.45);
  el.style.left = c[1] + 'px'; el.style.top = c[2] + 'px';
  el.style.opacity = 1 - p;
  el.style.transform = `scale(${0.4 + 0.9 * easeOut(p)})`;
}
// centre of an element in its window's coordinates (measured once, before any transforms are applied)
const centerIn = (el, win) => {
  const a = el.getBoundingClientRect(), b = win.getBoundingClientRect();
  return [a.left - b.left + a.width / 2, a.top - b.top + a.height / 2];
};

// ---------- hook ----------
const HOOK_TXT = 'book me a slot for friday';
$('hookBody').innerHTML = skeleton(780);
function hook(t) {
  const u = t - L.hook.start;
  const sp = easeOut(seg(t, 0.05, 0.9));
  $('hookSpark').style.opacity = sp;
  $('hookSpark').style.transform = `rotate(${(1 - sp) * -120 + t * 12}deg) scale(${0.3 + 0.7 * back(seg(t, 0.05, 0.8))})`;
  show($('hk1'), easeOut(seg(u, -0.2, 0.4)), 40);
  show($('hk2'), easeOut(seg(u, 3.1, 3.6)), 40, 0.9);
  const cb = easeOut(seg(u, 0.0, 0.6));
  $('chatbar').style.opacity = cb;
  $('chatbar').style.transform = `translateY(${(1 - cb) * 80}px)`;
  const tp = seg(u, 0.5, 2.6);
  $('chatTxt').textContent = typed(HOOK_TXT, tp);
  $('chatCur').style.opacity = u < 2.9 && (Math.floor(t * 2.5) % 2 === 0 || (tp > 0 && tp < 1)) ? 1 : 0;
  $('chatbar').querySelector('.send').style.transform = `scale(${1 - 0.18 * Math.sin(Math.PI * seg(u, 2.8, 3.05))})`;
  const w = seg(u, 3.0, 3.5);
  $('hookWin').style.opacity = w ? 1 : 0;
  $('hookWin').style.transform = `translateY(${(1 - easeOut(w)) * -120}px) scale(${w ? lerp(0.3, 1, back(w)) : 0.3})`;
  $('hookUrl').textContent = typed('book.example.com', seg(u, 3.4, 3.9));
  const ld = seg(u, 3.8, 4.6);
  $('hookLoad').style.width = 780 * easeOut(ld) + 'px';
  $('hookLoad').style.opacity = 1 - seg(u, 4.6, 4.8);
  $('hookBody').style.opacity = seg(u, 4.2, 4.6);
}

// ---------- intro ----------
$('inBody').innerHTML = skeleton(840) + `<svg class="cursor" id="inCur" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#1C1A16" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><div class="ring" id="inRing"></div>`;
const IN_KEYS = [[0.8, 640, 460], [1.8, 260, 230], [2.6, 420, 240], [3.6, 150, 480], [4.6, 600, 300]];
function intro(t) {
  const u = t - L.intro.start;
  show($('inTitle'), easeOut(seg(u, -0.3, 0.4)), 40, 0.92);
  show($('inSub'), easeOut(seg(u, 0.1, 0.7)), 20);
  show($('inWin'), easeOut(seg(u, 0.3, 0.9)), 60, 0.95);
  $('inUrl').textContent = typed('any website…', seg(u, 0.6, 1.2));
  $('inLoad').style.width = 840 * easeOut(seg(u, 0.9, 1.6)) + 'px';
  $('inLoad').style.opacity = 1 - seg(u, 1.6, 1.8);
  const [x, y] = cursorAt(IN_KEYS, u);
  $('inCur').style.left = x + 'px'; $('inCur').style.top = y + 'px';
  $('inCur').style.opacity = seg(u, 0.8, 1.0);
  ring($('inRing'), [[1.85, 260, 230], [2.65, 420, 240], [3.65, 150 + 20, 480 + 15]], u);
}

// ---------- actions ----------
const actWin = $('actWin');
const P = Object.fromEntries(['fName', 'd1', 't1', 'fBtn'].map((id) => [id, centerIn($(id), actWin)]));
const ACT = { name: 0.3, type: [0.9, 1.4], fri: 1.8, time: 2.15, book: 2.6, ok: 2.9 };
const ACT_KEYS = [[-0.3, 620, 760], [ACT.name, ...P.fName], [ACT.name + 0.9, ...P.fName], [ACT.fri, ...P.d1], [ACT.time, ...P.t1], [ACT.book, ...P.fBtn]];
const ACT_CLICKS = [[ACT.name, ...P.fName], [ACT.fri, ...P.d1], [ACT.time, ...P.t1], [ACT.book, ...P.fBtn]];
function acts(t) {
  const u = t - L.acts.start;
  const [x, y] = cursorAt(ACT_KEYS, u);
  $('actCur').style.left = x - 6 + 'px'; $('actCur').style.top = y - 4 + 'px';
  ring($('actRing'), ACT_CLICKS, u);
  $('fName').textContent = typed('Sara', seg(u, ...ACT.type)) + (u > ACT.name && u < ACT.fri ? '|' : '');
  $('fName').style.borderColor = u > ACT.name && u < ACT.fri ? '#E8623A' : '';
  $('d1').classList.toggle('sel', u > ACT.fri);
  $('t1').classList.toggle('sel', u > ACT.time);
  $('fBtn').style.transform = `scale(${1 - 0.06 * Math.sin(Math.PI * seg(u, ACT.book - 0.05, ACT.book + 0.2))})`;
  const ok = seg(u, ACT.ok, ACT.ok + 0.35);
  $('fOk').style.opacity = ok;
  $('fOk').style.transform = `translateY(${(1 - easeOut(ok)) * 40}px)`;
  [ACT.name, ACT.type[0], ACT.fri, ACT.ok].forEach((a, i) => {
    $('c' + i).classList.toggle('on', u > a);
    $('c' + i).style.transform = `scale(${1 + 0.08 * Math.sin(Math.PI * seg(u, a, a + 0.35))})`;
  });
}

// ---------- dom ----------
const domWin = $('domWin');
const DOM_ITEMS = [['gName', 'input', 'name'], ['gFri', 'button', 'Fri'], ['gT', 'button', '10:30'], ['gBtn', 'button', 'Book']];
DOM_ITEMS.forEach(([id, tag, txt], i) => {
  const r = $(id).getBoundingClientRect(), w = domWin.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'badge'; b.id = 'bd' + i; b.textContent = i + 1;
  b.style.left = r.left - w.left - 14 + 'px'; b.style.top = r.top - w.top - 16 + 'px';
  domWin.appendChild(b);
  const e = document.createElement('div');
  e.className = 'el'; e.id = 'el' + i; e.style.top = 880 + i * 92 + 'px';
  e.innerHTML = `<span class="n">${i + 1}</span><span class="tg">&lt;${tag}&gt;</span><span>${txt}</span>`;
  $('domList').appendChild(e);
});
function dom(t) {
  const u = t - L.dom.start;
  show($('domWin'), easeOut(seg(u, -0.2, 0.4)), 40, 0.96);
  DOM_ITEMS.forEach((_, i) => {
    pop($('bd' + i), seg(u, 1.0 + i * 0.25, 1.3 + i * 0.25));
    show($('el' + i), easeOut(seg(u, 2.2 + i * 0.35, 2.6 + i * 0.35)), 30);
  });
  const hit = u > 5.6;
  $('el3').classList.toggle('hit', hit);
  $('el3').style.transform = `scale(${1 + 0.04 * Math.sin(Math.PI * seg(u, 5.6, 5.95))})`;
  $('gBtn').style.outline = hit ? '6px solid #E8623A' : 'none';
}

// ---------- models ----------
const HUB = [540, 790];
const M_POS = [[290, 560], [790, 560], [290, 1030], [790, 1030]];
M_POS.forEach(([x, y], i) => {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', `M${HUB[0]} ${HUB[1]} L${x} ${y}`);
  p.setAttribute('stroke', '#E8623A'); p.setAttribute('stroke-width', 3); p.setAttribute('stroke-dasharray', '8 10');
  p.id = 'ml' + i; $('mLines').appendChild(p);
});
const M_AT = [0.25, 0.85, 1.5, 2.3];
function models(t) {
  const u = t - L.models.start;
  $('hub').style.transform = `scale(${1 + 0.04 * Math.sin(u * 4)})`;
  $('hub').querySelector('svg').style.transform = `rotate(${u * 30}deg)`;
  M_AT.forEach((a, i) => {
    pop($('m' + i), seg(u, a, a + 0.4));
    const l = $('ml' + i);
    l.style.opacity = seg(u, a, a + 0.3) * 0.8;
    l.style.strokeDashoffset = -u * 40;
    const mc = ['#E8623A', '#22A86B', '#3D7BF2', '#9466F0'][i];
    $('m' + i).style.borderColor = u > a ? mc : '';
    $('m' + i).style.color = u > a ? mc : '';
    l.setAttribute('stroke', mc);
  });
}

// ---------- agents ----------
function agents(t) {
  const u = t - L.agents.start;
  show($('term'), easeOut(seg(u, -0.3, 0.2)), 30);
  $('termTxt').textContent = typed('browser-use skill install', seg(u, 0.0, 1.3)) + (Math.floor(t * 2.5) % 2 === 0 ? '▍' : ' ');
  [0.5, 1.2].forEach((a, i) => { pop($('a' + i), seg(u, a, a + 0.4)); $('a' + i).classList.toggle('on', u > a + 0.3); });
  const ar = seg(u, 1.8, 2.2);
  $('aArrow').style.opacity = ar; $('aArrow').style.transform = `translateX(${(1 - easeOut(ar)) * -20}px)`;
  pop($('aWin'), seg(u, 2.2, 2.6));
}

// ---------- replay ----------
const STEPS = ['open', 'type', 'pick', 'pick', 'book'];
const brain = `<svg width="34" height="34" viewBox="-50 -50 100 100"><use href="#spark"/></svg>`;
const play = `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="#22A86B"/></svg>`;
STEPS.forEach((s, i) => {
  for (const [row, top, icon, cls] of [['row1', 520, brain, ''], ['row2', 920, play, ' fast']]) {
    const d = document.createElement('div');
    d.className = 'step' + cls; d.id = `${row}-${i}`; d.style.left = 90 + i * 186 + 'px'; d.style.top = top + 'px';
    d.innerHTML = icon + `<span>${s}</span>`;
    $(row).appendChild(d);
  }
});
function replay(t) {
  const u = t - L.replay.start;
  STEPS.forEach((_, i) => {
    const a = i * 0.28;
    const d1 = $('row1-' + i);
    show(d1, easeOut(seg(u, a - 0.3, a)), 20);
    d1.classList.toggle('on', u > a);
    d1.querySelector('svg').style.transform = `rotate(${u > a ? (u - a) * 90 : 0}deg)`;
    const b = 3.0 + i * 0.16;
    const d2 = $('row2-' + i);
    show(d2, easeOut(seg(u, 2.6, 3.0)), 20);
    d2.classList.toggle('on', u > b);
    d2.style.transform += ` scale(${1 + 0.06 * Math.sin(Math.PI * seg(u, b, b + 0.2))})`;
  });
  show($('saved'), easeOut(seg(u, 1.5, 1.9)), 16);
  const v = seg(u, 2.2, 2.6), sw = seg(u, 2.7, 3.0);
  $('vars').style.opacity = v;
  $('vars').innerHTML = `name: <span style="color:${sw ? 'var(--sage)' : 'var(--sand)'}">"${sw < 0.5 ? 'Sara' : 'Ali'}"</span>  ·  day: <span style="color:var(--sand)">"Fri"</span>`;
  document.querySelectorAll('#s-replay .rlab')[1].style.opacity = seg(u, 2.2, 2.6) * (1 - 0.35 * Math.max(0, Math.sin((u - 4.5) * 5)) * (u > 4.5 && u < 5.8));
}

// ---------- oss ----------
function oss(t) {
  const u = t - L.oss.start;
  const m = seg(u, -0.3, 0.3);
  document.querySelector('#s-oss .mit').style.transform = `scale(${m ? back(m) : 0.6})`;
  show(document.querySelector('#s-oss .os'), easeOut(seg(u, 0.4, 0.9)), 30);
  show(document.querySelector('#s-oss .fam'), easeOut(seg(u, 1.9, 2.4)), 30, 0.9);
}

// ---------- cta ----------
const CTA_WORD = 'عامل';
function cta(t) {
  const u = t - L.cta.start, d = L.cta.end - L.cta.start;
  show($('ctaSub'), easeOut(seg(u, 0.4, 0.9)), 20);
  const cb = easeOut(seg(u, 0.5, 1.0));
  $('cbox').style.opacity = cb; $('cbox').style.transform = `translateY(${(1 - cb) * 60}px)`;
  const n = Math.round(seg(u, 2.4, 3.1) * CTA_WORD.length);
  const posted = d + 0.25;
  $('cIn').textContent = u > posted ? '' : [...CTA_WORD].slice(0, n).join('');
  $('cph').style.opacity = n && u <= posted ? 0 : 1;
  $('cCur').style.opacity = u < posted && Math.floor(t * 2.5) % 2 === 0 ? 1 : 0;
  $('cPost').style.opacity = n >= CTA_WORD.length ? 1 : 0.35;
  $('cPost').style.transform = `scale(${1 - 0.15 * Math.sin(Math.PI * seg(u, posted - 0.15, posted + 0.1))})`;
  show($('posted'), easeOut(seg(u, posted, posted + 0.45)), 40, 0.9);
  const hp = seg(u, posted + 0.35, posted + 0.7);
  $('heart').style.opacity = hp ? 1 : 0;
  $('heart').style.transform = `scale(${hp ? back(hp) * (1 + 0.06 * Math.sin((u - posted) * 6)) : 0})`;
  const ap = easeOut(seg(u, posted + 0.6, posted + 1.0));
  $('ctaArrow').style.opacity = ap;
  $('ctaArrow').style.transform = `translateY(${(1 - ap) * -30 + Math.sin(u * 5) * 10 * ap}px)`;
}

burst(L.hook.start + 3.35, 540, 900, 50);
burst(L.acts.start + 2.95, 540, 1060, 80);
burst(L.oss.start + 0.05, 540, 560, 110, 1.2);
burst(L.cta.end + 0.65, 540, 930, 90);

const fns = { hook, intro, acts, dom, models, agents, replay, oss, cta };

window.renderAt = (t) => {
  gctx.putImageData(grainFrames[Math.floor(t * 12) % grainFrames.length], 0, 0);
  for (const b of BLOBS) b.d.style.transform = `translate(${b.x - b.sz / 2 + Math.sin(t * 0.5 + b.ph) * 120}px, ${b.y - b.sz / 2 + Math.cos(t * 0.4 + b.ph) * 140}px) scale(${1 + 0.12 * Math.sin(t * 0.8 + b.ph)})`;
  for (const s of scenes) if (sceneFx(s, t)) fns[s.id](t);
  drawConfetti(t);

  $('brand').style.opacity = seg(t, L.acts.start - 0.5, L.acts.start) * 0.9;
  $('brand').querySelector('svg').style.transform = `rotate(${t * 20}deg)`;

  // captions: one line at a time, words revealed across the spoken duration
  let any = false;
  capLines.forEach(({ el, words, l }, i) => {
    const next = timing.lines[i + 1];
    const a = l.start - 0.15, b = next ? next.start - 0.3 : timing.duration + 1;
    const on = t >= a && t < b;
    el.style.display = on ? 'block' : 'none';
    if (!on) return;
    any = true;
    el.style.opacity = 1 - easeInOut(seg(t, b - 0.25, b));
    const span = (l.end - l.start) * 0.85;
    words.forEach((w, k) => {
      const wa = l.start - 0.1 + (k / words.length) * span;
      const p = easeOut(seg(t, wa, wa + 0.28));
      w.style.opacity = p;
      w.style.transform = `translateY(${(1 - p) * 18}px)`;
    });
  });
  $('capbar').style.opacity = any ? 0.9 : 0;
};

window.renderAt(0);
window.__ready = true;
