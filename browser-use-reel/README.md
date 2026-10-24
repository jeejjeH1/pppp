# browser-use — Instagram Reel (motion graphic)

A 56-second, 1080×1920, 30 fps Reel introducing [browser-use/browser-use](https://github.com/browser-use/browser-use), with a Persian voiceover.

**Videos:**
- White theme (main): [`video/browser-use-reel.mp4`](video/browser-use-reel.mp4)
- Dark theme (earlier version): [`video/browser-use-reel-dark.mp4`](video/browser-use-reel-dark.mp4)

- Theme: off-white background with slowly drifting colour blobs; coral, blue, yellow, purple, green and pink accents; a hand-drawn 12-ray spark
- Energy: bouncy scene entrances, and confetti when the booking is confirmed, on "MIT" and when the comment is posted
- Voice: Piper TTS, `fa_IR-gyro-medium`, offline. It stays dry and EQd, and the mix is normalised to about -14 LUFS
- Music: procedural 116 BPM pop bed (16th-note pluck arpeggio, bouncy bass, kick, claps, hats) that ducks under the voice
- Every claim is taken from the browser-use README: open-source browser agent, works with any LLM (including local via Ollama), CLI for Claude Code / Codex, save and rerun runs without a model call per click, MIT-licensed Python library
- Ends with the CTA: comment «عامل» to get the repo link

## Storyboard

| Scene | Content |
| --- | --- |
| hook | "Just say it…" → typing "book me a slot for friday" → a browser window opens |
| intro | browser-use — the open-source browser agent |
| acts | the cursor clicks, types, fills the booking form → "Booked · Fri 10:30" |
| dom | the page turns into a numbered list of buttons and fields → click(4) |
| models | Claude / GPT / Gemini / local via Ollama |
| agents | `browser-use skill install` → Claude Code, Codex → browser |
| replay | run 1 (LLM every step) → saved → replay with new values |
| oss | MIT — free and open source, from the team behind video-use |
| cta | comment «عامل» |

## Rebuild

```bash
npm install && pip install piper-tts scipy numpy
python3 src/audio.py --voice fa_IR-gyro-medium.onnx            # -> out/timing.json, out/soundtrack.wav
CHROMIUM_PATH=/path/to/chrome node src/render.js --workers 4    # -> out/browser-use-reel.mp4
```

Narration text and captions live in `src/script.json`.
