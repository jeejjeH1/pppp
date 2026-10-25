# Prismax — Latency vs. π0.5 rollout performance

56-second 1920×1080 / 60 fps motion piece for an X (Twitter) post, in the Prismax brand
(cream / near-black with gold and bronze accents, light editorial serif + grotesk, the Prismax wordmark).

**Final video:** [`video/prismax-latency-pi05.mp4`](video/prismax-latency-pi05.mp4)

| Time | Scene |
| --- | --- |
| 0–5 s | Cold open: light-speed warp, anamorphic flare, slit opens on the P(x) monogram, wordmark scan |
| 5–11 s | Title: *Latency vs. π0.5 Rollout Performance* |
| 11–17.5 s | Vision → Language → Action: building VLA models is only half the battle (50 % bar) |
| 17.5–23 s | The real challenge: deploy efficiently, perform reliably, in the real world |
| 23–28.5 s | 01 Latency: Δt dial and observe → infer → act pipeline |
| 28.5–34 s | 02 Execution: two robot arms tracking the same path at 20 ms vs 250 ms |
| 34–39.5 s | 03 Rollouts: 40 rollouts flip to success / failure, live success rate |
| 39.5–45 s | π0.5 and the gap between model capability and deployment performance |
| 45–51 s | Takeaway: *Faster. More reliable. Effective in the real world.* |
| 51–56 s | Wordmark lockup on cream |

The numbers on the dial, arms and rollout grid are illustrative and are labelled that way in the frame.

## Build

```sh
npm install                       # fonts (Fontsource)
pip install numpy scipy           # soundtrack
npm run stills                    # out/stills/*.png, one per second
npm run render                    # out/soundtrack.wav + out/prismax-latency.mp4
```

- `src/main.js` draws every frame on a 2D canvas as a pure function of time (`window.renderAt(t)`):
  scenes, transitions (zoom-flash, light sweep, split, RGB glitch, iris, white-out), bloom, light leaks,
  god rays, lens flares, bokeh, film grain, vignette and HUD.
- `src/timeline.json` holds the scene, transition and hit times; `src/audio.py` reads the same file so the
  impacts, risers, whooshes and ticks land on the picture.
- `src/render.cjs` steps the page in headless Chromium and pipes the frames into ffmpeg.
- `assets/prismax-*.svg` were vectorised from the brand-kit screenshots with `tools/trace_logo.py`.
  Brand fonts (Editorial New, Catalogue) are commercial, so Instrument Serif and Inter stand in for them.
