// Real Madrid experience: a dedicated hub and a "matchday programme" preview for upcoming Madrid games.
const MadridViews = {};
const RM = CONFIG.MADRID_ID;

// Render an async section into its placeholder without blocking the rest of the page.
function fillSection(root, sel, fn) {
  const host = root.querySelector(sel);
  if (!host) return;
  host.innerHTML = loader();
  Promise.resolve().then(fn).then(html => { host.innerHTML = html || empty('داده‌ای موجود نیست'); startCountdowns(); }).catch(e => { host.innerHTML = errorBox(e); });
}

const crown = `<svg class="rm-crown" viewBox="0 0 64 32" aria-hidden="true"><path d="M4 28 L8 8 L20 20 L32 2 L44 20 L56 8 L60 28 Z" fill="currentColor"/><circle cx="8" cy="7" r="3" fill="currentColor"/><circle cx="32" cy="2.5" r="3" fill="currentColor"/><circle cx="56" cy="7" r="3" fill="currentColor"/></svg>`;
const sparkles = () => `<div class="rm-sparkles">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.8}s;--s:${6 + (i % 5) * 2}s"></i>`).join('')}</div>`;
const opponentOf = (e) => e.homeTeam.id === RM ? e.awayTeam : e.homeTeam;

/* ---------- Hub ---------- */
MadridViews.hub = async (el, _p, q) => {
  document.body.classList.add('madrid');
  el.innerHTML = `<div class="rm-hero">
      ${sparkles()}
      <div class="rm-hero-inner">
        <div class="rm-crest-wrap">${crown}${img(teamLogo(RM), 'rm-crest')}</div>
        <div class="rm-title"><span class="rm-kicker">Real Madrid C.F. · 1902</span><h1>¡Hala Madrid!</h1><p>هاب ویژه رئال مادرید — همه‌چیز درباره کهکشانی‌ها</p></div>
      </div>
      <div id="rmNext" class="rm-next"></div>
    </div>
    ${tabs('rm', [['overview', 'خانه'], ['fixtures', 'برنامه'], ['players', 'ستاره‌ها'], ['squad', 'ترکیب'], ['stats', 'آمار تیمی'], ['injuries', 'غایبان']], q.tab || 'overview')}
    <div id="rmBody"></div>`;

  let last = [], next = [], team = null;
  try { [last, next, team] = await Promise.all([API.teamLast(RM), API.teamNext(RM), API.team(RM).catch(() => null)]); }
  catch (e) { el.querySelector('#rmNext').innerHTML = errorBox(e); }
  const done = last.filter(isDone);
  if (next[0]) el.querySelector('#rmNext').innerHTML = rmNextCard(next[0]);
  startCountdowns();
  const tours = teamTournaments([...last, ...next], team);
  tours.sort((a, b) => (b.id === CONFIG.LALIGA_ID) - (a.id === CONFIG.LALIGA_ID));

  bindTabs(el, 'rm', '#rmBody', {
    overview: async () => rmOverview(done, next, tours),
    fixtures: async () => `<div class="card rm-card"><div class="card-head"><b>بازی‌های پیش‌رو</b><small>${fa(next.length)} بازی</small></div>${next.map(rmFixtureRow).join('') || empty('—')}</div>
      <div class="card rm-card"><div class="card-head"><b>نتایج اخیر</b></div>${done.slice().reverse().map(rmFixtureRow).join('') || empty('—')}</div>`,
    players: async () => teamTopView(RM, tours, undefined, 'rm-card'),
    squad: async () => squadView(await API.teamPlayers(RM)),
    stats: async () => teamStatsView(RM, tours, done),
    injuries: async () => {
      const n = next[0];
      if (!n) return empty('بازی آینده‌ای ثبت نشده');
      const lu = await API.lineups(n.id).catch(() => null);
      const side = lu ? (n.homeTeam.id === RM ? lu.home : lu.away) : null;
      if (!side?.missingPlayers?.length) return empty(`برای بازی با ${esc(opponentOf(n).name)} هنوز غایبی گزارش نشده (معمولاً نزدیک بازی منتشر می‌شود)`);
      return `<div class="card rm-card"><div class="card-head"><b>🚑 غایبان بازی با ${esc(opponentOf(n).name)}</b></div>${missingList(side.missingPlayers)}</div>`;
    },
  }, q.tab || 'overview');
};

function rmNextCard(e) {
  const opp = opponentOf(e);
  const home = e.homeTeam.id === RM;
  return `<a class="rm-next-card" href="#/match/${e.id}">
    <div class="rnc-label">${isLive(e) ? '<span class="live-dot"></span> در حال برگزاری' : 'نبرد بعدی'} · ${img(leagueLogo(tourId(e)), 'logo-xs')} ${esc(tourName(e))}</div>
    <div class="rnc-teams">
      ${img(teamLogo(e.homeTeam.id), 'logo-lg')}
      <span class="rnc-vs">${isLive(e) ? `<b>${scoreOf(e)}</b>` : 'VS'}</span>
      ${img(teamLogo(e.awayTeam.id), 'logo-lg')}
    </div>
    <div class="rnc-opp"><b>${esc(opp.name)}</b><small>${home ? '🏠 خانه' : '✈️ خارج از خانه'} · ${fmt.date(e.startTimestamp)} · ساعت ${fmt.time(e.startTimestamp)}</small></div>
    ${isUpcoming(e) ? countdown(e.startTimestamp) : ''}
    <span class="rnc-cta">ورود به پیش‌نمایش ویژه بازی ‹</span>
  </a>`;
}

function rmFixtureRow(e) {
  const res = isDone(e) ? resultFor(e, RM) : '';
  return `<div class="rm-fx ${res ? 'res-' + res : ''}"><small>${img(leagueLogo(tourId(e)), 'logo-xs')} ${esc(tourName(e))} · ${fmt.short(e.startTimestamp)}</small>${matchRow(e)}</div>`;
}

async function rmOverview(done, next, tours) {
  const t = { W: 0, D: 0, L: 0, gf: 0, ga: 0, cs: 0 };
  done.forEach(e => {
    t[resultFor(e, RM)]++;
    t.gf += goalsFor(e, RM) || 0;
    const ga = goalsAgainst(e, RM) || 0;
    t.ga += ga; if (!ga) t.cs++;
  });
  let table = '';
  const liga = tours.find(x => x.id === CONFIG.LALIGA_ID);
  if (liga) {
    const rows = (await API.standings(liga.id, liga.sid).catch(() => []))[0]?.rows;
    if (rows) {
      const i = rows.findIndex(r => r.team.id === RM);
      const me = rows[i];
      table = `<div class="card rm-card"><div class="card-head"><b>${img(leagueLogo(CONFIG.LALIGA_ID), 'logo-xs')} لالیگا</b><a href="#/league/${CONFIG.LALIGA_ID}">جدول کامل ‹</a></div>
        ${me ? `<div class="rm-pos"><b>${fa(me.position)}</b><span>رتبه<br><small>${fa(me.points)} امتیاز از ${fa(me.matches)} بازی</small></span></div>` : ''}
        ${standingsTable(rows.slice(Math.max(0, i - 2), Math.max(5, i + 3)), true, RM)}</div>`;
    }
  }
  const n = done.length;
  return `<p class="muted">آمار ${fa(n)} بازی اخیر در همه رقابت‌ها</p>
    <div class="tiles rm-tiles">
      ${statTile(fa(t.W), 'برد')}
      ${statTile(fa(t.D), 'مساوی')}
      ${statTile(fa(t.L), 'باخت')}
      ${statTile(n ? fa(Math.round(t.W / n * 100)) + '٪' : '-', 'درصد برد')}
      ${statTile(fa(t.gf), 'گل زده', n ? 'میانگین ' + dec(t.gf / n, 1) : '')}
      ${statTile(fa(t.ga), 'گل خورده', n ? 'میانگین ' + dec(t.ga / n, 1) : '')}
      ${statTile(fa(t.cs), 'کلین‌شیت')}
      ${statTile(fa(next.length), 'بازی پیش‌رو')}
    </div>
    <div class="card rm-card rm-form"><div class="card-head"><b>فرم اخیر</b><small>همه رقابت‌ها</small></div>
      <div class="rm-form-row">${done.slice(-5).map(e => {
        const r = resultFor(e, RM), opp = opponentOf(e);
        return `<a href="#/match/${e.id}" class="rf rf-${r}">${img(teamLogo(opp.id), 'logo-md')}<b>${scoreOf(e)}</b><i>${{ W: 'برد', D: 'مساوی', L: 'باخت' }[r]}</i></a>`;
      }).join('') || empty('—')}</div>
    </div>
    <div class="two-col">
      <div class="card rm-card"><div class="card-head"><b>۵ بازی بعدی</b><a href="#/madrid?tab=fixtures">همه ‹</a></div>${next.slice(0, 5).map(rmFixtureRow).join('') || empty('—')}</div>
      ${table}
    </div>`;
}

/* ---------- Matchday preview for an upcoming Madrid fixture ---------- */
MadridViews.preview = async (el, e) => {
  document.body.classList.add('madrid');
  const opp = opponentOf(e);
  const h = e.homeTeam, a = e.awayTeam;
  const venue = e.venue?.stadium?.name || e.venue?.name;

  el.innerHTML = `<div class="rm-matchday">
      ${sparkles()}
      <div class="rmd-top"><a href="#/league/${tourId(e)}">${img(leagueLogo(tourId(e)), 'logo-sm')} ${esc(tourName(e))}${e.roundInfo?.round ? ' · ' + (e.roundInfo.name ? esc(roundFa(e.roundInfo.name)) : 'هفته ' + fa(e.roundInfo.round)) : ''}</a><span class="rmd-badge">MATCHDAY</span></div>
      <div class="rmd-teams">
        <a class="rmd-team ${h.id === RM ? 'rm' : ''}" href="#/team/${h.id}">${img(teamLogo(h.id), 'rmd-crest')}<b>${esc(h.name)}</b><small>میزبان</small></a>
        <div class="rmd-center">${crown}<span class="rmd-vs">VS</span><b>${fmt.time(e.startTimestamp)}</b><small>${fmt.full(e.startTimestamp)}</small></div>
        <a class="rmd-team ${a.id === RM ? 'rm' : ''}" href="#/team/${a.id}">${img(teamLogo(a.id), 'rmd-crest')}<b>${esc(a.name)}</b><small>میهمان</small></a>
      </div>
      ${countdown(e.startTimestamp)}
      <div class="rmd-meta">${venue ? `<span>🏟 ${esc(venue)}${e.venue?.city?.name ? '، ' + esc(e.venue.city.name) : ''}</span>` : ''}${e.referee?.name ? `<span>🧑‍⚖️ ${esc(e.referee.name)}</span>` : ''}</div>
    </div>

    <section class="rm-section"><h2>پیش‌بینی و فرم</h2><div id="rmPred"></div></section>
    <section class="rm-section"><h2>ترکیب رئال</h2><div id="rmXI"></div></section>
    <section class="rm-section"><h2>ستاره‌های فصل</h2><div id="rmStars"></div></section>
    <section class="rm-section"><h2>شناخت حریف: ${esc(opp.name)}</h2><div id="rmOpp"></div></section>
    <section class="rm-section"><h2>تاریخچه رویارویی</h2><div id="rmH2H"></div></section>
    <section class="rm-section"><h2>غایبان بازی</h2><div id="rmInj"></div></section>`;
  startCountdowns();

  const rmHome = h.id === RM;
  fillSection(el, '#rmPred', async () => {
    const [vote, pg] = await Promise.all([API.votes(e.id).catch(() => null), API.pregame(e.id).catch(() => null)]);
    let html = '';
    if (vote && (vote.vote1 || vote.vote2 || vote.voteX)) {
      const tot = vote.vote1 + vote.voteX + vote.vote2;
      const rmV = rmHome ? vote.vote1 : vote.vote2, opV = rmHome ? vote.vote2 : vote.vote1;
      const p = (v) => Math.round(v / tot * 100);
      html += `<div class="rm-prob">
        <div class="rp rm" style="flex:${p(rmV) || 1}"><b>${pct(p(rmV))}</b><small>رئال مادرید</small></div>
        <div class="rp d" style="flex:${p(vote.voteX) || 1}"><b>${pct(p(vote.voteX))}</b><small>مساوی</small></div>
        <div class="rp op" style="flex:${p(opV) || 1}"><b>${pct(p(opV))}</b><small>${esc(opp.shortName || opp.name)}</small></div>
      </div><p class="muted">پیش‌بینی ${fa(tot.toLocaleString())} هوادار در SofaScore</p>`;
    }
    if (pg) {
      const rmF = rmHome ? pg.homeTeam : pg.awayTeam, opF = rmHome ? pg.awayTeam : pg.homeTeam;
      const row = (label, x, y) => `<div class="rm-cmp-row"><b>${x}</b><span>${label}</span><b>${y}</b></div>`;
      html += `<div class="card rm-card"><div class="card-head teams-head">${img(teamLogo(RM), 'logo-sm')}<b>مقایسه پیش از بازی</b>${img(teamLogo(opp.id), 'logo-sm')}</div>
        ${row('فرم ۵ بازی', formChips(rmF?.form), formChips(opF?.form))}
        ${row('رتبه در جدول', num(rmF?.position), num(opF?.position))}
        ${row(pg.label === 'Pts' ? 'امتیاز' : esc(pg.label || 'امتیاز'), num(rmF?.value), num(opF?.value))}
        ${row('میانگین نمره تیم', num(rmF?.avgRating), num(opF?.avgRating))}</div>`;
    }
    return html;
  });

  fillSection(el, '#rmXI', async () => {
    // Use this match's lineup once announced, otherwise the last match's XI as the expected one.
    let lu = await API.lineups(e.id).catch(() => null);
    let side = lu ? (rmHome ? lu.home : lu.away) : null;
    let note = lu?.confirmed ? '✅ ترکیب رسمی اعلام شد' : 'ترکیب احتمالی SofaScore';
    if (!side?.players?.length) {
      const last = (await API.teamLast(RM)).filter(isDone).pop();
      if (!last) return empty('ترکیبی در دسترس نیست');
      const llu = await API.lineups(last.id);
      side = llu ? (last.homeTeam.id === RM ? llu.home : llu.away) : null;
      if (!side) return empty('ترکیبی در دسترس نیست');
      note = `بر اساس ترکیب بازی قبل مقابل ${esc(opponentOf(last).name)} (${fmt.short(last.startTimestamp)})`;
    }
    return `<p class="muted">${note} · سیستم <b dir="ltr">${esc(side.formation || '')}</b></p>${rmPitch(side)}`;
  });

  fillSection(el, '#rmStars', async () => {
    const liga = await API.currentSeason(CONFIG.LALIGA_ID);
    const top = liga ? await API.teamTop(RM, CONFIG.LALIGA_ID, liga.id) : null;
    if (!top) return '';
    const picks = [['goals', 'گلزن برتر', '⚽'], ['assists', 'پاسور برتر', '🎯'], ['rating', 'بهترین نمره', '⭐'], ['bigChancesCreated', 'موقعیت‌ساز برتر', '🔑']]
      .map(([k, l, ic]) => ({ x: top[k]?.[0], k, l, ic })).filter(p => p.x);
    return `<div class="rm-stars">${picks.map(({ x, k, l, ic }) => `<a class="rm-star" href="#/player/${x.player.id}">
      <span class="rs-label">${ic} ${l}</span>${img(playerPhoto(x.player.id), 'rs-photo')}
      <b>${esc(x.player.name)}</b><span class="rs-val">${k === 'rating' ? dec(x.statistics[k]) : fa(x.statistics[k])}</span>
      <small>لالیگا · ${fa(x.statistics.appearances || 0)} بازی</small></a>`).join('')}</div>`;
  });

  fillSection(el, '#rmOpp', async () => {
    const od = (await API.teamLast(opp.id)).filter(isDone).slice(-5);
    const gf = od.reduce((s, x) => s + (goalsFor(x, opp.id) || 0), 0), ga = od.reduce((s, x) => s + (goalsAgainst(x, opp.id) || 0), 0);
    return `<div class="card rm-card"><div class="card-head">${img(teamLogo(opp.id), 'logo-sm')}<b>${esc(opp.name)}</b><a href="#/team/${opp.id}">صفحه تیم ‹</a></div>
      <div class="kv"><span>فرم ۵ بازی اخیر</span>${formChips(od.map(x => resultFor(x, opp.id)))}</div>
      <div class="kv"><span>گل زده / خورده (۵ بازی)</span><b>${fa(gf)} / ${fa(ga)}</b></div>
      ${od.slice().reverse().map(matchRow).join('')}</div>`;
  });

  fillSection(el, '#rmH2H', () => h2hView(e));
  fillSection(el, '#rmInj', async () => {
    const lu = await API.lineups(e.id).catch(() => null);
    if (!lu) return empty('هنوز گزارشی از غایبان منتشر نشده (معمولاً نزدیک بازی می‌آید)');
    const list = (side, team) => side?.missingPlayers?.length ? `<div class="card rm-card"><div class="card-head">${img(teamLogo(team.id), 'logo-sm')}<b>${esc(team.name)}</b></div>${missingList(side.missingPlayers)}</div>` : '';
    return (list(lu.home, h) + list(lu.away, a)) || empty('✅ غایبی گزارش نشده');
  });
};

// Single-team vertical pitch for Madrid's XI.
function rmPitch(lu) {
  const rows = formationRows(lu);
  return `<div class="pitch rm-pitch">
    <div class="pitch-lines"><i class="half"></i><i class="circle"></i><i class="box bottom"></i><i class="six bottom"></i></div>
    ${rows.map((ps, i) => {
      const y = 90 - (i / Math.max(rows.length - 1, 1)) * 78;
      return ps.map((p, j) => pitchPlayer(p, ((j + 1) / (ps.length + 1)) * 100, y, 'rm-pp')).join('');
    }).join('')}
  </div>`;
}
