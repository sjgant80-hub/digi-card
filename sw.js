// sw.js — offline after the first visit. Network first (always the newest kernel when online), the cache when not; every
// request is revalidated (cache: 'no-cache': a cheap 304 when nothing changed), so a returning visitor never runs a stale
// module beside a fresh page. The datasets are cached the first time a card grows on them, so a card grows offline after.
const CACHE = 'digi-card-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || new Response('offline', { status: 503 }))));
});
