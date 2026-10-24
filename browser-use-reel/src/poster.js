// Renders src/poster.html to video/browser-use-poster.png (1080x1920) plus a 4:5 feed crop.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`http://localhost:${srv.address().port}/src/poster.html`);
await page.waitForFunction(() => window.__ready === true);
fs.mkdirSync(path.join(ROOT, 'video'), { recursive: true });
await page.screenshot({ path: path.join(ROOT, 'video/browser-use-poster.png') });
await page.screenshot({ path: path.join(ROOT, 'video/browser-use-poster-4x5.png'), clip: { x: 0, y: 285, width: 1080, height: 1350 } });
await browser.close();
srv.close();
