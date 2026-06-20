const CACHE = 'edf-frontline-v3';
const ASSETS = [
  '/frontline-held/',
  '/frontline-held/index.html',
  '/frontline-held/game.js',
  '/frontline-held/assets/audio/bgm.mp3',
  '/frontline-held/assets/images/bg.png',
  '/frontline-held/assets/images/edf_icon.png',
  '/frontline-held/assets/images/barricade_normal.png',
  '/frontline-held/assets/images/barricade_damaged.png',
  '/frontline-held/assets/images/ui/top_bg.png',
  '/frontline-held/assets/images/ui/logo1.png',
  '/frontline-held/assets/images/ui/logo2.png',
  '/frontline-held/assets/images/ui/logo3.png',
  '/frontline-held/assets/images/ui/taisa.png',
  '/frontline-held/assets/images/ui/tutorial.png',
  '/frontline-held/assets/images/ui/atk_max.png',
  '/frontline-held/assets/images/ui/spd_max.png',
  '/frontline-held/assets/images/ui/brs_max.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
