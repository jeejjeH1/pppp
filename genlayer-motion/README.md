# GenLayer — Intelligent Contracts (motion graphic)

56-second, 1920×1080, 30 fps motion graphic for an X/Twitter post, built for the post
*"Why does GenLayer need direct web access, and how could this change the way we think about smart contracts?"*

**Final video:** [`video/genlayer-intelligent-contracts.mp4`](video/genlayer-intelligent-contracts.mp4)

- 3D mascot (the cat astronaut from `assets/character-reference.jpg`) modelled in Three.js
- 3D extruded GenLayer logo traced from `assets/logo.png`
- Palette: `#ff87ff`, `#dc00ff`, mint green `#a8ffd2` on a simple dark background
- Procedural electronic soundtrack (120 BPM) with drops, build-ups and stutter edits; every cut locked to the beat
- Text effects: typewriter with cursor, decode/scramble, per-letter rise, glitch slams, each with synced SFX (key clicks, blips, hits)
- Beat-reactive visuals: zoom punch and bloom pulse on every kick

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
node src/events.js out/events.json            # text/drum timings for the soundtrack
python3 src/audio.py out/events.json out/soundtrack.wav   # needs numpy + scipy
node src/render.js --fps 30 --workers 3        # -> out/genlayer.mp4
node src/render.js --stills 5,20,48            # preview frames -> out/stills/
```

Rendering runs headless Chromium (Playwright) and drives `window.renderAt(t)` frame by frame, so
the output is deterministic. Edit text and timing in `src/timeline.js`.
