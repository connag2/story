// 오프라인 지원 + 자동 업데이트
//  - 인터넷이 되면 항상 서버의 최신 파일을 받아 쓰고(자동 업데이트), 받은 것을 저장해 둬요.
//  - 인터넷이 안 되면 저장해 둔 것으로 열어요.
const CACHE = "story";
const CORE = [
  "./", "index.html", "css/style.css", "js/app.js", "js/sync.js", "js/shop.js", "js/comments.js", "js/ink.js", "js/extras.js", "js/pyrun.js", "js/english.js",
  "data/reading.js", "data/reading-mock-2026-09.js", "data/reading-2.js", "data/reading-textbook.js", "data/math.js", "data/english.js", "data/english-notes-bisang-1.js", "data/english-notes-bisang-2.js", "data/english-notes-mock26-1.js", "data/english-notes-mock26-2.js", "data/english-notes-mock25-1.js", "data/english-notes-mock25-2.js", "data/programming.js", "data/programming-2.js", "data/korean.js", "data/guides.js",
  "data/solutions-math-1.js", "data/solutions-math-2.js", "data/solutions-math-3.js", "data/solutions-reading.js", "data/solutions-programming.js", "data/solutions-korean.js",
  "vendor/katex/katex.min.css", "vendor/katex/katex.min.js", "vendor/katex/auto-render.min.js",
  "manifest.webmanifest", "assets/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await fetch(e.request, { cache: "no-cache" });
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch (err) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      if (e.request.mode === "navigate") return (await cache.match("index.html")) || Response.error();
      return Response.error();
    }
  })());
});
