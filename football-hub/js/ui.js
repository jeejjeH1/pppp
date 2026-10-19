// Shared formatting helpers and small HTML components (SofaScore data shapes).
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

const RM_ID = () => CONFIG.MADRID_ID;
const isLive = (e) => e.status?.type === 'inprogress';
const isDone = (e) => e.status?.type === 'finished';
const isUpcoming = (e) => e.status?.type === 'notstarted';
const isOff = (e) => ['postponed', 'canceled', 'interrupted', 'suspended'].includes(e.status?.type);
const hasMadrid = (e) => e.homeTeam?.id === RM_ID() || e.awayTeam?.id === RM_ID();
const tourId = (e) => e.tournament?.uniqueTournament?.id || e.tournament?.id;
const tourName = (e) => e.tournament?.uniqueTournament?.name || e.tournament?.name || '';

// Home goals sit on the right in RTL, next to the home team.
const scoreHtml = (h, a) => `<span class="sc"><i>${num(h)}</i><i>-</i><i>${num(a)}</i></span>`;
const scoreOf = (e) => scoreHtml(e.homeScore?.current ?? e.homeScore?.display, e.awayScore?.current ?? e.awayScore?.display);

function liveMinute(e) {
  const code = e.status?.code;
  if (code === 31) return 'نیمه';
  if (code === 32 || code === 33) return 'استراحت';
  if (code === 34) return 'پنالتی';
  const start = e.time?.currentPeriodStartTimestamp;
  if (!start) return 'زنده';
  const base = { 6: 0, 7: 45, 41: 90, 42: 105 }[code] ?? 0;
  const cap = { 6: 45, 7: 90, 41: 105, 42: 120 }[code] ?? 999;
  const m = Math.floor((Date.now() / 1000 - start) / 60) + 1 + base;
  return m > cap ? `${fa(cap)}+'` : `${fa(m)}'`;
}

const STATUS_FA = { finished: 'پایان', postponed: 'تعویق', canceled: 'لغو', interrupted: 'متوقف', suspended: 'توقف' };
function statusLabel(e) {
  if (isLive(e)) return `<span class="live-min">${liveMinute(e)}</span>`;
  if (isUpcoming(e)) return fmt.time(e.startTimestamp);
  if (isDone(e)) return { AET: 'وقت اضافه', AP: 'پنالتی' }[e.status.description] || (e.status.code === 110 ? 'وقت اضافه' : e.status.code === 120 ? 'پنالتی' : 'پایان');
  return STATUS_FA[e.status?.type] || esc(e.status?.description || '');
}

const POS_FA = { G: 'دروازه‌بان', D: 'مدافع', M: 'هافبک', F: 'مهاجم', Goalkeeper: 'دروازه‌بان', Defender: 'مدافع', Midfielder: 'هافبک', Forward: 'مهاجم' };

const STAT_FA = {
  'Ball possession': 'مالکیت توپ', 'Expected goals': 'گل مورد انتظار (xG)', 'Big chances': 'موقعیت خطرناک', 'Total shots': 'کل شوت‌ها',
  'Shots on target': 'شوت در چارچوب', 'Shots off target': 'شوت خارج چارچوب', 'Blocked shots': 'شوت مهارشده', 'Corner kicks': 'کرنر',
  'Fouls': 'خطا', 'Offsides': 'آفساید', 'Yellow cards': 'کارت زرد', 'Red cards': 'کارت قرمز', 'Goalkeeper saves': 'سیو دروازه‌بان',
  'Passes': 'پاس‌ها', 'Accurate passes': 'پاس دقیق', 'Tackles': 'تکل', 'Free kicks': 'ضربه آزاد', 'Throw-ins': 'پرتاب اوت',
  'Shots inside box': 'شوت از داخل محوطه', 'Shots outside box': 'شوت از بیرون محوطه', 'Hit woodwork': 'برخورد به تیرک',
  'Big chances scored': 'موقعیت گل‌شده', 'Big chances missed': 'موقعیت از دست‌رفته', 'Through balls': 'پاس در عمق', 'Touches in penalty area': 'لمس در محوطه',
  'Long balls': 'پاس بلند', 'Crosses': 'سانتر', 'Dribbles': 'دریبل', 'Duels': 'دوئل', 'Ground duels': 'دوئل زمینی', 'Aerial duels': 'دوئل هوایی',
  'Interceptions': 'توپ‌ربایی', 'Clearances': 'دفع توپ', 'Recoveries': 'بازپس‌گیری', 'Errors lead to a shot': 'خطای منجر به شوت',
  'Final third entries': 'ورود به یک‌سوم پایانی', 'Fouled in final third': 'خطا روی بازیکن در یک‌سوم پایانی', 'Dispossessed': 'از دست دادن توپ',
  'Total saves': 'کل سیوها', 'Goals prevented': 'گل جلوگیری‌شده', 'Goal kicks': 'ضربه دروازه', 'High claims': 'گرفتن توپ هوایی', 'Punches': 'مشت‌زدن',
  'Expected assists': 'پاس گل مورد انتظار', 'Penalty saves': 'مهار پنالتی', 'Errors lead to a goal': 'خطای منجر به گل',
};
const GROUP_FA = { 'Match overview': 'نمای کلی', Shots: 'شوت‌ها', Attack: 'حمله', Passes: 'پاس‌ها', Duels: 'دوئل‌ها', Defending: 'دفاع', Goalkeeping: 'دروازه‌بانی' };

const img = (src, cls = '', alt = '') => src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="${cls} img-ph"></span>`;
const teamLogo = (id) => API.image('team', id);
const playerPhoto = (id) => API.image('player', id);
const leagueLogo = (id) => API.image('unique-tournament', id);

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
  const map = { W: ['win', 'ب'], D: ['draw', 'م'], L: ['loss', 'ش'] };
  return `<span class="form">${arr.slice(-max).map(c => map[c] ? `<i class="fc ${map[c][0]}">${map[c][1]}</i>` : '').join('')}</span>`;
}

function resultFor(e, teamId) {
  if (e.winnerCode === 3) return 'D';
  const home = e.homeTeam.id === teamId;
  if (e.winnerCode === 1) return home ? 'W' : 'L';
  if (e.winnerCode === 2) return home ? 'L' : 'W';
  const h = e.homeScore?.current, a = e.awayScore?.current;
  if (h == null || a == null) return '';
  return h === a ? 'D' : (h > a) === home ? 'W' : 'L';
}
const goalsFor = (e, teamId) => e.homeTeam.id === teamId ? e.homeScore?.current : e.awayScore?.current;
const goalsAgainst = (e, teamId) => e.homeTeam.id === teamId ? e.awayScore?.current : e.homeScore?.current;

function matchRow(e) {
  const h = e.homeTeam, a = e.awayTeam;
  const score = isUpcoming(e) || isOff(e)
    ? `<span class="score vs">${statusLabel(e)}</span>`
    : `<span class="score ${isLive(e) ? 'is-live' : ''}">${scoreOf(e)}</span>`;
  return `<a class="match-row ${hasMadrid(e) ? 'is-madrid' : ''} ${isLive(e) ? 'live' : ''}" href="#/match/${e.id}">
    <span class="mr-status">${isUpcoming(e) ? fmt.short(e.startTimestamp) : statusLabel(e)}</span>
    <span class="mr-team home ${e.winnerCode === 1 ? 'win' : ''}"><span class="tn">${esc(h.shortName || h.name)}</span>${img(teamLogo(h.id), 'logo-sm')}</span>
    ${score}
    <span class="mr-team away ${e.winnerCode === 2 ? 'win' : ''}">${img(teamLogo(a.id), 'logo-sm')}<span class="tn">${esc(a.shortName || a.name)}</span></span>
  </a>`;
}

function leagueGroup(t, list) {
  const uid = t.uniqueTournament?.id;
  const head = `${img(uid ? leagueLogo(uid) : '', 'logo-sm')}<span><b>${esc(t.uniqueTournament?.name || t.name)}</b><small>${esc(t.category?.name || '')}</small></span><span class="chev">‹</span>`;
  return `<section class="card league-group">
    ${uid ? `<a class="lg-head" href="#/league/${uid}">${head}</a>` : `<div class="lg-head">${head}</div>`}
    ${list.map(matchRow).join('')}
  </section>`;
}

const loader = (msg = 'در حال بارگذاری…') => `<div class="loader"><div class="ball-spin">⚽</div><span>${msg}</span></div>`;
const empty = (msg) => `<div class="empty">${msg}</div>`;

function errorBox(err) {
  const m = String(err?.message || err);
  let hint = '';
  if (/HTTP 403/.test(m)) hint = 'SofaScore درخواست را مسدود کرد. چند دقیقه بعد دوباره امتحان کنید.';
  else if (/HTTP 5\d\d/.test(m)) hint = 'سرور واسط به SofaScore نرسید. صفحه را دوباره باز کنید.';
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

// Split SofaScore's starting XI (GK first, then lines in formation order) into rows.
function formationRows(lu) {
  const xi = lu.players.filter(p => !p.substitute);
  const lines = String(lu.formation || '4-4-2').split('-').map(Number).filter(Boolean);
  const rows = [xi.slice(0, 1)];
  let i = 1;
  lines.forEach(n => { rows.push(xi.slice(i, i + n)); i += n; });
  if (i < xi.length) rows[rows.length - 1].push(...xi.slice(i));
  return rows.filter(r => r.length);
}

function pitchPlayer(p, x, y, cls) {
  const r = p.statistics?.rating;
  return `<a class="pp ${cls}" href="#/player/${p.player.id}" style="left:${x}%;top:${y}%">
    <span class="pp-img">${img(playerPhoto(p.player.id), '', p.player.name)}${r ? rating(r) : ''}</span>
    <span class="pp-name"><i>${fa(p.shirtNumber ?? p.jerseyNumber ?? '')}</i> ${esc(p.player.shortName ? shortName(p.player.shortName) : shortName(p.player.name))}</span>
  </a>`;
}

// Both lineups on one vertical pitch: home attacks upward, away downward.
function pitch(lineups, home, away) {
  if (!lineups?.home?.players?.length) return '';
  const side = (lu, isHome) => {
    const rows = formationRows(lu), n = rows.length;
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
    <div class="pitch-label top">${img(teamLogo(away.id), 'logo-sm')} ${esc(away.name)} <b dir="ltr">${esc(lineups.away.formation || '')}</b></div>
    <div class="pitch">
      <div class="pitch-lines"><i class="half"></i><i class="circle"></i><i class="box top"></i><i class="box bottom"></i><i class="six top"></i><i class="six bottom"></i></div>
      ${side(lineups.away, false)}${side(lineups.home, true)}
    </div>
    <div class="pitch-label bottom">${img(teamLogo(home.id), 'logo-sm')} ${esc(home.name)} <b dir="ltr">${esc(lineups.home.formation || '')}</b></div>
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
