// Deterministic frame renderer: drives src/index.html in headless Chromium,
// steps window.renderAt(t) frame by frame and pipes screenshots into ffmpeg.
//
//   node src/render.js                         -> out/genlayer.mp4 (with soundtrack if present)
//   node src/render.js --stills 1,5.5,12       -> out/stills/*.png
//   node src/render.js --fps 30 --from 0 --to 10 --workers 3
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]] : acc), []),
);
const FPS = Number(args.fps ?? 60);
const W = 1920;
const H = 1080;
const SCALE = Number(args.scale ?? 1); // >1 = supersample, downscaled with lanczos on encode
const QUALITY = Number(args.quality ?? 97);

const MIME = { '.ttf': 'font/ttf', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        resp.writeHead(404).end();
        return;
      }
      resp.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(resp);
    });
    srv.listen(0, () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/${args.page ?? 'src/index.html'}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return page;
}

async function frame(page, t) {
  await page.evaluate((tt) => window.renderAt(tt), t);
  return page.screenshot({ type: args.stills ? 'png' : 'jpeg', quality: args.stills ? undefined : QUALITY, clip: { x: 0, y: 0, width: W, height: H } });
}

async function main() {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'],
  });
  const outDir = path.join(ROOT, args.outdir ?? 'out');
  fs.mkdirSync(outDir, { recursive: true });

  if (args.sfx) {
    const page = await openPage(browser, port);
    fs.writeFileSync(path.join(ROOT, args.sfx), JSON.stringify(await page.evaluate(() => window.SFX ?? []), null, 1));
    console.log('wrote', args.sfx);
    await browser.close();
    srv.close();
    return;
  }

  if (args.stills) {
    fs.mkdirSync(path.join(outDir, 'stills'), { recursive: true });
    const page = await openPage(browser, port);
    const duration = await page.evaluate(() => window.DURATION);
    const times = args.stills === 'auto' ? Array.from({ length: Math.ceil(duration) }, (_, i) => i + 0.5) : String(args.stills).split(',').map(Number);
    for (const t of times) {
      const t0 = Date.now();
      const buf = await frame(page, t);
      const f = path.join(outDir, 'stills', `t${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(f, buf);
      console.log(f, `${Date.now() - t0}ms`);
    }
    await browser.close();
    srv.close();
    return;
  }

  const probe = await openPage(browser, port);
  const duration = await probe.evaluate(() => window.DURATION);
  await probe.close();
  const from = Number(args.from ?? 0);
  const to = Number(args.to ?? duration);
  const total = Math.round((to - from) * FPS);
  const workers = Number(args.workers ?? 3);
  const chunk = Math.ceil(total / workers);
  const started = Date.now();
  let done = 0;

  const segs = await Promise.all(
    Array.from({ length: workers }, async (_, w) => {
      const a = w * chunk;
      const b = Math.min(total, a + chunk);
      const seg = path.join(outDir, `seg${w}.mp4`);
      if (a >= b) return null;
      const page = await openPage(browser, port);
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        ...(SCALE !== 1 ? ['-vf', `scale=${W}:${H}:flags=lanczos`] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf ?? 14), '-pix_fmt', 'yuv420p', '-tune', 'animation', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let i = a; i < b; i++) {
        const buf = await frame(page, from + i / FPS);
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        done++;
        if (done % 30 === 0) {
          const el = (Date.now() - started) / 1000;
          console.log(`${done}/${total} frames  ${(done / el).toFixed(2)} fps  eta ${((total - done) / (done / el) / 60).toFixed(1)} min`);
        }
      }
      ff.stdin.end();
      await new Promise((r) => ff.on('close', r));
      await page.close();
      return seg;
    }),
  );
  await browser.close();
  srv.close();

  const list = path.join(outDir, 'segments.txt');
  fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
  const audio = path.join(outDir, 'soundtrack.wav');
  const final = path.join(outDir, args.out ?? 'genlayer.mp4');
  const ffArgs = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (fs.existsSync(audio) && from === 0 && !args.noaudio) ffArgs.push('-i', audio, '-c:a', 'aac', '-b:a', '256k', '-shortest');
  ffArgs.push('-c:v', 'copy', '-movflags', '+faststart', final);
  await new Promise((r) => spawn('ffmpeg', ffArgs, { stdio: 'inherit' }).on('close', r));
  for (const s of segs.filter(Boolean)) fs.unlinkSync(s);
  fs.unlinkSync(list);
  console.log('wrote', final, `in ${((Date.now() - started) / 60000).toFixed(1)} min`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
