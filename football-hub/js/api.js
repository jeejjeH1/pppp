// Client for SofaScore (via the /api/sofa proxy) with a localStorage cache.
const Store = {
  get(k, d = null) { try { const v = localStorage.getItem('gb:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gb:' + k, JSON.stringify(v)); } catch {} },
};

const API = (() => {
  const inflight = new Map();
  const PREFIX = 'gbs:';
  const NONE = { __none: true };

  function cacheRead(k, ttl) {
    try {
      const raw = localStorage.getItem(PREFIX + k);
      if (!raw) return undefined;
      const { t, d } = JSON.parse(raw);
      return Date.now() - t < ttl * 1000 ? d : undefined;
    } catch { return undefined; }
  }
  function cacheWrite(k, d) {
    const v = JSON.stringify({ t: Date.now(), d });
    try { localStorage.setItem(PREFIX + k, v); }
    catch { clearCache(); try { localStorage.setItem(PREFIX + k, v); } catch {} }
  }
  function clearCache() {
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch {}
  }

  // SofaScore blocks most server IPs, so the viewer's browser asks SofaScore directly first
  // and only falls back to the /api/sofa proxy when that fails (e.g. CORS or a network block).
  const DIRECT = 'https://api.sofascore.com/api/v1/';
  let mode = null;
  try { mode = sessionStorage.getItem('gb:mode'); } catch {}
  const setMode = (m) => { mode = m; try { sessionStorage.setItem('gb:mode', m); } catch {} };

  async function request(path) {
    if (mode !== 'proxy') {
      try {
        const r = await fetch(DIRECT + encodeURI(path));
        if (r.ok || r.status === 404) { setMode('direct'); return r; }
      } catch { /* blocked by CORS or the network */ }
      if (mode !== 'direct') setMode('proxy');
    }
    return fetch(CONFIG.PROXY + encodeURIComponent(path));
  }

  // Returns the parsed JSON, or null when SofaScore has no data for the path (404).
  async function get(path, ttl = 300) {
    const hit = cacheRead(path, ttl);
    if (hit !== undefined) return hit.__none ? null : hit;
    if (inflight.has(path)) return inflight.get(path);
    const p = (async () => {
      const r = await request(path);
      if (r.status === 404) { cacheWrite(path, NONE); return null; }
      if (!r.ok) throw new Error(`SofaScore پاسخ نداد (HTTP ${r.status}) — ${path}`);
      const j = await r.json();
      cacheWrite(path, j);
      return j;
    })().finally(() => inflight.delete(path));
    inflight.set(path, p);
    return p;
  }

  const byTime = (a, b) => a.startTimestamp - b.startTimestamp;
  const events = async (path, ttl) => ((await get(path, ttl))?.events || []).sort(byTime);
  const seasonCache = {};

  return {
    clearCache,
    mode: () => mode,
    image: (kind, id) => `https://img.sofascore.com/api/v1/${kind}/${id}/image`,

    scheduled: (date) => events(`sport/football/scheduled-events/${date}`, 120),
    live: () => events('sport/football/events/live', 30),

    event: async (id) => (await get(`event/${id}`, 30))?.event,
    incidents: async (id) => (await get(`event/${id}/incidents`, 30))?.incidents || [],
    lineups: (id) => get(`event/${id}/lineups`, 60),
    statistics: async (id) => (await get(`event/${id}/statistics`, 30))?.statistics || [],
    h2h: async (id) => (await get(`event/${id}/h2h`, 3600))?.teamDuel,
    h2hEvents: (customId) => events(`event/${customId}/h2h/events`, 3600).then(l => l.reverse()),
    pregame: (id) => get(`event/${id}/pregame-form`, 1800),
    votes: async (id) => (await get(`event/${id}/votes`, 300))?.vote,

    team: async (id) => (await get(`team/${id}`, 86400))?.team,
    teamNext: (id) => events(`team/${id}/events/next/0`, 300),
    teamLast: (id) => events(`team/${id}/events/last/0`, 300),
    teamPlayers: async (id) => (await get(`team/${id}/players`, 43200))?.players || [],
    teamStats: async (id, tid, sid) => (await get(`team/${id}/unique-tournament/${tid}/season/${sid}/statistics/overall`, 1800))?.statistics,
    teamTop: async (id, tid, sid) => (await get(`team/${id}/unique-tournament/${tid}/season/${sid}/top-players/overall`, 1800))?.topPlayers,

    tournament: async (tid) => (await get(`unique-tournament/${tid}`, 86400 * 7))?.uniqueTournament,
    seasons: async (tid) => (await get(`unique-tournament/${tid}/seasons`, 86400))?.seasons || [],
    // The first season listed is the current one.
    currentSeason: async function (tid) {
      if (!seasonCache[tid]) seasonCache[tid] = this.seasons(tid).then(s => s[0]);
      return seasonCache[tid];
    },
    standings: async (tid, sid) => (await get(`unique-tournament/${tid}/season/${sid}/standings/total`, 900))?.standings || [],
    topPlayers: async (tid, sid) => (await get(`unique-tournament/${tid}/season/${sid}/top-players/overall`, 1800))?.topPlayers,
    rounds: (tid, sid) => get(`unique-tournament/${tid}/season/${sid}/rounds`, 3600),
    roundEvents: (tid, sid, round) => events(`unique-tournament/${tid}/season/${sid}/events/round/${round}`, 300),
    tournamentNext: (tid, sid) => events(`unique-tournament/${tid}/season/${sid}/events/next/0`, 300),
    tournamentLast: (tid, sid) => events(`unique-tournament/${tid}/season/${sid}/events/last/0`, 300),

    player: async (id) => (await get(`player/${id}`, 86400))?.player,
    playerSeasons: async (id) => (await get(`player/${id}/statistics/seasons`, 86400))?.uniqueTournamentSeasons || [],
    playerStats: async (id, tid, sid) => (await get(`player/${id}/unique-tournament/${tid}/season/${sid}/statistics/overall`, 1800))?.statistics,
    playerLast: (id) => events(`player/${id}/events/last/0`, 600),

    search: async (q) => (await get(`search/all?q=${q}`, 3600))?.results || [],
  };
})();
