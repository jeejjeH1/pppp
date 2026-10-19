// Data comes from ESPN's public API (no key). The /api/espn proxy is only a fallback.
window.CONFIG = {
  PROXY: '/api/espn?url=',
  MADRID_ID: '86',
  LALIGA: 'esp.1',
  // Competitions Madrid plays in, merged for its full-season schedule.
  MADRID_LEAGUES: ['esp.1', 'uefa.champions', 'esp.copa_del_rey', 'esp.super_cup', 'fifa.cwc'],
  // ESPN league slugs, shown first on the home page and in the sidebar.
  LEAGUES: [
    { id: 'uefa.champions', name: 'لیگ قهرمانان اروپا' },
    { id: 'eng.1', name: 'لیگ برتر انگلیس' },
    { id: 'esp.1', name: 'لالیگا' },
    { id: 'ita.1', name: 'سری آ' },
    { id: 'ger.1', name: 'بوندسلیگا' },
    { id: 'fra.1', name: 'لوشامپیونه' },
    { id: 'uefa.europa', name: 'لیگ اروپا' },
    { id: 'uefa.europa.conf', name: 'لیگ کنفرانس' },
    { id: 'esp.copa_del_rey', name: 'کوپا دل ری' },
    { id: 'esp.super_cup', name: 'سوپرکاپ اسپانیا' },
    { id: 'eng.fa', name: 'جام حذفی انگلیس' },
    { id: 'por.1', name: 'لیگ پرتغال' },
    { id: 'ned.1', name: 'اردیویسی هلند' },
    { id: 'ksa.1', name: 'لیگ عربستان' },
    { id: 'fifa.world', name: 'جام جهانی' },
    { id: 'uefa.euro', name: 'یورو' },
    { id: 'uefa.nations', name: 'لیگ ملت‌های اروپا' },
  ],
};
