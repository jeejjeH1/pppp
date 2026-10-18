# Cinematic score + SFX + narration mix for v3.
#   python3 src/v3/audio.py out/v3     (reads timeline.json, sfx.json, voice.wav; writes soundtrack.wav)
# Score: D-minor pads (dark/bright crossfade), Zimmer-style ticking sub pulse, clock ticks, plucked arp,
# taiko-ish drums. Everything is automated from the narration timeline and ducked under the voice.
import json, os, sys, wave
import numpy as np
from scipy import signal

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out/v3'
SR = 48000
tl = json.load(open(os.path.join(OUT, 'timeline.json')))
sfx = json.load(open(os.path.join(OUT, 'sfx.json')))
L = {l['id']: l for l in tl['lines']}
s = lambda i: L[i]['start']
DUR = tl['duration']
N = int(DUR * SR) + SR
T = np.arange(N) / SR
rng = np.random.default_rng(7)


def lp(x, f, o=2):
    return signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x, axis=-1)


def hp(x, f, o=2):
    return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x, axis=-1)


def bp(x, a, b, o=2):
    return signal.sosfilt(signal.butter(o, [a, b], 'band', fs=SR, output='sos'), x, axis=-1)


def auto(points):
    pts = sorted(points)
    return np.interp(T, [p[0] for p in pts], [p[1] for p in pts])


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def reverb(x, secs=3.5, wet=0.35, seed=1, damp=4000):
    r = np.random.default_rng(seed)
    n = int(secs * SR)
    env = np.exp(-np.linspace(0, 7, n))
    out = []
    for ch in range(2):
        ir = r.standard_normal(n) * env
        ir = lp(ir, damp)
        ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        ir /= np.sqrt(np.sum(ir ** 2))
        out.append(signal.fftconvolve(x, ir)[: len(x)])
    return np.stack(out) * wet


def place(buf, t, x, g=1.0):
    i = int(t * SR)
    if i >= buf.shape[-1]:
        return
    if x.ndim == 1:
        x = np.stack([x, x])
    n = min(x.shape[-1], buf.shape[-1] - i)
    buf[:, i:i + n] += x[:, :n] * g


def env(n, a=0.005, d=0.3, curve=6):
    t = np.arange(n) / SR
    e = np.exp(-t / d * (curve / 6))
    k = int(a * SR)
    if k:
        e[:k] *= np.linspace(0, 1, k)
    return e


def noise(sec):
    return rng.standard_normal(int(sec * SR))


# ------------------------------------------------------------------ SFX bank
def sfx_whoosh(sec=1.1, up=True):
    n = int(sec * SR)
    x = noise(sec)
    t = np.arange(n) / n
    shape = np.sin(np.pi * t ** (0.6 if up else 1.4)) ** 2
    lo = bp(x, 300, 2500) * shape
    hi = bp(x, 2500, 9000) * shape ** 2 * 0.5
    y = (lo + hi) * 0.5
    pan = np.linspace(-0.7, 0.7, n)
    return np.stack([y * (1 - pan) * 0.7, y * (1 + pan) * 0.7])


def sfx_impact(big=1.0):
    n = int(3.5 * SR)
    t = np.arange(n) / SR
    f = 34 + 70 * np.exp(-t * 18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    crack = hp(noise(3.5), 1200) * np.exp(-t * 22) * 0.6
    body = lp(noise(3.5), 400) * np.exp(-t * 6) * 0.8
    y = np.tanh((sub * 1.4 + crack + body) * 1.4 * big) * 0.9
    return np.stack([y, y]) + reverb(y, 3.0, 0.4 * big, seed=3)


def sfx_braam():
    n = int(4.5 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for note in (26, 38, 45, 50):
        for d in (-0.12, 0.0, 0.11):
            ph = 2 * np.pi * midi(note + d) * t
            y += signal.sawtooth(ph) * (0.5 if note < 40 else 0.3)
    e = np.minimum(1, t / 0.05) * np.exp(-t * 0.7)
    sweep = 200 + 1600 * np.exp(-t * 2.2)
    # time-varying low-pass via 3 bands crossfaded
    lo = lp(y, 300)
    mid = lp(y, 900)
    hi = lp(y, 2500)
    k = np.clip((sweep - 200) / 1600, 0, 1)
    z = (lo * (1 - k) + (mid * 0.6 + hi * 0.4) * k) * e * 0.18
    imp = sfx_impact(0.8)[0]
    z = np.tanh(z * 2.0) * 0.7
    z[: len(imp)] += imp[:n] * 0.6
    return np.stack([z, z]) + reverb(z, 4, 0.45, seed=5)


def sfx_riser(sec):
    n = int(sec * SR)
    t = np.arange(n) / SR
    k = t / sec
    x = bp(noise(sec), 500, 8000) * k ** 2.5 * 0.35
    f = 120 * 2 ** (k * 4)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * k ** 2 * 0.15
    y = x + tone
    return np.stack([y, y]) + reverb(y, 2, 0.3, seed=9)


def sfx_tick(g=1.0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 90) + hp(noise(0.25), 5000) * np.exp(-t * 160) * 0.5
    return y * 0.45 * g


def sfx_chime():
    n = int(4 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, a in ((midi(81), 1), (midi(88), 0.6), (midi(93), 0.4)):
        mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t * 3)
        y += np.sin(2 * np.pi * f * t + mod) * a * np.exp(-t * 1.6)
    y *= 0.12
    return np.stack([y, y]) + reverb(y, 3.5, 0.6, seed=11)


def sfx_clack():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    y = bp(noise(0.12), 900, 3500) * np.exp(-t * 70) + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 50) * 0.6
    return y * 0.5


def sfx_shatter():
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    y = hp(noise(2.5), 2000) * np.exp(-t * 4) * 0.5
    for k in range(40):
        st = rng.uniform(0, 0.7)
        f = rng.uniform(2500, 7000)
        i = int(st * SR)
        m = n - i
        tt = np.arange(m) / SR
        y[i:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * rng.uniform(15, 40)) * 0.18
    imp = sfx_impact(0.7)[0]
    y[: min(n, len(imp))] += imp[:n] * 0.7
    return np.stack([y, np.roll(y, 300)]) + reverb(y, 2.5, 0.4, seed=13)


def sfx_swell(sec=2.2):
    n = int(sec * SR)
    k = np.arange(n) / n
    y = bp(noise(sec), 3000, 12000) * k ** 3 * 0.4
    y[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return y


def sfx_alert():
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 1320 * t) * ((t < 0.09) | ((t > 0.16) & (t < 0.25))) * 0.18
    return np.stack([y, y]) + reverb(y, 1.2, 0.3)


def sfx_stamp():
    n = int(0.8 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * (70 + 120 * np.exp(-t * 40)) * t) * np.exp(-t * 14) + lp(noise(0.8), 1500) * np.exp(-t * 30) * 0.7
    return np.tanh(y * 1.5) * 0.7


def sfx_deny():
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    y = signal.square(2 * np.pi * 110 * t) * 0.3 + signal.square(2 * np.pi * 116.5 * t) * 0.3
    y = lp(y, 1800) * np.exp(-t * 5) * 0.5
    st = sfx_stamp()
    y[: len(st)] += st[:n] * 0.6
    return y


def sfx_glitch(sec=0.6):
    n = int(sec * SR)
    y = np.zeros(n)
    i = 0
    while i < n:
        m = int(rng.uniform(0.01, 0.05) * SR)
        kind = rng.integers(3)
        seg = rng.standard_normal(m) if kind == 0 else signal.square(2 * np.pi * rng.uniform(80, 1600) * np.arange(m) / SR)
        if rng.random() < 0.3:
            seg *= 0
        k = min(m, n - i)
        y[i:i + k] = seg[:k] * 0.35
        i += m
    y = np.round(y * 8) / 8
    return np.stack([y, -y * 0.8])


def sfx_hit():
    y = sfx_impact(0.6)
    return y * 0.8


def sfx_scan(sec=1.4):
    n = int(sec * SR)
    t = np.arange(n) / SR
    f = 300 + 2200 * t / sec
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / sec) * 0.12 + bp(noise(sec), 1500, 6000) * np.sin(np.pi * t / sec) * 0.08
    pan = np.linspace(-1, 1, n)
    return np.stack([y * (1 - pan) * 0.8, y * (1 + pan) * 0.8])


def sfx_coin():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * midi(88) * t) * (t < 0.08) + np.sin(2 * np.pi * midi(95) * t) * (t >= 0.08)) * np.exp(-t * 5) * 0.16
    return np.stack([y, y]) + reverb(y, 1.5, 0.4)


def sfx_anvil():
    n = int(4 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, d in ((523, 2.2), (1187, 1.6), (1843, 1.1), (2690, 0.8), (3510, 0.6)):
        y += np.sin(2 * np.pi * f * t) * np.exp(-t * d * 2.5) * 0.12
    y += hp(noise(4), 3000) * np.exp(-t * 50) * 0.6
    imp = sfx_impact(1.3)[0]
    z = y.copy()
    z[: len(imp)] += imp[:n] * 0.9
    return np.stack([z, z]) + reverb(z, 4, 0.5, seed=17)


BANK = {
    'whoosh': lambda: sfx_whoosh(1.1) * 0.8,
    'whip': lambda: sfx_whoosh(0.45, False) * 1.1,
    'swipe': lambda: sfx_whoosh(0.7) * 0.9,
    'impact': sfx_impact,
    'boom': lambda: sfx_impact(1.1),
    'braam': sfx_braam,
    'tick': sfx_tick,
    'chime': sfx_chime,
    'clack': sfx_clack,
    'shatter': sfx_shatter,
    'swell': sfx_swell,
    'alert': sfx_alert,
    'stamp': sfx_stamp,
    'deny': sfx_deny,
    'glitch': sfx_glitch,
    'hit': sfx_hit,
    'scan': sfx_scan,
    'coin': sfx_coin,
    'anvil': sfx_anvil,
}
PRE = {'swell': 2.2, 'whoosh': 0.55, 'whip': 0.22, 'swipe': 0.35}  # sounds that peak at their end

fx = np.zeros((2, N))
for ev in sfx:
    typ = ev['type']
    if typ == 'none' or typ not in BANK:
        continue
    x = BANK[typ]()
    if x.ndim == 1:
        x = np.stack([x, x])
    place(fx, max(0, ev['t'] - PRE.get(typ, 0)), x, ev['gain'] * 0.9)
# intro riser into the brand hit
place(fx, 0.1, sfx_riser(s('brand') - 0.1), 1.0)
place(fx, s('expand') + 2.5, sfx_riser(s('end') - s('expand') - 2.9), 0.8)

# ------------------------------------------------------------------ score
# section automation (0..1)
tR, tP, tE, tW, tRaw, tC, tCo, tV, tO, tF, tX, tEnd = (s(i) for i in ('rules', 'problem', 'enter', 'why', 'raw', 'combine', 'course', 'vision', 'open', 'future', 'expand', 'end'))
g_pad = auto([(0, 0.0), (1.5, 0.5), (tR, 0.7), (tP - 0.3, 0.7), (tP, 0.9), (tE, 0.8), (tX, 0.9), (tEnd, 1.0), (DUR, 0.0)])
g_bright = auto([(0, 0), (tE - 0.1, 0), (tE + 0.5, 1), (tW - 0.5, 1), (tW, 0.2), (tO - 0.3, 0.2), (tO, 1), (tF, 0.3), (tX, 0.6), (tEnd, 1), (DUR, 1)])
g_pulse = auto([(0, 0), (tR - 0.2, 0), (tR, 0.55), (tP - 0.2, 0.75), (tP, 0), (tE + 1.5, 0), (tE + 3, 0.4), (tW, 0.6), (tRaw, 0.5), (tC, 0.85), (tCo - 0.1, 1), (tCo, 0.2), (tV, 1), (tO, 0.7), (tF, 0.5), (tX, 0.9), (tEnd - 0.3, 1.0), (tEnd, 0), (DUR, 0)])
g_tick = auto([(0, 0), (tR, 0), (tR + 0.5, 0.6), (tP, 0.8), (tP + 0.1, 0), (tE + 2, 0), (tE + 4, 0.4), (tW, 0.5), (tC, 0.7), (tCo, 0.3), (tV, 0.6), (tF, 0.5), (tEnd, 0), (DUR, 0)])
g_arp = auto([(0, 0), (tE, 0), (tE + 1, 0.7), (tW, 0.4), (tRaw, 0.3), (tC, 0.6), (tCo, 0), (tO - 0.2, 0), (tO, 0.8), (tF, 0.2), (tX, 0.6), (tEnd, 0.9), (DUR, 0.6)])
g_drum = auto([(0, 0), (tC + 2, 0), (tC + 3, 0.7), (tCo - 0.2, 1), (tCo, 0), (tV, 0), (tV + 0.3, 1), (tO - 0.2, 1), (tO, 0.5), (tF, 0), (tX + 1, 0.4), (tEnd - 0.4, 1), (tEnd, 0), (DUR, 0)])
g_drone = auto([(0, 0.6), (s('brand'), 0.8), (tR, 0.4), (tP, 1.0), (tE, 0.3), (tCo, 0.9), (tV, 0.6), (tO, 0.2), (tF, 0.7), (DUR, 0.3)])

BPM = 120
beat = 60 / BPM
# chord progression (2 bars per chord): Dm Bb F C / brighter sections use the same but pads open up
CHORDS = [(50, [50, 53, 57, 62]), (46, [46, 50, 53, 58]), (41, [53, 57, 60, 65]), (48, [48, 52, 55, 60])]
chord_len = beat * 8


def chord_at(t):
    return CHORDS[int(t // chord_len) % 4]


# pads
pad = np.zeros((2, N))
xf = int(0.6 * SR)
for ci in range(int(DUR // chord_len) + 2):
    t0 = ci * chord_len
    root, notes = CHORDS[ci % 4]
    n = int((chord_len + 0.6) * SR)
    t = np.arange(n) / SR
    y = np.zeros((2, n))
    for k, m in enumerate(notes):
        for ch, det in enumerate((-0.08, 0.08)):
            ph = 2 * np.pi * midi(m - 12 + det) * t + k
            y[ch] += signal.sawtooth(ph) * 0.12 + np.sin(ph * 0.5) * 0.08
    y[:, :xf] *= np.linspace(0, 1, xf)
    y[:, -xf:] *= np.linspace(1, 0, xf)
    i = int(t0 * SR)
    m = min(n, N - i)
    if m > 0:
        pad[:, i:i + m] += y[:, :m]
pad_dark = lp(pad, 650, 2)
pad_bright = lp(pad, 2600, 2)
score = (pad_dark * (1 - g_bright) + pad_bright * g_bright) * g_pad * 0.9

# drone (root in octave 1-2 with slow beating)
dr = np.sin(2 * np.pi * midi(26) * T) * 0.5 + np.sin(2 * np.pi * midi(38.05) * T) * 0.25 + lp(np.random.default_rng(3).standard_normal(N), 120) * 0.6
score += np.stack([dr, dr]) * g_drone * 0.35

# ticking sub pulse (8ths)
pulse = np.zeros(N)
nb = int(DUR / (beat / 2))
for k in range(nb):
    t0 = k * beat / 2
    root, _ = chord_at(t0)
    f = midi(root - 24)
    n = int(0.3 * SR)
    tt = np.arange(n) / SR
    acc = 1.0 if k % 2 == 0 else 0.6
    y = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) * acc + np.sin(2 * np.pi * f * 2 * tt) * np.exp(-tt * 18) * 0.3 * acc
    i = int(t0 * SR)
    m = min(n, N - i)
    pulse[i:i + m] += y[:m]
score += np.stack([pulse, pulse]) * g_pulse * 0.5

# clock ticks (16ths, accented)
tick = np.zeros((2, N))
for k in range(int(DUR / (beat / 4))):
    t0 = k * beat / 4
    y = sfx_tick(1.0 if k % 4 == 0 else 0.45) * 0.5
    i = int(t0 * SR)
    m = min(len(y), N - i)
    pan = 0.3 if k % 2 else -0.3
    tick[0, i:i + m] += y[:m] * (1 - pan)
    tick[1, i:i + m] += y[:m] * (1 + pan)
score += tick * g_tick * 0.35

# plucked arp (16ths) with ping-pong delay
arp = np.zeros((2, N))
pattern = [0, 2, 1, 3, 2, 1, 3, 2]
for k in range(int(DUR / (beat / 4))):
    t0 = k * beat / 4
    _, notes = chord_at(t0)
    m_ = notes[pattern[k % 8] % len(notes)] + 12
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    f = midi(m_)
    y = (np.sin(2 * np.pi * f * tt) + 0.3 * signal.sawtooth(2 * np.pi * f * tt)) * np.exp(-tt * 10) * 0.12
    i = int(t0 * SR)
    mm = min(n, N - i)
    arp[0, i:i + mm] += y[:mm]
    arp[1, i:i + mm] += y[:mm]
arp = lp(arp, 3500)
d = int(beat * 0.75 * SR)
arp[0, d:] += arp[1, :-d] * 0.35
arp[1, 2 * d:] += arp[0, :-2 * d] * 0.25
score += arp * g_arp * 0.6

# drums: taiko on beats 1 and 3(+), snare-ish noise on 2 and 4
drum = np.zeros(N)
kick = sfx_impact(0.55)[0][: int(0.8 * SR)]
snare = (bp(noise(0.5), 180, 5000) * np.exp(-np.arange(int(0.5 * SR)) / SR * 14) * 0.5)
for k in range(int(DUR / beat)):
    t0 = k * beat
    i = int(t0 * SR)
    for x, on in ((kick, k % 2 == 0 or k % 8 == 7), (snare, k % 2 == 1)):
        if not on:
            continue
        m = min(len(x), N - i)
        drum[i:i + m] += x[:m]
score += np.stack([drum, drum]) * g_drum * 0.55

score = score + reverb(score.mean(axis=0), 3.2, 0.25, seed=21)

# ------------------------------------------------------------------ voice
with wave.open(os.path.join(OUT, 'voice.wav')) as w:
    vsr = w.getframerate()
    v = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32767
v = signal.resample_poly(v, SR, vsr)
v = np.concatenate([v, np.zeros(max(0, N - len(v)))])[:N]
v = hp(v, 70)
# presence + gentle compression
v = v + bp(v, 2500, 6000) * 0.35
venv = np.sqrt(np.maximum(lp(v ** 2, 8), 1e-9))
gain = np.minimum(1, (0.18 / (venv + 1e-6)) ** 0.35)
v = v * gain
v = v / (np.abs(v).max() + 1e-9) * 0.9
vrev = reverb(v, 1.2, 0.08, seed=31, damp=5000)
voice = np.stack([v, v]) + vrev

# duck music + sfx under the narration
duck_env = np.maximum(lp(np.abs(v), 3), 0)
duck_env = duck_env / (duck_env.max() + 1e-9)
duck = 1 - np.clip(duck_env * 6, 0, 1) * 0.55
duck = lp(duck, 4)
music = score * duck * 0.66
fxm = fx * (0.5 + 0.5 * duck) * 0.55
mix = music + fxm + voice * 1.0
vm = np.abs(v) > 0.05
rms = lambda x: round(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9), 1)
print('rms under voice  music', rms(music[:, vm]), 'fx', rms(fxm[:, vm]), 'voice', rms(voice[:, vm]))

# master: soft clip + normalize to -1 dBFS
mix = np.tanh(mix * 0.9) / np.tanh(0.9)
fade = int(0.6 * SR)
end = int(DUR * SR)
mix[:, end - fade:end] *= np.linspace(1, 0, fade)
mix[:, end:] = 0
mix = mix[:, :end]
mix = mix / (np.abs(mix).max() + 1e-9) * 0.89
with wave.open(os.path.join(OUT, 'soundtrack_raw.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
# loudness for social playback: -14 LUFS, -1 dBTP
import subprocess
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(OUT, 'soundtrack_raw.wav'), '-af', 'loudnorm=I=-14:TP=-1.2:LRA=12', '-ar', str(SR), os.path.join(OUT, 'soundtrack.wav')], check=True)
print('wrote soundtrack', round(DUR, 2), 's')
