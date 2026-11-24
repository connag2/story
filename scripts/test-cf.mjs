// Cloudflare Pages 함수 점검 (wrangler 없이): functions/api/[name].js 가 api/*.js 를 모두 연결하는지
//   실제 Cloudflare 엔진으로 전체 점검: npx wrangler pages dev dist … 후 API_BASE=… node scripts/test-api.js (README 참고)
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { onRequest } from "../functions/api/[name].js";

const env = {
  ADMIN_NAMES: "관리자", AUTH_SECRET: "test",
  ASSETS: { fetch: async (req) => new Response(await readFile(decodeURIComponent(new URL(req.url).pathname.slice(1)))) },
};
// 가장자리 캐시 흉내 (Cloudflare 의 caches.default)
const store = new Map(), pending = [];
globalThis.caches = { default: { match: async (r) => (store.has(r.url) ? store.get(r.url).clone() : undefined), put: async (r, res) => void store.set(r.url, res), delete: async (r) => store.delete(r.url) } };
const call = (name, method = "GET", q = "", headers = {}) => onRequest({
  request: new Request(`http://x/api/${name}${q}`, { method, headers }), env, params: { name }, waitUntil: (p) => pending.push(p),
});

// api/ 의 모든 주소(_ 로 시작하지 않는 파일)가 연결되어 있어야 함
const files = (await readdir("api")).filter((f) => f.endsWith(".js") && !f.startsWith("_")).map((f) => f.slice(0, -3));
for (const f of files) assert.notEqual((await call(f, "PATCH")).status, 404, `functions/api/[name].js 에 ${f} 가 빠졌어요`);
assert.equal((await call("nope")).status, 404);
assert.equal((await call("points", "PATCH")).status, 405);
assert.equal((await (await call("tts")).json()).voices.length >= 4, true);
assert.equal((await call("sync")).status, 401, "로그인 없이 기록 읽기");
// 공개 댓글 목록은 가장자리에 기억 → 두 번째는 저장소에 가지 않음, 브라우저에는 원래 규칙
const first = await call("comments");
await Promise.all(pending);
assert.ok(store.has("http://x/api/comments"), "댓글 목록 캐시");
const second = await call("comments");
assert.equal(second.headers.get("x-edge-cache"), "HIT");
assert.equal(second.headers.get("cache-control"), first.headers.get("cache-control"), "브라우저 기억 규칙 그대로");
assert.equal((await call("comments", "GET", "", { authorization: "Bearer x" })).headers.get("x-edge-cache"), null, "로그인 요청은 캐시 안 씀");
// 글쓰기 같은 요청이 성공하면 목록 기억을 지움 (실패하면 그대로)
await call("comments", "POST"); await Promise.all(pending);
assert.ok(store.has("http://x/api/comments"), "실패한 요청은 그대로");
await onRequest({ request: new Request("http://x/api/points", { method: "POST" }), env, params: { name: "points" }, waitUntil: (p) => pending.push(p) });
const okPost = await onRequest({ request: new Request("http://x/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", name: "캐시", password: "1234" }) }), env, params: { name: "auth" }, waitUntil: (p) => pending.push(p) });
assert.equal(okPost.status, 200);
store.set("http://x/api/auth", new Response("x")); await onRequest({ request: new Request("http://x/api/auth", { method: "POST", body: JSON.stringify({ action: "login", name: "캐시", password: "1234" }) }), env, params: { name: "auth" }, waitUntil: (p) => pending.push(p) });
await Promise.all(pending);
assert.ok(!store.has("http://x/api/auth"), "성공한 쓰기 → 기억 지움");
delete globalThis.caches;
delete globalThis.__STORY_CF; delete globalThis.__STORY_KV; delete globalThis.__STORY_ASSET;
console.log(`ok — Cloudflare 함수 연결 (${files.join(" · ")}) · 가장자리 캐시`);
