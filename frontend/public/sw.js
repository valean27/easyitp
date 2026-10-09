// Service worker Easy ITP: aplicatia se deschide si fara internet (ultima versiune incarcata) si primeste notificari push.
// Datele (programarile de azi) nu trec pe aici: le pastreaza aplicatia, vezi src/utils/offline.ts.
const SHELL = 'easyitp-shell-v1';
const ASSETS = 'easyitp-assets-v1';
const MAX_ASSETS = 150;
const SHELL_FILES = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/theme-init.js'];

// Fisierele de baza, unul cate unul: un fisier care lipseste nu opreste instalarea (addAll ar respinge tot)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) =>
        Promise.all(
          SHELL_FILES.map((f) =>
            fetch(f, { cache: 'no-cache' })
              .then((res) => (res.ok ? c.put(f, res) : undefined))
              .catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Pastreaza doar ultimele MAX_ASSETS fisiere (la fiecare versiune noua apar altele, cu alt nume)
async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API-ul (alt domeniu) si orice nu e al aplicatiei: direct la retea
  if (url.origin !== self.location.origin) return;

  // Paginile: intai reteaua (versiunea noua), fara internet pagina salvata
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/', { cacheName: SHELL })),
    );
    return;
  }

  // Fisierele construite au numele schimbat la fiecare versiune: o data salvate nu se mai schimba
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone()).then(() => trim(cache));
              return res;
            }),
        ),
      ),
    );
    return;
  }

  if (SHELL_FILES.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Easy ITP', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Easy ITP', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || undefined,
      data: { url: data.url || '/' },
    }),
  );
});

// Click pe notificare: aplicatia deja deschisa merge la pagina notificarii, altfel se deschide
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.navigate(target).then((c) => (c || client).focus());
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
