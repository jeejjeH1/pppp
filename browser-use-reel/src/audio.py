"""Voiceover (Piper, fa_IR-gyro) + procedural warm ambient bed + soft transition SFX.

    python3 src/audio.py --voice /path/fa_IR-gyro-medium.onnx
writes out/timing.json (read by index.html) and out/soundtrack.wav
"""
import argparse, json, subprocess, os
import numpy as np
from scipy import signal

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'out')
LEAD_IN = 0.55      # silence before the first line
GAP = 0.5           # pause between lines
EXTRA = {'intro': 0.3, 'acts': 0.3, 'dom': 0.35, 'replay': 0.35, 'oss': 0.4}  # extra breath after these lines
TAIL = 3.2          # hold after the last line
rng = np.random.default_rng(7)


def tts(text, model, path):
    subprocess.run(['piper', '-m', model, '--length-scale', '1.05', '--sentence-silence', '0.15', '-f', path],
                   input=text.encode(), capture_output=True, check=True)
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).copy()
    # trim leading/trailing silence
    env = np.abs(x) > 0.01
    idx = np.flatnonzero(env)
    x = x[max(0, idx[0] - int(0.03 * SR)): idx[-1] + int(0.08 * SR)]
    return x


def biquad(kind, f0, gain_db=0.0, q=0.707):
    """RBJ cookbook peaking / shelf filters."""
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / SR
    al = np.sin(w) / (2 * q)
    c = np.cos(w)
    if kind == 'peak':
        b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]
    elif kind == 'high':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
        a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    else:  # low shelf
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * c + sq), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sq)]
        a = [(A + 1) + (A - 1) * c + sq, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sq]
    return np.array(b) / a[0], np.array(a) / a[0]


def compress(x, thr_db=-20, ratio=3.0, att=0.005, rel=0.12):
    env = np.abs(x)
    ka, kr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    e = signal.lfilter([1 - kr], [1, -kr], env)  # smooth release-ish follower
    e = np.maximum(e, signal.lfilter([1 - ka], [1, -ka], env))
    lvl = 20 * np.log10(e + 1e-9)
    gr = np.minimum(0, (thr_db - lvl) * (1 - 1 / ratio))
    return x * 10 ** (gr / 20)


def voice_chain(x):
    # Piper's raw output is very bottom-heavy (boxy "small room" sound): thin out the low-mids, open up the top.
    b, a = signal.butter(2, 110 / (SR / 2), 'high')
    x = signal.lfilter(b, a, x)
    for kind, f0, g, q in [('low', 220, -5, 0.7), ('peak', 380, -4, 1.1), ('peak', 2800, 4.5, 0.9),
                           ('peak', 5000, 3, 1.0), ('high', 7500, 4, 0.7)]:
        b, a = biquad(kind, f0, g, q)
        x = signal.lfilter(b, a, x)
    x = x / (np.max(np.abs(x)) + 1e-9)
    x = compress(x)
    return x / (np.max(np.abs(x)) + 1e-9) * 0.9


def reverb(x, secs=2.6, mix=0.25, seed=1):
    n = int(secs * SR)
    r = np.random.default_rng(seed)
    ir = r.standard_normal((2, n)) * np.exp(-np.linspace(0, 7, n))
    b, a = signal.butter(1, 5000 / (SR / 2))
    ir = signal.lfilter(b, a, ir)
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    wet = np.stack([signal.fftconvolve(x, ir[0])[: len(x)], signal.fftconvolve(x, ir[1])[: len(x)]])
    return np.stack([x, x]) * (1 - mix) + wet * mix * 2.2


def adsr(n, a, r):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def music(dur, bpm=116):
    """Upbeat pop bed: bright pluck arp in 16ths, bouncy bass, four-on-the-floor kick, claps, hats."""
    n = int(dur * SR)
    out = np.zeros(n)
    beat = 60 / bpm
    bar = 4 * beat
    chords = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 57, 62], [45, 52, 57, 59, 64]]
    nb = int(np.ceil(dur / bar)) + 1

    def put(s0, x):
        if s0 >= n:
            return
        out[s0:s0 + len(x)] += x[: n - s0]

    # soft pad underneath
    for i in range(nb):
        s0 = int(i * bar * SR)
        if s0 >= n:
            break
        ln = int(bar * SR)
        tt = np.arange(ln) / SR
        seg = sum(signal.sawtooth(2 * np.pi * mtof(m + d) * tt + rng.uniform(0, 6)) for m in chords[i % 4][1:] for d in (-0.07, 0.07))
        b, a = signal.butter(2, 1400 / (SR / 2))
        put(s0, signal.lfilter(b, a, seg) * adsr(ln, 0.25, 0.4) * 0.012)
    # bouncy bass: root on 8ths with octave jumps
    k = 0
    while k * beat / 2 < dur:
        c = chords[int(k * beat / 2 / bar) % 4]
        m = c[0] - 12 + (12 if k % 4 == 3 else 0)
        ln = int(beat / 2 * 0.9 * SR)
        tt = np.arange(ln) / SR
        x = np.sin(2 * np.pi * mtof(m) * tt) + 0.3 * np.sign(np.sin(2 * np.pi * mtof(m) * tt)) * np.exp(-tt * 20)
        put(int(k * beat / 2 * SR), x * np.exp(-tt * 5) * adsr(ln, 0.003, 0.02) * 0.10)
        k += 1
    # 16th-note pluck arp
    pattern = [1, 2, 3, 4, 3, 2, 3, 4, 1, 3, 4, 2, 3, 4, 3, 2]
    k = 0
    st = beat / 4
    while k * st < dur:
        c = chords[int(k * st / bar) % 4]
        m = c[pattern[k % 16]] + 12
        ln = int(0.5 * SR)
        tt = np.arange(ln) / SR
        f = mtof(m)
        x = (signal.square(2 * np.pi * f * tt, 0.3) * 0.4 + np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 14)
        b, a = signal.butter(2, 3500 / (SR / 2))
        put(int(k * st * SR), signal.lfilter(b, a, x) * (0.03 if k % 4 == 0 else 0.02))
        k += 1
    # drums
    hb, ha = signal.butter(2, 8000 / (SR / 2), 'high')
    cb, ca = signal.butter(2, [900 / (SR / 2), 3000 / (SR / 2)], 'band')
    k = 0
    while k * beat < dur:
        s0 = int(k * beat * SR)
        tt = np.arange(int(0.3 * SR)) / SR
        put(s0, np.sin(2 * np.pi * (50 + 110 * np.exp(-tt * 35)) * tt) * np.exp(-tt * 9) * 0.22)
        if k % 2 == 1:  # clap on 2 and 4
            nz = rng.standard_normal(int(0.18 * SR))
            tc = np.arange(len(nz)) / SR
            env = np.exp(-tc * 22) + 0.6 * np.exp(-np.maximum(tc - 0.012, 0) * 30) * (tc > 0.012) + 0.5 * np.exp(-np.maximum(tc - 0.024, 0) * 26) * (tc > 0.024)
            put(s0, signal.lfilter(cb, ca, nz) * env * 0.09)
        for h in range(4):  # 16th hats, accent on the off-beat
            nz = rng.standard_normal(2400)
            put(int((k * beat + h * beat / 4) * SR), signal.lfilter(hb, ha, nz) * np.exp(-np.arange(2400) / SR * 70) * (0.03 if h == 2 else 0.012))
        k += 1
    return out


def whoosh(ln=0.7):
    n = int(ln * SR)
    x = rng.standard_normal(n)
    tt = np.linspace(0, 1, n)
    out = np.zeros(n)
    # sweeping band-pass, processed in blocks
    blk = 512
    for i in range(0, n, blk):
        fc = 300 + 5000 * (tt[i] ** 1.6)
        b, a = signal.butter(2, [fc * 0.7 / (SR / 2), min(fc * 1.4, 20000) / (SR / 2)], 'band')
        out[i:i + blk] = signal.lfilter(b, a, x[i:i + blk])
    env = np.sin(np.pi * tt) ** 2
    return out * env * 0.12


def pop(f=880):
    n = int(0.18 * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 + 0.6 * np.exp(-tt * 40)) * tt) * np.exp(-tt * 28) * 0.14


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', required=True)
    args = ap.parse_args()
    os.makedirs(os.path.join(OUT, 'vo'), exist_ok=True)
    lines = json.load(open(os.path.join(ROOT, 'src', 'script.json')))
    t = LEAD_IN
    clips = []
    timing = []
    for l in lines:
        x = voice_chain(tts(l['say'], args.voice, os.path.join(OUT, 'vo', l['id'] + '.wav')))
        d = len(x) / SR
        timing.append({'id': l['id'], 'cap': l['cap'], 'start': round(t, 3), 'end': round(t + d, 3)})
        clips.append((t, x))
        t += d + GAP + EXTRA.get(l['id'], 0)
    total = timing[-1]['end'] + TAIL
    json.dump({'duration': round(total, 3), 'lines': timing}, open(os.path.join(OUT, 'timing.json'), 'w'), ensure_ascii=False, indent=1)

    n = int(total * SR)
    vo = np.zeros(n)
    for s, x in clips:
        i = int(s * SR)
        vo[i:i + len(x)] += x[: n - i]

    # ducking envelope from the voice
    env = np.abs(vo)
    win = int(0.05 * SR)
    env = np.convolve(env, np.ones(win) / win, 'same')
    env = np.clip(env * 12, 0, 1)
    b, a = signal.butter(1, 3 / (SR / 2))
    env = signal.filtfilt(b, a, env)
    duck = 1 - 0.68 * np.clip(env, 0, 1)

    bed = music(total) * duck
    fade = np.ones(n)
    fi, fo = int(0.8 * SR), int(2.6 * SR)
    fade[:fi] = np.linspace(0, 1, fi)
    fade[-fo:] = np.linspace(1, 0, fo)
    bed *= fade

    sfx = np.zeros(n)
    for k, tm in enumerate(timing[1:], 1):
        w = whoosh()
        i = int((tm['start'] - 0.55) * SR)
        sfx[i:i + len(w)] += w
    # pops on the chat send in the hook and the comment in the CTA
    for tp, f in [(timing[0]['end'] - 0.05, 990), (timing[-1]['end'] + 0.25, 1180)]:
        p = pop(f)
        i = int(tp * SR)
        sfx[i:i + len(p)] += p

    music_st = reverb(bed + sfx, 2.4, 0.25, seed=3)
    # voice stays completely dry and centered: any reverb on it reads as 'small tiled room'
    mix = music_st * 0.8 + np.stack([vo, vo]) * 1.0
    mix /= np.max(np.abs(mix)) / 0.89
    pcm = (mix.T * 32767).astype(np.int16)
    from scipy.io import wavfile
    wavfile.write(os.path.join(OUT, 'soundtrack_raw.wav'), SR, pcm)
    # Instagram plays around -14 LUFS; normalise so the voice doesn't come out quiet
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(OUT, 'soundtrack_raw.wav'),
                    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', str(SR), os.path.join(OUT, 'soundtrack.wav')], check=True)
    print('duration', total)
    for tm in timing:
        print(tm['id'], tm['start'], tm['end'])


main()
