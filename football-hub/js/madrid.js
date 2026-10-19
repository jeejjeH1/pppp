// Real Madrid experience: a dedicated hub and a "matchday programme" preview for upcoming Madrid games.
const MadridViews = {};
const RM = CONFIG.MADRID_ID;

// Render an async section into its placeholder without blocking the rest of the page.
function fillSection(root, sel, fn) {
  const host = root.querySelector(sel);
  if (!host) return;
  host.innerHTML = loader();
  Promise.resolve().then(fn).then(html => { host.innerHTML = html || ''; startCountdowns(); }).catch(e => { host.innerHTML = errorBox(e); });
}

const crown = `<svg class="rm-crown" viewBox="0 0 64 32" aria-hidden="true"><path d="M4 28 L8 8 L20 20 L32 2 L44 20 L56 8 L60 28 Z" fill="currentColor"/><circle cx="8" cy="7" r="3" fill="currentColor"/><circle cx="32" cy="2.5" r="3" fill="currentColor"/><circle cx="56" cy="7" r="3" fill="currentColor"/></svg>`;
const sparkles = () => `<div class="rm-sparkles">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.8}s;--s:${6 + (i % 5) * 2}s"></i>`).join('')}</div>`;

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
    ${tabs('rm', [['overview', 'خانه'], ['fixtures', 'برنامه'], ['players', 'ستاره‌ها'], ['squad', 'ترکیب'], ['stats', 'آمار تیمی'], ['injuries', 'مصدومان']], q.tab || 'overview')}
    <div id="rmBody"></div>`;

  let fx = [];
  try { fx = await API.teamFixtures(RM); } catch (e) { el.querySelector('#rmNext').innerHTML = errorBox(e); }
  const done = fx.filter(isDone), upcoming = fx.filter(f => isUpcoming(f) || isLive(f));
  const next = upcoming[0];
  if (next) el.querySelector('#rmNext').innerHTML = rmNextCard(next);
  startCountdowns();

  bindTabs(el, 'rm', '#rmBody', {
    overview: async () => rmOverview(fx, done, upcoming),
    fixtures: async () => `<div class="card rm-card"><div class="card-head"><b>بازی‌های پیش‌رو</b><small>${fa(upcoming.length)} بازی</small></div>${upcoming.map(rmFixtureRow).join('') || empty('—')}</div>
      <div class="card rm-card"><div class="card-head"><b>نتایج فصل</b></div>${done.slice().reverse().map(rmFixtureRow).join('') || empty('—')}</div>`,
    players: async () => teamPlayersView(await API.teamPlayers(RM), 'rm-card'),
    squad: async () => squadView(await API.squad(RM)),
    stats: async () => teamStatsView(RM, countLeagues(fx).sort((a, b) => (b.id === CONFIG.LALIGA_ID) - (a.id === CONFIG.LALIGA_ID))),
    injuries: async () => injuriesView(await API.injuries({ team: RM, season: API.season() }), true),
  }, q.tab || 'overview');
};

function rmNextCard(f) {
  const opp = f.teams.home.id === RM ? f.teams.away : f.teams.home;
  const home = f.teams.home.id === RM;
  return `<a class="rm-next-card" href="#/match/${f.fixture.id}">
    <div class="rnc-label">${isLive(f) ? '<span class="live-dot"></span> در حال برگزاری' : 'نبرد بعدی'} · ${img(f.league.logo, 'logo-xs')} ${esc(f.league.name)}</div>
    <div class="rnc-teams">
      ${img(teamLogo(RM), 'logo-lg')}
      <span class="rnc-vs">${isLive(f) ? `<b>${scoreHtml(f.goals.home, f.goals.away)}</b>` : 'VS'}</span>
      ${img(opp.logo, 'logo-lg')}
    </div>
    <div class="rnc-opp"><b>${esc(opp.name)}</b><small>${home ? '🏠 خانه' : '✈️ خارج از خانه'} · ${fmt.date(f.fixture.timestamp)} · ساعت ${fmt.time(f.fixture.timestamp)}</small></div>
    ${isUpcoming(f) ? countdown(f.fixture.timestamp) : ''}
    <span class="rnc-cta">ورود به پیش‌نمایش ویژه بازی ‹</span>
  </a>`;
}

function rmFixtureRow(f) {
  const res = isDone(f) ? resultFor(f, RM) : '';
  return `<div class="rm-fx ${res ? 'res-' + res : ''}"><small>${img(f.league.logo, 'logo-xs')} ${fmt.short(f.fixture.timestamp)}</small>${matchRow(f)}</div>`;
}

async function rmOverview(fx, done, upcoming) {
  const tally = { W: 0, D: 0, L: 0, gf: 0, ga: 0, cs: 0 };
  done.forEach(f => {
    tally[resultFor(f, RM)]++;
    const h = f.teams.home.id === RM;
    const gf = h ? f.goals.home : f.goals.away, ga = h ? f.goals.away : f.goals.home;
    tally.gf += gf; tally.ga += ga; if (!ga) tally.cs++;
  });
  let table = '';
  try {
    const lg = await API.standings(CONFIG.LALIGA_ID);
    const rows = lg?.standings?.[0];
    if (rows) {
      const i = rows.findIndex(r => r.team.id === RM);
      const me = rows[i];
      table = `<div class="card rm-card"><div class="card-head"><b>${img(leagueLogo(CONFIG.LALIGA_ID), 'logo-xs')} لالیگا</b><a href="#/league/${CONFIG.LALIGA_ID}">جدول کامل ‹</a></div>
        ${me ? `<div class="rm-pos"><b>${fa(me.rank)}</b><span>رتبه<br><small>${fa(me.points)} امتیاز از ${fa(me.all.played)} بازی</small></span></div>` : ''}
        ${standingsTable(rows.slice(Math.max(0, i - 2), Math.max(5, i + 3)), true, RM)}</div>`;
    }
  } catch { /* standings are optional on the overview */ }

  return `<div class="tiles rm-tiles">
      ${statTile(fa(done.length), 'بازی')}
      ${statTile(fa(tally.W), 'برد')}
      ${statTile(fa(tally.D), 'مساوی')}
      ${statTile(fa(tally.L), 'باخت')}
      ${statTile(fa(tally.gf), 'گل زده', done.length ? 'میانگین ' + fa((tally.gf / done.length).toFixed(1)) : '')}
      ${statTile(fa(tally.ga), 'گل خورده')}
      ${statTile(fa(tally.cs), 'کلین‌شیت')}
      ${statTile(done.length ? fa(Math.round(tally.W / done.length * 100)) + '٪' : '-', 'درصد برد')}
    </div>
    <div class="card rm-card rm-form"><div class="card-head"><b>فرم اخیر</b><small>همه رقابت‌ها</small></div>
      <div class="rm-form-row">${done.slice(-5).map(f => {
        const r = resultFor(f, RM), opp = f.teams.home.id === RM ? f.teams.away : f.teams.home;
        return `<a href="#/match/${f.fixture.id}" class="rf rf-${r}">${img(opp.logo, 'logo-md')}<b>${scoreHtml(f.goals.home, f.goals.away)}</b><i>${{ W: 'برد', D: 'مساوی', L: 'باخت' }[r]}</i></a>`;
      }).join('') || empty('—')}</div>
    </div>
    <div class="two-col">
      <div class="card rm-card"><div class="card-head"><b>۵ بازی بعدی</b><a href="#/madrid?tab=fixtures">همه ‹</a></div>${upcoming.slice(0, 5).map(rmFixtureRow).join('') || empty('—')}</div>
      ${table}
    </div>`;
}

function injuriesView(list, recentOnly = false) {
  if (!list?.length) return empty('✅ گزارشی از مصدومیت یا محرومیت ثبت نشده');
  // The team endpoint returns one row per missed fixture; keep the latest per player.
  const cutoff = Date.now() / 1000 - 21 * 86400;
  const latest = new Map();
  list.forEach(i => {
    if (recentOnly && i.fixture.timestamp < cutoff) return;
    const prev = latest.get(i.player.id);
    if (!prev || prev.fixture.timestamp < i.fixture.timestamp) latest.set(i.player.id, i);
  });
  if (!latest.size) return empty('✅ در حال حاضر بازیکن مصدومی گزارش نشده');
  return `<div class="card rm-card"><div class="card-head"><b>🚑 غایبان</b><small>${fa(latest.size)} بازیکن</small></div>
    ${[...latest.values()].map(i => `<a class="board-row" href="#/player/${i.player.id}">${img(i.player.photo, 'avatar')}
      <span class="br-name"><b>${esc(i.player.name)}</b><small>${img(i.team.logo, 'logo-xs')} ${esc(i.player.reason || '')}</small></span>
      <span class="inj-tag ${i.player.type === 'Missing Fixture' ? 'out' : 'doubt'}">${i.player.type === 'Missing Fixture' ? 'غایب' : 'مشکوک'}</span></a>`).join('')}</div>`;
}

/* ---------- Matchday preview for an upcoming Madrid fixture ---------- */
MadridViews.preview = async (el, f) => {
  document.body.classList.add('madrid');
  const rmHome = f.teams.home.id === RM;
  const opp = rmHome ? f.teams.away : f.teams.home;
  const { home, away } = f.teams;

  el.innerHTML = `<div class="rm-matchday">
      ${sparkles()}
      <div class="rmd-top"><a href="#/league/${f.league.id}">${img(f.league.logo, 'logo-sm')} ${esc(f.league.name)} · ${esc(roundFa(f.league.round))}</a><span class="rmd-badge">MATCHDAY</span></div>
      <div class="rmd-teams">
        <a class="rmd-team ${home.id === RM ? 'rm' : ''}" href="#/team/${home.id}">${img(home.logo, 'rmd-crest')}<b>${esc(home.name)}</b><small>میزبان</small></a>
        <div class="rmd-center">${crown}<span class="rmd-vs">VS</span><b>${fmt.time(f.fixture.timestamp)}</b><small>${fmt.full(f.fixture.timestamp)}</small></div>
        <a class="rmd-team ${away.id === RM ? 'rm' : ''}" href="#/team/${away.id}">${img(away.logo, 'rmd-crest')}<b>${esc(away.name)}</b><small>میهمان</small></a>
      </div>
      ${countdown(f.fixture.timestamp)}
      <div class="rmd-meta">${f.fixture.venue?.name ? `<span>🏟 ${esc(f.fixture.venue.name)}${f.fixture.venue.city ? '، ' + esc(f.fixture.venue.city) : ''}</span>` : ''}${f.fixture.referee ? `<span>🧑‍⚖️ ${esc(f.fixture.referee)}</span>` : ''}</div>
    </div>

    <section class="rm-section"><h2><span>۰۱</span> شانس پیروزی</h2><div id="rmPred"></div></section>
    <section class="rm-section"><h2><span>۰۲</span> ترکیب احتمالی رئال</h2><div id="rmXI"></div></section>
    <section class="rm-section"><h2><span>۰۳</span> ستاره‌های فصل</h2><div id="rmStars"></div></section>
    <section class="rm-section"><h2><span>۰۴</span> شناخت حریف — ${esc(opp.name)}</h2><div id="rmOpp"></div></section>
    <section class="rm-section"><h2><span>۰۵</span> تاریخچه رویارویی</h2><div id="rmH2H"></div></section>
    <section class="rm-section"><h2><span>۰۶</span> غایبان بازی</h2><div id="rmInj"></div></section>`;
  startCountdowns();

  fillSection(el, '#rmPred', async () => {
    const p = await API.predictions(f.fixture.id);
    if (!p) return empty('پیش‌بینی هنوز منتشر نشده');
    const pr = p.predictions.percent;
    const rmP = parseFloat(rmHome ? pr.home : pr.away), oppP = parseFloat(rmHome ? pr.away : pr.home), dP = parseFloat(pr.draw);
    const cmp = p.comparison;
    const side = rmHome ? 'home' : 'away', oside = rmHome ? 'away' : 'home';
    const radar = ['form', 'att', 'def', 'h2h', 'goals'].filter(k => cmp?.[k]).map(k => `<div class="rm-cmp"><span>${pct(cmp[k][side])}</span>
      <div class="rm-cmp-bar"><i class="rm" style="width:${parseFloat(cmp[k][side])}%"></i><i class="op" style="width:${parseFloat(cmp[k][oside])}%"></i></div>
      <span>${pct(cmp[k][oside])}</span><b>${{ form: 'فرم', att: 'حمله', def: 'دفاع', h2h: 'رودررو', goals: 'گل' }[k]}</b></div>`).join('');
    return `<div class="rm-prob">
        <div class="rp rm" style="flex:${rmP || 1}"><b>${pct(rmP)}</b><small>رئال مادرید</small></div>
        <div class="rp d" style="flex:${dP || 1}"><b>${pct(dP)}</b><small>مساوی</small></div>
        <div class="rp op" style="flex:${oppP || 1}"><b>${pct(oppP)}</b><small>${esc(opp.name)}</small></div>
      </div>
      ${p.predictions.advice ? `<p class="advice">💡 <span dir="ltr">${esc(p.predictions.advice)}</span></p>` : ''}
      <div class="card rm-card"><div class="card-head teams-head">${img(teamLogo(RM), 'logo-sm')}<b>مقایسه</b>${img(opp.logo, 'logo-sm')}</div>${radar}</div>`;
  });

  fillSection(el, '#rmXI', async () => {
    const fx = await API.teamFixtures(RM);
    const last = fx.filter(isDone).pop();
    if (!last) return empty('هنوز بازی‌ای انجام نشده');
    const full = await API.fixture(last.fixture.id);
    const lu = full?.lineups?.find(l => l.team.id === RM);
    if (!lu) return empty('ترکیب بازی قبل در دسترس نیست');
    const ratings = {};
    full.players?.find(t => t.team.id === RM)?.players.forEach(p => { ratings[p.player.id] = p.statistics[0]?.games?.rating; });
    const o = last.teams.home.id === RM ? last.teams.away : last.teams.home;
    return `<p class="muted">بر اساس ترکیب بازی قبل مقابل ${esc(o.name)} (${fmt.short(last.fixture.timestamp)}) · سیستم <b dir="ltr">${esc(lu.formation)}</b> · سرمربی: ${esc(lu.coach?.name || '-')}</p>
      ${rmPitch(lu, ratings)}`;
  });

  fillSection(el, '#rmStars', async () => {
    const list = await API.teamPlayers(RM);
    const rows = list.map(p => ({ p: p.player, a: aggregate(p.statistics) })).filter(r => r.a.apps);
    const top = (k) => [...rows].sort((x, y) => (y.a[k] || 0) - (x.a[k] || 0))[0];
    const picks = [['goals', 'گلزن برتر', '⚽'], ['assists', 'پاسور برتر', '🎯'], ['rating', 'بهترین نمره', '⭐'], ['mins', 'بیشترین دقیقه', '⏱']]
      .map(([k, l, ic]) => ({ r: top(k), k, l, ic })).filter(x => x.r);
    return `<div class="rm-stars">${picks.map(({ r, k, l, ic }) => `<a class="rm-star" href="#/player/${r.p.id}">
      <span class="rs-label">${ic} ${l}</span>${img(r.p.photo, 'rs-photo')}
      <b>${esc(r.p.name)}</b><span class="rs-val">${k === 'rating' ? fa(r.a.rating.toFixed(2)) : fa(r.a[k])}</span>
      <small>${fa(r.a.goals)} گل · ${fa(r.a.assists)} پاس گل · ${fa(r.a.apps)} بازی</small></a>`).join('')}</div>`;
  });

  fillSection(el, '#rmOpp', async () => {
    const ofx = await API.teamFixtures(opp.id);
    const od = ofx.filter(isDone);
    const last5 = od.slice(-5);
    const gf = last5.reduce((t, x) => t + (x.teams.home.id === opp.id ? x.goals.home : x.goals.away), 0);
    const ga = last5.reduce((t, x) => t + (x.teams.home.id === opp.id ? x.goals.away : x.goals.home), 0);
    return `<div class="card rm-card"><div class="card-head">${img(opp.logo, 'logo-sm')}<b>${esc(opp.name)}</b><a href="#/team/${opp.id}">صفحه تیم ‹</a></div>
      <div class="kv"><span>فرم ۵ بازی اخیر</span>${formChips(last5.map(x => resultFor(x, opp.id)).join(''))}</div>
      <div class="kv"><span>گل زده / خورده (۵ بازی)</span><b>${fa(gf)} / ${fa(ga)}</b></div>
      ${last5.slice().reverse().map(matchRow).join('')}</div>`;
  });

  fillSection(el, '#rmH2H', async () => h2hView(home, away, await API.h2h(home.id, away.id)));
  fillSection(el, '#rmInj', async () => injuriesView(await API.injuries({ fixture: f.fixture.id })));
};

// Single-team vertical pitch for the expected XI.
function rmPitch(lu, ratings) {
  const rows = {};
  lu.startXI.forEach(({ player }) => {
    const [r, c] = String(player.grid || '1:1').split(':').map(Number);
    (rows[r] = rows[r] || []).push({ ...player, c });
  });
  const keys = Object.keys(rows).map(Number).sort((a, b) => a - b);
  return `<div class="pitch rm-pitch">
    <div class="pitch-lines"><i class="half"></i><i class="circle"></i><i class="box bottom"></i><i class="six bottom"></i><i class="box top"></i></div>
    ${keys.map((r, i) => {
      const ps = rows[r].sort((a, b) => a.c - b.c);
      const y = 90 - (i / Math.max(keys.length - 1, 1)) * 78;
      return ps.map((p, j) => `<a class="pp rm-pp" href="#/player/${p.id}" style="left:${((j + 1) / (ps.length + 1)) * 100}%;top:${y}%">
        <span class="pp-img">${img(playerPhoto(p.id), '', p.name)}${ratings[p.id] ? rating(ratings[p.id]) : ''}</span>
        <span class="pp-name"><i>${fa(p.number)}</i> ${esc(shortName(p.name))}</span></a>`).join('');
    }).join('')}
  </div>`;
}
