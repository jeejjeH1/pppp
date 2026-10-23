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
EXTRA = {'intro': 0.35, 'polish': 0.25, 'tokens': 0.35, 'selfeval': 0.3, 'oss': 0.45}  # extra breath after these lines
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


def voice_chain(x):
    b, a = signal.butter(2, 85 / (SR / 2), 'high')
    x = signal.lfilter(b, a, x)
    # gentle presence lift around 3 kHz
    b, a = signal.iirpeak(3200 / (SR / 2), 1.2)
    x = x + 0.25 * signal.lfilter(b, a, x)
    # soft compression
    x = np.tanh(x * 2.2) / np.tanh(2.2)
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
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def music(dur, bpm=84):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    beat = 60 / bpm
    bar = 4 * beat
    # Dmaj9 – Bm9 – Gmaj9 – Aadd9 (warm, open voicings)
    chords = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 57, 62], [45, 52, 57, 59, 64]]
    nb = int(np.ceil(dur / bar)) + 1
    # pad: detuned soft saws through a low-pass, slow swell per bar
    for i in range(nb):
        c = chords[i % 4]
        s0 = int(i * bar * SR)
        ln = int(bar * 1.25 * SR)
        if s0 >= n:
            break
        ln = min(ln, n - s0)
        tt = np.arange(ln) / SR
        seg = np.zeros(ln)
        for m in c:
            for d in (-0.08, 0.08):
                f = mtof(m + d)
                seg += signal.sawtooth(2 * np.pi * f * tt + rng.uniform(0, 6)) * 0.5
        b, a = signal.butter(2, 900 / (SR / 2))
        seg = signal.lfilter(b, a, seg) * adsr(ln, 1.2, 1.1)
        out[s0:s0 + ln] += seg * 0.022
    # sub bass: root note sine
    for i in range(nb):
        s0 = int(i * bar * SR)
        if s0 >= n:
            break
        ln = min(int(bar * SR), n - s0)
        tt = np.arange(ln) / SR
        out[s0:s0 + ln] += np.sin(2 * np.pi * mtof(chords[i % 4][0] - 12) * tt) * adsr(ln, 0.3, 0.6) * 0.09
    # glassy pluck arpeggio on 8ths
    pattern = [2, 3, 4, 3, 1, 3, 4, 2]
    k = 0
    tstep = beat / 2
    while k * tstep < dur:
        c = chords[int(k * tstep / bar) % 4]
        m = c[pattern[k % 8]] + 12
        s0 = int(k * tstep * SR)
        ln = min(int(1.4 * SR), n - s0)
        tt = np.arange(ln) / SR
        f = mtof(m)
        p = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 9)) * np.exp(-tt * 4.2)
        vel = 0.75 if k % 2 == 0 else 0.5
        out[s0:s0 + ln] += p * 0.035 * vel * adsr(ln, 0.004, 0.02)
        k += 1
    # very soft kick on 1 and 3 + shaker on off-beats
    k = 0
    while k * beat < dur:
        s0 = int(k * beat * SR)
        ln = min(int(0.35 * SR), n - s0)
        tt = np.arange(ln) / SR
        if k % 2 == 0:
            kick = np.sin(2 * np.pi * (48 + 70 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 11)
            out[s0:s0 + ln] += kick * 0.13
        so = int((k + 0.5) * beat * SR)
        if so + 4000 < n:
            sh = rng.standard_normal(4000) * np.exp(-np.arange(4000) / SR * 60)
            b, a = signal.butter(2, 7000 / (SR / 2), 'high')
            out[so:so + 4000] += signal.lfilter(b, a, sh) * 0.012
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
    duck = 1 - 0.5 * np.clip(env, 0, 1)

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

    music_st = reverb(bed + sfx, 2.8, 0.35, seed=3)
    vo_st = reverb(vo, 1.2, 0.08, seed=5)
    mix = music_st * 0.9 + vo_st * 0.95
    mix /= np.max(np.abs(mix)) / 0.89
    pcm = (mix.T * 32767).astype(np.int16)
    from scipy.io import wavfile
    wavfile.write(os.path.join(OUT, 'soundtrack.wav'), SR, pcm)
    print('duration', total)
    for tm in timing:
        print(tm['id'], tm['start'], tm['end'])


main()
