// Service worker: cache do app shell para funcionar offline.
// Estratégia "network-first" para o app (arquivos do próprio site): estando
// online, sempre pega a versão mais nova; offline, cai no cache.
// O Tesseract.js vem da CDN na 1ª leitura (não é interceptado aqui).

const CACHE = 'bingo-shell-v10';
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
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/install-card.png',
];

self.addEventListener('install', (e) => {
  // não chama skipWaiting: o novo SW fica "esperando" até o usuário aceitar atualizar
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// o app pede a ativação quando o usuário toca em "Atualizar"
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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
