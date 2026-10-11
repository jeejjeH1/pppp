"""Procedural soundtrack + SFX, beat-locked to the picture (120 BPM, 56 s).

    node src/events.js out/events.json
    python3 src/audio.py out/events.json out/soundtrack.wav

Arrangement (bars of 2 s):
  0-4    intro      pad, typing, riser, logo impact
  4-12   verse      four-on-the-floor kick, rolling bass, hats, chord stabs (+clap/arp from 8)
  12-16  build      impact, snare roll, filter sweep, riser -> silence gap
  16-22  DROP 1     crash, pumping supersaw chords, hook lead
  22-34  groove     drums + bass + arp + chords, stutter edit at the end
  34-40  breakdown  pads + arp, riser, impact at 37.5, roll -> gap
  40-46  DROP 2     full + lead
  46-50  FINAL      biggest drop
  50-56  outro      pad, arp, lead tail
Every text animation gets its own SFX (key clicks, decode blips, slam hits, pops).
Requires numpy + scipy.
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, lfilter, sosfilt, fftconvolve

SR = 48000
BPM = 120
BEAT = 60 / BPM
S16 = BEAT / 4
BAR = BEAT * 4

ev = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'out/events.json'))
OUT = sys.argv[2] if len(sys.argv) > 2 else 'out/soundtrack.wav'
DUR = float(ev['duration'])
N = int(SR * DUR)
KICK = ev['kick']
CLAP = ev['clap']
DROPS = ev['drops']
rng = np.random.default_rng(11)


class Bus:
    def __init__(self):
        self.L = np.zeros(N)
        self.R = np.zeros(N)

    def add(self, sig, t0, gain=1.0, pan=0.0):
        if sig.ndim == 2:
            l, r = sig
        else:
            l = r = sig
        i = int(round(t0 * SR))
        if i >= N or i + len(l) <= 0:
            return
        a = max(0, -i)
        l, r = l[a:], r[a:]
        i = max(i, 0)
        n = min(len(l), N - i)
        gl = gain * np.sqrt(0.5 * (1 - pan)) * 1.414
        gr = gain * np.sqrt(0.5 * (1 + pan)) * 1.414
        self.L[i:i + n] += l[:n] * gl
        self.R[i:i + n] += r[:n] * gr

    def st(self):
        return np.stack([self.L, self.R])


drums, bass, music, lead, fx, sfx = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
verb_send, delay_send = Bus(), Bus()


def tt(d):
    return np.arange(int(d * SR)) / SR


def note(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def _sos(kind, f, order=2):
    if kind == 'band':
        lo, hi = f
        return butter(order, [max(lo, 20) / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], 'band', output='sos')
    return butter(order, min(max(f, 20), SR * 0.45) / (SR / 2), kind, output='sos')


def lp(x, f, o=2):
    return sosfilt(_sos('low', f, o), x)


def hp(x, f, o=2):
    return sosfilt(_sos('high', f, o), x)


def bp(x, lo, hi, o=2):
    return sosfilt(_sos('band', (lo, hi), o), x)


def sweep_lp(x, f0, f1, curve=2.0, blk=256):
    """Time-varying 2-pole lowpass (block-wise, state carried)."""
    out = np.zeros_like(x)
    zi = np.zeros((1, 2))
    for s in range(0, len(x), blk):
        k = (s / max(1, len(x) - 1)) ** curve
        f = f0 * (f1 / f0) ** k
        sos = _sos('low', f)
        out[s:s + blk], zi = sosfilt(sos, x[s:s + blk], zi=zi)
    return out


def saw(f, t, ph=0.0):
    return 2 * ((f * t + ph) % 1) - 1


def supersaw(f, t, voices=7, spread=0.18):
    l = np.zeros(len(t))
    r = np.zeros(len(t))
    for v in range(voices):
        d = (v - (voices - 1) / 2) / ((voices - 1) / 2)
        s = saw(f * 2 ** (d * spread / 12), t, rng.random())
        pan = d
        l += s * (1 - pan) / 2
        r += s * (1 + pan) / 2
    return np.stack([l, r]) / voices * 1.6


def adsr(n, a, d, s, r, length):
    t = np.arange(n) / SR
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    env *= np.clip((length - t) / max(r, 1e-4), 0, 1)
    return env


def in_sec(secs, x):
    return any(a - 1e-6 <= x < b for a, b in secs)


def section(t):
    if t < 4: return 'intro'
    if t < 12: return 'verse'
    if t < 16: return 'build'
    if t < 22: return 'drop'
    if t < 34: return 'groove'
    if t < 40: return 'break'
    if t < 46: return 'drop'
    if t < 50.5: return 'final'
    return 'outro'


def in_gap(t):
    return any(d - 0.5 <= t < d for d in DROPS) or 39.75 <= t < 40


# ---------------------------------------------------------------- drum sounds
def mk_kick():
    t = tt(0.55)
    f = 46 + 190 * np.exp(-t * 32) + 40 * np.exp(-t * 9)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.2)
    punch = np.sin(2 * np.pi * np.cumsum(120 + 500 * np.exp(-t * 80)) / SR) * np.exp(-t * 40) * 0.5
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 400) * 0.5
    return np.tanh((body + punch + click) * 2.2) * 0.95


def mk_clap():
    t = tt(0.5)
    n = bp(rng.standard_normal(len(t)), 900, 7000)
    env = np.exp(-t * 14) * 0.8
    for off in (0.0, 0.009, 0.018, 0.027):
        env = env + np.where(t >= off, np.exp(-np.maximum(t - off, 0) * 160), 0) * 0.5
    snare_body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 22) * 0.6
    snare_noise = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 16) * 0.5
    return np.tanh((n * env + snare_body + snare_noise) * 1.4)


def mk_hat(open_=False):
    d = 0.32 if open_ else 0.07
    t = tt(d)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (317, 474, 563, 707, 1011, 1347)) / 6
    n = rng.standard_normal(len(t)) * 0.7 + metal
    return hp(bp(n, 6000, 16000), 7000) * np.exp(-t * (9 if open_ else 65)) * 0.9


def mk_crash():
    t = tt(2.4)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t + rng.random() * 6)) for f in (421, 563, 857, 1197, 1569, 2133)) / 6
    n = rng.standard_normal(len(t)) + metal * 0.6
    l = hp(n, 4500) * np.exp(-t * 1.8)
    r = hp(np.roll(n, 300), 4500) * np.exp(-t * 1.8)
    return np.stack([l, r]) * 0.5


def mk_impact(big=1.0):
    t = tt(3.2)
    f = 28 + 90 * np.exp(-t * 7)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.5)
    boom = lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 5) * 0.9
    crack = hp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 22) * 0.7
    return np.tanh((sub * 1.4 + boom + crack) * (1.2 + big * 0.5))


def mk_riser(d, top=12000):
    t = tt(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(n)
    blk = 512
    zi = np.zeros((2, 2))
    for s in range(0, len(n), blk):
        k = (s / len(n)) ** 1.8
        fc = 250 * (top / 250) ** k
        sos = _sos('band', (fc * 0.55, fc * 1.6))
        out[s:s + blk], zi = sosfilt(sos, n[s:s + blk], zi=zi)
    tone_f = 110 * 2 ** (4 * (t / d) ** 1.6)  # 4 octave pitch rise
    tone = sum(saw(tone_f * m, t) for m in (1, 1.5, 2.01)) / 3
    tone = lp(tone, 6000) * 0.25
    env = (t / d) ** 2.0
    return np.stack([out * 1.5 + tone, np.roll(out, 211) * 1.5 + tone]) * env


def mk_downlifter(d=1.5):
    r = mk_riser(d, 8000)[:, ::-1]
    return r * 0.8


def mk_whoosh(d=0.35):
    t = tt(d)
    n = rng.standard_normal(len(t))
    out = sweep_lp(n, 400, 9000, 1.0)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return hp(out, 300) * env


K, CL, HC, HO, CR = mk_kick(), mk_clap(), mk_hat(), mk_hat(True), mk_crash()

# ---------------------------------------------------------------- harmony
# A minor: Am - F - C - G
PROG = [
    dict(root=33, chord=[57, 60, 64, 69], arp=[69, 72, 76, 81]),
    dict(root=29, chord=[53, 57, 60, 65], arp=[65, 69, 72, 77]),
    dict(root=36, chord=[55, 60, 64, 67], arp=[67, 72, 76, 79]),
    dict(root=31, chord=[55, 59, 62, 67], arp=[67, 71, 74, 79]),
]
# hook: (8th-step, midi, length in 8ths) per chord
HOOK = [
    [(0, 76, 2), (2, 76, 1), (3, 74, 1), (4, 76, 2), (6, 79, 1), (7, 76, 1)],
    [(1, 74, 1), (2, 72, 2), (4, 69, 2), (6, 72, 1), (7, 74, 1)],
    [(0, 76, 2), (2, 76, 1), (3, 74, 1), (4, 76, 2), (6, 79, 1), (7, 81, 1)],
    [(0, 79, 3), (3, 76, 1), (4, 74, 2), (6, 71, 1), (7, 74, 1)],
]

NBARS = int(np.ceil(DUR / BAR))
for bar in range(NBARS):
    t0 = bar * BAR
    P = PROG[bar % 4]
    sec = section(t0 + 0.01)

    # ---------- chords
    if sec in ('drop', 'final'):
        # sustained pumping supersaw (sidechain applied on the music bus)
        t = tt(BAR)
        s = sum(supersaw(note(n), t) for n in P['chord'] + [P['chord'][0] - 12])
        s = np.stack([lp(s[0], 5200), lp(s[1], 5200)]) * adsr(len(t), 0.005, 0.5, 0.85, 0.02, BAR)
        music.add(s, t0, 0.075)
        verb_send.add(s, t0, 0.02)
    elif sec in ('verse', 'build', 'groove'):
        # off-beat stabs
        for b in range(4):
            tb = t0 + b * BEAT + BEAT / 2
            d = 0.22
            t = tt(d)
            s = sum(supersaw(note(n), t, 5, 0.12) for n in P['chord'])
            cut = 1800 if sec == 'verse' else (1800 + 5000 * ((t0 - 12) / 4) if sec == 'build' else 3200)
            s = np.stack([lp(s[0], cut), lp(s[1], cut)]) * adsr(len(t), 0.003, 0.08, 0.3, 0.05, d)
            music.add(s, tb, 0.09)
            verb_send.add(s, tb, 0.04)
            delay_send.add(s, tb, 0.03)
    if sec in ('intro', 'break', 'outro', 'build', 'groove'):
        # soft pad
        t = tt(BAR + 0.3)
        s = sum(supersaw(note(n), t, 5, 0.25) for n in P['chord'])
        cut = {'intro': 900, 'break': 1500, 'outro': 1100, 'build': 1200, 'groove': 900}[sec]
        s = np.stack([lp(s[0], cut), lp(s[1], cut)]) * adsr(len(t), 0.4, 1.0, 1.0, 0.3, BAR + 0.3)
        g = {'intro': 0.07, 'break': 0.08, 'outro': 0.08, 'build': 0.035, 'groove': 0.03}[sec]
        music.add(s, t0, g)
        verb_send.add(s, t0, g * 0.6)

    # ---------- arp (16ths)
    if sec in ('verse', 'build', 'groove', 'break', 'drop', 'final', 'outro') and not (sec == 'verse' and t0 < 8):
        pat = [0, 2, 1, 3, 2, 1, 3, 0, 1, 3, 2, 3, 0, 2, 1, 3]
        for q in range(16):
            tn = t0 + q * S16
            n = P['arp'][pat[q]] + (12 if sec in ('drop', 'final') and q % 4 == 3 else 0)
            d = 0.16
            t = tt(d)
            f = note(n)
            s = (np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + saw(f * 1.003, t) * 0.5)
            bright = {'verse': 2600, 'build': 3500, 'groove': 3800, 'break': 3000, 'drop': 5000, 'final': 6000, 'outro': 2400}[sec]
            s = lp(s, bright) * np.exp(-t * 18)
            g = 0.055 if sec in ('drop', 'final') else 0.075
            music.add(s, tn, g, 0.45 if q % 2 else -0.45)
            delay_send.add(s, tn, g * 0.5)

    # ---------- lead hook in drops
    if sec in ('drop', 'final') or (sec == 'outro' and t0 < 52):
        for step, n, ln in HOOK[bar % 4]:
            tn = t0 + step * BEAT / 2
            d = ln * BEAT / 2 * 0.92
            t = tt(d)
            vib = 1 + 0.005 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.15, 0, 1)
            s = supersaw(note(n) * vib, t, 5, 0.22)
            s = s + supersaw(note(n + 12) * vib, t, 3, 0.15) * 0.35
            env = adsr(len(t), 0.006, 0.25, 0.75, 0.06, d)
            s = np.stack([lp(s[0], 6500), lp(s[1], 6500)]) * env
            g = 0.075 if sec != 'outro' else 0.05
            lead.add(s, tn, g)
            verb_send.add(s, tn, g * 0.6)
            delay_send.add(s, tn, g * 0.45)

    # ---------- drums + bass per beat
    for b in range(4):
        tb = t0 + b * BEAT
        if in_gap(tb + 0.01):
            continue
        kick_on = in_sec(KICK, tb)
        if kick_on:
            drums.add(K, tb, 0.95)
        if in_sec(CLAP, tb) and b in (1, 3):
            drums.add(CL, tb, 0.55)
            verb_send.add(CL, tb, 0.18)
        if kick_on:
            drums.add(HO if sec in ('drop', 'final') else HC, tb + BEAT / 2, 0.42 if sec in ('drop', 'final') else 0.5, 0.25)
            if sec not in ('verse',) or t0 >= 8:
                for q in (1, 3):
                    drums.add(HC, tb + q * S16, 0.22 + 0.06 * (q == 3), -0.3)
        # rolling bass: three 16ths after each kick
        if kick_on or sec in ('break',):
            for q in ((1, 2, 3) if kick_on else (0,)):
                tn = tb + q * S16
                d = S16 * (0.95 if kick_on else 4)
                t = tt(d)
                f = note(P['root'] + 12)
                body = saw(f, t) + saw(f * 1.006, t, 0.4) + 0.6 * np.sign(np.sin(2 * np.pi * f * t))
                cut = 260 + 1600 * np.exp(-t * 30) * (1.4 if sec in ('drop', 'final') else 1.0)
                body = sweep_lp(body, cut[0], cut[-1], 1.0, 128) if kick_on else lp(body, 300)
                sub = np.sin(2 * np.pi * (f / 2) * t)
                s = (body * 0.5 + sub * 0.9) * adsr(len(t), 0.002, 0.08, 0.7, 0.01, d)
                bass.add(np.tanh(s * 1.5), tn, 0.32)

# crashes on drops / section starts
for t0 in DROPS + [4, 12, 22, 37.5]:
    drums.add(CR, t0, 0.55)
    verb_send.add(CR, t0, 0.15)

# snare rolls (accelerating) into drops
for start, end in ((14.0, 15.5), (38.0, 39.75), (44.0, 45.5)):
    t = start
    while t < end - 1e-6:
        k = (t - start) / (end - start)
        step = S16 if k < 0.5 else S16 / 2
        drums.add(CL * (0.25 + 0.75 * k), t, 0.45, 0.0)
        t += step

# risers, impacts, downlifters
for t0, d, g in ((0.0, 2.0, 0.35), (3.0, 1.0, 0.35), (13.5, 2.0, 0.45), (35.0, 2.5, 0.45), (37.75, 2.0, 0.4), (43.5, 2.0, 0.45)):
    fx.add(mk_riser(d), t0, g)
    verb_send.add(mk_riser(d), t0, g * 0.3)
for imp in ev['impacts']:
    k = imp.get('k', 1)
    fx.add(mk_impact(k), imp['t'], 0.28 + 0.3 * min(k, 1.4))
    verb_send.add(mk_impact(k), imp['t'], 0.12)
    fx.add(mk_whoosh(0.4), imp['t'] - 0.4, 0.3 * min(k, 1.2))
for t0 in (2.0, 16.0, 46.0):
    fx.add(mk_downlifter(1.8), t0 + 0.1, 0.25)

# ---------------------------------------------------------------- text SFX (synced to overlay animations)
def key_click(v):
    t = tt(0.045)
    f = 1500 + 900 * v
    tone = np.sin(2 * np.pi * f * t) * np.exp(-t * 160) * 0.5
    n = bp(rng.standard_normal(len(t)), 1800, 9000) * np.exp(-t * 220)
    thock = np.sin(2 * np.pi * (180 + 60 * v) * t) * np.exp(-t * 90) * 0.6
    return n + tone + thock


def blip(v):
    t = tt(0.03)
    f = 900 + 2600 * v
    return np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 90) * 0.4


def lock_sound():
    t = tt(0.25)
    s = np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 18) + np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 24) * 0.6
    return s * 0.5


def slam_hit():
    t = tt(0.45)
    f = 60 + 200 * np.exp(-t * 40)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    crack = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 45) * 0.6
    return np.tanh((thump + crack) * 1.6)


def pop():
    t = tt(0.09)
    f = 500 + 1400 * (1 - np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35)


def shimmer():
    t = tt(1.2)
    s = sum(np.sin(2 * np.pi * note(n) * t) * np.exp(-np.maximum(t - i * 0.06, 0) * 4) * (t >= i * 0.06)
            for i, n in enumerate([81, 84, 88, 93, 96]))
    return s * 0.25


for e in ev['sfx']:
    k, t0, v = e['kind'], e['t'], e.get('v', 0.5)
    pan = (v - 0.5) * 0.6
    if k == 'key':
        sfx.add(key_click(v), t0, 0.32, pan)
    elif k == 'blip':
        sfx.add(blip(v), t0, 0.07, pan)
    elif k == 'lock':
        sfx.add(lock_sound(), t0, 0.16)
        delay_send.add(lock_sound(), t0, 0.06)
    elif k == 'slam':
        sfx.add(mk_whoosh(0.22), t0 - 0.2, 0.22)
        sfx.add(slam_hit(), t0 + 0.12, 0.45)
        verb_send.add(slam_hit(), t0 + 0.12, 0.1)
    elif k == 'pop':
        sfx.add(pop(), t0 + 0.05, 0.3, pan)
    elif k == 'shimmer':
        sfx.add(shimmer(), t0, 0.5)
        verb_send.add(shimmer(), t0, 0.2)
    elif k == 'swish':
        sfx.add(mk_whoosh(0.3), t0 - 0.05, 0.18)

# ---------------------------------------------------------------- mix
tn = np.arange(N) / SR
# sidechain from the kick pattern
sc = np.ones(N)
for b in np.arange(0, DUR, BEAT):
    if in_sec(KICK, b) and not in_gap(b + 0.01):
        i = int(b * SR)
        j = min(N, i + int(BEAT * SR))
        sec = section(b + 0.01)
        depth = 0.75 if sec in ('drop', 'final') else 0.5
        sc[i:j] = np.minimum(sc[i:j], 1 - depth * np.exp(-(tn[i:j] - b) * 8.5))

gapmask = np.ones(N)
for d in DROPS + [40]:
    a = int((d - (0.25 if d == 40 else 0.5)) * SR)
    gapmask[a:int(d * SR)] = 0.0
gapmask = np.convolve(gapmask, np.ones(240) / 240, mode='same')

music_st = (music.st() + lead.st()) * sc * gapmask
bass_st = bass.st() * sc * gapmask
drums_st = drums.st() * gapmask

# stutter edit at the end of the 4th reason (33.5 -> 34): repeat 1/16 slices of the music
def stutter(x, a, b, slice_len):
    i0, i1, sl = int(a * SR), int(b * SR), int(slice_len * SR)
    seg = x[:, i0:i0 + sl].copy()
    ramp = np.linspace(1, 0, 64)
    seg[:, -64:] *= ramp
    for i in range(i0, i1, sl):
        n = min(sl, i1 - i)
        x[:, i:i + n] = seg[:, :n]


for bus in (music_st, bass_st, drums_st):
    stutter(bus, 33.5, 33.75, S16)
    stutter(bus, 33.75, 34.0, S16 / 2)

# ping-pong dotted-8th delay
dl = int(BEAT * 0.75 * SR)
dsrc = delay_send.st()
dly = np.zeros_like(dsrc)
fb = 0.38
src = lp(dsrc[0] + dsrc[1], 5000) * 0.5
for k in range(1, 6):
    shift = dl * k
    g = fb ** (k - 1)
    ch = (k - 1) % 2
    dly[ch, shift:] += src[:N - shift] * g

# reverb (stereo, decorrelated IRs)
ir_t = tt(2.8)
irs = []
for s in (1, 2):
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 2.2)
    ir = lp(ir, 6500)
    ir[: int(0.012 * SR)] = 0
    irs.append(ir / np.sqrt(np.sum(ir ** 2)))
vs = verb_send.st()
rev = np.stack([fftconvolve(vs[0], irs[0])[:N], fftconvolve(vs[1], irs[1])[:N]]) * 0.55

# bus balance (measured: drums ~-16, bass ~-18, music ~-19 in drops / -23 in verses)
mix = drums_st * 0.3 + bass_st * 0.8 + music_st * 4.0 + fx.st() * 0.5 + sfx.st() * 1.2 + dly * 6.0 + rev * 1.0
mix = np.stack([hp(mix[0], 28), hp(mix[1], 28)])

# master: pre-gain to ~-12 dB RMS in the drops, look-ahead peak limiter, light saturation
from scipy.ndimage import maximum_filter1d
seg = mix[:, int(16 * SR):int(22 * SR)]
mix *= 10 ** (-11 / 20) / np.sqrt(np.mean(seg ** 2))
mix = np.tanh(mix * 1.1) / 1.1
peak = maximum_filter1d(np.max(np.abs(mix), axis=0), size=int(0.006 * SR))
ceiling = 0.89
g = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
# gain = windowed minimum (look-ahead attack) smoothed to a ~50 ms release
gs = -maximum_filter1d(-g, size=int(0.02 * SR))
gs = lp(gs, 15)
gs = np.minimum(gs, -maximum_filter1d(-g, size=int(0.004 * SR)))
mix *= gs
fade = np.clip(tn / 0.03, 0, 1) * np.clip((DUR - tn) / 2.5, 0, 1)
mix *= fade
mix = np.clip(mix, -0.98, 0.98)

pcm = (mix.T * 32767).astype(np.int16)
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', OUT)
