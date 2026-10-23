# video-use — Instagram Reel (motion graphic)

A 46-second, 1080×1920, 30 fps Reel introducing [browser-use/video-use](https://github.com/browser-use/video-use), with a Persian voiceover.

**Video:** [`video/video-use-reel.mp4`](video/video-use-reel.mp4)

- Theme: warm dark background, cream text, coral accent, and a hand-drawn 12-ray spark
- Fonts: Vazirmatn (Persian), Source Serif 4, JetBrains Mono
- Voice: Piper TTS, `fa_IR-gyro-medium`, offline. It stays dry (no reverb) and is EQd, because the raw model output is very bottom-heavy and sounds boxy. The mix is normalised to -14 LUFS
- Music: procedural ambient bed (pad, sub, glass arpeggio, soft kick) that ducks under the voice, plus whoosh transitions
- Word-by-word Persian captions placed above the Reels UI safe area
- Ends with the CTA: comment «میخوام» to get the repo link

## Storyboard

| Scene | Content |
| --- | --- |
| hook | "Hours of editing? Just chat!" + typing into a prompt bar |
| intro | video-use: raw footage → chat with Claude Code → final.mp4 |
| cuts | waveform; the "umm"s and silences are cut out |
| polish | color grade + subtitles + animation on a sample frame |
| reads | the film strip becomes transcript text: the AI reads the video instead of watching it |
| tokens | 45M tokens → 12KB |
| selfeval | Transcribe → Pack → LLM → EDL → Render → Self-Eval loop |
| oss | 100% open source |
| cta | comment «میخوام» |

## Rebuild

```bash
npm install && pip install piper-tts scipy numpy
# voice: https://huggingface.co/rhasspy/piper-voices/tree/main/fa/fa_IR/gyro/medium
python3 src/audio.py --voice fa_IR-gyro-medium.onnx      # -> out/timing.json, out/soundtrack.wav
CHROMIUM_PATH=/path/to/chrome node src/render.js --workers 4   # -> out/video-use-reel.mp4
```

Narration text and captions live in `src/script.json`. Scene timing comes from the length of each voice line.
