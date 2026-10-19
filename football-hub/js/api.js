// Thin client for API-Football v3 with a localStorage cache, so the daily quota lasts.
const Store = {
  get(k, d = null) { try { const v = localStorage.getItem('gb:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gb:' + k, JSON.stringify(v)); } catch {} },
};

function defaultSeason() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

const API = (() => {
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran';
  const inflight = new Map();
  const PREFIX = 'gbc:';

  const apiKey = () => Store.get('apiKey') || CONFIG.API_KEY;
  const season = () => Number(Store.get('season')) || defaultSeason();

  function cacheRead(k, ttl) {
    try {
      const raw = localStorage.getItem(PREFIX + k);
      if (!raw) return null;
      const { t, d } = JSON.parse(raw);
      return Date.now() - t < ttl * 1000 ? d : null;
    } catch { return null; }
  }
  function cacheWrite(k, d) {
    const v = JSON.stringify({ t: Date.now(), d });
    try { localStorage.setItem(PREFIX + k, v); }
    catch {
      clearCache();
      try { localStorage.setItem(PREFIX + k, v); } catch {}
    }
  }
  function clearCache() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  async function get(path, params = {}, ttl = 300) {
    const qs = new URLSearchParams(params).toString();
    const url = `${CONFIG.BASE_URL}/${path}${qs ? '?' + qs : ''}`;
    if (ttl > 0) {
      const hit = cacheRead(url, ttl);
      if (hit) return hit;
    }
    if (inflight.has(url)) return inflight.get(url);
    const p = (async () => {
      const r = await fetch(url, { headers: { 'x-apisports-key': apiKey() } });
      if (!r.ok) throw new Error(`خطای شبکه (HTTP ${r.status})`);
      const j = await r.json();
      const errs = j.errors ? (Array.isArray(j.errors) ? j.errors : Object.values(j.errors)) : [];
      if (errs.length) throw new Error(errs.join(' — '));
      if (ttl > 0) cacheWrite(url, j.response);
      return j.response;
    })().finally(() => inflight.delete(url));
    inflight.set(url, p);
    return p;
  }

  // Fetch every page of a paginated endpoint (players).
  async function getAll(path, params, ttl, maxPages = 4) {
    const out = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await get(path, { ...params, page }, ttl);
      out.push(...res);
      if (res.length < 20) break;
    }
    return out;
  }

  const byDate = (a, b) => a.fixture.timestamp - b.fixture.timestamp;

  return {
    TZ, season, clearCache,
    status: () => fetch(`${CONFIG.BASE_URL}/status`, { headers: { 'x-apisports-key': apiKey() } }).then(r => r.json()),

    fixturesByDate: (date) => get('fixtures', { date, timezone: TZ }, 120),
    live: () => get('fixtures', { live: 'all', timezone: TZ }, 30),
    fixture: async (id) => (await get('fixtures', { id, timezone: TZ }, 45))[0],
    h2h: async (a, b) => (await get('fixtures/headtohead', { h2h: `${a}-${b}`, timezone: TZ }, 3600 * 6))
      .filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)).sort(byDate).reverse(),
    predictions: async (fixture) => (await get('predictions', { fixture }, 3600 * 3))[0],
    injuries: (params) => get('injuries', { ...params, timezone: TZ }, 3600 * 3),

    // One request per season returns every fixture, so "next"/"last" are derived client-side
    // (the free plan does not allow the next/last parameters).
    teamFixtures: async (team, s = season()) => (await get('fixtures', { team, season: s, timezone: TZ }, 600)).sort(byDate),
    leagueFixtures: async (league, s = season()) => (await get('fixtures', { league, season: s, timezone: TZ }, 600)).sort(byDate),

    leagues: (params) => get('leagues', params, 3600 * 24),
    standings: async (league, s = season()) => {
      const r = await get('standings', { league, season: s }, 1800);
      return r[0]?.league || null;
    },
    topScorers: (league, s = season()) => get('players/topscorers', { league, season: s }, 3600 * 3),
    topAssists: (league, s = season()) => get('players/topassists', { league, season: s }, 3600 * 3),
    topYellow: (league, s = season()) => get('players/topyellowcards', { league, season: s }, 3600 * 6),

    team: async (id) => (await get('teams', { id }, 3600 * 24 * 7))[0],
    teamStats: (team, league, s = season()) => get('teams/statistics', { team, league, season: s }, 3600 * 3),
    squad: async (team) => (await get('players/squads', { team }, 3600 * 12))[0],
    teamPlayers: (team, s = season()) => getAll('players', { team, season: s }, 3600 * 6),

    player: async (id, s = season()) => (await get('players', { id, season: s }, 3600 * 3))[0],
    trophies: (player) => get('trophies', { player }, 3600 * 24 * 7),

    searchTeams: (q) => get('teams', { search: q }, 3600 * 24),
    searchPlayers: (q) => get('players/profiles', { search: q }, 3600 * 24),
  };
})();
