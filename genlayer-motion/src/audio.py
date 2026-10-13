"""Calm, minimal ambient soundtrack (56 s), aligned to the picture's 4-second phrases.

    node src/events.js out/events.json
    python3 src/audio.py out/events.json out/soundtrack.wav

Soft FM electric piano, warm pad, sine sub, sparse glass melody, a very quiet
heartbeat pulse in the middle and long reverb. No typing / UI sound effects.
Requires numpy + scipy.
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import maximum_filter1d

SR = 48000
ev = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'out/events.json'))
OUT = sys.argv[2] if len(sys.argv) > 2 else 'out/soundtrack.wav'
DUR = float(ev['duration'])
N = int(SR * DUR)
CHORD_LEN = 4.0
rng = np.random.default_rng(3)


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, t0, gain=1.0, pan=0.0):
        s = sig if sig.ndim == 2 else np.stack([sig, sig])
        i = int(round(t0 * SR))
        a = max(0, -i)
        s = s[:, a:]
        i = max(0, i)
        n = min(s.shape[1], N - i)
        if n <= 0:
            return
        self.x[0, i:i + n] += s[0, :n] * gain * np.sqrt(1 - pan)
        self.x[1, i:i + n] += s[1, :n] * gain * np.sqrt(1 + pan)


keys, pad, sub, mel, pulse, air = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
verb, delay = Bus(), Bus()


def tt(d):
    return np.arange(int(d * SR)) / SR


def note(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, f):
    return sosfilt(butter(2, f / (SR / 2), 'low', output='sos'), x)


def hp(x, f):
    return sosfilt(butter(2, f / (SR / 2), 'high', output='sos'), x)


def fade_env(n, a, r):
    t = np.arange(n) / SR
    d = n / SR
    return np.clip(t / a, 0, 1) * np.clip((d - t) / r, 0, 1)


# ---------------------------------------------------------------- instruments
def epiano(f, d=3.5, vel=1.0):
    """FM electric piano: soft bell attack, warm decay."""
    t = tt(d)
    idx = (1.1 * np.exp(-t * 2.5) + 0.12) * vel
    mod = np.sin(2 * np.pi * f * t) * idx
    car = np.sin(2 * np.pi * f * t + mod)
    tine = np.sin(2 * np.pi * f * 7.0 * t) * np.exp(-t * 18) * 0.04
    env = np.exp(-t * 0.9) * fade_env(len(t), 0.004, 0.4)
    return (car + tine) * env * vel


def glass(f, d=3.0):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 2) + 0.08 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 4)
    return s * np.exp(-t * 1.3) * fade_env(len(t), 0.01, 0.5)


def pad_voice(notes, d):
    t = tt(d)
    l = np.zeros(len(t))
    r = np.zeros(len(t))
    for n in notes:
        f = note(n)
        for det, p in ((-0.07, -0.8), (0.0, 0.0), (0.07, 0.8)):
            ff = f * 2 ** (det / 12)
            tri = 2 * np.abs(2 * ((ff * t + rng.random()) % 1) - 1) - 1
            l += tri * (1 - p) / 2
            r += tri * (1 + p) / 2
    env = fade_env(len(t), 1.6, 1.8)
    return np.stack([lp(l, 900), lp(r, 900)]) * env / len(notes)


def sub_bass(f, d):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t)
    s = np.tanh(s * 1.4) / np.tanh(1.4)
    return s * fade_env(len(t), 0.25, 0.6)


def soft_kick():
    t = tt(0.5)
    f = 44 + 40 * np.exp(-t * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)


def shaker():
    t = tt(0.05)
    return hp(rng.standard_normal(len(t)), 6000) * np.exp(-t * 80)


def chime(base=88):
    t = tt(4.0)
    s = sum(np.sin(2 * np.pi * note(base) * m * t) * np.exp(-t * (1.2 + k)) * a
            for k, (m, a) in enumerate(((1, 1), (2.76, 0.35), (5.4, 0.15), (8.93, 0.06))))
    return s * fade_env(len(t), 0.003, 1.0)


def swell(d):
    t = tt(d)
    n = rng.standard_normal(len(t))
    s = lp(n, 1200) * (t / d) ** 3
    return np.stack([s, np.roll(s, 400)])


# ---------------------------------------------------------------- harmony
AM9 = dict(root=45, pad=[57, 60, 64, 67, 71], keys=[57, 64, 67, 71, 72])
FMAJ9 = dict(root=41, pad=[53, 57, 60, 64, 67], keys=[53, 60, 64, 67, 69])
CMAJ9 = dict(root=48, pad=[52, 55, 59, 62, 64], keys=[52, 59, 62, 64, 67])
G6 = dict(root=43, pad=[55, 59, 62, 64, 67], keys=[55, 62, 64, 67, 71])
PROG = [AM9, FMAJ9, CMAJ9, G6]
n_chords = int(np.ceil(DUR / CHORD_LEN))

for c in range(n_chords):
    t0 = c * CHORD_LEN
    ch = PROG[c % 4] if t0 < 48 else AM9  # resolve home for the ending
    # pad (always), slightly louder in the middle
    pad.add(pad_voice(ch['pad'], CHORD_LEN + 1.8), t0 - 0.4, 0.34 if 4 <= t0 < 48 else 0.28)
    # broken chord on the electric piano
    if t0 >= 2:
        for i, n in enumerate(ch['keys']):
            keys.add(epiano(note(n), 3.8, 0.75 - i * 0.07), t0 + i * 0.11, 0.11, (i - 2) * 0.18)
        if 8 <= t0 < 50:  # gentle answer on the third beat
            for i, n in enumerate(ch['keys'][1:4]):
                keys.add(epiano(note(n), 2.0, 0.45), t0 + 2.0 + i * 0.09, 0.07, (1 - i) * 0.3)
    # sub
    if t0 >= 4:
        sub.add(sub_bass(note(ch['root'] - 12), CHORD_LEN + 0.3), t0, 0.32)

# sparse glass melody (A minor pentatonic), 8-second phrases
PH_A = [(0, 76), (1, 74), (2, 72), (3.5, 74), (4, 69)]
PH_B = [(0, 72), (1, 74), (2, 76), (3, 79), (4, 76), (6, 74)]
for start, ph, g in ((8, PH_A, 0.07), (16, PH_B, 0.08), (24, PH_A, 0.07), (32, PH_B, 0.06), (40, PH_A, 0.08), (46, PH_B, 0.08)):
    for dt, n in ph:
        mel.add(glass(note(n)), start + dt, g, 0.25)
mel.add(glass(note(69), 5.0), 52.0, 0.08, 0.0)

# quiet heartbeat pulse in the middle section, airy shaker on the off-beats
for b in np.arange(16, 50, 1.0):
    pulse.add(soft_kick(), b, 0.28 if b < 46 else 0.32)
for b in np.arange(22.5, 46, 1.0):
    pulse.add(shaker(), b, 0.035, 0.3)

# gentle accents at the big moments (logo, Intelligent Contracts, consensus, finale)
for t0, base in ((2.0, 88), (16.0, 84), (34.0, 88), (46.0, 81)):
    mel.add(chime(base), t0, 0.05, 0.1)
    verb.add(chime(base), t0, 0.04)
for t0, d in ((0.0, 2.0), (44.0, 2.0)):
    air.add(swell(d), t0, 0.05)

# air bed (very low)
bed = lp(rng.standard_normal(N), 2500)
air.add(np.stack([bed, np.roll(bed, 977)]) * (0.6 + 0.4 * np.sin(2 * np.pi * np.arange(N) / SR / 9)), 0, 0.006)

# bus balance (measured in the 16-46 s section): keys ~-20, pad ~-22, sub ~-24, melody ~-24 dB
keys.x *= 2.4
mel.x *= 2.2
sub.x *= 0.25
pulse.x *= 0.75
air.x *= 3.0

# ---------------------------------------------------------------- space
for b, g in ((keys, 0.6), (mel, 0.8), (pad, 0.35)):
    verb.x += b.x * g
    delay.x += b.x * (0.3 if b is not pad else 0)

dl = int(0.75 * SR)
dsrc = lp(delay.x[0] + delay.x[1], 4000) * 0.5
dly = np.zeros((2, N))
for k in range(1, 6):
    s = dl * k
    dly[(k - 1) % 2, s:] += dsrc[:N - s] * 0.42 ** (k - 1)

ir_t = tt(4.5)
rev = np.zeros((2, N))
for ch in (0, 1):
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 1.35)
    ir = lp(ir, 5000)
    ir[: int(0.02 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    rev[ch] = fftconvolve(verb.x[ch], ir)[:N]

mix = keys.x + pad.x + sub.x + mel.x + pulse.x + air.x + dly * 1.2 + rev * 0.5
mix = np.stack([hp(mix[0], 30), hp(mix[1], 30)])

# master: target ~-15 dB RMS, transparent peak limiting at -1.5 dBFS
mid = mix[:, int(16 * SR):int(46 * SR)]
mix *= 10 ** (-15 / 20) / np.sqrt(np.mean(mid ** 2))
peak = maximum_filter1d(np.max(np.abs(mix), axis=0), size=int(0.01 * SR))
g = np.minimum(1.0, 0.84 / np.maximum(peak, 1e-9))
g = lp(-maximum_filter1d(-g, size=int(0.03 * SR)), 8)
mix *= np.minimum(g, 1.0)
tn = np.arange(N) / SR
mix *= np.clip(tn / 0.8, 0, 1) * np.clip((DUR - tn) / 3.5, 0, 1)
mix = np.clip(mix, -0.95, 0.95)

pcm = (mix.T * 32767).astype(np.int16)
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', OUT)
