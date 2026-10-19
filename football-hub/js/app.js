// Hash router, sidebar, settings and auto-refresh.
const App = (() => {
  const routes = [
    [/^\/?$/, Views.home, 'home'],
    [/^\/leagues$/, Views.leagues, 'leagues'],
    [/^\/league\/(?<id>\d+)$/, Views.league, 'leagues'],
    [/^\/match\/(?<id>\d+)$/, Views.match, ''],
    [/^\/team\/(?<id>\d+)$/, Views.team, ''],
    [/^\/player\/(?<id>\d+)$/, Views.player, ''],
    [/^\/madrid$/, MadridViews.hub, 'madrid'],
    [/^\/search$/, Views.search, 'search'],
  ];
  const app = document.getElementById('app');
  let refreshTimer = null;

  function parse() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  async function render() {
    clearTimeout(refreshTimer);
    const { path, query } = parse();
    const match = routes.map(([re, view, nav]) => ({ m: path.match(re), view, nav })).find(r => r.m);
    document.body.classList.remove('madrid');
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', match && a.dataset.nav === match.nav));
    if (!match) { app.innerHTML = empty('صفحه پیدا نشد'); return; }
    app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
    await match.view(app, match.m.groups || {}, query);
    startCountdowns();
  }

  function autoRefresh(sec) {
    clearTimeout(refreshTimer);
    const hash = location.hash;
    refreshTimer = setTimeout(() => {
      if (location.hash !== hash || document.hidden) return autoRefresh(sec);
      const y = scrollY;
      render().then(() => scrollTo(0, y));
    }, sec * 1000);
  }

  function sidebar() {
    document.getElementById('sidebar').innerHTML = `
      <a class="side-madrid" href="#/madrid">${img(teamLogo(CONFIG.MADRID_ID), 'logo-md')}<span><b>رئال مادرید</b><small>هاب ویژه کهکشانی‌ها</small></span></a>
      <div class="side-title">رقابت‌های محبوب</div>
      ${CONFIG.LEAGUES.map(l => `<a class="side-link" href="#/league/${l.id}">${img(leagueLogo(l.id), 'logo-sm')}<span>${l.name}</span></a>`).join('')}`;
  }

  function settings() {
    const dlg = document.getElementById('settings');
    const sel = document.getElementById('setSeason');
    const cur = defaultSeason();
    for (let y = cur + 1; y >= cur - 6; y--) sel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}-${String(y + 1).slice(2)}</option>`);
    document.getElementById('settingsBtn').addEventListener('click', async () => {
      document.getElementById('setKey').value = Store.get('apiKey') || CONFIG.API_KEY;
      sel.value = API.season();
      const q = document.getElementById('quota');
      q.textContent = 'در حال بررسی سهمیه…';
      dlg.showModal();
      try {
        const s = await API.status();
        const r = s.response;
        q.innerHTML = r?.requests
          ? `پلن: <b>${esc(r.subscription?.plan)}</b> · درخواست امروز: <b>${fa(r.requests.current)}</b> از ${fa(r.requests.limit_day)}`
          : `<span dir="ltr">${esc(JSON.stringify(s.errors))}</span>`;
      } catch (e) { q.textContent = 'اتصال به API برقرار نشد: ' + e.message; }
    });
    document.getElementById('saveSettings').addEventListener('click', () => {
      const k = document.getElementById('setKey').value.trim();
      Store.set('apiKey', k && k !== CONFIG.API_KEY ? k : null);
      Store.set('season', Number(sel.value) === defaultSeason() ? null : Number(sel.value));
      render();
    });
    document.getElementById('clearCache').addEventListener('click', () => { API.clearCache(); dlg.close(); render(); });
  }

  sidebar();
  settings();
  if (!Store.get('apiKey') && !CONFIG.API_KEY) document.getElementById('settingsBtn').click();
  addEventListener('hashchange', () => { scrollTo(0, 0); render(); });
  render();
  return { autoRefresh, render };
})();
