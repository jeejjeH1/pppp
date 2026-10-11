"""Procedural synthwave soundtrack, beat-locked to src/timeline.js (120 BPM, 56 s).

    python3 src/audio.py out/soundtrack.wav
Requires numpy + scipy.
"""
import sys
import wave
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve

SR = 48000
BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4
DUR = 56.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)
send = np.zeros(N)  # mono reverb send


def note_hz(n):  # midi -> hz
    return 440.0 * 2 ** ((n - 69) / 12)


def add(sig, t0, gain=1.0, pan=0.0, verb=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    gl = gain * np.sqrt(0.5 * (1 - pan))
    gr = gain * np.sqrt(0.5 * (1 + pan))
    L[i:i + len(sig)] += sig * gl
    R[i:i + len(sig)] += sig * gr
    if verb:
        send[i:i + len(sig)] += sig * gain * verb


def lp(x, fc, order=2):
    b, a = butter(order, min(fc, SR * 0.45) / (SR / 2), 'low')
    return lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'high')
    return lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return lfilter(b, a, x)


def tt(d):
    return np.arange(int(d * SR)) / SR


def saw(f, t, phase=0.0):
    return 2 * ((f * t + phase) % 1) - 1


# ---------------------------------------------------------------- instruments
def kick():
    t = tt(0.5)
    f = 42 + 140 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 5.5)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * 0.3
    return np.tanh((body + click) * 1.6)


def clap():
    t = tt(0.35)
    n = bp(rng.standard_normal(len(t)), 900, 4000)
    env = np.exp(-t * 18)
    for off in (0.0, 0.011, 0.022):
        env += np.where(t >= off, np.exp(-(t - off) * 140), 0) * 0.6
    return n * env * 0.8


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    n = hp(rng.standard_normal(len(t)), 7500)
    return n * np.exp(-t * (14 if open_ else 70)) * 0.35


def impact(big=1.0):
    t = tt(3.0)
    f = 30 + 70 * np.exp(-t * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    noise = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 4) * 0.5
    crack = hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 25) * 0.4
    return np.tanh((sub * 1.3 + noise + crack) * big)


def riser(d, top=9000):
    t = tt(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(n)
    blk = int(0.02 * SR)
    zi = None
    for s in range(0, len(n), blk):
        k = s / len(n)
        fc = 300 + (top - 300) * k ** 2
        b, a = butter(2, [max(fc * 0.6, 40) / (SR / 2), min(fc * 1.4, SR * 0.45) / (SR / 2)], 'band')
        if zi is None:
            zi = np.zeros(max(len(a), len(b)) - 1)
        out[s:s + blk], zi = lfilter(b, a, n[s:s + blk], zi=zi)
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 1800 * (t / d) ** 2) / SR) * 0.12
    return (out * 1.4 + sweep) * (t / d) ** 2.2


def whoosh(d=0.6):
    r = riser(d, 6000)
    return r * np.hanning(len(r)) * 1.5


def pluck(f, d=0.22, bright=4000):
    t = tt(d)
    s = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + saw(f * 1.005, t) * 0.5
    return lp(s, bright) * np.exp(-t * 14)


def pad_chord(notes, d, cutoff=1600):
    t = tt(d)
    sl = np.zeros(len(t))
    sr_ = np.zeros(len(t))
    for n in notes:
        f = note_hz(n)
        for det, pan in ((-0.12, -1), (0.0, 0), (0.11, 1)):
            ff = f * 2 ** (det / 12)
            s = saw(ff, t, rng.random())
            sl += s * (1 - pan) / 2
            sr_ += s * (1 + pan) / 2
    env = np.minimum(1, t / 0.35) * np.minimum(1, (d - t) / 0.4)
    return lp(sl, cutoff) * env, lp(sr_, cutoff) * env


# ---------------------------------------------------------------- arrangement
# A minor: Am F C G (i VI III VII); roots in midi
CHORDS = [(57, [57, 60, 64, 69]), (53, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (55, [55, 59, 62, 67])]
NBARS = int(DUR / BAR)


def section(t):
    if t < 4: return 'intro'
    if t < 12: return 'a'
    if t < 16: return 'b'
    if t < 34: return 'full'
    if t < 37.5: return 'break'
    if t < 40: return 'build'
    if t < 46: return 'full'
    if t < 50.5: return 'final'
    return 'outro'


K = kick()
CL = clap()
HC = hat()
HO = hat(True)

for bar in range(NBARS):
    t0 = bar * BAR
    root, notes = CHORDS[bar % 4]
    sec = section(t0 + 0.01)
    # pad
    cutoff = {'intro': 700, 'a': 1200, 'b': 1600, 'full': 2200, 'break': 1400, 'build': 1800, 'final': 2400, 'outro': 1200}[sec]
    pl, pr = pad_chord(notes, BAR + 0.4, cutoff)
    gain = 0.07 if sec != 'intro' else 0.06
    i = int(t0 * SR)
    seg = slice(i, min(N, i + len(pl)))
    L[seg] += pl[: seg.stop - i] * gain
    R[seg] += pr[: seg.stop - i] * gain
    send[seg] += (pl + pr)[: seg.stop - i] * gain * 0.4

    for beat in range(4):
        tb = t0 + beat * BEAT
        s = section(tb + 0.01)
        kick_on = s in ('a', 'b', 'full', 'build', 'final') or (s == 'break' and False)
        if s == 'break' and beat == 0:
            kick_on = False
        if kick_on:
            add(K, tb, 0.9)
        if s in ('b', 'full', 'final') and beat in (1, 3):
            add(CL, tb, 0.55, 0.05, verb=0.35)
        if s in ('a', 'b', 'full', 'build', 'final'):
            add(HO if s in ('full', 'final') else HC, tb + BEAT / 2, 0.55, 0.3)
            if s in ('full', 'final', 'build'):
                add(HC, tb + BEAT / 4, 0.35, -0.3)
                add(HC, tb + 3 * BEAT / 4, 0.35, -0.3)
        # bass 8ths
        if s in ('a', 'b', 'full', 'build', 'final'):
            for e in range(2):
                tn = tb + e * BEAT / 2
                d = BEAT / 2
                tt_ = tt(d)
                f = note_hz(root - 24 + (12 if e == 1 else 0))
                sb = lp(saw(f, tt_) + saw(f * 1.004, tt_), 500 if s == 'a' else 800) * np.exp(-tt_ * 5)
                sb *= np.minimum(1, (d - tt_) / 0.01)
                add(sb, tn, 0.26)
        elif s in ('break', 'outro'):
            if beat == 0:
                tt_ = tt(BAR)
                f = note_hz(root - 24)
                add(np.sin(2 * np.pi * f * tt_) * np.minimum(1, (BAR - tt_) / 0.2) * np.minimum(1, tt_ / 0.05), tb, 0.3)
        # arp 16ths
        if s in ('b', 'full', 'break', 'build', 'final', 'outro'):
            for q in range(4):
                tn = tb + q * BEAT / 4
                idx = (beat * 4 + q)
                pattern = [0, 2, 1, 3, 2, 1, 3, 2]
                n = notes[pattern[idx % 8] % len(notes)] + 12
                bright = {'b': 2500, 'full': 4500, 'break': 3000, 'build': 3500, 'final': 5000, 'outro': 2200}[s]
                g = 0.09 if s != 'outro' else 0.07
                pan = 0.4 if q % 2 else -0.4
                add(pluck(note_hz(n), 0.2, bright), tn, g, pan, verb=0.5)
                # dotted-8th echo
                add(pluck(note_hz(n), 0.2, bright * 0.6), tn + BEAT * 0.75, g * 0.35, -pan, verb=0.4)

# lead hook in the big sections (simple synth-brass melody)
MEL = [(0, 76, 1), (1, 74, 0.5), (1.5, 72, 0.5), (2, 72, 1), (3, 71, 1),
       (4, 72, 1.5), (5.5, 74, 0.5), (6, 76, 1), (7, 79, 1)]
for start in (16, 24, 40):
    for off, n, d in MEL:
        tn = start + off * BEAT * 2 / 2
        dd = d * BEAT * 2 / 2 * 0.95
        t_ = tt(dd)
        f = note_hz(n)
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t_)
        s = saw(f * vib, t_) + saw(f * 1.006 * vib, t_, 0.3) + 0.5 * np.sign(np.sin(2 * np.pi * f / 2 * t_))
        s = lp(s, 3200) * np.minimum(1, t_ / 0.02) * np.minimum(1, (dd - t_) / 0.05)
        add(s, tn, 0.05, 0.0, verb=0.6)

# FX hits locked to IMPACTS in timeline.js
IMPACTS = [(2.0, 1.0), (4.0, 0.9), (10.0, 0.4), (12.0, 0.8), (16.0, 0.8), (22.0, 0.5), (25.0, 0.4), (28.0, 0.4),
           (31.0, 0.6), (34.0, 0.5), (37.5, 0.8), (40.0, 0.6), (43.0, 0.6), (46.0, 1.2), (50.5, 0.5)]
for t0, k in IMPACTS:
    add(impact(1 + k * 0.5), t0, 0.35 * k + 0.15, verb=0.5)
    w = whoosh(0.5)
    add(w, t0 - 0.5, 0.25 * k, 0.0)

add(riser(2.0), 0.0, 0.35, verb=0.3)          # into logo lock
add(riser(1.0), 3.0, 0.4, verb=0.3)           # into drop
add(riser(2.0), 10.0, 0.25, verb=0.3)         # into "real world"
add(riser(2.0), 14.0, 0.3, verb=0.3)          # into intelligent contracts
add(riser(2.5), 35.0, 0.45, verb=0.3)         # into consensus
add(riser(2.0), 38.0, 0.35, verb=0.3)         # into triad
add(riser(3.0), 43.0, 0.45, verb=0.3)         # into finale
# snare roll before the final drop
for i in range(16):
    add(CL, 44.0 + i * BEAT / 4 + (i // 8) * 0 , 0.15 + i * 0.02, 0.0, verb=0.2)
# typing ticks in the intro
for i in range(14):
    add(hat() * 0.8, 0.15 + i * 0.1, 0.25, 0.2 if i % 2 else -0.2)

# ---------------------------------------------------------------- sidechain + reverb + master
beats = np.arange(0, DUR, BEAT)
sc = np.ones(N)
tn = np.arange(N) / SR
for b in beats:
    s = section(b + 0.01)
    if s in ('a', 'b', 'full', 'build', 'final'):
        i = int(b * SR)
        j = min(N, i + int(BEAT * SR))
        sc[i:j] = np.minimum(sc[i:j], 1 - 0.55 * np.exp(-(tn[i:j] - b) * 9))

ir_t = tt(2.6)
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 2.4)
ir = lp(ir, 5000)
ir /= np.sqrt(np.sum(ir ** 2))
rev = fftconvolve(send, ir)[:N] * 0.6
rev_l = rev
rev_r = np.roll(rev, int(0.013 * SR))

ml = (L * sc + rev_l)
mr = (R * sc + rev_r)
mix = np.stack([ml, mr], 1)
mix = hp(mix.T, 25).T
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
fade = np.minimum(1, tn / 0.05) * np.minimum(1, (DUR - tn) / 3.0)
mix *= fade[:, None]
mix *= 0.89 / np.max(np.abs(mix))

out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
pcm = (mix * 32767).astype(np.int16)
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, f'{DUR}s')
