// Fallback proxy for ESPN's public JSON API, used only when the browser cannot call ESPN directly.
const ALLOWED = ['site.api.espn.com', 'site.web.api.espn.com', 'sports.core.api.espn.com'];

function ttlFor(url) {
  if (/scoreboard|summary/.test(url)) return 30;
  if (/schedule|standings|statistics|news/.test(url)) return 600;
  return 3600;
}

async function handler(req, res) {
  const target = new URL(req.url, 'http://x').searchParams.get('url');
  let u;
  try { u = new URL(target); } catch { u = null; }
  if (!u || u.protocol !== 'https:' || !ALLOWED.includes(u.hostname)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end('{"error":"url not allowed"}');
  }
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 golbox', Accept: 'application/json' } });
    const body = Buffer.from(await r.arrayBuffer());
    const ttl = ttlFor(u.pathname);
    res.statusCode = r.status;
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', r.ok ? `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 5}` : 'public, s-maxage=30');
    res.end(body);
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(e) }));
  }
}

module.exports = handler;
module.exports.handler = handler;
