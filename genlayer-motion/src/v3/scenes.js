// The storyboard. Each scene: [a, b) window in seconds, build(root) once, update(t, lt) per frame.
// All key moments are pinned to narration word onsets via ctx.wt(lineId, word).
import * as THREE from 'three';
import {
  W, H, COL, clamp, lerp, prog, E, hash, noise1, el, css, canvas, split, rise, riseAt, scramble, vis, fadeEl, roundRect, cube, drawHalftone,
} from './lib.js';

const BLUE = COL.blue;

/** dotted background grid like genlayer.com */
function dots(g, { color = 'rgba(0,0,0,0.13)', step = 40, r = 1.6, ox = 0, oy = 0, mask = null } = {}) {
  g.fillStyle = color;
  g.beginPath();
  for (let y = ((oy % step) + step) % step; y < H; y += step) {
    for (let x = ((ox % step) + step) % step; x < W; x += step) {
      const m = mask ? mask(x, y) : 1;
      if (m <= 0.02) continue;
      const rr = r * m;
      g.moveTo(x + rr, y);
      g.arc(x, y, rr, 0, Math.PI * 2);
    }
  }
  g.fill();
}

function textBlock(parent, cls, text, x, y, extra = {}) {
  const box = el('div', `abs ${cls}`, parent);
  css(box, { left: `${x}px`, top: `${y}px`, ...extra });
  const s = split(box, text);
  return { box, ...s };
}

/** stack pose helper: rise-in of layers, camera orbit */
function poseStack(gl, t, { built = 1, top = 1, x = 0, y = 0, yaw = 0.785, el = 0.56, dist = 26, fov = 18, spread = 0, glow = 0 }) {
  const { stack, layers, stackCam, stackScene } = gl;
  gl.shot = 'stack';
  stack.position.set(x, y, 0);
  stack.rotation.y = yaw;
  layers.forEach((L, i) => {
    const isTop = i === layers.length - 1;
    const p = isTop ? top : clamp(built * 1.6 - i * 0.3);
    const e = E.outExpo(p);
    const home = L.userData.home - (isTop ? 0 : spread * (3 - i));
    L.position.y = isTop ? lerp(home + 7, home + spread * 1.2, E.out5(p)) : lerp(home - 5, home, e);
    L.visible = p > 0.001;
    if (L.userData.mat) L.userData.mat.opacity = 0.97 * clamp(p * 3);
  });
  stackCam.fov = fov;
  stackCam.updateProjectionMatrix();
  stackCam.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
  stackCam.lookAt(0, -0.9, 0);
  stackScene.userData.rings.rotation.y = t * 0.05;
  stackScene.userData.rings.visible = built > 0.2;
  stackScene.userData.rings.position.x = x;
  stackScene.userData.shadow.position.x = x;
  stackScene.userData.shadow.material.opacity = clamp(built);
}

export function buildScenes(ctx, DURATION) {
  const { s, e, wt } = ctx;
  const S = [];
  const add = (o) => S.push(o);

  // =====================================================================================
  // 1. INTRO — particles converge, chrome mark forms, lockup, AI × WEB × BLOCKCHAIN
  // =====================================================================================
  {
    const tB = s('brand');
    const tT = s('tagline');
    const tAI = wt('tagline', 'ai');
    const tWeb = wt('tagline', 'web');
    const tBC = wt('tagline', 'blockchain');
    const tTog = wt('tagline', 'together');
    let cv, g, word, kick, chips, merge;
    const P = Array.from({ length: 900 }, (_, i) => ({
      a: hash(i * 3.1) * Math.PI * 2,
      r: 700 + hash(i * 7.7) * 1100,
      d: 0.35 + hash(i * 1.3) * 0.65,
      spin: 1.2 + hash(i * 9.1) * 2.2,
      sz: 0.6 + hash(i * 4.4) * 1.8,
    }));
    add({
      id: 'intro', a: 0, b: s('rules') - 0.25, dark: true, inDur: 0.01, inScale: 1, inSfx: 'none',
      build(root) {
        [cv, g] = canvas(root);
        word = textBlock(root, 'h0 white', 'GenLayer', 700, 382, { fontSize: '205px' });
        kick = textBlock(root, 'mono', 'Intelligent Contracts', 710, 610, { color: '#8a86ff', fontSize: '26px', letterSpacing: '0.42em' });
        chips = ['AI', 'The Web', 'Blockchain'].map((t, i) => {
          const c = el('div', 'chip dk', root, t);
          return c;
        });
        merge = el('div', 'abs', root);
        css(merge, { left: '0', top: '0', height: '3px', background: BLUE, boxShadow: `0 0 24px ${BLUE}` });
        ctx.sfx(0.15, 'riser', 1);
        ctx.sfx(tB, 'impact', 1.2);
        ctx.sfx(tAI, 'tick', 0.8);
        ctx.sfx(tWeb, 'tick', 0.8);
        ctx.sfx(tBC, 'tick', 0.8);
        ctx.sfx(tTog, 'chime', 1);
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        // dotted grid revealed by an expanding wave
        const front = E.out3(prog(t, 0.2, tB + 0.6)) * 1500;
        dots(g, {
          color: 'rgba(120,115,255,0.55)',
          step: 44,
          r: 1.5,
          mask: (x, y) => {
            const d = Math.hypot(x - 960, y - 540);
            const inside = d < front ? 0.35 : 0;
            const ring = Math.exp(-Math.pow((d - front) / 60, 2)) * 1.6;
            return Math.min(1.8, inside + ring) * (1 - 0.6 * prog(t, tT, 3));
          },
        });
        // particles spiral into the core, then burst
        const pc = prog(t, 0, tB);
        for (const p of P) {
          let x;
          let y;
          let alpha;
          if (t < tB) {
            const q = clamp((pc - (1 - p.d) * 0.6) / (0.4 + p.d * 0.6));
            const r = p.r * (1 - E.in3(q));
            const a = p.a + p.spin * E.in2(q) * 1.5;
            x = 960 + Math.cos(a) * r;
            y = 540 + Math.sin(a) * r * 0.62;
            alpha = q * 0.9;
            const tail = 12 + 60 * E.in3(q);
            g.strokeStyle = `rgba(150,140,255,${alpha})`;
            g.lineWidth = p.sz;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + Math.cos(a + 1.57) * tail * 0.3 + (960 - x) * -0.04, y + Math.sin(a + 1.57) * tail * 0.3 + (540 - y) * -0.04);
            g.stroke();
          } else {
            const q = t - tB;
            const r = (40 + q * (300 + p.r * 0.5)) * (0.4 + p.d);
            x = 960 + Math.cos(p.a) * r;
            y = 540 + Math.sin(p.a) * r * 0.62;
            alpha = Math.max(0, 1 - q / (0.8 + p.d * 1.2));
            if (alpha <= 0) continue;
            g.fillStyle = `rgba(190,185,255,${alpha})`;
            g.fillRect(x, y, p.sz * 1.4, p.sz * 1.4);
          }
        }
        // shockwave ring
        if (t > tB && t < tB + 1.4) {
          const q = (t - tB) / 1.4;
          g.strokeStyle = `rgba(160,150,255,${(1 - q) * 0.8})`;
          g.lineWidth = 3 * (1 - q) + 0.5;
          g.beginPath();
          g.ellipse(960, 540, 60 + E.out3(q) * 1100, (60 + E.out3(q) * 1100) * 0.62, 0, 0, Math.PI * 2);
          g.stroke();
        }

        // 3D mark
        const gl = ctx.gl;
        const asm = prog(t, tB - 1.25, 1.25);
        if (t > tB - 1.3) {
          gl.shot = 'logo';
          const lock = E.inOut5(prog(t, tT - 0.35, 1.1));
          gl.logo.children.forEach((m) => {
            const i = m.userData.i;
            const q = E.out5(asm);
            const dir = [[-1, 0.4], [1, 0.4], [0, -1]][i];
            m.position.set(m.userData.home.x + dir[0] * 6 * (1 - q), m.userData.home.y + dir[1] * 5 * (1 - q), -14 * (1 - q));
            m.rotation.set((1 - q) * 2.4 * dir[1], (1 - q) * 3 * dir[0], (1 - q) * 1.5);
          });
          const pulse = t > tB ? Math.exp(-(t - tB) * 6) * 0.08 : 0;
          const sc = lerp(1, 0.44, lock) * (1 + pulse);
          gl.logo.scale.setScalar(sc);
          gl.logo.position.set(lerp(0, -2.1, lock), lerp(0, 0.38, lock), 0);
          gl.logo.rotation.y = lerp(-0.5 + asm * 0.4, 0, lock) + Math.sin(t * 0.7) * 0.12 * (1 - lock * 0.6);
          gl.logo.rotation.x = Math.sin(t * 0.5) * 0.06;
          gl.logoCam.position.set(0, 0, lerp(11, 9, E.out3(prog(t, tB - 1.3, 3))));
          gl.logoCam.lookAt(0, 0, 0);
          const sw = gl.logoScene.userData.sweep;
          const sp = prog(t, tB - 0.1, 1.6);
          sw.intensity = sp > 0 && sp < 1 ? 90 * Math.sin(sp * Math.PI) : 0;
          sw.position.set(lerp(-5, 5, sp), 1.5, 3);
        }
        // impact flash + flare + letterbox
        if (t >= tB) {
          const q = t - tB;
          ctx.flashK = Math.exp(-q * 7) * 0.85;
          ctx.flare(960, 540, Math.exp(-q * 2.2) * 1.2);
          ctx.shake = Math.exp(-q * 5) * 1.2;
        } else if (t > tB - 1.3) {
          ctx.flare(960, 540, prog(t, tB - 1.3, 1.3) * 0.5);
        }
        ctx.bars = 1 - E.inOut3(prog(t, tB + 0.3, 1.2));

        // wordmark lockup
        const wp = prog(t, tT - 0.05, 0.01);
        rise(word.chars, t, tT + 0.25, { st: 0.045, d: 0.8, y: 0.3, blur: 18 });
        word.box.style.display = wp > 0 ? 'block' : 'none';
        scramble(kick.chars, t, tT + 0.75, { st: 0.03 });
        // tagline chips
        const cx = [560, 960, 1360];
        const times = [tAI, tWeb, tBC];
        chips.forEach((c, i) => {
          const p = E.out5(prog(t, times[i] - 0.05, 0.5));
          const m = E.inOut5(prog(t, tTog - 0.1, 0.6));
          const x = lerp(cx[i], 960, m);
          css(c, {
            left: `${x}px`, top: '760px', opacity: p * (1 - m),
            transform: `translate(-50%, -50%) translateY(${(1 - p) * 40}px) scale(${1 - m * 0.4})`,
            filter: p < 1 ? `blur(${(1 - p) * 10}px)` : 'none',
          });
        });
        const m = E.out5(prog(t, tTog + 0.3, 0.9));
        css(merge, { left: `${960 - 500 * m}px`, top: '758px', width: `${1000 * m}px`, opacity: m * (1 - prog(t, tTog + 1.6, 0.5)) });
        if (t > tTog + 0.3 && t < tTog + 1.6) ctx.flare(960, 759, 0.6 * Math.exp(-(t - tTog - 0.3) * 2));
      },
    });
  }

  // =====================================================================================
  // 2. RIGID RULES → the world is changing (bricks shatter into the live network)
  // =====================================================================================
  {
    const a = s('rules') - 0.25;
    const tW = s('world');
    const tBreak = wt('world', 'real');
    const tChange = wt('world', 'changing');
    let g, kick, head, head2, code, codeLines;
    const bricks = [];
    {
      let y = 170;
      for (let r = 0; r < 9; r++) {
        let x = 1030 + (r % 2) * 40 - 40;
        while (x < 1800) {
          const w = [100, 140, 180, 220][Math.floor(hash(r * 17 + x) * 4)];
          const ww = Math.min(w, 1800 - x);
          if (ww > 40) bricks.push({ x, y, w: ww, h: 72, i: bricks.length });
          x += w;
        }
        y += 72;
      }
      bricks.forEach((b) => {
        b.order = hash(b.i * 5.3);
        b.vx = (b.x + b.w / 2 - 1410) * (0.6 + hash(b.i) * 1.2) + (hash(b.i * 2.2) - 0.5) * 300;
        b.vy = (b.y + b.h / 2 - 500) * (0.6 + hash(b.i * 3) * 1.2) + (hash(b.i * 4.4) - 0.5) * 300;
        b.vr = (hash(b.i * 6.6) - 0.5) * 4;
      });
      const fillOrder = [...bricks].sort((p, q) => p.order - q.order);
      fillOrder.forEach((b, k) => (b.fillAt = k));
    }
    const nodes = Array.from({ length: 16 }, (_, i) => ({ x: 980 + hash(i * 3.3) * 860, y: 150 + hash(i * 8.1) * 700, s: i }));
    add({
      id: 'rigid', a, b: s('prices') - 0.12, dark: false,
      build(root) {
        [, g] = canvas(root);
        kick = textBlock(root, 'mono', '[01] — Traditional smart contracts', 140, 196, { color: BLUE });
        head = textBlock(root, 'h1 ink', 'Execute|predefined *rules.*', 134, 250);
        head2 = textBlock(root, 'h1 ink', 'The real world|is *constantly*|*changing.*', 134, 250);
        code = el('div', 'card dk', root);
        css(code, { left: '140px', top: '590px', width: '700px', height: '230px', padding: '34px 40px', fontFamily: 'Geist Mono', fontSize: '28px', lineHeight: '1.6', color: '#cfcfcf', whiteSpace: 'pre' });
        codeLines = ['<span style="color:#7a72ff">if</span> (price &gt; 3000) {', '    release(funds);', '} <span style="color:#7a72ff">else</span> { revert(); }'].map((h) => el('div', null, code, h));
        ctx.sfx(tBreak, 'shatter', 1.1);
        ctx.sfx(tChange, 'swell', 0.8);
        bricks.forEach((b) => b.fillAt * 0.11 + a + 0.7 < tBreak - 0.1 && b.fillAt % 3 === 0 && ctx.sfx(a + 0.7 + b.fillAt * 0.11, 'clack', 0.35));
      },
      update(t, lt, _c, dur) {
        g.clearRect(0, 0, W, H);
        dots(g, { step: 40, r: 1.5 });
        scramble(kick.chars, t, a + 0.25, { st: 0.02 });
        const vOut = 1 - prog(t, tW - 0.2, 0.35);
        rise(head.chars, t, a + 0.35, { st: 0.022 });
        fadeEl(head.box, vOut, { blur: 16 });
        rise(head2.chars, t, tW + 0.05, { st: 0.025 });
        head2.box.style.display = t > tW - 0.1 ? 'block' : 'none';
        // code card
        const cp = E.out5(prog(t, a + 0.9, 0.7));
        css(code, { opacity: cp * vOut, transform: `translateY(${(1 - cp) * 40}px)` });
        codeLines.forEach((l, i) => (l.style.opacity = prog(t, a + 1.1 + i * 0.35, 0.2)));

        // bricks: mechanical fill, then zero-g shatter
        const br = t - tBreak;
        g.lineWidth = 3;
        for (const b of bricks) {
          const filled = t > a + 0.7 + b.fillAt * 0.11;
          const isBlue = filled && b.fillAt % 3 !== 1;
          let x = b.x;
          let y = b.y;
          let rot = 0;
          let alpha = E.out3(prog(t, a + 0.1 + b.order * 0.5, 0.4));
          if (br > 0) {
            const k = E.out3(clamp(br / 2.2)) * 2.2 + br * 0.15;
            x += b.vx * k * 0.55;
            y += b.vy * k * 0.55;
            rot = b.vr * k * 0.5;
            alpha *= 1 - prog(br, 0.6, 1.2);
          }
          if (alpha <= 0.01) continue;
          g.save();
          g.globalAlpha = alpha;
          g.translate(x + b.w / 2, y + b.h / 2);
          g.rotate(rot);
          g.fillStyle = isBlue ? BLUE : '#fff';
          g.strokeStyle = '#111';
          g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
          g.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
          g.restore();
        }
        if (br > 0 && br < 0.6) ctx.shake = (1 - br / 0.6) * 0.8;
        // the live network (site's dots + dashed links) takes over
        const np = E.out3(prog(t, tBreak + 0.2, 1));
        if (np > 0) {
          const pts = nodes.map((n, i) => [n.x + noise1(t * 0.7, i) * 120, n.y + noise1(t * 0.6, i + 40) * 90]);
          g.setLineDash([7, 7]);
          g.strokeStyle = `rgba(20,20,20,${0.55 * np})`;
          g.lineWidth = 1.5;
          pts.forEach((p, i) => {
            const near = pts.map((q, j) => [Math.hypot(q[0] - p[0], q[1] - p[1]), j]).sort((x, y) => x[0] - y[0]);
            for (const [, j] of near.slice(1, 3)) {
              if (j < i) continue;
              g.beginPath();
              g.moveTo(p[0], p[1]);
              g.lineTo(pts[j][0], pts[j][1]);
              g.stroke();
            }
          });
          g.setLineDash([]);
          pts.forEach((p, i) => {
            const q = E.outBack(prog(t, tBreak + 0.2 + i * 0.05, 0.5));
            g.fillStyle = BLUE;
            g.beginPath();
            g.arc(p[0], p[1], 15 * q, 0, Math.PI * 2);
            g.fill();
          });
        }
      },
    });
  }

  // =====================================================================================
  // 3. MONTAGE — prices, breaking news, announcements, then the wall of information
  // =====================================================================================
  {
    const a = s('prices') - 0.12;
    const tN = s('news');
    const tA = s('announce');
    const tI = s('info');
    const tSec = wt('info', 'every');
    let cards, priceNum, priceChg, chartG, clock, wall, wallItems, title, counter, liveDot;
    add({
      id: 'montage', a, b: s('problem') - 0.2, dark: false, inScale: 1.12,
      build(root) {
        // three hero cards
        cards = [0, 1, 2].map((i) => {
          const c = el('div', `card${i === 1 ? ' dk' : ''}`, root);
          css(c, { left: '210px', top: '120px', width: '1500px', height: '760px' });
          return c;
        });
        // prices
        el('div', 'abs mono', cards[0], 'Prices fluctuate').style.cssText += 'left:64px;top:60px;color:#1a0dff';
        priceNum = el('div', 'abs h0 ink', cards[0], '$3,412.08');
        css(priceNum, { left: '58px', top: '110px', fontSize: '150px', fontVariantNumeric: 'tabular-nums' });
        priceChg = el('div', 'abs mono', cards[0], '+2.41%');
        css(priceChg, { left: '66px', top: '280px', fontSize: '34px', letterSpacing: '0.08em' });
        const [cc, cg] = canvas(cards[0], 1500, 760);
        chartG = cg;
        cc.style.width = '1500px';
        cc.style.height = '760px';
        // news
        liveDot = el('div', 'abs mono', cards[1], '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#ff3b30;margin-right:16px;vertical-align:1px"></span>Breaking · Live');
        css(liveDot, { left: '64px', top: '60px', color: '#ff3b30' });
        clock = el('div', 'abs mono', cards[1], '');
        css(clock, { right: '64px', top: '60px', color: '#777' });
        const nh = el('div', 'abs h1 white', cards[1], 'Breaking news<br>emerges.');
        css(nh, { left: '58px', top: '200px', fontSize: '128px' });
        for (let i = 0; i < 4; i++) {
          const b = el('div', 'abs', cards[1]);
          css(b, { left: '64px', top: `${500 + i * 46}px`, height: '18px', width: `${[1180, 1040, 1300, 760][i]}px`, background: '#222', borderRadius: '9px' });
        }
        // announcement document
        css(cards[2], { background: '#fff', border: '2px solid #e2e2e2', boxShadow: '0 40px 120px rgba(0,0,0,.12)' });
        el('div', 'abs mono', cards[2], 'Press release · Official').style.cssText += 'left:64px;top:60px;color:#1a0dff';
        const ah = el('div', 'abs h1 ink', cards[2], 'Companies publish<br>announcements.');
        css(ah, { left: '58px', top: '150px', fontSize: '110px' });
        for (let i = 0; i < 5; i++) {
          const b = el('div', 'abs', cards[2]);
          css(b, { left: '64px', top: `${440 + i * 46}px`, height: '18px', width: `${[1300, 1220, 1340, 980, 600][i]}px`, background: '#ececec', borderRadius: '9px' });
        }
        const st = el('div', 'stamp', cards[2], 'Published');
        css(st, { right: '80px', bottom: '70px', color: BLUE, transform: 'rotate(-7deg)' });
        // wall of information
        wall = el('div', 'abs', root);
        css(wall, { left: '0', top: '0', width: '1920px', height: '1080px', perspective: '1600px' });
        const plane = el('div', 'abs', wall);
        css(plane, { left: '-500px', top: '-900px', width: '2900px', height: '3200px', transformOrigin: '50% 50%', transform: 'rotateX(48deg) rotateZ(-14deg)' });
        wallItems = [];
        for (let i = 0; i < 70; i++) {
          const col = i % 10;
          const row = Math.floor(i / 10);
          const kind = Math.floor(hash(i * 2.7) * 4);
          const c = el('div', `card${kind === 1 ? ' dk' : ''}`, plane);
          css(c, { left: `${col * 290}px`, top: `${row * 230}px`, width: '260px', height: '200px', background: kind === 1 ? '#0b0b0b' : kind === 3 ? BLUE : '#f2f2f2', borderRadius: '18px' });
          const lab = ['PRICE', 'NEWS', 'DOC.PDF', 'WEB'][kind];
          el('div', 'abs mono', c, lab).style.cssText += `left:20px;top:18px;font-size:14px;color:${kind === 1 ? '#ff3b30' : kind === 3 ? '#fff' : '#1a0dff'}`;
          for (let k = 0; k < 3; k++) {
            const b = el('div', 'abs', c);
            css(b, { left: '20px', top: `${70 + k * 30}px`, height: '10px', width: `${120 + hash(i * 9 + k) * 110}px`, borderRadius: '5px', background: kind === 1 ? '#2a2a2a' : kind === 3 ? 'rgba(255,255,255,.4)' : '#dcdcdc' });
          }
          wallItems.push({ c, i, row, col });
        }
        wall.userData = { plane };
        title = textBlock(root, 'h1 ink', 'Information appears|*every* *second.*', 0, 300, { width: '1920px', textAlign: 'center', fontSize: '128px', textShadow: '0 0 60px #fff, 0 0 30px #fff' });
        counter = el('div', 'abs mono', root, '');
        css(counter, { left: '0', width: '1920px', top: '620px', textAlign: 'center', color: BLUE, fontSize: '30px', textShadow: '0 0 20px #fff' });
        ctx.sfx(tN, 'whip', 1);
        ctx.sfx(tN + 0.1, 'alert', 0.7);
        ctx.sfx(tA, 'whip', 1);
        ctx.sfx(tA + 0.25, 'stamp', 0.8);
        ctx.sfx(tI - 0.1, 'whoosh', 1.2);
        ctx.sfx(tSec, 'impact', 0.8);
      },
      update(t, lt) {
        // whip-pan between the three hero cards
        const seg = [a, tN - 0.12, tA - 0.12, tI - 0.15];
        cards.forEach((c, i) => {
          const pin = E.inOut5(prog(t, seg[i] - 0.05, 0.32));
          const pout = E.inOut5(prog(t, seg[i + 1] - 0.05, 0.32));
          const x = (1 - pin) * 1900 - pout * 1900;
          const blur = Math.abs(Math.sin(pin * Math.PI)) * 30 + Math.abs(Math.sin(pout * Math.PI)) * 30;
          const z = 1 + 0.035 * prog(t, seg[i], 1.6);
          css(c, { transform: `translateX(${x}px) scale(${i === 0 && t < seg[0] + 0.4 ? z : z})`, filter: blur > 0.5 ? `blur(${blur}px)` : 'none', display: pin > 0 && pout < 1 ? 'block' : 'none' });
        });
        // price ticker
        const v = 3412.08 + noise1(t * 3, 1) * 60 + noise1(t * 11, 2) * 9;
        priceNum.textContent = `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const chg = noise1(t * 2.3, 9) * 3.1;
        priceChg.textContent = `${chg >= 0 ? '▲ +' : '▼ '}${chg.toFixed(2)}%`;
        priceChg.style.color = chg >= 0 ? '#00b34f' : COL.red;
        chartG.clearRect(0, 0, 1500, 760);
        const dp = E.out3(prog(t, a + 0.1, 1.3));
        const N = 120;
        const pts = [];
        for (let i = 0; i <= N * dp; i++) {
          const x = 60 + (i / N) * 1380;
          const y = 520 - noise1(i * 0.18 + t * 0.4, 3) * 120 - noise1(i * 0.9, 4) * 30 - (i / N) * 90;
          pts.push([x, y]);
        }
        if (pts.length > 1) {
          const gr = chartG.createLinearGradient(0, 300, 0, 720);
          gr.addColorStop(0, 'rgba(26,13,255,0.22)');
          gr.addColorStop(1, 'rgba(26,13,255,0)');
          chartG.beginPath();
          pts.forEach(([x, y], i) => (i ? chartG.lineTo(x, y) : chartG.moveTo(x, y)));
          chartG.lineTo(pts[pts.length - 1][0], 720);
          chartG.lineTo(60, 720);
          chartG.fillStyle = gr;
          chartG.fill();
          chartG.beginPath();
          pts.forEach(([x, y], i) => (i ? chartG.lineTo(x, y) : chartG.moveTo(x, y)));
          chartG.strokeStyle = BLUE;
          chartG.lineWidth = 5;
          chartG.lineJoin = 'round';
          chartG.stroke();
          const [lx, ly] = pts[pts.length - 1];
          chartG.fillStyle = BLUE;
          chartG.beginPath();
          chartG.arc(lx, ly, 12, 0, Math.PI * 2);
          chartG.fill();
          chartG.strokeStyle = 'rgba(26,13,255,.3)';
          chartG.lineWidth = 2;
          chartG.beginPath();
          chartG.arc(lx, ly, 12 + ((t * 40) % 30), 0, Math.PI * 2);
          chartG.stroke();
        }
        // news clock + blinking live dot
        const sec = Math.floor(t * 1) % 60;
        clock.textContent = `12:49:${String(sec).padStart(2, '0')} UTC`;
        liveDot.firstChild.style.opacity = Math.floor(t * 3) % 2 ? 0.25 : 1;
        // wall
        const wp = E.out5(prog(t, tI - 0.15, 0.9));
        wall.style.display = wp > 0 ? 'block' : 'none';
        wall.style.opacity = wp;
        wall.userData.plane.style.transform = `translateY(${-(t - tI) * 60}px) rotateX(${lerp(20, 50, wp)}deg) rotateZ(-14deg) scale(${lerp(2.2, 1, wp)})`;
        wallItems.forEach(({ c, i }) => {
          const on = prog(t, tI + hash(i * 1.9) * 2.5, 0.25);
          c.style.opacity = 0.35 + 0.65 * on;
          c.style.outline = on > 0 && on < 1 ? `4px solid ${BLUE}` : 'none';
        });
        riseAt(title.words, t, [tI + 0.4, tI + 0.6, tSec, tSec + 0.25]);
        const n = Math.floor(Math.max(0, t - tI) * 263117 + 1024);
        counter.textContent = t > tI + 0.8 ? `● ${n.toLocaleString('en-US')} new signals` : '';
        counter.style.opacity = prog(t, tI + 0.8, 0.3);
      },
    });
  }

  // =====================================================================================
  // 4. THE PROBLEM — contracts are blind to webpages, documents, events
  // =====================================================================================
  {
    const a = s('problem') - 0.2;
    const tP = s('problem');
    const tC = s('cannot');
    const hits = [wt('cannot', 'read'), wt('cannot', 'understand'), wt('cannot', 'interpret')];
    let g, big, kick, ins, nos, label;
    add({
      id: 'problem', a, b: s('enter') - 0.12, dark: true, inFlash: 0, inScale: 1.15, inSfx: 'boom',
      build(root) {
        [, g] = canvas(root);
        big = textBlock(root, 'h0 white', "Here's the|~problem.~", 0, 330, { width: '1920px', textAlign: 'center', fontSize: '190px' });
        kick = textBlock(root, 'mono', '[02] — The problem', 140, 150, { color: COL.red });
        ins = ['Webpage', 'Document.pdf', 'Real-world event'].map((tx, i) => {
          const c = el('div', 'chip dk', root, tx);
          css(c, { left: '140px', top: `${300 + i * 170}px`, width: '470px', textAlign: 'left', fontSize: '26px' });
          return c;
        });
        nos = ["✕ Can't read", "✕ Can't understand", "✕ Can't interpret"].map((tx, i) => {
          const c = el('div', 'abs mono', root, tx);
          css(c, { left: '140px', top: `${400 + i * 170}px`, color: COL.red, fontSize: '22px' });
          return c;
        });
        label = el('div', 'abs mono', root, 'Smart contract');
        css(label, { left: '1230px', top: '760px', width: '400px', marginLeft: '-200px', textAlign: 'center', color: '#bbb' });
        hits.forEach((h) => ctx.sfx(h + 0.25, 'deny', 1));
        ctx.sfx(tP + 0.35, 'glitch', 0.8);
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        // part 1: big statement with RGB glitch
        const v1 = 1 - prog(t, tC - 0.3, 0.3);
        big.box.style.display = v1 > 0 ? 'block' : 'none';
        rise(big.chars, t, tP - 0.05, { st: 0.035, d: 0.6, y: 0.3, blur: 20 });
        const gl = t > tP + 0.3 && t < tP + 0.75 ? Math.sin(t * 90) : 0;
        big.box.style.textShadow = gl ? `${gl * 12}px 0 rgba(255,59,48,.85), ${-gl * 12}px 0 rgba(26,13,255,.9)` : 'none';
        fadeEl(big.box, v1, { blur: 20, scale: -0.1 });
        // part 2
        const on = t > tC - 0.3;
        [kick.box, label, ...ins, ...nos].forEach((x) => (x.style.display = on ? 'block' : 'none'));
        if (!on) return;
        scramble(kick.chars, t, tC - 0.2, { st: 0.03 });
        const cx = 1230;
        const cy = 470;
        dots(g, { color: 'rgba(255,255,255,0.08)', step: 44, r: 1.4 });
        // barrier
        const bp = E.out3(prog(t, tC, 0.6));
        let hitK = 0;
        hits.forEach((h) => {
          const q = t - (h + 0.25);
          if (q > 0) hitK = Math.max(hitK, Math.exp(-q * 5));
        });
        g.strokeStyle = `rgba(255,59,48,${0.25 + hitK * 0.75})`;
        g.lineWidth = 3 + hitK * 5;
        g.setLineDash([16, 12]);
        g.beginPath();
        g.ellipse(cx, cy, 260 * bp, 260 * bp, 0, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        if (hitK > 0.05) {
          g.fillStyle = `rgba(255,59,48,${hitK * 0.12})`;
          g.beginPath();
          g.arc(cx, cy, 260, 0, Math.PI * 2);
          g.fill();
        }
        ctx.shake = Math.max(ctx.shake, hitK * 0.6);
        // contract cube
        const cp = E.outBack(prog(t, tC - 0.1, 0.8));
        cube(g, cx, cy, 230 * cp, { yaw: 0.6 + t * 0.25, pitch: 0.55, stroke: '#fff', lw: 2.5, fill: '#0c0c0c', top: '#161616' });
        label.style.opacity = cp;
        // inputs fly at the contract and bounce off the barrier
        ins.forEach((c, i) => {
          const p = E.out5(prog(t, tC + i * 0.15, 0.6));
          const failed = t > hits[i] + 0.25;
          css(c, {
            opacity: p, transform: `translateX(${(1 - p) * -80}px)`,
            borderColor: failed ? 'rgba(255,59,48,.9)' : 'rgba(255,255,255,.35)',
            color: failed ? '#ff8a82' : '#fff',
          });
          const sy = 300 + i * 170 + 42;
          const sx = 610;
          const fp = prog(t, hits[i] - 0.35, 0.6);
          if (fp > 0 && fp < 1) {
            const dist = cx - 260 - sx;
            const k = fp < 0.75 ? E.in2(fp / 0.75) : 1 - E.out3((fp - 0.75) / 0.25) * 0.25;
            const x = sx + dist * k;
            const y = lerp(sy, cy + (i - 1) * 120, k);
            g.strokeStyle = 'rgba(255,255,255,.3)';
            g.setLineDash([6, 8]);
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(sx, sy);
            g.lineTo(x, y);
            g.stroke();
            g.setLineDash([]);
            g.fillStyle = fp < 0.75 ? '#fff' : COL.red;
            g.beginPath();
            g.arc(x, y, 10, 0, Math.PI * 2);
            g.fill();
            if (fp < 0.75) ctx.flare(x, y, 0.35, '200,200,255');
          }
          const q = t - (hits[i] + 0.25);
          if (q > 0 && q < 0.8) {
            // sparks
            for (let k = 0; k < 26; k++) {
              const ang = Math.PI + (hash(k + i * 50) - 0.5) * 2.4;
              const r = E.out3(q / 0.8) * (80 + hash(k * 3 + i) * 160);
              const px = cx - 260 + Math.cos(ang) * r;
              const py = cy + (i - 1) * 120 + Math.sin(ang) * r;
              g.fillStyle = `rgba(255,${90 + k * 4},70,${1 - q / 0.8})`;
              g.fillRect(px, py, 4, 4);
            }
            ctx.flare(cx - 260, cy + (i - 1) * 120, (1 - q / 0.8) * 0.7, '255,70,50');
          }
          const np = E.out5(prog(t, hits[i] + 0.25, 0.4));
          const jitter = q > 0 && q < 0.35 ? (hash(Math.floor(t * 60) + i) - 0.5) * 16 : 0;
          css(nos[i], { opacity: np, transform: `translateX(${jitter}px)` });
        });
      },
    });
  }

  // =====================================================================================
  // 5. GENLAYER COMES IN — protocol stack rises; Intelligent Contract code
  // =====================================================================================
  {
    const a = s('enter') - 0.12;
    const tE = s('enter');
    const tG = wt('enter', 'genlayer');
    const tIC = s('ic');
    const tAI = wt('ic', 'ai-powered');
    const tInt = wt('ic', 'interpretation');
    const tReal = wt('ic', 'real-world');
    let g, h1, kick, codeCard, codeLines, flow, flowLinks;
    const CODE = [
      ['<span class="k">class</span> <span class="f">EventResolver</span>(gl.Contract):', 0],
      ['    outcome: str', 0],
      ['', 0],
      ['    <span class="d">@gl.public.write</span>', 0],
      ['    <span class="k">def</span> <span class="f">resolve</span>(self, url: str):', 0],
      ['        <span class="k">def</span> <span class="f">judge</span>():', 0],
      ['            page = gl.nondet.web.<span class="h">render</span>(url)', 1],
      ['            <span class="k">return</span> gl.nondet.<span class="h">exec_prompt</span>(', 2],
      ['                <span class="s">f"Did it happen? YES/NO {page}"</span>)', 2],
      ['        self.outcome = gl.eq_principle.<span class="h">strict_eq</span>(judge)', 3],
    ];
    add({
      id: 'enter', a, b: s('why') - 0.25, dark: false, inFlash: 0.7, inScale: 1.2, inSfx: 'braam', inGain: 1.2,
      build(root) {
        [, g] = canvas(root);
        h1 = textBlock(root, 'h1 ink', 'This is where|*GenLayer*|comes in.', 140, 270, { fontSize: '128px' });
        kick = textBlock(root, 'mono', 'Intelligent Contracts', 140, 150, { color: BLUE });
        codeCard = el('div', 'card dk', root);
        css(codeCard, { left: '120px', top: '210px', width: '960px', height: '500px', padding: '74px 44px 0', fontFamily: 'Geist Mono', fontSize: '24px', lineHeight: '1.62', color: '#d8d8d8', whiteSpace: 'pre' });
        const bar = el('div', 'abs', codeCard);
        css(bar, { left: '0', top: '0', right: '0', height: '50px', borderBottom: '1px solid #222', fontSize: '18px', color: '#777', padding: '13px 24px', letterSpacing: '.12em' });
        bar.innerHTML = '<span style="color:#ff5f57">●</span> <span style="color:#febc2e">●</span> <span style="color:#28c840">●</span> &nbsp; event_resolver.py';
        const st = el('style', null, root);
        st.textContent = '.k{color:#8a83ff}.f{color:#fff}.d{color:#00f26b}.s{color:#9a9a9a}.h{color:#fff;background:rgba(26,13,255,.0);border-radius:4px;padding:0 2px}';
        codeLines = CODE.map(([h, grp]) => {
          const d = el('div', null, codeCard);
          d.innerHTML = h || '&nbsp;';
          d.dataset.grp = grp;
          return d;
        });
        flow = ['The web', 'AI interpretation', 'On-chain decision'].map((tx, i) => {
          const c = el('div', `chip${i === 2 ? ' solid' : ''}`, root, tx);
          css(c, { top: '770px', fontSize: '24px', padding: '20px 30px' });
          return c;
        });
        flowLinks = [0, 1].map(() => {
          const l = el('div', 'abs', root);
          css(l, { top: '808px', height: '0', borderTop: `3px dashed ${BLUE}` });
          return l;
        });
        ctx.sfx(tG, 'impact', 1.1);
        ctx.sfx(tIC - 0.2, 'whoosh', 0.9);
        ctx.sfx(tAI, 'chime', 0.7);
        ctx.sfx(tInt, 'tick', 0.7);
        ctx.sfx(tReal, 'tick', 0.7);
      },
      update(t, lt, _c, dur) {
        g.clearRect(0, 0, W, H);
        dots(g, { step: 40, r: 1.5 });
        const gl = ctx.gl;
        const toIC = E.inOut5(prog(t, tIC - 0.4, 1.4));
        const built = prog(t, tE - 0.05, 1.3);
        const top = prog(t, tG - 0.45, 0.5);
        poseStack(gl, t, {
          built, top,
          x: lerp(2.4, 4.4, toIC), y: lerp(-0.2, 0.15, toIC),
          yaw: 0.785 + Math.sin(t * 0.25) * 0.12 + (1 - E.out3(prog(t, tE, 4))) * 0.6,
          el: lerp(0.62, 0.5, toIC), dist: lerp(lerp(34, 27, E.out3(prog(t, tE, 3))), 30, toIC),
          spread: lerp(0, 0.18, E.inOut3(prog(t, tAI, 1.2))),
        });
        if (t > tG - 0.05 && t < tG + 0.7) {
          const q = t - (tG - 0.05);
          ctx.shake = Math.exp(-q * 6) * 0.7;
        }
        // headline
        rise(h1.chars, t, tE + 0.05, { st: 0.03, y: 0.4 });
        fadeEl(h1.box, 1 - prog(t, tIC - 0.45, 0.4), { blur: 18 });
        h1.box.style.display = t < tIC ? 'block' : 'none';
        // intelligent contract
        const on = t > tIC - 0.3;
        [kick.box, codeCard, ...flow, ...flowLinks].forEach((x) => (x.style.display = on ? 'block' : 'none'));
        if (!on) return;
        scramble(kick.chars, t, tIC - 0.1, { st: 0.035 });
        const cp = E.out5(prog(t, tIC - 0.1, 0.8));
        css(codeCard, { opacity: cp, transform: `translateY(${(1 - cp) * 60}px) perspective(1600px) rotateY(${(1 - cp) * 12}deg)` });
        const grpT = [tIC + 0.2, tAI - 0.6, tAI, tInt + 0.3];
        codeLines.forEach((l, i) => {
          const grp = +l.dataset.grp;
          const st = grp === 0 ? tIC + 0.25 + i * 0.13 : grpT[grp];
          const p = prog(t, st, 0.25);
          l.style.opacity = p;
          l.style.transform = `translateX(${(1 - E.out3(p)) * -20}px)`;
          const hot = grp > 0 && t > grpT[grp] && t < grpT[grp] + 1.6;
          l.querySelectorAll('.h').forEach((h) => (h.style.background = hot ? 'rgba(26,13,255,.85)' : 'rgba(26,13,255,0)'));
        });
        // flow: web -> AI -> on-chain
        const fx = [120, 470, 880];
        const ft = [tAI - 0.4, tInt - 0.1, tReal + 0.2];
        flow.forEach((c, i) => {
          const p = E.out5(prog(t, ft[i], 0.5));
          css(c, { left: `${fx[i]}px`, opacity: p, transform: `translateY(${(1 - p) * 30}px)` });
        });
        flowLinks.forEach((l, i) => {
          const x0 = [370, 832][i];
          const x1 = [470, 880][i];
          const p = E.out3(prog(t, ft[i + 1] - 0.2, 0.4));
          css(l, { left: `${x0}px`, width: `${(x1 - x0) * p}px` });
        });
      },
    });
  }

  // =====================================================================================
  // 6. WHY IT MATTERS — thinker, then three use-case cards on a dolly track
  // =====================================================================================
  {
    const a = s('why') - 0.25;
    const tW = s('why');
    const tP = s('predict');
    const tIn = s('insure');
    const tAg = s('agent');
    const tHap = wt('predict', 'happened');
    let g, why, imagine, track, cards;
    const mk = (root, i, title, body) => {
      const c = el('div', 'card', root);
      css(c, { left: `${i * 1500}px`, top: '0', width: '1360px', height: '660px', background: '#f4f4f4' });
      el('div', 'abs idx', c, `[0${i + 1}]`).style.cssText += 'left:56px;top:50px';
      const h = el('div', 'abs h2 ink', c, title);
      css(h, { left: '52px', top: '120px', fontSize: '76px' });
      const b = el('div', 'abs body', c, body);
      css(b, { left: '56px', top: '330px', width: '520px' });
      const vis2 = el('div', 'abs', c);
      css(vis2, { left: '640px', top: '50px', width: '670px', height: '560px', background: '#fff', borderRadius: '22px' });
      return { c, vis: vis2 };
    };
    const row = (parent, y, text) => {
      const r = el('div', 'abs', parent);
      css(r, { left: '40px', top: `${y}px`, width: '590px', height: '74px', borderRadius: '14px', border: '2px solid #ececec', fontFamily: 'Geist Mono', fontSize: '22px', letterSpacing: '.06em', padding: '22px 24px', color: '#333' });
      r.innerHTML = `${text}<span class="ok" style="position:absolute;right:22px;top:18px;width:36px;height:36px;border-radius:50%;background:#00c957;color:#fff;text-align:center;line-height:36px;font-size:22px">✓</span>`;
      return r;
    };
    add({
      id: 'why', a, b: s('raw') - 0.2, dark: true, inScale: 1.12,
      build(root) {
        [, g] = canvas(root);
        why = textBlock(root, 'h0 white', 'Why does|this *matter?*', 140, 330, { fontSize: '180px' });
        imagine = textBlock(root, 'mono', 'Imagine a world where…', 280, 110, { color: '#8a86ff' });
        track = el('div', 'abs', root);
        css(track, { left: '280px', top: '190px', width: '5000px', height: '700px' });
        cards = [
          mk(track, 0, 'Prediction<br>market', 'Determines whether an event <b style="color:#0a0a0a">actually happened.</b>'),
          mk(track, 1, 'Smart<br>insurance', 'Evaluates information about <b style="color:#0a0a0a">an incident.</b>'),
          mk(track, 2, 'AI agent<br>payments', 'Assesses a website <b style="color:#0a0a0a">before paying.</b>'),
        ];
        // card 1 visual: sources + YES/NO bars + stamp
        {
          const v = cards[0].vis;
          el('div', 'abs mono', v, 'Market · Did the event happen?').style.cssText += 'left:40px;top:36px;font-size:18px;color:#1a0dff';
          cards[0].rows = ['news-wire.com', 'official-data.gov', 'report.pdf'].map((tx, i) => row(v, 100 + i * 92, tx));
          cards[0].bars = ['YES', 'NO'].map((tx, i) => {
            const b = el('div', 'abs', v);
            css(b, { left: '40px', top: `${400 + i * 62}px`, width: '590px', height: '46px', borderRadius: '10px', background: '#f1f1f1', overflow: 'hidden' });
            const f = el('div', 'abs', b);
            css(f, { left: '0', top: '0', bottom: '0', width: '0', background: i ? '#cfcfcf' : BLUE });
            const l = el('div', 'abs mono', b, tx);
            css(l, { left: '16px', top: '11px', fontSize: '20px', color: i ? '#333' : '#fff', mixBlendMode: i ? 'normal' : 'difference' });
            return f;
          });
          cards[0].stamp = el('div', 'stamp', v, 'Resolved · YES');
          css(cards[0].stamp, { left: '300px', top: '200px', color: '#00b34f', background: 'rgba(255,255,255,.92)' });
        }
        // card 2 visual: incident report being scanned
        {
          const v = cards[1].vis;
          el('div', 'abs mono', v, 'Incident report #4471').style.cssText += 'left:40px;top:36px;font-size:18px;color:#1a0dff';
          for (let i = 0; i < 7; i++) {
            const b = el('div', 'abs', v);
            css(b, { left: '40px', top: `${100 + i * 40}px`, height: '14px', width: `${[560, 500, 590, 420, 540, 480, 300][i]}px`, borderRadius: '7px', background: '#ececec' });
          }
          cards[1].scan = el('div', 'abs', v);
          css(cards[1].scan, { left: '0', width: '670px', height: '4px', background: BLUE, boxShadow: `0 0 30px 6px rgba(26,13,255,.45)` });
          cards[1].ev = ['Photos', 'Weather data', 'Police report'].map((tx, i) => {
            const c = el('div', 'abs mono', v, `✓ ${tx}`);
            css(c, { left: `${40 + i * 205}px`, top: '420px', fontSize: '17px', padding: '12px 14px', border: '2px solid #00c957', borderRadius: '10px', color: '#00994a', whiteSpace: 'nowrap' });
            return c;
          });
          cards[1].stamp = el('div', 'stamp', v, 'Claim valid · Payout');
          css(cards[1].stamp, { left: '150px', top: '190px', color: '#00b34f', background: 'rgba(255,255,255,.92)' });
        }
        // card 3 visual: agent -> website check -> x402 payment
        {
          const v = cards[2].vis;
          const [cv3, g3] = canvas(v, 670, 560);
          cv3.style.width = '670px';
          cv3.style.height = '560px';
          cards[2].g = g3;
          const ag = el('div', 'abs mono', v, 'Agent');
          css(ag, { left: '40px', top: '236px', width: '120px', height: '120px', borderRadius: '50%', background: '#0a0a0a', color: '#fff', textAlign: 'center', lineHeight: '120px', fontSize: '20px' });
          const site = el('div', 'abs', v);
          css(site, { left: '250px', top: '60px', width: '380px', height: '250px', border: '2px solid #e4e4e4', borderRadius: '16px', padding: '20px', fontFamily: 'Geist Mono', fontSize: '18px', color: '#333', lineHeight: '2.1', letterSpacing: '.04em' });
          site.innerHTML = '<div style="color:#1a0dff">vendor.example</div><div class="c1">✓ Domain verified</div><div class="c2">✓ Terms match</div><div class="c3">✓ Delivery confirmed</div>';
          cards[2].checks = [...site.querySelectorAll('.c1,.c2,.c3')];
          cards[2].pay = el('div', 'chip solid', v, 'x402 · 120 USDC');
          css(cards[2].pay, { left: '250px', top: '420px', fontSize: '20px', padding: '18px 26px' });
          cards[2].stamp = el('div', 'stamp', v, 'Payment released');
          css(cards[2].stamp, { left: '160px', top: '330px', color: '#00b34f', background: 'rgba(255,255,255,.92)' });
        }
        ctx.sfx(tP - 0.1, 'whoosh', 0.9);
        ctx.sfx(tIn - 0.15, 'whip', 1);
        ctx.sfx(tAg - 0.15, 'whip', 1);
        ctx.sfx(tHap + 0.3, 'stamp', 1);
        ctx.sfx(e('insure') - 0.2, 'stamp', 1);
        ctx.sfx(e('agent') - 0.1, 'stamp', 1);
        ctx.sfx(wt('agent', 'payment'), 'coin', 0.8);
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        // thinker
        const thV = 1 - E.inOut3(prog(t, tP - 0.3, 0.8)) * 0.85;
        const rev = E.out3(prog(t, a, 1.6));
        drawHalftone(g, ctx.img.thinker, {
          x: 900 + (1 - thV) * 300, y: -40 - lt * 6, h: 1180 + lt * 10, cell: 10, t,
          color: `rgba(40,30,255,${thV})`, reveal: (u, v) => clamp((rev * 1.4 - (1 - v)) * 3),
        });
        // headline
        rise(why.chars, t, tW - 0.05, { st: 0.03, y: 0.3, blur: 20 });
        fadeEl(why.box, 1 - prog(t, tP - 0.35, 0.35), { blur: 20 });
        why.box.style.display = t < tP ? 'block' : 'none';
        const on = t > tP - 0.3;
        track.style.display = on ? 'block' : 'none';
        imagine.box.style.display = on ? 'block' : 'none';
        if (!on) return;
        scramble(imagine.chars, t, tP - 0.1, { st: 0.025 });
        // dolly between cards
        const k1 = E.inOut5(prog(t, tIn - 0.35, 0.6));
        const k2 = E.inOut5(prog(t, tAg - 0.35, 0.6));
        const enter = E.out5(prog(t, tP - 0.3, 0.9));
        const x = -1500 * (k1 + k2) + (1 - enter) * 1700;
        const blur = (Math.sin(k1 * Math.PI) + Math.sin(k2 * Math.PI)) * 24 + (1 - enter) * 20;
        css(track, { transform: `translateX(${x}px)`, filter: blur > 0.5 ? `blur(${blur}px)` : 'none' });
        // card 1
        const c1 = cards[0];
        c1.rows.forEach((r, i) => {
          const p = E.out5(prog(t, tP + 0.5 + i * 0.5, 0.4));
          r.style.opacity = p;
          r.querySelector('.ok').style.transform = `scale(${E.outBack(prog(t, tP + 0.9 + i * 0.5, 0.35))})`;
        });
        const yes = E.out3(prog(t, tP + 2.2, 1.6));
        c1.bars[0].style.width = `${87 * yes}%`;
        c1.bars[1].style.width = `${13 * yes}%`;
        const st1 = E.outBack(prog(t, tHap + 0.3, 0.3));
        css(c1.stamp, { opacity: st1, transform: `rotate(-8deg) scale(${lerp(2.2, 1, st1)})` });
        // card 2
        const c2 = cards[1];
        const sp = prog(t, tIn + 0.3, 2.2);
        css(c2.scan, { top: `${lerp(90, 400, (Math.sin(sp * Math.PI * 2 - 1.57) + 1) / 2)}px`, opacity: sp > 0 && sp < 1 ? 1 : 0 });
        c2.ev.forEach((c, i) => {
          const p = E.outBack(prog(t, tIn + 0.9 + i * 0.6, 0.35));
          css(c, { opacity: clamp(p), transform: `scale(${p})` });
        });
        const st2 = E.outBack(prog(t, e('insure') - 0.2, 0.3));
        css(c2.stamp, { opacity: st2, transform: `rotate(-8deg) scale(${lerp(2.2, 1, st2)})` });
        // card 3
        const c3 = cards[2];
        const g3 = c3.g;
        g3.clearRect(0, 0, 670, 560);
        const lp = E.out3(prog(t, tAg + 0.2, 0.6));
        g3.setLineDash([8, 8]);
        g3.strokeStyle = '#999';
        g3.lineWidth = 2;
        g3.beginPath();
        g3.moveTo(160, 296);
        g3.lineTo(lerp(160, 250, lp), lerp(296, 190, lp));
        g3.stroke();
        const pp = E.out3(prog(t, wt('agent', 'payment') - 0.2, 0.6));
        g3.beginPath();
        g3.moveTo(160, 310);
        g3.lineTo(lerp(160, 250, pp), lerp(310, 455, pp));
        g3.stroke();
        g3.setLineDash([]);
        c3.checks.forEach((c, i) => (c.style.opacity = 0.15 + 0.85 * prog(t, tAg + 0.7 + i * 0.45, 0.25)));
        const pay = E.out5(prog(t, wt('agent', 'payment') - 0.05, 0.5));
        css(c3.pay, { opacity: pay, transform: `translateX(${(1 - pay) * -80}px)` });
        const st3 = E.outBack(prog(t, e('agent') - 0.1, 0.3));
        css(c3.stamp, { opacity: st3, transform: `rotate(-8deg) scale(${lerp(2.2, 1, st3)})` });
      },
    });
  }

  // =====================================================================================
  // 7a. MORE THAN RAW DATA
  // =====================================================================================
  {
    const a = s('raw') - 0.2;
    const tR = s('raw');
    let g, head;
    const cols = Array.from({ length: 64 }, (_, i) => ({ x: i * 30 + 8, sp: 140 + hash(i * 3.3) * 320, off: hash(i * 7.1) * 1000 }));
    add({
      id: 'raw', a, b: s('need') - 0.2, dark: false, inScale: 1.1,
      build(root) {
        [, g] = canvas(root);
        head = textBlock(root, 'h0 ink', 'More than|*raw* *data.*', 0, 340, { width: '1920px', textAlign: 'center', fontSize: '200px' });
        ctx.sfx(wt('raw', 'raw'), 'glitch', 0.6);
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        g.font = '20px "Geist Mono"';
        for (const c of cols) {
          for (let k = 0; k < 40; k++) {
            const y = ((c.off + lt * c.sp + k * 28) % 1200) - 60;
            const ch = '0123456789ABCDEF{}[]<>'[Math.floor(hash(c.x * 3 + k * 17 + Math.floor(lt * 8 + k)) * 22)];
            const d = Math.abs(y - 540) / 540;
            g.fillStyle = k % 9 === 0 ? `rgba(26,13,255,${0.6 - d * 0.3})` : `rgba(0,0,0,${0.16 - d * 0.08})`;
            g.fillText(ch, c.x, y);
          }
        }
        // white halo behind text
        const gr = g.createRadialGradient(960, 520, 100, 960, 520, 820);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.55, 'rgba(255,255,255,.9)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
        rise(head.chars, t, tR - 0.05, { st: 0.035, y: 0.3, blur: 20 });
        // strike through "raw data"
        const sp = E.inOut3(prog(t, e('raw') - 0.2, 0.5));
        if (sp > 0) {
          g.fillStyle = BLUE;
          g.fillRect(560, 640, 800 * sp, 14);
        }
      },
    });
  }

  // =====================================================================================
  // 7b. INTERPRET · EVALUATE · DECIDE
  // =====================================================================================
  {
    const a = s('need') - 0.2;
    const ts = [wt('need', 'interpret'), wt('need', 'evaluate'), wt('need', 'decisions')];
    const words = ['Interpret', 'Evaluate', 'Decide'];
    const descs = ['information', 'evidence', 'on real-world conditions'];
    let g, rows;
    add({
      id: 'need', a, b: s('combine') - 0.2, dark: true, inScale: 1.12,
      build(root) {
        [, g] = canvas(root);
        rows = words.map((w, i) => {
          const r = el('div', 'abs', root);
          css(r, { left: '140px', top: `${190 + i * 220}px` });
          const idx = el('div', 'abs mono', r, `[0${i + 1}]`);
          css(idx, { left: '0', top: '30px', color: '#8a86ff' });
          const hw = el('div', 'abs h1 white', r);
          css(hw, { left: '110px', top: '0', fontSize: '150px', whiteSpace: 'nowrap' });
          const sp = split(hw, w);
          const d = el('div', 'abs mono', r, descs[i]);
          css(d, { left: '118px', top: '168px', color: '#777', whiteSpace: 'nowrap' });
          return { r, hw, sp, d };
        });
        ts.forEach((x) => ctx.sfx(x, 'hit', 0.9));
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        const rev = E.out3(prog(t, a, 2));
        drawHalftone(g, ctx.img.arm, {
          x: 860 - lt * 8, y: 40, h: 1000 + lt * 12, cell: 10, t,
          color: 'rgba(40,30,255,1)', reveal: (u) => clamp((rev * 1.5 - (1 - u)) * 3),
        });
        rows.forEach((r, i) => {
          rise(r.sp.chars, t, ts[i] - 0.08, { st: 0.03, y: 0.35, blur: 18 });
          const cur = t >= ts[i] && (i === 2 || t < ts[i + 1]);
          r.hw.style.color = cur ? '#ffffff' : 'rgba(255,255,255,.35)';
          r.hw.style.textShadow = cur ? '0 0 40px rgba(90,80,255,.8)' : 'none';
          r.d.style.opacity = prog(t, ts[i] + 0.25, 0.3);
          r.r.querySelector('.mono').style.opacity = prog(t, ts[i] - 0.1, 0.2);
          if (t > ts[i] && t < ts[i] + 0.6) ctx.flare(260, 290 + i * 220, (1 - (t - ts[i]) / 0.6) * 0.5);
        });
      },
    });
  }

  // =====================================================================================
  // 8. COMBINE — web + AI + Optimistic Democracy → consensus wheel → appeals to finality
  // =====================================================================================
  {
    const a = s('combine') - 0.2;
    const tC = s('combine');
    const tWeb = wt('combine', 'web');
    const tAI = wt('combine', 'ai');
    const tOD = wt('combine', 'optimistic');
    const tWheel = wt('combine', 'optimistic') + 0.7;
    const tHand = wt('combine', 'traditional') - 0.3;
    let g, kick, chips, ops, pill, wheelLabels, panel, pg, ptitle, pdesc;
    const MODELS = ['Claude', 'GPT', 'Gemini', 'Llama', 'Mistral', 'DeepSeek', 'Qwen'];
    add({
      id: 'combine', a, b: s('course') - 0.2, dark: false,
      build(root) {
        [, g] = canvas(root);
        kick = textBlock(root, 'mono', 'GenLayer combines', 0, 250, { width: '1920px', textAlign: 'center', color: BLUE });
        chips = ['Web access', 'AI', 'Optimistic Democracy'].map((tx, i) => el('div', `chip${i === 2 ? ' solid' : ''}`, root, tx));
        ops = [0, 1].map(() => {
          const o = el('div', 'abs h2 ink', root, '+');
          css(o, { top: '440px' });
          return o;
        });
        pill = el('div', 'pill', root, '<span class="dot"></span><b style="color:#1a0dff;font-weight:500">7</b> of 1,001 Validators Selected');
        css(pill, { left: '960px', top: '872px', transform: 'translateX(-50%)' });
        wheelLabels = MODELS.map((m) => {
          const d = el('div', 'abs mono', root, m);
          css(d, { fontSize: '22px', color: '#111', transform: 'translate(-50%, 0)' });
          return d;
        });
        panel = el('div', 'card dk', root);
        css(panel, { left: '80px', top: '80px', width: '1760px', height: '820px' });
        const [pcv, pgg] = canvas(panel, 1760, 820);
        pcv.style.width = '1760px';
        pcv.style.height = '820px';
        pg = pgg;
        ptitle = el('div', 'abs h2 white', panel, 'Optimistic<br>Democracy');
        css(ptitle, { left: '70px', top: '70px', fontSize: '84px' });
        pdesc = el('div', 'abs body', panel, 'A leader proposes an answer.<br>Validators verify it.<br>Disputes escalate through<br>appeals until finality.');
        css(pdesc, { left: '74px', top: '310px', color: '#8d8d8d' });
        ctx.sfx(tWeb, 'tick', 0.8);
        ctx.sfx(tAI, 'tick', 0.8);
        ctx.sfx(tOD, 'hit', 1);
        ctx.sfx(tWheel, 'chime', 0.9);
        ctx.sfx(tHand - 0.15, 'whoosh', 0.9);
        ctx.sfx(tHand + 1.15, 'tick', 0.8);
        ctx.sfx(tHand + 2.05, 'impact', 0.9);
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        dots(g, { step: 40, r: 1.5 });
        // chips phase
        const chipOut = E.inOut3(prog(t, tWheel - 0.5, 0.5));
        scramble(kick.chars, t, tC - 0.05, { st: 0.03 });
        fadeEl(kick.box, 1 - chipOut);
        const xs = [470, 960, 1450];
        const tt = [tWeb, tAI, tOD];
        chips.forEach((c, i) => {
          const p = E.out5(prog(t, tt[i] - 0.1, 0.5));
          css(c, { left: `${xs[i]}px`, top: '470px', opacity: p * (1 - chipOut), transform: `translate(-50%, -50%) scale(${lerp(0.7, 1, p) * (1 - chipOut * 0.4)}) translateY(${-chipOut * 200}px)`, filter: p < 1 || chipOut > 0 ? `blur(${(1 - p) * 10 + chipOut * 10}px)` : 'none' });
        });
        ops.forEach((o, i) => {
          const p = E.out5(prog(t, tt[i + 1] - 0.2, 0.4));
          css(o, { left: `${[700, 1170][i]}px`, opacity: p * (1 - chipOut) });
        });
        // consensus wheel
        const wv = E.out5(prog(t, tWheel - 0.3, 0.9)) * (1 - E.inOut3(prog(t, tHand - 0.25, 0.4)));
        pill.style.opacity = wv;
        pill.style.transform = `translateX(-50%) translateY(${(1 - wv) * 30}px)`;
        const cx = 960;
        const cy = 460;
        if (wv > 0.01) {
          g.save();
          g.globalAlpha = wv;
          [190, 330, 470].forEach((r, i) => {
            g.strokeStyle = 'rgba(0,0,0,0.07)';
            g.lineWidth = 2;
            g.beginPath();
            g.ellipse(cx, cy, r * 1.35, r * 0.75, 0, 0, Math.PI * 2);
            g.stroke();
          });
          const rot = (t - tWheel) * 0.25;
          const pos = MODELS.map((m, i) => {
            const ang = -Math.PI / 2 + (i / MODELS.length) * Math.PI * 2 + rot;
            return [cx + Math.cos(ang) * 600, cy + Math.sin(ang) * 270, Math.sin(ang)];
          });
          pos.forEach(([x, y], i) => {
            const lp = E.out3(prog(t, tWheel + 0.1 + i * 0.1, 0.5));
            g.strokeStyle = COL.green;
            g.lineWidth = 3;
            g.beginPath();
            g.moveTo(cx, cy);
            g.lineTo(lerp(cx, x, lp), lerp(cy, y, lp));
            g.stroke();
          });
          const order = pos.map((p, i) => [p, i]).sort((p, q) => p[0][2] - q[0][2]);
          for (const [[x, y, d], i] of order) {
            const sc = 1 + d * 0.15;
            const cp = E.outBack(prog(t, tWheel - 0.2 + i * 0.08, 0.5));
            cube(g, x, y, 92 * sc * cp, { yaw: 0.785 + rot * 0.5, pitch: 0.55, fill: '#fff', stroke: '#111', lw: 2.2 });
            css(wheelLabels[i], { left: `${x}px`, top: `${y + 70 * sc}px`, opacity: wv * cp });
          }
          const pulse = 1 + Math.sin(t * 5) * 0.03;
          const gp = E.outBack(prog(t, tWheel, 0.6));
          g.fillStyle = COL.green;
          g.shadowColor = 'rgba(0,242,107,.6)';
          g.shadowBlur = 60;
          g.beginPath();
          g.arc(cx, cy, 120 * gp * pulse, 0, Math.PI * 2);
          g.fill();
          g.shadowBlur = 0;
          g.fillStyle = '#0a0a0a';
          g.font = '500 26px "Geist Mono"';
          g.textAlign = 'center';
          if ('letterSpacing' in g) g.letterSpacing = '4px';
          g.fillText('CONSENSUS', cx, cy + 9);
          if ('letterSpacing' in g) g.letterSpacing = '0px';
          g.textAlign = 'left';
          g.restore();
        }
        wheelLabels.forEach((l) => (l.style.display = wv > 0.01 ? 'block' : 'none'));
        // appeals panel
        const pv = E.out5(prog(t, tHand - 0.2, 0.8));
        panel.style.display = pv > 0 ? 'block' : 'none';
        css(panel, { opacity: pv, transform: `translateY(${(1 - pv) * 200}px) scale(${lerp(0.94, 1, pv)})` });
        if (pv > 0) {
          pg.clearRect(0, 0, 1760, 820);
          const stages = [
            { n: 5, cols: 3, red: [4], t: tHand + 0.25, x: 760, lab: '5 NODES' },
            { n: 11, cols: 3, red: [4, 9], t: tHand + 1.15, x: 1090, lab: '11 NODES', sub: '[APPEAL = 2N+1]' },
            { n: 23, cols: 4, red: [], t: tHand + 2.05, x: 1450, lab: '23 NODES', sub: '[FINALITY]', blue: true },
          ];
          pg.font = '400 20px "Geist Mono"';
          stages.forEach((st, si) => {
            const sp = prog(t, st.t, 0.6);
            if (sp <= 0) return;
            const rows = Math.ceil(st.n / st.cols);
            const cs = 62;
            const y0 = 410 - (rows * cs) / 2;
            pg.fillStyle = `rgba(255,255,255,${E.out3(sp)})`;
            pg.textAlign = 'center';
            pg.fillText(st.lab, st.x, y0 - 34);
            if (st.sub) pg.fillText(st.sub, st.x, y0 + rows * cs + 34);
            for (let k = 0; k < st.n; k++) {
              const q = E.outBack(prog(t, st.t + k * 0.03, 0.4));
              if (q <= 0) continue;
              const x = st.x - ((st.cols - 1) * cs) / 2 + (k % st.cols) * cs;
              const y = y0 + Math.floor(k / st.cols) * cs + cs / 2;
              const red = st.red.includes(k);
              cube(pg, x, y, 40 * q, red ? { fill: '#ff3b30', top: '#ff6a5f', side: '#d92a20', stroke: '#ff3b30', lw: 1 } : st.blue ? { fill: BLUE, top: '#4a40ff', side: '#1208c8', stroke: '#2a1dff', lw: 1 } : { stroke: '#888', lw: 1.4 });
            }
            if (si < 2) {
              const ap = prog(t, stages[si + 1].t - 0.2, 0.4);
              if (ap > 0) {
                pg.strokeStyle = `rgba(255,255,255,${ap})`;
                pg.lineWidth = 2;
                const mx = (st.x + stages[si + 1].x) / 2 - 10;
                pg.beginPath();
                pg.moveTo(mx - 14, 410);
                pg.lineTo(mx + 14, 410);
                pg.lineTo(mx + 6, 402);
                pg.moveTo(mx + 14, 410);
                pg.lineTo(mx + 6, 418);
                pg.stroke();
              }
            }
          });
          pg.textAlign = 'left';
          const fin = prog(t, tHand + 2.05, 0.5);
          if (fin > 0 && fin < 1) ctx.flare(80 + 1450, 80 + 410, Math.sin(fin * Math.PI) * 0.8);
        }
      },
    });
  }

  // =====================================================================================
  // 9. NOT EVERYTHING ON THE WEB IS TRUE — validation & consensus
  // =====================================================================================
  {
    const a = s('course') - 0.2;
    const tCo = s('course');
    const tBad = s('bad');
    const tags = [wt('bad', 'outdated'), wt('bad', 'misleading'), wt('bad', 'manipulated')];
    const tV = s('valid');
    let g, head, srcs, stamps, verdict, head2;
    add({
      id: 'trust', a, b: s('vision') - 0.2, dark: true, inScale: 1.12,
      build(root) {
        [, g] = canvas(root);
        head = textBlock(root, 'h0 white', 'Web access|≠ *accuracy.*', 0, 330, { width: '1920px', textAlign: 'center', fontSize: '190px' });
        head2 = textBlock(root, 'h2 white', 'Validation _+_ consensus.', 0, 110, { width: '1920px', textAlign: 'center' });
        srcs = ['market-feed.io', 'daily-post.news', 'claims-portal.net'].map((tx, i) => {
          const c = el('div', 'card', root);
          css(c, { left: `${150 + i * 560}px`, top: '300px', width: '500px', height: '360px', background: '#111', border: '2px solid #2a2a2a' });
          const bar = el('div', 'abs mono', c, `● ${tx}`);
          css(bar, { left: '26px', top: '24px', fontSize: '17px', color: '#888', letterSpacing: '.08em', textTransform: 'none' });
          for (let k = 0; k < 5; k++) {
            const b = el('div', 'abs', c);
            css(b, { left: '26px', top: `${90 + k * 44}px`, height: '16px', width: `${[440, 380, 420, 300, 360][k]}px`, borderRadius: '8px', background: '#262626' });
          }
          return c;
        });
        stamps = [['Outdated · 2019', '#cfcfcf'], ['Misleading', COL.red], ['Manipulated', COL.red]].map(([tx, col], i) => {
          const s2 = el('div', 'stamp', srcs[i], tx);
          css(s2, { left: '50%', top: '50%', color: col, background: 'rgba(10,10,10,.85)' });
          return s2;
        });
        verdict = el('div', 'stamp', root, '✓ Verified by consensus');
        css(verdict, { left: '960px', top: '720px', color: COL.green, fontSize: '30px', background: 'rgba(0,0,0,.7)' });
        tags.forEach((x, i) => ctx.sfx(x + 0.05, i === 2 ? 'glitch' : 'stamp', 1));
        ctx.sfx(tV + 0.2, 'scan', 1);
        ctx.sfx(tV + 1.6, 'chime', 1);
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        dots(g, { color: 'rgba(255,255,255,0.07)', step: 44, r: 1.4 });
        rise(head.chars, t, tCo + 0.4, { st: 0.035, y: 0.3, blur: 20 });
        fadeEl(head.box, 1 - prog(t, tBad - 0.35, 0.3), { blur: 20 });
        head.box.style.display = t < tBad ? 'block' : 'none';
        const on = t > tBad - 0.3;
        srcs.forEach((c) => (c.style.display = on ? 'block' : 'none'));
        verdict.style.display = on ? 'block' : 'none';
        head2.box.style.display = t > tV - 0.2 ? 'block' : 'none';
        if (!on) return;
        const scanP = prog(t, tV + 0.2, 1.3);
        srcs.forEach((c, i) => {
          const p = E.out5(prog(t, tBad - 0.25 + i * 0.12, 0.7));
          const q = t - tags[i];
          const gl = q > 0 && q < (i === 2 ? 0.7 : 0.25) ? (hash(Math.floor(t * 40) + i * 9) - 0.5) : 0;
          const verified = i === 0 ? false : false;
          const drop = scanP >= 1 ? E.in3(prog(t, tV + 1.5 + i * 0.08, 0.6)) : 0;
          const keep = i === 1 && false;
          css(c, {
            opacity: p * (1 - drop * 0.85),
            transform: `perspective(1400px) rotateY(${(1 - p) * 30 + (i - 1) * -6}deg) translateY(${(1 - p) * 80 + drop * 140}px) translateX(${gl * 40}px) scale(${1 - drop * 0.1})`,
            borderColor: t > tags[i] ? (i ? 'rgba(255,59,48,.8)' : 'rgba(200,200,200,.6)') : '#2a2a2a',
            filter: drop > 0 ? `blur(${drop * 6}px) grayscale(1)` : 'none',
          });
          if (gl && i === 2) c.style.clipPath = `inset(${hash(Math.floor(t * 40)) * 60}% 0 ${hash(Math.floor(t * 40) + 3) * 30}% 0)`;
          else c.style.clipPath = 'none';
          const sp = E.outBack(prog(t, tags[i], 0.3));
          css(stamps[i], { opacity: clamp(sp), transform: `translate(-50%, -50%) rotate(-8deg) scale(${lerp(2.4, 1, sp)})` });
          if (gl && i === 2) ctx.shake = 0.5;
        });
        // validator scan beam
        rise(head2.chars, t, tV - 0.1, { st: 0.025, y: 0.3 });
        if (scanP > 0 && scanP < 1) {
          const x = lerp(100, 1820, E.inOut3(scanP));
          const gr = g.createLinearGradient(x - 140, 0, x + 10, 0);
          gr.addColorStop(0, 'rgba(0,242,107,0)');
          gr.addColorStop(1, 'rgba(0,242,107,.35)');
          g.fillStyle = gr;
          g.fillRect(x - 140, 260, 150, 440);
          g.fillStyle = COL.green;
          g.fillRect(x, 260, 4, 440);
          ctx.flare(x, 480, 0.5, '0,242,107');
        }
        // validator cubes along the bottom
        for (let k = 0; k < 5; k++) {
          const q = E.outBack(prog(t, tV - 0.1 + k * 0.08, 0.5));
          if (q > 0) cube(g, 560 + k * 200, 820, 60 * q, { stroke: scanP > 0 ? COL.green : '#666', lw: 2, fill: '#050505' });
        }
        const vp = E.outBack(prog(t, tV + 1.6, 0.4));
        css(verdict, { opacity: clamp(vp), transform: `translate(-50%, -50%) scale(${lerp(1.8, 1, vp)})`, top: '520px' });
        if (vp > 0 && t < tV + 2.4) ctx.flare(960, 520, (1 - prog(t, tV + 1.6, 0.8)) * 0.8, '0,242,107');
      },
    });
  }

  // =====================================================================================
  // 10. VISION — the hammer: beyond executing code
  // =====================================================================================
  {
    const a = s('vision') - 0.2;
    const tVi = s('vision');
    const tCode = wt('vision', 'code');
    const tEx = s('examine');
    const tEx2 = wt('examine', 'examine');
    const tDec = wt('examine', 'support');
    let g, kick, h1, h2, sub;
    add({
      id: 'vision', a, b: s('open') - 0.2, dark: true, inScale: 1.15, inFlash: 0, inSfx: 'boom',
      build(root) {
        [, g] = canvas(root);
        kick = textBlock(root, 'mono', "GenLayer's vision", 140, 250, { color: '#8a86ff' });
        h1 = textBlock(root, 'h1 white', 'Beyond simply|executing *code.*', 134, 310, { fontSize: '120px' });
        h2 = textBlock(root, 'h1 white', 'Contracts that|*examine* the|real world.', 134, 250, { fontSize: '120px' });
        sub = textBlock(root, 'body', 'And support decentralized decisions —|when outcomes aren’t straightforward.', 140, 680, { color: '#9a9a9a', fontSize: '36px' });
        ctx.sfx(tCode + 0.15, 'anvil', 1.2);
      },
      update(t, lt, _c, dur) {
        g.clearRect(0, 0, W, H);
        const rev = E.out3(prog(t, a, 2.2));
        const push = E.inOut3(clamp(lt / dur));
        const hh = lerp(1250, 1500, push);
        drawHalftone(g, ctx.img.hammer, {
          x: lerp(830, 760, push), y: lerp(-110, -240, push), h: hh, cell: 11, t,
          color: '#2a1fff', reveal: (u, v) => clamp((rev * 1.4 - v) * 3), shimmer: 0.2,
        });
        // strike on "code"
        const q = t - (tCode + 0.15);
        if (q > 0 && q < 1.5) {
          ctx.flare(lerp(830, 760, push) + 0.45 * hh * (780 / 876) * 0.92, lerp(-110, -240, push) + hh * 0.12, Math.exp(-q * 2.5) * 1.3);
          ctx.shake = Math.exp(-q * 6) * 1.3;
          ctx.flashK = Math.exp(-q * 10) * 0.35;
          ctx.flashColor = '#3a2fff';
        }
        scramble(kick.chars, t, tVi, { st: 0.03 });
        fadeEl(kick.box, 1 - prog(t, tEx - 0.3, 0.3));
        rise(h1.chars, t, tVi + 0.1, { st: 0.028, y: 0.35, blur: 18 });
        fadeEl(h1.box, 1 - prog(t, tEx - 0.35, 0.35), { blur: 18 });
        h1.box.style.display = t < tEx ? 'block' : 'none';
        h2.box.style.display = t > tEx - 0.2 ? 'block' : 'none';
        sub.box.style.display = t > tEx - 0.2 ? 'block' : 'none';
        riseAt(h2.words, t, [tEx + 0.25, tEx + 0.45, tEx2, tEx2 + 0.3, tEx2 + 0.5, tEx2 + 0.7]);
        rise(sub.chars, t, tDec - 0.1, { st: 0.012, y: 0.4, blur: 10 });
      },
    });
  }

  // =====================================================================================
  // 11. NEW POSSIBILITIES — three tiles
  // =====================================================================================
  {
    const a = s('open') - 0.2;
    const tO = s('open');
    const tt = [wt('open', 'prediction'), wt('open', 'insurance'), wt('open', 'emerging')];
    let g, head, tiles, icons;
    add({
      id: 'open', a, b: s('future') - 0.2, dark: false, inFlash: 0.5, inScale: 1.1,
      build(root) {
        [, g] = canvas(root);
        head = textBlock(root, 'h2 ink', 'Opening new *possibilities.*', 140, 120, { fontSize: '96px' });
        tiles = [['Prediction<br>markets', false], ['Smart<br>insurance', false], ['The AI agent<br>economy', true]].map(([tx, solid], i) => {
          const c = el('div', 'card', root);
          css(c, { left: `${140 + i * 560}px`, top: '300px', width: '520px', height: '580px', background: solid ? BLUE : '#f4f4f4' });
          const idx = el('div', 'abs idx', c, `[0${i + 1}]`);
          css(idx, { left: '44px', top: '40px', color: solid ? '#fff' : BLUE });
          const h = el('div', `abs h3 ${solid ? 'white' : 'ink'}`, c, tx);
          css(h, { left: '42px', bottom: '44px', fontSize: '60px' });
          const [cv, cg] = canvas(c, 520, 300);
          css(cv, { width: '520px', height: '300px', top: '90px' });
          return { c, g: cg, solid };
        });
        tt.forEach((x) => ctx.sfx(x, 'hit', 0.9));
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        dots(g, { step: 40, r: 1.5 });
        rise(head.chars, t, tO - 0.05, { st: 0.022 });
        tiles.forEach((tile, i) => {
          const p = E.out5(prog(t, tt[i] - 0.15, 0.7));
          css(tile.c, { opacity: p, transform: `translateY(${(1 - p) * 120}px) rotateX(${(1 - p) * 20}deg)` });
          const ig = tile.g;
          ig.clearRect(0, 0, 520, 300);
          const lt2 = t - tt[i];
          if (i === 0) {
            // live market bars
            for (let k = 0; k < 9; k++) {
              const hgt = (60 + (noise1(lt2 * 1.4 + k * 0.7, k) + 1) * 80) * E.out3(prog(lt2, k * 0.05, 0.6));
              ig.fillStyle = k === 6 ? BLUE : '#111';
              ig.fillRect(50 + k * 48, 260 - hgt, 30, hgt);
            }
          } else if (i === 1) {
            // shield
            const q = E.out3(prog(lt2, 0, 0.9));
            ig.save();
            ig.translate(260, 150);
            ig.scale(q, q);
            ig.beginPath();
            ig.moveTo(0, -110);
            ig.lineTo(95, -75);
            ig.quadraticCurveTo(95, 60, 0, 115);
            ig.quadraticCurveTo(-95, 60, -95, -75);
            ig.closePath();
            ig.fillStyle = '#111';
            ig.fill();
            ig.strokeStyle = BLUE;
            ig.lineWidth = 10;
            ig.beginPath();
            ig.moveTo(-40, 0);
            ig.lineTo(-8, 32);
            ig.lineTo(48, -30);
            const dl = 200 * E.out3(prog(lt2, 0.4, 0.6));
            ig.setLineDash([dl, 400]);
            ig.stroke();
            ig.setLineDash([]);
            ig.restore();
          } else {
            // agent network
            const N = 8;
            const pts = Array.from({ length: N }, (_, k) => [260 + Math.cos(k * 0.785 + lt2 * 0.4) * (90 + (k % 2) * 60), 150 + Math.sin(k * 0.785 + lt2 * 0.4) * (60 + (k % 2) * 40)]);
            const q = E.out3(prog(lt2, 0, 0.8));
            ig.strokeStyle = 'rgba(255,255,255,.6)';
            ig.setLineDash([5, 6]);
            ig.lineWidth = 2;
            pts.forEach((p) => {
              ig.beginPath();
              ig.moveTo(260, 150);
              ig.lineTo(lerp(260, p[0], q), lerp(150, p[1], q));
              ig.stroke();
            });
            ig.setLineDash([]);
            pts.forEach((p, k) => {
              ig.fillStyle = '#fff';
              ig.beginPath();
              ig.arc(lerp(260, p[0], q), lerp(150, p[1], q), 10 + (k % 2) * 4, 0, Math.PI * 2);
              ig.fill();
            });
            ig.fillStyle = '#00f26b';
            ig.beginPath();
            ig.arc(260, 150, 26 * q, 0, Math.PI * 2);
            ig.fill();
          }
        });
      },
    });
  }

  // =====================================================================================
  // 12a. THE FUTURE — strike "executing code", expand
  // =====================================================================================
  {
    const a = s('future') - 0.2;
    const tF = s('future');
    const tX = s('expand');
    const tU = wt('expand', 'understand');
    const tDo = wt('expand', 'do');
    const tWorld = wt('expand', 'world');
    let g, f1, strike, x1, x2, x3;
    add({
      id: 'future', a, b: s('end') - 0.45, dark: true, inScale: 1.1, noOut: true,
      build(root) {
        [, g] = canvas(root);
        f1 = textBlock(root, 'h2 white', 'The future of smart contracts|isn’t just about executing code.', 0, 380, { width: '1920px', textAlign: 'center', fontSize: '92px' });
        strike = el('div', 'abs', root);
        css(strike, { height: '10px', background: BLUE, top: '527px', boxShadow: `0 0 30px ${BLUE}` });
        x1 = textBlock(root, 'h2 white', 'It’s about expanding what they', 0, 230, { width: '1920px', textAlign: 'center', fontSize: '78px', color: '#bdbdbd' });
        x2 = textBlock(root, 'h0 white', '*understand*', 0, 340, { width: '1920px', textAlign: 'center', fontSize: '200px' });
        x3 = textBlock(root, 'h0 white', '& *do.*', 0, 560, { width: '1920px', textAlign: 'center', fontSize: '200px' });
        ctx.sfx(e('future') - 0.3, 'swipe', 1);
        ctx.sfx(tU, 'hit', 1);
        ctx.sfx(tDo, 'impact', 1.1);
        ctx.sfx(tWorld, 'swell', 1);
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        // expanding rings of dots: the world opening up
        const ex = prog(t, tX, 6);
        for (let r = 0; r < 7; r++) {
          const rr = ((r * 220 + (t - tF) * 120) % 1600) + 50;
          const n = Math.floor(rr / 9);
          g.fillStyle = `rgba(80,70,255,${0.5 * (1 - rr / 1650) * (0.3 + ex)})`;
          for (let k = 0; k < n; k++) {
            const ang = (k / n) * Math.PI * 2 + r;
            g.fillRect(960 + Math.cos(ang) * rr, 540 + Math.sin(ang) * rr * 0.6, 3, 3);
          }
        }
        // future line
        rise(f1.chars, t, tF - 0.05, { st: 0.016, y: 0.4 });
        const sp = E.inOut3(prog(t, e('future') - 0.35, 0.5));
        css(strike, { left: '948px', width: `${600 * sp}px`, opacity: 1 - prog(t, tX - 0.3, 0.3) });
        fadeEl(f1.box, 1 - prog(t, tX - 0.3, 0.3), { blur: 16 });
        f1.box.style.display = t < tX ? 'block' : 'none';
        const on = t > tX - 0.2;
        [x1, x2, x3].forEach((b) => (b.box.style.display = on ? 'block' : 'none'));
        if (!on) return;
        rise(x1.chars, t, tX, { st: 0.018, y: 0.4 });
        rise(x2.chars, t, tU - 0.05, { st: 0.035, y: 0.25, blur: 24 });
        rise(x3.chars, t, tDo - 0.25, { st: 0.06, y: 0.25, blur: 24 });
        const out = E.in3(prog(t, tWorld + 0.2, 0.7));
        [x1, x2, x3].forEach((b) => css(b.box, { opacity: 1 - out, transform: `scale(${1 + out * 0.25})`, filter: out > 0 ? `blur(${out * 20}px)` : 'none' }));
        if (t > tDo && t < tDo + 1) ctx.flare(960, 660, (1 - (t - tDo)) * 0.9);
        if (t > tWorld + 0.3) ctx.flashK = E.in3(prog(t, tWorld + 0.4, 0.5));
      },
    });
  }

  // =====================================================================================
  // 12b. END CARD — protocol stack + lockup
  // =====================================================================================
  {
    const a = s('end') - 0.45;
    const tEnd = s('end');
    let g, word, tag, url;
    add({
      id: 'end', a, b: DURATION + 1, dark: false, inFlash: 0.9, inScale: 1.05, noOut: true, inSfx: 'braam', inGain: 1.3,
      build(root) {
        [, g] = canvas(root);
        word = textBlock(root, 'h0 ink', 'GenLayer', 0, 670, { width: '1920px', textAlign: 'center', fontSize: '150px' });
        tag = textBlock(root, 'body', 'Where AI, the web, and blockchain come together.', 0, 840, { width: '1920px', textAlign: 'center', fontSize: '38px', color: '#6f6f6f' });
        url = textBlock(root, 'mono', 'genlayer.com', 0, 905, { width: '1920px', textAlign: 'center', color: BLUE });
      },
      update(t, lt) {
        g.clearRect(0, 0, W, H);
        dots(g, { step: 40, r: 1.5 });
        poseStack(ctx.gl, t, {
          built: prog(t, a - 0.2, 1.1), top: prog(t, a + 0.25, 0.6), x: 0, y: 2.0,
          yaw: 0.785 + (1 - E.out3(prog(t, a, 5))) * 0.9 + Math.sin(t * 0.3) * 0.05,
          el: 0.6, dist: lerp(46, 40, E.out3(prog(t, a, 5))), fov: 18,
        });
        rise(word.chars, t, tEnd - 0.1, { st: 0.04, y: 0.3, blur: 18 });
        rise(tag.chars, t, tEnd + 0.6, { st: 0.012, y: 0.4 });
        scramble(url.chars, t, tEnd + 1.3, { st: 0.04 });
        // fade to white then black at the very end (clean loop)
        if (t > DURATION - 0.8) {
          ctx.flashK = E.in3(prog(t, DURATION - 0.8, 0.8));
          ctx.flashColor = '#000';
        }
      },
    });
  }

  return S;
}
