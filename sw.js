// Bump CACHE_VERSION on every release so installed PWAs pick up the update.
const CACHE_VERSION = 'bbc110-v5';

const PRECACHE = [
  './',
  'index.html',
  'show.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/canvas.css',
  'css/fonts.css',
  'css/themes.css',
  'css/animations.css',
  'js/main.js',
  'js/store.js',
  'js/db.js',
  'js/model.js',
  'js/renderer.js',
  'js/library.js',
  'js/pwa.js',
  'js/history.js',
  'js/live.js',
  'js/animator.js',
  'js/backgrounds.js',
  'js/themes.js',
  'js/fonts.js',
  'js/editor/editor.js',
  'js/editor/canvas.js',
  'js/editor/inspector.js',
  'js/editor/panels.js',
  'js/editor/images.js',
  'js/editor/colorpicker.js',
  'js/elements/text.js',
  'js/elements/shape.js',
  'js/elements/image.js',
  'js/elements/textstyle.js',
  'js/elements/clock.js',
  'js/elements/timer.js',
  'js/elements/bar.js',
  'js/elements/banner.js',
  'js/elements/ticker.js',
  'js/elements/qrcode.js',
  'js/elements/qr.js',
  'js/elements/scoreboard.js',
  'js/show/show.js',
  'assets/fonts/anton-400.woff2',
  'assets/fonts/bebas-400.woff2',
  'assets/fonts/caveat-vf.woff2',
  'assets/fonts/dancing-vf.woff2',
  'assets/fonts/fredoka-vf.woff2',
  'assets/fonts/inter-vf.woff2',
  'assets/fonts/jetbrains-vf.woff2',
  'assets/fonts/lora-vf.woff2',
  'assets/fonts/marker-400.woff2',
  'assets/fonts/merriweather-vf.woff2',
  'assets/fonts/montserrat-vf.woff2',
  'assets/fonts/nunito-vf.woff2',
  'assets/fonts/oswald-vf.woff2',
  'assets/fonts/pacifico-400.woff2',
  'assets/fonts/playfair-vf.woff2',
  'assets/fonts/poppins-400.woff2',
  'assets/fonts/poppins-600.woff2',
  'assets/fonts/poppins-700.woff2',
  'assets/icons/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page asks to activate the waiting worker after the user taps "Refresh".
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
