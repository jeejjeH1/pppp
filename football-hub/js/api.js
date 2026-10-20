// Sportmonks Football API v3 client (through /api/sm) with a localStorage cache.
// Responses are mapped into the shapes the views share: events from normEvent, and a
// match "summary" with keyEvents, rosters, boxscore, standings, etc.
const Store = {
  get(k, d = null) { try { const v = localStorage.getItem('gb:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gb:' + k, JSON.stringify(v)); } catch {} },
};

const API = (() => {
  const PREFIX = 'gbm:';
  const NONE = { __none: true };
  const inflight = new Map();
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran';

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

  // Raw Sportmonks JSON ({ data, pagination, ... }), or null when there is no data.
  async function raw(path, ttl = 300) {
    const hit = cacheRead(path, ttl);
    if (hit !== undefined) return hit.__none ? null : hit;
    if (inflight.has(path)) return inflight.get(path);
    const p = (async () => {
      const token = Store.get('smToken');
      const r = await fetch(CONFIG.PROXY + encodeURIComponent(path), { headers: token ? { 'x-sm-token': token } : {} });
      const text = await r.text();
      let j = null;
      try { j = JSON.parse(text); } catch { /* handled below */ }
      if (r.status === 404 || (r.ok && j && j.data == null)) { cacheWrite(path, NONE); return null; }
      if (!r.ok || !j) throw new Error(`Sportmonks: ${j?.message || 'پاسخ نامعتبر'} (HTTP ${r.status})`);
      cacheWrite(path, j);
      return j;
    })().finally(() => inflight.delete(path));
    inflight.set(path, p);
    return p;
  }
  const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${v}`).join('&');
  const data = async (path, ttl) => (await raw(path, ttl))?.data ?? null;
  // Follow pagination (Sportmonks pages hold at most 50 rows).
  async function all(path, params, ttl, maxPages = 6) {
    const out = [];
    for (let page = 1; page <= maxPages; page++) {
      const j = await raw(`${path}?${qs({ ...params, per_page: 50, page })}`, ttl);
      if (!j?.data) break;
      out.push(...(Array.isArray(j.data) ? j.data : [j.data]));
      if (!j.pagination?.has_more) break;
    }
    return out;
  }
  // Try rich includes first; plans without an add-on reject them, so fall back to fewer.
  async function withIncludes(path, sets, ttl, extra = {}) {
    let lastErr;
    for (const inc of sets) {
      try { return await data(`${path}?${qs({ include: inc, ...extra })}`, ttl); }
      catch (e) { lastErr = e; if (!/HTTP (400|403|422)/.test(e.message)) throw e; }
    }
    throw lastErr;
  }
  const soft = (p, fallback = null) => p.catch(() => fallback);

  /* ---------- normalisation ---------- */
  const LIVE = /^(INPLAY|HT|BREAK|EXTRA_TIME_BREAK|PEN_BREAK|ET|PENALTIES)/;
  const DONE = /^(FT|AET|FT_PEN|AWARDED|WO)/;
  const OFF = /^(POSTPONED|CANCELLED|ABANDONED|SUSPENDED|INTERRUPTED|DELAYED|DELETED)/;
  const logoOf = (t) => t?.image_path || t?.logo || t?.logos?.[0]?.href || '';

  function normStatus(f) {
    const s = f.state || {};
    const code = String(s.state || s.developer_name || s.short_name || '');
    let state = 'pre';
    if (LIVE.test(code)) state = 'in'; else if (DONE.test(code)) state = 'post'; else if (OFF.test(code)) state = 'off';
    const tick = (f.periods || []).find(p => p.ticking) || (f.periods || []).slice(-1)[0];
    const clock = state === 'in' && tick?.minutes != null ? `${tick.minutes}'` : '';
    const detail = { FT_PEN: 'FT-Pens', HT: 'HT', AET: 'AET', FT: 'FT' }[code] || s.short_name || s.name || code;
    return { state, detail, desc: s.name || '', clock, name: code, completed: state === 'post' };
  }
  function scoreFor(f, loc, desc = 'CURRENT') {
    const s = (f.scores || []).find(x => x.description === desc && x.score?.participant === loc);
    return s ? s.score.goals : null;
  }
  function normTeam(p, f, loc) {
    if (!p) return { id: '', name: '?' };
    const st = normStatus(f).state;
    return { id: String(p.id), name: p.name || '', short: p.name || '', abbr: p.short_code || '', logo: logoOf(p),
      score: st === 'pre' ? null : scoreFor(f, loc) ?? 0, winner: p.meta?.winner === true, shootout: scoreFor(f, loc, 'PENALTY_SHOOTOUT') };
  }
  function normEvent(f) {
    const ps = f.participants || [];
    const home = ps.find(p => p.meta?.location === 'home') || ps[0];
    const away = ps.find(p => p.meta?.location === 'away') || ps[1];
    return {
      id: String(f.id), league: String(f.league_id ?? f.league?.id ?? ''), leagueName: f.league?.name || '', leagueLogo: logoOf(f.league),
      ts: f.starting_at_timestamp || Math.floor(new Date(String(f.starting_at).replace(' ', 'T') + 'Z').getTime() / 1000),
      status: normStatus(f), home: normTeam(home, f, 'home'), away: normTeam(away, f, 'away'),
      venue: f.venue?.name || '', city: f.venue?.city_name || '', round: f.round?.name || '', name: f.name || '', details: [], notes: [],
      seasonId: f.season_id, raw: f,
    };
  }
  const byTime = (a, b) => a.ts - b.ts;
  const dedupe = (list) => [...new Map(list.map(e => [e.id, e])).values()].sort(byTime);
  const LIST_INC = 'participants;scores;state;league;periods;round';
  const dayStr = (d) => fmt.iso(d);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  /* ---------- leagues & seasons ---------- */
  let leaguesP = null;
  // Leagues included in the token's plan, with their current season.
  const leagues = () => leaguesP || (leaguesP = all('leagues', { include: 'currentSeason;country' }, 86400, 10)
    .catch(e => { leaguesP = null; throw e; }));
  async function league(id) {
    const l = (await soft(leagues(), [])).find(x => String(x.id) === String(id));
    return l || data(`leagues/${id}?include=currentSeason;country`, 86400);
  }
  const seasonOf = async (id) => (await league(id))?.currentseason?.id || (await league(id))?.currentSeason?.id;

  /* ---------- statistic names ---------- */
  // Sportmonks developer names → the names the views (and STAT_FA) already know.
  const NAME_MAP = { BALL_POSSESSION: 'possessionPct', SHOTS_TOTAL: 'totalShots', SHOTS_ON_TARGET: 'shotsOnTarget', CORNERS: 'wonCorners', FOULS: 'foulsCommitted',
    OFFSIDES: 'offsides', YELLOWCARDS: 'yellowCards', REDCARDS: 'redCards', SAVES: 'saves', PASSES: 'totalPasses', ACCURATE_PASSES: 'accuratePasses',
    SUCCESSFUL_PASSES_PERCENTAGE: 'passPct', TACKLES: 'totalTackles', INTERCEPTIONS: 'interceptions', GOALS: 'totalGoals', ASSISTS: 'goalAssists',
    MINUTES_PLAYED: 'minutes', RATING: 'rating', EXPECTED_GOALS: 'expectedGoals', SHOTS_BLOCKED: 'blockedShots', CLEARANCES: 'totalClearance',
    APPEARANCES: 'appearances', GOALS_CONCEDED: 'goalsConceded', CLEANSHEETS: 'cleanSheet', OWN_GOALS: 'ownGoals', TOTAL_CROSSES: 'totalCrosses',
    ACCURATE_CROSSES: 'accurateCrosses', LONG_BALLS: 'totalLongBalls', FOULS_DRAWN: 'foulsSuffered' };
  const valueOf = (d) => {
    const v = d?.data?.value ?? d?.value;
    if (v == null) return null;
    if (typeof v !== 'object') return v;
    return v.total ?? v.average ?? v.all?.count ?? v.count ?? Object.values(v).find(x => typeof x === 'number') ?? null;
  };
  const statEntry = (d) => {
    const dev = d.type?.developer_name || d.type?.code || String(d.type_id);
    const v = valueOf(d);
    return { name: NAME_MAP[dev] || dev, label: d.type?.name || dev, displayName: d.type?.name || dev, abbreviation: d.type?.name || dev,
      value: typeof v === 'number' ? v : parseFloat(v) || 0, displayValue: v == null ? '' : String(typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v) };
  };

  /* ---------- match summary ---------- */
  const EVENT_TEXT = { GOAL: 'Goal', OWNGOAL: 'Own Goal', PENALTY: 'Penalty - Scored', MISSED_PENALTY: 'Penalty - Missed', YELLOWCARD: 'Yellow Card',
    REDCARD: 'Red Card', YELLOWREDCARD: 'Red Card (2nd yellow)', SUBSTITUTION: 'Substitution', VAR: 'VAR', VAR_CARD: 'VAR' };
  function keyEvents(f, ev) {
    return [...(f.events || [])].sort((a, b) => (a.minute - b.minute) || ((a.extra_minute || 0) - (b.extra_minute || 0)) || (a.sort_order || 0) - (b.sort_order || 0)).map(x => {
      const dev = x.type?.developer_name || x.type?.code || '';
      const text = EVENT_TEXT[dev] || x.type?.name || dev;
      return { type: { text }, scoringPlay: /^(GOAL|OWNGOAL|PENALTY)$/.test(dev), clock: { displayValue: `${x.minute ?? ''}${x.extra_minute ? '+' + x.extra_minute : ''}'` },
        team: { id: String(x.participant_id) }, shortText: x.info || x.addition || '',
        participants: [{ athlete: { displayName: x.player_name || x.player?.display_name || '' } }, ...(x.related_player_name ? [{ athlete: { displayName: x.related_player_name } }] : [])] };
    });
  }
  function rosters(f, ev) {
    const forms = f.formations || [];
    const goals = {}, yellows = {}, reds = {};
    (f.events || []).forEach(x => {
      const dev = x.type?.developer_name || '';
      if (/^(GOAL|PENALTY)$/.test(dev)) goals[x.player_id] = (goals[x.player_id] || 0) + 1;
      if (dev === 'YELLOWCARD') yellows[x.player_id] = 1;
      if (/REDCARD/.test(dev)) reds[x.player_id] = 1;
    });
    const subsIn = new Set((f.events || []).filter(x => x.type?.developer_name === 'SUBSTITUTION').map(x => x.player_id));
    const subsOut = new Set((f.events || []).filter(x => x.type?.developer_name === 'SUBSTITUTION').map(x => x.related_player_id));
    return [ev.home, ev.away].map((t, side) => {
      const lu = (f.lineups || []).filter(l => String(l.team_id) === t.id);
      if (!lu.length) return null;
      // formation_field is "row:col"; row 1 is the keeper, so row/col order gives formation order.
      const starters = lu.filter(l => l.type_id === 11 || (l.formation_field && l.type_id !== 12));
      const key = (l) => { const [r, c] = String(l.formation_field || '9:9').split(':').map(Number); return r * 100 + c; };
      starters.sort((a, b) => key(a) - key(b));
      const place = new Map(starters.map((l, i) => [l.player_id, i + 1]));
      return {
        homeAway: side === 0 ? 'home' : 'away', team: { id: t.id, displayName: t.name, logo: t.logo },
        formation: forms.find(x => String(x.participant_id) === t.id)?.formation || '',
        roster: lu.map(l => {
          const stats = (l.details || []).map(statEntry);
          if (goals[l.player_id] && !stats.some(s => s.name === 'totalGoals')) stats.push({ name: 'totalGoals', value: goals[l.player_id], displayValue: String(goals[l.player_id]) });
          if (yellows[l.player_id]) stats.push({ name: 'yellowCards', value: 1, displayValue: '1' });
          if (reds[l.player_id]) stats.push({ name: 'redCards', value: 1, displayValue: '1' });
          return { starter: place.has(l.player_id), formationPlace: String(place.get(l.player_id) || 0), jersey: l.jersey_number,
            subbedIn: subsIn.has(l.player_id), subbedOut: subsOut.has(l.player_id),
            athlete: { id: String(l.player_id), displayName: l.player_name || l.player?.display_name || '', shortName: l.player?.display_name, headshot: { href: logoOf(l.player) } },
            position: { abbreviation: ({ 24: 'G', 25: 'D', 26: 'M', 27: 'F' })[l.position_id] || '' }, stats };
        }),
      };
    }).filter(Boolean);
  }
  function boxscore(f, ev) {
    const teams = [ev.home, ev.away].map(t => ({ team: { id: t.id, displayName: t.name, logo: t.logo },
      statistics: (f.statistics || []).filter(s => String(s.participant_id) === t.id).map(statEntry) }));
    return teams[0].statistics.length ? teams : [];
  }
  // Last five results of a team, in the boxscore.form shape.
  async function formOf(team, beforeTs) {
    const list = (await soft(teamSchedule(team.id), [])).filter(e => e.status.state === 'post' && e.ts < beforeTs).slice(-5).reverse();
    return { team: { id: team.id, displayName: team.name, logo: team.logo }, events: list.map(e => {
      const home = e.home.id === team.id, opp = home ? e.away : e.home;
      const r = resultFor(e, team.id);
      return { id: e.id, gameResult: r === 'D' ? 'D' : r, atVs: home ? 'vs' : '@', opponent: { displayName: opp.name, id: opp.id, logo: opp.logo },
        score: `${e.home.score}-${e.away.score}`, leagueName: e.leagueName };
    }) };
  }
  async function h2hGames(ev) {
    const list = (await soft(all(`fixtures/head-to-head/${ev.home.id}/${ev.away.id}`, { include: LIST_INC }, 21600, 2), []))
      .map(normEvent).filter(e => e.status.state === 'post').sort(byTime).reverse().slice(0, 15);
    if (!list.length) return [];
    const ref = ev.home;
    return [{ team: { id: ref.id, displayName: ref.name, logo: ref.logo }, events: list.map(e => ({
      id: e.id, gameDate: new Date(e.ts * 1000).toISOString(), homeTeamId: e.home.id, awayTeamId: e.away.id, homeTeamScore: e.home.score, awayTeamScore: e.away.score,
      gameResult: resultFor(e, ref.id), opponent: e.home.id === ref.id ? { displayName: e.away.name, id: e.away.id, logo: e.away.logo } : { displayName: e.home.name, id: e.home.id, logo: e.home.logo },
      leagueName: e.leagueName })) }];
  }
  const FULL_INC = 'participants;scores;state;league;venue;round;periods;events.type;lineups.player;lineups.details.type;formations;statistics.type;referees.referee';
  const BASE_INC = 'participants;scores;state;league;venue;round;periods;events.type;lineups.player;formations;statistics.type';
  const MIN_INC = 'participants;scores;state;league;venue;periods;events';

  async function summary(_league, id) {
    const f = await withIncludes(`fixtures/${id}`, [FULL_INC, BASE_INC, MIN_INC], 30, { timezone: TZ });
    if (!f) return null;
    const ev = normEvent(f);
    const [comments, predictions, h2h, standingsGroups, formH, formA] = await Promise.all([
      soft(data(`fixtures/${id}?include=comments`, 60)), soft(data(`fixtures/${id}?include=predictions.type`, 3600)),
      soft(h2hGames(ev), []), soft(standings(ev.league), []), soft(formOf(ev.home, ev.ts)), soft(formOf(ev.away, ev.ts)),
    ]);
    const prob = (predictions?.predictions || []).find(p => /FULLTIME_RESULT/.test(p.type?.developer_name || '') && p.predictions?.home != null)?.predictions;
    const ref = (f.referees || []).find(r => r.type_id === 6) || (f.referees || [])[0];
    return {
      __event: ev,
      keyEvents: keyEvents(f, ev), rosters: rosters(f, ev),
      boxscore: { teams: boxscore(f, ev), form: [formH, formA].filter(x => x?.events?.length) },
      gameInfo: { venue: f.venue ? { fullName: f.venue.name, address: { city: f.venue.city_name } } : null, attendance: null,
        officials: ref?.referee ? [{ fullName: ref.referee.common_name || ref.referee.display_name || ref.referee.name }] : [] },
      commentary: (comments?.comments || []).sort((a, b) => (a.minute - b.minute) || (a.order - b.order)).map(c => ({ time: { displayValue: c.minute != null ? `${c.minute}${c.extra_minute ? '+' + c.extra_minute : ''}'` : '' }, text: c.comment })),
      headToHeadGames: h2h,
      __prob: prob ? { home: prob.home, draw: prob.draw, away: prob.away, provider: 'Sportmonks' } : null,
      standings: standingsGroups[0] ? { groups: [{ standings: { entries: standingsGroups[0].entries } }] } : null,
    };
  }

  /* ---------- standings & leaders ---------- */
  const ZONE_COLORS = [[/champions league/i, '#4c8dff'], [/europa league/i, '#f59f00'], [/conference/i, '#20c997'], [/relegation/i, '#ff6b6b'], [/promotion|play-?off|qualif/i, '#9775fa']];
  const DETAIL_IDS = { 129: 'gamesPlayed', 130: 'wins', 131: 'ties', 132: 'losses', 133: 'pointsFor', 134: 'pointsAgainst', 179: 'pointDifferential' };
  function detailName(d) {
    if (DETAIL_IDS[d.type_id]) return DETAIL_IDS[d.type_id];
    const c = String(d.type?.developer_name || d.type?.code || '').toUpperCase();
    if (!c.startsWith('OVERALL') && c !== 'GOAL_DIFFERENCE') return null;
    if (/MATCHES|PLAYED/.test(c)) return 'gamesPlayed';
    if (/WON|WINS/.test(c)) return 'wins';
    if (/DRAW/.test(c)) return 'ties';
    if (/LOST|LOSSES/.test(c)) return 'losses';
    if (/SCORED|GOALS_FOR/.test(c)) return 'pointsFor';
    if (/CONCEDED|AGAINST/.test(c)) return 'pointsAgainst';
    if (/DIFFERENCE/.test(c)) return 'pointDifferential';
    return null;
  }
  async function standings(leagueId) {
    const sid = await seasonOf(leagueId);
    if (!sid) return [];
    const rows = await withIncludes(`standings/seasons/${sid}`, ['participant;details.type;form;rule.type;group', 'participant;details.type;group', 'participant;details'], 900);
    if (!rows?.length) return [];
    const groups = new Map();
    rows.forEach(r => {
      const g = r.group?.name || (r.group_id ? String(r.group_id) : '');
      if (!groups.has(g)) groups.set(g, []);
      const st = { rank: r.position, points: r.points };
      (r.details || []).forEach(d => { const n = detailName(d); if (n && st[n] == null) st[n] = Number(valueOf(d) ?? d.value) || 0; });
      if (st.pointDifferential == null && st.pointsFor != null) st.pointDifferential = st.pointsFor - (st.pointsAgainst || 0);
      const zone = r.rule?.type?.name || r.rule?.type?.developer_name || '';
      const color = (ZONE_COLORS.find(([re]) => re.test(zone)) || [])[1];
      groups.get(g).push({ team: { id: String(r.participant_id), displayName: r.participant?.name || '', logos: [{ href: logoOf(r.participant) }] },
        note: zone ? { description: zone, color: color || '#868e96' } : null, form: (r.form || []).map(x => x.form).join(''),
        stats: Object.entries(st).map(([name, value]) => ({ name, value })) });
    });
    return [...groups].map(([name, entries]) => ({ name, entries }));
  }
  const TOP_TYPES = { 208: ['goalsLeaders', '⚽ گلزنان'], 209: ['assistsLeaders', '🎯 پاسورها'], 84: ['yellowLeaders', '🟨 کارت زرد'], 83: ['redLeaders', '🟥 کارت قرمز'] };
  async function leaders(leagueId) {
    const sid = await seasonOf(leagueId);
    if (!sid) return [];
    const rows = await all(`topscorers/seasons/${sid}`, { include: 'player;participant' }, 1800, 4);
    const cats = new Map();
    rows.forEach(r => {
      const t = TOP_TYPES[r.type_id]; if (!t) return;
      if (!cats.has(r.type_id)) cats.set(r.type_id, { name: t[0], displayName: t[1], leaders: [] });
      cats.get(r.type_id).leaders.push({ value: r.total, position: r.position,
        athlete: { id: String(r.player_id), displayName: r.player?.display_name || r.player?.name || '', headshot: { href: logoOf(r.player) },
          team: { id: String(r.participant_id), displayName: r.participant?.name || '', logos: [{ href: logoOf(r.participant) }] } } });
    });
    return [...cats.values()].map(c => ({ ...c, leaders: c.leaders.sort((a, b) => (a.position || 99) - (b.position || 99)) }));
  }

  /* ---------- teams ---------- */
  // Results and fixtures around today; the between endpoint covers at most ~100 days per call.
  async function teamSchedule(teamId) {
    const now = new Date();
    const windows = [[-180, -91], [-90, 0], [0, 90]];
    const lists = await Promise.all(windows.map(([a, b]) => soft(all(`fixtures/between/${dayStr(addDays(now, a))}/${dayStr(addDays(now, b))}/${teamId}`, { include: LIST_INC, timezone: TZ }, 600, 3), [])));
    return dedupe(lists.flat().map(normEvent));
  }
  async function team(_league, id) {
    const t = await withIncludes(`teams/${id}`, ['venue;country;activeSeasons.league;coaches', 'venue;country'], 3600);
    if (!t) return null;
    return { id: String(t.id), displayName: t.name, name: t.name, logos: [{ href: logoOf(t) }], founded: t.founded, venue: t.venue, country: t.country,
      activeSeasons: t.activeseasons || t.activeSeasons || [], standingSummary: t.founded ? `تأسیس ${fa(t.founded)}${t.venue?.name ? ' · ' + t.venue.name : ''}` : (t.venue?.name || '') };
  }
  // Squad with season numbers and current injuries, in the roster shape the views use.
  async function roster(leagueId, teamId) {
    const sid = await seasonOf(leagueId).catch(() => null);
    const [squad, side] = await Promise.all([
      sid ? soft(withIncludes(`squads/seasons/${sid}/teams/${teamId}`, ['player.nationality;position;details.type', 'player.nationality;position', 'player'], 3600)) : null,
      soft(withIncludes(`teams/${teamId}`, ['sidelined.sideline.type;sidelined.sideline.player', 'sidelined.player;sidelined.type'], 3600)),
    ]);
    let list = squad;
    if (!list?.length) list = await soft(withIncludes(`squads/teams/${teamId}`, ['player.nationality;position', 'player'], 3600), []);
    const out = (side?.sidelined || []).map(s => s.sideline || s).filter(s => !s.completed);
    const hurt = new Map(out.map(s => [String(s.player_id), s]));
    const age = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 31557600000) : null;
    return (list || []).map(r => {
      const p = r.player || {};
      const inj = hurt.get(String(r.player_id));
      return { id: String(r.player_id), displayName: p.display_name || p.name || p.common_name || '', jersey: r.jersey_number, age: age(p.date_of_birth),
        citizenship: p.nationality?.name || '', headshot: { href: logoOf(p) },
        position: { abbreviation: ({ 24: 'G', 25: 'D', 26: 'M', 27: 'F' })[r.position_id || p.position_id] || '', displayName: r.position?.name || '' },
        injuries: inj ? [{ status: 'Out', details: { type: inj.type?.name || inj.category || '', returnDate: inj.end_date }, shortComment: inj.type?.name || '' }] : [],
        statistics: (r.details || []).length ? { splits: { categories: [{ stats: r.details.map(statEntry) }] } } : null };
    });
  }

  /* ---------- players ---------- */
  async function athlete(id) {
    const p = await withIncludes(`players/${id}`, ['nationality;position;detailedPosition;teams.team', 'nationality;position'], 86400);
    if (!p) return null;
    const club = (p.teams || []).find(t => t.team?.type === 'domestic' && !t.end) || (p.teams || []).find(t => t.team?.type === 'domestic') || (p.teams || [])[0];
    return { id: String(p.id), displayName: p.display_name || p.common_name || p.name, fullName: p.name, age: p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / 31557600000) : null,
      dateOfBirth: p.date_of_birth, jersey: club?.jersey_number, citizenship: p.nationality?.name || '', displayHeight: p.height ? `${p.height} cm` : '', displayWeight: p.weight ? `${p.weight} kg` : '',
      position: { displayName: p.detailedposition?.name || p.detailedPosition?.name || p.position?.name || '' }, headshot: { href: logoOf(p) },
      team: club?.team ? { id: String(club.team.id), displayName: club.team.name, logos: [{ href: logoOf(club.team) }] } : null };
  }
  // Season-by-competition table built from every statistic Sportmonks returns for the player.
  async function athleteOverview(id) {
    const p = await withIncludes(`players/${id}`, ['statistics.details.type;statistics.season.league;statistics.team', 'statistics.details.type;statistics.season'], 3600);
    const stats = (p?.statistics || []).filter(s => (s.details || []).length).sort((a, b) => b.season_id - a.season_id).slice(0, 10);
    if (!stats.length) return null;
    const PREFER = ['appearances', 'minutes', 'totalGoals', 'goalAssists', 'rating', 'expectedGoals', 'totalShots', 'shotsOnTarget', 'yellowCards', 'redCards'];
    const cols = [];
    stats.forEach(s => s.details.map(statEntry).forEach(d => { if (!cols.find(c => c.name === d.name)) cols.push(d); }));
    cols.sort((a, b) => ((PREFER.indexOf(a.name) + 1) || 99) - ((PREFER.indexOf(b.name) + 1) || 99));
    return { statistics: { labels: cols.map(c => c.label), names: cols.map(c => c.name), displayNames: cols.map(c => c.label),
      splits: stats.map(s => {
        const ds = s.details.map(statEntry);
        return { displayName: `${s.season?.league?.name || ''} ${s.season?.name || ''}${s.team?.name ? ' · ' + s.team.name : ''}`.trim(), stats: cols.map(c => ds.find(d => d.name === c.name)?.displayValue ?? '-') };
      }) } };
  }

  return {
    TZ, clearCache, logoOf, normEvent, leagues, league, seasonOf,
    mode: () => 'proxy',
    async day(date) {
      const list = await all(`fixtures/date/${date}`, { include: LIST_INC, timezone: TZ }, 120, 8);
      return dedupe(list.map(normEvent)).filter(e => fmt.iso(new Date(e.ts * 1000)) === date);
    },
    async live() { return dedupe((await all('livescores/inplay', { include: LIST_INC, timezone: TZ }, 20, 4)).map(normEvent)); },
    async range(leagueId, range) {
      const [a, b] = range.split('-').map(s => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
      return dedupe((await all(`fixtures/between/${a}/${b}`, { include: LIST_INC, filters: `fixtureLeagues:${leagueId}`, timezone: TZ }, 300, 4)).map(normEvent));
    },
    summary, team, roster, standings, leaders, athlete, athleteOverview,
    teamSchedule: (id) => teamSchedule(id),
    leagueCalendar: async (id) => { const l = await league(id); return l ? { name: l.name, season: { displayName: (l.currentseason || l.currentSeason)?.name } } : null; },
    athleteStats: async () => null,
    news: async () => [],
    searchTeams: async (q) => (await soft(data(`teams/search/${encodeURIComponent(q)}?include=country`, 3600), [])) || [],
    searchPlayers: async (q) => (await soft(data(`players/search/${encodeURIComponent(q)}?include=nationality;position`, 3600), [])) || [],
    status: () => raw('my/usage', 0).catch(() => null),
  };
})();
