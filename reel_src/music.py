"""Original drift-phonk track for the reel. 140 BPM, 18 bars (~30.9s)."""
import numpy as np, wave, sys

SR = 44100
BPM = 140
BEAT = 60 / BPM
BAR = BEAT * 4
NBARS = 18
TOTAL = BAR * NBARS + 1.5
N = int(TOTAL * SR)
rng = np.random.default_rng(7)

def t_(dur):
    return np.arange(int(dur * SR)) / SR

def fft_filter(x, lo=None, hi=None, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi is not None:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo is not None:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * g, len(x))

def reverb(x, decay=1.6, mix=0.3):
    ir_t = t_(decay)
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 5 / decay)
    ir = fft_filter(ir, lo=300, hi=6000)
    n = len(x) + len(ir)
    y = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[: len(x)]
    y /= np.max(np.abs(y)) + 1e-9
    return x * (1 - mix) + y * mix * np.max(np.abs(x))

def add(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain

def note(n):  # midi -> Hz
    return 440 * 2 ** ((n - 69) / 12)

# ---------- instruments ----------
def kick():
    t = t_(0.45)
    f = 45 + 160 * np.exp(-t * 35)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7)
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.4
    return np.tanh((s + click) * 2.2)

def clap():
    t = t_(0.35)
    n = rng.standard_normal(len(t))
    env = np.zeros_like(t)
    for d in (0, 0.011, 0.022):
        env += np.where(t >= d, np.exp(-(t - d) * 60), 0) * 0.5
    env += np.exp(-t * 14) * 0.6
    s = fft_filter(n * env, lo=900, hi=7000)
    return s / np.max(np.abs(s))

def hat(open_=False):
    t = t_(0.25 if open_ else 0.06)
    n = rng.standard_normal(len(t))
    s = fft_filter(n, lo=7000) * np.exp(-t * (12 if open_ else 90))
    return s / np.max(np.abs(s))

def cowbell(midi, dur=0.22):
    t = t_(dur)
    f = note(midi)
    sq = lambda fr: np.sign(np.sin(2 * np.pi * fr * t))
    s = (sq(f) + 0.7 * sq(f * 1.48)) * np.exp(-t * 16)
    s = fft_filter(s, lo=500, hi=4500)
    return s / np.max(np.abs(s))

def bass808(midi, dur, slide_from=None):
    t = t_(dur)
    f0 = note(midi)
    if slide_from is not None:
        f = f0 + (note(slide_from) - f0) * np.exp(-t * 18)
    else:
        f = np.full_like(t, f0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t * 200) * np.exp(-t * 0.9)
    rel = np.clip((dur - t) / 0.03, 0, 1)
    s = np.sin(ph) * env * rel
    return np.tanh(s * 3.0) * 0.8

def pad(midis, dur):
    t = t_(dur)
    s = np.zeros_like(t)
    for m in midis:
        for det in (-0.12, 0, 0.12):
            f = note(m + det)
            s += ((2 * ((f * t) % 1) - 1))
    s = fft_filter(s, hi=1400)
    env = np.minimum(1, t / 0.8) * np.minimum(1, (dur - t) / 0.6)
    return s / np.max(np.abs(s)) * env

def riser(dur):
    t = t_(dur)
    n = rng.standard_normal(len(t))
    # sweep by blending progressively higher-passed noise
    s = np.zeros_like(t)
    seg = 8
    L = len(t) // seg
    for k in range(seg):
        chunk = fft_filter(n[k * L:(k + 1) * L], lo=300 + k * 900, hi=2000 + k * 1800)
        s[k * L:(k + 1) * L] = chunk
    s = s / np.max(np.abs(s)) * (t / dur) ** 2
    return s

def impact():
    t = t_(2.5)
    f = 30 + 80 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    n = fft_filter(rng.standard_normal(len(t)), hi=2500) * np.exp(-t * 3) * 0.5
    return np.tanh((s + n) * 2)

# ---------- arrangement ----------
drums = np.zeros(N); bass = np.zeros(N); bell = np.zeros(N); fx = np.zeros(N); pads = np.zeros(N)
K, C, H, HO = kick(), clap(), hat(), hat(True)

# E minor phonk riff (16 steps per bar, 2 bars), midi notes, None = rest
riffA = [76, None, 76, 74, None, 71, None, 74, 76, None, 79, None, 78, None, 74, None,
         76, None, 76, 74, None, 71, None, 74, 71, None, 69, None, 67, None, 69, 71]
riffB = [83, None, 83, 81, None, 79, None, 81, 83, None, 86, None, 84, None, 81, None,
         79, None, 79, 78, None, 76, None, 74, 76, None, 74, None, 71, None, 74, 76]
bass_line = [(0, 40, 1.5, None), (1.5, 40, 0.5, None), (2.0, 43, 1.25, 47), (3.25, 38, 0.75, None),
             (4.0, 40, 1.5, None), (5.5, 47, 0.5, None), (6.0, 36, 1.0, 40), (7.0, 38, 1.0, None)]  # beats in 2 bars

S16 = BEAT / 4
sections = {  # bar index -> role
    **{b: "intro" for b in (0, 1)},
    **{b: "build" for b in (2, 3)},
    **{b: "drop" for b in range(4, 8)},
    **{b: "break" for b in (8, 9)},
    **{b: "drop2" for b in range(10, 16)},
    **{b: "outro" for b in (16, 17)},
}

for b in range(NBARS):
    role = sections[b]
    t0 = b * BAR
    riff = riffB if (role == "drop2" and b % 4 >= 2) else riffA
    half = (b % 2) * 16
    for s in range(16):
        m = riff[half + s]
        if m is None:
            continue
        g = {"intro": 0.7, "build": 0.8, "drop": 0.8, "break": 0.4, "drop2": 0.85, "outro": 0.5}[role]
        add(bell, cowbell(m), t0 + s * S16, g)

    if role in ("drop", "drop2"):
        for beat in range(4):
            add(drums, K, t0 + beat * BEAT, 1.0 if beat in (0, 2) else 0.0)
        add(drums, K, t0 + 2.5 * BEAT, 0.8)
        for beat in (1, 3):
            add(drums, C, t0 + beat * BEAT, 0.7)
        for s in range(16):
            roll = (b % 2 == 1 and s >= 12)
            add(drums, H, t0 + s * S16, 0.22 if s % 2 else 0.32)
            if roll:
                add(drums, H, t0 + s * S16 + S16 / 2, 0.2)
        add(drums, HO, t0 + 3.5 * BEAT, 0.2)
        if b % 2 == 0:
            for (bt, m, d, sl) in bass_line[:4]:
                add(bass, bass808(m, d * BEAT, sl), t0 + bt * BEAT)
        else:
            for (bt, m, d, sl) in bass_line[4:]:
                add(bass, bass808(m, d * BEAT, sl), t0 + (bt - 4) * BEAT)
    elif role == "build":
        add(drums, K, t0, 0.8)
        for s in range(0, 16, 2 if b == 2 else 1):
            add(drums, H, t0 + s * S16, 0.18)
        if b == 3:  # snare roll into drop
            for s in range(8, 16):
                add(drums, C, t0 + s * S16, 0.15 + 0.05 * (s - 8))
    elif role == "outro":
        if b == 16:
            add(drums, K, t0, 1.0)
            add(bass, bass808(40, BAR * 2, 52), t0)
            for beat in (1, 3):
                add(drums, C, t0 + beat * BEAT, 0.5)

    if role in ("intro", "break", "outro"):
        add(pads, pad([52, 55, 59], BAR), t0, 0.6)

# FX: risers into the drops, impacts on drops / goals
add(fx, riser(BAR * 2), 2 * BAR, 0.8)
add(fx, riser(BAR * 2), 8 * BAR, 0.8)
add(fx, impact(), 4 * BAR, 0.9)
add(fx, impact(), 10 * BAR, 0.9)
add(fx, impact(), 16 * BAR, 0.7)

# Filter the intro bells (muffled -> open on drop)
cut = int(4 * BAR * SR)
bell[:cut] = fft_filter(bell[:cut], hi=1700)
brk = slice(int(8 * BAR * SR), int(10 * BAR * SR))
bell[brk] = fft_filter(bell[brk], hi=900)
bell = reverb(bell, 1.2, 0.35)
pads = reverb(pads, 2.0, 0.4)

# sidechain-style duck on kicks during drops
duck = np.ones(N)
for b in range(NBARS):
    if sections[b] in ("drop", "drop2"):
        for beat in (0, 2, 2.5):
            i = int((b * BAR + beat * BEAT) * SR)
            L = int(0.18 * SR)
            j = min(N, i + L)
            duck[i:j] = np.minimum(duck[i:j], 0.35 + 0.65 * np.linspace(0, 1, j - i))

mix = drums * 0.8 + bass * 0.7 + bell * 0.6 * duck + pads * 0.5 * duck + fx * 0.7
mix /= np.max(np.abs(mix))
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
fade = int(1.5 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
mix /= np.max(np.abs(mix)) / 0.95

# light stereo widening of bells via short delay
d = int(0.012 * SR)
L = mix.copy(); R = mix.copy()
R[d:] = 0.85 * mix[d:] + 0.15 * (bell * 0.55 * duck)[:-d]
st = np.stack([L, R], 1)
st = np.clip(st, -1, 1)
out = sys.argv[1]
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print("bar", BAR, "total", TOTAL)
