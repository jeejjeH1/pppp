// Hash router, sidebar, settings and auto-refresh.
const App = (() => {
  const routes = [
    [/^\/?$/, Views.home, 'home'],
    [/^\/leagues$/, Views.leagues, 'leagues'],
    [/^\/league\/(?<id>[\w.]+)$/, Views.league, 'leagues'],
    [/^\/match\/(?<league>[\w.]+)\/(?<id>\d+)$/, Views.match, ''],
    [/^\/team\/(?<league>[\w.]+)\/(?<id>\d+)$/, Views.team, ''],
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
    document.getElementById('settingsBtn').addEventListener('click', async () => {
      const q = document.getElementById('quota');
      q.textContent = 'در حال بررسی اتصال به ESPN…';
      dlg.showModal();
      try {
        const t = performance.now();
        const live = await API.live(CONFIG.LEAGUES.map(l => l.id));
        q.innerHTML = `✅ اتصال برقرار است (${API.mode() === 'direct' ? 'مستقیم از مرورگر' : 'از طریق سرور واسط'}) · ${fa(live.length)} بازی زنده · ${fa(Math.round(performance.now() - t))} میلی‌ثانیه`;
      } catch (e) { q.innerHTML = `❌ اتصال برقرار نشد: <span dir="ltr">${esc(e.message)}</span>`; }
    });
    document.getElementById('clearCache').addEventListener('click', () => { API.clearCache(); try { sessionStorage.removeItem('gb:espn-mode'); } catch {} location.reload(); });
  }

  sidebar();
  settings();
  addEventListener('hashchange', () => { scrollTo(0, 0); render(); });
  render();
  return { autoRefresh, render };
})();
