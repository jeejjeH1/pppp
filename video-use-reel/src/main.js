// Every frame is a pure function of t: window.renderAt(t) sets all styles, so render.js can step it deterministically.
const timing = await (await fetch('/out/timing.json')).json();
const L = Object.fromEntries(timing.lines.map((l, i) => [l.id, { ...l, i }]));
window.DURATION = timing.duration;

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const NS = 'http://www.w3.org/2000/svg';
const rand = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

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

// ---------- captions ----------
const HL = ['چت', 'چت!', 'Claude', 'می‌خونه!', 'خودکار.', 'سینمایی،', '۱۲', 'کیلوبایت', 'چک', 'متن‌بازه!', '«میخوام»', '«اِممم»ها،', 'نهایی', 'حذفشون']; 
const cap = $('cap');
const capLines = timing.lines.map((l) => {
  const div = document.createElement('div');
  div.className = 'line';
  // keep Latin phrases as one LTR token so the RTL line doesn't reverse them
  const words = l.cap.replace('Claude Code', 'Claude\u00a0Code').split(' ').map((w) => {
    const s = document.createElement('span');
    s.className = 'wd' + (HL.includes(w) || w.startsWith('Claude') ? ' hl' : '');
    if (/^[A-Za-z]/.test(w)) s.dir = 'ltr';
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
const order = ['hook', 'intro', 'cuts', 'polish', 'reads', 'tokens', 'self', 'oss', 'cta'];
const lineOf = { self: 'selfeval' };
const scenes = order.map((id, i) => {
  const l = L[lineOf[id] ?? id];
  const next = timing.lines[i + 1];
  return { id, el: $('s-' + id), l, a: i === 0 ? 0 : l.start - 0.45, b: next ? next.start - 0.45 : timing.duration + 1 };
});

function sceneFx(s, t) {
  const fin = easeOut(seg(t, s.a, s.a + 0.55));
  const fout = easeInOut(seg(t, s.b - 0.4, s.b));
  const on = t >= s.a - 0.01 && t < s.b;
  s.el.style.display = on ? 'block' : 'none';
  if (!on) return false;
  const op = s.id === 'hook' ? Math.min(1, 1 - fout) : fin * (1 - fout);
  s.el.style.opacity = op;
  const y = s.id === 'hook' ? -40 * fout : 50 * (1 - fin) - 40 * fout;
  const sc = s.id === 'hook' ? 1 + 0.04 * fout : 0.96 + 0.04 * fin + 0.03 * fout;
  s.el.style.transform = `translateY(${y}px) scale(${sc})`;
  s.el.style.filter = `blur(${(1 - fin) * (s.id === 'hook' ? 0 : 14) + fout * 12}px)`;
  return true;
}

const show = (el, p, dy = 30, sc = 1) => {
  el.style.opacity = p;
  el.style.transform = `translateY(${(1 - p) * dy}px) scale(${lerp(sc, 1, p)})`;
};

// ---------- hook ----------
const HOOK_TXT = 'edit these into a reel';
function hook(t) {
  const u = t - L.hook.start;
  const sp = easeOut(seg(t, 0.05, 0.9));
  $('hookSpark').style.opacity = sp;
  $('hookSpark').style.transform = `rotate(${(1 - sp) * -120 + t * 12}deg) scale(${0.3 + 0.7 * back(seg(t, 0.05, 0.8))})`;
  show($('hk1'), easeOut(seg(u, -0.2, 0.4)), 40);
  show($('hk2'), easeOut(seg(u, 1.5, 2.0)), 40, 0.9);
  const cb = easeOut(seg(u, 0.1, 0.7));
  $('chatbar').style.opacity = cb;
  $('chatbar').style.transform = `translateY(${(1 - cb) * 80}px)`;
  const n = Math.round(seg(u, 0.6, 2.2) * HOOK_TXT.length);
  const sent = u > L.hook.end - L.hook.start - 0.1;
  $('chatTxt').textContent = HOOK_TXT.slice(0, n);
  $('chatCur').style.opacity = !sent && Math.floor(t * 2.5) % 2 === 0 ? 1 : n < HOOK_TXT.length && n > 0 ? 1 : 0;
  const pressed = seg(u, L.hook.end - L.hook.start - 0.1, L.hook.end - L.hook.start + 0.15);
  $('chatbar').querySelector('.send').style.transform = `scale(${1 - 0.18 * Math.sin(Math.PI * pressed)})`;
}

// ---------- intro ----------
const CLIP_COLORS = ['#c96f52', '#9fb59a', '#e3b27a', '#7d93ad', '#b9878f'];
{
  $('folder').innerHTML = `<svg width="230" height="200" viewBox="0 0 230 200">
      <path d="M14 46 Q14 30 30 30 H88 l18 18 H200 Q216 48 216 64 V172 Q216 188 200 188 H30 Q14 188 14 172Z" fill="#2c2924" stroke="#4a463c" stroke-width="3"/>
      <g id="clips"></g>
      <path id="folderFront" d="M8 84 Q8 72 22 72 H208 Q222 72 222 84 L214 176 Q212 190 198 190 H32 Q18 190 16 176Z" fill="#d97757"/></svg>`;
  const g = $('clips');
  CLIP_COLORS.forEach((c, i) => {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('width', 70); r.setAttribute('height', 48); r.setAttribute('rx', 8); r.setAttribute('fill', c);
    r.id = 'clip' + i; g.appendChild(r);
  });
  $('chatIc').innerHTML = `<div style="position:relative;width:250px;height:230px">
      <div class="bubble" id="bq" style="right:0;top:20px;background:#d97757;color:#161512">edit these<br>into a reel</div>
      <div class="bubble" id="ba" style="left:0;top:128px;background:#2c2924;border:2px solid #4a463c;color:#f4efe6">on it ✦</div></div>`;
  $('outIc').innerHTML = `<div style="position:relative;width:240px;height:220px">
      <div style="position:absolute;left:10px;top:30px;width:220px;height:150px;border-radius:22px;background:linear-gradient(135deg,#3a372f,#262420);border:2px solid #4a463c"></div>
      <svg style="position:absolute;left:92px;top:76px" width="60" height="60" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="#f4efe6"/></svg>
      <div id="okBadge" style="position:absolute;right:-6px;top:6px;width:72px;height:72px;border-radius:50%;background:#9fb59a;display:flex;align-items:center;justify-content:center">
        <svg width="40" height="40" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#161512" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>`;
}
function intro(t) {
  const u = t - L.intro.start;
  show($('inTitle'), easeOut(seg(u, -0.3, 0.4)), 40, 0.92);
  show($('inSub'), easeOut(seg(u, 0.1, 0.7)), 20);
  const p1 = easeOut(seg(u, 0.9, 1.5)), p2 = easeOut(seg(u, 3.1, 3.7)), p3 = easeOut(seg(u, 5.0, 5.6));
  show($('st1'), p1, 50, 0.85); show($('st2'), p2, 50, 0.85); show($('st3'), p3, 50, 0.85);
  for (const [id, p] of [['ar1', seg(u, 2.8, 3.2)], ['ar2', seg(u, 4.7, 5.1)]]) {
    $(id).style.opacity = p; $(id).style.transform = `translateX(${(1 - easeOut(p)) * 20}px)`;
  }
  CLIP_COLORS.forEach((_, i) => {
    const d = easeInOut(seg(u, 1.3 + i * 0.28, 1.85 + i * 0.28));
    const x = 80 + (i - 2) * 22, y0 = -120 - i * 10, y1 = 86 + (i % 2) * 6;
    const r = $('clip' + i);
    r.setAttribute('x', x); r.setAttribute('y', lerp(y0, y1, d));
    r.setAttribute('transform', `rotate(${(1 - d) * (i - 2) * 14} ${x + 35} ${lerp(y0, y1, d) + 24})`);
    r.style.opacity = seg(u, 1.25 + i * 0.28, 1.4 + i * 0.28);
  });
  show($('bq'), back(seg(u, 3.4, 3.8)), 20, 0.6);
  show($('ba'), back(seg(u, 4.1, 4.5)), 20, 0.6);
  const ok = seg(u, 5.6, 6.0);
  $('okBadge').style.transform = `scale(${ok ? back(ok) : 0})`;
}

// ---------- cuts ----------
const SEGS = [
  { w: 170, bad: false }, { w: 90, bad: 'umm' }, { w: 160, bad: false }, { w: 110, bad: '•••' },
  { w: 150, bad: false }, { w: 80, bad: 'uh' }, { w: 180, bad: false },
];
{
  const wave = $('wave');
  SEGS.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'seg';
    d.innerHTML = `<canvas width="${s.w}" height="300"></canvas>` + (s.bad ? `<div class="tag" style="color:#f0a383">${s.bad}</div>` : '');
    d.style.overflow = 'visible';
    const c = d.querySelector('canvas').getContext('2d');
    for (let x = 6; x < s.w - 4; x += 10) {
      const amp = s.bad === '•••' ? 4 + rand() * 6 : s.bad ? 20 + rand() * 40 : 20 + Math.pow(rand(), 0.7) * 110;
      c.fillStyle = s.bad ? '#d97757' : '#c9bfae';
      c.beginPath(); c.roundRect(x, 150 - amp, 5, amp * 2, 3); c.fill();
    }
    s.el = d; wave.appendChild(d);
  });
}
function cuts(t) {
  const u = t - L.cuts.start;
  const hi = seg(u, 0.2, 0.7);
  const cut = easeInOut(seg(u, 1.5, 2.3));
  let x = 0;
  const total = SEGS.reduce((a, s) => a + (s.bad ? s.w * (1 - cut) : s.w) + 10 * (s.bad ? 1 - cut : 1), 0) - 10;
  const off = (940 - total) / 2;
  for (const s of SEGS) {
    const w = s.bad ? s.w * (1 - cut) : s.w;
    s.el.style.left = off + x + 'px';
    s.el.style.width = w + 'px';
    s.el.style.background = s.bad ? `rgba(217,119,87,${0.18 * hi})` : 'rgba(244,239,230,.05)';
    s.el.style.outline = s.bad ? `2px dashed rgba(217,119,87,${hi * (1 - cut)})` : 'none';
    s.el.style.opacity = s.bad ? 1 - cut : 1;
    const tag = s.el.querySelector('.tag');
    if (tag) { tag.style.opacity = hi * (1 - seg(u, 1.4, 1.8)); }
    x += w + 10 * (s.bad ? 1 - cut : 1);
  }
  show($('cutLab'), easeOut(seg(u, 2.3, 2.8)), 20);
}

// ---------- polish ----------
function polish(t) {
  const u = t - L.polish.start;
  const g = easeInOut(seg(u, 0.1, 0.9));
  $('land').style.filter = `grayscale(${lerp(0.85, 0, g)}) contrast(${lerp(0.8, 1.08, g)}) brightness(${lerp(0.78, 1.02, g)}) saturate(${lerp(1, 1.25, g)}) sepia(${0.12 * g})`;
  $('sun').setAttribute('r', 60 + 8 * g);
  const sub = seg(u, 1.0, 1.25);
  const subEl = $('polSub');
  subEl.style.opacity = sub;
  subEl.style.transform = `scale(${sub ? back(sub) : 0.5})`;
  subEl.firstChild.textContent = u < 2.1 ? 'خیلی ساده‌ست' : 'فقط با چت';
  const sw = seg(u, 2.05, 2.25); // re-pop on chunk change
  if (u > 2.05) subEl.style.transform = `scale(${0.85 + 0.15 * back(sw)})`;
  const an = seg(u, 1.9, 2.4);
  $('polSpark').style.opacity = an;
  $('polSpark').style.transform = `scale(${an ? back(an) : 0}) rotate(${u * 60}deg)`;
  $('ch1').classList.toggle('on', u > 0.1);
  $('ch2').classList.toggle('on', u > 1.0);
  $('ch3').classList.toggle('on', u > 1.9);
  [['ch1', 0.1], ['ch2', 1.0], ['ch3', 1.9]].forEach(([id, a]) => { $(id).style.transform = `scale(${1 + 0.08 * Math.sin(Math.PI * seg(u, a, a + 0.35))})`; });
}

// ---------- reads ----------
const TLINES = [
  ['## C0103  ', '(43.0s · 8 phrases)'],
  ['[002.52-005.36] ', 'S0 Ninety percent of what'],
  ['                ', 'a web agent does is wasted.'],
  ['[006.08-006.74] ', 'S0 We fixed this.'],
  ['[007.10-007.90] ', '(laughter)'],
  ['[008.40-011.02] ', 'S0 Here is how it works…'],
];
{
  const strip = $('strip');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    const f = document.createElement('div');
    f.className = 'fr';
    const h = (r * 5 + c) * 24;
    f.style.background = `linear-gradient(${120 + c * 20}deg, hsl(${(18 + h) % 360} 35% 42%), hsl(${(48 + h) % 360} 30% 24%))`;
    f.style.left = c * 180 + 15 + 'px'; f.style.top = r * 130 + 'px';
    f.dataset.i = r * 5 + c;
    strip.appendChild(f);
  }
  TLINES.forEach(([a, b], i) => {
    const d = document.createElement('div');
    d.className = 'tline'; d.style.top = i * 66 + 20 + 'px'; d.dataset.a = a; d.dataset.b = b;
    strip.appendChild(d);
  });
}
function reads(t) {
  const u = t - L.reads.start;
  const morph = seg(u, 2.2, 3.0);
  document.querySelectorAll('#strip .fr').forEach((f) => {
    const i = +f.dataset.i;
    const p = easeInOut(seg(u, 2.1 + i * 0.03, 2.7 + i * 0.03));
    f.style.opacity = 1 - p;
    f.style.transform = `scale(${1 - 0.6 * p}) translateY(${Math.sin(u * 2 + i) * 4}px)`;
    f.style.filter = `blur(${p * 8}px)`;
  });
  document.querySelectorAll('#strip .tline').forEach((d, i) => {
    const full = d.dataset.a + d.dataset.b;
    const n = Math.round(seg(u, 2.6 + i * 0.22, 3.3 + i * 0.22) * full.length);
    const s = full.slice(0, n);
    d.innerHTML = `<b>${s.slice(0, d.dataset.a.length)}</b>${s.slice(d.dataset.a.length)}`;
    d.style.opacity = morph;
  });
}

// ---------- tokens ----------
function tokens(t) {
  const u = t - L.tokens.start;
  const c = easeOut(seg(u, -0.2, 1.3));
  $('n1').innerHTML = `${Math.round(45 * c)}M<span style="font-size:42px;font-family:Mono;margin-left:16px;color:#8c8577">tokens</span>`;
  $('b1').style.width = 860 * c + 'px';
  const st = easeInOut(seg(u, 1.45, 1.85));
  $('strikeP').style.strokeDasharray = '920'; $('strikeP').style.strokeDashoffset = 920 * (1 - st);
  const fade = 1 - 0.45 * st;
  show($('l1'), easeOut(seg(u, 0, 0.4)) * fade, 20);
  $('n1').style.opacity = fade; $('b1').style.opacity = fade;
  const p2 = seg(u, 1.75, 2.15);
  show($('n2'), p2 ? back(p2) : 0, 30, 0.6);
  show($('l2'), easeOut(seg(u, 1.9, 2.3)), 20);
  $('b2').style.width = 28 * easeOut(seg(u, 2.0, 2.4)) + 'px';
}

// ---------- self-eval ----------
const NODES = ['Transcribe', 'Pack', 'LLM Reasons', 'EDL', 'Render', 'Self-Eval'];
{
  const pipe = $('pipe');
  NODES.forEach((n, i) => {
    const d = document.createElement('div');
    d.className = 'node'; d.style.top = 470 + i * 128 + 'px';
    d.innerHTML = `<div class="dot"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#161512" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div><span>${n}</span>`;
    pipe.appendChild(d);
  });
  const p = document.createElementNS(NS, 'path');
  // loop from Self-Eval back to Render, on the right side
  const y5 = 470 + 5 * 128 + 52, y4 = 470 + 4 * 128 + 52;
  p.setAttribute('d', `M830 ${y5} C 930 ${y5}, 930 ${y4}, 842 ${y4}`);
  p.setAttribute('stroke', '#d97757'); p.setAttribute('stroke-width', 5); p.setAttribute('fill', 'none');
  p.setAttribute('stroke-linecap', 'round'); p.id = 'loopP';
  const h = document.createElementNS(NS, 'path');
  h.setAttribute('d', `M858 ${y4 - 14} L840 ${y4} L858 ${y4 + 14}`);
  h.setAttribute('stroke', '#d97757'); h.setAttribute('stroke-width', 5); h.setAttribute('fill', 'none'); h.setAttribute('stroke-linecap', 'round'); h.id = 'loopH';
  $('loop').append(p, h);
}
function self(t) {
  const u = t - L.selfeval.start;
  document.querySelectorAll('#pipe .node').forEach((d, i) => {
    const a = -0.2 + i * 0.32;
    show(d, easeOut(seg(u, a - 0.3, a)), 24);
    d.classList.toggle('on', u > a + 0.1 && (i < 5 || u > 2.4));
    d.querySelector('svg').style.opacity = u > a + 0.1 && (i < 5 || u > 2.4) ? 1 : 0;
  });
  const lp = easeInOut(seg(u, 1.6, 2.2));
  $('loopP').style.strokeDasharray = 260; $('loopP').style.strokeDashoffset = 260 * (1 - lp);
  $('loopH').style.opacity = seg(u, 2.1, 2.25);
}

// ---------- oss ----------
function oss(t) {
  const u = t - L.oss.start;
  const c = easeOut(seg(u, -0.3, 0.7));
  $('pct').textContent = Math.round(100 * c) + '%';
  $('pct').style.color = c >= 1 ? 'var(--coral)' : 'var(--cream)';
}

// ---------- cta ----------
const CTA_WORD = 'میخوام';
function cta(t) {
  const u = t - L.cta.start, d = L.cta.end - L.cta.start;
  show($('ctaSub'), easeOut(seg(u, 0.4, 0.9)), 20);
  const cb = easeOut(seg(u, 0.5, 1.0));
  $('cbox').style.opacity = cb; $('cbox').style.transform = `translateY(${(1 - cb) * 60}px)`;
  const n = Math.round(seg(u, 1.4, 2.3) * CTA_WORD.length);
  // type letter by letter (Persian letters join, so slice whole graphemes)
  $('cIn').textContent = [...CTA_WORD].slice(0, n).join('');
  const posted = d + 0.25;
  $('cCur').style.opacity = u < posted && Math.floor(t * 2.5) % 2 === 0 ? 1 : 0;
  if (u > posted) $('cIn').textContent = '';
  $('cph').style.opacity = n && u <= posted ? 0 : 1;
  $('cPost').style.opacity = n >= CTA_WORD.length ? 1 : 0.35;
  $('cPost').style.transform = `scale(${1 - 0.15 * Math.sin(Math.PI * seg(u, posted - 0.15, posted + 0.1))})`;
  const pp = seg(u, posted, posted + 0.45);
  show($('posted'), easeOut(pp), 40, 0.9);
  const hp = seg(u, posted + 0.35, posted + 0.7);
  $('heart').style.opacity = hp ? 1 : 0;
  $('heart').style.transform = `scale(${hp ? back(hp) * (1 + 0.06 * Math.sin((u - posted) * 6)) : 0})`;
  const ap = easeOut(seg(u, posted + 0.6, posted + 1.0));
  $('ctaArrow').style.opacity = ap;
  $('ctaArrow').style.transform = `translateY(${(1 - ap) * -30 + Math.sin(u * 5) * 10 * ap}px)`;
}

const fns = { hook, intro, cuts, polish, reads, tokens, self, oss, cta };

window.renderAt = (t) => {
  gctx.putImageData(grainFrames[Math.floor(t * 12) % grainFrames.length], 0, 0);
  $('glow').style.setProperty('--gx', 50 + Math.sin(t * 0.25) * 12 + '%');
  $('glow').style.setProperty('--gy', 36 + Math.cos(t * 0.18) * 6 + '%');
  for (const s of scenes) if (sceneFx(s, t)) fns[s.id](t);

  const br = seg(t, L.cuts.start - 0.5, L.cuts.start);
  $('brand').style.opacity = br * 0.9;
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
    const out = easeInOut(seg(t, b - 0.25, b));
    el.style.opacity = 1 - out;
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

await document.fonts.ready;
await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
window.renderAt(0);
window.__ready = true;
