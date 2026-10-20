/* Офлайн ажиллагаа: апп-ын үндсэн файл ба агуулгыг суулгах үед хадгална,
   зургийг анх нээх үед хадгална. Агуулга шинэчлэгдэхэд VERSION-г өөрчил. */
const VERSION = 'amn-1.7.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'feedback.json',
  'schema/sources.json', 'data/index.json', 'data/search.json',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    const idx = await (await fetch('data/index.json')).json();
    await cache.addAll(idx.topics.map(t => 'data/' + t.file));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  // JSON, HTML, JS: сүлжээ эхэлж (шинэ хувилбар шууд харагдана), офлайн бол кэш
  const fresh = sameOrigin && (req.mode === 'navigate' || /\.(json|js|html|css)$/.test(url.pathname) || url.pathname.endsWith('/'));
  if (fresh) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? cache.match('index.html') : Promise.reject(err));
      }
    })());
    return;
  }
  // зураг, 3D загвар, фонт: кэш эхэлж
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return cache.match('index.html');
      throw err;
    }
  })());
});
