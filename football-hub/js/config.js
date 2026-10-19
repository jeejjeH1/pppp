// API-Football v3 (api-sports.io). The key comes from js/config.local.js (git-ignored)
// or from the settings dialog, so it never ends up in the repository.
window.CONFIG = {
  API_KEY: window.LOCAL_API_KEY || '',
  BASE_URL: 'https://v3.football.api-sports.io',
  MADRID_ID: 541,
  LALIGA_ID: 140,
  // Popular competitions, shown first on the home page and in the sidebar.
  LEAGUES: [
    { id: 2, name: 'لیگ قهرمانان اروپا' },
    { id: 39, name: 'لیگ برتر انگلیس' },
    { id: 140, name: 'لالیگا' },
    { id: 135, name: 'سری آ' },
    { id: 78, name: 'بوندسلیگا' },
    { id: 61, name: 'لوشامپیونه' },
    { id: 3, name: 'لیگ اروپا' },
    { id: 848, name: 'لیگ کنفرانس' },
    { id: 143, name: 'کوپا دل ری' },
    { id: 556, name: 'سوپرکاپ اسپانیا' },
    { id: 1, name: 'جام جهانی' },
    { id: 4, name: 'یورو' },
    { id: 290, name: 'لیگ برتر ایران' },
    { id: 307, name: 'لیگ عربستان' },
  ],
};
