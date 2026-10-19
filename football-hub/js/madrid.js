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
const rmSchedule = () => API.teamSchedule(RM, CONFIG.MADRID_LEAGUES);

// LaLiga leader boards narrowed to Madrid players.
async function madridLeaders() {
  const stats = await API.leaders(CONFIG.LALIGA).catch(() => []);
  return stats.map(c => ({ ...c, leaders: (c.leaders || []).filter(l => String(l.athlete?.team?.id ?? l.team?.id) === RM) })).filter(c => c.leaders.length);
}

/* ---------- Hub ---------- */
MadridViews.hub = async (el, _p, q) => {
  document.body.classList.add('madrid');
  el.innerHTML = `<div class="rm-hero">
      ${sparkles()}
      <div class="rm-hero-inner">
        <div class="rm-crest-wrap">${crown}${img(teamLogo(RM), 'rm-crest')}</div>
        <div class="rm-title"><span class="rm-kicker">Real Madrid C.F. · 1902</span><h1>¡Hala Madrid!</h1><p id="rmSummary">هاب ویژه رئال مادرید — همه‌چیز درباره کهکشانی‌ها</p></div>
      </div>
      <div id="rmNext" class="rm-next"></div>
    </div>
    ${tabs('rm', [['overview', 'خانه'], ['fixtures', 'برنامه'], ['stats', 'آمار تیمی'], ['players', 'ستاره‌ها'], ['squad', 'بازیکنان'], ['injuries', 'مصدومان'], ['news', 'اخبار']], q.tab || 'overview')}
    <div id="rmBody"></div>`;

  let all = [], team = null;
  try { [all, team] = await Promise.all([rmSchedule(), API.team(CONFIG.LALIGA, RM).catch(() => null)]); }
  catch (err) { el.querySelector('#rmNext').innerHTML = errorBox(err); }
  if (team?.standingSummary) el.querySelector('#rmSummary').textContent = `${team.standingSummary}${team.record?.items?.[0]?.summary ? ' · ' + team.record.items[0].summary : ''}`;
  const done = all.filter(isDone), next = all.filter(e => isUpcoming(e) || isLive(e));
  if (next[0]) el.querySelector('#rmNext').innerHTML = rmNextCard(next[0]);
  startCountdowns();

  bindTabs(el, 'rm', '#rmBody', {
    overview: async () => rmOverview(done, next),
    fixtures: async () => `<div class="card rm-card"><div class="card-head"><b>بازی‌های پیش‌رو</b><small>${fa(next.length)} بازی</small></div>${next.map(rmFixtureRow).join('') || empty('—')}</div>
      <div class="card rm-card"><div class="card-head"><b>نتایج فصل</b></div>${done.slice().reverse().map(rmFixtureRow).join('') || empty('—')}</div>`,
    stats: async () => teamStatsView(RM, done, team, 'rm-card'),
    players: async () => {
      const [lead, roster] = await Promise.all([madridLeaders(), API.roster(CONFIG.LALIGA, RM).catch(() => [])]);
      const fromLeaders = lead.length ? leadersView(lead) : '';
      const table = squadView(roster, 'rm-card', true);
      return (fromLeaders ? `<h3 class="section-title">رئالی‌ها در صدر جدول آماری لالیگا</h3>${fromLeaders}` : '') + table;
    },
    squad: async () => squadView(await API.roster(CONFIG.LALIGA, RM), 'rm-card'),
    injuries: async () => injuriesView(await API.roster(CONFIG.LALIGA, RM)),
    news: async () => newsList(await API.news(CONFIG.LALIGA, RM)),
  }, q.tab || 'overview');
};

function injuriesView(roster) {
  const hurt = (roster || []).filter(a => a.injuries?.length);
  if (!hurt.length) return empty('✅ ESPN مصدومی برای رئال مادرید گزارش نکرده');
  return `<div class="card rm-card"><div class="card-head"><b>🚑 مصدومان و غایبان</b><small>${fa(hurt.length)} بازیکن</small></div>
    ${hurt.map(a => { const i = a.injuries[0]; return `<a class="board-row" href="#/player/${a.id}">${img(a.headshot?.href || playerPhoto(a.id), 'avatar')}
      <span class="br-name"><b>${esc(a.displayName)}</b><small dir="auto">${esc(i.details?.type || i.type?.description || i.longComment || i.shortComment || '')}${i.details?.returnDate ? ' · بازگشت: ' + new Date(i.details.returnDate).toLocaleDateString('fa-IR') : ''}</small></span>
      <span class="inj-tag ${/out/i.test(i.status) ? 'out' : 'doubt'}">${/out/i.test(i.status) ? 'غایب' : esc(i.status || 'مشکوک')}</span></a>`; }).join('')}</div>`;
}

function rmNextCard(e) {
  const opp = opponentOf(e, RM);
  const home = e.home.id === RM;
  return `<a class="rm-next-card" href="${matchHref(e)}">
    <div class="rnc-label">${isLive(e) ? '<span class="live-dot"></span> در حال برگزاری' : 'نبرد بعدی'} · ${img(leagueLogo(e.league), 'logo-xs')} ${esc(leagueName(e.league, e.leagueName))}</div>
    <div class="rnc-teams">
      ${img(e.home.logo || teamLogo(e.home.id), 'logo-lg')}
      <span class="rnc-vs">${isLive(e) ? `<b>${scoreOf(e)}</b>` : 'VS'}</span>
      ${img(e.away.logo || teamLogo(e.away.id), 'logo-lg')}
    </div>
    <div class="rnc-opp"><b>${esc(opp.name)}</b><small>${home ? '🏠 خانه' : '✈️ خارج از خانه'} · ${fmt.date(e.ts)} · ساعت ${fmt.time(e.ts)}</small></div>
    ${isUpcoming(e) ? countdown(e.ts) : ''}
    <span class="rnc-cta">ورود به پیش‌نمایش ویژه بازی ‹</span>
  </a>`;
}

function rmFixtureRow(e) {
  const res = isDone(e) ? resultFor(e, RM) : '';
  return `<div class="rm-fx ${res ? 'res-' + res : ''}"><small>${img(leagueLogo(e.league), 'logo-xs')} ${esc(leagueName(e.league, e.leagueName))} · ${fmt.short(e.ts)}</small>${matchRow(e)}</div>`;
}

async function rmOverview(done, next) {
  const t = seasonTally(done, RM);
  let table = '';
  const groups = await API.standings(CONFIG.LALIGA).catch(() => []);
  const entries = groups[0]?.entries;
  if (entries) {
    const sorted = [...entries].sort((a, b) => (sv(a, 'rank') ?? 99) - (sv(b, 'rank') ?? 99));
    const i = sorted.findIndex(x => String(x.team?.id) === RM);
    const me = sorted[i];
    table = `<div class="card rm-card"><div class="card-head"><b>${img(leagueLogo(CONFIG.LALIGA), 'logo-xs')} لالیگا</b><a href="#/league/${CONFIG.LALIGA}">جدول کامل ‹</a></div>
      ${me ? `<div class="rm-pos"><b>${fa(sv(me, 'rank'))}</b><span>رتبه<br><small>${fa(sv(me, 'points'))} امتیاز از ${fa(sv(me, 'gamesPlayed'))} بازی</small></span></div>` : ''}
      ${standingsTable(sorted.slice(Math.max(0, i - 2), Math.max(5, i + 3)).map(x => ({ ...x, __league: CONFIG.LALIGA })), true, RM)}</div>`;
  }
  return `<div class="tiles rm-tiles">
      ${statTile(fa(t.n), 'بازی', 'همه رقابت‌ها')}
      ${statTile(fa(t.W), 'برد')}
      ${statTile(fa(t.D), 'مساوی')}
      ${statTile(fa(t.L), 'باخت')}
      ${statTile(fa(t.gf), 'گل زده', t.n ? 'میانگین ' + dec(t.gf / t.n, 1) : '')}
      ${statTile(fa(t.ga), 'گل خورده', t.n ? 'میانگین ' + dec(t.ga / t.n, 1) : '')}
      ${statTile(fa(t.cs), 'کلین‌شیت')}
      ${statTile(t.n ? pct(t.W / t.n * 100) : '-', 'درصد برد')}
    </div>
    <div class="card rm-card rm-form"><div class="card-head"><b>فرم اخیر</b><small>همه رقابت‌ها</small></div>
      <div class="rm-form-row">${done.slice(-5).map(e => {
        const r = resultFor(e, RM), opp = opponentOf(e, RM);
        return `<a href="${matchHref(e)}" class="rf rf-${r}">${img(opp.logo || teamLogo(opp.id), 'logo-md')}<b>${scoreOf(e)}</b><i>${{ W: 'برد', D: 'مساوی', L: 'باخت' }[r] || ''}</i></a>`;
      }).join('') || empty('—')}</div>
    </div>
    <div class="two-col">
      <div class="card rm-card"><div class="card-head"><b>۵ بازی بعدی</b><a href="#/madrid?tab=fixtures">همه ‹</a></div>${next.slice(0, 5).map(rmFixtureRow).join('') || empty('—')}</div>
      ${table}
    </div>`;
}

/* ---------- Matchday preview for an upcoming Madrid fixture ---------- */
MadridViews.preview = async (el, e, s) => {
  document.body.classList.add('madrid');
  const opp = opponentOf(e, RM);
  const rmHome = e.home.id === RM;
  const gi = s.gameInfo || {};

  el.innerHTML = `<div class="rm-matchday">
      ${sparkles()}
      <div class="rmd-top"><a href="#/league/${e.league}">${img(leagueLogo(e.league), 'logo-sm')} ${esc(leagueName(e.league, e.leagueName))}</a><span class="rmd-badge">MATCHDAY</span></div>
      <div class="rmd-teams">
        <a class="rmd-team ${rmHome ? 'rm' : ''}" href="${teamHref(e.league, e.home.id)}">${img(e.home.logo || teamLogo(e.home.id), 'rmd-crest')}<b>${esc(e.home.name)}</b><small>میزبان</small></a>
        <div class="rmd-center">${crown}<span class="rmd-vs">VS</span><b>${fmt.time(e.ts)}</b><small>${fmt.full(e.ts)}</small></div>
        <a class="rmd-team ${!rmHome ? 'rm' : ''}" href="${teamHref(e.league, e.away.id)}">${img(e.away.logo || teamLogo(e.away.id), 'rmd-crest')}<b>${esc(e.away.name)}</b><small>میهمان</small></a>
      </div>
      ${countdown(e.ts)}
      <div class="rmd-meta">${gi.venue?.fullName ? `<span>🏟 ${esc(gi.venue.fullName)}${gi.venue.address?.city ? '، ' + esc(gi.venue.address.city) : ''}</span>` : ''}${gi.officials?.[0] ? `<span>🧑‍⚖️ ${esc(gi.officials[0].fullName || gi.officials[0].displayName || '')}</span>` : ''}</div>
    </div>

    <section class="rm-section"><h2>شانس پیروزی</h2><div id="rmPred"></div></section>
    <section class="rm-section"><h2>ترکیب رئال</h2><div id="rmXI"></div></section>
    <section class="rm-section"><h2>ستاره‌های فصل</h2><div id="rmStars"></div></section>
    <section class="rm-section"><h2>فرم دو تیم</h2><div id="rmForm"></div></section>
    <section class="rm-section"><h2>تاریخچه رویارویی</h2><div id="rmH2H"></div></section>
    <section class="rm-section"><h2>غایبان رئال</h2><div id="rmInj"></div></section>
    <section class="rm-section"><h2>اخبار پیش از بازی</h2><div id="rmNews"></div></section>`;
  startCountdowns();

  fillSection(el, '#rmPred', async () => {
    const p = oddsProb(s);
    if (!p) return empty('ضرایب این بازی هنوز منتشر نشده');
    const rmP = rmHome ? p.home : p.away, opP = rmHome ? p.away : p.home;
    return `<div class="rm-prob">
        <div class="rp rm" style="flex:${rmP}"><b>${pct(rmP)}</b><small>رئال مادرید</small></div>
        ${p.draw ? `<div class="rp d" style="flex:${p.draw}"><b>${pct(p.draw)}</b><small>مساوی</small></div>` : ''}
        <div class="rp op" style="flex:${opP}"><b>${pct(opP)}</b><small>${esc(opp.short || opp.name)}</small></div>
      </div><p class="muted">احتمال‌ها از ضرایب ${esc(p.provider || 'شرط‌بندی')} محاسبه شده${p.overUnder ? ` · خط گل: <span dir="ltr">${esc(p.overUnder)}</span>` : ''}</p>`;
  });

  fillSection(el, '#rmXI', async () => {
    // This match's lineup once announced; otherwise the XI from Madrid's last match.
    let side = (s.rosters || []).find(r => String(r.team?.id) === RM);
    let note = '✅ ترکیب رسمی اعلام شد';
    if (!side?.roster?.some(p => p.starter)) {
      const last = (await rmSchedule()).filter(isDone).pop();
      if (!last) return empty('ترکیبی در دسترس نیست');
      const ls = await API.summary(last.league, last.id);
      side = (ls?.rosters || []).find(r => String(r.team?.id) === RM);
      if (!side?.roster?.some(p => p.starter)) return empty('ترکیبی در دسترس نیست');
      note = `ترکیب احتمالی بر اساس بازی قبل مقابل ${esc(opponentOf(last, RM).name)} (${fmt.short(last.ts)})`;
    }
    return `<p class="muted">${note} · سیستم <b dir="ltr">${esc(side.formation || '')}</b></p>${rmPitch(side)}`;
  });

  fillSection(el, '#rmStars', async () => {
    const lead = await madridLeaders();
    const picks = lead.map(c => ({ c, l: c.leaders[0] })).slice(0, 4);
    if (picks.length) {
      return `<div class="rm-stars">${picks.map(({ c, l }) => `<a class="rm-star" href="#/player/${l.athlete?.id}">
        <span class="rs-label">${LEADER_FA[c.name] || LEADER_FA[c.displayName] || esc(c.displayName || c.name)}</span>${img(l.athlete?.headshot?.href || playerPhoto(l.athlete?.id), 'rs-photo')}
        <b>${esc(l.athlete?.displayName || '')}</b><span class="rs-val">${fa(l.value ?? '')}</span><small>لالیگا${l.displayValue ? ' · ' + esc(l.displayValue) : ''}</small></a>`).join('')}</div>`;
    }
    // Fall back to the roster's own season numbers.
    const roster = await API.roster(CONFIG.LALIGA, RM);
    const rows = roster.map(a => ({ a, s: athleteSeasonStats(a) }));
    const top = (k) => [...rows].sort((x, y) => (y.s[k]?.value || 0) - (x.s[k]?.value || 0))[0];
    const cats = [['totalGoals', '⚽ گلزن برتر'], ['goalAssists', '🎯 پاسور برتر'], ['appearances', '🏃 بیشترین بازی'], ['totalShots', '🎯 بیشترین شوت']]
      .map(([k, l]) => ({ k, l, x: top(k) })).filter(x => x.x?.s[x.k]?.value);
    if (!cats.length) return '';
    return `<div class="rm-stars">${cats.map(({ k, l, x }) => `<a class="rm-star" href="#/player/${x.a.id}">
      <span class="rs-label">${l}</span>${img(x.a.headshot?.href || playerPhoto(x.a.id), 'rs-photo')}
      <b>${esc(x.a.displayName)}</b><span class="rs-val">${fa(x.s[k].value)}</span></a>`).join('')}</div>`;
  });

  fillSection(el, '#rmForm', async () => {
    const forms = s.boxscore?.form || [];
    if (forms.length) return `<div class="two-col">${forms.map(f => formCard(f, e.league)).join('')}</div>`;
    const od = (await API.teamSchedule(opp.id, [e.league])).filter(isDone).slice(-5);
    return `<div class="card rm-card"><div class="card-head">${img(opp.logo || teamLogo(opp.id), 'logo-sm')}<b>${esc(opp.name)}</b></div>
      <div class="kv"><span>فرم اخیر</span>${formChips(od.map(x => resultFor(x, opp.id)))}</div>${od.slice().reverse().map(matchRow).join('')}</div>`;
  });

  fillSection(el, '#rmH2H', () => h2hView(e, s));
  fillSection(el, '#rmInj', async () => injuriesView(await API.roster(CONFIG.LALIGA, RM)));
  fillSection(el, '#rmNews', async () => newsList(s.news?.articles?.length ? s.news.articles : await API.news(CONFIG.LALIGA, RM)));
};

// Single-team vertical pitch for Madrid's XI.
function rmPitch(side) {
  const rows = formationRows(side);
  return `<div class="pitch rm-pitch">
    <div class="pitch-lines"><i class="half"></i><i class="circle"></i><i class="box bottom"></i><i class="six bottom"></i></div>
    ${rows.map((ps, i) => {
      const y = 90 - (i / Math.max(rows.length - 1, 1)) * 78;
      return ps.map((p, j) => pitchPlayer(p, ((j + 1) / (ps.length + 1)) * 100, y, 'rm-pp')).join('');
    }).join('')}
  </div>`;
}
