// Shared formatting helpers and small HTML components (ESPN data, normalised in api.js).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fa = (v) => String(v ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const num = (v, dflt = '-') => (v === null || v === undefined || v === '') ? dflt : fa(v);
const pct = (v) => (v === null || v === undefined || isNaN(parseFloat(v))) ? '-' : fa(Math.round(parseFloat(v))) + '٪';
const dec = (v, d = 2) => (v === null || v === undefined || isNaN(v)) ? '-' : fa(Number(v).toFixed(d));

const fmt = {
  time: (ts) => new Date(ts * 1000).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
  date: (ts) => new Date(ts * 1000).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' }),
  short: (ts) => new Date(ts * 1000).toLocaleDateString('fa-IR', { day: 'numeric', month: 'short' }),
  full: (ts) => new Date(ts * 1000).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  iso: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
};

// Events are normalised by API.normEvent: { id, league, ts, status:{state,detail,clock}, home, away, ... }.
const isLive = (e) => e.status.state === 'in';
const isDone = (e) => e.status.state === 'post';
const isUpcoming = (e) => e.status.state === 'pre';
const isOff = (e) => e.status.state === 'off';
const hasMadrid = (e) => e.home.id === CONFIG.MADRID_ID || e.away.id === CONFIG.MADRID_ID;

// Home goals sit on the right in RTL, next to the home team.
const scoreHtml = (h, a) => `<span class="sc"><i>${num(h)}</i><i>-</i><i>${num(a)}</i></span>`;
const scoreOf = (e) => scoreHtml(e.home.score, e.away.score);

const DETAIL_FA = { FT: 'پایان', HT: 'نیمه', 'AET': 'وقت اضافه', 'FT-Pens': 'پنالتی', Postponed: 'تعویق', Canceled: 'لغو', Abandoned: 'نیمه‌کاره', Suspended: 'توقف', 'Final': 'پایان', 'Halftime': 'نیمه' };
function statusLabel(e) {
  if (isLive(e)) {
    const d = e.status.detail;
    return `<span class="live-min">${DETAIL_FA[d] || fa(e.status.clock || d || 'زنده')}</span>`;
  }
  if (isUpcoming(e)) return fmt.time(e.ts);
  return DETAIL_FA[e.status.detail] || DETAIL_FA[e.status.desc] || (isDone(e) ? 'پایان' : esc(e.status.detail));
}

const POS_FA = { G: 'دروازه‌بان', GK: 'دروازه‌بان', D: 'مدافع', M: 'هافبک', F: 'مهاجم', Goalkeeper: 'دروازه‌بان', Defender: 'مدافع', Midfielder: 'هافبک', Forward: 'مهاجم',
  'Center Back': 'مدافع میانی', 'Left Back': 'دفاع چپ', 'Right Back': 'دفاع راست', 'Defensive Midfielder': 'هافبک دفاعی', 'Attacking Midfielder': 'هافبک هجومی',
  'Center Forward': 'مهاجم نوک', 'Left Wing': 'وینگر چپ', 'Right Wing': 'وینگر راست', 'Center Midfielder': 'هافبک میانی', Striker: 'مهاجم' };
const posFa = (p) => POS_FA[p?.displayName] || POS_FA[p?.name] || POS_FA[p?.abbreviation] || esc(p?.displayName || p?.name || p?.abbreviation || '');

// ESPN team statistic names → Persian labels (unknown names fall back to ESPN's own label).
const STAT_FA = {
  possessionPct: 'مالکیت توپ', totalShots: 'کل شوت‌ها', shotsOnTarget: 'شوت در چارچوب', shotPct: 'دقت شوت', wonCorners: 'کرنر', foulsCommitted: 'خطا',
  offsides: 'آفساید', yellowCards: 'کارت زرد', redCards: 'کارت قرمز', saves: 'سیو', totalPasses: 'کل پاس‌ها', accuratePasses: 'پاس دقیق', passPct: 'دقت پاس',
  totalCrosses: 'سانتر', accurateCrosses: 'سانتر دقیق', crossPct: 'دقت سانتر', totalLongBalls: 'پاس بلند', accurateLongBalls: 'پاس بلند دقیق', longballPct: 'دقت پاس بلند',
  blockedShots: 'شوت مهارشده', effectiveTackles: 'تکل موفق', totalTackles: 'تکل', tacklePct: 'درصد تکل موفق', interceptions: 'توپ‌ربایی',
  effectiveClearance: 'دفع موفق', totalClearance: 'دفع توپ', penaltyKickGoals: 'گل پنالتی', penaltyKickShots: 'پنالتی', expectedGoals: 'گل مورد انتظار (xG)',
  goalAssists: 'پاس گل', totalGoals: 'گل', goalsConceded: 'گل خورده', shotsFaced: 'شوت دریافتی', foulsSuffered: 'خطا روی بازیکن',
  appearances: 'بازی', subIns: 'تعویضی', ownGoals: 'گل به خودی', cleanSheet: 'کلین‌شیت', minutes: 'دقیقه',
};
const statLabel = (s) => STAT_FA[s.name] || esc(s.label || s.displayName || s.shortDisplayName || s.name);

const img = (src, cls = '', alt = '') => src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="${cls} img-ph"></span>`;
const teamLogo = (id) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;
const playerPhoto = (id) => `https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`;
// ESPN league logos are keyed by numeric league id.
const LEAGUE_NUM = { 'esp.1': 15, 'eng.1': 23, 'ita.1': 12, 'ger.1': 10, 'fra.1': 9, 'uefa.champions': 2, 'uefa.europa': 2310, 'uefa.europa.conf': 20296,
  'esp.copa_del_rey': 80, 'por.1': 14, 'ned.1': 11, 'fifa.world': 4, 'uefa.euro': 74, 'eng.fa': 40, 'uefa.nations': 2395, 'esp.super_cup': 431, 'ksa.1': 2488, 'fifa.cwc': 1932 };
const leagueLogo = (slug) => LEAGUE_NUM[slug] ? `https://a.espncdn.com/i/leaguelogos/soccer/500/${LEAGUE_NUM[slug]}.png` : '';
const leagueName = (slug, fallback = '') => CONFIG.LEAGUES.find(l => l.id === slug)?.name || fallback || slug;

function ratingClass(r) {
  r = parseFloat(r);
  if (!r) return 'r-na';
  if (r >= 8) return 'r-top';
  if (r >= 7) return 'r-good';
  if (r >= 6) return 'r-ok';
  return 'r-bad';
}
const rating = (r) => r ? `<span class="rating ${ratingClass(r)}">${fa(parseFloat(r).toFixed(1))}</span>` : '';

function formChips(form, max = 5) {
  if (!form) return '';
  const arr = Array.isArray(form) ? form : String(form).split('');
  const map = { W: ['win', 'ب'], D: ['draw', 'م'], T: ['draw', 'م'], L: ['loss', 'ش'] };
  return `<span class="form">${arr.slice(-max).map(c => map[c] ? `<i class="fc ${map[c][0]}">${map[c][1]}</i>` : '').join('')}</span>`;
}

const sideOf = (e, teamId) => e.home.id === String(teamId) ? 'home' : 'away';
const goalsFor = (e, teamId) => Number(e[sideOf(e, teamId)].score);
const goalsAgainst = (e, teamId) => Number(e[sideOf(e, teamId) === 'home' ? 'away' : 'home'].score);
function resultFor(e, teamId) {
  const gf = goalsFor(e, teamId), ga = goalsAgainst(e, teamId);
  if (isNaN(gf) || isNaN(ga)) return '';
  const me = e[sideOf(e, teamId)], them = e[sideOf(e, teamId) === 'home' ? 'away' : 'home'];
  if (gf === ga) return me.winner ? 'W' : them.winner ? 'L' : 'D';
  return gf > ga ? 'W' : 'L';
}
const opponentOf = (e, teamId) => e.home.id === String(teamId) ? e.away : e.home;

const matchHref = (e) => `#/match/${e.league}/${e.id}`;
const teamHref = (league, id) => `#/team/${league || CONFIG.LALIGA}/${id}`;

function matchRow(e) {
  const h = e.home, a = e.away;
  const score = isUpcoming(e) || isOff(e)
    ? `<span class="score vs">${statusLabel(e)}</span>`
    : `<span class="score ${isLive(e) ? 'is-live' : ''}">${scoreOf(e)}</span>`;
  return `<a class="match-row ${hasMadrid(e) ? 'is-madrid' : ''} ${isLive(e) ? 'live' : ''}" href="${matchHref(e)}">
    <span class="mr-status">${isUpcoming(e) ? fmt.short(e.ts) : statusLabel(e)}</span>
    <span class="mr-team home ${h.winner ? 'win' : ''}"><span class="tn">${esc(h.short || h.name)}</span>${img(h.logo || teamLogo(h.id), 'logo-sm')}</span>
    ${score}
    <span class="mr-team away ${a.winner ? 'win' : ''}">${img(a.logo || teamLogo(a.id), 'logo-sm')}<span class="tn">${esc(a.short || a.name)}</span></span>
  </a>`;
}

function leagueGroup(slug, name, logo, list) {
  return `<section class="card league-group">
    <a class="lg-head" href="#/league/${slug}">${img(logo || leagueLogo(slug), 'logo-sm')}<span><b>${esc(leagueName(slug, name))}</b><small>${esc(name)}</small></span><span class="chev">‹</span></a>
    ${list.map(matchRow).join('')}
  </section>`;
}

const loader = (msg = 'در حال بارگذاری…') => `<div class="loader"><div class="ball-spin">⚽</div><span>${msg}</span></div>`;
const empty = (msg) => `<div class="empty">${msg}</div>`;

function errorBox(err) {
  const m = String(err?.message || err);
  let hint = '';
  if (/HTTP 5\d\d/.test(m)) hint = 'سرور واسط به ESPN نرسید. چند لحظه بعد صفحه را دوباره باز کنید.';
  else if (/Failed to fetch|NetworkError|Unexpected token/i.test(m)) hint = 'سایت را با node server.js یا روی Vercel اجرا کنید؛ باز کردن مستقیم فایل HTML کار نمی‌کند.';
  return `<div class="error-box"><b>خطا در دریافت داده</b><code dir="ltr">${esc(m)}</code>${hint ? `<p>${hint}</p>` : ''}</div>`;
}

function tabs(id, items, active) {
  return `<div class="tabs" data-tabs="${id}">${items.map(([k, label]) => `<button class="tab ${k === active ? 'active' : ''}" data-tab="${k}">${label}</button>`).join('')}</div>`;
}

// Bind a tab bar to lazy renderers; each tab renders into `target`.
function bindTabs(root, id, target, renderers, active) {
  const bar = root.querySelector(`[data-tabs="${id}"]`);
  const host = root.querySelector(target);
  const show = async (k) => {
    bar.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === k));
    host.innerHTML = loader();
    try { host.innerHTML = await renderers[k]() || empty('داده‌ای موجود نیست'); }
    catch (e) { host.innerHTML = errorBox(e); }
    startCountdowns();
  };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) { show(b.dataset.tab); history.replaceState(null, '', location.hash.split('?')[0] + '?tab=' + b.dataset.tab); }
  });
  show(active);
}

function statCompare(label, h, a, hv, av) {
  hv = hv ?? (parseFloat(String(h ?? 0)) || 0);
  av = av ?? (parseFloat(String(a ?? 0)) || 0);
  const tot = hv + av || 1;
  return `<div class="stat-cmp">
    <div class="sc-vals"><b class="${hv > av ? 'lead' : ''}">${fa(h ?? 0)}</b><span>${label}</span><b class="${av > hv ? 'lead' : ''}">${fa(a ?? 0)}</b></div>
    <div class="sc-bars"><div class="sc-bar home"><i style="width:${hv / tot * 100}%"></i></div><div class="sc-bar away"><i style="width:${av / tot * 100}%"></i></div></div>
  </div>`;
}

const statTile = (value, label, sub = '') => `<div class="stat-tile"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;

// ESPN rosters: starters carry formationPlace 1..11 (1 = keeper) in formation-line order.
function formationRows(side) {
  const xi = (side.roster || []).filter(p => p.starter).sort((a, b) => Number(a.formationPlace || 99) - Number(b.formationPlace || 99));
  const lines = String(side.formation || '4-4-2').split('-').map(Number).filter(Boolean);
  const rows = [xi.slice(0, 1)];
  let i = 1;
  lines.forEach(n => { rows.push(xi.slice(i, i + n)); i += n; });
  if (i < xi.length) rows[rows.length - 1].push(...xi.slice(i));
  return rows.filter(r => r.length);
}

const statOf = (p, ...names) => { for (const n of names) { const s = (p.stats || []).find(x => x.name === n || x.abbreviation === n); if (s) return Number(s.value ?? s.displayValue) || 0; } return 0; };

function pitchPlayer(p, x, y, cls) {
  const a = p.athlete || {};
  const g = statOf(p, 'totalGoals'), yc = statOf(p, 'yellowCards'), rc = statOf(p, 'redCards');
  const marks = `${'⚽'.repeat(Math.min(g, 3))}${yc ? '🟨' : ''}${rc ? '🟥' : ''}${p.subbedOut ? '🔻' : ''}`;
  return `<a class="pp ${cls}" href="#/player/${a.id}" style="left:${x}%;top:${y}%">
    <span class="pp-img">${img(a.headshot?.href || playerPhoto(a.id), '', a.displayName)}${marks ? `<span class="pp-marks">${marks}</span>` : ''}</span>
    <span class="pp-name"><i>${fa(p.jersey ?? '')}</i> ${esc(shortName(a.shortName || a.displayName))}</span>
  </a>`;
}

// Both lineups on one vertical pitch: home attacks upward, away downward.
function pitch(home, away) {
  if (!home?.roster?.some(p => p.starter)) return '';
  const side = (s, isHome) => {
    const rows = formationRows(s), n = rows.length;
    return rows.map((ps, i) => {
      const y = isHome ? 94 - (i / Math.max(n - 1, 1)) * 36 : 6 + (i / Math.max(n - 1, 1)) * 36;
      return ps.map((p, j) => {
        let x = ((j + 1) / (ps.length + 1)) * 100;
        if (!isHome) x = 100 - x;
        return pitchPlayer(p, x, y, isHome ? 'home' : 'away');
      }).join('');
    }).join('');
  };
  return `<div class="pitch-wrap">
    <div class="pitch-label top">${img(API.logoOf(away.team) || teamLogo(away.team.id), 'logo-sm')} ${esc(away.team.displayName)} <b dir="ltr">${esc(away.formation || '')}</b></div>
    <div class="pitch">
      <div class="pitch-lines"><i class="half"></i><i class="circle"></i><i class="box top"></i><i class="box bottom"></i><i class="six top"></i><i class="six bottom"></i></div>
      ${side(away, false)}${side(home, true)}
    </div>
    <div class="pitch-label bottom">${img(API.logoOf(home.team) || teamLogo(home.team.id), 'logo-sm')} ${esc(home.team.displayName)} <b dir="ltr">${esc(home.formation || '')}</b></div>
  </div>`;
}

function shortName(n) {
  n = String(n || '');
  const parts = n.split(' ');
  return parts.length > 1 ? parts.slice(-1)[0] : n;
}

function countdown(ts) {
  return `<div class="countdown" data-ts="${ts}">
    <div><b data-u="d">-</b><span>روز</span></div><div><b data-u="h">-</b><span>ساعت</span></div>
    <div><b data-u="m">-</b><span>دقیقه</span></div><div><b data-u="s">-</b><span>ثانیه</span></div>
  </div>`;
}

let cdTimer = null;
function startCountdowns() {
  clearInterval(cdTimer);
  const tick = () => document.querySelectorAll('.countdown').forEach(el => {
    const d = Math.max(0, Number(el.dataset.ts) * 1000 - Date.now()) / 1000;
    const u = { d: Math.floor(d / 86400), h: Math.floor(d % 86400 / 3600), m: Math.floor(d % 3600 / 60), s: Math.floor(d % 60) };
    Object.entries(u).forEach(([k, v]) => { const b = el.querySelector(`[data-u="${k}"]`); if (b) b.textContent = fa(String(v).padStart(2, '0')); });
  });
  tick();
  cdTimer = setInterval(tick, 1000);
}
