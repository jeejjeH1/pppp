// Data comes from the Sportmonks Football API v3 through the /api/sm proxy (api/sm.js),
// which holds the API token server-side.
window.CONFIG = {
  PROXY: '/api/sm?path=',
  MADRID_ID: '3468',
  LALIGA: '564',
  // Persian names and display order for well-known Sportmonks league ids. The sidebar shows
  // whichever leagues the token's plan includes, in this order first.
  LEAGUES: [
    { id: '2', name: 'لیگ قهرمانان اروپا' },
    { id: '8', name: 'لیگ برتر انگلیس' },
    { id: '564', name: 'لالیگا' },
    { id: '384', name: 'سری آ' },
    { id: '82', name: 'بوندسلیگا' },
    { id: '301', name: 'لوشامپیونه' },
    { id: '5', name: 'لیگ اروپا' },
    { id: '2286', name: 'لیگ کنفرانس' },
    { id: '570', name: 'کوپا دل ری' },
    { id: '567', name: 'لالیگا ۲' },
    { id: '24', name: 'جام حذفی انگلیس' },
    { id: '27', name: 'جام اتحادیه انگلیس' },
    { id: '72', name: 'اردیویسی هلند' },
    { id: '462', name: 'لیگ پرتغال' },
    { id: '271', name: 'سوپرلیگا دانمارک' },
    { id: '501', name: 'لیگ برتر اسکاتلند' },
    { id: '732', name: 'جام جهانی' },
  ],
};
