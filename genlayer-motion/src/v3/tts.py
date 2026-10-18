# Narration: synthesises every line with Kokoro (local ONNX), trims silence, lays the lines
# out on one timeline and writes voice.wav + timeline.json (line + estimated word times).
#   python3 src/v3/tts.py out/v3   (needs /root/tts/model.onnx + voices.npz, pip kokoro-onnx)
import json, os, re, sys, wave
import numpy as np
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out/v3'
MODEL = os.environ.get('KOKORO_DIR', '/root/tts')
os.makedirs(OUT, exist_ok=True)
cfg = json.load(open(os.path.join(HERE, 'narration.json')))
k = Kokoro(f'{MODEL}/model.onnx', f'{MODEL}/voices.npz')
style = sum(k.get_voice_style(v) * w for v, w in cfg['voice'].items())


def trim(x, sr, thr=0.012):
    a = np.abs(x)
    idx = np.where(a > thr)[0]
    if not len(idx):
        return x
    s = max(0, idx[0] - int(0.02 * sr))
    e = min(len(x), idx[-1] + int(0.06 * sr))
    return x[s:e]


def word_times(text, start, dur):
    # estimate per-word onsets from syllable-ish weights plus punctuation pauses
    words = text.split()
    wts = []
    for w in words:
        core = re.sub(r'[^A-Za-z0-9-]', '', w)
        v = max(1, len(re.findall(r'[aeiouy]+', core.lower())))
        wts.append(0.55 + v + len(core) * 0.05 + (0.9 if re.search(r'[,.?!]$', w) else 0))
    tot = sum(wts)
    t, out = start, []
    for w, x in zip(words, wts):
        out.append([w, round(t, 3)])
        t += dur * x / tot
    return out


sr = 24000
t = cfg['lead']
chunks, lines = [], []
for lid, text, gap in cfg['lines']:
    a, sr = k.create(text, voice=style, speed=cfg['speed'], lang='en-us')
    a = trim(np.asarray(a, dtype=np.float32), sr)
    d = len(a) / sr
    chunks.append((t, a))
    lines.append({'id': lid, 'text': text, 'start': round(t, 3), 'end': round(t + d, 3), 'words': word_times(text, t, d)})
    print(f'{lid:10s} {t:7.2f} {d:5.2f}s  {text[:60]}')
    t += d + gap
total = t + cfg['tail']
buf = np.zeros(int(total * sr) + sr, dtype=np.float32)
for st, a in chunks:
    i = int(st * sr)
    buf[i:i + len(a)] += a
buf = buf / (np.abs(buf).max() + 1e-9) * 0.95
with wave.open(os.path.join(OUT, 'voice.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((buf * 32767).astype(np.int16).tobytes())
json.dump({'duration': round(total, 3), 'lines': lines}, open(os.path.join(OUT, 'timeline.json'), 'w'), indent=1)
print('total', round(total, 2))
