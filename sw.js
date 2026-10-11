// 오프라인 지원: 한 번 연 화면·문제·그림은 인터넷이 없어도 열려요.
// 파일을 바꾸면 VERSION 을 올려 주세요(옛 캐시를 지움).
const VERSION = "story-v1";
const CORE = [
  "./", "index.html", "css/style.css", "js/app.js", "js/sync.js",
  "data/reading.js", "data/math.js", "data/english.js", "data/programming.js", "data/korean.js",
  "vendor/katex/katex.min.css", "vendor/katex/katex.min.js", "vendor/katex/auto-render.min.js",
  "manifest.webmanifest", "assets/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 같은 사이트의 파일: 캐시를 먼저 보여 주고 뒤에서 새 버전으로 갱신 (/api 는 항상 서버로)
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    if (r) return r;
    if (e.request.mode === "navigate") return (await cache.match("index.html")) || Response.error();
    return Response.error();
  }));
});
