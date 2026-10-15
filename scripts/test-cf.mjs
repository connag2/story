// Cloudflare Pages 함수 점검 (wrangler 없이): functions/api/[name].js 가 api/*.js 를 모두 연결하는지
//   실제 Cloudflare 엔진으로 전체 점검: npx wrangler pages dev dist … 후 API_BASE=… node scripts/test-api.js (README 참고)
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { onRequest } from "../functions/api/[name].js";

const env = {
  ADMIN_NAMES: "관리자", AUTH_SECRET: "test",
  ASSETS: { fetch: async (req) => new Response(await readFile(decodeURIComponent(new URL(req.url).pathname.slice(1)))) },
};
const call = (name, method = "GET", q = "") => onRequest({ request: new Request(`http://x/api/${name}${q}`, { method }), env, params: { name } });

// api/ 의 모든 주소(_ 로 시작하지 않는 파일)가 연결되어 있어야 함
const files = (await readdir("api")).filter((f) => f.endsWith(".js") && !f.startsWith("_")).map((f) => f.slice(0, -3));
for (const f of files) assert.notEqual((await call(f, "PATCH")).status, 404, `functions/api/[name].js 에 ${f} 가 빠졌어요`);
assert.equal((await call("nope")).status, 404);
assert.equal((await call("points", "PATCH")).status, 405);
assert.equal((await (await call("tts")).json()).voices.length >= 4, true);
assert.equal((await call("sync")).status, 401, "로그인 없이 기록 읽기");
delete globalThis.__STORY_CF; delete globalThis.__STORY_KV; delete globalThis.__STORY_ASSET;
console.log(`ok — Cloudflare 함수 연결 (${files.join(" · ")})`);
