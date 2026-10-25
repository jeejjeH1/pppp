"""Cinematic soundtrack for the Prismax latency piece, generated from src/timeline.json.

    python3 src/audio.py src/timeline.json out/soundtrack.wav

D-minor drone and pad, a 75 BPM heartbeat through the middle, a ticking clock under the
latency/execution scenes, plus risers, sub impacts, whooshes, glitch bursts, counter and
tile ticks and bell accents, all placed on the picture's cue times. Requires numpy + scipy.
"""
import json
import sys
import wave

import numpy as np
from scipy.ndimage import maximum_filter1d
from scipy.signal import butter, fftconvolve, sosfilt, sosfilt_zi

SR = 48000
TL = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'src/timeline.json'))
OUT = sys.argv[2] if len(sys.argv) > 2 else 'out/soundtrack.wav'
DUR = float(TL['duration'])
N = int(SR * DUR)
rng = np.random.default_rng(11)
SCENE = {s[0]: (s[1], s[2]) for s in TL['scenes']}


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, t0, gain=1.0, pan=0.0):
        s = sig if sig.ndim == 2 else np.stack([sig, sig])
        i = int(round(t0 * SR))
        if i < 0:
            s, i = s[:, -i:], 0
        n = min(s.shape[1], N - i)
        if n <= 0:
            return
        self.x[0, i:i + n] += s[0, :n] * gain * np.sqrt(1 - pan)
        self.x[1, i:i + n] += s[1, :n] * gain * np.sqrt(1 + pan)


music, beat, fx, verb = Bus(), Bus(), Bus(), Bus()


def tt(d):
    return np.arange(int(d * SR)) / SR


def note(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, f, o=2):
    return sosfilt(butter(o, f / (SR / 2), 'low', output='sos'), x)


def hp(x, f, o=2):
    return sosfilt(butter(o, f / (SR / 2), 'high', output='sos'), x)


def env(n, a, r):
    t = np.arange(n) / SR
    return np.clip(t / max(a, 1e-4), 0, 1) * np.clip((n / SR - t) / max(r, 1e-4), 0, 1)


def sweep_bp(x, f0, f1, q=2.0, block=512):
    """Band-pass with a centre frequency gliding exponentially from f0 to f1."""
    y = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    zi = None
    for b in range(nb):
        f = f0 * (f1 / f0) ** (b / max(nb - 1, 1))
        lo, hi = f / (1 + 0.5 / q), min(f * (1 + 0.5 / q), SR / 2 * 0.95)
        sos = butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band', output='sos')
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        seg = x[b * block:(b + 1) * block]
        y[b * block:b * block + len(seg)], zi = sosfilt(sos, seg, zi=zi)
    return y


# ------------------------------------------------------------------ instruments
def pad(notes, d):
    t = tt(d)
    l, r = np.zeros(len(t)), np.zeros(len(t))
    for n in notes:
        for det, p in ((-0.08, -0.7), (0.0, 0.0), (0.08, 0.7)):
            f = note(n) * 2 ** (det / 12)
            saw = 2 * ((f * t + rng.random()) % 1) - 1
            l += saw * (1 - p) / 2
            r += saw * (1 + p) / 2
    lfo = 700 + 300 * np.sin(2 * np.pi * t / 7)
    e = env(len(t), 2.0, 2.5)
    return np.stack([lp(l, 900) * (0.8 + 0.2 * np.sin(2 * np.pi * t / 5)), lp(r, 900)]) * e / len(notes) * (lfo / 1000)


def drone(f, d):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2 * t + 0.3) + 0.25 * np.tanh(3 * np.sin(2 * np.pi * f * 0.5 * t))
    return lp(s, 400) * env(len(t), 3.0, 3.0) * (0.85 + 0.15 * np.sin(2 * np.pi * t / 3.3))


def kick(g=1.0):
    t = tt(0.6)
    f = 42 + 70 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)
    click = hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 300) * 0.15
    return (s + click) * g


def hat(g=1.0, d=0.045):
    t = tt(d)
    return hp(rng.standard_normal(len(t)), 7000, 4) * np.exp(-t * 90) * g


def tick(f=2400, d=0.03):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.5 * hp(rng.standard_normal(len(t)), 4000)) * np.exp(-t * 180)


def impact(a):
    t = tt(4.0)
    f = 30 + 55 * np.exp(-t * 7)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.3)
    noise = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 9)
    crack = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 60) * 0.5
    s = np.tanh((sub * 1.4 + noise * 0.6 + crack) * 1.3)
    return np.stack([s, np.roll(s, 90)]) * a


def riser(d):
    t = tt(d)
    x = t / d
    n = sweep_bp(rng.standard_normal(len(t)), 300, 7000, q=1.5)
    tone = sum(np.sin(2 * np.pi * np.cumsum(f0 * 2 ** (x * 2)) / SR) for f0 in (110, 165, 220.5)) / 3
    e = x ** 2.5 * np.clip((d - t) / 0.03, 0, 1)
    return np.stack([n * e + tone * e * 0.35, np.roll(n, 300) * e + tone * e * 0.35])


def whoosh(d):
    t = tt(d)
    n = sweep_bp(rng.standard_normal(len(t)), 250, 5000, q=1.2)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    pan = np.linspace(-0.8, 0.8, len(t))
    return np.stack([n * e * np.sqrt(1 - pan), n * e * np.sqrt(1 + pan)])


def bell(f, d=4.0):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * (1.0 + k * 0.9))
            for k, (m, a) in enumerate(((1, 1), (2.76, 0.4), (5.4, 0.18), (8.93, 0.07))))
    return s * env(len(t), 0.002, 1.0)


def pop():
    t = tt(0.25)
    f = 900 + 600 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22)


def glitch(t0):
    for k in range(10):
        d = 0.02 + rng.random() * 0.05
        t = tt(d)
        s = np.sign(np.sin(2 * np.pi * (200 + rng.random() * 2000) * t)) * 0.5 + rng.standard_normal(len(t)) * 0.5
        s = np.round(s * 4) / 4
        fx.add(s * env(len(t), 0.002, 0.005), t0 - 0.25 + k * 0.05, 0.10, rng.uniform(-0.8, 0.8))


# ------------------------------------------------------------------ score
CH = [[50, 53, 57, 62], [46, 50, 53, 58], [53, 57, 60, 65], [48, 52, 55, 60]]  # Dm Bb F C
ROOT = [38, 34, 41, 36]
for k in range(int(np.ceil(DUR / 8))):
    t0 = k * 8.0
    ci = k % 4 if t0 < 48 else 0
    music.add(pad(CH[ci], 10.0), t0 - 0.8, 0.32)
    music.add(drone(note(ROOT[ci] - 12), 10.0), t0 - 0.8, 0.30)

# heartbeat + clock through the analytical middle section
a, b = SCENE['deploy'][0], SCENE['gap'][1]
for bt in np.arange(a, b, 0.8):
    beat.add(kick(), bt, 0.55)
for bt in np.arange(SCENE['latency'][0], SCENE['exec'][1], 0.2):
    beat.add(hat(), bt, 0.06 if round((bt - a) / 0.2) % 2 else 0.11, 0.35)
for bt in np.arange(SCENE['rollout'][0], SCENE['gap'][1], 0.4):
    beat.add(hat(d=0.08), bt + 0.2, 0.07, -0.3)

for t0, t1 in TL['risers']:
    fx.add(riser(t1 - t0), t0, 0.16)
for h, amp in TL['impacts']:
    fx.add(impact(amp), h, 0.55)
    verb.add(impact(amp), h, 0.25)
for h, d in TL['whooshes']:
    fx.add(whoosh(d), h - d / 2, 0.22)
for h in TL['glitches']:
    glitch(h)
for h, kind in TL['accents']:
    if kind == 'chime':
        for i, n in enumerate((86, 81, 74)):
            fx.add(bell(note(n)), h + i * 0.09, 0.07, (i - 1) * 0.4)
            verb.add(bell(note(n)), h + i * 0.09, 0.06)
    elif kind == 'shimmer':
        for i, n in enumerate((74, 77, 81, 86, 89)):
            fx.add(bell(note(n), 2.5), h + i * 0.07, 0.035, (i - 2) * 0.3)
            verb.add(bell(note(n), 2.5), h + i * 0.07, 0.05)
    elif kind == 'pop':
        fx.add(pop(), h, 0.12)
    elif kind == 'lock':
        fx.add(tick(1800, 0.05), h, 0.25)
        fx.add(kick(0.7), h, 0.35)
        verb.add(bell(note(81), 2.0), h, 0.05)

# counter ticks: one per 10 ms crossed (same easing as the dial)
c0, c1, vmax = TL['counter']
ts = np.linspace(0, 1, 4000)
vals = vmax * (1 - (1 - ts) ** 3)
for m in range(10, int(vmax) + 1, 10):
    fx.add(tick(2600), c0 + (c1 - c0) * ts[np.argmax(vals >= m)], 0.12, 0.25)
# rollout tiles: tick when each flips over
f0, step, cnt = TL['flips']
for k in range(int(cnt)):
    fx.add(tick(1500 + (k % 5) * 180, 0.04), f0 + k * step + 0.175, 0.08, -0.4 + 0.8 * (k % 8) / 7)

# outro: resolve on a wide D chord
o = SCENE['outro'][0]
music.add(pad([50, 57, 62, 66, 69], DUR - o + 1), o - 0.2, 0.45)
for i, n in enumerate((62, 69, 74, 78)):
    verb.add(bell(note(n), 5.0), o + 1.3 + i * 0.12, 0.05)

# ------------------------------------------------------------------ mix
duck = np.ones(N)  # sidechain-style dip on impacts
for h, amp in TL['impacts']:
    i = int(h * SR)
    k = np.arange(N - i) / SR
    duck[i:] *= 1 - 0.55 * amp * np.exp(-k * 3)
music.x *= duck

ir_t = tt(3.8)
rev = np.zeros((2, N))
src = verb.x + music.x * 0.25 + fx.x * 0.3
for ch in (0, 1):
    ir = lp(rng.standard_normal(len(ir_t)), 6000) * np.exp(-ir_t * 1.6)
    ir[: int(0.015 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    rev[ch] = fftconvolve(src[ch], ir)[:N]

mix = music.x + beat.x + fx.x + rev * 0.45
mix = np.stack([hp(mix[0], 25), hp(mix[1], 25)])
mix *= 10 ** (-15 / 20) / np.sqrt(np.mean(mix ** 2))
peak = maximum_filter1d(np.max(np.abs(mix), axis=0), size=int(0.01 * SR))
g = np.minimum(1.0, 0.89 / np.maximum(peak, 1e-9))
g = lp(-maximum_filter1d(-g, size=int(0.02 * SR)), 10)
mix *= np.minimum(g, 1.0)
tn = np.arange(N) / SR
mix *= np.clip(tn / 0.3, 0, 1) * np.clip((DUR - tn) / 1.2, 0, 1)
mix = np.clip(mix, -0.97, 0.97)

with wave.open(OUT, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print('wrote', OUT)
