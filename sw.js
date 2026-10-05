/* ============================================================
   Service Worker：把页面本身缓存下来，让手机断网也能打开
   ------------------------------------------------------------
   注意：Service Worker 只在 https 或 http://localhost 下有效。
   本机用 file:// 打开时它不会工作（注册会失败），页面照常运行。

   ★ 每次改完页面（index.html / style.css / app.js），把下面这行的
     版本号加一（v3 → v4 → v5…）。手机靠这个数字判断"有新版本了"，
     不加的话大家会一直用旧的缓存。
     —— 这行不需要你手动改，改代码的人（我）会一起改好。
   ============================================================ */

const CACHE = 'timetable-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => { /* 某个文件拿不到也不影响使用 */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // 先用缓存（快、能离线），同时在后台更新一份
  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit || caches.match('./index.html'));
      return hit || fresh;
    })
  );
});
