// DOM typography layer, animated as a pure function of time.
// Markup in cue text: *word* -> pink/purple gradient, _word_ -> mint, | -> line break.
//
// anim modes:
//   type     typewriter with block caret (cps = chars/second)
//   scramble decode effect: random glyphs resolve left -> right
//   chars    per-letter rise with blur (default)
//   slam     per-word scale slam with RGB glitch on impact
//   track    letter-spacing collapse
// `cueEvents()` exposes the exact same timings so the soundtrack can sync SFX to them.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const eOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const eOutBack = (x) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const GLYPHS = '!<>-_\\/[]{}=+*^?#%&$01ABCDEFXYZ';
const GRAD = ['#ffe0ff', '#ffb3ff', '#ff87ff', '#f26bff', '#e64dff', '#dc00ff'];

// --------------------------------------------------------------- parsing (shared with node)
export function parse(text) {
  // -> lines: [[{word, kind}]]
  return text.split('|').map((line) =>
    line
      .split(' ')
      .filter(Boolean)
      .map((w) => {
        let kind = '';
        if (/^\*.*\*[.,?!—]*$/.test(w)) {
          kind = 'grad';
          w = w.replace(/\*/g, '');
        } else if (/^_.*_[.,?!—]*$/.test(w)) {
          kind = 'mint';
          w = w.replace(/_/g, '');
        }
        return { word: w, kind };
      }),
  );
}

const DEFAULTS = { soft: { stagger: 0.09 }, type: { cps: 32 }, scramble: { stagger: 0.028, settle: 0.32 }, chars: { stagger: 0.018 }, slam: { stagger: 0.12 } };

/** Timing of every character / word, used by both the DOM animator and the SFX generator. */
export function cueTiming(c) {
  const anim = c.anim || 'chars';
  const lines = c.text ? parse(c.text) : [];
  const chars = [];
  const words = [];
  let k = 0;
  let wi = 0;
  lines.forEach((line, li) => {
    line.forEach((w, wj) => {
      words.push({ ...w, i: wi });
      for (const ch of w.word) chars.push({ ch, w: wi, k: k++ });
      if (wj < line.length - 1) k++; // the space also takes a keystroke
      wi++;
    });
    if (li < lines.length - 1) k += 3; // short pause at line break
  });
  const cps = c.cps ?? DEFAULTS.type.cps;
  const st = c.stagger ?? DEFAULTS[anim]?.stagger ?? 0.02;
  for (const ch of chars) {
    if (anim === 'type') ch.t = c.in + ch.k / cps;
    else if (anim === 'scramble') ch.t = c.in + (c.settle ?? DEFAULTS.scramble.settle) + ch.k * st;
    else if (anim === 'chars') ch.t = c.in + ch.k * st;
    else ch.t = c.in + ch.w * st;
  }
  for (const w of words) w.t = c.in + w.i * (c.stagger ?? DEFAULTS[anim]?.stagger ?? DEFAULTS.slam.stagger);
  return { anim, lines, chars, words };
}

/** SFX events for the soundtrack: [{t, kind}] */
export function cueEvents(cues) {
  const ev = [];
  for (const c of cues) {
    if (c.html) {
      const n = (c.html.match(/class="chip[ "]/g) || []).length;
      for (let i = 0; i < n; i++) ev.push({ t: c.in + i * (c.stagger ?? 0.22), kind: 'pop' });
      continue;
    }
    const { anim, chars, words } = cueTiming(c);
    if (anim === 'type') chars.forEach((ch) => ev.push({ t: ch.t, kind: 'key', v: hash(ch.k) }));
    else if (anim === 'scramble') {
      const end = chars.length ? chars[chars.length - 1].t : c.in;
      for (let t = c.in; t < end; t += 0.035) ev.push({ t, kind: 'blip', v: hash(t * 100) });
      ev.push({ t: end, kind: 'lock' });
    } else if (anim === 'slam') words.forEach((w) => ev.push({ t: w.t, kind: 'slam' }));
    else if (anim === 'track') ev.push({ t: c.in, kind: 'shimmer' });
    else ev.push({ t: c.in, kind: 'swish' });
  }
  return ev.sort((a, b) => a.t - b.t);
}

// --------------------------------------------------------------- DOM
function buildDOM(el, timing) {
  const charEls = [];
  const wordEls = [];
  el.innerHTML = '';
  let ci = 0;
  timing.lines.forEach((line, li) => {
    line.forEach((w, wj) => {
      const ws = document.createElement('span');
      ws.className = `w ${w.kind}`;
      const wi = document.createElement('span');
      wi.className = 'wi';
      [...w.word].forEach((ch, j) => {
        const cs = document.createElement('span');
        cs.className = 'c';
        cs.textContent = ch;
        if (w.kind === 'grad') cs.style.color = GRAD[Math.min(GRAD.length - 1, Math.floor((j / Math.max(1, w.word.length - 1)) * (GRAD.length - 1)))];
        wi.appendChild(cs);
        charEls.push({ el: cs, ch, data: timing.chars[ci++] });
      });
      ws.appendChild(wi);
      el.appendChild(ws);
      wordEls.push({ el: wi, outer: ws });
      if (wj < line.length - 1) el.appendChild(document.createTextNode(' '));
    });
    if (li < timing.lines.length - 1) el.appendChild(document.createElement('br'));
  });
  return { charEls, wordEls };
}

export class Overlay {
  constructor(root, cues) {
    this.cues = cues.map((c) => {
      const el = document.createElement('div');
      el.className = `cue ${c.cls || ''}`;
      Object.assign(el.style, c.style || {});
      root.appendChild(el);
      if (c.html) {
        el.innerHTML = c.html;
        return { ...c, el, chips: [...el.querySelectorAll('.chip')] };
      }
      const timing = cueTiming(c);
      return { ...c, el, timing, ...buildDOM(el, timing) };
    });
  }

  update(t) {
    for (const c of this.cues) {
      const { el } = c;
      const vis = t >= c.in - 0.01 && t <= c.out + 0.5;
      el.style.display = vis ? '' : 'none';
      if (!vis) continue;
      const outP = clamp((t - c.out) / 0.35);
      const outE = outP * outP;
      el.style.opacity = String(1 - outE);
      el.style.filter = outE > 0 ? `blur(${outE * 6}px)` : 'none';
      el.style.translate = `0 ${-outE * 12}px`;
      const local = t - c.in;

      if (c.chips) {
        c.chips.forEach((ch, i) => {
          const p = clamp((local - i * (c.stagger ?? 0.22)) / 0.9);
          const e = eOutCubic(p);
          ch.style.opacity = String(e);
          ch.style.transform = `translateY(${(1 - e) * 14}px)`;
        });
        continue;
      }
      const anim = c.timing.anim;

      if (anim === 'soft') {
        c.wordEls.forEach((w, i) => {
          const p = clamp((local - i * (c.stagger ?? DEFAULTS.soft.stagger)) / 0.9);
          const e = eOutCubic(p);
          w.el.style.opacity = String(e);
          w.el.style.transform = `translateY(${(1 - e) * 18}px)`;
          w.el.style.filter = p < 1 ? `blur(${(1 - e) * 8}px)` : 'none';
        });
        continue;
      }

      if (anim === 'track') {
        const p = eOutCubic(clamp(local / 1.8));
        el.style.letterSpacing = `${(1 - p) * 0.6 + (c.ls ?? 0)}em`;
        el.style.opacity = String(p * (1 - outE));
        continue;
      }

      if (anim === 'type') {
        let last = null;
        let done = true;
        for (const ce of c.charEls) {
          const on = t >= ce.data.t;
          ce.el.style.opacity = on ? '1' : '0';
          ce.el.classList.toggle('hot', on && t - ce.data.t < 0.07);
          ce.el.classList.remove('cur');
          if (on) last = ce;
          else done = false;
        }
        const blinkOn = !done || Math.floor(t * 3.2) % 2 === 0;
        if (last && blinkOn && !c.noCaret) last.el.classList.add('cur');
        continue;
      }

      if (anim === 'scramble') {
        for (const ce of c.charEls) {
          const start = c.in + ce.data.k * 0.012;
          const resolved = t >= ce.data.t;
          if (t < start) {
            ce.el.style.opacity = '0';
            continue;
          }
          ce.el.style.opacity = '1';
          if (resolved || ce.ch === ' ') {
            ce.el.textContent = ce.ch;
            ce.el.classList.remove('scr');
            ce.el.classList.toggle('hot', t - ce.data.t < 0.08);
          } else {
            ce.el.textContent = GLYPHS[Math.floor(hash(ce.data.k * 13 + Math.floor(t * 24)) * GLYPHS.length)];
            ce.el.classList.add('scr');
          }
        }
        continue;
      }

      if (anim === 'slam') {
        c.wordEls.forEach((w, i) => {
          const wt = c.in + i * (c.stagger ?? DEFAULTS.slam.stagger);
          const p = clamp((t - wt) / 0.3);
          const e = eOutBack(p);
          w.el.style.opacity = String(clamp(p * 3));
          const g = t - wt - 0.3; // glitch window right after landing
          const glitch = g > -0.05 && g < 0.22 && Math.floor(t * 30) % 2 === 0;
          const jx = glitch ? (hash(i * 7 + Math.floor(t * 30)) - 0.5) * 18 : 0;
          w.el.style.transform = `translateX(${jx}px) scale(${2.4 - 1.4 * e})`;
          w.el.style.filter = p < 1 ? `blur(${(1 - p) * 12}px)` : 'none';
          w.el.style.textShadow = glitch ? '-6px 0 rgba(255,40,120,.85), 6px 0 rgba(80,255,220,.85)' : '';
        });
        continue;
      }

      // chars: per-letter rise
      for (const ce of c.charEls) {
        const p = clamp((t - ce.data.t) / 0.5);
        const e = eOutExpo(p);
        ce.el.style.opacity = String(clamp(p * 2.5));
        ce.el.style.transform = `translateY(${(1 - e) * 0.9}em) rotate(${(1 - e) * 12}deg)`;
        ce.el.style.filter = p < 1 ? `blur(${(1 - e) * 6}px)` : 'none';
      }
      c.wordEls.forEach((w) => {
        const lastChar = c.charEls.filter((ce) => ce.el.parentElement === w.el).pop();
        w.outer.style.overflow = lastChar && t - lastChar.data.t < 0.5 ? 'hidden' : 'visible';
      });
    }
  }
}
