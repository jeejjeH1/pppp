// DOM typography layer, animated as a pure function of time.
// Markup in cue text: *word* -> pink/purple gradient, _word_ -> mint, | -> line break.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const eOutBack = (x) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

function wordsHTML(text) {
  return text
    .split('|')
    .map((line) =>
      line
        .split(' ')
        .filter(Boolean)
        .map((w) => {
          let cls = 'w';
          if (/^\*.*\*[.,?!—]*$/.test(w)) {
            cls += ' grad';
            w = w.replace(/\*/g, '');
          } else if (/^_.*_[.,?!—]*$/.test(w)) {
            cls += ' mint';
            w = w.replace(/_/g, '');
          }
          return `<span class="${cls}"><span class="wi">${w}</span></span>`;
        })
        .join(' '),
    )
    .join('<br>');
}

export class Overlay {
  constructor(root, cues) {
    this.cues = cues.map((c) => {
      const el = document.createElement('div');
      el.className = `cue ${c.cls || ''}`;
      Object.assign(el.style, c.style || {});
      if (c.html) el.innerHTML = c.html;
      else if (c.type === 'type') el.innerHTML = `<span class="typed"></span><span class="caret">_</span>`;
      else el.innerHTML = wordsHTML(c.text);
      root.appendChild(el);
      return { ...c, el, words: [...el.querySelectorAll('.wi')], chips: [...el.querySelectorAll('.chip')] };
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
      el.style.filter = outE > 0 ? `blur(${outE * 14}px)` : 'none';
      el.style.translate = `0 ${-outE * 40}px`;

      const local = t - c.in;
      const style = c.anim || 'rise';
      if (c.type === 'type') {
        const n = Math.floor(clamp(local / (c.dur || 1.2)) * c.text.length);
        el.querySelector('.typed').textContent = c.text.slice(0, n);
        el.querySelector('.caret').style.opacity = Math.floor(t * 4) % 2 ? '1' : '0';
        continue;
      }
      if (style === 'track') {
        const p = eOutExpo(clamp(local / 1.2));
        el.style.letterSpacing = `${(1 - p) * 0.6 + (c.ls ?? 0)}em`;
        el.style.opacity = String(p * (1 - outE));
        continue;
      }
      if (c.chips.length) {
        c.chips.forEach((ch, i) => {
          const p = clamp((local - i * (c.stagger ?? 0.22)) / 0.45);
          const e = eOutBack(p);
          ch.style.opacity = String(clamp(p * 2));
          ch.style.transform = `translateY(${(1 - e) * 40}px) scale(${0.7 + 0.3 * e})`;
        });
        continue;
      }
      const stagger = c.stagger ?? 0.07;
      c.words.forEach((w, i) => {
        const p = clamp((local - i * stagger) / (style === 'slam' ? 0.32 : 0.55));
        w.parentElement.style.overflow = p < 1 && style !== 'slam' ? 'hidden' : 'visible';
        if (style === 'slam') {
          const e = eOutBack(p);
          w.style.opacity = String(clamp(p * 3));
          w.style.transform = `scale(${2.2 - 1.2 * e}) translateY(${(1 - e) * -20}px)`;
          w.style.filter = p < 1 ? `blur(${(1 - p) * 10}px)` : 'none';
        } else {
          const e = eOutExpo(p);
          w.style.opacity = String(clamp(p * 2.5));
          w.style.transform = `translateY(${(1 - e) * 110}%) rotate(${(1 - e) * 6}deg)`;
          w.style.filter = p < 1 ? `blur(${(1 - e) * 8}px)` : 'none';
        }
      });
    }
  }
}
