// Page renderers. Each view gets (el, params, query) and fills `el`.
const leagueLogo = (id) => `https://media.api-sports.io/football/leagues/${id}.png`;
const popularRank = (id) => { const i = CONFIG.LEAGUES.findIndex(l => l.id === id); return i < 0 ? 999 : i; };

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
    const list = liveOnly ? await API.live() : await API.fixturesByDate(sel);
    if (!list.length) { box.innerHTML = empty(liveOnly ? 'هم‌اکنون بازی زنده‌ای در جریان نیست' : 'برای این روز بازی‌ای ثبت نشده'); return; }
    const groups = new Map();
    list.forEach(f => { if (!groups.has(f.league.id)) groups.set(f.league.id, { league: f.league, items: [] }); groups.get(f.league.id).items.push(f); });
    const sorted = [...groups.values()].sort((a, b) =>
      (b.items.some(hasMadrid) - a.items.some(hasMadrid)) || popularRank(a.league.id) - popularRank(b.league.id) || a.league.country.localeCompare(b.league.country));
    sorted.forEach(g => g.items.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp));
    const LIMIT = 20;
    const render = (all) => sorted.slice(0, all ? undefined : LIMIT).map(g => leagueGroup(g.league, g.items)).join('')
      + (!all && sorted.length > LIMIT ? `<button class="btn ghost wide" id="moreLeagues">نمایش همه (${fa(sorted.length)} رقابت)</button>` : '');
    box.innerHTML = `<div class="summary-line">${fa(list.length)} بازی · ${fa(list.filter(isLive).length)} زنده</div>` + render(false);
    box.addEventListener('click', (e) => { if (e.target.id === 'moreLeagues') box.innerHTML = render(true); });
    if (liveOnly || list.some(isLive)) App.autoRefresh(60);
  } catch (e) { box.innerHTML = errorBox(e); }
};

Views.madridTeaser = async (host) => {
  try {
    const fx = await API.teamFixtures(CONFIG.MADRID_ID);
    const live = fx.find(isLive);
    const next = live || fx.find(isUpcoming);
    if (!next) return;
    const { home, away } = next.teams;
    host.innerHTML = `<a class="madrid-teaser" href="#/match/${next.fixture.id}">
      <span class="mt-tag">${live ? '● زنده' : 'بازی بعدی رئال مادرید'}</span>
      <span class="mt-teams">${img(home.logo, 'logo-md')}<b>${live ? scoreHtml(next.goals.home, next.goals.away) : 'VS'}</b>${img(away.logo, 'logo-md')}</span>
      <span class="mt-info"><b>${esc(home.name)} — ${esc(away.name)}</b><small>${esc(next.league.name)} · ${fmt.date(next.fixture.timestamp)} · ${fmt.time(next.fixture.timestamp)}</small></span>
      <span class="mt-cta">پیش‌نمایش ویژه ‹</span>
    </a>`;
  } catch { /* the teaser is optional */ }
};

/* ---------- Leagues grid ---------- */
Views.leagues = async (el) => {
  el.innerHTML = `<h1 class="page-title">رقابت‌ها</h1>
    <div class="league-grid">${CONFIG.LEAGUES.map(l => `<a class="league-tile card" href="#/league/${l.id}">${img(leagueLogo(l.id), 'logo-lg')}<b>${l.name}</b></a>`).join('')}</div>`;
};

/* ---------- League ---------- */
Views.league = async (el, { id }, q) => {
  id = Number(id);
  const meta = CONFIG.LEAGUES.find(l => l.id === id);
  el.innerHTML = `<div class="hero league-hero">
      ${img(leagueLogo(id), 'logo-xl')}
      <div><h1 id="lgName">${esc(meta?.name || '')}</h1><p id="lgSub">فصل ${fa(API.season())}-${fa(String(API.season() + 1).slice(2))}</p></div>
    </div>
    ${tabs('league', [['table', 'جدول'], ['fixtures', 'بازی‌ها'], ['scorers', 'گلزنان'], ['assists', 'پاس گل'], ['cards', 'کارت‌ها']], q.tab || 'table')}
    <div id="leagueBody"></div>`;

  API.leagues({ id }).then(r => {
    const l = r[0]; if (!l) return;
    el.querySelector('#lgName').textContent = meta?.name || l.league.name;
    el.querySelector('#lgSub').textContent = `${l.country.name} · ${fa(API.season())}`;
  }).catch(() => {});

  bindTabs(el, 'league', '#leagueBody', {
    table: async () => {
      const lg = await API.standings(id);
      if (!lg) return empty('جدولی برای این رقابت موجود نیست');
      return lg.standings.map(standingsTable).join('');
    },
    fixtures: async () => {
      const fx = await API.leagueFixtures(id);
      if (!fx.length) return '';
      const rounds = [...new Set(fx.map(f => f.league.round))];
      const cur = (fx.find(f => isLive(f) || isUpcoming(f)) || fx[fx.length - 1]).league.round;
      const html = (r) => fx.filter(f => f.league.round === r).map(matchRow).join('');
      setTimeout(() => {
        const s = el.querySelector('#roundSel');
        s?.addEventListener('change', () => { el.querySelector('#roundList').innerHTML = html(s.value); });
      });
      return `<div class="card"><div class="card-head"><b>مرحله</b>
          <select id="roundSel">${rounds.map(r => `<option ${r === cur ? 'selected' : ''} value="${esc(r)}">${esc(roundFa(r))}</option>`).join('')}</select></div>
        <div id="roundList">${html(cur)}</div></div>`;
    },
    scorers: async () => playersBoard(await API.topScorers(id), 'goals'),
    assists: async () => playersBoard(await API.topAssists(id), 'assists'),
    cards: async () => playersBoard(await API.topYellow(id), 'yellow'),
  }, q.tab || 'table');
};

const roundFa = (r) => String(r).replace('Regular Season - ', 'هفته ').replace('Group Stage - ', 'مرحله گروهی - ').replace('League Stage - ', 'مرحله لیگ - ')
  .replace('Round of 16', 'یک‌هشتم').replace('Quarter-finals', 'یک‌چهارم').replace('Semi-finals', 'نیمه‌نهایی').replace(/^Final$/, 'فینال').replace(/\d+/g, fa);

function zoneClass(desc) {
  desc = String(desc || '').toLowerCase();
  if (!desc) return '';
  if (desc.includes('relegation')) return 'z-rel';
  if (desc.includes('champions league') || desc.includes('promotion') || desc.includes('1/8') || desc.includes('next round')) return 'z-ucl';
  if (desc.includes('europa league') || desc.includes('play-off') || desc.includes('playoff')) return 'z-uel';
  if (desc.includes('conference')) return 'z-uecl';
  return 'z-other';
}

function standingsTable(rows, mini = false, highlight = 0) {
  return `<div class="card table-card">
    ${rows[0]?.group && !/^(Premier League|La Liga|Serie A|Bundesliga|Ligue 1)$/.test(rows[0].group) ? `<div class="card-head"><b>${esc(rows[0].group)}</b></div>` : ''}
    <table class="standings">
      <thead><tr><th>#</th><th class="t-team">تیم</th><th>بازی</th>${mini ? '' : '<th>برد</th><th>مساوی</th><th>باخت</th><th class="hide-sm">گل</th>'}<th>تفاضل</th><th>امتیاز</th>${mini ? '' : '<th class="hide-sm">فرم</th>'}</tr></thead>
      <tbody>${rows.map(r => `<tr class="${r.team.id === highlight || (r.team.id === CONFIG.MADRID_ID) ? 'hl' : ''}">
        <td><span class="rank ${zoneClass(r.description)}" title="${esc(r.description || '')}">${fa(r.rank)}</span></td>
        <td class="t-team"><a href="#/team/${r.team.id}">${img(r.team.logo, 'logo-sm')}<span>${esc(r.team.name)}</span></a></td>
        <td>${fa(r.all.played)}</td>
        ${mini ? '' : `<td>${fa(r.all.win)}</td><td>${fa(r.all.draw)}</td><td>${fa(r.all.lose)}</td><td class="hide-sm" dir="ltr">${fa(r.all.goals.for)}:${fa(r.all.goals.against)}</td>`}
        <td dir="ltr">${r.goalsDiff > 0 ? '+' : ''}${fa(r.goalsDiff)}</td>
        <td><b>${fa(r.points)}</b></td>
        ${mini ? '' : `<td class="hide-sm">${formChips(r.form)}</td>`}
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function playersBoard(list, kind) {
  if (!list?.length) return '';
  const val = (s) => kind === 'goals' ? s.goals.total : kind === 'assists' ? s.goals.assists : s.cards.yellow;
  const lbl = { goals: 'گل', assists: 'پاس گل', yellow: 'کارت زرد' }[kind];
  return `<div class="card">${list.map((p, i) => {
    const s = p.statistics[0];
    return `<a class="board-row ${i === 0 ? 'first' : ''}" href="#/player/${p.player.id}">
      <span class="br-rank">${fa(i + 1)}</span>
      ${img(p.player.photo, 'avatar')}
      <span class="br-name"><b>${esc(p.player.name)}</b><small>${img(s.team.logo, 'logo-xs')} ${esc(s.team.name)} · ${fa(s.games.appearences || 0)} بازی</small></span>
      ${rating(s.games.rating)}
      <span class="br-val"><b>${fa(val(s) ?? 0)}</b><small>${lbl}</small></span>
    </a>`;
  }).join('')}</div>`;
}

/* ---------- Match ---------- */
Views.match = async (el, { id }, q) => {
  el.innerHTML = loader();
  let f;
  try { f = await API.fixture(id); } catch (e) { el.innerHTML = errorBox(e); return; }
  if (!f) { el.innerHTML = empty('بازی پیدا نشد'); return; }

  if (hasMadrid(f)) document.body.classList.add('madrid');
  if (hasMadrid(f) && isUpcoming(f)) return MadridViews.preview(el, f);

  const ratings = {};
  (f.players || []).forEach(t => t.players.forEach(p => { ratings[p.player.id] = p.statistics[0]?.games?.rating; }));

  const items = [['summary', 'خلاصه']];
  if (f.lineups?.length) items.push(['lineups', 'ترکیب']);
  if (f.statistics?.length) items.push(['stats', 'آمار']);
  if (f.players?.length) items.push(['players', 'بازیکنان']);
  items.push(['h2h', 'رودررو'], ['predict', 'پیش‌بینی']);
  const active = items.some(i => i[0] === q.tab) ? q.tab : 'summary';

  el.innerHTML = matchHeader(f) + tabs('match', items, active) + '<div id="matchBody"></div>';
  bindTabs(el, 'match', '#matchBody', {
    summary: async () => matchSummary(f, ratings),
    lineups: async () => lineupsView(f.lineups, ratings),
    stats: async () => statsView(f.statistics),
    players: async () => playersView(f),
    h2h: async () => h2hView(f.teams.home, f.teams.away, await API.h2h(f.teams.home.id, f.teams.away.id)),
    predict: async () => predictionView(await API.predictions(f.fixture.id), f),
  }, active);
  if (isLive(f)) App.autoRefresh(60);
};

function matchHeader(f) {
  const { home, away } = f.teams;
  const goals = (teamId) => (f.events || []).filter(e => e.type === 'Goal' && e.team.id === teamId && e.detail !== 'Missed Penalty')
    .map(e => `<span>${esc(shortName(e.player.name))} ${fa(e.time.elapsed)}'${e.detail === 'Penalty' ? ' (پ)' : e.detail === 'Own Goal' ? ' (گ.ب)' : ''}</span>`).join('');
  const center = isUpcoming(f)
    ? `<div class="mh-score upcoming"><b>${fmt.time(f.fixture.timestamp)}</b><small>${fmt.date(f.fixture.timestamp)}</small></div>`
    : `<div class="mh-score ${isLive(f) ? 'is-live' : ''}"><b>${scoreHtml(f.goals.home, f.goals.away)}</b>
        <small>${statusLabel(f)}</small>
        ${f.score.penalty?.home != null ? `<small>پنالتی ${scoreHtml(f.score.penalty.home, f.score.penalty.away)}</small>` : ''}</div>`;
  return `<div class="hero match-hero">
    <a class="mh-league" href="#/league/${f.league.id}">${img(f.league.logo, 'logo-xs')} ${esc(f.league.name)} · ${esc(roundFa(f.league.round))}</a>
    <div class="mh-main">
      <a class="mh-team" href="#/team/${home.id}">${img(home.logo, 'logo-xl')}<b>${esc(home.name)}</b><div class="mh-goals">${goals(home.id)}</div></a>
      ${center}
      <a class="mh-team" href="#/team/${away.id}">${img(away.logo, 'logo-xl')}<b>${esc(away.name)}</b><div class="mh-goals">${goals(away.id)}</div></a>
    </div>
    <div class="mh-meta">
      ${f.fixture.venue?.name ? `<span>🏟 ${esc(f.fixture.venue.name)}${f.fixture.venue.city ? '، ' + esc(f.fixture.venue.city) : ''}</span>` : ''}
      ${f.fixture.referee ? `<span>🧑‍⚖️ ${esc(f.fixture.referee)}</span>` : ''}
      <span>📅 ${fmt.full(f.fixture.timestamp)}</span>
    </div>
  </div>`;
}

const EVENT_ICON = (e) => e.type === 'Goal' ? (e.detail === 'Missed Penalty' ? '❌' : '⚽') : e.type === 'Card' ? (e.detail.includes('Red') || e.detail.includes('Second') ? '🟥' : '🟨') : e.type === 'subst' ? '🔁' : e.type === 'Var' ? '📺' : '•';

function eventsTimeline(f) {
  const ev = f.events || [];
  if (!ev.length) return '';
  const rows = ev.map(e => {
    const home = e.team.id === f.teams.home.id;
    const main = e.type === 'subst'
      ? `<b class="in">↑ ${esc(e.assist?.name || '')}</b><small class="out">↓ ${esc(e.player?.name || '')}</small>`
      : `<b>${esc(e.player?.name || '')}</b>${e.assist?.name ? `<small>${e.type === 'Goal' ? 'پاس: ' : ''}${esc(e.assist.name)}</small>` : ''}${e.type === 'Var' || e.detail === 'Own Goal' || e.detail === 'Penalty' ? `<small>${esc(e.detail)}</small>` : ''}`;
    return `<div class="ev ${home ? 'home' : 'away'} ev-${e.type.toLowerCase()}">
      <div class="ev-side">${home ? `<span class="ev-ico">${EVENT_ICON(e)}</span><span class="ev-txt">${main}</span>` : ''}</div>
      <div class="ev-min">${fa(e.time.elapsed)}${e.time.extra ? '+' + fa(e.time.extra) : ''}'</div>
      <div class="ev-side">${!home ? `<span class="ev-ico">${EVENT_ICON(e)}</span><span class="ev-txt">${main}</span>` : ''}</div>
    </div>`;
  });
  return `<div class="card"><div class="card-head"><b>رویدادهای بازی</b></div><div class="timeline">${rows.join('')}</div></div>`;
}

function matchSummary(f, ratings) {
  let motm = '';
  const all = (f.players || []).flatMap(t => t.players.map(p => ({ ...p, team: t.team })));
  const best = all.filter(p => p.statistics[0]?.games?.rating).sort((a, b) => b.statistics[0].games.rating - a.statistics[0].games.rating)[0];
  if (best) {
    const s = best.statistics[0];
    motm = `<a class="card motm" href="#/player/${best.player.id}">
      <span class="motm-tag">⭐ بهترین بازیکن زمین</span>
      ${img(best.player.photo, 'avatar-lg')}
      <span><b>${esc(best.player.name)}</b><small>${img(best.team.logo, 'logo-xs')} ${esc(best.team.name)} · ${fa(s.goals.total || 0)} گل · ${fa(s.goals.assists || 0)} پاس گل</small></span>
      ${rating(s.games.rating)}
    </a>`;
  }
  const keyStats = f.statistics?.length === 2
    ? `<div class="card"><div class="card-head"><b>آمار کلیدی</b></div>${['Ball Possession', 'expected_goals', 'Total Shots', 'Shots on Goal', 'Corner Kicks'].map(k => statRow(f.statistics, k)).join('')}</div>` : '';
  const timeline = eventsTimeline(f);
  if (!timeline && !keyStats) return isUpcoming(f) ? empty('بازی هنوز شروع نشده — تب «پیش‌بینی» و «رودررو» را ببینید') : '';
  return motm + timeline + keyStats;
}

function statRow(stats, key) {
  const h = stats[0].statistics.find(s => s.type === key)?.value, a = stats[1].statistics.find(s => s.type === key)?.value;
  if (h == null && a == null) return '';
  return statCompare(STAT_FA[key] || key, h, a);
}

function statsView(stats) {
  if (stats?.length !== 2) return '';
  const types = [...new Set(stats[0].statistics.map(s => s.type))].sort((a, b) => (STAT_ORDER.indexOf(a) + 1 || 99) - (STAT_ORDER.indexOf(b) + 1 || 99));
  return `<div class="card">
    <div class="card-head teams-head">${img(stats[0].team.logo, 'logo-sm')}<b>آمار بازی</b>${img(stats[1].team.logo, 'logo-sm')}</div>
    ${types.map(t => statRow(stats, t)).join('')}</div>`;
}

function lineupsView(lineups, ratings) {
  if (!lineups?.length) return '';
  const subs = (lu) => `<div class="card subs">
    <div class="card-head">${img(lu.team.logo, 'logo-sm')}<b>${esc(lu.team.name)}</b></div>
    ${lu.coach?.name ? `<div class="coach">${img(lu.coach.photo, 'avatar-sm')}<span><small>سرمربی</small><b>${esc(lu.coach.name)}</b></span></div>` : ''}
    <div class="sub-title">نیمکت</div>
    ${lu.substitutes.map(({ player: p }) => `<a class="sub-row" href="#/player/${p.id}"><i>${fa(p.number)}</i>${img(playerPhoto(p.id), 'avatar-sm')}<span>${esc(p.name)}</span><small>${POS_FA[p.pos] || ''}</small>${rating(ratings[p.id])}</a>`).join('')}
  </div>`;
  return pitch(lineups, ratings) + `<div class="two-col">${lineups.map(subs).join('')}</div>`;
}

function playersView(f) {
  return f.players.map(t => {
    const rows = [...t.players].sort((a, b) => (parseFloat(b.statistics[0].games.rating) || 0) - (parseFloat(a.statistics[0].games.rating) || 0));
    return `<div class="card table-card"><div class="card-head">${img(t.team.logo, 'logo-sm')}<b>${esc(t.team.name)}</b></div>
      <div class="scroll-x"><table class="ptable">
        <thead><tr><th class="t-team">بازیکن</th><th>نمره</th><th>دقیقه</th><th>گل</th><th>پاس گل</th><th>شوت</th><th>پاس کلیدی</th><th>دقت پاس</th><th>دریبل</th><th>تکل</th><th>دوئل</th></tr></thead>
        <tbody>${rows.map(({ player: p, statistics: [s] }) => `<tr>
          <td class="t-team"><a href="#/player/${p.id}">${img(p.photo, 'avatar-sm')}<span>${esc(p.name)}</span></a></td>
          <td>${rating(s.games.rating) || '-'}</td><td>${num(s.games.minutes)}</td><td>${num(s.goals.total, '۰')}</td><td>${num(s.goals.assists, '۰')}</td>
          <td>${num(s.shots.total, '۰')}/${num(s.shots.on, '۰')}</td><td>${num(s.passes.key, '۰')}</td><td>${s.passes.accuracy ? fa(s.passes.accuracy) + '٪' : '-'}</td>
          <td>${num(s.dribbles.success, '۰')}/${num(s.dribbles.attempts, '۰')}</td><td>${num(s.tackles.total, '۰')}</td><td>${num(s.duels.won, '۰')}/${num(s.duels.total, '۰')}</td>
        </tr>`).join('')}</tbody></table></div></div>`;
  }).join('');
}

function h2hView(home, away, list) {
  if (!list.length) return empty('رویارویی قبلی ثبت نشده');
  let hw = 0, aw = 0, d = 0;
  list.forEach(f => {
    const r = resultFor(f, home.id);
    if (r === 'W') hw++; else if (r === 'L') aw++; else d++;
  });
  const tot = list.length;
  return `<div class="card h2h-sum">
      <div class="h2h-team">${img(home.logo, 'logo-md')}<b>${fa(hw)}</b><small>برد</small></div>
      <div class="h2h-team"><span class="draw-ico">=</span><b>${fa(d)}</b><small>مساوی</small></div>
      <div class="h2h-team">${img(away.logo, 'logo-md')}<b>${fa(aw)}</b><small>برد</small></div>
      <div class="h2h-bar"><i class="hb" style="flex:${hw}"></i><i class="db" style="flex:${d}"></i><i class="ab" style="flex:${aw}"></i></div>
      <small class="muted">${fa(tot)} دیدار اخیر</small>
    </div>
    <div class="card">${list.slice(0, 15).map(f => `<div class="h2h-row"><small>${fmt.short(f.fixture.timestamp)} ${new Date(f.fixture.timestamp * 1000).getFullYear() !== new Date().getFullYear() ? fa(new Date(f.fixture.timestamp * 1000).getFullYear()) : ''} · ${esc(f.league.name)}</small>${matchRow(f)}</div>`).join('')}</div>`;
}

function predictionView(p, f) {
  if (!p) return '';
  const pr = p.predictions, cmp = p.comparison;
  const { home, away } = p.teams;
  const bar = (k, label) => cmp?.[k] ? `<div class="pred-cmp"><span>${pct(cmp[k].home)}</span><div class="pc-bar"><i style="width:${parseFloat(cmp[k].home)}%"></i></div><b>${label}</b><div class="pc-bar away"><i style="width:${parseFloat(cmp[k].away)}%"></i></div><span>${pct(cmp[k].away)}</span></div>` : '';
  return `<div class="card predict">
      <div class="card-head"><b>احتمال نتیجه</b></div>
      <div class="win-prob">
        <div style="flex:${parseFloat(pr.percent.home) || 1}" class="wp home"><b>${pct(pr.percent.home)}</b><small>${esc(home.name)}</small></div>
        <div style="flex:${parseFloat(pr.percent.draw) || 1}" class="wp draw"><b>${pct(pr.percent.draw)}</b><small>مساوی</small></div>
        <div style="flex:${parseFloat(pr.percent.away) || 1}" class="wp away"><b>${pct(pr.percent.away)}</b><small>${esc(away.name)}</small></div>
      </div>
      ${pr.advice ? `<p class="advice">💡 <span dir="ltr">${esc(pr.advice)}</span></p>` : ''}
      ${pr.goals?.home ? `<p class="muted">پیش‌بینی گل: ${esc(home.name)} <span dir="ltr">${esc(pr.goals.home)}</span> · ${esc(away.name)} <span dir="ltr">${esc(pr.goals.away)}</span></p>` : ''}
    </div>
    <div class="card"><div class="card-head teams-head">${img(home.logo, 'logo-sm')}<b>مقایسه قدرت</b>${img(away.logo, 'logo-sm')}</div>
      ${bar('form', 'فرم')}${bar('att', 'حمله')}${bar('def', 'دفاع')}${bar('poisson_distribution', 'مدل پواسون')}${bar('h2h', 'رودررو')}${bar('goals', 'گل')}${bar('total', 'کل')}
    </div>
    <div class="two-col">${[home, away].map(t => `<div class="card form-card">
      <div class="card-head">${img(t.logo, 'logo-sm')}<b>${esc(t.name)}</b></div>
      <div class="kv"><span>فرم ۵ بازی اخیر</span>${formChips(t.league?.form)}</div>
      <div class="kv"><span>میانگین گل زده (۵ بازی)</span><b>${num(t.last_5?.goals?.for?.average)}</b></div>
      <div class="kv"><span>میانگین گل خورده (۵ بازی)</span><b>${num(t.last_5?.goals?.against?.average)}</b></div>
      <div class="kv"><span>کلین‌شیت فصل</span><b>${num(t.league?.clean_sheet?.total)}</b></div>
    </div>`).join('')}</div>`;
}

/* ---------- Team ---------- */
Views.team = async (el, { id }, q) => {
  id = Number(id);
  if (id === CONFIG.MADRID_ID && !q.tab) { location.hash = '#/madrid'; return; }
  el.innerHTML = loader();
  let t, fx;
  try { [t, fx] = await Promise.all([API.team(id), API.teamFixtures(id)]); } catch (e) { el.innerHTML = errorBox(e); return; }
  if (!t) { el.innerHTML = empty('تیم پیدا نشد'); return; }
  const leagueIds = countLeagues(fx);
  const done = fx.filter(isDone), next = fx.filter(f => isUpcoming(f) || isLive(f));
  const form = done.slice(-5).map(f => resultFor(f, id)).join('');

  el.innerHTML = `<div class="hero team-hero">
      ${img(t.team.logo, 'logo-xl')}
      <div><h1>${esc(t.team.name)}</h1><p>${esc(t.team.country)}${t.team.founded ? ' · تأسیس ' + fa(t.team.founded) : ''}</p>${formChips(form)}</div>
    </div>
    ${tabs('team', [['overview', 'نمای کلی'], ['fixtures', 'بازی‌ها'], ['stats', 'آمار تیمی'], ['players', 'آمار بازیکنان'], ['squad', 'ترکیب']], q.tab || 'overview')}
    <div id="teamBody"></div>`;

  bindTabs(el, 'team', '#teamBody', {
    overview: async () => {
      const n = next[0];
      const lg = leagueIds[0] ? await API.standings(leagueIds[0].id).catch(() => null) : null;
      let mini = '';
      const rows = lg?.standings?.find(g => g.some(r => r.team.id === id));
      if (rows) {
        const i = rows.findIndex(r => r.team.id === id);
        mini = `<div class="card-head"><b>${esc(lg.name)}</b><a href="#/league/${lg.id}">جدول کامل ‹</a></div>` + standingsTable(rows.slice(Math.max(0, i - 2), i + 3), true, id);
      }
      return (n ? nextMatchCard(n) : '')
        + `<div class="card"><div class="card-head"><b>نتایج اخیر</b></div>${done.slice(-5).reverse().map(matchRow).join('') || empty('—')}</div>`
        + mini
        + `<div class="card venue">${img(t.venue?.image, 'venue-img')}<div><b>${esc(t.venue?.name || '')}</b><small>${esc(t.venue?.city || '')}${t.venue?.capacity ? ' · ظرفیت ' + fa(t.venue.capacity.toLocaleString()) : ''}</small></div></div>`;
    },
    fixtures: async () => `<div class="card"><div class="card-head"><b>بازی‌های آینده</b></div>${next.map(matchRow).join('') || empty('—')}</div>
      <div class="card"><div class="card-head"><b>نتایج</b></div>${done.slice().reverse().map(matchRow).join('') || empty('—')}</div>`,
    stats: async () => teamStatsView(id, leagueIds),
    players: async () => teamPlayersView(await API.teamPlayers(id)),
    squad: async () => squadView(await API.squad(id)),
  }, q.tab || 'overview');
};

function countLeagues(fx) {
  const m = new Map();
  fx.forEach(f => { const e = m.get(f.league.id) || { id: f.league.id, name: f.league.name, logo: f.league.logo, n: 0 }; e.n++; m.set(f.league.id, e); });
  return [...m.values()].sort((a, b) => b.n - a.n);
}

function nextMatchCard(f) {
  const { home, away } = f.teams;
  return `<a class="card next-card ${hasMadrid(f) ? 'is-madrid' : ''}" href="#/match/${f.fixture.id}">
    <div class="card-head"><b>${isLive(f) ? '● زنده' : 'بازی بعدی'}</b><small>${img(f.league.logo, 'logo-xs')} ${esc(f.league.name)}</small></div>
    <div class="nc-main">
      <span class="nc-team">${img(home.logo, 'logo-lg')}<b>${esc(home.name)}</b></span>
      <span class="nc-mid">${isLive(f) ? `<b class="big">${scoreHtml(f.goals.home, f.goals.away)}</b>` : `<b>${fmt.time(f.fixture.timestamp)}</b><small>${fmt.date(f.fixture.timestamp)}</small>`}</span>
      <span class="nc-team">${img(away.logo, 'logo-lg')}<b>${esc(away.name)}</b></span>
    </div>
    ${isUpcoming(f) ? countdown(f.fixture.timestamp) : ''}
  </a>`;
}

async function teamStatsView(team, leagues, selected) {
  if (!leagues.length) return '';
  const lid = selected || leagues[0].id;
  const s = await API.teamStats(team, lid);
  if (!s || !s.fixtures) return '';
  const g = s.goals;
  const minutes = Object.entries(g.for.minute || {});
  const maxMin = Math.max(1, ...minutes.map(([, v]) => v.total || 0), ...Object.values(g.against.minute || {}).map(v => v.total || 0));
  const id = 'ts' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    document.getElementById(id)?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-league]'); if (!b) return;
      const host = document.getElementById(id).parentElement;
      host.innerHTML = loader();
      try { host.innerHTML = await teamStatsView(team, leagues, Number(b.dataset.league)); } catch (err) { host.innerHTML = errorBox(err); }
    });
  });
  return `<div class="chips" id="${id}">${leagues.map(l => `<button class="chip ${l.id === lid ? 'active' : ''}" data-league="${l.id}">${img(l.logo, 'logo-xs')} ${esc(l.name)}</button>`).join('')}</div>
    <div class="tiles">
      ${statTile(fa(s.fixtures.played.total), 'بازی')}
      ${statTile(fa(s.fixtures.wins.total), 'برد', `خانه ${fa(s.fixtures.wins.home)} · خارج ${fa(s.fixtures.wins.away)}`)}
      ${statTile(fa(s.fixtures.draws.total), 'مساوی')}
      ${statTile(fa(s.fixtures.loses.total), 'باخت')}
      ${statTile(fa(g.for.total.total), 'گل زده', `میانگین ${fa(g.for.average.total)}`)}
      ${statTile(fa(g.against.total.total), 'گل خورده', `میانگین ${fa(g.against.average.total)}`)}
      ${statTile(fa(s.clean_sheet.total), 'کلین‌شیت')}
      ${statTile(fa(s.failed_to_score.total), 'بدون گل زده')}
    </div>
    <div class="card"><div class="card-head"><b>فرم فصل</b></div><div class="season-form">${formChips(s.form, 60)}</div></div>
    <div class="card"><div class="card-head"><b>گل‌ها بر اساس دقیقه</b><small><i class="dot for"></i>زده <i class="dot ag"></i>خورده</small></div>
      <div class="minute-chart">${minutes.map(([k, v]) => {
        const a = g.against.minute[k]?.total || 0;
        return `<div class="mc-col"><div class="mc-bars"><i class="for" style="height:${(v.total || 0) / maxMin * 100}%" title="${fa(v.total || 0)}"></i><i class="ag" style="height:${a / maxMin * 100}%" title="${fa(a)}"></i></div><small dir="ltr">${fa(k)}</small></div>`;
      }).join('')}</div></div>
    <div class="two-col">
      <div class="card"><div class="card-head"><b>رکوردها</b></div>
        <div class="kv"><span>بزرگ‌ترین برد خانگی</span><b dir="ltr">${num(s.biggest.wins.home)}</b></div>
        <div class="kv"><span>بزرگ‌ترین برد خارج</span><b dir="ltr">${num(s.biggest.wins.away)}</b></div>
        <div class="kv"><span>بدترین باخت خانگی</span><b dir="ltr">${num(s.biggest.loses.home)}</b></div>
        <div class="kv"><span>بدترین باخت خارج</span><b dir="ltr">${num(s.biggest.loses.away)}</b></div>
        <div class="kv"><span>طولانی‌ترین روند برد</span><b>${num(s.biggest.streak.wins)}</b></div>
        <div class="kv"><span>پنالتی</span><b>${num(s.penalty.scored.total)} از ${num(s.penalty.total)}</b></div>
      </div>
      <div class="card"><div class="card-head"><b>سیستم‌های بازی</b></div>
        ${(s.lineups || []).map(l => `<div class="kv"><b dir="ltr">${esc(l.formation)}</b><span>${fa(l.played)} بازی</span></div>`).join('') || empty('—')}
        <div class="kv"><span>کارت زرد</span><b>${fa(Object.values(s.cards.yellow).reduce((t, v) => t + (v.total || 0), 0))}</b></div>
        <div class="kv"><span>کارت قرمز</span><b>${fa(Object.values(s.cards.red).reduce((t, v) => t + (v.total || 0), 0))}</b></div>
      </div>
    </div>`;
}

function aggregate(stats) {
  const sum = (fn) => stats.reduce((t, s) => t + (fn(s) || 0), 0);
  const mins = sum(s => s.games.minutes);
  const rated = stats.filter(s => s.games.rating);
  const rating = rated.length ? rated.reduce((t, s) => t + parseFloat(s.games.rating) * (s.games.appearences || 1), 0) / rated.reduce((t, s) => t + (s.games.appearences || 1), 0) : null;
  return {
    apps: sum(s => s.games.appearences), mins, goals: sum(s => s.goals.total), assists: sum(s => s.goals.assists), rating,
    shots: sum(s => s.shots.total), shotsOn: sum(s => s.shots.on), keyPasses: sum(s => s.passes.key), passes: sum(s => s.passes.total),
    dribbles: sum(s => s.dribbles.success), dribblesAtt: sum(s => s.dribbles.attempts), tackles: sum(s => s.tackles.total), inter: sum(s => s.tackles.interceptions),
    duelsWon: sum(s => s.duels.won), duels: sum(s => s.duels.total), yellow: sum(s => s.cards.yellow), red: sum(s => s.cards.red),
    saves: sum(s => s.goals.saves), conceded: sum(s => s.goals.conceded), penScored: sum(s => s.penalty.scored),
  };
}

function teamPlayersView(list, accent = '') {
  if (!list.length) return '';
  const rows = list.map(p => ({ p: p.player, a: aggregate(p.statistics) })).filter(r => r.a.apps > 0);
  const top = (k, label) => {
    const best = [...rows].sort((x, y) => (y.a[k] || 0) - (x.a[k] || 0)).slice(0, 5).filter(r => r.a[k]);
    return `<div class="card leader ${accent}"><div class="card-head"><b>${label}</b></div>${best.map((r, i) => `<a class="board-row ${i === 0 ? 'first' : ''}" href="#/player/${r.p.id}">
      ${img(r.p.photo, 'avatar')}<span class="br-name"><b>${esc(r.p.name)}</b></span><span class="br-val"><b>${k === 'rating' ? fa(r.a.rating.toFixed(2)) : fa(r.a[k])}</b></span></a>`).join('') || empty('—')}</div>`;
  };
  rows.sort((x, y) => (y.a.goals + y.a.assists) - (x.a.goals + x.a.assists) || y.a.mins - x.a.mins);
  return `<div class="leaders">${top('goals', '⚽ گلزنان')}${top('assists', '🎯 پاس گل')}${top('rating', '⭐ بهترین نمره')}${top('keyPasses', '🔑 پاس کلیدی')}</div>
    <div class="card table-card"><div class="card-head"><b>همه بازیکنان (همه رقابت‌ها)</b></div><div class="scroll-x"><table class="ptable">
      <thead><tr><th class="t-team">بازیکن</th><th>بازی</th><th>دقیقه</th><th>گل</th><th>پاس گل</th><th>نمره</th><th>شوت</th><th>دریبل</th><th>تکل</th><th>زرد</th><th>قرمز</th></tr></thead>
      <tbody>${rows.map(({ p, a }) => `<tr>
        <td class="t-team"><a href="#/player/${p.id}">${img(p.photo, 'avatar-sm')}<span>${esc(p.name)}</span></a></td>
        <td>${fa(a.apps)}</td><td>${fa(a.mins)}</td><td><b>${fa(a.goals)}</b></td><td><b>${fa(a.assists)}</b></td><td>${a.rating ? rating(a.rating) : '-'}</td>
        <td>${fa(a.shots)}</td><td>${fa(a.dribbles)}</td><td>${fa(a.tackles)}</td><td>${fa(a.yellow)}</td><td>${fa(a.red)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function squadView(sq) {
  if (!sq?.players?.length) return '';
  const groups = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];
  return groups.map(g => {
    const ps = sq.players.filter(p => p.position === g);
    if (!ps.length) return '';
    return `<div class="card"><div class="card-head"><b>${POS_FA[g]}</b><small>${fa(ps.length)} نفر</small></div>
      <div class="squad-grid">${ps.map(p => `<a class="squad-card" href="#/player/${p.id}">
        <span class="sq-num">${num(p.number, '')}</span>${img(p.photo, 'avatar-lg')}<b>${esc(p.name)}</b><small>${p.age ? fa(p.age) + ' سال' : ''}</small></a>`).join('')}</div></div>`;
  }).join('');
}

/* ---------- Player ---------- */
Views.player = async (el, { id }) => {
  el.innerHTML = loader();
  let d;
  try { d = await API.player(id); } catch (e) { el.innerHTML = errorBox(e); return; }
  if (!d) { el.innerHTML = empty(`آماری برای این بازیکن در فصل ${fa(API.season())} ثبت نشده`); return; }
  const p = d.player, st = d.statistics.filter(s => s.games.appearences || s.games.minutes);
  const a = aggregate(st);
  const club = (d.statistics.find(s => s.league.type !== 'Cup' && s.games.appearences) || d.statistics[0])?.team;
  if (club?.id === CONFIG.MADRID_ID) document.body.classList.add('madrid');
  const pos = st[0]?.games.position || d.statistics[0]?.games.position;
  const isGk = pos === 'Goalkeeper';

  el.innerHTML = `<div class="hero player-hero">
      <div class="ph-photo">${img(p.photo, '')}${a.rating ? rating(a.rating) : ''}</div>
      <div class="ph-info">
        <h1>${esc(p.name)}</h1>
        ${club ? `<a href="#/team/${club.id}" class="ph-club">${img(club.logo, 'logo-sm')} ${esc(club.name)}</a>` : ''}
        <div class="ph-meta">
          <span><small>پست</small><b>${POS_FA[pos] || '-'}</b></span>
          <span><small>سن</small><b>${num(p.age)}</b></span>
          <span><small>ملیت</small><b>${esc(p.nationality || '-')}</b></span>
          <span><small>قد</small><b>${p.height ? fa(p.height.replace('cm', '')) + ' س.م' : '-'}</b></span>
          <span><small>وزن</small><b>${p.weight ? fa(p.weight.replace('kg', '')) + ' ک.گ' : '-'}</b></span>
          ${p.injured ? '<span class="injured">🚑 مصدوم</span>' : ''}
        </div>
      </div>
    </div>
    <h3 class="section-title">فصل ${fa(API.season())}-${fa(String(API.season() + 1).slice(2))} · همه رقابت‌ها</h3>
    <div class="tiles">
      ${statTile(fa(a.apps), 'بازی')}
      ${statTile(fa(a.mins), 'دقیقه')}
      ${isGk ? statTile(fa(a.saves), 'سیو') + statTile(fa(a.conceded), 'گل خورده') : statTile(fa(a.goals), 'گل') + statTile(fa(a.assists), 'پاس گل')}
      ${statTile(a.rating ? fa(a.rating.toFixed(2)) : '-', 'میانگین نمره')}
      ${statTile(a.mins && (a.goals + a.assists) ? fa(Math.round(a.mins / (a.goals + a.assists))) : '-', 'دقیقه برای هر مشارکت گل')}
    </div>
    <div class="two-col">
      <div class="card"><div class="card-head"><b>حمله</b></div>
        ${kvBar('شوت در چارچوب', a.shotsOn, a.shots)}
        ${kvBar('دریبل موفق', a.dribbles, a.dribblesAtt)}
        <div class="kv"><span>پاس کلیدی</span><b>${fa(a.keyPasses)}</b></div>
        <div class="kv"><span>پنالتی گل‌شده</span><b>${fa(a.penScored)}</b></div>
      </div>
      <div class="card"><div class="card-head"><b>دفاع و انضباط</b></div>
        ${kvBar('دوئل برده', a.duelsWon, a.duels)}
        <div class="kv"><span>تکل</span><b>${fa(a.tackles)}</b></div>
        <div class="kv"><span>توپ‌ربایی</span><b>${fa(a.inter)}</b></div>
        <div class="kv"><span>کارت زرد / قرمز</span><b>🟨 ${fa(a.yellow)} · 🟥 ${fa(a.red)}</b></div>
      </div>
    </div>
    <div class="card table-card"><div class="card-head"><b>تفکیک رقابت‌ها</b></div><div class="scroll-x"><table class="ptable">
      <thead><tr><th class="t-team">رقابت</th><th>بازی</th><th>دقیقه</th><th>گل</th><th>پاس گل</th><th>نمره</th><th>شوت</th><th>پاس</th><th>دقت پاس</th></tr></thead>
      <tbody>${st.map(s => `<tr><td class="t-team"><a href="#/league/${s.league.id}">${img(s.league.logo, 'logo-xs')}<span>${esc(s.league.name)}</span></a></td>
        <td>${num(s.games.appearences, '۰')}</td><td>${num(s.games.minutes, '۰')}</td><td><b>${num(s.goals.total, '۰')}</b></td><td><b>${num(s.goals.assists, '۰')}</b></td>
        <td>${rating(s.games.rating) || '-'}</td><td>${num(s.shots.total, '۰')}</td><td>${num(s.passes.total, '۰')}</td><td>${s.passes.accuracy ? fa(s.passes.accuracy) + '٪' : '-'}</td></tr>`).join('') || `<tr><td colspan="9">${empty('—')}</td></tr>`}</tbody>
    </table></div></div>
    <div id="trophies"></div>`;

  API.trophies(id).then(tr => {
    const won = tr.filter(t => t.place === 'Winner');
    if (!won.length) return;
    const byName = {};
    won.forEach(t => { (byName[t.league] = byName[t.league] || []).push(t.season); });
    el.querySelector('#trophies').innerHTML = `<div class="card"><div class="card-head"><b>🏆 افتخارات</b><small>${fa(won.length)} عنوان</small></div>
      <div class="trophies">${Object.entries(byName).sort((x, y) => y[1].length - x[1].length).map(([k, v]) => `<div class="trophy"><b>${fa(v.length)}×</b><span>${esc(k)}</span></div>`).join('')}</div></div>`;
  }).catch(() => {});
};

function kvBar(label, v, total) {
  const p = total ? Math.round(v / total * 100) : 0;
  return `<div class="kv-bar"><div class="kv"><span>${label}</span><b>${fa(v)}/${fa(total)} <small>(${fa(p)}٪)</small></b></div><div class="bar"><i style="width:${p}%"></i></div></div>`;
}

/* ---------- Search ---------- */
Views.search = async (el, _p, q) => {
  el.innerHTML = `<div class="search-box"><input id="q" type="search" placeholder="نام تیم یا بازیکن (انگلیسی، حداقل ۳ حرف)…" value="${esc(q.q || '')}" dir="auto" autofocus></div><div id="results"></div>`;
  const input = el.querySelector('#q'), out = el.querySelector('#results');
  let timer;
  const run = async () => {
    const s = input.value.trim();
    if (s.length < 3) { out.innerHTML = empty('مثلاً: Real Madrid ، Vinicius ، Bellingham'); return; }
    history.replaceState(null, '', '#/search?q=' + encodeURIComponent(s));
    out.innerHTML = loader();
    try {
      const [teams, players] = await Promise.all([API.searchTeams(s).catch(() => []), API.searchPlayers(s).catch(() => [])]);
      out.innerHTML = `<div class="two-col">
        <div class="card"><div class="card-head"><b>تیم‌ها</b><small>${fa(teams.length)}</small></div>
          ${teams.slice(0, 20).map(t => `<a class="board-row" href="#/team/${t.team.id}">${img(t.team.logo, 'logo-md')}<span class="br-name"><b>${esc(t.team.name)}</b><small>${esc(t.team.country || '')}</small></span></a>`).join('') || empty('—')}</div>
        <div class="card"><div class="card-head"><b>بازیکنان</b><small>${fa(players.length)}</small></div>
          ${players.slice(0, 20).map(({ player: p }) => `<a class="board-row" href="#/player/${p.id}">${img(p.photo, 'avatar')}<span class="br-name"><b>${esc(p.name)}</b><small>${esc(p.nationality || '')} · ${POS_FA[p.position] || ''}</small></span></a>`).join('') || empty('—')}</div>
      </div>`;
    } catch (e) { out.innerHTML = errorBox(e); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 600); });
  run();
};
