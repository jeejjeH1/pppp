// Vercel serverless proxy for SofaScore's public web API.
// SofaScore does not send CORS headers, so the browser calls /api/sofa?path=<api path> instead.
const HOSTS = ['https://api.sofascore.com/api/v1/', 'https://www.sofascore.com/api/v1/'];
const IMG_HOSTS = ['https://img.sofascore.com/api/v1/', 'https://api.sofascore.app/api/v1/'];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  'Accept': 'application/json, image/*;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
};

// Seconds the edge may cache a path; live data stays fresh, images and static data stay long.
function ttlFor(path) {
  if (path.endsWith('/image')) return 86400 * 7;
  if (/events\/live|^event\/\d+(\/(incidents|statistics|lineups))?$/.test(path)) return 20;
  if (/scheduled-events|events\/(next|last)/.test(path)) return 120;
  if (/standings|top-players|statistics/.test(path)) return 900;
  return 3600;
}

async function fetchSofa(path) {
  const isImg = path.endsWith('/image');
  let last = { status: 502, body: Buffer.from('{"error":"no upstream"}'), type: 'application/json' };
  for (const host of isImg ? IMG_HOSTS : HOSTS) {
    try {
      const r = await fetch(host + path, { headers: HEADERS });
      const body = Buffer.from(await r.arrayBuffer());
      last = { status: r.status, body, type: r.headers.get('content-type') || 'application/json' };
      if (r.ok || r.status === 404) return last;
    } catch (e) {
      last = { status: 502, body: Buffer.from(JSON.stringify({ error: String(e) })), type: 'application/json' };
    }
  }
  return last;
}

function validPath(p) {
  return typeof p === 'string' && p.length < 300 && !p.includes('..') && /^[a-z][\w\-\/]*(\?[\w\-=&%. ]*)?$/i.test(p);
}

async function handler(req, res) {
  const path = (req.query && req.query.path) || new URL(req.url, 'http://x').searchParams.get('path');
  if (!validPath(path)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end('{"error":"bad path"}');
  }
  const r = await fetchSofa(path);
  const ttl = ttlFor(path);
  res.statusCode = r.status;
  res.setHeader('Content-Type', r.type);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', r.status < 300 ? `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 5}` : 'public, s-maxage=30');
  res.end(r.body);
}

module.exports = handler;
module.exports.fetchSofa = fetchSofa;
module.exports.handler = handler;
