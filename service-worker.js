// Service worker: cache do app shell para funcionar offline.
// Estratégia "network-first" para o app (arquivos do próprio site): estando
// online, sempre pega a versão mais nova; offline, cai no cache.
// O Tesseract.js vem da CDN na 1ª leitura (não é interceptado aqui).

const CACHE = 'bingo-shell-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/bingo.js',
  './js/storage.js',
  './js/ocr.js',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // deixa a CDN do Tesseract com a rede

  // network-first: busca na rede, atualiza o cache e cai no cache se offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
