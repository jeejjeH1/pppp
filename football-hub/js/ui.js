// Shared formatting helpers and small HTML components.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fa = (v) => String(v ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const num = (v, dflt = '-') => (v === null || v === undefined || v === '') ? dflt : fa(v);
const pct = (v) => (v === null || v === undefined) ? '-' : fa(Math.round(parseFloat(v))) + '٪';

const fmt = {
  time: (ts) => new Date(ts * 1000).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
  date: (ts) => new Date(ts * 1000).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' }),
  short: (ts) => new Date(ts * 1000).toLocaleDateString('fa-IR', { day: 'numeric', month: 'short' }),
  full: (ts) => new Date(ts * 1000).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  iso: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
};

// Home goals sit on the right in RTL, next to the home team.
const scoreHtml = (h, a) => `<span class="sc"><i>${num(h)}</i><i>-</i><i>${num(a)}</i></span>`;

const STATUS = {
  live: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'],
  done: ['FT', 'AET', 'PEN', 'AWD', 'WO'],
  off: ['PST', 'CANC', 'ABD', 'SUSP'],
};
const isLive = (f) => STATUS.live.includes(f.fixture.status.short);
const isDone = (f) => STATUS.done.includes(f.fixture.status.short);
const isUpcoming = (f) => ['NS', 'TBD'].includes(f.fixture.status.short);
const hasMadrid = (f) => f.teams.home.id === CONFIG.MADRID_ID || f.teams.away.id === CONFIG.MADRID_ID;

const STATUS_FA = { HT: 'نیمه', FT: 'پایان', AET: 'وقت اضافه', PEN: 'پنالتی', PST: 'تعویق', CANC: 'لغو', ABD: 'نیمه‌کاره', SUSP: 'توقف', BT: 'استراحت', P: 'پنالتی', INT: 'وقفه', TBD: 'نامشخص', AWD: 'رأی کمیته', WO: 'واگذار' };

function statusLabel(f) {
  const s = f.fixture.status;
  if (isLive(f) && s.short !== 'HT' && s.elapsed != null) return `<span class="live-min">${fa(s.elapsed)}${s.extra ? '+' + fa(s.extra) : ''}'</span>`;
  if (isUpcoming(f)) return fa(fmt.time(f.fixture.timestamp));
  return STATUS_FA[s.short] || esc(s.short);
}

const POS_FA = { Goalkeeper: 'دروازه‌بان', Defender: 'مدافع', Midfielder: 'هافبک', Attacker: 'مهاجم', G: 'دروازه‌بان', D: 'مدافع', M: 'هافبک', F: 'مهاجم' };

const STAT_FA = {
  'Shots on Goal': 'شوت در چارچوب', 'Shots off Goal': 'شوت خارج چارچوب', 'Total Shots': 'کل شوت‌ها', 'Blocked Shots': 'شوت مهارشده',
  'Shots insidebox': 'شوت از داخل محوطه', 'Shots outsidebox': 'شوت از بیرون محوطه', 'Fouls': 'خطا', 'Corner Kicks': 'کرنر',
  'Offsides': 'آفساید', 'Ball Possession': 'مالکیت توپ', 'Yellow Cards': 'کارت زرد', 'Red Cards': 'کارت قرمز',
  'Goalkeeper Saves': 'سیو دروازه‌بان', 'Total passes': 'کل پاس‌ها', 'Passes accurate': 'پاس دقیق', 'Passes %': 'دقت پاس',
  'expected_goals': 'گل مورد انتظار (xG)', 'goals_prevented': 'گل جلوگیری‌شده',
};
const STAT_ORDER = ['Ball Possession', 'expected_goals', 'Total Shots', 'Shots on Goal', 'Shots off Goal', 'Blocked Shots', 'Shots insidebox', 'Shots outsidebox', 'Corner Kicks', 'Offsides', 'Fouls', 'Yellow Cards', 'Red Cards', 'Goalkeeper Saves', 'Total passes', 'Passes accurate', 'Passes %', 'goals_prevented'];

const img = (src, cls = '', alt = '') => src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="${cls} img-ph"></span>`;
const teamLogo = (id) => `https://media.api-sports.io/football/teams/${id}.png`;
const playerPhoto = (id) => `https://media.api-sports.io/football/players/${id}.png`;

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
  const map = { W: ['win', 'ب'], D: ['draw', 'م'], L: ['loss', 'ش'] };
  return `<span class="form">${form.slice(-max).split('').map(c => map[c] ? `<i class="fc ${map[c][0]}">${map[c][1]}</i>` : '').join('')}</span>`;
}

function resultFor(f, teamId) {
  const home = f.teams.home.id === teamId;
  const gf = home ? f.goals.home : f.goals.away, ga = home ? f.goals.away : f.goals.home;
  return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
}

function matchRow(f) {
  const { home, away } = f.teams;
  const score = isUpcoming(f) || STATUS.off.includes(f.fixture.status.short)
    ? `<span class="score vs">${statusLabel(f)}</span>`
    : `<span class="score ${isLive(f) ? 'is-live' : ''}">${scoreHtml(f.goals.home, f.goals.away)}</span>`;
  return `<a class="match-row ${hasMadrid(f) ? 'is-madrid' : ''} ${isLive(f) ? 'live' : ''}" href="#/match/${f.fixture.id}">
    <span class="mr-status">${isUpcoming(f) ? fmt.short(f.fixture.timestamp) : statusLabel(f)}</span>
    <span class="mr-team home ${home.winner ? 'win' : ''}"><span class="tn">${esc(home.name)}</span>${img(home.logo, 'logo-sm')}</span>
    ${score}
    <span class="mr-team away ${away.winner ? 'win' : ''}">${img(away.logo, 'logo-sm')}<span class="tn">${esc(away.name)}</span></span>
  </a>`;
}

function leagueGroup(league, fixtures, open = true) {
  return `<section class="card league-group">
    <a class="lg-head" href="#/league/${league.id}">
      ${img(league.flag || league.logo, 'flag')}${img(league.logo, 'logo-sm')}
      <span><b>${esc(league.name)}</b><small>${esc(league.country || '')}</small></span>
      <span class="chev">‹</span>
    </a>
    ${open ? fixtures.map(matchRow).join('') : ''}
  </section>`;
}

const loader = (msg = 'در حال بارگذاری…') => `<div class="loader"><div class="ball-spin">⚽</div><span>${msg}</span></div>`;
const empty = (msg) => `<div class="empty">${msg}</div>`;

function errorBox(err) {
  const m = String(err?.message || err);
  let hint = '';
  if (/season|plan|subscription/i.test(m)) hint = 'ممکن است پلن رایگان به این فصل دسترسی نداشته باشد — از ⚙ تنظیمات فصل دیگری انتخاب کنید.';
  else if (/token|key|access/i.test(m)) hint = 'کلید API را در ⚙ تنظیمات بررسی کنید.';
  else if (/request|limit/i.test(m)) hint = 'سقف درخواست روزانه پر شده است؛ داده‌های کش‌شده همچنان نمایش داده می‌شوند.';
  else if (/Failed to fetch|NetworkError/i.test(m)) hint = 'اتصال به api-sports.io برقرار نشد. اینترنت/فیلترشکن را بررسی کنید.';
  return `<div class="error-box"><b>خطا در دریافت داده</b><code dir="ltr">${esc(m)}</code>${hint ? `<p>${hint}</p>` : ''}</div>`;
}

function tabs(id, items, active) {
  return `<div class="tabs" data-tabs="${id}">${items.map(([k, label]) => `<button class="tab ${k === active ? 'active' : ''}" data-tab="${k}">${label}</button>`).join('')}</div>`;
}

// Bind a tab bar to a render callback. Each tab renders lazily into `target`.
function bindTabs(root, id, target, renderers, active) {
  const bar = root.querySelector(`[data-tabs="${id}"]`);
  const host = root.querySelector(target);
  const show = async (k) => {
    bar.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === k));
    host.innerHTML = loader();
    try { host.innerHTML = await renderers[k]() || empty('داده‌ای موجود نیست'); }
    catch (e) { host.innerHTML = errorBox(e); }
    host.dispatchEvent(new CustomEvent('rendered', { bubbles: true }));
  };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) { show(b.dataset.tab); history.replaceState(null, '', location.hash.split('?')[0] + '?tab=' + b.dataset.tab); }
  });
  show(active);
}

function statCompare(label, h, a, isPct = false) {
  const pv = (v) => parseFloat(String(v ?? 0).replace('%', '')) || 0;
  const hv = pv(h), av = pv(a), tot = hv + av || 1;
  const show = (v) => v === null || v === undefined ? '۰' : isPct || String(v).includes('%') ? pct(v) : fa(v);
  return `<div class="stat-cmp">
    <div class="sc-vals"><b class="${hv > av ? 'lead' : ''}">${show(h)}</b><span>${label}</span><b class="${av > hv ? 'lead' : ''}">${show(a)}</b></div>
    <div class="sc-bars"><div class="sc-bar home"><i style="width:${hv / tot * 100}%"></i></div><div class="sc-bar away"><i style="width:${av / tot * 100}%"></i></div></div>
  </div>`;
}

function statTile(value, label, sub = '') {
  return `<div class="stat-tile"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

// Draws both lineups on one vertical pitch using the API's "row:col" grid positions.
function pitch(lineups, ratings = {}) {
  if (!lineups || lineups.length < 2 || !lineups[0].startXI?.length) return '';
  const side = (lu, isHome) => {
    const rows = {};
    lu.startXI.forEach(({ player }) => {
      const [r, c] = String(player.grid || '1:1').split(':').map(Number);
      (rows[r] = rows[r] || []).push({ ...player, c });
    });
    const rowKeys = Object.keys(rows).map(Number).sort((a, b) => a - b);
    const n = rowKeys.length;
    return rowKeys.map((r, i) => {
      const ps = rows[r].sort((a, b) => a.c - b.c);
      // Home attacks upward (from the bottom), away attacks downward.
      const y = isHome ? 94 - (i / Math.max(n - 1, 1)) * 36 : 6 + (i / Math.max(n - 1, 1)) * 36;
      return ps.map((p, j) => {
        let x = ((j + 1) / (ps.length + 1)) * 100;
        if (!isHome) x = 100 - x;
        const rt = ratings[p.id];
        return `<a class="pp ${isHome ? 'home' : 'away'}" href="#/player/${p.id}" style="left:${x}%;top:${y}%">
          <span class="pp-img">${img(playerPhoto(p.id), '', p.name)}${rt ? rating(rt) : ''}</span>
          <span class="pp-name"><i>${fa(p.number)}</i> ${esc(shortName(p.name))}</span>
        </a>`;
      }).join('');
    }).join('');
  };
  const [h, a] = lineups;
  return `<div class="pitch-wrap">
    <div class="pitch-label top">${img(a.team.logo, 'logo-sm')} ${esc(a.team.name)} <b dir="ltr">${esc(a.formation || '')}</b></div>
    <div class="pitch">
      <div class="pitch-lines"><i class="half"></i><i class="circle"></i><i class="box top"></i><i class="box bottom"></i><i class="six top"></i><i class="six bottom"></i></div>
      ${side(a, false)}${side(h, true)}
    </div>
    <div class="pitch-label bottom">${img(h.team.logo, 'logo-sm')} ${esc(h.team.name)} <b dir="ltr">${esc(h.formation || '')}</b></div>
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
    let d = Math.max(0, Number(el.dataset.ts) * 1000 - Date.now()) / 1000;
    const u = { d: Math.floor(d / 86400), h: Math.floor(d % 86400 / 3600), m: Math.floor(d % 3600 / 60), s: Math.floor(d % 60) };
    Object.entries(u).forEach(([k, v]) => { const b = el.querySelector(`[data-u="${k}"]`); if (b) b.textContent = fa(String(v).padStart(2, '0')); });
  });
  tick();
  cdTimer = setInterval(tick, 1000);
}
