# GenLayer — Intelligent Contracts (motion graphic)

56-second, 1920×1080, 30 fps motion graphic for an X/Twitter post, built for the post
*"Why does GenLayer need direct web access, and how could this change the way we think about smart contracts?"*

**Videos:**
- **v3 "Adjudication" (narrated, genlayer.com theme, 2:15):** [`video/genlayer-v3-narrated.mp4`](video/genlayer-v3-narrated.mp4) — source in `src/v3/`
- v1 (mascot, calm): [`video/genlayer-intelligent-contracts.mp4`](video/genlayer-intelligent-contracts.mp4)
- v2 "Thread of light" (no character, particle-only): [`video/genlayer-thread-of-light.mp4`](video/genlayer-thread-of-light.mp4) — source in `src/v2/`

v2 rebuild: `python3 src/v2/audio.py out/events.json out/v2/soundtrack.wav && node src/render.js --page src/v2/index.html --outdir out/v2`

- 3D mascot (the cat astronaut from `assets/character-reference.jpg`) modelled in Three.js
- 3D extruded GenLayer logo traced from `assets/logo.png`
- Palette: `#ff87ff`, `#dc00ff`, mint green `#a8ffd2` on a simple dark background
- Calm, minimal style: soft word-by-word fades, slow camera, no flashes or shake
- Procedural ambient soundtrack: FM electric piano, warm pad, sine sub, sparse glass melody, quiet pulse, long reverb (no typing / UI sounds)

## Storyboard

| Time | Scene |
| --- | --- |
| 0–4 s | Logo assembles in 3D → "GenLayer / Intelligent Contracts" |
| 4–10 s | Mascot lands — "Why does GenLayer need direct web access?" |
| 10–16 s | On-chain blocks in a box → explode into the web globe |
| 16–22 s | Intelligent Contracts core fed by web sources: Web access + AI models → natural-language criteria |
| 22–34 s | The four reasons (real-world decisions, beyond deterministic logic, AI agents, web access isn't enough) |
| 34–40 s | Optimistic Democracy — validators evaluate and reach consensus |
| 40–46 s | "The web provides the information. AI helps interpret it. GenLayer brings it on-chain." |
| 46–56 s | Hero shot + closing question |

## Rebuild

```bash
npm install
node src/events.js out/events.json            # timeline export read by the soundtrack
python3 src/audio.py out/events.json out/soundtrack.wav   # needs numpy + scipy
node src/render.js --fps 30 --workers 3        # -> out/genlayer.mp4
node src/render.js --stills 5,20,48            # preview frames -> out/stills/
```

Rendering runs headless Chromium (Playwright) and drives `window.renderAt(t)` frame by frame, so
the output is deterministic. Edit text and timing in `src/timeline.js`.

## v3 — narrated cinematic cut (genlayer.com theme)

1920×1080, 30 fps, 134.9 s (under X's 2:20 limit), with a male AI voiceover, burned-in karaoke subtitles,
cinematic score and synced SFX. White / black / electric blue `#1a0dff` / consensus green, Inter Tight + Geist Mono,
the site's isometric protocol stack in 3D, halftone statues, consensus wheel and the 5 → 11 → 23 appeal flow.

```bash
pip install kokoro-onnx scipy           # TTS + DSP
# Kokoro-82M ONNX model + voices in /root/tts (model.onnx, voices.npz) — see src/v3/tts.py
python3 src/v3/tts.py out/v3                                          # voice.wav + timeline.json (word timings)
node src/render.js --page src/v3/index.html --outdir out/v3 --sfx out/v3/sfx.json   # SFX cue list from the page
python3 src/v3/audio.py out/v3                                        # score + SFX + voice -> soundtrack.wav
node src/render.js --page src/v3/index.html --outdir out/v3 --fps 30 --workers 3 --out genlayer-v3.mp4
```

Narration text and pauses live in `src/v3/narration.json`; every scene is pinned to word onsets, so editing the
script re-times the whole film. Storyboard: intro lockup → rigid rules shatter → prices / news / announcements →
the problem → GenLayer stack rises + Intelligent Contract code → three use cases → raw data vs. interpret / evaluate /
decide → web + AI + Optimistic Democracy (consensus wheel, appeals to finality) → outdated / misleading / manipulated
sources rejected by validators → hammer statue "beyond executing code" → new possibilities → end card.
