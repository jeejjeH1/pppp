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

  async function sidebar() {
    const bar = document.getElementById('sidebar');
    const head = `<a class="side-madrid" href="#/madrid">${img(teamLogo(CONFIG.MADRID_ID), 'logo-md')}<span><b>رئال مادرید</b><small>هاب ویژه کهکشانی‌ها</small></span></a>
      <div class="side-title">رقابت‌های پلن شما</div>`;
    bar.innerHTML = head + loader('');
    try {
      const list = sortLeagues(await API.leagues());
      bar.innerHTML = head + list.map(l => `<a class="side-link" href="#/league/${l.id}">${img(API.logoOf(l) || leagueLogo(l.id), 'logo-sm')}<span>${esc(leagueName(l.id, l.name))}</span></a>`).join('');
    } catch (e) {
      bar.innerHTML = head;
      // No token on the server and none saved here yet: ask for one.
      if (/HTTP 401/.test(e.message) && !Store.get('smToken')) document.getElementById('settingsBtn').click();
    }
  }

  function settings() {
    const dlg = document.getElementById('settings');
    const key = document.getElementById('setKey');
    document.getElementById('settingsBtn').addEventListener('click', async () => {
      key.value = Store.get('smToken') || '';
      const q = document.getElementById('quota');
      q.textContent = 'در حال بررسی اتصال به Sportmonks…';
      dlg.showModal();
      try {
        const t = performance.now();
        const ls = await API.leagues();
        q.innerHTML = `✅ اتصال برقرار است · ${fa(ls.length)} لیگ در پلن شما · ${fa(Math.round(performance.now() - t))} میلی‌ثانیه`;
      } catch (e) { q.innerHTML = `❌ اتصال برقرار نشد: <span dir="ltr">${esc(e.message)}</span>`; }
    });
    document.getElementById('saveSettings').addEventListener('click', () => {
      Store.set('smToken', key.value.trim() || null);
      API.clearCache();
      location.reload();
    });
    document.getElementById('clearCache').addEventListener('click', () => { API.clearCache(); location.reload(); });
  }

  sidebar();
  settings();
  addEventListener('hashchange', () => { scrollTo(0, 0); render(); });
  render();
  return { autoRefresh, render };
})();
