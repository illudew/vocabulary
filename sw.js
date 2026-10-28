/* WORDS Service Worker —— 离线可用（词库见 words.json，联网仅用于在线发音） */
var CACHE = 'words-v7-53';
var ASSETS = [
  './',
  './index.html',
  './words.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        /* 强制绕过 HTTP 缓存，避免把旧词库装进新缓存 */
        return Promise.all(ASSETS.map(function (u) {
          return fetch(u, { cache: 'reload' }).then(function (res) {
            if (!res.ok) throw new Error('缓存失败 ' + u);
            return c.put(u, res);
          });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; /* 在线词典等跨域请求直接放行 */

  /* 页面导航：网络优先，失败时回退到离线缓存 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  /* 词库：网络优先（强制绕过 HTTP 缓存），断网时回退缓存 */
  if (/\/words\.json$/.test(url.pathname)) {
    e.respondWith(
      fetch(req, { cache: 'reload' }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./words.json', copy); });
        return res;
      }).catch(function () {
        return caches.match('./words.json');
      })
    );
    return;
  }

  /* 静态资源：缓存优先 */
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
