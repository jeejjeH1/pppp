// Page renderers. Each view gets (el, params, query) and fills `el`.
const popularRank = (id) => { const i = CONFIG.LEAGUES.findIndex(l => l.id === String(id)); return i < 0 ? 999 : i; };
const ALL_SLUGS = CONFIG.LEAGUES.map(l => l.id);
const Views = {};

/* ---------- Home: matches by day ---------- */
Views.home = async (el, _p, q) => {
  const today = new Date();
  const sel = q.date || fmt.iso(today);
  const liveOnly = q.live === '1';
  const days = [];
  for (let i = -3; i <= 3; i++) { const d = new Date(today); d.setDate(d.getDate() + i); days.push(d); }
  const dayLabel = (d, i) => i === 3 ? 'امروز' : i === 2 ? 'دیروز' : i === 4 ? 'فردا' : d.toLocaleDateString('fa-IR', { weekday: 'short' });

  el.innerHTML = `
    <div id="madridTeaser"></div>
    <div class="date-strip">
      <a class="live-toggle ${liveOnly ? 'on' : ''}" href="#/?live=${liveOnly ? 0 : 1}"><i></i>زنده</a>
      ${days.map((d, i) => `<a class="day ${!liveOnly && fmt.iso(d) === sel ? 'active' : ''}" href="#/?date=${fmt.iso(d)}">
        <b>${dayLabel(d, i)}</b><small>${d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'short' })}</small></a>`).join('')}
    </div>
    <div id="fixtures">${loader()}</div>`;

  Views.madridTeaser(el.querySelector('#madridTeaser'));

  const box = el.querySelector('#fixtures');
  try {
    const list = liveOnly ? await API.live(ALL_SLUGS) : await API.day(sel, ALL_SLUGS);
    if (!list.length) { box.innerHTML = empty(liveOnly ? 'هم‌اکنون بازی زنده‌ای در رقابت‌های اصلی در جریان نیست' : 'در رقابت‌های اصلی برای این روز بازی‌ای نیست'); return; }
    const groups = new Map();
    list.forEach(e => { if (!groups.has(e.league)) groups.set(e.league, { e, items: [] }); groups.get(e.league).items.push(e); });
    const sorted = [...groups.values()].sort((a, b) => (b.items.some(hasMadrid) - a.items.some(hasMadrid)) || popularRank(a.e.league) - popularRank(b.e.league));
    box.innerHTML = `<div class="summary-line">${fa(list.length)} بازی · ${fa(list.filter(isLive).length)} زنده</div>`
      + sorted.map(g => leagueGroup(g.e.league, g.e.leagueName, g.e.leagueLogo, g.items)).join('');
    if (liveOnly || list.some(isLive)) App.autoRefresh(45);
  } catch (e) { box.innerHTML = errorBox(e); }
};

Views.madridTeaser = async (host) => {
  try {
    const all = await API.teamSchedule(CONFIG.MADRID_ID, CONFIG.MADRID_LEAGUES);
    const next = all.find(isLive) || all.find(isUpcoming);
    if (!next) return;
    const live = isLive(next);
    host.innerHTML = `<a class="madrid-teaser" href="${matchHref(next)}">
      <span class="mt-tag">${live ? '● زنده' : 'بازی بعدی رئال مادرید'}</span>
      <span class="mt-teams">${img(next.home.logo || teamLogo(next.home.id), 'logo-md')}<b>${live ? scoreOf(next) : 'VS'}</b>${img(next.away.logo || teamLogo(next.away.id), 'logo-md')}</span>
      <span class="mt-info"><b>${esc(next.home.name)} — ${esc(next.away.name)}</b><small>${esc(leagueName(next.league, next.leagueName))} · ${fmt.date(next.ts)} · ${fmt.time(next.ts)}</small></span>
      <span class="mt-cta">پیش‌نمایش ویژه ‹</span>
    </a>`;
  } catch { /* the teaser is optional */ }
};

/* ---------- Leagues grid ---------- */
Views.leagues = async (el) => {
  el.innerHTML = `<h1 class="page-title">رقابت‌ها</h1><div id="lgGrid">${loader()}</div>`;
  try {
    const list = sortLeagues(await API.leagues());
    el.querySelector('#lgGrid').innerHTML = list.length
      ? `<div class="league-grid">${list.map(l => `<a class="league-tile card" href="#/league/${l.id}">${img(API.logoOf(l) || leagueLogo(l.id), 'logo-lg')}<b>${esc(leagueName(l.id, l.name))}</b><small>${esc(l.country?.name || '')}</small></a>`).join('')}</div>`
      : empty('پلن Sportmonks شما هیچ لیگی ندارد');
  } catch (e) { el.querySelector('#lgGrid').innerHTML = errorBox(e); }
};

// Plan leagues, well-known ones first in CONFIG order.
function sortLeagues(list) {
  return [...(list || [])].sort((a, b) => popularRank(String(a.id)) - popularRank(String(b.id)) || String(a.name).localeCompare(b.name));
}

/* ---------- League ---------- */
Views.league = async (el, { id: slug }, q) => {
  el.innerHTML = `<div class="hero league-hero">
      ${img(leagueLogo(slug), 'logo-xl')}
      <div><h1>${esc(leagueName(slug))}</h1><p id="lgSeason"></p></div>
    </div>
    ${tabs('league', [['table', 'جدول'], ['fixtures', 'بازی‌ها'], ['leaders', 'برترین‌ها']], q.tab || 'table')}
    <div id="leagueBody"></div>`;
  API.leagueCalendar(slug).then(l => {
    if (!l) return;
    el.querySelector('#lgSeason').textContent = `${l.name || ''} · فصل ${l.season?.displayName || ''}`;
    if (!CONFIG.LEAGUES.some(x => x.id === String(slug))) el.querySelector('h1').textContent = l.name;
  }).catch(() => {});

  bindTabs(el, 'league', '#leagueBody', {
    table: async () => {
      const groups = await API.standings(slug);
      if (!groups.length) return empty('جدولی برای این رقابت منتشر نشده — تب «بازی‌ها» را ببینید');
      return groups.map(g => standingsTable(g.entries.map(x => ({ ...x, __league: slug })), false, '', groups.length > 1 ? g.name : '')).join('');
    },
    fixtures: async () => leagueWeek(el, slug, 0),
    leaders: async () => leadersView(await API.leaders(slug)),
  }, q.tab || 'table');
};

// One week of a league's matches, with previous/next week buttons.
async function leagueWeek(el, slug, offset) {
  const start = new Date(); start.setDate(start.getDate() - 3 + offset * 7);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const ymd = (d) => fmt.iso(d).replace(/-/g, '');
  const list = await API.range(slug, `${ymd(start)}-${ymd(end)}`);
  setTimeout(() => {
    el.querySelectorAll('[data-week]').forEach(b => b.addEventListener('click', async () => {
      const host = el.querySelector('#leagueBody');
      host.innerHTML = loader();
      try { host.innerHTML = await leagueWeek(el, slug, offset + Number(b.dataset.week)); } catch (err) { host.innerHTML = errorBox(err); }
    }));
  });
  const byDay = new Map();
  list.forEach(e => { const k = fmt.iso(new Date(e.ts * 1000)); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); });
  return `<div class="week-nav"><button class="btn ghost" data-week="-1">› هفته قبل</button>
      <b>${fmt.short(start.getTime() / 1000)} تا ${fmt.short(end.getTime() / 1000)}</b>
      <button class="btn ghost" data-week="1">هفته بعد ‹</button></div>
    ${[...byDay].map(([, evs]) => `<div class="card"><div class="card-head"><b>${fmt.date(evs[0].ts)}</b></div>${evs.map(matchRow).join('')}</div>`).join('') || empty('در این هفته بازی‌ای نیست')}`;
}
function sv(entry, name) {
  const s = entry.stats?.find(x => x.name === name || x.type === name);
  return s ? (s.value ?? s.displayValue) : null;
}

function standingsTable(entries, mini = false, highlight = '', title = '') {
  const sorted = [...entries].sort((a, b) => (sv(a, 'rank') ?? 99) - (sv(b, 'rank') ?? 99));
  const notes = new Map();
  sorted.forEach(e => { if (e.note?.description) notes.set(e.note.description, e.note.color); });
  return `<div class="card table-card">
    ${title ? `<div class="card-head"><b>${esc(title)}</b></div>` : ''}
    <div class="scroll-x"><table class="standings">
      <thead><tr><th>#</th><th class="t-team">تیم</th><th>بازی</th>${mini ? '' : '<th>برد</th><th>مساوی</th><th>باخت</th><th class="hide-sm">گل</th>'}<th>تفاضل</th><th>امتیاز</th></tr></thead>
      <tbody>${sorted.map((e, i) => {
        const t = e.team || {};
        const gd = sv(e, 'pointDifferential');
        const tid = String(t.id);
        return `<tr class="${tid === String(highlight) || tid === CONFIG.MADRID_ID ? 'hl' : ''}">
        <td><span class="rank ${e.note?.color ? 'zoned' : ''}" style="${e.note?.color ? `background:${esc(e.note.color)};color:#0b0d12` : ''}" title="${esc(e.note?.description || '')}">${fa(sv(e, 'rank') ?? i + 1)}</span></td>
        <td class="t-team"><a href="${teamHref(e.__league || '', tid)}">${img(API.logoOf(t) || teamLogo(tid), 'logo-sm')}<span>${esc(t.shortDisplayName || t.displayName || t.name || '')}</span></a></td>
        <td>${num(sv(e, 'gamesPlayed'))}</td>
        ${mini ? '' : `<td>${num(sv(e, 'wins'))}</td><td>${num(sv(e, 'ties'))}</td><td>${num(sv(e, 'losses'))}</td><td class="hide-sm" dir="ltr">${num(sv(e, 'pointsFor'))}:${num(sv(e, 'pointsAgainst'))}</td>`}
        <td dir="ltr">${gd > 0 ? '+' : ''}${num(gd)}</td>
        <td><b>${num(sv(e, 'points'))}</b></td>
      </tr>`;
      }).join('')}</tbody>
    </table></div>
    ${!mini && notes.size ? `<div class="legend">${[...notes].map(([d, c]) => `<span><i class="rank" style="background:${esc(c)}"></i>${esc(d)}</span>`).join('')}</div>` : ''}
  </div>`;
}

// League leader boards: every top-scorer category the data source returns (goals, assists, cards).
const LEADER_FA = { goalsLeaders: '⚽ گلزنان', assistsLeaders: '🎯 پاسورها', yellowLeaders: '🟨 کارت زرد', redLeaders: '🟥 کارت قرمز' };
function leadersView(stats) {
  const cats = (stats || []).filter(c => c.leaders?.length);
  if (!cats.length) return empty('برای این رقابت آمار برترین‌ها منتشر نشده');
  return `<div class="leaders">${cats.map(c => `<div class="card leader"><div class="card-head"><b>${LEADER_FA[c.name] || LEADER_FA[c.displayName] || esc(c.displayName || c.name)}</b></div>
    ${c.leaders.slice(0, 10).map((l, i) => {
      const a = l.athlete || {};
      const team = a.team || l.team || {};
      return `<a class="board-row ${i === 0 ? 'first' : ''}" href="#/player/${a.id}">
        <span class="br-rank">${fa(i + 1)}</span>${img(a.headshot?.href || playerPhoto(a.id), 'avatar')}
        <span class="br-name"><b>${esc(a.displayName || '')}</b><small>${team.id ? img(API.logoOf(team) || teamLogo(team.id), 'logo-xs') + ' ' + esc(team.displayName || team.name || '') : ''} ${l.displayValue ? '· ' + esc(l.displayValue) : ''}</small></span>
        <span class="br-val"><b>${fa(l.value ?? '')}</b></span></a>`;
    }).join('')}</div>`).join('')}</div>`;
}

function newsList(articles) {
  if (!articles?.length) return empty('خبری موجود نیست');
  return `<div class="news-grid">${articles.slice(0, 18).map(a => `<a class="card news-card" href="${esc(a.links?.web?.href || '#')}" target="_blank" rel="noopener">
    ${a.images?.[0]?.url ? img(a.images[0].url, 'news-img') : ''}
    <div class="news-body"><b dir="auto">${esc(a.headline || '')}</b><small dir="auto">${esc(a.description || '')}</small>
    ${a.published ? `<small class="news-date">${fmt.short(new Date(a.published).getTime() / 1000)}</small>` : ''}</div></a>`).join('')}</div>`;
}

/* ---------- Match ---------- */
Views.match = async (el, { league, id }, q) => {
  el.innerHTML = loader();
  let s;
  try { s = await API.summary(league, id); } catch (err) { el.innerHTML = errorBox(err); return; }
  if (!s?.__event) { el.innerHTML = empty('بازی پیدا نشد'); return; }
  const e = s.__event;

  if (hasMadrid(e)) document.body.classList.add('madrid');
  if (hasMadrid(e) && isUpcoming(e)) return MadridViews.preview(el, e, s);

  const rosters = s.rosters || [];
  const hr = rosters.find(r => r.homeAway === 'home') || rosters[0], ar = rosters.find(r => r.homeAway === 'away') || rosters[1];
  const items = [['summary', 'خلاصه']];
  if (hr?.roster?.length) items.push(['lineups', 'ترکیب']);
  if (s.boxscore?.teams?.some(t => t.statistics?.length)) items.push(['stats', 'آمار']);
  if (hr?.roster?.some(p => p.stats?.length)) items.push(['players', 'بازیکنان']);
  if (s.commentary?.length) items.push(['commentary', 'گزارش زنده']);
  items.push(['h2h', 'رودررو'], ['predict', 'پیش‌بازی']);
  if (s.news?.articles?.length) items.push(['news', 'اخبار']);
  const active = items.some(i => i[0] === q.tab) ? q.tab : 'summary';

  el.innerHTML = matchHeader(e, s) + tabs('match', items, active) + '<div id="matchBody"></div>';
  bindTabs(el, 'match', '#matchBody', {
    summary: async () => matchSummary(e, s),
    lineups: async () => lineupsView(hr, ar),
    stats: async () => statsView(e, s),
    players: async () => playersView([hr, ar]),
    commentary: async () => commentaryView(s.commentary),
    h2h: async () => h2hView(e, s),
    predict: async () => pregameView(e, s),
    news: async () => newsList(s.news?.articles),
  }, active);
  if (isLive(e)) App.autoRefresh(40);
};

const isGoalEvent = (k) => k.scoringPlay || /goal|penalty - scored/i.test(k.type?.text || '');
function matchHeader(e, s) {
  const goals = (side) => (s.keyEvents || []).filter(k => isGoalEvent(k) && String(k.team?.id) === e[side].id)
    .map(k => `<span>${esc(shortName(k.participants?.[0]?.athlete?.displayName || ''))} ${esc(k.clock?.displayValue || '')}${/penalty/i.test(k.type?.text) ? ' (پ)' : /own/i.test(k.type?.text) ? ' (گ.ب)' : ''}</span>`).join('');
  const center = isUpcoming(e)
    ? `<div class="mh-score upcoming"><b>${fmt.time(e.ts)}</b><small>${fmt.date(e.ts)}</small></div>`
    : `<div class="mh-score ${isLive(e) ? 'is-live' : ''}"><b>${scoreOf(e)}</b><small>${statusLabel(e)}</small>
        ${e.home.shootout != null ? `<small>پنالتی ${scoreHtml(e.home.shootout, e.away.shootout)}</small>` : ''}</div>`;
  const gi = s.gameInfo || {};
  return `<div class="hero match-hero">
    <a class="mh-league" href="#/league/${e.league}">${img(e.leagueLogo || leagueLogo(e.league), 'logo-xs')} ${esc(leagueName(e.league, e.leagueName))}${e.round ? ' · هفته ' + fa(e.round) : ''}</a>
    <div class="mh-main">
      <a class="mh-team" href="${teamHref(e.league, e.home.id)}">${img(e.home.logo || teamLogo(e.home.id), 'logo-xl')}<b>${esc(e.home.name)}</b><div class="mh-goals">${goals('home')}</div></a>
      ${center}
      <a class="mh-team" href="${teamHref(e.league, e.away.id)}">${img(e.away.logo || teamLogo(e.away.id), 'logo-xl')}<b>${esc(e.away.name)}</b><div class="mh-goals">${goals('away')}</div></a>
    </div>
    <div class="mh-meta">
      ${gi.venue?.fullName ? `<span>🏟 ${esc(gi.venue.fullName)}${gi.venue.address?.city ? '، ' + esc(gi.venue.address.city) : ''}</span>` : ''}
      ${gi.attendance ? `<span>👥 ${fa(Number(gi.attendance).toLocaleString())} تماشاگر</span>` : ''}
      ${gi.officials?.[0]?.fullName || gi.officials?.[0]?.displayName ? `<span>🧑‍⚖️ ${esc(gi.officials[0].fullName || gi.officials[0].displayName)}</span>` : ''}
      <span>📅 ${fmt.full(e.ts)}</span>
    </div>
  </div>`;
}

function keyEventIcon(k) {
  const t = String(k.type?.text || '').toLowerCase();
  if (isGoalEvent(k)) return '⚽';
  if (t.includes('red')) return '🟥';
  if (t.includes('yellow')) return '🟨';
  if (t.includes('substitution')) return '🔁';
  if (t.includes('var')) return '📺';
  if (t.includes('miss') || t.includes('saved')) return '❌';
  return '•';
}

function eventsTimeline(e, s) {
  const ks = (s.keyEvents || []).filter(k => k.team?.id || /half|end|kickoff|start/i.test(k.type?.text || ''));
  if (!ks.some(k => k.team?.id)) return '';
  const rows = ks.map(k => {
    if (!k.team?.id) return `<div class="ev-period"><span>${esc(k.type?.text || '')}</span></div>`;
    const home = String(k.team.id) === e.home.id;
    const ps = (k.participants || []).map(p => p.athlete?.displayName).filter(Boolean);
    const sub = /substitution/i.test(k.type?.text || '');
    const main = sub
      ? `<b class="in">↑ ${esc(ps[0] || '')}</b><small class="out">↓ ${esc(ps[1] || '')}</small>`
      : `<b>${esc(ps[0] || k.shortText || '')}</b>${ps[1] && isGoalEvent(k) ? `<small>پاس: ${esc(ps[1])}</small>` : ''}${/penalty|own/i.test(k.type?.text || '') ? `<small dir="ltr">${esc(k.type.text)}</small>` : ''}`;
    const side = `<span class="ev-ico">${keyEventIcon(k)}</span><span class="ev-txt">${main}</span>`;
    return `<div class="ev ${home ? 'home' : 'away'} ${isGoalEvent(k) ? 'ev-goal' : ''}">
      <div class="ev-side">${home ? side : ''}</div>
      <div class="ev-min">${esc(k.clock?.displayValue || '')}</div>
      <div class="ev-side">${!home ? side : ''}</div>
    </div>`;
  });
  return `<div class="card"><div class="card-head"><b>رویدادهای بازی</b></div><div class="timeline">${rows.join('')}</div></div>`;
}

// Box-score statistics ordered home first.
function boxTeams(e, s) {
  const ts = s.boxscore?.teams || [];
  const h = ts.find(t => String(t.team?.id) === e.home.id) || ts[0], a = ts.find(t => String(t.team?.id) === e.away.id) || ts[1];
  return [h, a];
}
function statRows(e, s, only) {
  const [h, a] = boxTeams(e, s);
  if (!h?.statistics?.length || !a) return '';
  return h.statistics.filter(x => !only || only.includes(x.name)).map(x => {
    const y = a.statistics.find(z => z.name === x.name) || {};
    const isPct = /pct|Pct/.test(x.name);
    const hv = parseFloat(x.displayValue) || 0, av = parseFloat(y.displayValue) || 0;
    return statCompare(statLabel(x), isPct ? pct(hv) : x.displayValue, isPct ? pct(av) : y.displayValue, hv, av);
  }).join('');
}

function matchSummary(e, s) {
  const timeline = eventsTimeline(e, s);
  const key = statRows(e, s, ['possessionPct', 'totalShots', 'shotsOnTarget', 'wonCorners', 'foulsCommitted', 'saves']);
  const keyCard = key ? `<div class="card"><div class="card-head"><b>آمار کلیدی</b></div>${key}</div>` : '';
  const st = s.standings?.groups?.[0]?.standings?.entries;
  const table = st?.length ? `<div class="card"><div class="card-head"><b>جدول</b><a href="#/league/${e.league}">کامل ‹</a></div></div>${standingsTable(st.map(x => ({ ...x, __league: e.league })), true)}` : '';
  if (!timeline && !keyCard) return (isUpcoming(e) ? empty('بازی هنوز شروع نشده — تب «پیش‌بازی» و «رودررو» را ببینید') : '') + table;
  return timeline + keyCard + table;
}

function statsView(e, s) {
  const [h, a] = boxTeams(e, s);
  return `<div class="card"><div class="card-head teams-head">${img(e.home.logo || teamLogo(e.home.id), 'logo-sm')}<b>آمار بازی</b>${img(e.away.logo || teamLogo(e.away.id), 'logo-sm')}</div>
    ${statRows(e, s)}</div>`;
}

function lineupsView(hr, ar) {
  const side = (r) => `<div class="card subs">
    <div class="card-head">${img(API.logoOf(r.team) || teamLogo(r.team.id), 'logo-sm')}<b>${esc(r.team.displayName)}</b><small dir="ltr">${esc(r.formation || '')}</small></div>
    <div class="sub-title">نیمکت</div>
    ${r.roster.filter(p => !p.starter).map(p => `<a class="sub-row" href="#/player/${p.athlete?.id}"><i>${fa(p.jersey ?? '')}</i>${img(p.athlete?.headshot?.href || playerPhoto(p.athlete?.id), 'avatar-sm')}<span>${esc(p.athlete?.displayName || '')}${p.subbedIn ? ' <small class="in">↑ وارد شد</small>' : ''}</span><small>${posFa(p.position)}</small></a>`).join('') || empty('—')}
  </div>`;
  return pitch(hr, ar) + (hr && ar ? `<div class="two-col">${side(hr)}${side(ar)}</div>` : '');
}

// Every per-player match stat the data source returns, as columns.
function playersView(rosters) {
  return rosters.filter(Boolean).map(r => {
    const players = r.roster.filter(p => p.starter || p.subbedIn);
    const cols = [];
    players.forEach(p => (p.stats || []).forEach(x => { if (!cols.find(c => c.name === x.name)) cols.push(x); }));
    return `<div class="card table-card"><div class="card-head">${img(API.logoOf(r.team) || teamLogo(r.team.id), 'logo-sm')}<b>${esc(r.team.displayName)}</b></div>
      <div class="scroll-x"><table class="ptable">
        <thead><tr><th class="t-team">بازیکن</th><th>پست</th>${cols.map(c => `<th title="${esc(c.displayName || c.name)}">${STAT_FA[c.name] || esc(c.abbreviation || c.name)}</th>`).join('')}</tr></thead>
        <tbody>${players.map(p => `<tr><td class="t-team"><a href="#/player/${p.athlete?.id}">${img(p.athlete?.headshot?.href || playerPhoto(p.athlete?.id), 'avatar-sm')}<span>${esc(p.athlete?.displayName || '')}</span></a></td>
          <td>${esc(p.position?.abbreviation || '')}</td>
          ${cols.map(c => { const v = (p.stats || []).find(x => x.name === c.name); return `<td>${v ? fa(v.displayValue ?? v.value) : '-'}</td>`; }).join('')}</tr>`).join('')}</tbody>
      </table></div></div>`;
  }).join('');
}

function commentaryView(list) {
  return `<div class="card commentary">${[...list].reverse().map(c => `<div class="cm-row"><b>${esc(c.time?.displayValue || '')}</b><span dir="auto">${esc(c.text || '')}</span></div>`).join('')}</div>`;
}

function h2hView(e, s) {
  const games = (s.headToHeadGames || []).flatMap(g => (g.events || []).map(x => ({ ...x, __team: g.team })));
  if (!games.length) return empty('رویارویی قبلی ثبت نشده');
  const ref = games[0].__team ? String(games[0].__team.id) : e.home.id;
  let w = 0, d = 0, l = 0;
  games.forEach(x => { const r = x.gameResult; if (r === 'W') w++; else if (r === 'L') l++; else d++; });
  const refIsHome = ref === e.home.id;
  const hw = refIsHome ? w : l, aw = refIsHome ? l : w;
  return `<div class="card h2h-sum">
      <div class="h2h-team">${img(e.home.logo || teamLogo(e.home.id), 'logo-md')}<b>${fa(hw)}</b><small>برد</small></div>
      <div class="h2h-team"><span class="draw-ico">=</span><b>${fa(d)}</b><small>مساوی</small></div>
      <div class="h2h-team">${img(e.away.logo || teamLogo(e.away.id), 'logo-md')}<b>${fa(aw)}</b><small>برد</small></div>
      <div class="h2h-bar"><i class="hb" style="flex:${hw}"></i><i class="db" style="flex:${d}"></i><i class="ab" style="flex:${aw}"></i></div>
      <small class="muted">${fa(games.length)} دیدار اخیر</small>
    </div>
    <div class="card">${games.map(x => {
      const hs = x.homeTeamScore ?? '', as = x.awayTeamScore ?? '';
      const homeIsRef = String(x.homeTeamId) === ref;
      const refTeam = x.__team || {}, opp = x.opponent || {};
      const H = homeIsRef ? refTeam : opp, A = homeIsRef ? opp : refTeam;
      return `<a class="match-row" href="#/match/${e.league}/${x.id}">
        <span class="mr-status">${x.gameDate ? fmt.short(new Date(x.gameDate).getTime() / 1000) + ' ' + fa(new Date(x.gameDate).getFullYear()) : ''}</span>
        <span class="mr-team home"><span class="tn">${esc(H.displayName || H.abbreviation || '')}</span>${img(API.logoOf(H) || (H.id ? teamLogo(H.id) : ''), 'logo-sm')}</span>
        <span class="score">${hs !== '' ? scoreHtml(hs, as) : esc(x.score || '')}</span>
        <span class="mr-team away">${img(API.logoOf(A) || (A.id ? teamLogo(A.id) : ''), 'logo-sm')}<span class="tn">${esc(A.displayName || A.abbreviation || '')}</span></span>
      </a>`;
    }).join('')}</div>`;
}

// Result probabilities: Sportmonks predictions, or implied odds when a bookmaker line is present.
function oddsProb(s) {
  if (s.__prob) return { ...s.__prob, overUnder: null, details: '' };
  const o = (s.pickcenter || s.odds || [])[0];
  if (!o) return null;
  const ml = (x) => { const v = Number(x?.moneyLine ?? x?.current?.moneyLine?.american ?? x?.odds?.value); return isNaN(v) || !v ? null : v; };
  const imp = (v) => v == null ? null : v > 0 ? 100 / (v + 100) : -v / (-v + 100);
  const h = imp(ml(o.homeTeamOdds)), a = imp(ml(o.awayTeamOdds)), d = imp(ml(o.drawOdds));
  if (h == null || a == null) return null;
  const tot = h + a + (d || 0);
  return { home: h / tot * 100, away: a / tot * 100, draw: (d || 0) / tot * 100, provider: o.provider?.name || '', details: o.details || '', overUnder: o.overUnder };
}

function formCard(f, league) {
  const t = f.team || {};
  return `<div class="card form-card"><div class="card-head">${img(API.logoOf(t) || teamLogo(t.id), 'logo-sm')}<b>${esc(t.displayName || '')}</b></div>
    <div class="kv"><span>فرم اخیر</span>${formChips((f.events || []).map(x => x.gameResult).reverse())}</div>
    ${(f.events || []).slice(0, 5).map(x => `<a class="form-row" href="#/match/${league}/${x.id}"><i class="fc ${{ W: 'win', L: 'loss' }[x.gameResult] || 'draw'}">${{ W: 'ب', L: 'ش' }[x.gameResult] || 'م'}</i>
      <span>${esc(x.atVs || '')} ${esc(x.opponent?.displayName || '')}</span><b dir="ltr">${esc(x.score || '')}</b><small>${esc(x.leagueName || x.leagueAbbreviation || '')}</small></a>`).join('')}
  </div>`;
}

function pregameView(e, s) {
  let html = '';
  const p = oddsProb(s);
  if (p) {
    html += `<div class="card predict"><div class="card-head"><b>شانس هر نتیجه</b><small>پیش‌بینی ${esc(p.provider)}</small></div>
      <div class="win-prob">
        <div style="flex:${p.home}" class="wp home"><b>${pct(p.home)}</b><small>${esc(e.home.short)}</small></div>
        ${p.draw ? `<div style="flex:${p.draw}" class="wp draw"><b>${pct(p.draw)}</b><small>مساوی</small></div>` : ''}
        <div style="flex:${p.away}" class="wp away"><b>${pct(p.away)}</b><small>${esc(e.away.short)}</small></div>
      </div>
      ${p.details || p.overUnder ? `<p class="muted" dir="ltr">${esc(p.details)}${p.overUnder ? ' · O/U ' + esc(p.overUnder) : ''}</p>` : ''}</div>`;
  }
  const forms = s.boxscore?.form || [];
  if (forms.length) html += `<div class="two-col">${forms.map(f => formCard(f, e.league)).join('')}</div>`;
  const lead = s.leaders || [];
  if (lead.length) {
    html += `<div class="two-col">${lead.map(t => `<div class="card"><div class="card-head">${img(API.logoOf(t.team) || teamLogo(t.team?.id), 'logo-sm')}<b>ستاره‌های ${esc(t.team?.displayName || '')}</b></div>
      ${(t.leaders || []).map(c => (c.leaders || []).slice(0, 1).map(l => `<a class="board-row" href="#/player/${l.athlete?.id}">${img(l.athlete?.headshot?.href || playerPhoto(l.athlete?.id), 'avatar')}
        <span class="br-name"><b>${esc(l.athlete?.displayName || '')}</b><small>${esc(c.displayName || c.name || '')}</small></span><span class="br-val"><b>${esc(l.displayValue || '')}</b></span></a>`).join('')).join('')}</div>`).join('')}</div>`;
  }
  return html;
}

/* ---------- Team ---------- */
const CUP_SLUGS = ['uefa.champions', 'uefa.europa', 'uefa.europa.conf'];
Views.team = async (el, { league, id }, q) => {
  if (id === CONFIG.MADRID_ID && !q.tab) { location.hash = '#/madrid'; return; }
  el.innerHTML = loader();
  let t, all;
  try { [t, all] = await Promise.all([API.team(league, id), API.teamSchedule(id, [...new Set([league, ...CUP_SLUGS])])]); }
  catch (err) { el.innerHTML = errorBox(err); return; }
  if (!t) { el.innerHTML = empty('تیم پیدا نشد'); return; }
  const done = all.filter(isDone), next = all.filter(x => isUpcoming(x) || isLive(x));
  league = mainLeague(all, t) || league;

  el.innerHTML = `<div class="hero team-hero" style="${t.color ? `--team:#${esc(t.color)}` : ''}">
      ${img(API.logoOf(t) || teamLogo(id), 'logo-xl')}
      <div><h1>${esc(t.displayName)}</h1><p>${esc(t.standingSummary || '')}${t.record?.items?.[0]?.summary ? ' · ' + fa(t.record.items[0].summary) : ''}</p>${formChips(done.slice(-5).map(x => resultFor(x, id)))}</div>
    </div>
    ${tabs('team', [['overview', 'نمای کلی'], ['fixtures', 'بازی‌ها'], ['stats', 'آمار تیمی'], ['squad', 'بازیکنان'], ['injuries', 'مصدومان']], q.tab || 'overview')}
    <div id="teamBody"></div>`;

  bindTabs(el, 'team', '#teamBody', {
    overview: async () => {
      const st = await API.standings(league).catch(() => []);
      const g = st.find(x => x.entries.some(en => String(en.team?.id) === id));
      let mini = '';
      if (g) {
        const sorted = [...g.entries].sort((a, b) => (sv(a, 'rank') ?? 99) - (sv(b, 'rank') ?? 99));
        const i = sorted.findIndex(en => String(en.team?.id) === id);
        mini = `<div class="card"><div class="card-head"><b>${esc(leagueName(league))}</b><a href="#/league/${league}">جدول کامل ‹</a></div></div>` + standingsTable(sorted.slice(Math.max(0, i - 2), i + 3).map(x => ({ ...x, __league: league })), true, id);
      }
      return (next[0] ? nextMatchCard(next[0]) : '')
        + `<div class="card"><div class="card-head"><b>نتایج اخیر</b></div>${done.slice(-5).reverse().map(matchRow).join('') || empty('—')}</div>` + mini;
    },
    fixtures: async () => `<div class="card"><div class="card-head"><b>بازی‌های آینده</b></div>${next.map(matchRow).join('') || empty('—')}</div>
      <div class="card"><div class="card-head"><b>نتایج فصل</b></div>${done.slice().reverse().map(matchRow).join('') || empty('—')}</div>`,
    stats: async () => teamStatsView(id, done, t),
    squad: async () => squadView(await API.roster(league, id)),
    injuries: async () => injuriesView(await API.roster(league, id), t.displayName),
  }, q.tab || 'overview');
};

// The team's domestic league: the competition it plays most often this season.
function mainLeague(all, t) {
  const n = {};
  all.forEach(e => { n[e.league] = (n[e.league] || 0) + 1; });
  const active = (t?.activeSeasons || []).map(x => String(x.league_id ?? x.league?.id)).filter(Boolean);
  const domestic = active.find(id => (t.activeSeasons.find(x => String(x.league_id ?? x.league?.id) === id)?.league?.sub_type || '') === 'domestic');
  return domestic || Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function nextMatchCard(e) {
  return `<a class="card next-card ${hasMadrid(e) ? 'is-madrid' : ''}" href="${matchHref(e)}">
    <div class="card-head"><b>${isLive(e) ? '● زنده' : 'بازی بعدی'}</b><small>${img(leagueLogo(e.league), 'logo-xs')} ${esc(leagueName(e.league, e.leagueName))}</small></div>
    <div class="nc-main">
      <span class="nc-team">${img(e.home.logo || teamLogo(e.home.id), 'logo-lg')}<b>${esc(e.home.name)}</b></span>
      <span class="nc-mid">${isLive(e) ? `<b class="big">${scoreOf(e)}</b>` : `<b>${fmt.time(e.ts)}</b><small>${fmt.date(e.ts)}</small>`}</span>
      <span class="nc-team">${img(e.away.logo || teamLogo(e.away.id), 'logo-lg')}<b>${esc(e.away.name)}</b></span>
    </div>
    ${isUpcoming(e) ? countdown(e.ts) : ''}
  </a>`;
}

// Season numbers computed from results, split by competition and home/away.
function seasonTally(list, id) {
  const t = { n: 0, W: 0, D: 0, L: 0, gf: 0, ga: 0, cs: 0, fts: 0 };
  list.forEach(e => {
    const r = resultFor(e, id); if (!r) return;
    t.n++; t[r]++;
    const gf = goalsFor(e, id), ga = goalsAgainst(e, id);
    t.gf += gf; t.ga += ga; if (!ga) t.cs++; if (!gf) t.fts++;
  });
  return t;
}
function teamStatsView(id, done, team, accent = '') {
  if (!done.length) return '';
  const all = seasonTally(done, id);
  const home = seasonTally(done.filter(e => e.home.id === String(id)), id), away = seasonTally(done.filter(e => e.away.id === String(id)), id);
  const comps = [...new Set(done.map(e => e.league))];
  const avg = (x, n) => n ? dec(x / n, 2) : '-';
  const row = (label, t) => `<tr><td class="t-team">${label}</td><td>${fa(t.n)}</td><td>${fa(t.W)}</td><td>${fa(t.D)}</td><td>${fa(t.L)}</td><td dir="ltr">${fa(t.gf)}:${fa(t.ga)}</td><td>${fa(t.cs)}</td><td>${t.n ? pct(t.W / t.n * 100) : '-'}</td></tr>`;
  const big = [...done].sort((a, b) => (goalsFor(b, id) - goalsAgainst(b, id)) - (goalsFor(a, id) - goalsAgainst(a, id)));
  const recItems = (team?.record?.items || []).flatMap(it => (it.stats || []).map(s => ({ ...s, group: it.description || it.type })));
  const REC_FA = { gamesPlayed: 'بازی', wins: 'برد', ties: 'مساوی', losses: 'باخت', points: 'امتیاز', pointsFor: 'گل زده', pointsAgainst: 'گل خورده', pointDifferential: 'تفاضل', rank: 'رتبه', homeWins: 'برد خانگی', awayWins: 'برد خارج', homeLosses: 'باخت خانگی', awayLosses: 'باخت خارج', homeTies: 'مساوی خانگی', awayTies: 'مساوی خارج', ppg: 'امتیاز در هر بازی' };
  return `<div class="tiles ${accent}">
      ${statTile(fa(all.n), 'بازی', 'همه رقابت‌ها')}
      ${statTile(pct(all.W / all.n * 100), 'درصد برد', `${fa(all.W)} برد · ${fa(all.D)} مساوی · ${fa(all.L)} باخت`)}
      ${statTile(fa(all.gf), 'گل زده', 'میانگین ' + avg(all.gf, all.n))}
      ${statTile(fa(all.ga), 'گل خورده', 'میانگین ' + avg(all.ga, all.n))}
      ${statTile(fa(all.cs), 'کلین‌شیت')}
      ${statTile(fa(all.fts), 'بدون گل زده')}
      ${statTile(fa(all.gf - all.ga), 'تفاضل گل')}
      ${statTile(formChips(done.slice(-5).map(e => resultFor(e, id))) || '-', 'فرم اخیر')}
    </div>
    <div class="card table-card ${accent}"><div class="card-head"><b>تفکیک نتایج</b></div><div class="scroll-x"><table class="ptable">
      <thead><tr><th class="t-team"></th><th>بازی</th><th>برد</th><th>مساوی</th><th>باخت</th><th>گل</th><th>کلین‌شیت</th><th>درصد برد</th></tr></thead>
      <tbody>${row('خانه', home)}${row('خارج', away)}${comps.map(c => row(`${img(leagueLogo(c), 'logo-xs')} ${esc(leagueName(c))}`, seasonTally(done.filter(e => e.league === c), id))).join('')}</tbody>
    </table></div></div>
    <div class="card ${accent}"><div class="card-head"><b>فرم فصل</b></div><div class="season-form">${formChips(done.map(e => resultFor(e, id)), 60)}</div></div>
    <div class="two-col">
      <div class="card ${accent}"><div class="card-head"><b>بزرگ‌ترین بردها</b></div>${big.slice(0, 3).map(matchRow).join('') || empty('—')}</div>
      <div class="card ${accent}"><div class="card-head"><b>بدترین نتایج</b></div>${big.slice(-3).reverse().filter(e => resultFor(e, id) !== 'W').map(matchRow).join('') || empty('بدون باخت!')}</div>
    </div>
    ${recItems.length ? `<div class="card ${accent}"><div class="card-head"><b>رکورد رسمی</b></div><div class="kv-grid">${recItems.filter(s => REC_FA[s.name]).map(s => `<div class="kv"><span>${REC_FA[s.name]}${s.group && s.group !== 'Overall Record' ? ` <small>(${esc(s.group)})</small>` : ''}</span><b>${fa(Math.round((s.value ?? 0) * 100) / 100)}</b></div>`).join('')}</div></div>` : ''}`;
}

// Flatten the per-season stats attached to a roster athlete.
function athleteSeasonStats(a) {
  const out = {};
  const cats = a.statistics?.splits?.categories || a.statistics?.categories || [];
  cats.forEach(c => (c.stats || []).forEach(s => { out[s.name] = s; }));
  return out;
}

function squadView(list, accent = '', tableOnly = false) {
  if (!list?.length) return '';
  const groups = [['G', 'دروازه‌بان'], ['D', 'مدافع'], ['M', 'هافبک'], ['F', 'مهاجم']];
  const posKey = (a) => (a.position?.abbreviation || a.position?.name || '?')[0].toUpperCase();
  const withStats = list.map(a => ({ a, s: athleteSeasonStats(a) }));
  const statCols = ['appearances', 'totalGoals', 'goalAssists', 'totalShots', 'shotsOnTarget', 'yellowCards', 'redCards', 'saves', 'goalsConceded'];
  const hasStats = withStats.some(x => Object.keys(x.s).length);
  const usedCols = statCols.filter(c => withStats.some(x => x.s[c]));
  const cards = groups.map(([k, label]) => {
    const ps = list.filter(a => posKey(a) === k);
    if (!ps.length) return '';
    return `<div class="card ${accent}"><div class="card-head"><b>${label}</b><small>${fa(ps.length)} نفر</small></div>
      <div class="squad-grid">${ps.map(p => `<a class="squad-card" href="#/player/${p.id}">
        <span class="sq-num">${num(p.jersey, '')}</span>${img(p.headshot?.href || playerPhoto(p.id), 'avatar-lg')}<b>${esc(p.displayName || p.fullName || '')}</b>
        <small>${p.age ? fa(p.age) + ' سال' : ''}${p.citizenship ? ' · ' + esc(p.citizenship) : ''}</small>
        ${p.injuries?.length ? `<span class="inj-tag out">🚑 ${esc(p.injuries[0].status || 'مصدوم')}</span>` : ''}</a>`).join('')}</div></div>`;
  }).join('');
  const table = hasStats && usedCols.length ? `<div class="card table-card ${accent}"><div class="card-head"><b>آمار فصل بازیکنان</b></div><div class="scroll-x"><table class="ptable">
    <thead><tr><th class="t-team">بازیکن</th>${usedCols.map(c => `<th>${STAT_FA[c]}</th>`).join('')}</tr></thead>
    <tbody>${withStats.filter(x => x.s.appearances?.value || x.s.totalGoals?.value).sort((x, y) => (y.s.totalGoals?.value || 0) - (x.s.totalGoals?.value || 0)).map(({ a, s }) => `<tr>
      <td class="t-team"><a href="#/player/${a.id}">${img(a.headshot?.href || playerPhoto(a.id), 'avatar-sm')}<span>${esc(a.displayName)}</span></a></td>
      ${usedCols.map(c => `<td>${s[c] ? fa(s[c].displayValue ?? s[c].value) : '-'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : '';
  return tableOnly ? table : table + cards;
}

/* ---------- Player ---------- */
Views.player = async (el, { id }) => {
  el.innerHTML = loader();
  let a;
  try { a = await API.athlete(id); } catch (err) { el.innerHTML = errorBox(err); return; }
  if (!a) { el.innerHTML = empty('بازیکن پیدا نشد'); return; }
  const team = a.team || {};
  if (String(team.id) === CONFIG.MADRID_ID) document.body.classList.add('madrid');
  const meta = [['پست', posFa(a.position)], ['شماره', num(a.jersey)], ['سن', num(a.age)], ['ملیت', esc(a.citizenship || a.citizenshipCountry?.name || '-')],
    ['قد', a.displayHeight ? fa(a.displayHeight) : '-'], ['وزن', a.displayWeight ? fa(a.displayWeight) : '-'],
    ['تاریخ تولد', a.dateOfBirth ? new Date(a.dateOfBirth).toLocaleDateString('fa-IR') : (a.displayDOB ? esc(a.displayDOB) : '-')]];
  el.innerHTML = `<div class="hero player-hero">
      <div class="ph-photo">${img(a.headshot?.href || playerPhoto(a.id), '')}</div>
      <div class="ph-info">
        <h1>${esc(a.displayName || a.fullName)}</h1>
        ${team.id ? `<span class="ph-club">${img(API.logoOf(team) || teamLogo(team.id), 'logo-sm')} ${esc(team.displayName || '')}</span>` : ''}
        <div class="ph-meta">${meta.map(([k, v]) => `<span><small>${k}</small><b>${v}</b></span>`).join('')}
          ${a.injuries?.length ? `<span class="injured">🚑 ${esc(a.injuries[0].status || 'مصدوم')}</span>` : ''}</div>
      </div>
    </div>
    <div id="pOverview">${loader()}</div>
    <div id="pStats"></div>
    <div id="pNews"></div>`;

  API.athleteOverview(id).then(o => {
    el.querySelector('#pOverview').innerHTML = statSplitsTable(o?.statistics, 'آمار فصل') || '';
    el.querySelector('#pNews').innerHTML = o?.news?.length ? `<h3 class="section-title">اخبار</h3>${newsList(o.news)}` : '';
  }).catch(err => { el.querySelector('#pOverview').innerHTML = errorBox(err); });
  API.athleteStats(id).then(st => {
    const cats = st?.categories || [];
    el.querySelector('#pStats').innerHTML = cats.map(c => categoryTable(c)).join('');
  }).catch(() => {});
};

// ESPN "statistics" block: labels + splits rows (one row per competition).
function statSplitsTable(st, title) {
  if (!st?.splits?.length || !st.labels?.length) return '';
  return `<div class="card table-card"><div class="card-head"><b>${title}</b></div><div class="scroll-x"><table class="ptable">
    <thead><tr><th class="t-team">رقابت</th>${st.labels.map((l, i) => `<th title="${esc(st.displayNames?.[i] || l)}">${STAT_FA[st.names?.[i]] || esc(l)}</th>`).join('')}</tr></thead>
    <tbody>${st.splits.map(r => `<tr><td class="t-team">${esc(r.displayName || '')}</td>${(r.stats || []).map(v => `<td>${fa(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div></div>`;
}

// ESPN athlete stats category: one table per category with a row per season/competition.
function categoryTable(c) {
  const rows = c.statistics || c.splits || [];
  if (!rows.length || !c.labels?.length) return '';
  return `<div class="card table-card"><div class="card-head"><b dir="auto">${esc(c.displayName || c.name || '')}</b></div><div class="scroll-x"><table class="ptable">
    <thead><tr><th class="t-team">فصل</th>${c.labels.map((l, i) => `<th title="${esc(c.displayNames?.[i] || l)}">${STAT_FA[c.names?.[i]] || esc(l)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><td class="t-team" dir="auto">${esc(r.season?.displayName || r.displayName || r.season?.year || '')}${r.league?.name || r.teamSlug ? ' · ' + esc(r.league?.name || r.teamSlug) : ''}</td>${(r.stats || []).map(v => `<td>${fa(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div></div>`;
}

/* ---------- Search ---------- */
Views.search = async (el, _p, q) => {
  el.innerHTML = `<div class="search-box"><input id="q" type="search" placeholder="نام تیم یا بازیکن به انگلیسی…" value="${esc(q.q || '')}" dir="auto" autofocus></div><div id="results"></div>`;
  const input = el.querySelector('#q'), out = el.querySelector('#results');
  let timer;
  const run = async () => {
    const s = input.value.trim();
    if (s.length < 3) { out.innerHTML = empty('حداقل ۳ حرف، مثلاً: Real Madrid ، Vinicius ، Bellingham'); return; }
    history.replaceState(null, '', '#/search?q=' + encodeURIComponent(s));
    out.innerHTML = loader();
    try {
      const [teams, players] = await Promise.all([API.searchTeams(s), API.searchPlayers(s)]);
      out.innerHTML = `<div class="two-col">
        <div class="card"><div class="card-head"><b>تیم‌ها</b><small>${fa(teams.length)}</small></div>
          ${teams.slice(0, 20).map(t => `<a class="board-row" href="${teamHref('', t.id)}">${img(API.logoOf(t) || teamLogo(t.id), 'logo-md')}<span class="br-name"><b>${esc(t.name)}</b><small>${esc(t.country?.name || '')}</small></span></a>`).join('') || empty('—')}</div>
        <div class="card"><div class="card-head"><b>بازیکنان</b><small>${fa(players.length)}</small></div>
          ${players.slice(0, 20).map(p => `<a class="board-row" href="#/player/${p.id}">${img(API.logoOf(p) || playerPhoto(p.id), 'avatar')}<span class="br-name"><b>${esc(p.display_name || p.name)}</b><small>${esc(p.nationality?.name || '')}${p.position?.name ? ' · ' + esc(p.position.name) : ''}</small></span></a>`).join('') || empty('—')}</div>
      </div>`;
    } catch (err) { out.innerHTML = errorBox(err); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 500); });
  run();
};
