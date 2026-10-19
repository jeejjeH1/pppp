// Page renderers. Each view gets (el, params, query) and fills `el`.
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
    // SofaScore days are UTC; keep only matches on the selected local day.
    const list = liveOnly ? await API.live() : (await API.scheduled(sel)).filter(e => fmt.iso(new Date(e.startTimestamp * 1000)) === sel);
    if (!list.length) { box.innerHTML = empty(liveOnly ? 'هم‌اکنون بازی زنده‌ای در جریان نیست' : 'برای این روز بازی‌ای ثبت نشده'); return; }
    const groups = new Map();
    list.forEach(e => {
      const k = e.tournament.id;
      if (!groups.has(k)) groups.set(k, { t: e.tournament, items: [] });
      groups.get(k).items.push(e);
    });
    const sorted = [...groups.values()].sort((a, b) =>
      (b.items.some(hasMadrid) - a.items.some(hasMadrid)) || popularRank(a.t.uniqueTournament?.id) - popularRank(b.t.uniqueTournament?.id)
      || (b.t.priority || 0) - (a.t.priority || 0) || String(a.t.category?.name).localeCompare(b.t.category?.name));
    const LIMIT = 20;
    const render = (all) => sorted.slice(0, all ? undefined : LIMIT).map(g => leagueGroup(g.t, g.items)).join('')
      + (!all && sorted.length > LIMIT ? `<button class="btn ghost wide" id="moreLeagues">نمایش همه (${fa(sorted.length)} رقابت)</button>` : '');
    box.innerHTML = `<div class="summary-line">${fa(list.length)} بازی · ${fa(list.filter(isLive).length)} زنده</div>` + render(false);
    box.addEventListener('click', (ev) => { if (ev.target.id === 'moreLeagues') box.innerHTML = render(true); });
    if (liveOnly || list.some(isLive)) App.autoRefresh(60);
  } catch (e) { box.innerHTML = errorBox(e); }
};

Views.madridTeaser = async (host) => {
  try {
    const next = (await API.teamNext(CONFIG.MADRID_ID))[0];
    if (!next) return;
    const live = isLive(next);
    host.innerHTML = `<a class="madrid-teaser" href="#/match/${next.id}">
      <span class="mt-tag">${live ? '● زنده' : 'بازی بعدی رئال مادرید'}</span>
      <span class="mt-teams">${img(teamLogo(next.homeTeam.id), 'logo-md')}<b>${live ? scoreOf(next) : 'VS'}</b>${img(teamLogo(next.awayTeam.id), 'logo-md')}</span>
      <span class="mt-info"><b>${esc(next.homeTeam.name)} — ${esc(next.awayTeam.name)}</b><small>${esc(tourName(next))} · ${fmt.date(next.startTimestamp)} · ${fmt.time(next.startTimestamp)}</small></span>
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
  el.innerHTML = loader();
  let season, info;
  try { [season, info] = await Promise.all([API.currentSeason(id), API.tournament(id).catch(() => null)]); }
  catch (e) { el.innerHTML = errorBox(e); return; }
  if (!season) { el.innerHTML = empty('فصلی برای این رقابت پیدا نشد'); return; }
  const sid = season.id;

  el.innerHTML = `<div class="hero league-hero">
      ${img(leagueLogo(id), 'logo-xl')}
      <div><h1>${esc(meta?.name || info?.name || '')}</h1><p>${esc(info?.category?.name || '')} · فصل ${fa(season.year)}</p></div>
    </div>
    ${tabs('league', [['table', 'جدول'], ['fixtures', 'بازی‌ها'], ['scorers', 'گلزنان'], ['assists', 'پاس گل'], ['rating', 'بهترین نمره']], q.tab || 'table')}
    <div id="leagueBody"></div>`;

  bindTabs(el, 'league', '#leagueBody', {
    table: async () => {
      const st = await API.standings(id, sid);
      if (!st.length) return empty('جدولی برای این رقابت موجود نیست — تب «بازی‌ها» را ببینید');
      return st.map(g => standingsTable(g.rows, false, 0, st.length > 1 ? g.name : '')).join('');
    },
    fixtures: async () => {
      const r = await API.rounds(id, sid);
      if (!r?.rounds?.length) {
        const [last, next] = await Promise.all([API.tournamentLast(id, sid), API.tournamentNext(id, sid)]);
        return `<div class="card"><div class="card-head"><b>بازی‌های آینده</b></div>${next.map(matchRow).join('') || empty('—')}</div>
          <div class="card"><div class="card-head"><b>نتایج اخیر</b></div>${last.slice().reverse().map(matchRow).join('') || empty('—')}</div>`;
      }
      const key = (x) => `${x.round}|${x.slug || ''}|${x.prefix || ''}`;
      const cur = r.currentRound ? key(r.currentRound) : key(r.rounds[r.rounds.length - 1]);
      const label = (x) => x.name ? roundFa(x.name) : `هفته ${fa(x.round)}`;
      const load = async (k) => {
        const [round, slug, prefix] = k.split('|');
        let path = round;
        if (slug) path += `/slug/${slug}`;
        if (prefix) path += `/prefix/${prefix}`;
        const evs = await API.roundEvents(id, sid, path);
        return evs.map(matchRow).join('') || empty('—');
      };
      setTimeout(() => {
        const s = el.querySelector('#roundSel');
        s?.addEventListener('change', async () => {
          const list = el.querySelector('#roundList');
          list.innerHTML = loader();
          try { list.innerHTML = await load(s.value); } catch (e) { list.innerHTML = errorBox(e); }
        });
      });
      return `<div class="card"><div class="card-head"><b>مرحله</b>
          <select id="roundSel">${r.rounds.map(x => `<option ${key(x) === cur ? 'selected' : ''} value="${esc(key(x))}">${esc(label(x))}</option>`).join('')}</select></div>
        <div id="roundList">${await load(cur)}</div></div>`;
    },
    scorers: async () => playersBoard((await API.topPlayers(id, sid))?.goals, 'goals', 'گل'),
    assists: async () => playersBoard((await API.topPlayers(id, sid))?.assists, 'assists', 'پاس گل'),
    rating: async () => playersBoard((await API.topPlayers(id, sid))?.rating, 'rating', 'نمره'),
  }, q.tab || 'table');
};

const roundFa = (r) => String(r).replace('Round of 16', 'یک‌هشتم').replace('Round of 32', 'یک‌شانزدهم').replace('Quarterfinals', 'یک‌چهارم').replace('Quarter-finals', 'یک‌چهارم')
  .replace('Semifinals', 'نیمه‌نهایی').replace('Semi-finals', 'نیمه‌نهایی').replace(/^Final$/, 'فینال').replace('Playoff round', 'پلی‌آف').replace('Qualification', 'مقدماتی').replace(/\d+/g, fa);

function zoneClass(text) {
  text = String(text || '').toLowerCase();
  if (!text) return '';
  if (text.includes('relegation')) return 'z-rel';
  if (text.includes('champions league') || text.includes('promotion') || text.includes('playoffs') && !text.includes('relegation')) return 'z-ucl';
  if (text.includes('europa league')) return 'z-uel';
  if (text.includes('conference')) return 'z-uecl';
  return 'z-other';
}

function standingsTable(rows, mini = false, highlight = 0, title = '') {
  return `<div class="card table-card">
    ${title ? `<div class="card-head"><b>${esc(title)}</b></div>` : ''}
    <table class="standings">
      <thead><tr><th>#</th><th class="t-team">تیم</th><th>بازی</th>${mini ? '' : '<th>برد</th><th>مساوی</th><th>باخت</th><th class="hide-sm">گل</th>'}<th>تفاضل</th><th>امتیاز</th></tr></thead>
      <tbody>${rows.map(r => {
        const gd = r.scoresFor - r.scoresAgainst;
        return `<tr class="${r.team.id === highlight || r.team.id === CONFIG.MADRID_ID ? 'hl' : ''}">
        <td><span class="rank ${zoneClass(r.promotion?.text)}" title="${esc(r.promotion?.text || '')}">${fa(r.position)}</span></td>
        <td class="t-team"><a href="#/team/${r.team.id}">${img(teamLogo(r.team.id), 'logo-sm')}<span>${esc(r.team.shortName || r.team.name)}</span></a></td>
        <td>${fa(r.matches)}</td>
        ${mini ? '' : `<td>${fa(r.wins)}</td><td>${fa(r.draws)}</td><td>${fa(r.losses)}</td><td class="hide-sm" dir="ltr">${fa(r.scoresFor)}:${fa(r.scoresAgainst)}</td>`}
        <td dir="ltr">${gd > 0 ? '+' : ''}${fa(gd)}</td>
        <td><b>${fa(r.points)}</b></td>
      </tr>`;
      }).join('')}</tbody>
    </table>
    ${!mini ? zoneLegend(rows) : ''}
  </div>`;
}

function zoneLegend(rows) {
  const seen = new Map();
  rows.forEach(r => { if (r.promotion?.text && !seen.has(r.promotion.text)) seen.set(r.promotion.text, zoneClass(r.promotion.text)); });
  if (!seen.size) return '';
  return `<div class="legend">${[...seen].map(([t, c]) => `<span><i class="rank ${c}"></i>${esc(t)}</span>`).join('')}</div>`;
}

// Leaderboard of {player, team, statistics} entries from SofaScore top-players.
function playersBoard(list, key, label) {
  if (!list?.length) return '';
  return `<div class="card">${list.slice(0, 25).map((x, i) => {
    const v = x.statistics?.[key];
    return `<a class="board-row ${i === 0 ? 'first' : ''}" href="#/player/${x.player.id}">
      <span class="br-rank">${fa(i + 1)}</span>
      ${img(playerPhoto(x.player.id), 'avatar')}
      <span class="br-name"><b>${esc(x.player.name)}</b><small>${x.team ? img(teamLogo(x.team.id), 'logo-xs') + ' ' + esc(x.team.shortName || x.team.name) : ''}${x.statistics?.appearances ? ' · ' + fa(x.statistics.appearances) + ' بازی' : ''}</small></span>
      <span class="br-val"><b>${key === 'rating' ? dec(v) : fa(v ?? 0)}</b><small>${label}</small></span>
    </a>`;
  }).join('')}</div>`;
}

/* ---------- Match ---------- */
Views.match = async (el, { id }, q) => {
  el.innerHTML = loader();
  let e;
  try { e = await API.event(id); } catch (err) { el.innerHTML = errorBox(err); return; }
  if (!e) { el.innerHTML = empty('بازی پیدا نشد'); return; }

  if (hasMadrid(e)) document.body.classList.add('madrid');
  if (hasMadrid(e) && isUpcoming(e)) return MadridViews.preview(el, e);

  const [incidents, lineups, stats] = await Promise.all([
    API.incidents(id).catch(() => []), API.lineups(id).catch(() => null), API.statistics(id).catch(() => []),
  ]);

  const items = [['summary', 'خلاصه']];
  if (lineups?.home?.players?.length) items.push(['lineups', 'ترکیب']);
  if (stats.length) items.push(['stats', 'آمار']);
  if (lineups?.home?.players?.some(p => p.statistics?.rating)) items.push(['players', 'بازیکنان']);
  items.push(['h2h', 'رودررو'], ['predict', 'پیش‌بازی']);
  const active = items.some(i => i[0] === q.tab) ? q.tab : 'summary';

  el.innerHTML = matchHeader(e, incidents) + tabs('match', items, active) + '<div id="matchBody"></div>';
  bindTabs(el, 'match', '#matchBody', {
    summary: async () => matchSummary(e, incidents, lineups, stats),
    lineups: async () => lineupsView(e, lineups),
    stats: async () => statsView(e, stats),
    players: async () => playersView(e, lineups),
    h2h: async () => h2hView(e),
    predict: async () => pregameView(e),
  }, active);
  if (isLive(e)) App.autoRefresh(45);
};

function matchHeader(e, incidents = []) {
  const h = e.homeTeam, a = e.awayTeam;
  const goals = (isHome) => incidents.filter(i => i.incidentType === 'goal' && i.isHome === isHome)
    .sort((x, y) => x.time - y.time)
    .map(i => `<span>${esc(shortName(i.player?.name || ''))} ${fa(i.time)}'${i.incidentClass === 'penalty' ? ' (پ)' : i.incidentClass === 'ownGoal' ? ' (گ.ب)' : ''}</span>`).join('');
  const center = isUpcoming(e)
    ? `<div class="mh-score upcoming"><b>${fmt.time(e.startTimestamp)}</b><small>${fmt.date(e.startTimestamp)}</small></div>`
    : `<div class="mh-score ${isLive(e) ? 'is-live' : ''}"><b>${scoreOf(e)}</b><small>${statusLabel(e)}</small>
        ${e.homeScore?.penalties != null ? `<small>پنالتی ${scoreHtml(e.homeScore.penalties, e.awayScore.penalties)}</small>` : ''}</div>`;
  const venue = e.venue?.stadium?.name || e.venue?.name;
  const uid = tourId(e);
  return `<div class="hero match-hero">
    <a class="mh-league" href="#/league/${uid}">${img(leagueLogo(uid), 'logo-xs')} ${esc(tourName(e))}${e.roundInfo?.round ? ' · ' + (e.roundInfo.name ? esc(roundFa(e.roundInfo.name)) : 'هفته ' + fa(e.roundInfo.round)) : ''}</a>
    <div class="mh-main">
      <a class="mh-team" href="#/team/${h.id}">${img(teamLogo(h.id), 'logo-xl')}<b>${esc(h.name)}</b><div class="mh-goals">${goals(true)}</div></a>
      ${center}
      <a class="mh-team" href="#/team/${a.id}">${img(teamLogo(a.id), 'logo-xl')}<b>${esc(a.name)}</b><div class="mh-goals">${goals(false)}</div></a>
    </div>
    <div class="mh-meta">
      ${venue ? `<span>🏟 ${esc(venue)}${e.venue?.city?.name ? '، ' + esc(e.venue.city.name) : ''}</span>` : ''}
      ${e.referee?.name ? `<span>🧑‍⚖️ ${esc(e.referee.name)}</span>` : ''}
      <span>📅 ${fmt.full(e.startTimestamp)}</span>
    </div>
  </div>`;
}

function incidentIcon(i) {
  if (i.incidentType === 'goal') return '⚽';
  if (i.incidentType === 'card') return i.incidentClass === 'yellow' ? '🟨' : '🟥';
  if (i.incidentType === 'substitution') return '🔁';
  if (i.incidentType === 'varDecision') return '📺';
  if (i.incidentType === 'inGamePenalty') return '❌';
  return '•';
}

function eventsTimeline(incidents) {
  const shown = incidents.filter(i => ['goal', 'card', 'substitution', 'varDecision', 'inGamePenalty', 'period'].includes(i.incidentType))
    .sort((a, b) => (a.time - b.time) || ((a.addedTime || 0) - (b.addedTime || 0)));
  if (!shown.some(i => i.incidentType !== 'period')) return '';
  const rows = shown.map(i => {
    if (i.incidentType === 'period') return `<div class="ev-period"><span>${esc(i.text === 'HT' ? 'پایان نیمه اول' : i.text === 'FT' ? 'پایان بازی' : i.text || '')} ${i.homeScore != null ? scoreHtml(i.homeScore, i.awayScore) : ''}</span></div>`;
    const main = i.incidentType === 'substitution'
      ? `<b class="in">↑ ${esc(i.playerIn?.name || '')}</b><small class="out">↓ ${esc(i.playerOut?.name || '')}</small>`
      : `<b>${esc(i.player?.name || i.playerName || '')}</b>${i.assist1?.name ? `<small>پاس: ${esc(i.assist1.name)}</small>` : ''}${i.incidentClass === 'penalty' ? '<small>پنالتی</small>' : i.incidentClass === 'ownGoal' ? '<small>گل به خودی</small>' : ''}${i.incidentType === 'varDecision' ? `<small dir="ltr">${esc(i.incidentClass || '')}</small>` : ''}`;
    const side = `<span class="ev-ico">${incidentIcon(i)}</span><span class="ev-txt">${main}</span>`;
    return `<div class="ev ${i.isHome ? 'home' : 'away'} ev-${i.incidentType}">
      <div class="ev-side">${i.isHome ? side : ''}</div>
      <div class="ev-min">${fa(i.time)}${i.addedTime ? '+' + fa(i.addedTime) : ''}'</div>
      <div class="ev-side">${!i.isHome ? side : ''}</div>
    </div>`;
  });
  return `<div class="card"><div class="card-head"><b>رویدادهای بازی</b></div><div class="timeline">${rows.join('')}</div></div>`;
}

function allLineupPlayers(e, lineups) {
  if (!lineups?.home) return [];
  return [...lineups.home.players.map(p => ({ ...p, team: e.homeTeam })), ...lineups.away.players.map(p => ({ ...p, team: e.awayTeam }))];
}

function matchSummary(e, incidents, lineups, stats) {
  const best = allLineupPlayers(e, lineups).filter(p => p.statistics?.rating).sort((a, b) => b.statistics.rating - a.statistics.rating)[0];
  const motm = best ? `<a class="card motm" href="#/player/${best.player.id}">
      <span class="motm-tag">⭐ بهترین بازیکن زمین</span>
      ${img(playerPhoto(best.player.id), 'avatar-lg')}
      <span><b>${esc(best.player.name)}</b><small>${img(teamLogo(best.team.id), 'logo-xs')} ${esc(best.team.name)} · ${fa(best.statistics.goals || 0)} گل · ${fa(best.statistics.goalAssist || 0)} پاس گل</small></span>
      ${rating(best.statistics.rating)}
    </a>` : '';
  const overview = stats.find(s => s.period === 'ALL')?.groups?.[0];
  const keyStats = overview ? `<div class="card"><div class="card-head"><b>آمار کلیدی</b></div>${overview.statisticsItems.slice(0, 6).map(statItem).join('')}</div>` : '';
  const timeline = eventsTimeline(incidents);
  if (!timeline && !keyStats) return isUpcoming(e) ? empty('بازی هنوز شروع نشده — تب «پیش‌بازی» و «رودررو» را ببینید') : '';
  return motm + timeline + keyStats;
}

const statItem = (s) => statCompare(STAT_FA[s.name] || esc(s.name), s.home, s.away, s.homeValue, s.awayValue);

function statsView(e, stats) {
  const periods = stats.map(s => s.period);
  const order = ['ALL', '1ST', '2ND'].filter(p => periods.includes(p));
  const label = { ALL: 'کل بازی', '1ST': 'نیمه اول', '2ND': 'نیمه دوم' };
  const render = (period) => (stats.find(s => s.period === period)?.groups || []).map(g => `<div class="card">
    <div class="card-head teams-head">${img(teamLogo(e.homeTeam.id), 'logo-sm')}<b>${GROUP_FA[g.groupName] || esc(g.groupName)}</b>${img(teamLogo(e.awayTeam.id), 'logo-sm')}</div>
    ${g.statisticsItems.map(statItem).join('')}</div>`).join('');
  setTimeout(() => {
    document.getElementById('periodChips')?.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-period]'); if (!b) return;
      document.querySelectorAll('#periodChips .chip').forEach(c => c.classList.toggle('active', c === b));
      document.getElementById('periodBody').innerHTML = render(b.dataset.period);
    });
  });
  return `<div class="chips" id="periodChips">${order.map((p, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-period="${p}">${label[p]}</button>`).join('')}</div>
    <div id="periodBody">${render(order[0])}</div>`;
}

function lineupsView(e, lineups) {
  const side = (lu, team) => `<div class="card subs">
    <div class="card-head">${img(teamLogo(team.id), 'logo-sm')}<b>${esc(team.name)}</b>${lineups.confirmed === false ? '<small>ترکیب احتمالی</small>' : ''}</div>
    <div class="sub-title">نیمکت</div>
    ${lu.players.filter(p => p.substitute).map(p => `<a class="sub-row" href="#/player/${p.player.id}"><i>${fa(p.shirtNumber ?? '')}</i>${img(playerPhoto(p.player.id), 'avatar-sm')}<span>${esc(p.player.name)}</span><small>${POS_FA[p.position || p.player.position] || ''}</small>${rating(p.statistics?.rating)}</a>`).join('') || empty('—')}
    ${missingList(lu.missingPlayers)}
  </div>`;
  return pitch(lineups, e.homeTeam, e.awayTeam) + `<div class="two-col">${side(lineups.home, e.homeTeam)}${side(lineups.away, e.awayTeam)}</div>`;
}

function missingList(list) {
  if (!list?.length) return '';
  return `<div class="sub-title">غایبان</div>${list.map(m => `<a class="sub-row" href="#/player/${m.player.id}">${img(playerPhoto(m.player.id), 'avatar-sm')}<span>${esc(m.player.name)}</span>
    <span class="inj-tag ${m.type === 'missing' ? 'out' : 'doubt'}">${m.type === 'missing' ? 'غایب' : 'مشکوک'}</span></a>`).join('')}`;
}

function playersView(e, lineups) {
  return [[lineups.home, e.homeTeam], [lineups.away, e.awayTeam]].map(([lu, team]) => {
    const rows = lu.players.filter(p => p.statistics?.minutesPlayed).sort((a, b) => (b.statistics.rating || 0) - (a.statistics.rating || 0));
    return `<div class="card table-card"><div class="card-head">${img(teamLogo(team.id), 'logo-sm')}<b>${esc(team.name)}</b></div>
      <div class="scroll-x"><table class="ptable">
        <thead><tr><th class="t-team">بازیکن</th><th>نمره</th><th>دقیقه</th><th>گل</th><th>پاس گل</th><th>شوت</th><th>پاس کلیدی</th><th>پاس دقیق</th><th>دریبل</th><th>تکل</th><th>دوئل</th></tr></thead>
        <tbody>${rows.map(({ player: p, statistics: s }) => `<tr>
          <td class="t-team"><a href="#/player/${p.id}">${img(playerPhoto(p.id), 'avatar-sm')}<span>${esc(p.name)}</span></a></td>
          <td>${rating(s.rating) || '-'}</td><td>${num(s.minutesPlayed)}</td><td>${num(s.goals, '۰')}</td><td>${num(s.goalAssist, '۰')}</td>
          <td>${fa((s.onTargetScoringAttempt || 0) + (s.shotOffTarget || 0) + (s.blockedScoringAttempt || 0))}</td><td>${num(s.keyPass, '۰')}</td>
          <td>${num(s.accuratePass, '۰')}/${num(s.totalPass, '۰')}</td><td>${num(s.wonContest, '۰')}/${num(s.totalContest, '۰')}</td>
          <td>${num(s.totalTackle, '۰')}</td><td>${num(s.duelWon, '۰')}/${fa((s.duelWon || 0) + (s.duelLost || 0))}</td>
        </tr>`).join('')}</tbody></table></div></div>`;
  }).join('');
}

async function h2hView(e) {
  const [duel, list] = await Promise.all([API.h2h(e.id).catch(() => null), e.customId ? API.h2hEvents(e.customId).catch(() => []) : []]);
  const done = list.filter(isDone);
  if (!duel && !done.length) return empty('رویارویی قبلی ثبت نشده');
  const h = e.homeTeam, a = e.awayTeam;
  let hw = duel?.homeWins, aw = duel?.awayWins, d = duel?.draws;
  if (!duel) { hw = done.filter(x => resultFor(x, h.id) === 'W').length; aw = done.filter(x => resultFor(x, a.id) === 'W').length; d = done.length - hw - aw; }
  return `<div class="card h2h-sum">
      <div class="h2h-team">${img(teamLogo(h.id), 'logo-md')}<b>${fa(hw)}</b><small>برد</small></div>
      <div class="h2h-team"><span class="draw-ico">=</span><b>${fa(d)}</b><small>مساوی</small></div>
      <div class="h2h-team">${img(teamLogo(a.id), 'logo-md')}<b>${fa(aw)}</b><small>برد</small></div>
      <div class="h2h-bar"><i class="hb" style="flex:${hw}"></i><i class="db" style="flex:${d}"></i><i class="ab" style="flex:${aw}"></i></div>
      <small class="muted">${fa(hw + aw + d)} دیدار</small>
    </div>
    ${done.length ? `<div class="card">${done.slice(0, 15).map(x => `<div class="h2h-row"><small>${fmt.short(x.startTimestamp)} ${fa(new Date(x.startTimestamp * 1000).getFullYear())} · ${esc(tourName(x))}</small>${matchRow(x)}</div>`).join('')}</div>` : ''}`;
}

// Pre-match form and fan vote; SofaScore offers no model-based probability.
async function pregameView(e) {
  const [pg, vote] = await Promise.all([API.pregame(e.id).catch(() => null), API.votes(e.id).catch(() => null)]);
  if (!pg && !vote) return '';
  const h = e.homeTeam, a = e.awayTeam;
  let html = '';
  if (vote && (vote.vote1 || vote.vote2 || vote.voteX)) {
    const t = vote.vote1 + vote.voteX + vote.vote2 || 1;
    const p = (v) => Math.round(v / t * 100);
    html += `<div class="card predict"><div class="card-head"><b>پیش‌بینی هواداران</b><small>${fa(t.toLocaleString())} رأی در SofaScore</small></div>
      <div class="win-prob">
        <div style="flex:${p(vote.vote1) || 1}" class="wp home"><b>${pct(p(vote.vote1))}</b><small>${esc(h.shortName || h.name)}</small></div>
        <div style="flex:${p(vote.voteX) || 1}" class="wp draw"><b>${pct(p(vote.voteX))}</b><small>مساوی</small></div>
        <div style="flex:${p(vote.vote2) || 1}" class="wp away"><b>${pct(p(vote.vote2))}</b><small>${esc(a.shortName || a.name)}</small></div>
      </div></div>`;
  }
  if (pg) {
    html += `<div class="two-col">${[[pg.homeTeam, h], [pg.awayTeam, a]].map(([f, t]) => `<div class="card form-card">
      <div class="card-head">${img(teamLogo(t.id), 'logo-sm')}<b>${esc(t.name)}</b></div>
      <div class="kv"><span>فرم ۵ بازی اخیر</span>${formChips(f?.form)}</div>
      <div class="kv"><span>رتبه در جدول</span><b>${num(f?.position)}</b></div>
      <div class="kv"><span>میانگین نمره تیم</span><b>${num(f?.avgRating)}</b></div>
      <div class="kv"><span>${esc(pg.label === 'Pts' ? 'امتیاز' : pg.label || 'امتیاز')}</span><b>${num(f?.value)}</b></div>
    </div>`).join('')}</div>`;
  }
  return html;
}

/* ---------- Team ---------- */
Views.team = async (el, { id }, q) => {
  id = Number(id);
  if (id === CONFIG.MADRID_ID && !q.tab) { location.hash = '#/madrid'; return; }
  el.innerHTML = loader();
  let t, last, next;
  try { [t, last, next] = await Promise.all([API.team(id), API.teamLast(id), API.teamNext(id)]); }
  catch (e) { el.innerHTML = errorBox(e); return; }
  if (!t) { el.innerHTML = empty('تیم پیدا نشد'); return; }
  const done = last.filter(isDone);
  const tours = teamTournaments([...last, ...next], t);
  const form = done.slice(-5).map(x => resultFor(x, id));

  el.innerHTML = `<div class="hero team-hero">
      ${img(teamLogo(id), 'logo-xl')}
      <div><h1>${esc(t.name)}</h1><p>${esc(t.country?.name || t.category?.name || '')}${t.manager?.name ? ' · سرمربی: ' + esc(t.manager.name) : ''}</p>${formChips(form)}</div>
    </div>
    ${tabs('team', [['overview', 'نمای کلی'], ['fixtures', 'بازی‌ها'], ['stats', 'آمار تیمی'], ['players', 'ستاره‌ها'], ['squad', 'ترکیب']], q.tab || 'overview')}
    <div id="teamBody"></div>`;

  bindTabs(el, 'team', '#teamBody', {
    overview: async () => {
      const n = next[0];
      const main = tours.find(x => x.league) || tours[0];
      let mini = '';
      if (main) {
        const st = await API.standings(main.id, main.sid).catch(() => []);
        const rows = st.find(g => g.rows.some(r => r.team.id === id))?.rows;
        if (rows) {
          const i = rows.findIndex(r => r.team.id === id);
          mini = `<div class="card"><div class="card-head"><b>${esc(main.name)}</b><a href="#/league/${main.id}">جدول کامل ‹</a></div></div>` + standingsTable(rows.slice(Math.max(0, i - 2), i + 3), true, id);
        }
      }
      return (n ? nextMatchCard(n) : '')
        + `<div class="card"><div class="card-head"><b>نتایج اخیر</b></div>${done.slice(-5).reverse().map(matchRow).join('') || empty('—')}</div>`
        + mini
        + (t.venue?.stadium?.name || t.venue?.name ? `<div class="card venue"><div><b>🏟 ${esc(t.venue.stadium?.name || t.venue.name)}</b><small>${esc(t.venue.city?.name || '')}${t.venue.stadium?.capacity || t.venue.capacity ? ' · ظرفیت ' + fa((t.venue.stadium?.capacity || t.venue.capacity).toLocaleString()) : ''}</small></div></div>` : '');
    },
    fixtures: async () => `<div class="card"><div class="card-head"><b>بازی‌های آینده</b></div>${next.map(matchRow).join('') || empty('—')}</div>
      <div class="card"><div class="card-head"><b>نتایج</b></div>${done.slice().reverse().map(matchRow).join('') || empty('—')}</div>`,
    stats: async () => teamStatsView(id, tours, done),
    players: async () => teamTopView(id, tours),
    squad: async () => squadView(await API.teamPlayers(id)),
  }, q.tab || 'overview');
};

// Competitions a team plays this season, most matches first; league = has standings-style rounds.
function teamTournaments(evs, team) {
  const m = new Map();
  evs.forEach(e => {
    const id = tourId(e);
    if (!id || !e.season) return;
    const x = m.get(id) || { id, sid: e.season.id, name: tourName(e), n: 0, league: !!e.roundInfo?.round && !e.roundInfo?.name };
    x.n++;
    if (e.season.id > x.sid) x.sid = e.season.id;
    m.set(id, x);
  });
  const primary = team?.primaryUniqueTournament?.id || team?.tournament?.uniqueTournament?.id;
  return [...m.values()].sort((a, b) => (b.id === primary) - (a.id === primary) || b.league - a.league || b.n - a.n);
}

function nextMatchCard(e) {
  return `<a class="card next-card ${hasMadrid(e) ? 'is-madrid' : ''}" href="#/match/${e.id}">
    <div class="card-head"><b>${isLive(e) ? '● زنده' : 'بازی بعدی'}</b><small>${img(leagueLogo(tourId(e)), 'logo-xs')} ${esc(tourName(e))}</small></div>
    <div class="nc-main">
      <span class="nc-team">${img(teamLogo(e.homeTeam.id), 'logo-lg')}<b>${esc(e.homeTeam.name)}</b></span>
      <span class="nc-mid">${isLive(e) ? `<b class="big">${scoreOf(e)}</b>` : `<b>${fmt.time(e.startTimestamp)}</b><small>${fmt.date(e.startTimestamp)}</small>`}</span>
      <span class="nc-team">${img(teamLogo(e.awayTeam.id), 'logo-lg')}<b>${esc(e.awayTeam.name)}</b></span>
    </div>
    ${isUpcoming(e) ? countdown(e.startTimestamp) : ''}
  </a>`;
}

function tourChips(tours, selected, attr) {
  return tours.map(x => `<button class="chip ${x.id === selected ? 'active' : ''}" ${attr}="${x.id}">${img(leagueLogo(x.id), 'logo-xs')} ${esc(x.name)}</button>`).join('');
}

// Re-render a block when one of its competition chips is clicked.
function bindChips(hostId, attr, render) {
  setTimeout(() => {
    const host = document.getElementById(hostId);
    host?.addEventListener('click', async (ev) => {
      const b = ev.target.closest(`[${attr}]`); if (!b) return;
      const box = host.parentElement;
      box.innerHTML = loader();
      try { box.innerHTML = await render(Number(b.getAttribute(attr))); } catch (err) { box.innerHTML = errorBox(err); }
    });
  });
}

const TEAM_STAT_FA = {
  goalsScored: 'گل زده', goalsConceded: 'گل خورده', cleanSheets: 'کلین‌شیت', averageBallPossession: 'میانگین مالکیت', avgRating: 'میانگین نمره',
  shots: 'شوت', shotsOnTarget: 'شوت در چارچوب', bigChances: 'موقعیت خطرناک', bigChancesCreated: 'موقعیت ساخته‌شده', bigChancesMissed: 'موقعیت از دست‌رفته',
  accuratePassesPercentage: 'دقت پاس', totalPasses: 'پاس', corners: 'کرنر', fouls: 'خطا', tackles: 'تکل', interceptions: 'توپ‌ربایی', saves: 'سیو',
  yellowCards: 'کارت زرد', redCards: 'کارت قرمز', penaltyGoals: 'گل پنالتی', freeKickGoals: 'گل ضربه آزاد', headedGoals: 'گل با سر',
  goalsFromInsideTheBox: 'گل از داخل محوطه', goalsFromOutsideTheBox: 'گل از بیرون محوطه', assists: 'پاس گل', offsides: 'آفساید',
  errorsLeadingToGoal: 'خطای منجر به گل', dribbleAttempts: 'تلاش دریبل', successfulDribbles: 'دریبل موفق', duelsWon: 'دوئل برده', aerialDuelsWon: 'دوئل هوایی برده',
};
const statVal = (k, v) => /Percentage|Possession/.test(k) ? pct(v) : k === 'avgRating' ? dec(v) : fa(Math.round(v * 100) / 100);

async function teamStatsView(team, tours, done, selected) {
  if (!tours.length) return '';
  const cur = tours.find(x => x.id === selected) || tours[0];
  const s = await API.teamStats(team, cur.id, cur.sid);
  const id = 'tsc' + Math.random().toString(36).slice(2);
  bindChips(id, 'data-tour', (tid) => teamStatsView(team, tours, done, tid));
  const inTour = done.filter(e => tourId(e) === cur.id);
  const W = inTour.filter(e => resultFor(e, team) === 'W').length, D = inTour.filter(e => resultFor(e, team) === 'D').length, L = inTour.filter(e => resultFor(e, team) === 'L').length;
  const head = `<div class="chips" id="${id}">${tourChips(tours, cur.id, 'data-tour')}</div>`;
  if (!s) return head + empty('آماری برای این رقابت ثبت نشده');
  const main = ['matches', 'goalsScored', 'goalsConceded', 'cleanSheets', 'averageBallPossession', 'avgRating', 'shotsOnTarget', 'bigChancesCreated'];
  const tiles = main.filter(k => s[k] != null).map(k => statTile(statVal(k, s[k]), k === 'matches' ? 'بازی' : TEAM_STAT_FA[k],
    k === 'goalsScored' && s.matches ? 'میانگین ' + dec(s.goalsScored / s.matches, 1) : k === 'goalsConceded' && s.matches ? 'میانگین ' + dec(s.goalsConceded / s.matches, 1) : '')).join('');
  const rest = Object.keys(TEAM_STAT_FA).filter(k => !main.includes(k) && s[k] != null);
  return head + `<div class="tiles">${tiles}</div>
    ${inTour.length ? `<div class="card"><div class="card-head"><b>نتایج در این رقابت (بازی‌های اخیر)</b></div>
      <div class="kv"><span>برد / مساوی / باخت</span><b>${fa(W)} / ${fa(D)} / ${fa(L)}</b></div>
      <div class="season-form">${formChips(inTour.map(e => resultFor(e, team)), 30)}</div></div>` : ''}
    <div class="card"><div class="card-head"><b>آمار تکمیلی فصل</b></div>
      <div class="kv-grid">${rest.map(k => `<div class="kv"><span>${TEAM_STAT_FA[k]}</span><b>${statVal(k, s[k])}</b></div>`).join('')}</div></div>`;
}

const TOP_KEYS = [['goals', '⚽ گلزنان'], ['assists', '🎯 پاس گل'], ['rating', '⭐ بهترین نمره'], ['expectedGoals', '📈 گل مورد انتظار'],
  ['bigChancesCreated', '🔑 موقعیت‌سازی'], ['successfulDribbles', '🌀 دریبل موفق'], ['tackles', '🛡 تکل'], ['saves', '🧤 سیو']];

async function teamTopView(team, tours, selected, accent = '') {
  if (!tours.length) return '';
  const cur = tours.find(x => x.id === selected) || tours[0];
  const top = await API.teamTop(team, cur.id, cur.sid);
  const id = 'ttc' + Math.random().toString(36).slice(2);
  bindChips(id, 'data-top', (tid) => teamTopView(team, tours, tid, accent));
  const head = `<div class="chips" id="${id}">${tourChips(tours, cur.id, 'data-top')}</div>`;
  if (!top) return head + empty('آماری برای این رقابت ثبت نشده');
  return head + `<div class="leaders">${TOP_KEYS.filter(([k]) => top[k]?.length).map(([k, label]) => `<div class="card leader ${accent}">
    <div class="card-head"><b>${label}</b></div>
    ${top[k].slice(0, 5).map((x, i) => `<a class="board-row ${i === 0 ? 'first' : ''}" href="#/player/${x.player.id}">
      ${img(playerPhoto(x.player.id), 'avatar')}<span class="br-name"><b>${esc(x.player.name)}</b><small>${fa(x.statistics?.appearances || 0)} بازی</small></span>
      <span class="br-val"><b>${k === 'rating' || k === 'expectedGoals' ? dec(x.statistics?.[k]) : fa(x.statistics?.[k] ?? 0)}</b></span></a>`).join('')}
  </div>`).join('')}</div>`;
}

function squadView(list) {
  if (!list?.length) return '';
  const groups = ['G', 'D', 'M', 'F'];
  const age = (ts) => ts ? Math.floor((Date.now() / 1000 - ts) / (365.25 * 86400)) : null;
  return groups.map(g => {
    const ps = list.map(x => x.player).filter(p => p.position === g);
    if (!ps.length) return '';
    return `<div class="card"><div class="card-head"><b>${POS_FA[g]}</b><small>${fa(ps.length)} نفر</small></div>
      <div class="squad-grid">${ps.map(p => `<a class="squad-card" href="#/player/${p.id}">
        <span class="sq-num">${num(p.shirtNumber ?? p.jerseyNumber, '')}</span>${img(playerPhoto(p.id), 'avatar-lg')}<b>${esc(p.shortName || p.name)}</b>
        <small>${age(p.dateOfBirthTimestamp) ? fa(age(p.dateOfBirthTimestamp)) + ' سال' : ''}${p.country?.name ? ' · ' + esc(p.country.name) : ''}</small></a>`).join('')}</div></div>`;
  }).join('');
}

/* ---------- Player ---------- */
const PLAYER_STAT_FA = {
  appearances: 'بازی', minutesPlayed: 'دقیقه', goals: 'گل', assists: 'پاس گل', rating: 'میانگین نمره', expectedGoals: 'گل مورد انتظار (xG)',
  expectedAssists: 'پاس گل مورد انتظار', totalShots: 'شوت', shotsOnTarget: 'شوت در چارچوب', bigChancesCreated: 'موقعیت ساخته‌شده', bigChancesMissed: 'موقعیت از دست‌رفته',
  keyPasses: 'پاس کلیدی', accuratePassesPercentage: 'دقت پاس', accuratePasses: 'پاس دقیق', successfulDribbles: 'دریبل موفق', successfulDribblesPercentage: 'درصد دریبل موفق',
  tackles: 'تکل', interceptions: 'توپ‌ربایی', clearances: 'دفع توپ', totalDuelsWon: 'دوئل برده', totalDuelsWonPercentage: 'درصد دوئل برده',
  aerialDuelsWon: 'دوئل هوایی برده', yellowCards: 'کارت زرد', redCards: 'کارت قرمز', penaltyGoals: 'گل پنالتی', saves: 'سیو', goalsConceded: 'گل خورده',
  cleanSheet: 'کلین‌شیت', savedShotsFromInsideTheBox: 'سیو از داخل محوطه', goalsPrevented: 'گل جلوگیری‌شده', touches: 'لمس توپ', possessionLost: 'از دست دادن توپ',
  dispossessed: 'توپ از دست‌رفته', wasFouled: 'خطا روی او', fouls: 'خطا', offsides: 'آفساید', ballRecovery: 'بازپس‌گیری',
};
const pStatVal = (k, v) => /Percentage/.test(k) ? pct(v) : ['rating', 'expectedGoals', 'expectedAssists', 'goalsPrevented'].includes(k) ? dec(v) : fa(Math.round(v * 100) / 100);

Views.player = async (el, { id }, q) => {
  el.innerHTML = loader();
  let p, seasons;
  try { [p, seasons] = await Promise.all([API.player(id), API.playerSeasons(id).catch(() => [])]); }
  catch (e) { el.innerHTML = errorBox(e); return; }
  if (!p) { el.innerHTML = empty('بازیکن پیدا نشد'); return; }
  if (p.team?.id === CONFIG.MADRID_ID) document.body.classList.add('madrid');
  const age = p.dateOfBirthTimestamp ? Math.floor((Date.now() / 1000 - p.dateOfBirthTimestamp) / (365.25 * 86400)) : null;
  // Current competitions = the latest season of each tournament, newest first.
  const comps = seasons.map(s => ({ id: s.uniqueTournament.id, name: s.uniqueTournament.name, sid: s.seasons[0]?.id, year: s.seasons[0]?.year })).filter(c => c.sid);
  const latestYear = comps[0]?.year;
  const current = comps.filter(c => c.year === latestYear);
  const value = p.proposedMarketValueRaw?.value || p.proposedMarketValue;

  el.innerHTML = `<div class="hero player-hero">
      <div class="ph-photo">${img(playerPhoto(p.id), '')}</div>
      <div class="ph-info">
        <h1>${esc(p.name)}</h1>
        ${p.team ? `<a href="#/team/${p.team.id}" class="ph-club">${img(teamLogo(p.team.id), 'logo-sm')} ${esc(p.team.name)}</a>` : ''}
        <div class="ph-meta">
          <span><small>پست</small><b>${POS_FA[p.position] || '-'}</b></span>
          <span><small>شماره</small><b>${num(p.shirtNumber ?? p.jerseyNumber)}</b></span>
          <span><small>سن</small><b>${num(age)}</b></span>
          <span><small>ملیت</small><b>${esc(p.country?.name || '-')}</b></span>
          <span><small>قد</small><b>${p.height ? fa(p.height) + ' س.م' : '-'}</b></span>
          <span><small>پای تخصصی</small><b>${{ Right: 'راست', Left: 'چپ', Both: 'هر دو' }[p.preferredFoot] || '-'}</b></span>
          ${value ? `<span><small>ارزش تخمینی</small><b>€${fa((value / 1e6).toFixed(1))}M</b></span>` : ''}
        </div>
      </div>
    </div>
    <div id="pStats"></div>
    <div class="card"><div class="card-head"><b>بازی‌های اخیر</b></div><div id="pLast">${loader()}</div></div>`;

  const renderStats = async (tid) => {
    const c = current.find(x => x.id === tid) || current[0];
    if (!c) return empty('آماری برای این بازیکن ثبت نشده');
    const s = await API.playerStats(p.id, c.id, c.sid);
    const chips = `<div class="chips" id="pChips">${current.map(x => `<button class="chip ${x.id === c.id ? 'active' : ''}" data-ptour="${x.id}">${img(leagueLogo(x.id), 'logo-xs')} ${esc(x.name)}</button>`).join('')}</div>`;
    if (!s) return chips + empty('آماری ثبت نشده');
    const gk = p.position === 'G';
    const main = gk ? ['appearances', 'minutesPlayed', 'rating', 'saves', 'goalsConceded', 'cleanSheet', 'goalsPrevented', 'accuratePassesPercentage']
      : ['appearances', 'minutesPlayed', 'goals', 'assists', 'rating', 'expectedGoals', 'keyPasses', 'successfulDribbles'];
    const rest = Object.keys(PLAYER_STAT_FA).filter(k => !main.includes(k) && s[k] != null);
    return `<h3 class="section-title">فصل ${fa(c.year)}</h3>${chips}
      <div class="tiles">${main.filter(k => s[k] != null).map(k => statTile(pStatVal(k, s[k]), PLAYER_STAT_FA[k])).join('')}</div>
      <div class="card"><div class="card-head"><b>آمار کامل</b></div>
        <div class="kv-grid">${rest.map(k => `<div class="kv"><span>${PLAYER_STAT_FA[k]}</span><b>${pStatVal(k, s[k])}</b></div>`).join('')}</div></div>`;
  };
  const box = el.querySelector('#pStats');
  const show = async (tid) => { box.innerHTML = loader(); try { box.innerHTML = await renderStats(tid); } catch (e) { box.innerHTML = errorBox(e); } };
  box.addEventListener('click', (ev) => { const b = ev.target.closest('[data-ptour]'); if (b) show(Number(b.dataset.ptour)); });
  show(current[0]?.id);

  API.playerLast(p.id).then(evs => {
    el.querySelector('#pLast').innerHTML = evs.slice(-8).reverse().map(matchRow).join('') || empty('—');
  }).catch(e => { el.querySelector('#pLast').innerHTML = errorBox(e); });
};

/* ---------- Search ---------- */
Views.search = async (el, _p, q) => {
  el.innerHTML = `<div class="search-box"><input id="q" type="search" placeholder="نام تیم، بازیکن یا لیگ به انگلیسی…" value="${esc(q.q || '')}" dir="auto" autofocus></div><div id="results"></div>`;
  const input = el.querySelector('#q'), out = el.querySelector('#results');
  let timer;
  const run = async () => {
    const s = input.value.trim();
    if (s.length < 2) { out.innerHTML = empty('مثلاً: Real Madrid ، Vinicius ، Bellingham'); return; }
    if (!/^[\w .\-']+$/.test(s)) { out.innerHTML = empty('لطفاً نام را با حروف انگلیسی بنویسید'); return; }
    history.replaceState(null, '', '#/search?q=' + encodeURIComponent(s));
    out.innerHTML = loader();
    try {
      const res = await API.search(s);
      const football = (r) => !r.entity.sport || r.entity.sport.slug === 'football';
      const teams = res.filter(r => r.type === 'team' && football(r)).map(r => r.entity);
      const players = res.filter(r => r.type === 'player').map(r => r.entity);
      const tours = res.filter(r => r.type === 'uniqueTournament' && football(r)).map(r => r.entity);
      out.innerHTML = (tours.length ? `<div class="card"><div class="card-head"><b>رقابت‌ها</b></div>${tours.map(t => `<a class="board-row" href="#/league/${t.id}">${img(leagueLogo(t.id), 'logo-md')}<span class="br-name"><b>${esc(t.name)}</b><small>${esc(t.category?.name || '')}</small></span></a>`).join('')}</div>` : '')
        + `<div class="two-col">
        <div class="card"><div class="card-head"><b>تیم‌ها</b><small>${fa(teams.length)}</small></div>
          ${teams.map(t => `<a class="board-row" href="#/team/${t.id}">${img(teamLogo(t.id), 'logo-md')}<span class="br-name"><b>${esc(t.name)}</b><small>${esc(t.country?.name || '')}</small></span></a>`).join('') || empty('—')}</div>
        <div class="card"><div class="card-head"><b>بازیکنان</b><small>${fa(players.length)}</small></div>
          ${players.map(p => `<a class="board-row" href="#/player/${p.id}">${img(playerPhoto(p.id), 'avatar')}<span class="br-name"><b>${esc(p.name)}</b><small>${esc(p.team?.name || '')} · ${POS_FA[p.position] || ''}</small></span></a>`).join('') || empty('—')}</div>
      </div>`;
    } catch (e) { out.innerHTML = errorBox(e); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 500); });
  run();
};
