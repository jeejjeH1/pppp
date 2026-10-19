// Client for ESPN's public soccer API with a localStorage cache.
// Responses are normalised into small shapes the views share (see normEvent).
const Store = {
  get(k, d = null) { try { const v = localStorage.getItem('gb:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gb:' + k, JSON.stringify(v)); } catch {} },
};

const API = (() => {
  const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
  const SITE_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer/';
  const WEB = 'https://site.web.api.espn.com/apis/';
  const PREFIX = 'gbe:';
  const NONE = { __none: true };
  const inflight = new Map();

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

  // ESPN normally allows browser requests; the proxy covers networks where it does not.
  let mode = null;
  try { mode = sessionStorage.getItem('gb:espn-mode'); } catch {}
  const setMode = (m) => { mode = m; try { sessionStorage.setItem('gb:espn-mode', m); } catch {} };
  async function request(url) {
    if (mode !== 'proxy') {
      try {
        const r = await fetch(url);
        if (r.ok || r.status === 404 || r.status === 400) { setMode('direct'); return r; }
      } catch { /* CORS or network block */ }
      if (mode !== 'direct') setMode('proxy');
    }
    return fetch(CONFIG.PROXY + encodeURIComponent(url));
  }

  // Parsed JSON, or null when ESPN has nothing for the URL.
  async function get(url, ttl = 300) {
    const hit = cacheRead(url, ttl);
    if (hit !== undefined) return hit.__none ? null : hit;
    if (inflight.has(url)) return inflight.get(url);
    const p = (async () => {
      const r = await request(url);
      if (r.status === 404 || r.status === 400) { cacheWrite(url, NONE); return null; }
      if (!r.ok) throw new Error(`ESPN پاسخ نداد (HTTP ${r.status})`);
      const text = await r.text();
      let j;
      try { j = JSON.parse(text); } catch { throw new Error(`پاسخ نامعتبر از ESPN (${text.length} بایت)`); }
      if (j && (j.code === 404 || j.error) && !j.events && !j.team) { cacheWrite(url, NONE); return null; }
      cacheWrite(url, j);
      return j;
    })().finally(() => inflight.delete(url));
    inflight.set(url, p);
    return p;
  }
  const soft = (p, fallback = null) => p.catch(() => fallback);

  /* ---------- normalisation ---------- */
  const logoOf = (t) => t?.logo || t?.logos?.[0]?.href || '';
  const scoreVal = (s) => s == null ? null : typeof s === 'object' ? (s.displayValue ?? s.value) : s;
  function normTeam(c) {
    if (!c) return { id: '', name: '?' };
    const t = c.team || {};
    return { id: String(t.id ?? c.id ?? ''), name: t.displayName || t.name || '', short: t.shortDisplayName || t.abbreviation || t.displayName || '',
      abbr: t.abbreviation || '', logo: logoOf(t), score: scoreVal(c.score), winner: c.winner === true, form: c.form || '',
      shootout: c.shootoutScore ?? null };
  }
  function normStatus(s) {
    const t = s?.type || {};
    const name = String(t.name || '');
    let state = t.state || 'pre';
    if (/POSTPONED|CANCELED|CANCELLED|ABANDONED|SUSPENDED|DELAYED/.test(name)) state = 'off';
    return { state, detail: t.shortDetail || t.detail || t.description || '', desc: t.description || '', clock: s?.displayClock || '', name, completed: !!t.completed };
  }
  function normEvent(ev, league) {
    const c = ev.competitions?.[0] || ev;
    const cs = c.competitors || [];
    const home = cs.find(x => x.homeAway === 'home') || cs[0];
    const away = cs.find(x => x.homeAway === 'away') || cs[1];
    const lg = league || {};
    return {
      id: String(ev.id), league: lg.slug || ev.league?.slug || lg.id || '', leagueName: lg.name || ev.league?.name || ev.season?.displayName || '',
      leagueLogo: lg.logo || '', ts: Math.floor(new Date(c.date || ev.date).getTime() / 1000), status: normStatus(c.status || ev.status),
      home: normTeam(home), away: normTeam(away), venue: c.venue?.fullName || '', city: c.venue?.address?.city || '',
      round: ev.week?.number || c.series?.summary || '', name: ev.name || '',
      details: c.details || [], notes: (c.notes || []).map(n => n.headline).filter(Boolean),
    };
  }
  const leagueInfo = (l, slug) => ({ slug: l?.slug || slug, name: l?.name || l?.abbreviation || '', logo: l?.logos?.[0]?.href || '' });
  const byTime = (a, b) => a.ts - b.ts;
  const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dedupe = (list) => [...new Map(list.map(e => [e.id, e])).values()].sort(byTime);

  async function scoreboard(slug, dates) {
    const j = await get(`${SITE}${slug}/scoreboard${dates ? '?dates=' + dates : ''}`, dates ? 120 : 30);
    if (!j) return [];
    const lg = leagueInfo(j.leagues?.[0], slug);
    return (j.events || []).map(e => normEvent(e, lg));
  }

  async function schedule(slug, team, fixture) {
    const j = await get(`${SITE}${slug}/teams/${team}/schedule${fixture ? '?fixture=true' : ''}`, 600);
    if (!j) return [];
    return (j.events || []).map(e => normEvent(e, leagueInfo(e.league || j.league || { slug }, slug)));
  }

  return {
    clearCache, mode: () => mode, logoOf, normEvent, normTeam, normStatus,

    // Matches on a local calendar day across the given leagues (ESPN days follow US time, so ask for a 3-day window).
    async day(date, slugs) {
      const d = new Date(date + 'T12:00:00');
      const a = new Date(d); a.setDate(a.getDate() - 1);
      const b = new Date(d); b.setDate(b.getDate() + 1);
      const lists = await Promise.all(slugs.map(s => soft(scoreboard(s, `${ymd(a)}-${ymd(b)}`), [])));
      return dedupe(lists.flat()).filter(e => fmt.iso(new Date(e.ts * 1000)) === date);
    },
    async live(slugs) {
      const lists = await Promise.all(slugs.map(s => soft(scoreboard(s), [])));
      return dedupe(lists.flat()).filter(e => e.status.state === 'in');
    },

    range: (slug, range) => scoreboard(slug, range).then(l => l.sort(byTime)),
    summary: (slug, id) => get(`${SITE}${slug}/summary?event=${id}`, 30),

    team: async (slug, id) => (await get(`${SITE}${slug}/teams/${id}`, 3600))?.team,
    roster: async (slug, id) => (await get(`${SITE}${slug}/teams/${id}/roster`, 43200))?.athletes || [],
    // Results and fixtures across several competitions, merged and de-duplicated.
    async teamSchedule(id, slugs) {
      const lists = await Promise.all(slugs.flatMap(s => [soft(schedule(s, id, false), []), soft(schedule(s, id, true), [])]));
      return dedupe(lists.flat());
    },
    leagueTeams: async (slug) => (await get(`${SITE}${slug}/teams`, 86400))?.sports?.[0]?.leagues?.[0]?.teams?.map(t => t.team) || [],

    standings: async (slug) => {
      const j = await get(`${SITE_V2}${slug}/standings`, 900);
      if (!j) return [];
      const groups = j.children?.length ? j.children : [j];
      return groups.filter(g => g.standings?.entries?.length).map(g => ({ name: g.name || '', entries: g.standings.entries }));
    },
    leaguesMeta: async (slug) => leagueInfo((await get(`${SITE}${slug}/scoreboard`, 3600))?.leagues?.[0], slug),
    leagueCalendar: async (slug) => (await get(`${SITE}${slug}/scoreboard`, 3600))?.leagues?.[0],
    leaders: async (slug) => (await get(`${SITE}${slug}/statistics`, 1800))?.stats || [],
    news: async (slug, team) => (await get(`${SITE}${slug}/news${team ? '?team=' + team : ''}`, 900))?.articles || [],

    athlete: async (id) => (await get(`${WEB}common/v3/sports/soccer/athletes/${id}`, 86400))?.athlete,
    athleteOverview: (id) => get(`${WEB}common/v3/sports/soccer/athletes/${id}/overview`, 1800),
    athleteStats: (id) => get(`${WEB}common/v3/sports/soccer/athletes/${id}/stats`, 1800),
    athleteLog: (id) => get(`${WEB}common/v3/sports/soccer/athletes/${id}/gamelog`, 1800),

    search: async (q) => (await get(`${WEB}search/v2?query=${encodeURIComponent(q)}&limit=20&sport=soccer`, 3600))?.results || [],
  };
})();
