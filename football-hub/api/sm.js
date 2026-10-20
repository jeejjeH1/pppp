// Proxy for the Sportmonks Football API v3. The token stays server-side in the
// SPORTMONKS_API_TOKEN environment variable; a viewer may also supply their own via x-sm-token.
const BASE = 'https://api.sportmonks.com/v3/football/';

function ttlFor(path) {
  if (/^livescores/.test(path)) return 15;
  if (/^fixtures\/\d+/.test(path)) return 30;
  if (/^fixtures\/(date|between)/.test(path)) return 60;
  if (/^(standings|topscorers|squads)/.test(path)) return 900;
  return 3600;
}

function validPath(p) {
  return typeof p === 'string' && p.length < 600 && !p.includes('..') && /^[a-z][\w\-\/.,:;=&%? ]*$/i.test(p);
}

async function handler(req, res) {
  const params = new URL(req.url, 'http://x').searchParams;
  const path = params.get('path');
  const token = req.headers['x-sm-token'] || process.env.SPORTMONKS_API_TOKEN;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!validPath(path)) { res.statusCode = 400; return res.end('{"message":"bad path"}'); }
  if (!token) { res.statusCode = 401; return res.end('{"message":"No Sportmonks token: set SPORTMONKS_API_TOKEN or enter it in settings"}'); }
  try {
    const r = await fetch(BASE + path, { headers: { Authorization: token, Accept: 'application/json' } });
    const body = Buffer.from(await r.arrayBuffer());
    const ttl = ttlFor(path);
    res.statusCode = r.status;
    // Responses depend on the token's plan, so only cache them when the server token is used.
    const shared = !req.headers['x-sm-token'];
    res.setHeader('Cache-Control', r.ok && shared ? `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}` : 'no-store');
    const left = r.headers.get('x-ratelimit-remaining');
    if (left) res.setHeader('X-RateLimit-Remaining', left);
    res.end(body);
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ message: String(e) }));
  }
}

module.exports = handler;
module.exports.handler = handler;
