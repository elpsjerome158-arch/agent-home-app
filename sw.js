/* Agent Home service worker: offline shell + hashed asset cache. Public files only.
   - Hashed bundles/fonts/images under _expo/ & assets/: cache-first (immutable).
   - HTML pages: network-first, fall back to cached page, then cached start page.
   - JSON feeds: network-first, fall back to last cached copy (desk.enc.json stays encrypted at rest). */
const V = 'ah-v1';
const SCOPE = new URL(self.registration.scope).pathname; // e.g. /agent-home-app/
const SHELL = [SCOPE, SCOPE + 'manifest.webmanifest', SCOPE + 'apple-touch-icon.png', SCOPE + 'icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (req, res) => { if (res && res.ok && res.type === 'basic') { const c = res.clone(); caches.open(V).then((ca) => ca.put(req, c)); } return res; };
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (/\/(_expo|assets)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => put(req, r))));
  } else if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => put(req, r)).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match(SCOPE))));
  } else if (url.pathname.endsWith('.json')) {
    const key = url.origin + url.pathname; // ignore cache-busting query
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(V).then((ca) => ca.put(key, c)); } return r; }).catch(() => caches.match(key).then((hit) => hit || Response.error())));
  }
});
